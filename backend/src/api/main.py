"""
═══════════════════════════════════════════════════════════════════════════
RAG API SERVER - Main FastAPI Application
═══════════════════════════════════════════════════════════════════════════

ROLE: Primary HTTP server for backend project APIs and ingestion endpoints

CONTROLS:
- CORS configuration for frontend access
- Server initialization and middleware setup

DEPENDENCIES:
- src.services.pipeline ingestion pipeline

USED BY: Frontend at http://localhost:8051

═══════════════════════════════════════════════════════════════════════════
"""
from __future__ import annotations

import asyncio
import logging
import os
import re
import threading
import time
import base64
import hashlib
import hmac
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

# Load environment variables from root .env file
from src.services.env_loader import load_env
load_env()

from src.services.sentry_monitoring import init_sentry
from src.services.posthog_monitoring import init_posthog

init_sentry()
init_posthog()

from fastapi import BackgroundTasks, Depends, FastAPI, File, HTTPException, Query, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, PlainTextResponse
from pydantic import BaseModel
try:
    from openai import OpenAI
except ImportError:
    OpenAI = None

from src.services.supabase_helpers import SupabaseRagStore
from src.services.ingestion.fireflies_pipeline import FirefliesIngestionPipeline
from src.services.pipeline.stage_runner import run_pipeline_stage
from src.services.pipeline.workflow_client import enqueue_document_workflow
from src.services.pipeline.config import MODEL_MICROSOFT_EXECUTIVE_ASSISTANT
from src.services.url_resource_ingestion import UrlIngestionError, UrlResourceIngestionService
from src.api.admin_endpoints import require_admin_api_key
from src.services.agents.content_builder import ContentBuilderRequest, run_content_builder_agent
from src.services.agents.docs_research_agent import DocsResearchRequest, run_docs_research_agent
from src.services.agents.llm_wiki import WikiRequest, list_llm_wiki_archive, run_llm_wiki_agent
from src.services.agents.microsoft_executive_assistant import (
    MicrosoftExecutiveAssistantRequest,
    run_microsoft_executive_assistant,
)
from src.services.agents.research_agent import ResearchRequest, run_research_agent
from src.services.agents.app_expert import AppExpertRequest, run_app_expert_agent
from src.services.mcp.alleato_system import (
    alleato_system_mcp_enabled,
    alleato_system_mcp_status,
    create_alleato_system_mcp_app,
    create_alleato_system_mcp_lifespan,
)
from src.services.microsoft_project_parser import (
    MicrosoftProjectParseError,
    parse_microsoft_project_file,
)
from src.services.integrations.microsoft_graph.ingestion_control import (
    graph_ingestion_disabled_reason,
)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

_openai_client = OpenAI() if (OpenAI and os.getenv("OPENAI_API_KEY")) else None


def _public_backend_error(prefix: str, exc: Exception) -> str:
    message = str(exc)
    lowered = message.lower()
    if "error code 522" in lowered or "code': 522" in lowered:
        return f"{prefix}: Supabase timed out (Cloudflare 522 Connection timed out)."
    if "cloudflare" in lowered or "error code 521" in lowered or "code': 521" in lowered:
        return f"{prefix}: Supabase is unavailable (Cloudflare 521 Web server is down)."
    compact = re.sub(r"<[^>]+>", " ", message)
    compact = re.sub(r"\s+", " ", compact).strip()
    return f"{prefix}: {compact[:500]}"


def _graph_ingestion_blocked_reason(mode: str = "manual") -> Optional[str]:
    """Return a public reason when Graph write-heavy API work must fail closed."""
    return graph_ingestion_disabled_reason(mode=mode)


def _require_graph_ingestion_enabled() -> None:
    reason = _graph_ingestion_blocked_reason()
    if reason:
        raise HTTPException(status_code=503, detail=reason)


app = FastAPI(
    title="Alleato Procore Backend API",
    description="Backend API for RAG-based chat functionality and agent workflows",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json"
)


def _configured_cors_origins() -> List[str]:
    defaults = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8080",
        "http://127.0.0.1:8080",
        "http://localhost:3001",
        "http://127.0.0.1:3001",
        "https://projects.alleatogroup.com",
    ]
    configured = os.getenv("FRONTEND_CORS_ORIGINS", "")
    extra = [
        origin.strip().rstrip("/")
        for origin in configured.split(",")
        if origin.strip()
    ]
    return sorted(set(defaults + extra))


# CORS configuration (adjust as needed for deployment)
app.add_middleware(
    CORSMiddleware,
    allow_origins=_configured_cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*", "sentry-trace", "baggage"],
)

if alleato_system_mcp_enabled():
    app.mount("/mcp", create_alleato_system_mcp_app())


class ChatRequest(BaseModel):
    message: str
    project_id: Optional[int] = None
    limit: int = 5


class FirefliesRecentSyncRequest(BaseModel):
    limit: int = 5
    project_id: Optional[int] = None
    dry_run: bool = False
    write_markdown_dir: Optional[str] = None


class UrlResourceIngestRequest(BaseModel):
    urls: List[str]
    project_id: Optional[int] = None
    dry_run: bool = False
    run_pipeline: bool = True


class GraphSyncRequest(BaseModel):
    run_outlook: bool = True
    run_teams: bool = True
    run_onedrive: bool = True
    run_embedding: bool = True
    embed_limit: int = 25
    outlook_users: Optional[List[str]] = None
    verify_outlook_persisted_count: bool = True


class GraphSubscriptionReconcileRequest(BaseModel):
    renew_within_hours: int = 6
    expiration_hours: int = 48


class OutlookMailboxSyncRequest(BaseModel):
    user_email: str
    verify_persisted_count: bool = False


class OutlookLiveInboxRequest(BaseModel):
    mailbox_user_id: str
    since_iso: Optional[str] = None
    limit: int = 50


class OutlookMailboxSubscriptionRequest(BaseModel):
    user_email: str
    renew_within_hours: int = 6
    expiration_hours: int = 48


class OutlookIntakeReclassificationRequest(BaseModel):
    mailbox: Optional[str] = None
    intake_ids: Optional[List[int]] = None
    days_back: int = 0
    time_zone: str = "America/New_York"
    limit: int = 500
    page_size: int = 100
    apply: bool = False


class OutlookFilterRuleReplayRequest(BaseModel):
    rule_id: str
    mailbox: Optional[str] = None
    since: Optional[str] = None
    limit: int = 500


class MicrosoftProjectConvertResponse(BaseModel):
    tasks: List[Dict[str, Any]]
    source_format: str
    task_count: int


class MicrosoftProjectConvertTokenResponse(BaseModel):
    convert_url: str
    expires_in_seconds: int


class SchedulePdfExtractResponse(BaseModel):
    text: str
    page_count: int
    character_count: int


def _base64url(value: bytes | str) -> str:
    source = value.encode("utf-8") if isinstance(value, str) else value
    return base64.urlsafe_b64encode(source).decode("ascii").rstrip("=")


def _sign_schedule_convert_token(project_id: int, expires_in_seconds: int = 300) -> str:
    expected_secret = os.getenv("ADMIN_API_KEY")
    if not expected_secret:
        raise HTTPException(status_code=503, detail="ADMIN_API_KEY is not configured on the backend")

    payload = _base64url(json.dumps({
        "project_id": project_id,
        "exp": int(datetime.now(timezone.utc).timestamp()) + expires_in_seconds,
    }, separators=(",", ":")))
    signature = hmac.new(
        expected_secret.encode("utf-8"),
        payload.encode("ascii"),
        hashlib.sha256,
    ).digest()

    return f"{payload}.{_base64url(signature)}"


def _base64url_decode_json(value: str) -> Dict[str, Any]:
    padding = "=" * (-len(value) % 4)
    try:
        decoded = base64.urlsafe_b64decode(f"{value}{padding}".encode("ascii"))
        payload = json.loads(decoded.decode("utf-8"))
    except (ValueError, json.JSONDecodeError) as exc:
        raise HTTPException(status_code=401, detail="Invalid schedule conversion token.") from exc

    if not isinstance(payload, dict):
        raise HTTPException(status_code=401, detail="Invalid schedule conversion token.")

    return payload


def _verify_schedule_convert_token(token: Optional[str], project_id: int) -> None:
    expected_secret = os.getenv("ADMIN_API_KEY")
    if not expected_secret:
        raise HTTPException(status_code=503, detail="ADMIN_API_KEY is not configured on the backend")
    if not token:
        raise HTTPException(status_code=401, detail="Missing schedule conversion token.")

    parts = token.split(".")
    if len(parts) != 2:
        raise HTTPException(status_code=401, detail="Invalid schedule conversion token.")

    encoded_payload, supplied_signature = parts
    expected_signature = hmac.new(
        expected_secret.encode("utf-8"),
        encoded_payload.encode("ascii"),
        hashlib.sha256,
    ).digest()
    expected_signature_text = base64.urlsafe_b64encode(expected_signature).decode("ascii").rstrip("=")

    if not hmac.compare_digest(supplied_signature, expected_signature_text):
        raise HTTPException(status_code=401, detail="Invalid schedule conversion token.")

    payload = _base64url_decode_json(encoded_payload)
    if payload.get("project_id") != project_id:
        raise HTTPException(status_code=401, detail="Schedule conversion token does not match this project.")

    expires_at = payload.get("exp")
    if not isinstance(expires_at, int):
        raise HTTPException(status_code=401, detail="Invalid schedule conversion token.")
    if expires_at < int(datetime.now(timezone.utc).timestamp()):
        raise HTTPException(status_code=401, detail="Schedule conversion token expired.")


def get_rag_store() -> SupabaseRagStore:
    return SupabaseRagStore()


def get_ingestion_pipeline(
    store: SupabaseRagStore = Depends(get_rag_store),
) -> FirefliesIngestionPipeline:
    return FirefliesIngestionPipeline(store)


def get_url_resource_ingestion_service() -> UrlResourceIngestionService:
    return UrlResourceIngestionService()


@app.get("/health", tags=["System"], summary="Health check")
async def health_check() -> Dict[str, Any]:
    """Health check endpoint that verifies backend status and AI configuration.
    
    Returns:
        Dict containing health status and AI provider configuration status.
    """
    from src.services.ai_transport import (
        ai_gateway_configured,
        ai_gateway_required,
        embedding_provider_configured,
        get_ai_provider_path,
        openai_configured,
    )

    supabase_service_configured = bool(os.getenv("SUPABASE_SERVICE_ROLE_KEY"))

    try:
        from src.services.agents.llm_wiki.agent import storage_durability_status

        deep_agent_storage = storage_durability_status()
    except Exception:  # pragma: no cover - never let a probe break /health
        deep_agent_storage = {"durable": None, "roots": {}}

    # App-DB connectivity + DATABASE_URL host-parity. Surfaced here (always HTTP
    # 200 — this is Render's liveness healthCheckPath, so a down app DB must NOT
    # flap the web container) so a human/monitor sees the degradation. The 503
    # readiness signal lives on the separate /health/ready endpoint.
    app_db: Dict[str, Any] = {"reachable": None}
    database_url_host: Dict[str, Any] = {}
    try:
        from src.services.agents.alleato_ai_tools.db_health import (
            database_url_host_status,
            probe_app_db,
        )

        # probe_app_db() is a blocking psycopg2 call whose own connect_timeout
        # (default 5s) does not bound query execution once connected — run it
        # off the event loop with a hard outer timeout well inside Render's 5s
        # HTTP health-check budget, so a slow/hanging DB can never make this
        # response itself time out (that's the exact failure this endpoint is
        # supposed to survive; see the module docstring on probe_app_db).
        try:
            probe = await asyncio.wait_for(asyncio.to_thread(probe_app_db), timeout=3.0)
            app_db = probe.as_dict()
        except asyncio.TimeoutError:
            app_db = {
                "reachable": False,
                "latency_ms": None,
                "error": "probe_app_db timed out after 3.0s",
                "is_connectivity": True,
            }
        database_url_host = database_url_host_status().as_dict()
    except Exception as exc:  # pragma: no cover - never let a probe break /health
        app_db = {"reachable": None, "error": str(exc)[:200]}

    degraded = app_db.get("reachable") is False or database_url_host.get("ok") is False

    return {
        "status": "degraded" if degraded else "healthy",
        "ai_provider_path": get_ai_provider_path(),
        "ai_gateway_configured": ai_gateway_configured(),
        "ai_gateway_required": ai_gateway_required(),
        "openai_configured": openai_configured(),
        "embedding_provider_configured": embedding_provider_configured(),
        "supabase_service_configured": supabase_service_configured,
        "app_db": app_db,
        "database_url_host": database_url_host,
        "deep_agent_storage": deep_agent_storage,
        "timestamp": datetime.now().isoformat()
    }


@app.get("/health/ready", tags=["System"], summary="Readiness check (app DB reachable)")
async def readiness_check() -> JSONResponse:
    """Readiness probe: 200 only when the app database is reachable, else 503.

    Deliberately NOT wired to Render's `healthCheckPath` (that points at
    `/health`, which stays 200 on a DB outage so the web container is not
    restarted for an infra/config problem it cannot fix). Monitors and alerting
    hit this endpoint to detect the "database unreachable" degraded state.
    """
    from src.services.agents.alleato_ai_tools.db_health import (
        database_url_host_status,
        probe_app_db,
    )

    probe = probe_app_db()
    parity = database_url_host_status()
    ready = probe.reachable and parity.ok
    payload = {
        "ready": ready,
        "app_db": probe.as_dict(),
        "database_url_host": parity.as_dict(),
        "timestamp": datetime.now().isoformat(),
    }
    return JSONResponse(status_code=200 if ready else 503, content=payload)


@app.get(
    "/health/training-library",
    tags=["System"],
    summary="Training library RAG health",
)
async def training_library_health() -> JSONResponse:
    """Expose count-only index health without exposing source content or credentials."""
    from src.services.training.rag_index import training_rag_index_health

    try:
        result = await asyncio.to_thread(training_rag_index_health)
    except Exception:
        logger.exception("[TrainingRagIndex] health readback failed")
        return JSONResponse(
            status_code=503,
            content={
                "status": "unavailable",
                "detail": (
                    "Training library index health could not be read. "
                    "Check TrainingRagIndex logs and RAG database configuration."
                ),
                "timestamp": datetime.now().isoformat(),
            },
        )

    return JSONResponse(
        status_code=200 if result["status"] == "healthy" else 503,
        content={**result, "timestamp": datetime.now().isoformat()},
    )


@app.get("/api/mcp/status", tags=["System"], summary="Hosted MCP status")
async def hosted_mcp_status() -> Dict[str, Any]:
    return alleato_system_mcp_status()


def _select_keyword(message: str) -> Optional[str]:
    words = re.findall(r"[A-Za-z]+", message.lower())
    stop_words = {
        "tell",
        "about",
        "what",
        "when",
        "where",
        "which",
        "there",
        "their",
        "would",
        "could",
        "should",
        "project",
        "status",
        "concerns",
        "issues",
        "any",
        "with",
        "from",
        "that",
        "this",
        "have",
        "been",
        "were",
        "please",
    }
    candidates = [w for w in words if len(w) >= 4 and w not in stop_words]
    if candidates:
        # Favor the longest candidate (often project/client names).
        return sorted(candidates, key=len, reverse=True)[0]
    return None


def _get_query_embedding(message: str) -> Optional[List[float]]:
    if _openai_client is None:
        return None
    try:
        response = _openai_client.embeddings.create(
            model="text-embedding-3-large",
            input=[message],
            dimensions=3072,
        )
        return response.data[0].embedding
    except Exception:
        return None


def _is_financial_query(message: str) -> bool:
    text = (message or "").lower()
    financial_terms = (
        "budget",
        "estimate",
        "invoice",
        "cost",
        "profit",
        "loss",
        "balance sheet",
        "p&l",
        "variance",
        "revenue",
        "expense",
        "change order value",
        "schedule of values",
        "sov",
        "q1",
        "q2",
        "q3",
        "q4",
    )
    return any(term in text for term in financial_terms)


def _row_data_preview(row_data: Dict[str, Any], max_items: int = 8) -> str:
    parts: List[str] = []
    columns = row_data.get("columns") if isinstance(row_data, dict) else None
    if not isinstance(columns, dict):
        return ""
    for key, value in columns.items():
        if value in (None, ""):
            continue
        parts.append(f"{key}={value}")
        if len(parts) >= max_items:
            break
    return "; ".join(parts)


def _build_chat_reply(
    message: str,
    store: SupabaseRagStore,
    project_id: Optional[int],
    limit: int = 5,
) -> Dict[str, Any]:
    keyword = _select_keyword(message)
    retrieval_mode = "keyword"
    chunks: List[Dict[str, Any]] = []
    financial_rows: List[Dict[str, Any]] = []

    if _is_financial_query(message):
        financial_rows = store.search_financial_rows(
            query=message,
            project_id=project_id,
            limit=limit,
        )
        if financial_rows:
            retrieval_mode = "financial_structured"

    if not financial_rows:
        query_embedding = _get_query_embedding(message)
        if query_embedding:
            chunks = store.vector_search_documents(
                query_embedding=query_embedding,
                limit=limit,
                project_id=project_id,
            )
            if chunks:
                retrieval_mode = "semantic"

        if not chunks:
            chunks = store.search_chunks_by_keyword(keyword, project_id=project_id, limit=limit)
        if not chunks:
            chunks = store.fetch_recent_chunks(project_id=project_id, limit=limit)
            retrieval_mode = "recent"

    tasks = store.list_tasks(project_id=project_id, status="open", limit=limit)
    project = store.get_project(project_id) if project_id is not None else None

    sources: List[Dict[str, Any]] = []
    if financial_rows:
        for row in financial_rows:
            doc = row.get("document") or {}
            preview = _row_data_preview(row.get("row_data") or {})
            sources.append(
                {
                    "document_id": row.get("dataset_id"),
                    "chunk_index": None,
                    "snippet": preview[:280],
                    "metadata": {
                        "retrieval_mode": "financial_structured",
                        "title": doc.get("title"),
                        "project_id": doc.get("project_id"),
                        "category": doc.get("category"),
                        "match_score": row.get("match_score"),
                    },
                    "row_data": row.get("row_data"),
                }
            )
    else:
        sources = [
            {
                "document_id": chunk.get("document_id"),
                "chunk_index": chunk.get("chunk_index") or (chunk.get("metadata") or {}).get("chunk_index"),
                "snippet": (chunk.get("text") or "")[:280],
                "metadata": chunk.get("metadata") or {},
            }
            for chunk in chunks
        ]

    reply_lines: List[str] = []
    if project:
        reply_lines.append(
            f"Project {project.get('name', project_id)} has {project.get('meeting_count', 0)} documented meetings and {project.get('open_tasks', 0)} open AI tasks."
        )
    if tasks:
        reply_lines.append(
            "Top open tasks: " + "; ".join(task.get("title", "Task") for task in tasks[:3])
        )
    if sources:
        if retrieval_mode == "financial_structured":
            reply_lines.append(
                f"Retrieved {len(sources)} structured financial rows from normalized tables."
            )
            reply_lines.append("Top matching financial evidence:")
            for source in sources[:3]:
                title = (source.get("metadata") or {}).get("title") or "Financial document"
                snippet = (source.get("snippet") or "").strip()
                reply_lines.append(f"- [{title}] {snippet[:180]}")
        elif retrieval_mode == "semantic":
            reply_lines.append(f"Retrieved {len(sources)} transcript snippets via semantic vector search.")
        elif retrieval_mode == "keyword":
            reply_lines.append(
                f"Retrieved {len(sources)} transcript snippets based on the keyword '{keyword or 'recent'}'."
            )
        else:
            reply_lines.append(f"Retrieved {len(sources)} recent transcript snippets.")
        reply_lines.append("Top relevant transcript evidence:")
        for source in sources[:3]:
            snippet = (source.get("snippet") or "").replace("\n", " ").strip()
            if snippet:
                reply_lines.append(f"- {snippet[:180]}")

        concern_terms = ("risk", "delay", "blocked", "issue", "concern", "over budget", "late")
        concern_hits = sum(
            1
            for source in sources
            if any(term in (source.get("snippet") or "").lower() for term in concern_terms)
        )
        if concern_hits > 0:
            reply_lines.append(
                f"Potential concerns detected in {concern_hits} of the retrieved snippets. Review those items for schedule/cost risk."
            )
        else:
            reply_lines.append(
                "No explicit risk language was detected in the retrieved snippets."
            )
    if not reply_lines:
        reply_lines.append(
            "No relevant transcripts or tasks were found yet. Try ingesting more Fireflies meetings or widening your query."
        )

    return {
        "reply": "\n".join(reply_lines),
        "sources": sources,
        "tasks": tasks,
    }


# === Alleato REST API ===


@app.get("/api/projects", tags=["Projects"], summary="List all projects")
def list_projects_api(store: SupabaseRagStore = Depends(get_rag_store)) -> Dict[str, Any]:
    """Retrieve a list of all projects from the RAG store.
    
    Returns:
        Dict with 'projects' key containing list of project objects.
    """
    return {"projects": store.list_projects()}


@app.get("/api/projects/{project_id}", tags=["Projects"], summary="Get project details")
def project_detail_api(project_id: int, store: SupabaseRagStore = Depends(get_rag_store)) -> Dict[str, Any]:
    """Get detailed information about a specific project including open tasks."""
    project = store.get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    tasks = store.list_tasks(project_id=project_id, status="open", limit=50)
    return {"project": project, "tasks": tasks}


@app.post("/api/chat", tags=["RAG Chat"], summary="Simple chat endpoint")
def rag_chat_api(payload: ChatRequest, store: SupabaseRagStore = Depends(get_rag_store)) -> Dict[str, Any]:
    """Process a chat message and return relevant information from the knowledge base.
    
    Performs keyword-based search against ingested transcript chunks and returns
    matching sources along with related tasks and insights.
    """
    if not payload.message.strip():
        raise HTTPException(status_code=422, detail="Message cannot be empty")
    return _build_chat_reply(payload.message, store=store, project_id=payload.project_id, limit=payload.limit)


@app.post(
    "/api/scheduling/microsoft-project/convert-token",
    tags=["Scheduling"],
    summary="Create a short-lived Microsoft Project conversion upload URL",
    response_model=MicrosoftProjectConvertTokenResponse,
)
def create_microsoft_project_convert_token(
    request: Request,
    project_id: int = Query(..., ge=1),
    _: None = Depends(require_admin_api_key),
) -> Dict[str, Any]:
    token = _sign_schedule_convert_token(project_id)
    # Render sets RENDER_EXTERNAL_URL to the public service URL.
    # request.base_url is unreliable behind proxies (resolves to http://0.0.0.0:PORT).
    render_external = os.getenv("RENDER_EXTERNAL_URL", "").rstrip("/")
    base_url = render_external or str(request.base_url).rstrip("/")
    return {
        "convert_url": f"{base_url}/api/scheduling/microsoft-project/convert?project_id={project_id}&token={token}",
        "expires_in_seconds": 300,
    }


@app.post(
    "/api/scheduling/microsoft-project/convert",
    tags=["Scheduling"],
    summary="Convert Microsoft Project schedule file to importable tasks",
    response_model=MicrosoftProjectConvertResponse,
)
async def convert_microsoft_project_schedule(
    request: Request,
    project_id: int = Query(..., ge=1),
    file: UploadFile = File(...),
    token: Optional[str] = Query(default=None),
) -> Dict[str, Any]:
    if token:
        _verify_schedule_convert_token(token, project_id)
    else:
        require_admin_api_key(
            authorization=request.headers.get("authorization"),
            x_admin_api_key=request.headers.get("x-admin-api-key"),
        )

    file_name = file.filename or "schedule"
    suffix = Path(file_name).suffix.lower()
    if suffix not in {".mpp", ".mpt", ".xml"}:
        raise HTTPException(
            status_code=400,
            detail="Upload a Microsoft Project .mpp, .mpt, or XML file.",
        )

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Uploaded schedule file is empty.")
    if len(content) > 50 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Schedule file is larger than the 50 MB import limit.")

    try:
        tasks = parse_microsoft_project_file(file_name, content)
    except MicrosoftProjectParseError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    return {
        "tasks": tasks,
        "source_format": suffix.lstrip("."),
        "task_count": len(tasks),
    }


@app.post(
    "/api/scheduling/schedule-pdf/extract",
    tags=["Scheduling"],
    summary="Extract readable text from a printed schedule PDF",
    response_model=SchedulePdfExtractResponse,
)
async def extract_schedule_pdf_text(
    project_id: int = Query(..., ge=1),
    file: UploadFile = File(...),
    _: None = Depends(require_admin_api_key),
) -> Dict[str, Any]:
    file_name = file.filename or "schedule.pdf"
    if Path(file_name).suffix.lower() != ".pdf" and file.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="Upload a schedule PDF file.")

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Uploaded PDF is empty.")
    if len(content) > 50 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Schedule PDF is larger than the 50 MB import limit.")
    if content[:5] != b"%PDF-":
        raise HTTPException(status_code=400, detail="Uploaded file is not a readable PDF.")

    try:
        import io
        from pypdf import PdfReader

        reader = PdfReader(io.BytesIO(content))
        pages: List[str] = []
        for index, page in enumerate(reader.pages, start=1):
            text = page.extract_text() or ""
            if text.strip():
                pages.append(f"--- Page {index} ---\n{text.strip()}")
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"Unable to extract text from schedule PDF: {str(exc)[:300]}") from exc

    extracted_text = "\n\n".join(pages).strip()
    if len(extracted_text) < 50:
        raise HTTPException(
            status_code=422,
            detail="This PDF did not contain enough selectable text to import. Upload MPP, XML, Excel, or CSV, or OCR the PDF first.",
        )

    return {
        "text": extracted_text,
        "page_count": len(reader.pages),
        "character_count": len(extracted_text),
    }


@app.post("/api/ingest/fireflies/recent", tags=["Ingestion"], summary="Sync recent Fireflies transcripts")
def ingest_recent_fireflies_endpoint(
    payload: FirefliesRecentSyncRequest,
    pipeline: FirefliesIngestionPipeline = Depends(get_ingestion_pipeline),
    _: None = Depends(require_admin_api_key),
) -> Dict[str, Any]:
    """Fetch recent meetings from Fireflies, generate markdown, and ingest.

    This path is fully native to the backend (no Cloudflare worker dependency).
    """
    return pipeline.sync_recent_transcripts(
        limit=payload.limit,
        project_id=payload.project_id,
        dry_run=payload.dry_run,
        write_markdown_dir=payload.write_markdown_dir,
    )


@app.post("/api/ingest/url-resources", tags=["Ingestion"], summary="Ingest web URLs into the existing RAG pipeline")
def ingest_url_resources_endpoint(
    payload: UrlResourceIngestRequest,
    service: UrlResourceIngestionService = Depends(get_url_resource_ingestion_service),
    _: None = Depends(require_admin_api_key),
) -> JSONResponse:
    try:
        results = service.ingest_urls(
            payload.urls,
            project_id=payload.project_id,
            dry_run=payload.dry_run,
            run_pipeline=payload.run_pipeline,
        )
    except UrlIngestionError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=_public_backend_error("URL resource ingestion failed", exc),
        ) from exc

    failed = [item for item in results if item.get("status") == "failed"]
    return JSONResponse(
        status_code=207 if failed else 200,
        content={
            "results": results,
            "ingested_count": sum(1 for item in results if item.get("status") in {"ingested", "updated"}),
            "skipped_count": sum(1 for item in results if item.get("status") == "skipped_unchanged"),
            "failed_count": len(failed),
            "dry_run": payload.dry_run,
        },
    )


@app.post("/api/graph/embed", tags=["Ingestion"], summary="Embed all pending Microsoft Graph documents (no sync)")
async def graph_embed_endpoint(
    _: None = Depends(require_admin_api_key),
    limit: int = 1000,
) -> Dict[str, Any]:
    """Vectorize pending document_metadata rows (status raw_ingested/segmented/compiled).
    Does not fetch new data from Graph — use /api/graph/sync for that.
    Safe to call frequently. Idempotent."""
    _require_graph_ingestion_enabled()
    from src.services.supabase_helpers import get_supabase_client
    from src.services.integrations.microsoft_graph.embed import embed_pending_graph_documents
    import asyncio
    client = get_supabase_client()
    result = await asyncio.get_event_loop().run_in_executor(
        None, lambda: embed_pending_graph_documents(client, limit=limit)
    )
    return result


@app.post("/api/graph/sync", tags=["Ingestion"], summary="Trigger Microsoft Graph sync (Outlook / Teams / OneDrive)")
async def graph_sync_endpoint(
    payload: Optional[GraphSyncRequest] = None,
    _: None = Depends(require_admin_api_key),
) -> Dict[str, Any]:
    """Manually trigger a Microsoft Graph incremental sync.

    Syncs Outlook emails, Teams channel messages, and OneDrive files for all
    configured users. Uses delta tokens for incremental sync — only new/changed
    items since the last run are fetched.

    Requires GRAPH_SYNC_ENABLED=true and MICROSOFT_CLIENT_ID/SECRET/TENANT_ID
    environment variables to be set.

    Returns:
        Dict with status and counts per source.
    """
    _require_graph_ingestion_enabled()
    from src.services.supabase_helpers import get_supabase_client
    from src.services.integrations.microsoft_graph.sync import run_graph_sync
    from src.services.integrations.microsoft_graph.client import get_graph_client

    graph = get_graph_client()
    if not graph.is_configured():
        raise HTTPException(
            status_code=503,
            detail=(
                "Microsoft Graph credentials not configured. "
                "Set MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET, and MICROSOFT_TENANT_ID."
            ),
        )

    client = get_supabase_client()
    options = payload or GraphSyncRequest()
    embed_limit = max(1, min(int(options.embed_limit or 25), 25))

    def _run():
        return run_graph_sync(
            client,
            run_outlook=options.run_outlook,
            run_teams=options.run_teams,
            run_onedrive=options.run_onedrive,
            run_embedding=options.run_embedding,
            embed_limit=embed_limit,
            outlook_users=options.outlook_users,
            verify_outlook_persisted_count=options.verify_outlook_persisted_count,
        )

    import asyncio
    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(None, _run)
    return result


@app.post(
    "/api/graph/outlook/sync-mailbox",
    tags=["Ingestion"],
    summary="Trigger Microsoft Graph Outlook sync for one mailbox",
)
async def graph_outlook_mailbox_sync_endpoint(
    payload: OutlookMailboxSyncRequest,
    _: None = Depends(require_admin_api_key),
) -> Dict[str, Any]:
    """Manually sync one Outlook mailbox without touching other configured users."""
    _require_graph_ingestion_enabled()
    user_email = payload.user_email.strip().lower()
    if not user_email or "@" not in user_email:
        raise HTTPException(status_code=400, detail="user_email must be a valid mailbox address")

    from src.services.integrations.microsoft_graph.client import get_graph_client
    from src.services.integrations.microsoft_graph.sync import sync_outlook_mailbox_delta
    from src.services.supabase_helpers import get_supabase_client

    graph = get_graph_client()
    if not graph.is_configured():
        raise HTTPException(
            status_code=503,
            detail=(
                "Microsoft Graph credentials not configured. "
                "Set MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET, and MICROSOFT_TENANT_ID."
            ),
        )

    client = get_supabase_client()

    def _run():
        return sync_outlook_mailbox_delta(
            client,
            user_email,
            reason="admin_targeted_mailbox_sync",
            verify_persisted_count=payload.verify_persisted_count,
        )

    import asyncio
    return await asyncio.get_event_loop().run_in_executor(None, _run)


@app.post(
    "/api/graph/outlook/live-inbox",
    tags=["Ingestion"],
    summary="Read one Outlook inbox live through Microsoft Graph",
)
async def graph_outlook_live_inbox_endpoint(
    payload: OutlookLiveInboxRequest,
    _: None = Depends(require_admin_api_key),
) -> Dict[str, Any]:
    """Read live Outlook inbox messages without using synced cache/RAG tables."""
    mailbox = payload.mailbox_user_id.strip().lower()
    if not mailbox or "@" not in mailbox:
        raise HTTPException(status_code=400, detail="mailbox_user_id must be a valid mailbox address")
    if payload.limit < 1 or payload.limit > 100:
        raise HTTPException(status_code=422, detail="limit must be between 1 and 100")

    from src.services.integrations.microsoft_graph.live_mail import list_live_outlook_inbox

    import asyncio
    loop = asyncio.get_event_loop()
    try:
        return await loop.run_in_executor(
            None,
            lambda: list_live_outlook_inbox(
                mailbox_user_id=mailbox,
                since_iso=payload.since_iso,
                limit=payload.limit,
            ),
        )
    except Exception as exc:
        logger.warning("[Graph Outlook] Live inbox read failed for %s: %s", mailbox, exc, exc_info=True)
        raise HTTPException(status_code=502, detail=f"Microsoft Graph live inbox read failed: {exc}") from exc


@app.post(
    "/api/graph/outlook/reclassify-intake",
    tags=["Ingestion"],
    summary="Reclassify stored Outlook intake rows with the current intake classifier",
)
async def graph_outlook_intake_reclassify_endpoint(
    payload: OutlookIntakeReclassificationRequest,
    _: None = Depends(require_admin_api_key),
) -> Dict[str, Any]:
    """Apply current Outlook intake classification rules to already stored rows."""
    _require_graph_ingestion_enabled()
    if payload.days_back < 0:
        raise HTTPException(status_code=422, detail="days_back must be zero or greater")
    if payload.limit < 1 or payload.limit > 5000:
        raise HTTPException(status_code=422, detail="limit must be between 1 and 5000")
    if payload.page_size < 1 or payload.page_size > 500:
        raise HTTPException(status_code=422, detail="page_size must be between 1 and 500")
    intake_ids = payload.intake_ids or None
    if intake_ids and any(value <= 0 for value in intake_ids):
        raise HTTPException(status_code=422, detail="intake_ids must contain positive IDs")

    from src.services.integrations.microsoft_graph.intake_reclassification import (
        run_outlook_intake_reclassification,
    )
    from src.services.supabase_helpers import get_supabase_client

    client = get_supabase_client()

    def _run():
        return run_outlook_intake_reclassification(
            client,
            mailbox=payload.mailbox.strip().lower() if payload.mailbox else None,
            intake_ids=intake_ids,
            days_back=payload.days_back,
            time_zone=payload.time_zone,
            limit=payload.limit,
            page_size=payload.page_size,
            apply=payload.apply,
            applied_by="/api/graph/outlook/reclassify-intake",
        )

    import asyncio
    return await asyncio.get_event_loop().run_in_executor(None, _run)


@app.post(
    "/api/graph/outlook/apply-filter-rule",
    tags=["Ingestion"],
    summary="Apply one learned Outlook filter rule to stored intake rows",
)
async def graph_outlook_apply_filter_rule_endpoint(
    payload: OutlookFilterRuleReplayRequest,
    _: None = Depends(require_admin_api_key),
) -> Dict[str, Any]:
    """Replay one enabled `not_project` rule against bounded Outlook intake rows."""
    _require_graph_ingestion_enabled()
    rule_id = payload.rule_id.strip()
    if not rule_id:
        raise HTTPException(status_code=422, detail="rule_id is required")
    if payload.limit < 1 or payload.limit > 5000:
        raise HTTPException(status_code=422, detail="limit must be between 1 and 5000")

    from src.services.integrations.microsoft_graph.outlook import (
        apply_outlook_filter_rule_to_intake,
    )
    from src.services.supabase_helpers import get_supabase_client

    client = get_supabase_client()

    def _run():
        return apply_outlook_filter_rule_to_intake(
            client,
            rule_id=rule_id,
            mailbox_user_id=payload.mailbox.strip().lower() if payload.mailbox else None,
            since=payload.since,
            limit=payload.limit,
        )

    import asyncio
    return await asyncio.get_event_loop().run_in_executor(None, _run)


@app.post(
    "/api/graph/outlook/subscribe-mailbox",
    tags=["Ingestion"],
    summary="Create or renew Microsoft Graph Outlook subscription for one mailbox",
)
async def graph_outlook_mailbox_subscribe_endpoint(
    payload: OutlookMailboxSubscriptionRequest,
    _: None = Depends(require_admin_api_key),
) -> Dict[str, Any]:
    """Create or renew one Outlook mailbox webhook subscription without touching other users."""
    _require_graph_ingestion_enabled()
    user_email = payload.user_email.strip().lower()
    if not user_email or "@" not in user_email:
        raise HTTPException(status_code=400, detail="user_email must be a valid mailbox address")

    from src.services.integrations.microsoft_graph.client import get_graph_client
    from src.services.integrations.microsoft_graph.subscriptions import (
        GraphSubscriptionTarget,
        ensure_subscriptions,
    )
    from src.services.supabase_helpers import get_supabase_client

    graph = get_graph_client()
    if not graph.is_configured():
        raise HTTPException(
            status_code=503,
            detail=(
                "Microsoft Graph credentials not configured. "
                "Set MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET, and MICROSOFT_TENANT_ID."
            ),
        )

    target = GraphSubscriptionTarget(
        source="outlook_email",
        resource_id=user_email,
        resource_name=f"Outlook: {user_email}",
        resource=f"users/{user_email}/mailFolders('inbox')/messages",
        change_type="created,updated",
        max_expiration_hours=48,
    )
    client = get_supabase_client()
    renew_within_hours = max(1, min(int(payload.renew_within_hours or 6), 24))
    expiration_hours = max(1, min(int(payload.expiration_hours or 48), 48))

    def _run():
        return ensure_subscriptions(
            client,
            targets=[target],
            renew_within_hours=renew_within_hours,
            expiration_hours=expiration_hours,
        )

    import asyncio
    return await asyncio.get_event_loop().run_in_executor(None, _run)


@app.post(
    "/api/graph/webhooks/notifications",
    tags=["Ingestion"],
    summary="Receive Microsoft Graph change notifications",
)
async def graph_webhook_notifications_endpoint(
    request: Request,
    background_tasks: BackgroundTasks,
    validationToken: Optional[str] = Query(default=None),
) -> Any:
    """Accept Microsoft Graph webhook validation and change notifications.

    Graph validation requires a 200 response with the raw validation token as
    text/plain. Real notifications are accepted quickly and recorded into the
    source sync run ledger for follow-on delta work.
    """
    if validationToken is not None:
        return PlainTextResponse(validationToken, status_code=200)
    blocked_reason = _graph_ingestion_blocked_reason(mode="webhook")
    if blocked_reason:
        logger.warning("[GraphWebhook] notification accepted without DB writes: %s", blocked_reason)
        return {"status": "disabled", "recorded": 0, "reason": blocked_reason}

    try:
        payload = await request.json()
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Malformed Graph webhook JSON payload") from exc

    if not isinstance(payload, dict):
        raise HTTPException(status_code=400, detail="Graph webhook payload must be a JSON object")

    try:
        from src.services.integrations.microsoft_graph.webhooks import (
            GraphWebhookAuthError,
            handle_graph_notifications,
            outlook_notification_work_item,
        )
        from src.services.supabase_helpers import get_supabase_client

        client = get_supabase_client()

        def _queue_outlook_event_assistant(notification: Dict[str, Any]) -> bool:
            work_item = outlook_notification_work_item(notification, supabase=client)
            if not work_item:
                return False

            def _run_outlook_event_assistant() -> None:
                try:
                    from src.services.agents.microsoft_executive_assistant.triggers import (
                        run_outlook_event_microsoft_executive_assistant,
                    )

                    result = run_outlook_event_microsoft_executive_assistant(
                        sync_result=work_item,
                    )
                    logger.info(
                        "[GraphWebhook] queued Microsoft executive assistant event mailbox=%s message_id=%s status=%s",
                        work_item.get("mailbox"),
                        work_item.get("message_id"),
                        result.get("status"),
                    )
                except Exception as exc:
                    logger.warning(
                        "[GraphWebhook] Microsoft executive assistant event failed mailbox=%s message_id=%s: %s",
                        work_item.get("mailbox"),
                        work_item.get("message_id"),
                        exc,
                        exc_info=True,
                    )

            background_tasks.add_task(_run_outlook_event_assistant)
            return True

        result = handle_graph_notifications(
            client,
            payload,
            on_realtime_notification=_queue_outlook_event_assistant,
        )
        return result
    except GraphWebhookAuthError as exc:
        logger.warning("[GraphWebhook] rejected notification: %s", exc)
        raise HTTPException(status_code=401, detail=str(exc)) from exc
    except Exception as exc:
        logger.error("[GraphWebhook] notification handling failed: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail=f"Graph webhook handling failed: {exc}") from exc


@app.post(
    "/api/graph/webhooks/lifecycle",
    tags=["Ingestion"],
    summary="Receive Microsoft Graph subscription lifecycle notifications",
)
async def graph_webhook_lifecycle_endpoint(
    request: Request,
    validationToken: Optional[str] = Query(default=None),
) -> Any:
    """Accept Graph lifecycle validation and mark subscription action-required states."""
    if validationToken is not None:
        return PlainTextResponse(validationToken, status_code=200)
    blocked_reason = _graph_ingestion_blocked_reason(mode="webhook")
    if blocked_reason:
        logger.warning("[GraphWebhook] lifecycle notification accepted without DB writes: %s", blocked_reason)
        return {"status": "disabled", "recorded": 0, "reason": blocked_reason}

    try:
        payload = await request.json()
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Malformed Graph lifecycle JSON payload") from exc

    if not isinstance(payload, dict):
        raise HTTPException(status_code=400, detail="Graph lifecycle payload must be a JSON object")

    try:
        from src.services.integrations.microsoft_graph.webhooks import (
            GraphWebhookAuthError,
            handle_graph_lifecycle_notifications,
        )
        from src.services.supabase_helpers import get_supabase_client

        client = get_supabase_client()
        return handle_graph_lifecycle_notifications(client, payload)
    except GraphWebhookAuthError as exc:
        logger.warning("[GraphWebhook] rejected lifecycle notification: %s", exc)
        raise HTTPException(status_code=401, detail=str(exc)) from exc
    except Exception as exc:
        logger.error("[GraphWebhook] lifecycle handling failed: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail=f"Graph lifecycle handling failed: {exc}") from exc


class PipelineStageRequest(BaseModel):
    metadataId: str
    sourceType: Optional[str] = None
    projectHint: Optional[int] = None


@app.post(
    "/api/graph/subscriptions/reconcile",
    tags=["Ingestion"],
    summary="Create or renew Microsoft Graph subscriptions",
)
async def graph_subscriptions_reconcile_endpoint(
    payload: Optional[GraphSubscriptionReconcileRequest] = None,
    _: None = Depends(require_admin_api_key),
) -> Dict[str, Any]:
    """Ensure configured Microsoft Graph subscriptions exist and are fresh."""
    _require_graph_ingestion_enabled()
    try:
        from src.services.integrations.microsoft_graph.subscriptions import ensure_subscriptions
        from src.services.supabase_helpers import get_supabase_client

        options = payload or GraphSubscriptionReconcileRequest()
        client = get_supabase_client()
        return ensure_subscriptions(
            client,
            renew_within_hours=max(1, min(int(options.renew_within_hours or 6), 24)),
            expiration_hours=max(1, min(int(options.expiration_hours or 48), 48)),
        )
    except Exception as exc:
        logger.error("[GraphSubscriptions] reconcile failed: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail=f"Graph subscription reconcile failed: {exc}") from exc


class PipelineProcessRequest(BaseModel):
    metadataId: str


class ProjectSynthesizeRequest(BaseModel):
    project_id: int
    since: Optional[str] = None
    max_docs: int = 40
    max_extractions: Optional[int] = None
    skip_synthesized: bool = True
    dry_run: bool = False


def _env_flag_enabled(name: str, default: str = "false") -> bool:
    return os.getenv(name, default).lower() in ("1", "true", "yes")


@app.post(
    "/api/pipeline/process",
    tags=["Ingestion"],
    summary="Queue the durable RAG workflow for a document",
)
async def pipeline_process_endpoint(
    payload: PipelineProcessRequest,
    _: None = Depends(require_admin_api_key),
) -> Dict[str, Any]:
    """Authenticated compatibility ingress for the durable Vercel Workflow.

    This endpoint never executes or orders processing stages. Bounded callers
    authenticate here and receive the durable Workflow run identifier.
    """
    try:
        from src.services.supabase_helpers import get_rag_read_client

        get_rag_read_client().table("rag_document_metadata").select("id").limit(1).execute()
    except Exception as exc:
        raise HTTPException(
            status_code=503,
            detail=_public_backend_error("RAG pipeline is unavailable", exc),
        ) from exc

    try:
        return enqueue_document_workflow(payload.metadataId)
    except Exception as exc:
        raise HTTPException(
            status_code=503,
            detail=_public_backend_error("RAG workflow enqueue failed", exc),
        ) from exc


@app.post(
    "/api/pipeline/stages/{stage}",
    tags=["Ingestion"],
    summary="Execute one RAG pipeline stage for the durable workflow",
)
async def pipeline_stage_endpoint(
    stage: str,
    payload: PipelineStageRequest,
    _: None = Depends(require_admin_api_key),
) -> Dict[str, Any]:
    if stage not in {"load", "parse", "vision", "embed", "extract"}:
        raise HTTPException(status_code=404, detail=f"Unknown pipeline stage: {stage}")
    try:
        return run_pipeline_stage(
            payload.metadataId,
            stage,
            source_type=payload.sourceType,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=_public_backend_error(
                f"RAG stage {stage} failed for {payload.metadataId}",
                exc,
            ),
        ) from exc


@app.post(
    "/api/ingest/fireflies/process",
    tags=["Ingestion"],
    summary="Reprocess an existing Fireflies document through the canonical Fireflies-native path",
)
async def fireflies_process_existing_endpoint(
    payload: PipelineProcessRequest,
    _: None = Depends(require_admin_api_key),
) -> Dict[str, Any]:
    """Queue Fireflies-native reprocessing for an existing Fireflies meeting row."""
    return enqueue_document_workflow(payload.metadataId, source_type="fireflies")


@app.post(
    "/api/intelligence/project-synthesize",
    tags=["Intelligence"],
    summary="Synthesize project communications intelligence (emails + Teams)",
)
async def project_synthesize(
    request: ProjectSynthesizeRequest,
    _: None = Depends(require_admin_api_key),
) -> Dict[str, Any]:
    """Run deep, evidence-backed intelligence extraction over a project's recent
    emails and Teams conversations (meetings are handled by the meeting extractor)."""
    try:
        from src.services.project_intelligence.projections.project_communications import (
            synthesize_project_intelligence,
        )

        return synthesize_project_intelligence(
            request.project_id,
            since=request.since,
            max_docs=request.max_docs,
            max_extractions=request.max_extractions,
            skip_synthesized=request.skip_synthesized,
            dry_run=request.dry_run,
        )
    except Exception as exc:
        logger.error(
            "[ProjectSynthesizeAPI] run failed project_id=%s: %s",
            request.project_id,
            exc,
            exc_info=True,
        )
        raise HTTPException(
            status_code=500,
            detail=f"Project synthesize failed for project {request.project_id}: {exc}",
        ) from exc


class ProjectIntelligenceRefreshRequest(BaseModel):
    project_id: int
    force_full: bool = False
    dry_run: bool = False
    model: Optional[str] = None


@app.post(
    "/api/intelligence/project-intelligence/refresh",
    tags=["Intelligence"],
    summary="L2 rolling-state synthesis: one coherent intelligence packet for a project",
)
async def refresh_project_intelligence_endpoint(
    request: ProjectIntelligenceRefreshRequest,
    _: None = Depends(require_admin_api_key),
) -> Dict[str, Any]:
    """Read prior synthesized state + raw comms since + hard numbers -> ONE
    synthesis pass -> a coherent ``intelligence_packets`` row the project page
    renders. Use ``dry_run`` to inspect the synthesized output before writing.

    Surfaces LLM failure as a 500 (never writes a silent empty packet)."""
    if request.project_id < 1:
        raise HTTPException(status_code=422, detail="project_id must be positive")
    try:
        from src.services.project_intelligence.projections.current_state import (
            refresh_project_intelligence,
        )

        return refresh_project_intelligence(
            request.project_id,
            force_full=request.force_full,
            dry_run=request.dry_run,
            model=request.model,
        )
    except Exception as exc:
        logger.error(
            "[ProjectIntelligenceAPI] refresh failed project_id=%s: %s",
            request.project_id,
            exc,
            exc_info=True,
        )
        raise HTTPException(
            status_code=500,
            detail=f"Project intelligence synthesis failed for project {request.project_id}: {exc}",
        ) from exc


@app.get(
    "/api/intelligence/projects/{project_id}/packet-items",
    tags=["Intelligence"],
    summary="Read cumulative Product Intelligence findings for a project",
)
async def project_packet_items_endpoint(
    project_id: int,
    status: Optional[str] = None,
    _: None = Depends(require_admin_api_key),
) -> Dict[str, Any]:
    if project_id < 1:
        raise HTTPException(status_code=422, detail="project_id must be positive")
    if status and status not in {"open", "resolved", "superseded"}:
        raise HTTPException(status_code=422, detail="status must be open, resolved, or superseded")
    try:
        from src.services.project_intelligence.packet_repository import list_packet_items
        from src.services.supabase_helpers import get_supabase_client
        rows = list_packet_items(get_supabase_client(), project_id, status=status)
        return {"project_id": project_id, "status": status, "items": rows}
    except Exception as exc:
        logger.error("[ProjectPacketItemsAPI] read failed project_id=%s: %s", project_id, exc, exc_info=True)
        raise HTTPException(status_code=500, detail=f"Project packet items read failed for project {project_id}: {exc}") from exc


class ReconcileFlagsRequest(BaseModel):
    project_id: int


@app.post(
    "/api/intelligence/reconcile-flags",
    tags=["Intelligence"],
    summary="Flag->outcome calibration: resolve open predictive flags against later events",
)
async def reconcile_flags(
    request: ReconcileFlagsRequest,
    _: None = Depends(require_admin_api_key),
) -> Dict[str, Any]:
    """For each open predictive flag on the project, decide whether it has since
    materialized / did-not-materialize based on subsequent events, and link the
    realizing event."""
    try:
        from src.services.project_intelligence.projections.project_communications import reconcile_project_flags

        return reconcile_project_flags(request.project_id)
    except Exception as exc:
        logger.error("[ReconcileFlagsAPI] failed project_id=%s: %s", request.project_id, exc, exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Flag reconcile failed for project {request.project_id}: {exc}",
        ) from exc


@app.post(
    "/api/intelligence/content-builder",
    tags=["Intelligence"],
    summary="Run Alleato Deep Agents content builder",
)
async def run_deep_agent_content_builder(
    request: ContentBuilderRequest,
    _: None = Depends(require_admin_api_key),
) -> Dict[str, Any]:
    """Run the standalone content builder with packaged memory, skills, and subagents."""
    if not _env_flag_enabled("DEEP_AGENTS_CONTENT_BUILDER_ENABLED"):
        raise HTTPException(
            status_code=503,
            detail=(
                "Deep Agents content builder is disabled. Set "
                "DEEP_AGENTS_CONTENT_BUILDER_ENABLED=true to run the content builder."
            ),
        )

    response = run_content_builder_agent(
        request,
        model=os.getenv("DEEP_AGENTS_CONTENT_BUILDER_MODEL", "openai:gpt-5.4-mini"),
    )
    if response.mode == "unavailable":
        raise HTTPException(status_code=502, detail=response.model_dump(by_alias=True))
    return response.model_dump(by_alias=True)


@app.post(
    "/api/intelligence/deep-agent/docs-research",
    tags=["Intelligence"],
    summary="Run LangChain docs MCP Deep Agents research",
)
async def run_deep_agent_docs_research(
    request: DocsResearchRequest,
    _: None = Depends(require_admin_api_key),
) -> Dict[str, Any]:
    """Run the docs-first Deep Agent with the LangChain docs MCP server."""
    if not _env_flag_enabled("DEEP_AGENTS_DOCS_RESEARCH_ENABLED"):
        raise HTTPException(
            status_code=503,
            detail=(
                "Deep Agents docs research is disabled. Set "
                "DEEP_AGENTS_DOCS_RESEARCH_ENABLED=true to run the docs MCP research agent."
            ),
        )

    response = run_docs_research_agent(
        request,
        model=os.getenv("DEEP_AGENTS_DOCS_RESEARCH_MODEL", "openai:gpt-5.4-mini"),
    )
    if response.mode == "unavailable":
        raise HTTPException(status_code=502, detail=response.model_dump(by_alias=True))
    return response.model_dump(by_alias=True)


@app.post(
    "/api/intelligence/deep-agent/llm-wiki",
    tags=["Intelligence"],
    summary="Run Deep Agents LLM wiki workflow",
)
async def run_deep_agent_llm_wiki(
    request: WikiRequest,
    _: None = Depends(require_admin_api_key),
) -> Dict[str, Any]:
    """Run the packaged LLM wiki workflow with local filesystem isolation."""
    if not _env_flag_enabled("DEEP_AGENTS_LLM_WIKI_ENABLED"):
        raise HTTPException(
            status_code=503,
            detail=(
                "Deep Agents LLM wiki is disabled. Set "
                "DEEP_AGENTS_LLM_WIKI_ENABLED=true to run the LLM wiki agent."
            ),
        )

    response = run_llm_wiki_agent(
        request,
        model=os.getenv("DEEP_AGENTS_LLM_WIKI_MODEL", "openai:gpt-5.4-mini"),
    )
    if response.mode == "unavailable":
        raise HTTPException(status_code=502, detail=response.model_dump(by_alias=True))
    return response.model_dump(by_alias=True)


@app.get(
    "/api/intelligence/deep-agent/llm-wiki/history",
    tags=["Intelligence"],
    summary="List persisted Deep Agents LLM wiki research projects",
)
async def get_deep_agent_llm_wiki_history(
    user_id: Optional[str] = Query(default=None, alias="userId"),
    topic_slug: Optional[str] = Query(default=None, alias="topicSlug"),
    session_id: Optional[str] = Query(default=None, alias="sessionId"),
    limit: int = Query(default=50, ge=1, le=200),
    _: None = Depends(require_admin_api_key),
) -> Dict[str, Any]:
    """Expose completed LLM wiki workspaces so the frontend can browse research history."""
    response = list_llm_wiki_archive(
        user_id=user_id,
        topic_slug=topic_slug,
        session_id=session_id,
        limit=limit,
    )
    return response.model_dump(by_alias=True)


@app.post(
    "/api/intelligence/app-expert",
    tags=["Intelligence"],
    summary="Run the Alleato App Expert specialist agent",
)
async def run_deep_agent_app_expert(
    request: AppExpertRequest,
    _: None = Depends(require_admin_api_key),
) -> Dict[str, Any]:
    """Run the read-only App Expert for questions about the Alleato PM web app."""
    if not _env_flag_enabled("DEEP_AGENTS_APP_EXPERT_ENABLED"):
        raise HTTPException(
            status_code=503,
            detail=(
                "Deep Agents App Expert is disabled. Set "
                "DEEP_AGENTS_APP_EXPERT_ENABLED=true to run the specialist."
            ),
        )

    response = run_app_expert_agent(
        request,
        model=os.getenv("DEEP_AGENTS_APP_EXPERT_MODEL", "openai:gpt-5.4-mini"),
    )
    if response.mode == "unavailable":
        raise HTTPException(status_code=502, detail=response.model_dump(by_alias=True))
    return response.model_dump(by_alias=True)


@app.post(
    "/api/intelligence/research",
    tags=["Intelligence"],
    summary="Run Alleato Deep Agents research",
)
async def run_deep_agent_research(
    request: ResearchRequest,
    _: None = Depends(require_admin_api_key),
) -> Dict[str, Any]:
    """Run the standalone research agent with web and Alleato read-only tools."""
    if not _env_flag_enabled("DEEP_AGENTS_RESEARCH_ENABLED"):
        raise HTTPException(
            status_code=503,
            detail=(
                "Deep Agents research is disabled. Set "
                "DEEP_AGENTS_RESEARCH_ENABLED=true to run the research agent."
            ),
        )

    response = run_research_agent(
        request,
        model=os.getenv("DEEP_AGENTS_RESEARCH_MODEL", "openai:gpt-5.5"),
    )
    if response.mode == "unavailable":
        raise HTTPException(status_code=502, detail=response.model_dump(by_alias=True))
    return response.model_dump(by_alias=True)


@app.post(
    "/api/intelligence/microsoft-executive-assistant",
    tags=["Intelligence"],
    summary="Run the Microsoft Executive Assistant specialist agent",
)
async def run_deep_agent_microsoft_executive_assistant(
    request: MicrosoftExecutiveAssistantRequest,
    _: None = Depends(require_admin_api_key),
) -> Dict[str, Any]:
    """Run the Microsoft specialist instead of making the Strategist operate Microsoft directly."""
    if not _env_flag_enabled("DEEP_AGENTS_MICROSOFT_EXECUTIVE_ASSISTANT_ENABLED"):
        raise HTTPException(
            status_code=503,
            detail=(
                "Deep Agents Microsoft Executive Assistant is disabled. Set "
                "DEEP_AGENTS_MICROSOFT_EXECUTIVE_ASSISTANT_ENABLED=true to run the specialist."
            ),
        )

    response = run_microsoft_executive_assistant(
        request,
        model=f"openai:{MODEL_MICROSOFT_EXECUTIVE_ASSISTANT}",
    )
    if response.mode == "unavailable":
        raise HTTPException(status_code=502, detail=response.model_dump(by_alias=True))
    return response.model_dump(by_alias=True)


# In-process cache for the source-sync health endpoint.
#
# The handler performs 12+ Supabase queries across two projects (MAIN + RAG),
# several fetching thousands of rows, and takes 16-22 s on a cold/uncached run —
# close to (and sometimes past) the Next.js route timeout, which then drops the
# /rag Source Sync panel to "unavailable" with an empty pipeline.
#
# We therefore serve from an in-process cache with **stale-while-revalidate**
# semantics:
#   * a fresh entry (younger than the fresh TTL) is returned directly;
#   * a stale entry is returned IMMEDIATELY while a single background thread
#     recomputes — so the slow query never sits on the request path once the
#     cache has been populated even once;
#   * only a truly cold cache (a fresh process with no entry yet) computes
#     synchronously, and startup pre-warm (see ``prewarm_source_sync_health``)
#     makes even that rare.
# This keeps warm hits ~0.2 s and reliable, instead of one request every TTL
# paying the full 16-22 s and risking the upstream timeout.
_SOURCE_SYNC_HEALTH_CACHE: Tuple[float, Dict[str, Any]] | None = None
# A cached entry younger than this is served without triggering a refresh.
_SOURCE_SYNC_HEALTH_FRESH_TTL_S = 90.0
# Serializes the cold (no-cache) synchronous compute so concurrent first-hits
# don't all run the full query.
_SOURCE_SYNC_HEALTH_CACHE_LOCK = threading.Lock()
# Dedupes background refreshes to a single in-flight runner at a time.
_SOURCE_SYNC_HEALTH_REFRESH_LOCK = threading.Lock()
_SOURCE_SYNC_HEALTH_REFRESHING = False


def _compute_source_sync_health_payload() -> Dict[str, Any]:
    """Run the full (slow) source-sync health query and store it in the cache."""
    global _SOURCE_SYNC_HEALTH_CACHE  # noqa: PLW0603
    from src.services.health.source_sync_health import get_source_sync_health
    from src.services.supabase_helpers import get_supabase_client

    client = get_supabase_client()
    payload = get_source_sync_health(client)
    _SOURCE_SYNC_HEALTH_CACHE = (time.monotonic(), payload)
    return payload


def _source_sync_health_cache_response(
    cached: Tuple[float, Dict[str, Any]],
) -> Dict[str, Any]:
    cached_at, cached_payload = cached
    age = time.monotonic() - cached_at
    return {
        **cached_payload,
        "cachedAt": cached_payload.get("generatedAt"),
        "cacheAgeSeconds": round(age, 1),
    }


def _refresh_source_sync_health_in_background() -> None:
    """Recompute the health payload off the request path, deduped to one runner."""
    global _SOURCE_SYNC_HEALTH_REFRESHING  # noqa: PLW0603
    with _SOURCE_SYNC_HEALTH_REFRESH_LOCK:
        if _SOURCE_SYNC_HEALTH_REFRESHING:
            return
        _SOURCE_SYNC_HEALTH_REFRESHING = True

    def _run() -> None:
        global _SOURCE_SYNC_HEALTH_REFRESHING  # noqa: PLW0603
        try:
            _compute_source_sync_health_payload()
        except Exception as exc:  # pragma: no cover - best-effort background work
            logger.warning(
                "[SourceSyncHealthAPI] background refresh failed: %s", exc, exc_info=True
            )
        finally:
            with _SOURCE_SYNC_HEALTH_REFRESH_LOCK:
                _SOURCE_SYNC_HEALTH_REFRESHING = False

    threading.Thread(
        target=_run, name="source-sync-health-refresh", daemon=True
    ).start()


def prewarm_source_sync_health() -> None:
    """Populate the cache at startup so the first /rag load never blocks.

    Runs the compute on a daemon thread; failures are non-fatal (the endpoint
    falls back to a synchronous cold compute on first request).
    """

    def _run() -> None:
        # Hold the cache lock so an early request that misses the cache waits for
        # this warmup and reuses its result instead of computing in parallel.
        with _SOURCE_SYNC_HEALTH_CACHE_LOCK:
            if _SOURCE_SYNC_HEALTH_CACHE is not None:
                return
            try:
                _compute_source_sync_health_payload()
                logger.info("[SourceSyncHealthAPI] cache pre-warmed at startup")
            except Exception as exc:  # pragma: no cover - best-effort warmup
                logger.warning(
                    "[SourceSyncHealthAPI] startup pre-warm failed (non-critical): %s", exc
                )

    threading.Thread(
        target=_run, name="source-sync-health-prewarm", daemon=True
    ).start()


@app.get("/api/health/source-sync", tags=["Health"], summary="Source sync and intelligence health")
async def get_source_sync_health_status(
    _: None = Depends(require_admin_api_key),
) -> Dict[str, Any]:
    """Return sync freshness, vectorization, task extraction, compiler, and packet health.

    Served from an in-process cache with stale-while-revalidate semantics: a
    fresh entry is returned directly, a stale entry is returned immediately while
    a background thread recomputes, and only a truly cold cache computes
    synchronously. The ``cacheAgeSeconds`` field reports the age of the served
    result so callers can see how stale it is.
    """
    # Fast path: a cached entry exists. Lock-free read is safe — CPython
    # guarantees atomic reference reads, and the worst case is a redundant
    # background refresh kick (itself deduped).
    cached = _SOURCE_SYNC_HEALTH_CACHE
    if cached is not None:
        age = time.monotonic() - cached[0]
        if age >= _SOURCE_SYNC_HEALTH_FRESH_TTL_S:
            # Stale: serve now, recompute off the request path.
            _refresh_source_sync_health_in_background()
        return _source_sync_health_cache_response(cached)

    # Cold cache (fresh process / pre-warm not finished): compute synchronously,
    # but only once — concurrent first-hits queue on the lock and reuse the result.
    with _SOURCE_SYNC_HEALTH_CACHE_LOCK:
        cached = _SOURCE_SYNC_HEALTH_CACHE
        if cached is not None:
            return _source_sync_health_cache_response(cached)

        try:
            return _compute_source_sync_health_payload()
        except Exception as exc:
            logger.error("[SourceSyncHealthAPI] status failed: %s", exc, exc_info=True)
            raise HTTPException(
                status_code=500,
                detail=_public_backend_error("Source sync health query failed", exc),
            ) from exc


@app.post("/api/health/source-sync/recompute", tags=["Health"], summary="Recompute source sync health")
async def recompute_source_sync_health_status(
    _: None = Depends(require_admin_api_key),
) -> Dict[str, Any]:
    """Recompute source sync health from current source, vector, task, and packet tables."""
    try:
        from src.services.health.source_sync_health import (
            MAX_RECOMPUTE_ALERT_WRITES,
            MAX_RECOMPUTE_SNAPSHOT_WRITES,
            get_source_sync_health,
            persist_source_sync_alerts,
            update_source_health_snapshot,
        )
        from src.services.supabase_helpers import get_supabase_client

        client = get_supabase_client()
        health = get_source_sync_health(client)
        updated = 0
        for source in health.get("sources", [])[:MAX_RECOMPUTE_SNAPSHOT_WRITES]:
            update_source_health_snapshot(client, source)
            updated += 1
        routed_alerts = persist_source_sync_alerts(
            client,
            health.get("alerts", [])[:MAX_RECOMPUTE_ALERT_WRITES],
            resolve_missing=False,
        )
        return {
            "status": "completed",
            "updatedSnapshots": updated,
            "routedAlerts": routed_alerts,
            "writeCaps": {
                "snapshots": MAX_RECOMPUTE_SNAPSHOT_WRITES,
                "alerts": MAX_RECOMPUTE_ALERT_WRITES,
                "resolveMissing": False,
            },
            "health": health,
        }
    except Exception as exc:
        logger.error("[SourceSyncHealthAPI] recompute failed: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=_public_backend_error("Source sync health recompute failed", exc),
        ) from exc


# === Scheduled Analysis Engine ===

def _schedule_training_rag_reconciliation() -> None:
    """Keep the training index current without delaying backend readiness."""
    from src.services.training.rag_index import keep_training_rag_index_current

    app.state.training_rag_reconciliation_task = asyncio.create_task(
        keep_training_rag_index_current(), name="training-rag-reconciliation"
    )


@app.post(
    "/api/admin/training/library/reconcile",
    dependencies=[Depends(require_admin_api_key)],
    tags=["Admin"],
)
async def reconcile_training_library_index() -> Dict[str, Any]:
    """Run an authenticated, serialized training-index reconciliation on demand."""
    from src.services.training.rag_index import reconcile_training_rag_index

    try:
        result = await asyncio.to_thread(reconcile_training_rag_index)
        return {"status": "completed", **result}
    except Exception as exc:
        logger.exception("[TrainingRagIndex] admin reconciliation failed")
        raise HTTPException(
            status_code=500,
            detail=_public_backend_error(
                "Training library index reconciliation failed",
                exc,
            ),
        ) from exc


@app.on_event("startup")
async def start_scheduler():
    """Initialize the scheduled analysis engine on server startup."""
    _schedule_training_rag_reconciliation()


    try:
        from src.services.scheduler import init_scheduler
        init_scheduler()
    except Exception as e:
        logger.warning("Scheduler init failed (non-critical): %s", e)

    # Pre-warm the source-sync health cache so the first /rag load is served from
    # cache (~0.2 s) instead of paying the cold 16-22 s recompute on the request
    # path. Runs on a daemon thread; failures are non-fatal.
    try:
        prewarm_source_sync_health()
    except Exception as e:  # pragma: no cover - warmup is best-effort
        logger.warning("Source-sync health pre-warm kickoff failed (non-critical): %s", e)

    if alleato_system_mcp_enabled():
        app.state.alleato_system_mcp_lifespan = create_alleato_system_mcp_lifespan()
        await app.state.alleato_system_mcp_lifespan.__aenter__()


@app.on_event("startup")
async def check_database_url_host_parity() -> None:
    """Flag at boot if DATABASE_URL drifted off the known-good IPv4 pooler host.

    The 2026-07-09 outage was exactly this: the Render env pointed DATABASE_URL
    at the Supabase IPv6-only direct host and every AI DB tool silently failed.
    Catch a repeat on deploy instead of discovering it via a wrong AI answer.
    Never crashes the app — a bad host is a config problem to surface, not a
    reason to refuse to boot.
    """
    try:
        from src.services.agents.alleato_ai_tools.db_health import (
            database_url_host_status,
            emit_db_connectivity_alert,
            probe_app_db,
        )

        parity = database_url_host_status()
        if parity.ok:
            logger.info("[db-parity] DATABASE_URL host OK (pooler): %s", parity.host)
            return

        logger.error("[db-parity] DATABASE_URL host check FAILED: %s", parity.detail)
        # Only page Sentry if the DB is actually unreachable — an unrecognized
        # host that still connects is worth a log but not an alert storm.
        probe = probe_app_db()
        if not probe.reachable:
            emit_db_connectivity_alert(source="startup_parity", probe=probe)
    except Exception as exc:  # pragma: no cover - probe must never break startup
        logger.warning("[db-parity] host parity check skipped: %s", exc)


@app.on_event("startup")
async def emit_langsmith_tracing_probe() -> None:
    # If tracing breaks again, this run is the first thing missing from the
    # LangSmith project — we see the regression on deploy instead of finding out
    # a day later. Failure here is logged, never crashes the app.
    import os

    project = os.getenv("LANGSMITH_PROJECT") or os.getenv("LANGCHAIN_PROJECT")
    tracing_on = (
        os.getenv("LANGSMITH_TRACING") == "true"
        or os.getenv("LANGCHAIN_TRACING_V2") == "true"
    )
    has_key = bool(os.getenv("LANGSMITH_API_KEY") or os.getenv("LANGCHAIN_API_KEY"))
    if not (project and tracing_on and has_key):
        logger.warning(
            "[tracing-probe] LangSmith not fully configured (project=%s tracing=%s api_key=%s) — skipping probe",
            bool(project), tracing_on, has_key,
        )
        return

    try:
        from langsmith import traceable

        @traceable(name="alleato-backend.startup_probe", project_name=project)
        def _probe() -> dict:
            return {
                "service": os.getenv("LANGSMITH_DEPLOYMENT_NAME", "alleato-backend"),
                "commit": os.getenv("RENDER_GIT_COMMIT", "unknown"),
                "ok": True,
            }

        result = _probe()
        logger.info("[tracing-probe] emitted startup trace to project=%s result=%s", project, result)
    except Exception as exc:
        logger.warning("[tracing-probe] failed to emit startup trace: %s", exc, exc_info=True)


@app.on_event("shutdown")
async def stop_scheduler():
    """Gracefully shut down the scheduler."""
    training_task = getattr(app.state, "training_rag_reconciliation_task", None)
    if training_task is not None:
        training_task.cancel()
        try:
            await training_task
        except asyncio.CancelledError:
            pass

    try:
        from src.services.scheduler import shutdown_scheduler
        shutdown_scheduler()
    except Exception:
        pass

    mcp_lifespan = getattr(app.state, "alleato_system_mcp_lifespan", None)
    if mcp_lifespan is not None:
        await mcp_lifespan.__aexit__(None, None, None)


# === Digest Endpoints ===

@app.get("/api/digests/meeting/{metadata_id}", tags=["Digests"])
async def get_meeting_digest(metadata_id: str) -> Dict[str, Any]:
    """Get the post-meeting digest for a specific meeting."""
    from src.services.supabase_helpers import get_supabase_client
    client = get_supabase_client()
    resp = (
        client.table("meeting_digests")
        .select("*")
        .eq("metadata_id", metadata_id)
        .maybe_single()
        .execute()
    )
    if not resp.data:
        raise HTTPException(status_code=404, detail="Digest not found")
    return resp.data


@app.get("/api/digests/daily/{date}", tags=["Digests"])
async def get_daily_digest(date: str) -> Dict[str, Any]:
    """Get the daily recap for a specific date (YYYY-MM-DD)."""
    from src.services.supabase_helpers import get_supabase_client
    client = get_supabase_client()
    resp = (
        client.table("daily_recaps")
        .select("*")
        .eq("recap_date", date)
        .maybe_single()
        .execute()
    )
    if not resp.data:
        raise HTTPException(status_code=404, detail="Daily recap not found")
    return resp.data


# === Admin Endpoints ===
# Import and include admin routes
try:
    from src.api.admin_endpoints import router as admin_router
    app.include_router(admin_router)
    logger.info("Admin endpoints loaded successfully")
except ImportError as e:
    logger.warning(f"Admin endpoints not available: {e}")

# === YokeFlow Agent Platform ===
# Mount YokeFlow API as a sub-application at /yokeflow
try:
    from src.yokeflow.api.router import initialize_yokeflow
    yokeflow_app = initialize_yokeflow()
    app.mount("/yokeflow", yokeflow_app)
    logger.info("YokeFlow agent platform mounted at /yokeflow")
except ImportError as e:
    logger.warning(f"YokeFlow agent platform not available: {e}")
except Exception as e:
    logger.warning(f"Failed to initialize YokeFlow: {e}")
