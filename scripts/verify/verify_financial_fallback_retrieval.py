#!/usr/bin/env python3
"""End-to-end verifier for financial fallback retrieval.

Goal:
- Confirm a financial-intent query with NO structured financial row matches
  falls back to transcript/document retrieval (semantic/keyword path).

Method:
1. Generate a unique token and ensure `search_financial_rows` returns 0 hits.
2. Seed a non-financial document chunk in `documents` containing that token.
3. Call backend `/api/chat` with a financial-intent query containing the token.
4. Assert response does NOT use `financial_structured` and includes the token
   in a returned snippet.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, Tuple
from uuid import uuid4

import requests

REPO_ROOT = Path(__file__).resolve().parents[2]
BACKEND_SRC = REPO_ROOT / "backend" / "src"
if str(BACKEND_SRC) not in sys.path:
    sys.path.insert(0, str(BACKEND_SRC))

from services.env_loader import load_env


@dataclass
class VerifyResult:
    passed: bool
    message: str
    details: Dict[str, Any]


def _get_store_and_client():
    try:
        from services.supabase_helpers import SupabaseRagStore, get_supabase_client
    except Exception as exc:
        raise RuntimeError(
            "Supabase Python dependency is missing. Install backend deps first: "
            "`cd backend && pip install -r requirements.txt`"
        ) from exc

    client = get_supabase_client()
    store = SupabaseRagStore(client)
    return store, client


def _find_zero_match_query(store, project_id: int, max_attempts: int = 12) -> Tuple[str, str]:
    for _ in range(max_attempts):
        token = f"fallbacktoken_{uuid4().hex[:12]}"
        query = f"Need variance details for {token}"
        hits = store.search_financial_rows(query=query, project_id=project_id, limit=3)
        if not hits:
            return query, token
    raise RuntimeError("Could not find zero-match financial query after multiple attempts")


def _seed_nonfinancial_doc(client, project_id: int, token: str) -> str:
    metadata_id = str(uuid4())
    content = (
        f"Fallback verification marker {token}. "
        f"This is a non-financial narrative note for project retrieval fallback."
    )

    client.table("document_metadata").insert(
        {
            "id": metadata_id,
            "title": "Fallback Verification Fixture",
            "category": "document",
            "type": "document",
            "source": "verification_script",
            "status": "complete",
            "phase": "ingest",
            "project_id": project_id,
            "content": content,
            "raw_text": content,
            "file_name": "fallback-fixture.txt",
        }
    ).execute()

    # Legacy `documents` table insert removed — the table was dropped. The
    # `document_metadata` row above is the only fixture needed; the chat API
    # fallback no longer reads from `documents`.
    return metadata_id


def _cleanup_fixture(client, metadata_id: str) -> None:
    client.table("document_metadata").delete().eq("id", metadata_id).execute()


def verify(project_id: int, backend_url: str, cleanup: bool) -> VerifyResult:
    store, client = _get_store_and_client()
    query, token = _find_zero_match_query(store, project_id=project_id)
    metadata_id = _seed_nonfinancial_doc(client, project_id=project_id, token=token)

    try:
        payload = {
            "message": query,
            "project_id": project_id,
            "limit": 5,
        }
        response = requests.post(
            f"{backend_url.rstrip('/')}/api/chat",
            json=payload,
            timeout=30,
        )

        if response.status_code != 200:
            return VerifyResult(
                passed=False,
                message="Backend /api/chat returned non-200",
                details={"status_code": response.status_code, "body": response.text[:500]},
            )

        data = response.json()
        sources = data.get("sources") or []
        if not sources:
            return VerifyResult(
                passed=False,
                message="No sources returned from /api/chat",
                details={"response": data, "query": query, "token": token},
            )

        first_mode = (sources[0].get("metadata") or {}).get("retrieval_mode")
        if first_mode == "financial_structured":
            return VerifyResult(
                passed=False,
                message="Fallback failed: still used financial_structured mode",
                details={"query": query, "token": token, "source": sources[0]},
            )

        token_hit = any(token in (s.get("snippet") or "") for s in sources)
        if not token_hit:
            return VerifyResult(
                passed=False,
                message="Fallback retrieval did not return seeded token evidence",
                details={"query": query, "token": token, "sources": sources[:3]},
            )

        return VerifyResult(
            passed=True,
            message="Financial fallback retrieval verification passed",
            details={
                "metadata_id": metadata_id,
                "query": query,
                "token": token,
                "source": sources[0],
            },
        )
    finally:
        if cleanup:
            _cleanup_fixture(client, metadata_id)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Verify financial fallback retrieval end-to-end")
    parser.add_argument("--project-id", type=int, required=True)
    parser.add_argument("--backend-url", default=os.getenv("PYTHON_BACKEND_URL", "http://127.0.0.1:8000"))
    parser.add_argument("--no-cleanup", action="store_true", help="Keep seeded fixture rows for inspection")
    return parser.parse_args()


def main() -> int:
    load_env()
    args = parse_args()
    result = verify(
        project_id=args.project_id,
        backend_url=args.backend_url,
        cleanup=not args.no_cleanup,
    )
    print(json.dumps(result.__dict__, indent=2))
    return 0 if result.passed else 1


if __name__ == "__main__":
    raise SystemExit(main())
