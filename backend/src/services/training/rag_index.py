"""Idempotent RAG indexing for the owned training library corpus."""

from __future__ import annotations

import asyncio
from dataclasses import dataclass
from datetime import datetime, timezone
from hashlib import sha256
import json
import logging
import os
from pathlib import Path
from threading import Lock
from typing import Any, Awaitable, Callable, Iterable, Protocol

from src.services.integrations.microsoft_graph.embed import embed_graph_document
from src.services.supabase_helpers import SupabaseRagStore

logger = logging.getLogger(__name__)

TRAINING_SOURCE_SYSTEM = "training_library"
TRAINING_GUIDE_TYPE = "training_guide"
TRAINING_RESOURCE_TYPE = "training_resource"
GUIDE_CORPUS_PATH = Path(__file__).with_name("generated_guide_corpus.json")
DEFAULT_RECONCILE_INTERVAL_SECONDS = 300
MIN_RECONCILE_INTERVAL_SECONDS = 60
_TRAINING_RECONCILE_LOCK = Lock()
_TRAINING_RECONCILE_STATE_LOCK = Lock()
_TRAINING_RECONCILE_STATE: dict[str, Any] = {
    "lastAttemptAt": None,
    "lastSuccessAt": None,
    "lastFailureAt": None,
    "lastStage": "not-started",
    "lastErrorType": None,
    "lastErrorCode": None,
    "lastErrorStatus": None,
    "lastErrorFingerprint": None,
    "lastResult": None,
}


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _update_reconciliation_state(**updates: Any) -> None:
    with _TRAINING_RECONCILE_STATE_LOCK:
        _TRAINING_RECONCILE_STATE.update(updates)


def _set_reconciliation_stage(stage: str) -> None:
    _update_reconciliation_state(lastStage=stage)


def training_rag_reconciliation_state() -> dict[str, Any]:
    """Return a secret-free snapshot of the most recent reconciliation attempt."""

    with _TRAINING_RECONCILE_STATE_LOCK:
        snapshot = dict(_TRAINING_RECONCILE_STATE)
    if isinstance(snapshot.get("lastResult"), dict):
        snapshot["lastResult"] = dict(snapshot["lastResult"])
    return snapshot


class TrainingIndexStore(Protocol):
    @property
    def app_client(self) -> Any: ...
    def upsert_document_metadata(self, metadata: dict[str, Any]) -> dict[str, Any]: ...
    def fetch_rag_document_metadata(self, document_id: str) -> dict[str, Any] | None: ...
    def has_embedded_chunks_for_document(self, document_id: str | None) -> bool: ...
    def invalidate_document_content(
        self,
        document_id: str,
        *,
        parsing_status: str,
        embedding_status: str,
        reason: str,
    ) -> bool: ...
    def list_document_ids_by_source_system(self, source_system: str) -> list[str]: ...
    def delete_document_and_chunks(self, document_id: str) -> None: ...


@dataclass(frozen=True)
class TrainingDocument:
    id: str
    title: str
    content: str
    source_type: str
    source_url: str
    source_item_id: str
    description: str | None
    source_metadata: dict[str, Any]

    @property
    def content_hash(self) -> str:
        return sha256(self.content.encode("utf-8")).hexdigest()

    def as_metadata(self) -> dict[str, Any]:
        now = datetime.now(timezone.utc).isoformat()
        return {
            "id": self.id,
            "app_document_id": self.id,
            "title": self.title,
            "description": self.description,
            "content": self.content,
            "raw_text": self.content,
            "content_hash": self.content_hash,
            "type": self.source_type,
            "category": self.source_type,
            "source": "Alleato Training Library",
            "source_system": TRAINING_SOURCE_SYSTEM,
            "source_item_id": self.source_item_id,
            "source_web_url": self.source_url,
            "url": self.source_url,
            "status": "ready",
            "parsing_status": "parsed",
            "embedding_status": "pending",
            "source_metadata": self.source_metadata,
            "last_synced_at": now,
            "updated_at": now,
        }


def load_guide_documents(path: Path = GUIDE_CORPUS_PATH) -> list[TrainingDocument]:
    try:
        corpus = json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:
        raise RuntimeError(f"Training guide corpus could not be loaded from {path}: {exc}") from exc
    if corpus.get("schemaVersion") != 1 or not isinstance(corpus.get("guides"), list):
        raise RuntimeError(f"Training guide corpus at {path} has an unsupported schema")

    documents: list[TrainingDocument] = []
    for guide in corpus["guides"]:
        slug = str(guide.get("slug") or "").strip()
        title = str(guide.get("title") or "").strip()
        content = str(guide.get("content") or "").strip()
        if not slug or not title or not content:
            raise RuntimeError(f"Training guide corpus contains an incomplete guide: {guide!r}")
        documents.append(
            TrainingDocument(
                id=f"training_guide_{slug}",
                title=title,
                content=content,
                source_type=TRAINING_GUIDE_TYPE,
                source_url=f"/training/guides/{slug}",
                source_item_id=slug,
                description=str(guide.get("description") or "").strip() or None,
                source_metadata={
                    "corpus": "owned_guide",
                    "guide_slug": slug,
                    "role_ids": guide.get("roleIds") or [],
                    "source_path": guide.get("sourcePath"),
                    "source_hash": guide.get("sourceHash"),
                },
            )
        )
    return documents


def load_published_resource_documents(client: Any) -> list[TrainingDocument]:
    response = (
        client.table("training_resource")
        .select(
            "id,topic_id,title,description,url,provider,resource_type,level,track,"
            "status,duration_minutes,updated_at"
        )
        .eq("status", "published")
        .execute()
    )
    rows = response.data or []
    topic_ids = sorted({str(row.get("topic_id")) for row in rows if row.get("topic_id")})
    topics: dict[str, dict[str, Any]] = {}
    if topic_ids:
        topic_response = (
            client.table("training_topic")
            .select("id,slug,name")
            .in_("id", topic_ids)
            .execute()
        )
        topics = {str(row["id"]): row for row in (topic_response.data or [])}

    documents: list[TrainingDocument] = []
    for row in rows:
        resource_id = str(row.get("id") or "").strip()
        title = str(row.get("title") or "").strip()
        source_url = str(row.get("url") or "").strip()
        if not resource_id or not title or not source_url:
            raise RuntimeError(
                f"Published training resource is missing id, title, or URL: {resource_id or '<unknown>'}"
            )
        topic = topics.get(str(row.get("topic_id"))) or {}
        description = str(row.get("description") or "").strip()
        content = "\n".join(
            part
            for part in (
                f"# {title}",
                description,
                f"Topic: {topic.get('name')}" if topic.get("name") else None,
                f"Track: {row.get('track')}" if row.get("track") else None,
                f"Level: {row.get('level')}" if row.get("level") else None,
                f"Format: {row.get('resource_type')}" if row.get("resource_type") else None,
                f"Provider: {row.get('provider')}" if row.get("provider") else None,
                f"Duration: {row.get('duration_minutes')} minutes"
                if row.get("duration_minutes")
                else None,
                f"Open resource: {source_url}",
            )
            if part
        )
        documents.append(
            TrainingDocument(
                id=f"training_resource_{resource_id}",
                title=title,
                content=content,
                source_type=TRAINING_RESOURCE_TYPE,
                source_url=source_url,
                source_item_id=resource_id,
                description=description or None,
                source_metadata={
                    "corpus": "published_resource",
                    "resource_id": resource_id,
                    "topic_id": row.get("topic_id"),
                    "topic_slug": topic.get("slug"),
                    "status": "published",
                    "provider": row.get("provider"),
                    "resource_type": row.get("resource_type"),
                    "level": row.get("level"),
                    "track": row.get("track"),
                    "source_updated_at": row.get("updated_at"),
                },
            )
        )
    return documents


def _remove_stale_documents(store: TrainingIndexStore, active_ids: set[str]) -> int:
    stale_ids = [
        document_id
        for document_id in store.list_document_ids_by_source_system(
            TRAINING_SOURCE_SYSTEM
        )
        if document_id not in active_ids
    ]
    for document_id in stale_ids:
        store.delete_document_and_chunks(document_id)
    return len(stale_ids)


def _reconcile_training_rag_index_unlocked(
    *,
    store: TrainingIndexStore | None = None,
    embedder=embed_graph_document,
    documents: Iterable[TrainingDocument] | None = None,
) -> dict[str, int]:
    """Reconcile guides and published resource records into the canonical RAG index."""

    _set_reconciliation_stage("initialize-store")
    owned_store: TrainingIndexStore = store or SupabaseRagStore()
    app_client = owned_store.app_client
    _set_reconciliation_stage("load-desired-documents")
    desired = list(
        documents
        if documents is not None
        else [
            *load_guide_documents(),
            *load_published_resource_documents(app_client),
        ]
    )
    ids = [document.id for document in desired]
    if len(ids) != len(set(ids)):
        raise RuntimeError("Training RAG reconciliation produced duplicate document IDs")

    _set_reconciliation_stage("remove-stale-documents")
    result = {
        "desired": len(desired),
        "indexed": 0,
        "unchanged": 0,
        "removed": _remove_stale_documents(owned_store, set(ids)),
    }
    for document in desired:
        _set_reconciliation_stage(f"inspect-{document.source_type}")
        existing = owned_store.fetch_rag_document_metadata(document.id)
        unchanged = (
            existing is not None
            and existing.get("content_hash") == document.content_hash
            and owned_store.has_embedded_chunks_for_document(document.id)
        )
        if unchanged:
            result["unchanged"] += 1
            continue

        if existing is not None:
            _set_reconciliation_stage(f"invalidate-{document.source_type}")
            owned_store.invalidate_document_content(
                document.id,
                parsing_status="parsed",
                embedding_status="pending",
                reason="training_source_changed",
            )
        _set_reconciliation_stage(f"upsert-{document.source_type}")
        owned_store.upsert_document_metadata(document.as_metadata())
        _set_reconciliation_stage(f"embed-{document.source_type}")
        chunk_count = embedder(app_client, document.id)
        if chunk_count <= 0:
            raise RuntimeError(
                f"Training document {document.id} produced no searchable chunks"
            )
        result["indexed"] += 1

    logger.info("[TrainingRagIndex] reconciliation complete: %s", result)
    return result


def reconcile_training_rag_index(
    *,
    store: TrainingIndexStore | None = None,
    embedder=embed_graph_document,
    documents: Iterable[TrainingDocument] | None = None,
) -> dict[str, int]:
    """Serialize a full reconciliation so startup, periodic, and admin runs cannot race."""

    attempted_at = _now_iso()
    _update_reconciliation_state(
        lastAttemptAt=attempted_at,
        lastStage="starting",
        lastErrorType=None,
        lastErrorCode=None,
        lastErrorStatus=None,
        lastErrorFingerprint=None,
    )
    try:
        with _TRAINING_RECONCILE_LOCK:
            result = _reconcile_training_rag_index_unlocked(
                store=store,
                embedder=embedder,
                documents=documents,
            )
    except Exception as exc:
        _update_reconciliation_state(
            lastFailureAt=_now_iso(),
            lastErrorType=type(exc).__name__,
            lastErrorCode=getattr(exc, "code", None),
            lastErrorStatus=getattr(exc, "status_code", None),
            lastErrorFingerprint=sha256(str(exc).encode("utf-8")).hexdigest()[:12],
            lastResult=None,
        )
        raise

    _update_reconciliation_state(
        lastSuccessAt=_now_iso(),
        lastStage="complete",
        lastErrorType=None,
        lastErrorCode=None,
        lastErrorStatus=None,
        lastErrorFingerprint=None,
        lastResult=result,
    )
    return result


def training_rag_index_health(
    *,
    store: TrainingIndexStore | None = None,
    documents: Iterable[TrainingDocument] | None = None,
) -> dict[str, Any]:
    """Return count-only health for the desired and searchable training corpus."""

    owned_store: TrainingIndexStore = store or SupabaseRagStore()
    desired = list(
        documents
        if documents is not None
        else [
            *load_guide_documents(),
            *load_published_resource_documents(owned_store.app_client),
        ]
    )
    desired_ids = {document.id for document in desired}
    if len(desired_ids) != len(desired):
        raise RuntimeError("Training RAG health check found duplicate desired document IDs")

    catalogued_ids = set(
        owned_store.list_document_ids_by_source_system(TRAINING_SOURCE_SYSTEM)
    )
    current_ids = desired_ids & catalogued_ids
    searchable_ids = {
        document_id
        for document_id in current_ids
        if owned_store.has_embedded_chunks_for_document(document_id)
    }
    missing = desired_ids - catalogued_ids
    stale = catalogued_ids - desired_ids
    unsearchable = current_ids - searchable_ids
    reconciliation = training_rag_reconciliation_state()
    healthy = (
        not missing
        and not stale
        and not unsearchable
        and reconciliation["lastErrorType"] is None
    )
    return {
        "status": "healthy" if healthy else "degraded",
        "desired": len(desired_ids),
        "catalogued": len(catalogued_ids),
        "indexed": len(current_ids),
        "searchable": len(searchable_ids),
        "missing": len(missing),
        "stale": len(stale),
        "unsearchable": len(unsearchable),
        "reconciliation": reconciliation,
    }


def training_rag_reconcile_interval_seconds() -> int:
    raw_interval = os.getenv(
        "TRAINING_RAG_RECONCILE_INTERVAL_SECONDS",
        str(DEFAULT_RECONCILE_INTERVAL_SECONDS),
    )
    try:
        interval = int(raw_interval)
    except ValueError as exc:
        raise RuntimeError(
            "TRAINING_RAG_RECONCILE_INTERVAL_SECONDS must be an integer"
        ) from exc
    if interval < MIN_RECONCILE_INTERVAL_SECONDS:
        raise RuntimeError(
            "TRAINING_RAG_RECONCILE_INTERVAL_SECONDS must be at least "
            f"{MIN_RECONCILE_INTERVAL_SECONDS}"
        )
    return interval


async def keep_training_rag_index_current(
    *,
    reconcile: Callable[[], dict[str, int]] | None = None,
    sleep: Callable[[float], Awaitable[None]] = asyncio.sleep,
    interval_seconds: int | None = None,
) -> None:
    """Reconcile at startup and repeatedly so publish/archive changes cannot drift."""

    run_reconciliation = reconcile or reconcile_training_rag_index
    interval = (
        interval_seconds
        if interval_seconds is not None
        else training_rag_reconcile_interval_seconds()
    )
    if interval < MIN_RECONCILE_INTERVAL_SECONDS:
        raise RuntimeError(
            f"Training RAG reconcile interval must be at least {MIN_RECONCILE_INTERVAL_SECONDS}"
        )

    while True:
        try:
            result = await asyncio.to_thread(run_reconciliation)
            logger.info(
                "[TrainingRagIndex] scheduled reconciliation succeeded: %s",
                result,
            )
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception(
                "[TrainingRagIndex] scheduled reconciliation failed; training "
                "search will report unavailable or empty results until a retry succeeds"
            )
        await sleep(interval)
