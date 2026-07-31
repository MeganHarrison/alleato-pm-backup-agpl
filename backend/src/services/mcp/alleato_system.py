from __future__ import annotations

import hmac
import os
from typing import Any, Dict, Iterable, List, Optional

from starlette.responses import JSONResponse

from src.services.supabase_helpers import SupabaseRagStore, get_supabase_client

try:
    from mcp.server.fastmcp import FastMCP
except ModuleNotFoundError as exc:  # pragma: no cover - depends on deploy image
    FastMCP = None  # type: ignore[assignment]
    _MCP_IMPORT_ERROR: Optional[str] = str(exc)
else:
    _MCP_IMPORT_ERROR = None

DEFAULT_LIMIT = 10
MAX_LIMIT = 50
PROJECT_OVERVIEW_RECENT_LIMIT = 5
MCP_AUTH_REALM = "alleato-system-mcp"


def _env_flag_enabled(name: str, default: bool = False) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def alleato_system_mcp_enabled() -> bool:
    return _env_flag_enabled("ALLEATO_SYSTEM_MCP_ENABLED", default=True) and FastMCP is not None


def get_alleato_system_mcp_bearer_token() -> Optional[str]:
    dedicated = (os.getenv("ALLEATO_SYSTEM_MCP_BEARER_TOKEN") or "").strip()
    if dedicated:
        return dedicated

    fallback = (os.getenv("ADMIN_API_KEY") or "").strip()
    return fallback or None


def alleato_system_mcp_status() -> Dict[str, Any]:
    return {
        "enabled": alleato_system_mcp_enabled(),
        "auth_configured": bool(get_alleato_system_mcp_bearer_token()),
        "endpoint_path": "/mcp/",
        "transport": "streamable-http",
        "tool_count": len(ALLEATO_SYSTEM_TOOL_NAMES),
        "available": FastMCP is not None,
        "unavailable_reason": _MCP_IMPORT_ERROR,
    }


class MCPBearerTokenMiddleware:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope.get("type") != "http":
            await self.app(scope, receive, send)
            return

        method = scope.get("method", "GET").upper()
        if method == "OPTIONS":
            await self.app(scope, receive, send)
            return

        configured_token = get_alleato_system_mcp_bearer_token()
        if not configured_token:
            response = JSONResponse(
                {
                    "error": "MCP auth is not configured.",
                    "code": "MCP_AUTH_NOT_CONFIGURED",
                },
                status_code=503,
            )
            await response(scope, receive, send)
            return

        headers = {
            key.decode("latin-1").lower(): value.decode("latin-1")
            for key, value in scope.get("headers", [])
        }
        auth_header = headers.get("authorization", "")
        expected = f"Bearer {configured_token}"
        if not hmac.compare_digest(auth_header, expected):
            response = JSONResponse(
                {
                    "error": "Bearer token required.",
                    "code": "MCP_AUTH_REQUIRED",
                },
                status_code=401,
                headers={"WWW-Authenticate": f'Bearer realm="{MCP_AUTH_REALM}"'},
            )
            await response(scope, receive, send)
            return

        await self.app(scope, receive, send)


def _supabase():
    return get_supabase_client()


def _rag_store() -> SupabaseRagStore:
    return SupabaseRagStore()


def _normalize_text(value: Any) -> str:
    if not isinstance(value, str):
        return ""
    return value.strip()


def _compact_whitespace(value: Any) -> str:
    return " ".join(_normalize_text(value).split())


def _excerpt(value: Any, max_length: int = 320) -> str:
    compacted = _compact_whitespace(value)
    if len(compacted) <= max_length:
        return compacted
    return f"{compacted[: max_length - 3]}..."


def _clamp_limit(value: Any, default: int = DEFAULT_LIMIT) -> int:
    try:
        numeric = int(value if value is not None else default)
    except (TypeError, ValueError):
        return default
    if numeric <= 0:
        return default
    return min(numeric, MAX_LIMIT)


def _dedupe_rows(rows: Iterable[Dict[str, Any]], key_fields: List[str]) -> List[Dict[str, Any]]:
    result: List[Dict[str, Any]] = []
    seen: set[str] = set()
    for row in rows:
        key = "::".join(str(row.get(field) or "") for field in key_fields)
        if key in seen:
            continue
        seen.add(key)
        result.append(row)
    return result


def _map_project(row: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "id": row.get("id"),
        "name": row.get("name"),
        "project_number": row.get("project_number"),
        "job_number": row.get("job number"),
        "name_code": row.get("name_code"),
        "stage": row.get("stage"),
        "health_status": row.get("health_status"),
        "health_score": row.get("health_score"),
        "summary": row.get("summary"),
        "summary_updated_at": row.get("summary_updated_at"),
        "archived": bool(row.get("archived")),
        "type": row.get("type"),
        "state": row.get("state"),
        "address": row.get("address"),
    }


def _resolve_project(project_ref: str) -> Dict[str, Any]:
    raw_ref = _normalize_text(project_ref)
    if not raw_ref:
        return {
            "ok": False,
            "error": {"code": "VALIDATION_ERROR", "message": "project_ref is required."},
        }

    supabase = _supabase()
    candidates: List[Dict[str, Any]] = []

    if raw_ref.isdigit():
        response = supabase.table("projects").select("*").eq("id", int(raw_ref)).limit(2).execute()
        candidates.extend(response.data or [])

    if not candidates:
        exact_code = (
            supabase.table("projects")
            .select("*")
            .or_(f"project_number.eq.{raw_ref},name_code.eq.{raw_ref}")
            .limit(5)
            .execute()
        )
        exact_job = (
            supabase.table("projects")
            .select("*")
            .filter("job number", "eq", raw_ref)
            .limit(5)
            .execute()
        )
        candidates.extend(exact_code.data or [])
        candidates.extend(exact_job.data or [])

    if not candidates:
        escaped = raw_ref.replace("%", r"\%").replace("_", r"\_")
        fuzzy_code = (
            supabase.table("projects")
            .select("*")
            .or_(
                ",".join(
                    [
                        f"name.ilike.%{escaped}%",
                        f"project_number.ilike.%{escaped}%",
                        f"name_code.ilike.%{escaped}%",
                    ]
                )
            )
            .limit(10)
            .execute()
        )
        fuzzy_job = (
            supabase.table("projects")
            .select("*")
            .filter("job number", "ilike", f"%{escaped}%")
            .limit(10)
            .execute()
        )
        candidates.extend(fuzzy_code.data or [])
        candidates.extend(fuzzy_job.data or [])

    unique_candidates = _dedupe_rows(candidates, ["id"])
    if not unique_candidates:
        return {
            "ok": False,
            "error": {
                "code": "PROJECT_NOT_FOUND",
                "message": f'No project matched "{raw_ref}".',
            },
        }

    if len(unique_candidates) > 1:
        return {
            "ok": False,
            "error": {
                "code": "PROJECT_AMBIGUOUS",
                "message": f'More than one project matched "{raw_ref}".',
                "matches": [_map_project(row) for row in unique_candidates],
            },
        }

    return {"ok": True, "project": unique_candidates[0]}


def _list_projects(query: str = "", include_archived: bool = False, limit: int = 20) -> Dict[str, Any]:
    supabase = _supabase()
    bounded_limit = _clamp_limit(limit, 20)
    query_builder = supabase.table("projects").select("*").order("created_at", desc=True).limit(bounded_limit)
    if not include_archived:
        query_builder = query_builder.eq("archived", False)

    query_text = _normalize_text(query)
    if query_text:
        escaped = query_text.replace("%", r"\%").replace("_", r"\_")
        query_builder = query_builder.or_(
            ",".join(
                [
                    f"name.ilike.%{escaped}%",
                    f"project_number.ilike.%{escaped}%",
                    f"name_code.ilike.%{escaped}%",
                ]
            )
        )

    response = query_builder.execute()
    rows = response.data or []

    if query_text:
        job_number_rows = (
            supabase.table("projects")
            .select("*")
            .filter("job number", "ilike", f"%{query_text}%")
            .limit(bounded_limit)
            .execute()
        )
        rows.extend(job_number_rows.data or [])

    projects = [_map_project(row) for row in _dedupe_rows(rows, ["id"])]
    return {"ok": True, "total": len(projects), "projects": projects[:bounded_limit]}


def _list_project_tasks(project_ref: str, status: str = "", assignee: str = "", limit: int = 25) -> Dict[str, Any]:
    resolved = _resolve_project(project_ref)
    if not resolved.get("ok"):
        return resolved

    project = resolved["project"]
    bounded_limit = _clamp_limit(limit, 25)
    supabase = _supabase()

    query_builder = (
        supabase.table("tasks")
        .select(
            "id,title,description,status,priority,due_date,assignee_name,assignee_email,source_system,metadata_id,created_at,updated_at"
        )
        .eq("project_id", project["id"])
        .order("created_at", desc=True)
        .limit(bounded_limit)
    )
    if _normalize_text(status):
        query_builder = query_builder.eq("status", _normalize_text(status))
    if _normalize_text(assignee):
        query_builder = query_builder.or_(
            f"assignee_name.ilike.%{_normalize_text(assignee)}%,assignee_email.ilike.%{_normalize_text(assignee)}%"
        )

    response = query_builder.execute()
    rows = response.data or []
    return {
        "ok": True,
        "project": _map_project(project),
        "total": len(rows),
        "tasks": [
            {
                "id": row.get("id"),
                "title": row.get("title") or _excerpt(row.get("description"), 96),
                "description": _excerpt(row.get("description"), 240),
                "status": row.get("status"),
                "priority": row.get("priority"),
                "due_date": row.get("due_date"),
                "assignee_name": row.get("assignee_name"),
                "assignee_email": row.get("assignee_email"),
                "source_system": row.get("source_system"),
                "metadata_id": row.get("metadata_id"),
                "created_at": row.get("created_at"),
                "updated_at": row.get("updated_at"),
            }
            for row in rows
        ],
    }


def _list_project_rfis(project_ref: str, status: str = "", search: str = "", limit: int = 25) -> Dict[str, Any]:
    resolved = _resolve_project(project_ref)
    if not resolved.get("ok"):
        return resolved

    project = resolved["project"]
    bounded_limit = _clamp_limit(limit, 25)
    supabase = _supabase()
    query_builder = (
        supabase.table("rfis")
        .select("id,number,subject,question,status,ball_in_court,due_date,date_initiated,received_from,updated_at")
        .eq("project_id", project["id"])
        .order("number", desc=True)
        .limit(bounded_limit)
    )
    if _normalize_text(status):
        query_builder = query_builder.eq("status", _normalize_text(status))
    if _normalize_text(search):
        query_builder = query_builder.or_(
            f"subject.ilike.%{_normalize_text(search)}%,question.ilike.%{_normalize_text(search)}%"
        )

    response = query_builder.execute()
    rows = response.data or []
    return {
        "ok": True,
        "project": _map_project(project),
        "total": len(rows),
        "rfis": [
            {
                "id": row.get("id"),
                "number": row.get("number"),
                "subject": row.get("subject"),
                "question": _excerpt(row.get("question"), 240),
                "status": row.get("status"),
                "ball_in_court": row.get("ball_in_court"),
                "due_date": row.get("due_date"),
                "date_initiated": row.get("date_initiated"),
                "received_from": row.get("received_from"),
                "updated_at": row.get("updated_at"),
            }
            for row in rows
        ],
    }


def _list_project_commitments(
    project_ref: str,
    status: str = "",
    type: str = "",
    search: str = "",
    limit: int = 25,
) -> Dict[str, Any]:
    resolved = _resolve_project(project_ref)
    if not resolved.get("ok"):
        return resolved

    project = resolved["project"]
    bounded_limit = _clamp_limit(limit, 25)
    supabase = _supabase()
    query_builder = (
        supabase.table("commitments_unified")
        .select(
            "id,commitment_type,contract_number,title,status,contract_company_id,company_name,executed,description,created_at,updated_at,deleted_at"
        )
        .eq("project_id", project["id"])
        .is_("deleted_at", "null")
        .order("created_at", desc=True)
        .limit(bounded_limit)
    )
    if _normalize_text(status):
        query_builder = query_builder.ilike("status", _normalize_text(status))
    if _normalize_text(type):
        query_builder = query_builder.eq("commitment_type", _normalize_text(type))
    if _normalize_text(search):
        query_builder = query_builder.or_(
            f"contract_number.ilike.%{_normalize_text(search)}%,title.ilike.%{_normalize_text(search)}%,description.ilike.%{_normalize_text(search)}%"
        )

    response = query_builder.execute()
    rows = response.data or []
    return {
        "ok": True,
        "project": _map_project(project),
        "total": len(rows),
        "commitments": [
            {
                "id": row.get("id"),
                "type": row.get("commitment_type"),
                "contract_number": row.get("contract_number"),
                "title": row.get("title"),
                "status": row.get("status"),
                "contract_company_id": row.get("contract_company_id"),
                "company_name": row.get("company_name"),
                "executed": bool(row.get("executed")),
                "description": _excerpt(row.get("description"), 220),
                "created_at": row.get("created_at"),
                "updated_at": row.get("updated_at"),
            }
            for row in rows
        ],
    }


def _list_project_documents(
    project_ref: str,
    folder: str = "",
    status: str = "",
    category: str = "",
    search: str = "",
    limit: int = 25,
) -> Dict[str, Any]:
    resolved = _resolve_project(project_ref)
    if not resolved.get("ok"):
        return resolved

    project = resolved["project"]
    bounded_limit = _clamp_limit(limit, 25)
    supabase = _supabase()
    query_builder = (
        supabase.table("project_documents")
        .select(
            "id,title,file_name,folder,category,status,source_system,source_web_url,workflow_target,content_type,created_at,updated_at,deleted_at"
        )
        .eq("project_id", project["id"])
        .is_("deleted_at", "null")
        .order("created_at", desc=True)
        .limit(bounded_limit)
    )
    if _normalize_text(folder):
        query_builder = query_builder.eq("folder", _normalize_text(folder))
    if _normalize_text(status):
        query_builder = query_builder.eq("status", _normalize_text(status))
    if _normalize_text(category):
        query_builder = query_builder.eq("category", _normalize_text(category))
    if _normalize_text(search):
        query_builder = query_builder.or_(
            f"title.ilike.%{_normalize_text(search)}%,file_name.ilike.%{_normalize_text(search)}%"
        )

    response = query_builder.execute()
    rows = response.data or []
    return {
        "ok": True,
        "project": _map_project(project),
        "total": len(rows),
        "documents": [
            {
                "id": row.get("id"),
                "title": row.get("title"),
                "file_name": row.get("file_name"),
                "folder": row.get("folder"),
                "category": row.get("category"),
                "status": row.get("status"),
                "source_system": row.get("source_system"),
                "source_web_url": row.get("source_web_url"),
                "workflow_target": row.get("workflow_target"),
                "content_type": row.get("content_type"),
                "created_at": row.get("created_at"),
                "updated_at": row.get("updated_at"),
            }
            for row in rows
        ],
    }


def _get_project_overview(project_ref: str) -> Dict[str, Any]:
    resolved = _resolve_project(project_ref)
    if not resolved.get("ok"):
        return resolved

    project = resolved["project"]
    supabase = _supabase()
    tasks_count = (
        supabase.table("tasks").select("id", count="exact", head=True).eq("project_id", project["id"]).execute().count
        or 0
    )
    rfis_count = (
        supabase.table("rfis").select("id", count="exact", head=True).eq("project_id", project["id"]).execute().count
        or 0
    )
    documents_count = (
        supabase.table("project_documents")
        .select("id", count="exact", head=True)
        .eq("project_id", project["id"])
        .is_("deleted_at", "null")
        .execute()
        .count
        or 0
    )
    commitments_count = (
        supabase.table("commitments_unified")
        .select("id", count="exact", head=True)
        .eq("project_id", project["id"])
        .is_("deleted_at", "null")
        .execute()
        .count
        or 0
    )

    return {
        "ok": True,
        "project": _map_project(project),
        "counts": {
            "tasks": tasks_count,
            "rfis": rfis_count,
            "documents": documents_count,
            "commitments": commitments_count,
        },
        "recent": {
            "tasks": _list_project_tasks(project_ref=str(project["id"]), limit=PROJECT_OVERVIEW_RECENT_LIMIT)["tasks"],
            "rfis": _list_project_rfis(project_ref=str(project["id"]), limit=PROJECT_OVERVIEW_RECENT_LIMIT)["rfis"],
            "documents": _list_project_documents(
                project_ref=str(project["id"]), limit=PROJECT_OVERVIEW_RECENT_LIMIT
            )["documents"],
        },
    }


def _search_project_context(project_ref: str, query: str, limit: int = 8) -> Dict[str, Any]:
    resolved = _resolve_project(project_ref)
    if not resolved.get("ok"):
        return resolved

    search_query = _normalize_text(query)
    if not search_query:
        return {
            "ok": False,
            "error": {"code": "VALIDATION_ERROR", "message": "query is required."},
        }

    project = resolved["project"]
    bounded_limit = _clamp_limit(limit, 8)
    supabase = _supabase()
    warnings: List[str] = []
    results: List[Dict[str, Any]] = []

    tasks = (
        supabase.table("tasks")
        .select("id,title,description,status,priority,due_date,assignee_name,created_at")
        .eq("project_id", project["id"])
        .or_(f"title.ilike.%{search_query}%,description.ilike.%{search_query}%")
        .limit(bounded_limit)
        .execute()
    )
    for row in tasks.data or []:
        results.append(
            {
                "source_type": "task",
                "match_type": "keyword",
                "score": 0.7,
                "title": row.get("title") or _excerpt(row.get("description"), 120),
                "content": _excerpt(row.get("description"), 260),
                "task_id": row.get("id"),
                "status": row.get("status"),
                "priority": row.get("priority"),
                "due_date": row.get("due_date"),
                "assignee_name": row.get("assignee_name"),
                "created_at": row.get("created_at"),
            }
        )

    rfis = (
        supabase.table("rfis")
        .select("id,number,subject,question,status,updated_at")
        .eq("project_id", project["id"])
        .or_(f"subject.ilike.%{search_query}%,question.ilike.%{search_query}%")
        .limit(bounded_limit)
        .execute()
    )
    for row in rfis.data or []:
        results.append(
            {
                "source_type": "rfi",
                "match_type": "keyword",
                "score": 0.65,
                "title": f'RFI {row.get("number")}: {row.get("subject")}',
                "content": _excerpt(row.get("question"), 260),
                "rfi_id": row.get("id"),
                "status": row.get("status"),
                "updated_at": row.get("updated_at"),
            }
        )

    commitments = (
        supabase.table("commitments_unified")
        .select("id,commitment_type,contract_number,title,description,status,updated_at,deleted_at")
        .eq("project_id", project["id"])
        .is_("deleted_at", "null")
        .or_(
            f"contract_number.ilike.%{search_query}%,title.ilike.%{search_query}%,description.ilike.%{search_query}%"
        )
        .limit(bounded_limit)
        .execute()
    )
    for row in commitments.data or []:
        results.append(
            {
                "source_type": "commitment",
                "match_type": "keyword",
                "score": 0.6,
                "title": (
                    f'{row.get("contract_number")} {row.get("title")}'.strip()
                    if row.get("contract_number")
                    else row.get("title")
                ),
                "content": _excerpt(row.get("description"), 260),
                "commitment_id": row.get("id"),
                "commitment_type": row.get("commitment_type"),
                "status": row.get("status"),
                "updated_at": row.get("updated_at"),
            }
        )

    documents = (
        supabase.table("project_documents")
        .select("id,title,file_name,category,source_system,updated_at,deleted_at")
        .eq("project_id", project["id"])
        .is_("deleted_at", "null")
        .or_(f"title.ilike.%{search_query}%,file_name.ilike.%{search_query}%")
        .limit(bounded_limit)
        .execute()
    )
    for row in documents.data or []:
        results.append(
            {
                "source_type": "project_document",
                "match_type": "keyword",
                "score": 0.55,
                "title": row.get("title"),
                "content": row.get("file_name"),
                "document_id": row.get("id"),
                "category": row.get("category"),
                "source_system": row.get("source_system"),
                "updated_at": row.get("updated_at"),
            }
        )

    try:
        chunk_rows = _rag_store().search_chunks_by_keyword(search_query, project_id=project["id"], limit=bounded_limit)
        for row in chunk_rows:
            results.append(
                {
                    "source_type": "document_chunk",
                    "match_type": "keyword",
                    "score": 0.75,
                    "title": row.get("title") or row.get("document_title"),
                    "content": _excerpt(row.get("content") or row.get("text"), 420),
                    "document_id": row.get("document_id"),
                    "chunk_id": row.get("chunk_id"),
                    "created_at": row.get("created_at"),
                    "metadata": row.get("metadata"),
                }
            )
    except Exception as exc:
        warnings.append(f"RAG chunk keyword search unavailable: {exc}")

    sorted_results = sorted(
        _dedupe_rows(results, ["source_type", "document_id", "task_id", "rfi_id", "commitment_id", "title"]),
        key=lambda row: (row.get("score", 0), row.get("created_at") or row.get("updated_at") or ""),
        reverse=True,
    )[:bounded_limit]

    return {
        "ok": True,
        "search_mode": "keyword_only",
        "warnings": warnings,
        "project": _map_project(project),
        "query": search_query,
        "total": len(sorted_results),
        "results": sorted_results,
    }


def build_alleato_system_mcp():
    if FastMCP is None:
        raise RuntimeError(
            f"Alleato system MCP is unavailable because the MCP dependency failed to import: {_MCP_IMPORT_ERROR}"
        )

    mcp = FastMCP(
        name="alleato-system",
        instructions=(
            "Read-only hosted MCP server for live Alleato project context. "
            "Resolve a project first, then read project tasks, RFIs, commitments, documents, or search context."
        ),
        streamable_http_path="/",
        host="0.0.0.0",
        stateless_http=False,
    )

    @mcp.tool(description="List Alleato projects by name, project number, job number, or code.", structured_output=True)
    def list_projects(query: str = "", include_archived: bool = False, limit: int = 20) -> Dict[str, Any]:
        return _list_projects(query=query, include_archived=include_archived, limit=limit)

    @mcp.tool(
        description="Return a high-signal project summary with counts and recent tasks, RFIs, and documents.",
        structured_output=True,
    )
    def get_project_overview(project_ref: str) -> Dict[str, Any]:
        return _get_project_overview(project_ref=project_ref)

    @mcp.tool(
        description=(
            "Search one project's live context across tasks, RFIs, commitments, project documents, "
            "and RAG document chunks using stable keyword search."
        ),
        structured_output=True,
    )
    def search_project_context(project_ref: str, query: str, limit: int = 8) -> Dict[str, Any]:
        return _search_project_context(project_ref=project_ref, query=query, limit=limit)

    @mcp.tool(description="List live project tasks with assignee, due date, and source metadata.", structured_output=True)
    def list_project_tasks(project_ref: str, status: str = "", assignee: str = "", limit: int = 25) -> Dict[str, Any]:
        return _list_project_tasks(project_ref=project_ref, status=status, assignee=assignee, limit=limit)

    @mcp.tool(description="List project RFIs with status, ball-in-court, and question text.", structured_output=True)
    def list_project_rfis(project_ref: str, status: str = "", search: str = "", limit: int = 25) -> Dict[str, Any]:
        return _list_project_rfis(project_ref=project_ref, status=status, search=search, limit=limit)

    @mcp.tool(description="List project commitments from the unified commitments view.", structured_output=True)
    def list_project_commitments(
        project_ref: str,
        status: str = "",
        type: str = "",
        search: str = "",
        limit: int = 25,
    ) -> Dict[str, Any]:
        return _list_project_commitments(
            project_ref=project_ref,
            status=status,
            type=type,
            search=search,
            limit=limit,
        )

    @mcp.tool(description="List project documents from the project_documents table.", structured_output=True)
    def list_project_documents(
        project_ref: str,
        folder: str = "",
        status: str = "",
        category: str = "",
        search: str = "",
        limit: int = 25,
    ) -> Dict[str, Any]:
        return _list_project_documents(
            project_ref=project_ref,
            folder=folder,
            status=status,
            category=category,
            search=search,
            limit=limit,
        )

    return mcp


ALLEATO_SYSTEM_TOOL_NAMES = [
    "list_projects",
    "get_project_overview",
    "search_project_context",
    "list_project_tasks",
    "list_project_rfis",
    "list_project_commitments",
    "list_project_documents",
]


_ALLEATO_SYSTEM_MCP = None
_ALLEATO_SYSTEM_MCP_STARLETTE_APP = None


def _get_alleato_system_mcp():
    global _ALLEATO_SYSTEM_MCP, _ALLEATO_SYSTEM_MCP_STARLETTE_APP
    if _ALLEATO_SYSTEM_MCP is None:
        _ALLEATO_SYSTEM_MCP = build_alleato_system_mcp()
        _ALLEATO_SYSTEM_MCP_STARLETTE_APP = _ALLEATO_SYSTEM_MCP.streamable_http_app()
    return _ALLEATO_SYSTEM_MCP


def create_alleato_system_mcp_app():
    _get_alleato_system_mcp()
    return MCPBearerTokenMiddleware(_ALLEATO_SYSTEM_MCP_STARLETTE_APP)


def create_alleato_system_mcp_lifespan():
    return _get_alleato_system_mcp().session_manager.run()
