"""URL resource ingestion into the existing Alleato RAG pipeline."""

from __future__ import annotations

import hashlib
import logging
import re
from dataclasses import dataclass
from typing import Any, Dict, List, Optional
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse
from uuid import NAMESPACE_URL, uuid5

import requests
from bs4 import BeautifulSoup

from .pipeline.workflow_client import enqueue_document_workflow
from .supabase_helpers import SupabaseRagStore, update_ingestion_job_state

logger = logging.getLogger(__name__)

_REQUEST_TIMEOUT = (10, 45)
_USER_AGENT = (
    "AlleatoUrlResourceIngestion/1.0 "
    "(existing-rag-pipeline; contact engineering if blocked)"
)
_MIN_EXTRACTED_CHARS = 120
_TRACKING_QUERY_PARAMS = {
    "fbclid",
    "gclid",
    "mc_cid",
    "mc_eid",
    "ref",
    "ref_src",
}
_CONTENT_SELECTORS = (
    "article",
    "main",
    "[role='main']",
    ".article",
    ".article-content",
    ".content",
    ".entry-content",
    ".post-content",
    "#content",
)


@dataclass
class UrlExtraction:
    requested_url: str
    resolved_url: str
    normalized_url: str
    title: str
    description: Optional[str]
    content_type: str
    status_code: int
    extracted_text: str
    formatted_content: str
    content_hash: str


class UrlIngestionError(RuntimeError):
    """Specific error for URL ingestion failures."""


class UrlResourceIngestionService:
    """Fetch, extract, and store web resources through the existing RAG path."""

    def __init__(self, store: Optional[SupabaseRagStore] = None) -> None:
        self.store = store or SupabaseRagStore()

    def ingest_urls(
        self,
        urls: List[str],
        *,
        project_id: Optional[int] = None,
        dry_run: bool = False,
        run_pipeline: bool = True,
    ) -> List[Dict[str, Any]]:
        if not urls:
            raise UrlIngestionError("At least one URL is required for ingestion.")

        results: List[Dict[str, Any]] = []
        for raw_url in urls:
            try:
                results.append(
                    self.ingest_url(
                        raw_url,
                        project_id=project_id,
                        dry_run=dry_run,
                        run_pipeline=run_pipeline,
                    )
                )
            except Exception as exc:
                message = str(exc)
                logger.error("[UrlResourceIngestion] %s failed: %s", raw_url, message, exc_info=True)
                results.append(
                    {
                        "url": (raw_url or "").strip(),
                        "status": "failed",
                        "reason": message,
                        "pipeline_status": "not_run",
                    }
                )
        return results

    def ingest_url(
        self,
        raw_url: str,
        *,
        project_id: Optional[int] = None,
        dry_run: bool = False,
        run_pipeline: bool = True,
    ) -> Dict[str, Any]:
        extraction = self._fetch_and_extract(raw_url)
        document_id = self._document_id(extraction.normalized_url, project_id)
        source_item_id = self._source_item_id(extraction.normalized_url, project_id)
        existing = self.store.fetch_rag_document_metadata(document_id) or {}
        existing_hash = str(existing.get("content_hash") or "").strip() or None

        base_result: Dict[str, Any] = {
            "url": extraction.requested_url,
            "resolved_url": extraction.resolved_url,
            "normalized_url": extraction.normalized_url,
            "document_id": document_id,
            "project_id": project_id,
            "title": extraction.title,
            "content_hash": extraction.content_hash,
            "content_length": len(extraction.extracted_text),
        }

        if existing_hash and existing_hash == extraction.content_hash:
            return {
                **base_result,
                "status": "skipped_unchanged",
                "reason": "Normalized URL already exists with the same content hash.",
                "pipeline_status": "not_run",
            }

        if dry_run:
            return {
                **base_result,
                "status": "dry_run",
                "reason": "Dry run only; no metadata or chunks were written.",
                "pipeline_status": "not_run",
                "preview_excerpt": extraction.extracted_text[:400],
            }

        metadata = {
            "id": document_id,
            "app_document_id": document_id,
            "title": extraction.title,
            "source": "url_resource",
            "source_system": "url_ingestion",
            "source_item_id": source_item_id,
            "project_id": project_id,
            "category": "resource",
            "type": "web_page",
            "status": "raw_ingested",
            "parsing_status": "raw_ingested",
            "embedding_status": "pending",
            "url": extraction.requested_url,
            "source_web_url": extraction.requested_url,
            "content": extraction.formatted_content,
            "raw_text": extraction.extracted_text,
            "content_hash": extraction.content_hash,
            "source_metadata": {
                "requested_url": extraction.requested_url,
                "resolved_url": extraction.resolved_url,
                "normalized_url": extraction.normalized_url,
                "content_type": extraction.content_type,
                "http_status": extraction.status_code,
                "meta_description": extraction.description,
            },
            "processing_metadata": {
                "ingest_path": "url_resource_ingestion",
                "content_origin": "web_page",
            },
        }
        self.store.upsert_document_metadata(metadata)
        update_ingestion_job_state(
            document_id,
            stage="raw_ingested",
            error_message=None,
            fireflies_id=document_id,
        )

        pipeline_status = "not_run"
        pipeline_result: Optional[Dict[str, Any]] = None
        if run_pipeline:
            pipeline_result = enqueue_document_workflow(
                document_id,
                source_type="url_resource",
            )
            pipeline_status = pipeline_result.get("status") or "queued"

        final_metadata = self.store.fetch_rag_document_metadata(document_id) or {}
        chunk_count = len(self.store.query_chunks({"document_id": document_id}, limit=2000))

        return {
            **base_result,
            "status": "updated" if existing else "ingested",
            "reason": (
                "Existing normalized URL content changed and was reprocessed."
                if existing
                else "Fetched, extracted, stored, and routed into the existing pipeline."
            ),
            "pipeline_status": pipeline_status,
            "chunk_count": chunk_count,
            "metadata_category": final_metadata.get("category"),
            "metadata_type": final_metadata.get("type"),
            "stored_source_web_url": final_metadata.get("source_web_url"),
            "stored_url": final_metadata.get("url"),
            "final_content_hash": final_metadata.get("content_hash"),
            **({"pipeline_result": pipeline_result} if pipeline_result is not None else {}),
        }

    def _fetch_and_extract(self, raw_url: str) -> UrlExtraction:
        requested_url = self._validate_absolute_url(raw_url)
        try:
            response = requests.get(
                requested_url,
                timeout=_REQUEST_TIMEOUT,
                headers={"User-Agent": _USER_AGENT},
            )
        except requests.RequestException as exc:
            raise UrlIngestionError(
                f"Failed to fetch URL '{requested_url}': {type(exc).__name__}: {exc}"
            ) from exc

        if response.status_code >= 400:
            raise UrlIngestionError(
                f"URL '{requested_url}' returned HTTP {response.status_code} and could not be ingested."
            )

        content_type = (response.headers.get("content-type") or "").lower()
        if "html" not in content_type and "text/plain" not in content_type:
            raise UrlIngestionError(
                f"URL '{requested_url}' returned unsupported content type '{content_type or 'unknown'}'. "
                "Only HTML and plain-text pages are supported by this ingestion path."
            )

        resolved_url = response.url or requested_url
        normalized_url = self._normalize_url(resolved_url)

        if "text/plain" in content_type:
            title = resolved_url
            description = None
            extracted_text = self._clean_whitespace(response.text)
        else:
            soup = BeautifulSoup(response.text, "html.parser")
            for tag in soup(["script", "style", "noscript", "svg"]):
                tag.decompose()

            title = self._clean_whitespace(
                (soup.title.get_text(" ", strip=True) if soup.title else "") or resolved_url
            )
            description_tag = soup.find("meta", attrs={"name": re.compile("^description$", re.I)})
            description = None
            if description_tag:
                description = self._clean_whitespace(description_tag.get("content", "")) or None
            extracted_text = self._extract_main_text(soup)

        if len(extracted_text) < _MIN_EXTRACTED_CHARS:
            raise UrlIngestionError(
                f"URL '{requested_url}' was fetched but only produced {len(extracted_text)} extracted characters. "
                "The page is too empty or noisy to ingest safely."
            )

        formatted_content = self._format_content(
            title=title,
            requested_url=requested_url,
            resolved_url=resolved_url,
            description=description,
            body=extracted_text,
        )
        content_hash = hashlib.sha256(formatted_content.encode("utf-8")).hexdigest()

        return UrlExtraction(
            requested_url=requested_url,
            resolved_url=resolved_url,
            normalized_url=normalized_url,
            title=title,
            description=description,
            content_type=content_type,
            status_code=response.status_code,
            extracted_text=extracted_text,
            formatted_content=formatted_content,
            content_hash=content_hash,
        )

    @staticmethod
    def _document_id(normalized_url: str, project_id: Optional[int]) -> str:
        scope = str(project_id) if project_id is not None else "global"
        return f"web_resource_{uuid5(NAMESPACE_URL, f'{scope}:{normalized_url}')}"

    @staticmethod
    def _source_item_id(normalized_url: str, project_id: Optional[int]) -> str:
        scope = str(project_id) if project_id is not None else "global"
        return hashlib.sha256(f"{scope}:{normalized_url}".encode("utf-8")).hexdigest()[:24]

    @staticmethod
    def _validate_absolute_url(raw_url: str) -> str:
        candidate = (raw_url or "").strip()
        if not candidate:
            raise UrlIngestionError("Blank URLs cannot be ingested.")
        parsed = urlparse(candidate)
        if parsed.scheme not in {"http", "https"} or not parsed.netloc:
            raise UrlIngestionError(
                f"URL '{candidate}' must be absolute and use http or https."
            )
        return candidate

    @staticmethod
    def _normalize_url(raw_url: str) -> str:
        parsed = urlparse(raw_url.strip())
        scheme = parsed.scheme.lower()
        hostname = (parsed.hostname or "").lower()
        port = parsed.port
        netloc = hostname
        if port and not ((scheme == "http" and port == 80) or (scheme == "https" and port == 443)):
            netloc = f"{hostname}:{port}"
        path = parsed.path or "/"
        if path != "/" and path.endswith("/"):
            path = path.rstrip("/")
        query_pairs = [
            (key, value)
            for key, value in parse_qsl(parsed.query, keep_blank_values=True)
            if not key.lower().startswith("utm_") and key.lower() not in _TRACKING_QUERY_PARAMS
        ]
        query = urlencode(query_pairs, doseq=True)
        return urlunparse((scheme, netloc, path, "", query, ""))

    def _extract_main_text(self, soup: BeautifulSoup) -> str:
        candidates = []
        for selector in _CONTENT_SELECTORS:
            try:
                candidates.extend(soup.select(selector))
            except Exception:
                continue

        for candidate in candidates:
            text = self._clean_extracted_text(candidate.get_text("\n", strip=True))
            if len(text) >= _MIN_EXTRACTED_CHARS:
                return text

        body = soup.body or soup
        text = self._clean_extracted_text(body.get_text("\n", strip=True))
        if text:
            return text
        raise UrlIngestionError("Fetched HTML page did not contain readable text after extraction.")

    @staticmethod
    def _clean_extracted_text(text: str) -> str:
        lines = [UrlResourceIngestionService._clean_whitespace(line) for line in text.splitlines()]
        meaningful = [line for line in lines if line]
        return "\n".join(meaningful)

    @staticmethod
    def _clean_whitespace(value: str) -> str:
        return re.sub(r"\s+", " ", (value or "")).strip()

    @staticmethod
    def _format_content(
        *,
        title: str,
        requested_url: str,
        resolved_url: str,
        description: Optional[str],
        body: str,
    ) -> str:
        parts = [
            f"# {title}",
            f"Requested URL: {requested_url}",
            f"Resolved URL: {resolved_url}",
        ]
        if description:
            parts.append(f"Description: {description}")
        parts.extend(["", body])
        return "\n".join(parts).strip()
