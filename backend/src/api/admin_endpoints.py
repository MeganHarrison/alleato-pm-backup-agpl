"""
Admin API endpoints for document pipeline management
"""

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Header
from pydantic import BaseModel
from typing import Dict, Any, Optional, List
import logging
from datetime import datetime
from pathlib import Path
import sys
import os

# Add parent directory to path
sys.path.append(str(Path(__file__).parent.parent))

from services.supabase_helpers import SupabaseRagStore
from services.env_loader import load_env
from services.pipeline.workflow_client import enqueue_document_workflow
from src.services.training import (
    TrainingFinderRequest,
    TrainingFinderResponse,
    TrainingResourceFinderError,
    run_training_resource_finder,
)

load_env()

logger = logging.getLogger(__name__)

def require_admin_api_key(
    authorization: Optional[str] = Header(default=None),
    x_admin_api_key: Optional[str] = Header(default=None),
) -> None:
    """Simple admin API key guard for operational endpoints."""
    expected = os.getenv("ADMIN_API_KEY")
    if not expected:
        raise HTTPException(
            status_code=503,
            detail="ADMIN_API_KEY is not configured on the backend",
        )

    bearer_token = ""
    if authorization and authorization.lower().startswith("bearer "):
        bearer_token = authorization.split(" ", 1)[1].strip()

    supplied = x_admin_api_key or bearer_token
    if supplied != expected:
        raise HTTPException(status_code=401, detail="Unauthorized")


router = APIRouter(
    prefix="/api/admin",
    tags=["Admin"],
    dependencies=[Depends(require_admin_api_key)],
)

class EmbeddingGenerationRequest(BaseModel):
    stage: str = "raw_ingested"
    limit: Optional[int] = 10
    skip_extraction: bool = False
    skip_embedding: bool = False

class EmbeddingGenerationResponse(BaseModel):
    status: str
    message: str
    task_id: Optional[str] = None
    details: Optional[Dict[str, Any]] = None


class ReplayStaleRawIngestedRequest(BaseModel):
    stale_minutes: int = 120
    limit: int = 25
    dry_run: bool = False
    include_error_jobs: bool = False
    error_contains: Optional[str] = None


def get_rag_store() -> SupabaseRagStore:
    return SupabaseRagStore()


@router.post(
    "/training/resources/find",
    response_model=TrainingFinderResponse,
)
def trigger_training_resource_finder_admin(
    request: TrainingFinderRequest,
    x_request_id: Optional[str] = Header(default=None, alias="X-Request-Id"),
) -> TrainingFinderResponse:
    """Create up to three review candidates through the canonical finder."""
    request_id = (x_request_id or "unavailable")[:120]
    bounded_request = TrainingFinderRequest(
        roleSlug=request.role_slug,
        topicSlug=request.topic_slug,
        maxSearchResults=8,
        maxInserts=3,
        dryRun=False,
        triggerSource="admin",
    )
    logger.info(
        "Admin training resource finder started request_id=%s role=%s topic=%s",
        request_id,
        bounded_request.role_slug,
        bounded_request.topic_slug,
    )

    try:
        result = run_training_resource_finder(bounded_request)
        logger.info(
            "Admin training resource finder completed request_id=%s status=%s inserted=%s",
            request_id,
            result.status,
            result.inserted_count,
        )
        return result
    except TrainingResourceFinderError as exc:
        logger.error(
            "Admin training resource finder failed request_id=%s role=%s topic=%s: %s",
            request_id,
            bounded_request.role_slug,
            bounded_request.topic_slug,
            exc,
        )
        raise HTTPException(status_code=502, detail=str(exc)) from exc


# Store for tracking background tasks
_background_tasks = {}


def _find_stale_raw_ingested_jobs(
    supabase,
    stale_minutes: int,
    limit: int,
    include_error_jobs: bool = False,
    error_contains: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """Fetch stale raw_ingested jobs, optionally including retryable error jobs."""
    # Supabase/PostgREST expects ISO timestamp for lte filtering.
    from datetime import timedelta

    cutoff = (datetime.utcnow() - timedelta(minutes=stale_minutes)).isoformat()
    response = (
        supabase.table("fireflies_ingestion_jobs")
        .select("fireflies_id, metadata_id, stage, error_message, created_at, updated_at")
        .in_("stage", ["raw_ingested", "error"] if include_error_jobs else ["raw_ingested"])
        .lte("updated_at", cutoff)
        .order("updated_at", desc=False)
        .limit(limit * 5)
        .execute()
    )
    rows = response.data or []
    retryable: List[Dict[str, Any]] = []
    for row in rows:
        if not row.get("metadata_id"):
            continue
        stage = row.get("stage")
        error_message = row.get("error_message") or ""
        if stage == "raw_ingested" and not error_message:
            retryable.append(row)
        elif include_error_jobs and stage == "error":
            if error_contains and error_contains.lower() not in error_message.lower():
                continue
            retryable.append(row)
        if len(retryable) >= limit:
            break
    return retryable

@router.post("/documents/reprocess-fireflies", response_model=EmbeddingGenerationResponse)
async def trigger_generate_embeddings(
    request: EmbeddingGenerationRequest,
    background_tasks: BackgroundTasks,
    store: SupabaseRagStore = Depends(get_rag_store)
):
    """
    Trigger canonical Fireflies reprocessing for documents in the pipeline.
    """
    try:
        # Generate a task ID
        task_id = f"embed_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        
        # Check if there are documents to process
        supabase = store._rag_client
        result = (
            supabase
            .table('fireflies_ingestion_jobs')
            .select('id', count='exact')
            .eq('stage', request.stage)
            .execute()
        )
        document_count = result.count or 0
        
        if document_count == 0:
            return EmbeddingGenerationResponse(
                status="no_documents",
                message=f"No documents found in stage '{request.stage}'",
                details={"stage": request.stage, "count": 0}
            )
        
        jobs_response = (
            supabase
            .table('fireflies_ingestion_jobs')
            .select('fireflies_id, metadata_id, stage')
            .eq('stage', request.stage)
            .is_("error_message", "null")
            .limit(request.limit or 10)
            .execute()
        )
        jobs = [job for job in (jobs_response.data or []) if job.get("metadata_id")]

        if not jobs:
            return EmbeddingGenerationResponse(
                status="no_documents",
                message=f"No documents with metadata IDs found in stage '{request.stage}'",
                details={"stage": request.stage, "count": 0}
            )

        def run_embedding_pipeline():
            try:
                logger.info(f"Starting embedding generation task {task_id}")

                processed = 0
                failed = 0
                results = []

                for job in jobs:
                    metadata_id = job["metadata_id"]
                    fireflies_id = job.get("fireflies_id")
                    try:
                        result = enqueue_document_workflow(
                            metadata_id,
                            source_type="fireflies",
                        )
                        processed += 1
                        results.append(
                            {
                                "fireflies_id": fireflies_id,
                                "metadata_id": metadata_id,
                                "status": "queued",
                                "final_stage": "workflow_queued",
                                "owner": "vercel_workflow",
                                "run_id": result["runId"],
                            }
                        )
                    except Exception as job_exc:
                        failed += 1
                        logger.error(
                            "Embedding generation task %s failed for metadata_id=%s: %s",
                            task_id,
                            metadata_id,
                            job_exc,
                            exc_info=True,
                        )
                        results.append(
                            {
                                "fireflies_id": fireflies_id,
                                "metadata_id": metadata_id,
                                "status": "failed",
                                "error": str(job_exc),
                            }
                        )

                _background_tasks[task_id] = {
                    "status": "completed" if failed == 0 else "failed",
                    "processed": processed,
                    "failed": failed,
                    "results": results,
                    "completed_at": datetime.now().isoformat()
                }

                logger.info(
                    "Task %s completed with processed=%s failed=%s",
                    task_id,
                    processed,
                    failed,
                )

            except Exception as e:
                logger.error(f"Task {task_id} failed with error: {e}")
                _background_tasks[task_id] = {
                    "status": "error",
                    "error": str(e),
                    "completed_at": datetime.now().isoformat()
                }
        
        # Add to background tasks
        background_tasks.add_task(run_embedding_pipeline)
        
        # Store initial task status
        _background_tasks[task_id] = {
            "status": "running",
            "started_at": datetime.now().isoformat(),
            "parameters": request.dict()
        }
        
        return EmbeddingGenerationResponse(
            status="started",
            message=f"Embedding generation started for {len(jobs)} documents",
            task_id=task_id,
            details={
                "stage": request.stage,
                "document_count": len(jobs),
                "limit": request.limit
            }
        )
        
    except Exception as e:
        logger.error(f"Error triggering embedding generation: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to trigger embedding generation: {str(e)}"
        )

@router.get("/documents/reprocess-status/{task_id}")
async def get_embedding_status(task_id: str):
    """Check the status of an embedding generation task."""
    if task_id not in _background_tasks:
        raise HTTPException(status_code=404, detail="Task not found")
    
    return _background_tasks[task_id]

@router.get("/documents/fireflies-stats")
async def get_pipeline_statistics(
    store: SupabaseRagStore = Depends(get_rag_store)
):
    """Get statistics about documents in different pipeline stages."""
    try:
        supabase = store._rag_client
        
        # Get counts for each stage
        stages = ['raw_ingested', 'segmented', 'embedded', 'done', 'error']
        stats = {}
        
        for stage in stages:
            result = (
                supabase
                .table('fireflies_ingestion_jobs')
                .select('id', count='exact')
                .eq('stage', stage)
                .execute()
            )
            stats[stage] = result.count or 0
        
        # Get recent documents
        recent_docs = supabase.table('fireflies_ingestion_jobs').select('fireflies_id, stage, created_at').order('created_at', desc=True).limit(10).execute()
        
        return {
            "stage_counts": stats,
            "total_documents": sum(stats.values()),
            "recent_documents": recent_docs.data,
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Error getting pipeline statistics: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get pipeline statistics: {str(e)}"
        )


@router.post("/documents/replay-stale-raw-ingested")
async def replay_stale_raw_ingested_jobs(
    request: ReplayStaleRawIngestedRequest,
    store: SupabaseRagStore = Depends(get_rag_store),
):
    """Requeue stale raw_ingested jobs through the durable Vercel Workflow owner."""
    if request.stale_minutes < 1:
        raise HTTPException(status_code=400, detail="stale_minutes must be >= 1")
    if request.limit < 1 or request.limit > 200:
        raise HTTPException(status_code=400, detail="limit must be between 1 and 200")

    try:
        rag_supabase = store._rag_client
        jobs = _find_stale_raw_ingested_jobs(
            supabase=rag_supabase,
            stale_minutes=request.stale_minutes,
            limit=request.limit,
            include_error_jobs=request.include_error_jobs,
            error_contains=request.error_contains,
        )

        if not jobs:
            return {
                "status": "no_jobs",
                "message": "No stale raw_ingested jobs found",
                "stale_minutes": request.stale_minutes,
                "limit": request.limit,
                "owner": "vercel_workflow",
                "matched": 0,
                "queued": 0,
                "failed": 0,
                "dry_run": request.dry_run,
                "include_error_jobs": request.include_error_jobs,
                "error_contains": request.error_contains,
            }

        results: List[Dict[str, Any]] = []
        queued = 0
        failed = 0

        for job in jobs:
            metadata_id = job.get("metadata_id")
            fireflies_id = job.get("fireflies_id")
            if request.dry_run:
                results.append(
                    {
                        "fireflies_id": fireflies_id,
                        "metadata_id": metadata_id,
                        "status": "would_queue",
                    }
                )
                continue

            try:
                workflow = enqueue_document_workflow(
                    str(metadata_id),
                    source_type="fireflies",
                )
                queued += 1
                results.append(
                    {
                        "fireflies_id": fireflies_id,
                        "metadata_id": metadata_id,
                        "status": "queued",
                        "run_id": workflow["runId"],
                    }
                )
            except Exception as call_exc:
                failed += 1
                results.append(
                    {
                        "fireflies_id": fireflies_id,
                        "metadata_id": metadata_id,
                        "status": "failed",
                        "error": str(call_exc),
                    }
                )

        return {
            "status": "ok",
            "message": "Replay attempted for stale raw_ingested jobs",
            "stale_minutes": request.stale_minutes,
            "limit": request.limit,
            "owner": "vercel_workflow",
            "matched": len(jobs),
            "queued": queued if not request.dry_run else 0,
            "failed": failed if not request.dry_run else 0,
            "dry_run": request.dry_run,
            "include_error_jobs": request.include_error_jobs,
            "error_contains": request.error_contains,
            "results": results,
        }

    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Error replaying stale raw_ingested jobs: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to replay stale raw_ingested jobs: {exc}",
        )


class ProjectBackfillRequest(BaseModel):
    since_days: int = 30
    limit: int = 5000
    min_confidence: float = 0.70


@router.post("/documents/project-backfill", dependencies=[Depends(require_admin_api_key)])
async def run_project_backfill(
    request: ProjectBackfillRequest,
    background_tasks: BackgroundTasks,
    store: SupabaseRagStore = Depends(get_rag_store),
):
    """Re-run project attribution for unassigned documents within the given window."""
    from datetime import timedelta, timezone
    from services.ingestion.communication_project_backfill import run_incremental_project_backfill

    since = datetime.now(timezone.utc) - timedelta(days=request.since_days)

    def _run():
        result = run_incremental_project_backfill(
            store._client,
            limit=request.limit,
            min_confidence=request.min_confidence,
            since=since,
        )
        logger.info("[Admin] Project backfill complete: %s", result)

    background_tasks.add_task(_run)
    return {
        "status": "started",
        "since_days": request.since_days,
        "since_iso": since.isoformat(),
        "limit": request.limit,
        "min_confidence": request.min_confidence,
    }


class OneDriveProjectBackfillRequest(BaseModel):
    batch_size: int = 500
    dry_run: bool = False
    use_content_inference: bool = False


@router.post("/documents/onedrive-project-backfill", dependencies=[Depends(require_admin_api_key)])
async def run_onedrive_project_backfill(
    request: OneDriveProjectBackfillRequest,
    background_tasks: BackgroundTasks,
    store: SupabaseRagStore = Depends(get_rag_store),
):
    """Assign project_id to unassigned OneDrive/SharePoint files using folder-name matching.

    Processes files in document_metadata with category=document and project_id IS NULL.
    Primary strategy: match the folder name from source_path against projects.name.
    Optional: fall back to content inference (set use_content_inference=true).
    """
    from services.integrations.microsoft_graph.onedrive_project_assignment_backfill import (
        run_onedrive_project_assignment_backfill,
    )

    def _run():
        result = run_onedrive_project_assignment_backfill(
            store._client,
            batch_size=request.batch_size,
            dry_run=request.dry_run,
            use_content_inference=request.use_content_inference,
        )
        logger.info("[Admin] OneDrive project backfill complete: %s", result)

    if request.dry_run:
        # Run synchronously so caller gets the dry-run report immediately
        from services.integrations.microsoft_graph.onedrive_project_assignment_backfill import (
            run_onedrive_project_assignment_backfill,
        )
        result = run_onedrive_project_assignment_backfill(
            store._client,
            batch_size=request.batch_size,
            dry_run=True,
            use_content_inference=request.use_content_inference,
        )
        return {"status": "dry_run_complete", **result}

    background_tasks.add_task(_run)
    return {
        "status": "started",
        "batch_size": request.batch_size,
        "use_content_inference": request.use_content_inference,
    }


class SourcePathBackfillRequest(BaseModel):
    batch_size: int = 1000
    dry_run: bool = False


@router.post("/documents/backfill-source-paths", dependencies=[Depends(require_admin_api_key)])
async def backfill_source_paths(
    request: SourcePathBackfillRequest,
    store: SupabaseRagStore = Depends(get_rag_store),
):
    """Enrich source_path from source_web_url for all OneDrive/SharePoint documents.

    Many older records have source_path truncated at the root folder because they were
    synced before parentReference path extraction was added.  This endpoint parses the
    full path from source_web_url (which always contains the complete URL) and writes it
    back to source_path so the Files UI shows the correct folder tree.
    """
    from services.integrations.microsoft_graph.onedrive_project_assignment_backfill import (
        _extract_path_from_url,
        _infer_source_system,
    )

    client = store._client
    response = (
        client.from_("document_metadata")
        .select("id, source_path, source_web_url, url, source_system")
        .eq("category", "document")
        .not_.is_("source_web_url", "null")
        .limit(request.batch_size)
        .execute()
    )
    rows = response.data or []

    updated = 0
    skipped = 0
    failed = 0
    errors = []

    for row in rows:
        if not _infer_source_system(row):
            continue

        url = row.get("source_web_url") or row.get("url") or ""
        url_path = _extract_path_from_url(url) if url else None
        if not url_path:
            skipped += 1
            continue

        stored_path = row.get("source_path") or ""
        stored_depth = len([p for p in stored_path.split("/") if p])
        url_depth = len([p for p in url_path.split("/") if p])

        if url_depth <= stored_depth:
            skipped += 1
            continue

        if not request.dry_run:
            try:
                client.from_("document_metadata").update(
                    {"source_path": url_path}
                ).eq("id", row["id"]).execute()
                updated += 1
            except Exception as exc:
                failed += 1
                errors.append({"id": row["id"], "error": str(exc)})
        else:
            updated += 1  # dry-run count

    return {
        "scanned": len(rows),
        "updated": updated,
        "skipped": skipped,
        "failed": failed,
        "dry_run": request.dry_run,
        "errors": errors[:20],
    }


class OcrBackfillRequest(BaseModel):
    batch_size: int = 2
    page_cap: Optional[int] = None


@router.post("/documents/ocr-backfill", dependencies=[Depends(require_admin_api_key)])
async def run_ocr_backfill(
    request: OcrBackfillRequest,
    store: SupabaseRagStore = Depends(get_rag_store),
):
    """Run an OCR pass over documents with status='no_text'.

    Uses the backend's bounded-memory local Poppler/Tesseract pipeline so the
    complete document is read without depending on an external OCR provider.
    - batch_size: max documents to process per call (default 2)
    - page_cap: optional emergency page ceiling; omitted means every page

    Documents that hit an explicitly supplied page cap are marked ocr_partial.
    They remain searchable but visibly incomplete so a capped run cannot be
    mistaken for full materialization.

    After this completes, call /sync/embed to embed the newly-OCR'd documents,
    or wait for the next 30-minute sync cron which runs OCR + embed automatically.
    """
    from services.integrations.microsoft_graph.ocr_worker import run_ocr_pass

    result = run_ocr_pass(
        store._client,
        limit=request.batch_size,
        page_cap=request.page_cap,
    )
    return result
