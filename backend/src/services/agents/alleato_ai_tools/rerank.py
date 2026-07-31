"""Cross-encoder reranking layer for retrieval results.

Selects a backend based on what's configured:

1. **Cohere Rerank 3.5** if `COHERE_API_KEY` is set. Best quality, ~$2/1k searches.
2. **OpenAI scoring rerank** if `OPENAI_API_KEY` is set. Uses `gpt-4.1-mini` to
   score all candidates in a single structured call. Slower than Cohere but works
   with the OpenAI infra alleato-pm already has.
3. **Identity fallback** otherwise — returns vector order, never crashes.

The retrieval consumer (`retrieve()` in `tools/rag.py`) enables reranking when
*either* key is set. Each backend records a `rerank_score` in [0, 1] on the
returned rows. Fails open on errors — retrieval is never blocked by a reranker.
"""

from __future__ import annotations

import json
import logging
import os
import re
from functools import lru_cache
from typing import Any

logger = logging.getLogger(__name__)

_COHERE_MODEL = "rerank-v3.5"
_OPENAI_RERANK_MODEL = os.environ.get("OPENAI_RERANK_MODEL", "gpt-4.1-mini")
_MAX_DOC_CHARS = 8000
_OPENAI_BATCH = 20  # candidates per OpenAI rerank call


# ---------------------------------------------------------------------------
# Backend selection
# ---------------------------------------------------------------------------


def _backend() -> str:
    if os.environ.get("COHERE_API_KEY"):
        return "cohere"
    if os.environ.get("OPENAI_API_KEY"):
        return "openai"
    return "none"


def _document_text(row: dict[str, Any]) -> str:
    title = row.get("doc_title") or ""
    body = row.get("chunk_text") or ""
    combined = f"{title}\n\n{body}" if title else body
    return combined[:_MAX_DOC_CHARS]


# ---------------------------------------------------------------------------
# Cohere backend
# ---------------------------------------------------------------------------


@lru_cache(maxsize=1)
def _cohere_client() -> Any:
    import cohere

    api_key = os.environ["COHERE_API_KEY"]
    return cohere.ClientV2(api_key=api_key)


def _rerank_cohere(query: str, rows: list[dict[str, Any]], top_n: int) -> list[dict[str, Any]]:
    documents = [_document_text(r) for r in rows]
    resp = _cohere_client().rerank(
        model=_COHERE_MODEL,
        query=query,
        documents=documents,
        top_n=min(top_n, len(documents)),
    )
    reranked: list[dict[str, Any]] = []
    for result in resp.results:
        idx = result.index
        if 0 <= idx < len(rows):
            row = dict(rows[idx])
            row["rerank_score"] = float(result.relevance_score)
            reranked.append(row)
    return reranked


# ---------------------------------------------------------------------------
# OpenAI backend
# ---------------------------------------------------------------------------

_OPENAI_PROMPT = """\
You are a precise relevance scorer. Score each passage's relevance to the query
on a 0-10 integer scale where:
  10 = directly answers the query
  7-9 = strongly relevant, contains key facts
  4-6 = topically related but not answering
  1-3 = tangentially related
  0 = unrelated

Query:
{query}

Passages (numbered):
{passages}

Reply with EXACTLY this JSON shape, nothing else:
{{"scores": [<int for passage 1>, <int for passage 2>, ...]}}
"""


@lru_cache(maxsize=1)
def _openai_client() -> Any:
    from src.services.ai_transport import get_openai_client
    return get_openai_client()


def _score_batch_openai(query: str, docs: list[str]) -> list[float]:
    passages = "\n\n".join(f"[{i + 1}] {d}" for i, d in enumerate(docs))
    prompt = _OPENAI_PROMPT.format(query=query, passages=passages)
    kwargs: dict[str, Any] = {
        "model": _OPENAI_RERANK_MODEL,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.0,
        "response_format": {"type": "json_object"},
    }
    resp = _openai_client().chat.completions.create(**kwargs)
    content = (resp.choices[0].message.content or "").strip()
    try:
        scores = json.loads(content)["scores"]
        if not isinstance(scores, list) or len(scores) != len(docs):
            raise ValueError(f"score list shape mismatch: got {scores!r}")
        return [max(0.0, min(10.0, float(s))) / 10.0 for s in scores]
    except (json.JSONDecodeError, KeyError, TypeError, ValueError) as exc:
        # Last-ditch: pull integers in order from the response.
        ints = [int(m) for m in re.findall(r"\d+", content)]
        if len(ints) >= len(docs):
            return [max(0.0, min(10.0, float(s))) / 10.0 for s in ints[: len(docs)]]
        raise RuntimeError(f"unparseable score response: {exc}: {content[:200]}") from exc


def _rerank_openai(query: str, rows: list[dict[str, Any]], top_n: int) -> list[dict[str, Any]]:
    docs = [_document_text(r) for r in rows]
    all_scores: list[float] = []
    for start in range(0, len(docs), _OPENAI_BATCH):
        batch = docs[start : start + _OPENAI_BATCH]
        all_scores.extend(_score_batch_openai(query, batch))

    indexed = list(enumerate(rows))
    indexed.sort(key=lambda pair: all_scores[pair[0]], reverse=True)
    reranked: list[dict[str, Any]] = []
    for idx, original_row in indexed[:top_n]:
        row = dict(original_row)
        row["rerank_score"] = all_scores[idx]
        reranked.append(row)
    return reranked


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------


def rerank_results(
    query: str,
    rows: list[dict[str, Any]],
    top_n: int,
) -> list[dict[str, Any]]:
    """Rerank rows using the best available backend; return top_n.

    Fails open: on any error, returns rows[:top_n] in vector order. Logs the
    failure so it's visible without breaking retrieval.
    """
    if not rows or top_n <= 0:
        return rows[:top_n]

    backend = _backend()
    if backend == "none":
        return rows[:top_n]

    try:
        if backend == "cohere":
            return _rerank_cohere(query, rows, top_n)
        return _rerank_openai(query, rows, top_n)
    except Exception as exc:  # noqa: BLE001
        logger.warning("rerank (%s) failed (%s); falling back to vector order", backend, exc)
        return rows[:top_n]
