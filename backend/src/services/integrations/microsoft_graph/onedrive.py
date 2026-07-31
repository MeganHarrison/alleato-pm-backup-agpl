"""
OneDrive / SharePoint File Ingestion
Fetches and extracts text from project documents.
"""
import io
import logging
import os
from dataclasses import dataclass
from datetime import date, datetime, time, timezone
from pathlib import PurePosixPath
from typing import Optional

from .client import get_graph_client
from .project_documents import (
    DOCUMENT_BUCKET,
    graph_id_safe,
    metadata_text_storage,
    project_document_payload_from_graph_item,
    source_path,
    upsert_project_document_by_source,
)
from .project_inference import infer_project_id
from ...supabase_helpers import SupabaseRagStore, get_rag_read_client, storage_upload_with_retry

logger = logging.getLogger(__name__)
_WARNED_OPTIONAL_DEPENDENCIES: set[str] = set()


@dataclass(frozen=True)
class SharePointSyncResult:
    """The outcome of one SharePoint delta pass.

    `retry_required` deliberately keeps the existing delta cursor in place.
    Otherwise a file that fails after Graph has supplied its delta entry is
    silently skipped forever when the new cursor is saved.
    """

    items_synced: int
    delta_token: str
    items_failed: int = 0
    retry_required: bool = False
    retry_reason: Optional[str] = None


def _warn_once(key: str, message: str, *args) -> None:
    if key in _WARNED_OPTIONAL_DEPENDENCIES:
        logger.debug(message, *args)
        return
    _WARNED_OPTIONAL_DEPENDENCIES.add(key)
    logger.warning(message, *args)


def _bounded_int_env(name: str, default: int, minimum: int, maximum: int) -> int:
    raw = os.environ.get(name)
    try:
        value = int(raw) if raw not in (None, "") else default
    except (TypeError, ValueError):
        return default
    return max(minimum, min(maximum, value))


def _actual_parent_path(item: dict) -> str:
    """Extract the real folder path from Graph API parentReference.
    Graph returns paths like '/drive/root:/Alleato Group/2026 Jobs/ProjectX'."""
    ref_path = (item.get("parentReference") or {}).get("path", "")
    if "root:/" in ref_path:
        return ref_path.split("root:/", 1)[1]
    return ref_path.lstrip("/")


def _item_source_path(item: dict, folder_path: str, name: str) -> str:
    """Build source_path using the actual parent folder from the Graph item,
    preserving subfolders that the configured root folder misses."""
    actual_parent = _actual_parent_path(item)
    if actual_parent:
        return str(PurePosixPath(actual_parent) / name)
    return source_path(folder_path, name)


def _project_subfolder(item: dict, root_folder: str) -> Optional[str]:
    """Return the first subfolder name below root_folder, if any.
    e.g. root='Alleato Group/2026 Jobs', actual parent='Alleato Group/2026 Jobs/Vermillion Rise'
    → 'Vermillion Rise'"""
    actual_parent = _actual_parent_path(item)
    root = root_folder.strip("/")
    parent = actual_parent.strip("/")
    if root and parent.startswith(root + "/"):
        parts = [p for p in parent[len(root) + 1:].split("/") if p]
        return parts[0] if parts else None
    return None


def _strip_folder_prefix(folder_name: str) -> str:
    """Strip numeric job-number prefix like '25- 104 ' or '26-001 ' from folder names."""
    import re
    stripped = re.sub(r"^\d{2}-\s*\d+\s+", "", folder_name).strip()
    return stripped if stripped else folder_name


def _lookup_project_by_folder(supabase_client, folder_name: str) -> Optional[int]:
    """Case-insensitive project name match with fallback for numeric-prefix folder names."""
    try:
        res = (
            supabase_client.from_("projects")
            .select("id")
            .ilike("name", folder_name)
            .limit(1)
            .execute()
        )
        if res.data:
            return int(res.data[0]["id"])
    except Exception as exc:
        logger.warning("[OneDrive] folder→project lookup failed: %s", exc)
        return None

    # Strip numeric job-number prefix (e.g. "25- 104 Danville Theatre" → "Danville Theatre")
    # then do a partial contains match
    stripped = _strip_folder_prefix(folder_name)
    if stripped and stripped != folder_name:
        try:
            res = (
                supabase_client.from_("projects")
                .select("id")
                .ilike("name", f"%{stripped}%")
                .limit(1)
                .execute()
            )
            if res.data:
                logger.info("[OneDrive] folder '%s' matched project via stripped name '%s'", folder_name, stripped)
                return int(res.data[0]["id"])
        except Exception as exc:
            logger.warning("[OneDrive] stripped folder→project lookup failed: %s", exc)
    return None


def _assign_project(
    supabase_client,
    item: dict,
    root_folder: str,
    title: str,
    content: str,
    participants: list,
) -> tuple[Optional[int], str, float]:
    """Try folder-name match first, fall back to fuzzy inference."""
    subfolder = _project_subfolder(item, root_folder)
    if subfolder:
        project_id = _lookup_project_by_folder(supabase_client, subfolder)
        if project_id:
            logger.info("[OneDrive] Assigned project_id=%s via folder name '%s'", project_id, subfolder)
            return project_id, "folder_name", 1.0
    return infer_project_id(supabase_client, title=title, content=content, participants=participants)

# File types the canonical Graph ingestion path can materialize as text.
# A newly added extension also requires a deliberate historical cursor replay:
# Graph delta cursors do not resend files skipped before support was added.
SUPPORTED_EXTENSIONS = {
    ".pdf",
    ".docx",
    ".doc",
    ".txt",
    ".md",
    ".csv",
    ".xlsx",
    ".xlsm",
}
MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024  # 50 MB


def _fetch_rag_document_text(doc_id: str) -> str:
    try:
        row = (
            get_rag_read_client()
            .from_("rag_document_metadata")
            .select("content,raw_text")
            .eq("id", doc_id)
            .single()
            .execute()
            .data
            or {}
        )
        return str(row.get("content") or row.get("raw_text") or "")
    except Exception:
        return ""


def _extract_text_from_pdf(content: bytes) -> str:
    """Extract text from PDF bytes using pypdf with a PyMuPDF fallback."""
    pypdf_error: Exception | None = None
    try:
        import pypdf
        reader = pypdf.PdfReader(io.BytesIO(content))
        pages = []
        for page in reader.pages:
            text = page.extract_text() or ""
            if text.strip():
                pages.append(text)
        extracted = "\n\n".join(pages)
        if len(extracted.strip()) >= 50:
            return extracted
    except ImportError:
        _warn_once("pypdf_missing", "[OneDrive] pypdf not installed — skipping PDF extraction")
    except Exception as e:
        pypdf_error = e
        logger.warning("[OneDrive] pypdf PDF extraction failed, trying PyMuPDF fallback: %s", e)

    try:
        import fitz

        with fitz.open(stream=content, filetype="pdf") as document:
            pages = []
            for page in document:
                text = page.get_text("text") or ""
                if text.strip():
                    pages.append(text)
            extracted = "\n\n".join(pages)
            if extracted.strip():
                return extracted
    except ImportError:
        _warn_once("pymupdf_missing", "[OneDrive] PyMuPDF not installed — PDF fallback unavailable")
    except Exception as e:
        logger.warning("[OneDrive] PyMuPDF PDF extraction failed: %s", e)

    if pypdf_error:
        logger.warning("[OneDrive] PDF extraction failed after fallback: %s", pypdf_error)
    return ""


def _extract_text_from_docx(content: bytes) -> str:
    """Extract paragraphs, tables, headers, and footers from DOCX bytes."""
    try:
        import docx
        from docx.oxml.table import CT_Tbl
        from docx.oxml.text.paragraph import CT_P
        from docx.table import Table
        from docx.text.paragraph import Paragraph

        doc = docx.Document(io.BytesIO(content))
        parts: list[str] = []
        for child in doc.element.body.iterchildren():
            if isinstance(child, CT_P):
                text = Paragraph(child, doc).text.strip()
                if text:
                    parts.append(text)
            elif isinstance(child, CT_Tbl):
                table = Table(child, doc)
                parts.append("[Table]")
                for row_index, row in enumerate(table.rows, start=1):
                    for column_index, cell in enumerate(row.cells, start=1):
                        cell_text = "\n".join(
                            paragraph.text.strip()
                            for paragraph in cell.paragraphs
                            if paragraph.text.strip()
                        )
                        if cell_text:
                            parts.append(f"R{row_index}C{column_index}: {cell_text}")

        seen_section_text: set[tuple[str, str]] = set()
        for section in doc.sections:
            for label, container in (
                ("Header", section.header),
                ("First-page header", section.first_page_header),
                ("Even-page header", section.even_page_header),
                ("Footer", section.footer),
                ("First-page footer", section.first_page_footer),
                ("Even-page footer", section.even_page_footer),
            ):
                text = "\n".join(
                    paragraph.text.strip()
                    for paragraph in container.paragraphs
                    if paragraph.text.strip()
                )
                identity = (label, text)
                if text and identity not in seen_section_text:
                    parts.append(f"[{label}]\n{text}")
                    seen_section_text.add(identity)
        return "\n".join(parts)
    except ImportError:
        logger.warning("[OneDrive] python-docx not installed — skipping DOCX extraction")
        return ""
    except Exception as e:
        logger.warning(f"[OneDrive] DOCX extraction failed: {e}")
        return ""


def _workbook_cell_text(value: object) -> str:
    """Return a deterministic, readable representation of a workbook cell."""
    if isinstance(value, (datetime, date, time)):
        return value.isoformat()
    if isinstance(value, bytes):
        return value.decode("utf-8", errors="replace")
    return str(value).replace("\x00", "")


def _extract_text_from_openxml_workbook(content: bytes) -> str:
    """Materialize every non-empty XLSX/XLSM cell with worksheet provenance.

    The formula workbook preserves expressions while the data-only workbook
    supplies Excel's last cached result when one exists. No row, worksheet, or
    character cap is applied here; the downstream chunker owns model-sized
    segmentation of the complete materialized text.
    """
    try:
        from openpyxl import load_workbook
    except ImportError as exc:
        raise RuntimeError("openpyxl is required for XLSX/XLSM extraction") from exc

    formula_workbook = None
    value_workbook = None
    try:
        formula_workbook = load_workbook(
            io.BytesIO(content), read_only=True, data_only=False, keep_links=True
        )
        value_workbook = load_workbook(
            io.BytesIO(content), read_only=True, data_only=True, keep_links=True
        )

        lines: list[str] = []
        for formula_sheet in formula_workbook.worksheets:
            value_sheet = value_workbook[formula_sheet.title]
            lines.append(f"[Worksheet: {formula_sheet.title}]")
            for formula_row, value_row in zip(
                formula_sheet.iter_rows(), value_sheet.iter_rows()
            ):
                for formula_cell, value_cell in zip(formula_row, value_row):
                    formula_value = formula_cell.value
                    cached_value = value_cell.value
                    if formula_value is None and cached_value is None:
                        continue

                    coordinate = formula_cell.coordinate
                    if formula_cell.data_type == "f":
                        formula_text = _workbook_cell_text(formula_value)
                        if cached_value is None:
                            lines.append(f"{coordinate} formula: {formula_text}")
                        else:
                            lines.append(
                                f"{coordinate} formula: {formula_text} | cached value: "
                                f"{_workbook_cell_text(cached_value)}"
                            )
                    else:
                        lines.append(f"{coordinate}: {_workbook_cell_text(formula_value)}")
            lines.append("")
        return "\n".join(lines).strip()
    except Exception as exc:
        raise RuntimeError(f"XLSX/XLSM extraction failed: {exc}") from exc
    finally:
        if formula_workbook is not None:
            formula_workbook.close()
        if value_workbook is not None:
            value_workbook.close()


def _extract_text(content: bytes, extension: str) -> str:
    """Route to the right text extractor based on file extension."""
    ext = extension.lower()
    if ext == ".pdf":
        return _extract_text_from_pdf(content)
    elif ext in (".docx", ".doc"):
        return _extract_text_from_docx(content)
    elif ext in (".txt", ".md", ".csv"):
        return content.decode("utf-8", errors="replace")
    elif ext in (".xlsx", ".xlsm"):
        return _extract_text_from_openxml_workbook(content)
    return ""


def _promote_to_project_documents(
    *,
    supabase_client,
    project_id: Optional[int],
    source_system: str,
    owner: str,
    folder_path: str,
    item: dict,
    item_id: str,
    name: str,
    storage_path: str,
    uploaded_by: str,
) -> None:
    if not project_id:
        return

    payload = project_document_payload_from_graph_item(
        project_id=project_id,
        source_system=source_system,
        owner=owner,
        folder_path=folder_path,
        item=item,
        item_id=item_id,
        name=name,
        storage_path=storage_path,
        uploaded_by=uploaded_by,
    )
    upsert_project_document_by_source(supabase_client, payload)


def sync_onedrive_folder(
    supabase_client,
    user_email: str,
    folder_path: str = "/",
    delta_token: Optional[str] = None,
) -> tuple[int, str]:
    """
    Sync files from a user's OneDrive folder. Returns (count_synced, new_delta_token).

    Args:
        supabase_client: Supabase service client
        user_email: The user whose OneDrive to sync
        folder_path: Folder path within OneDrive (default: root)
        delta_token: Previous delta token for incremental sync
    """
    graph = get_graph_client()
    if not graph.is_configured():
        logger.warning("[OneDrive] Microsoft Graph not configured — skipping")
        return 0, delta_token or ""

    user_id = user_email
    if folder_path == "/" or not folder_path:
        delta_path = f"/users/{user_id}/drive/root/delta"
    else:
        # Graph path format: /drive/root:/full/path/here:/delta
        # Do NOT replace inner slashes — only wrap the whole path with colons
        clean_path = folder_path.strip("/")
        delta_path = f"/users/{user_id}/drive/root:/{clean_path}:/delta"

    try:
        items, new_delta_token = graph.get_delta(delta_path, delta_token)
    except Exception as e:
        raise RuntimeError(f"OneDrive delta query failed for {user_email}{folder_path}: {e}") from e

    synced = 0
    processed_files = 0
    capped = False
    max_files = _bounded_int_env("GRAPH_INGEST_MAX_FILES_PER_FOLDER", 250, 1, 5000)
    for item in items:
        if "@removed" in item:
            continue

        # Skip folders
        if "folder" in item:
            continue

        name = item.get("name", "")
        size = item.get("size", 0)

        # Check extension
        _, ext = os.path.splitext(name)
        ext = ext.lower()
        if ext not in SUPPORTED_EXTENSIONS:
            raise RuntimeError(
                f"OneDrive file type cannot be silently excluded: {name} "
                f"({ext or 'no extension'}); add an extractor or an explicit governed "
                "exclusion before advancing the delta cursor"
            )

        if size > MAX_FILE_SIZE_BYTES:
            raise RuntimeError(
                f"OneDrive file exceeds the {MAX_FILE_SIZE_BYTES}-byte ingestion limit: "
                f"{name} ({size} bytes); the delta cursor was not advanced"
            )

        item_id = item.get("id", "")
        doc_id = f"onedrive_{item_id}"
        storage_path = metadata_text_storage("onedrive", user_email, item_id, ext)

        # Check if already ingested
        existing = (
            supabase_client.from_("document_metadata")
            .select("id, project_id")
            .eq("id", doc_id)
            .limit(1)
            .execute()
        )
        if existing.data:
            existing_doc = existing.data[0]
            project_id = existing_doc.get("project_id")
            if not project_id:
                clean_content = _fetch_rag_document_text(doc_id)
                project_id, assignment_method, _ = _assign_project(
                    supabase_client,
                    item=item,
                    root_folder=folder_path,
                    title=name,
                    content=clean_content,
                    participants=[user_email],
                )
                if project_id:
                    supabase_client.from_("document_metadata").update({
                        "project_id": project_id,
                        "tags": ",".join(["onedrive", ext.lstrip("."), f"project_auto:{assignment_method}"]),
                    }).eq("id", doc_id).execute()
            _promote_to_project_documents(
                supabase_client=supabase_client,
                project_id=project_id,
                source_system="onedrive",
                owner=user_email,
                folder_path=folder_path,
                item=item,
                item_id=item_id,
                name=name,
                storage_path=storage_path,
                uploaded_by=user_email,
            )
            continue

        if processed_files >= max_files:
            capped = True
            logger.warning(
                "[OneDrive] File ingestion capped at %s new supported files for %s%s; "
                "preserving the prior delta cursor so remaining files replay next run",
                max_files,
                user_email,
                folder_path,
            )
            break
        processed_files += 1

        # Download file content
        download_url = item.get("@microsoft.graph.downloadUrl", "")
        if not download_url:
            try:
                file_data = graph.get(f"/users/{user_id}/drive/items/{item_id}")
                download_url = file_data.get("@microsoft.graph.downloadUrl", "")
            except Exception:
                continue

        if not download_url:
            continue

        try:
            raw_bytes = graph.download_bytes(download_url)
        except Exception as e:
            logger.warning(f"[OneDrive] Download failed for {name}: {e}")
            continue

        # Extract text (strip null bytes — postgres rejects \u0000 in text columns)
        text_content = _extract_text(raw_bytes, ext).replace("\x00", "")
        has_text = len(text_content.strip()) >= 50

        # Get file metadata
        modified = item.get("lastModifiedDateTime", datetime.now(timezone.utc).isoformat())
        web_url = item.get("webUrl", "")
        created_by = item.get("createdBy", {}).get("user", {}).get("displayName", user_email)

        # Only upload to storage when we have meaningful extracted text
        if has_text:
            try:
                storage_upload_with_retry(
                    supabase_client.storage.from_(DOCUMENT_BUCKET),
                    storage_path,
                    text_content.encode("utf-8"),
                    {"content-type": "text/plain", "upsert": "true"},
                )
            except Exception as e:
                logger.warning(f"[OneDrive] Storage upload failed for {name}: {e}")
        else:
            logger.debug(f"[OneDrive] Scanned/no-text file, saving metadata only: {name}")

        try:
            clean_content = text_content if has_text else ""
            # Always save metadata so the file appears in Files even when text extraction
            # failed (scanned PDFs, image-only documents, etc.)
            # Strip null bytes — PostgreSQL text columns reject \u0000
            project_id, assignment_method, assignment_confidence = _assign_project(
                supabase_client,
                item=item,
                root_folder=folder_path,
                title=name,
                content=clean_content,
                participants=[created_by, user_email],
            )
            SupabaseRagStore(supabase_client).upsert_document_metadata({
                "id": doc_id,
                "title": name,
                "source": "microsoft_graph",
                "category": "document",
                "type": "document",
                "content": clean_content or None,
                "date": modified[:10] if modified else None,
                "url": web_url,
                "participants": ", ".join([created_by, user_email]),
                "status": "raw_ingested" if has_text else "no_text",
                "tags": ",".join(["onedrive", ext.lstrip("."), f"project_auto:{assignment_method}" if project_id else "unassigned"]),
                "project_id": project_id,
                "source_system": "onedrive",
                "source_item_id": item_id,
                "source_drive_id": graph_id_safe((item.get("parentReference") or {}).get("driveId")),
                "source_path": _item_source_path(item, folder_path, name),
                "source_web_url": web_url or None,
                "source_etag": item.get("eTag") or item.get("cTag"),
                "source_last_modified_at": modified,
                "source_size": size,
                "storage_bucket": DOCUMENT_BUCKET if has_text else None,
                "file_path": storage_path if has_text else None,
                "source_metadata": {
                    "graph_source": "onedrive",
                    "graph_owner": user_email,
                    "source_folder": folder_path,
                },
            })
            _promote_to_project_documents(
                supabase_client=supabase_client,
                project_id=project_id,
                source_system="onedrive",
                owner=user_email,
                folder_path=folder_path,
                item=item,
                item_id=item_id,
                name=name,
                storage_path=storage_path,
                uploaded_by=user_email,
            )
            synced += 1
            if project_id:
                logger.info(
                    "[OneDrive] Auto-assigned project_id=%s for %s via %s (%.2f)",
                    project_id,
                    item_id,
                    assignment_method,
                    assignment_confidence,
                )
        except Exception as e:
            logger.warning(f"[OneDrive] Failed to insert metadata for {name}: {e}")

    logger.info(f"[OneDrive] Synced {synced} files for {user_email}{folder_path} (processed={processed_files})")
    return synced, (delta_token or "") if capped else new_delta_token


def sync_sharepoint_folder(
    supabase_client,
    site_hostname: str,
    site_name: str,
    folder_path: str = "/",
    delta_token: Optional[str] = None,
) -> SharePointSyncResult:
    """
    Sync files from a SharePoint site folder.

    A failed file keeps the previous delta cursor so the next scheduled pass
    automatically replays that delta batch. Existing documents are idempotent,
    so successfully processed files are not duplicated during recovery.

    Args:
        site_hostname: e.g. "alleato.sharepoint.com"
        site_name: e.g. "AlleatoGroup"
        folder_path: Folder path within the site drive (e.g. "/SOP" or "/")
        delta_token: Previous delta token for incremental sync
    """
    graph = get_graph_client()
    if not graph.is_configured():
        logger.warning("[SharePoint] Microsoft Graph not configured — skipping")
        return SharePointSyncResult(0, delta_token or "")

    site_lookup = graph.get(f"/sites/{site_hostname}:/sites/{site_name}")
    site_id = str(site_lookup.get("id") or "").strip()
    if not site_id:
        logger.error("[SharePoint] Could not resolve site id for %s:/sites/%s", site_hostname, site_name)
        return SharePointSyncResult(0, delta_token or "")

    if folder_path == "/" or not folder_path:
        delta_path = f"/sites/{site_id}/drive/root/delta"
    else:
        clean_path = folder_path.strip("/")
        delta_path = f"/sites/{site_id}/drive/root:/{clean_path}:/delta"

    try:
        items, new_delta_token = graph.get_delta(delta_path, delta_token)
    except Exception as e:
        raise RuntimeError(f"SharePoint delta query failed for {site_name}{folder_path}: {e}") from e

    synced = 0
    failed = 0
    processed_files = 0
    capped = False
    max_files = _bounded_int_env("GRAPH_INGEST_MAX_FILES_PER_FOLDER", 250, 1, 5000)
    for item in items:
        if "@removed" in item or "folder" in item:
            continue

        name = item.get("name", "")
        size = item.get("size", 0)
        _, ext = os.path.splitext(name)
        ext = ext.lower()
        if ext not in SUPPORTED_EXTENSIONS:
            failed += 1
            logger.error(
                "[SharePoint] Unsupported file type cannot be silently excluded: %s (%s). "
                "Add an extractor or an explicit governed exclusion before advancing the delta cursor.",
                name,
                ext or "no extension",
            )
            continue
        if size > MAX_FILE_SIZE_BYTES:
            failed += 1
            logger.error(
                "[SharePoint] Supported file exceeds the %d-byte ingestion limit: %s (%d bytes)",
                MAX_FILE_SIZE_BYTES,
                name,
                size,
            )
            continue

        item_id = item.get("id", "")
        doc_id = f"sharepoint_{item_id}"
        storage_path = metadata_text_storage("sharepoint", site_name, item_id, ext)

        existing = (
            supabase_client.from_("document_metadata")
            .select("id, project_id")
            .eq("id", doc_id)
            .limit(1)
            .execute()
        )
        if existing.data:
            existing_doc = existing.data[0]
            project_id = existing_doc.get("project_id")
            if not project_id:
                clean_content = _fetch_rag_document_text(doc_id)
                project_id, assignment_method, _ = _assign_project(
                    supabase_client,
                    item=item,
                    root_folder=folder_path,
                    title=name,
                    content=clean_content,
                    participants=[site_name],
                )
                if project_id:
                    supabase_client.from_("document_metadata").update({
                        "project_id": project_id,
                        "tags": ",".join(["sharepoint", site_name.lower(), ext.lstrip("."), f"project_auto:{assignment_method}"]),
                    }).eq("id", doc_id).execute()
            _promote_to_project_documents(
                supabase_client=supabase_client,
                project_id=project_id,
                source_system="sharepoint",
                owner=site_name,
                folder_path=folder_path,
                item=item,
                item_id=item_id,
                name=name,
                storage_path=storage_path,
                uploaded_by="SharePoint sync",
            )
            continue

        if processed_files >= max_files:
            capped = True
            logger.warning(
                "[SharePoint] File ingestion capped at %s new supported files for %s%s; "
                "preserving the prior delta cursor so remaining files replay next run",
                max_files,
                site_name,
                folder_path,
            )
            break
        processed_files += 1

        download_url = item.get("@microsoft.graph.downloadUrl", "")
        if not download_url:
            try:
                file_data = graph.get(f"/sites/{site_id}/drive/items/{item_id}")
                download_url = file_data.get("@microsoft.graph.downloadUrl", "")
            except Exception as exc:
                failed += 1
                logger.error("[SharePoint] Could not get a download URL for %s: %s", name, exc)
                continue

        if not download_url:
            failed += 1
            logger.error("[SharePoint] No download URL returned for %s", name)
            continue

        try:
            raw_bytes = graph.download_bytes(download_url)
        except Exception as e:
            failed += 1
            logger.error("[SharePoint] Download failed for %s: %s", name, e)
            continue

        text_content = _extract_text(raw_bytes, ext).replace("\x00", "")
        if len(text_content.strip()) < 50:
            failed += 1
            logger.error(
                "[SharePoint] Text extraction produced insufficient content for supported file %s (%s)",
                name,
                ext,
            )
            continue

        modified = item.get("lastModifiedDateTime", datetime.now(timezone.utc).isoformat())
        web_url = item.get("webUrl", "")
        created_by = item.get("createdBy", {}).get("user", {}).get("displayName", site_name)

        try:
            storage_upload_with_retry(
                supabase_client.storage.from_(DOCUMENT_BUCKET),
                storage_path,
                text_content.encode("utf-8"),
                {"content-type": "text/plain", "upsert": "true"},
            )
        except Exception as e:
            failed += 1
            logger.error("[SharePoint] Storage upload failed for %s: %s", name, e)
            continue

        try:
            clean_content = text_content
            project_id, assignment_method, _ = _assign_project(
                supabase_client,
                item=item,
                root_folder=folder_path,
                title=name,
                content=clean_content,
                participants=[created_by, site_name],
            )
            SupabaseRagStore(supabase_client).upsert_document_metadata({
                "id": doc_id,
                "title": name,
                "source": "microsoft_graph",
                "category": "document",
                "type": "document",
                "content": clean_content,
                "date": modified[:10] if modified else None,
                "url": web_url,
                "participants": ", ".join([created_by, site_name]),
                "status": "raw_ingested",
                "tags": ",".join(["sharepoint", site_name.lower(), ext.lstrip("."), f"project_auto:{assignment_method}" if project_id else "unassigned"]),
                "project_id": project_id,
                "source_system": "sharepoint",
                "source_item_id": item_id,
                "source_drive_id": graph_id_safe((item.get("parentReference") or {}).get("driveId")),
                "source_site_id": graph_id_safe((item.get("parentReference") or {}).get("siteId")),
                "source_path": _item_source_path(item, folder_path, name),
                "source_web_url": web_url or None,
                "source_etag": item.get("eTag") or item.get("cTag"),
                "source_last_modified_at": modified,
                "source_size": size,
                "storage_bucket": DOCUMENT_BUCKET,
                "file_path": storage_path,
                "source_metadata": {
                    "graph_source": "sharepoint",
                    "graph_owner": site_name,
                    "source_folder": folder_path,
                },
            })
            _promote_to_project_documents(
                supabase_client=supabase_client,
                project_id=project_id,
                source_system="sharepoint",
                owner=site_name,
                folder_path=folder_path,
                item=item,
                item_id=item_id,
                name=name,
                storage_path=storage_path,
                uploaded_by="SharePoint sync",
            )
            synced += 1
        except Exception as e:
            failed += 1
            logger.error("[SharePoint] Failed to insert metadata for %s: %s", name, e)

    retry_required = failed > 0 or capped
    if failed > 0:
        retry_reason = (
            f"{failed} SharePoint file(s) failed; the prior delta cursor was preserved for automatic retry."
        )
    elif capped:
        retry_reason = (
            f"SharePoint ingestion reached its {max_files}-new-file safety limit; "
            "the prior delta cursor was preserved so remaining files replay next run."
        )
    else:
        retry_reason = None
    saved_delta_token = (delta_token or "") if retry_required else new_delta_token
    if retry_required:
        logger.error(
            "[SharePoint] Recovery required in %s%s: %s",
            site_name,
            folder_path,
            retry_reason,
        )
    logger.info(
        "[SharePoint] Synced %d files from %s%s (processed=%d, failed=%d)",
        synced,
        site_name,
        folder_path,
        processed_files,
        failed,
    )
    return SharePointSyncResult(
        items_synced=synced,
        delta_token=saved_delta_token,
        items_failed=failed,
        retry_required=retry_required,
        retry_reason=retry_reason,
    )
