#!/usr/bin/env python3
"""Stage an immutable FMDS 8-34 revision in the dedicated ASRS Supabase project.

The command is intentionally revision-scoped and resumable. It never activates a
revision or deletes an older corpus. Native PDF text is authoritative for the
first pass; rendered pages and structured table/figure evidence are retained for
visual review before activation.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import fitz
from supabase import Client, create_client

from fmds_corpus_config import FmdsCorpusConfig, FMDS0834_2026_04, load_config
from fmds_embedding_utils import batches, embedding_client, required_env, split_long_text


ACTIVE_CONFIG: FmdsCorpusConfig = FMDS0834_2026_04
DOCUMENT_CODE = ACTIVE_CONFIG.document_code
REVISION_LABEL = ACTIVE_CONFIG.revision_label
PUBLICATION_DATE = ACTIVE_CONFIG.publication_date
EXPECTED_PAGE_COUNT = ACTIVE_CONFIG.expected_page_count
BUCKET = "fmds-source-evidence"
COMMAND_VERSION = "2026-07-21.1"
EMBEDDING_DIMENSIONS = 3072
DEFAULT_CHUNK_CHARS = 1_800
EMBEDDING_BATCH_SIZE = 32

CAPTION_RE = re.compile(
    r"^\s*(?P<kind>Table|Figure|Fig\.)\s+"
    r"(?P<identifier>[A-Z]?\d+(?:\.\d+)*(?:\([a-z0-9]+\))?)"
    r"\.?\s*(?P<title>.*)",
    re.IGNORECASE | re.DOTALL,
)
CLAUSE_RE = re.compile(r"^(?P<clause>\d+(?:\.\d+){1,8}(?:\([a-z0-9]+\))?)\b")
HEADING_RE = re.compile(
    r"^(?:\d+(?:\.\d+){0,8}(?:\([a-z0-9]+\))?|APPENDIX\s+[A-Z])\s+\S+",
    re.IGNORECASE,
)
RUNNING_LINE_RE = re.compile(r"$^")


def apply_document_config(config: FmdsCorpusConfig) -> None:
    """Set validated source identity before any database or storage write."""
    global ACTIVE_CONFIG, DOCUMENT_CODE, REVISION_LABEL, PUBLICATION_DATE, EXPECTED_PAGE_COUNT, RUNNING_LINE_RE
    ACTIVE_CONFIG = config
    DOCUMENT_CODE = config.document_code
    REVISION_LABEL = config.revision_label
    PUBLICATION_DATE = config.publication_date
    EXPECTED_PAGE_COUNT = config.expected_page_count
    running_patterns = "|".join(config.running_line_patterns)
    RUNNING_LINE_RE = re.compile(
        rf"^(?:{running_patterns}|Page\s+\d+|©\s*\d{{4}}\s+Factory Mutual Insurance Company).*",
        re.IGNORECASE,
    )


apply_document_config(ACTIVE_CONFIG)


@dataclass(frozen=True)
class CaptionEvidence:
    kind: str
    identifier: str
    title: str
    page_number: int
    bbox: tuple[float, float, float, float]
    table_bbox: tuple[float, float, float, float] | None = None
    table_rows: list[list[str | None]] | None = None


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("pdf", type=Path, help="Path to the FMDS 8-34 April 2026 PDF")
    parser.add_argument(
        "--document-config",
        default="fmds0834-2026-04",
        help="Validated document/revision identity from fmds_corpus_config.py",
    )
    parser.add_argument("--skip-render-upload", action="store_true")
    parser.add_argument("--skip-embeddings", action="store_true")
    parser.add_argument("--embedding-batch-size", type=int, default=EMBEDDING_BATCH_SIZE)
    return parser.parse_args()


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def upload_bytes(client: Client, path: str, content: bytes, content_type: str) -> None:
    options = {"content-type": content_type, "cache-control": "3600", "upsert": "true"}
    client.storage.from_(BUCKET).upload(path, content, options)


def normalize_chunk_text(text: str) -> str:
    lines: list[str] = []
    for raw_line in text.replace("\u00ad", "").splitlines():
        line = re.sub(r"[ \t]+", " ", raw_line).strip()
        if not line or RUNNING_LINE_RE.match(line):
            continue
        lines.append(line)
    return "\n".join(lines).strip()


def chunk_page(text: str, max_chars: int = DEFAULT_CHUNK_CHARS) -> list[dict[str, Any]]:
    normalized = normalize_chunk_text(text)
    if not normalized:
        return []

    paragraphs = [part.strip() for part in re.split(r"\n{2,}", normalized) if part.strip()]
    expanded: list[str] = []
    for paragraph in paragraphs:
        expanded.extend(split_long_text(paragraph, max_chars))

    combined: list[str] = []
    current = ""
    for paragraph in expanded:
        candidate = f"{current}\n\n{paragraph}".strip() if current else paragraph
        if current and len(candidate) > max_chars:
            combined.append(current)
            current = paragraph
        else:
            current = candidate
    if current:
        combined.append(current)

    chunks: list[dict[str, Any]] = []
    section_path: str | None = None
    for content in combined:
        first_line = content.splitlines()[0].strip()
        clause_match = CLAUSE_RE.match(first_line)
        if HEADING_RE.match(first_line) and len(first_line) <= 240:
            section_path = first_line
        lowered = first_line.lower()
        if lowered.startswith("table "):
            chunk_type = "table_text"
        elif lowered.startswith(("figure ", "fig. ")):
            chunk_type = "figure_caption"
        elif lowered.startswith("appendix "):
            chunk_type = "appendix"
        elif HEADING_RE.match(first_line) and len(content) < 500:
            chunk_type = "heading"
        else:
            chunk_type = "narrative"
        chunks.append(
            {
                "content": content,
                "chunk_type": chunk_type,
                "section_path": section_path,
                "clause_reference": clause_match.group("clause") if clause_match else None,
            }
        )
    return chunks


def extract_captions(page: fitz.Page, page_number: int) -> list[CaptionEvidence]:
    # Pages 1-7 contain contents/lists; substantive requirements begin on PDF page 8.
    if page_number <= 7:
        return []

    detected_tables: list[Any] = []
    caption_blocks: list[tuple[re.Match[str], tuple[float, float, float, float], str]] = []
    for block in page.get_text("blocks", sort=True):
        text = " ".join(block[4].split())
        match = CAPTION_RE.match(text)
        if not match:
            continue
        raw_kind = match.group("kind")
        accepted_labels = ACTIVE_CONFIG.accepted_figure_caption_labels
        if (
            raw_kind.lower() != "table"
            and accepted_labels is not None
            and raw_kind.casefold() not in {label.casefold() for label in accepted_labels}
        ):
            # Fail closed on revision-specific caption vocabulary. FMDS0834
            # April 2026 has 60 real captions beginning "Fig."; its only full
            # "Figure" block is a table-cell false positive on PDF page 43.
            continue
        caption_blocks.append((match, tuple(float(value) for value in block[:4]), text))

    if any(match.group("kind").lower() == "table" for match, _, _ in caption_blocks):
        try:
            detected_tables = list(page.find_tables().tables)
        except Exception as exc:  # visual review remains mandatory even when detection succeeds
            print(f"warning: page {page_number} table grid detection failed: {exc}", file=sys.stderr)

    evidence: list[CaptionEvidence] = []
    used_table_indexes: set[int] = set()
    for match, caption_bbox, source_text in caption_blocks:
        kind = "table" if match.group("kind").lower() == "table" else "figure"
        identifier = match.group("identifier").rstrip(".")
        title = match.group("title").strip().lstrip(". ") or source_text
        associated_bbox = None
        associated_rows = None
        if kind == "table" and detected_tables:
            available = [
                (index, table)
                for index, table in enumerate(detected_tables)
                if index not in used_table_indexes
            ]
            if available:
                index, table = min(
                    available,
                    key=lambda item: abs(float(item[1].bbox[1]) - caption_bbox[1]),
                )
                used_table_indexes.add(index)
                associated_bbox = tuple(float(value) for value in table.bbox)
                associated_rows = table.extract()
        evidence.append(
            CaptionEvidence(
                kind=kind,
                identifier=identifier,
                title=title,
                page_number=page_number,
                bbox=caption_bbox,
                table_bbox=associated_bbox,
                table_rows=associated_rows,
            )
        )
    return evidence


def validate_document_caption_inventory(document: fitz.Document) -> dict[str, int]:
    """Fail before provider writes when the immutable source inventory drifts."""
    captions = [
        caption
        for index, page in enumerate(document)
        for caption in extract_captions(page, index + 1)
    ]
    counts = {
        "tables": sum(caption.kind == "table" for caption in captions),
        "figures": sum(caption.kind == "figure" for caption in captions),
    }
    expected = {
        "tables": ACTIVE_CONFIG.expected_table_count,
        "figures": ACTIVE_CONFIG.expected_figure_count,
    }
    mismatches = {
        key: (expected[key], counts[key])
        for key in counts
        if expected[key] is not None and counts[key] != expected[key]
    }
    if mismatches:
        raise RuntimeError(
            f"Caption inventory mismatch for {DOCUMENT_CODE} {REVISION_LABEL}: {mismatches}"
        )
    return counts


def create_or_validate_revision(
    client: Client,
    source_path: Path,
    source_sha256: str,
    source_storage_path: str,
) -> dict[str, Any]:
    existing = (
        client.table("fmds_corpus_revisions")
        .select("*")
        .eq("document_code", DOCUMENT_CODE)
        .eq("revision_label", REVISION_LABEL)
        .execute()
        .data
    )
    if existing:
        revision = existing[0]
        if revision["source_sha256"] != source_sha256:
            raise RuntimeError(
                "A 2026-04 revision already exists with a different source hash; "
                "refusing to merge source editions"
            )
        if revision["status"] != "staging":
            raise RuntimeError(
                f"Revision {revision['id']} is {revision['status']}; ingestion only writes staging revisions"
            )
        client.table("fmds_corpus_revisions").update(
            {
                "source_storage_path": source_storage_path,
                "extraction_model": "pymupdf-native+visual-evidence-v1",
                "metadata": {
                    **(revision.get("metadata") or {}),
                    "ingestion_command_version": COMMAND_VERSION,
                },
            }
        ).eq("id", revision["id"]).execute()
        return revision

    inserted = (
        client.table("fmds_corpus_revisions")
        .insert(
            {
                "document_code": DOCUMENT_CODE,
                "revision_label": REVISION_LABEL,
                "publication_date": PUBLICATION_DATE,
                "source_file_name": source_path.name,
                "source_sha256": source_sha256,
                "source_page_count": EXPECTED_PAGE_COUNT,
                "source_storage_path": source_storage_path,
                "status": "staging",
                "extraction_model": "pymupdf-native+visual-evidence-v1",
                "embedding_model": "text-embedding-3-large",
                "embedding_dimensions": EMBEDDING_DIMENSIONS,
                "metadata": {"ingestion_command_version": COMMAND_VERSION},
            }
        )
        .execute()
        .data[0]
    )
    return inserted


def stage_pages_and_evidence(
    client: Client,
    document: fitz.Document,
    revision: dict[str, Any],
    storage_prefix: str,
    render_upload: bool,
) -> tuple[dict[int, str], list[CaptionEvidence]]:
    page_ids: dict[int, str] = {}
    all_captions: list[CaptionEvidence] = []
    for index, page in enumerate(document):
        page_number = index + 1
        native_text = page.get_text("text", sort=True)
        page_image_path = f"{storage_prefix}/pages/page-{page_number:03d}.png"
        rendered_hash = None
        if render_upload:
            pixmap = page.get_pixmap(matrix=fitz.Matrix(2, 2), alpha=False)
            png = pixmap.tobytes("png")
            rendered_hash = sha256_bytes(png)
            upload_bytes(client, page_image_path, png, "image/png")

        status = "extracted" if native_text.strip() else "no_text"
        row = {
            "revision_id": revision["id"],
            "page_number": page_number,
            "native_text": native_text,
            "native_text_sha256": sha256_bytes(native_text.encode("utf-8")),
            "native_char_count": len(native_text),
            "rendered_image_path": page_image_path if render_upload else None,
            "rendered_image_sha256": rendered_hash,
            "width_points": float(page.rect.width),
            "height_points": float(page.rect.height),
            "extraction_status": status,
            "extraction_confidence": 1.0 if status == "extracted" else 0.0,
            "review_status": "not_required" if status == "extracted" else "needs_review",
            "extraction_error": None,
        }
        result = (
            client.table("fmds_pages")
            .upsert(row, on_conflict="revision_id,page_number")
            .execute()
            .data[0]
        )
        page_ids[page_number] = result["id"]
        all_captions.extend(extract_captions(page, page_number))
        if page_number == 1 or page_number % 10 == 0 or page_number == document.page_count:
            print(f"pages: {page_number}/{document.page_count}")
    return page_ids, all_captions


def stage_chunks(
    client: Client,
    document: fitz.Document,
    revision: dict[str, Any],
    page_ids: dict[int, str],
) -> int:
    rows: list[dict[str, Any]] = []
    for index, page in enumerate(document):
        page_number = index + 1
        for chunk_index, chunk in enumerate(chunk_page(page.get_text("text", sort=True))):
            content = chunk["content"]
            rows.append(
                {
                    "revision_id": revision["id"],
                    "page_id": page_ids[page_number],
                    "page_number": page_number,
                    "chunk_index": chunk_index,
                    "chunk_type": chunk["chunk_type"],
                    "section_path": chunk["section_path"],
                    "clause_reference": chunk["clause_reference"],
                    "content": content,
                    "content_sha256": sha256_bytes(content.encode("utf-8")),
                    "citation_label": f"{ACTIVE_CONFIG.display_name} ({REVISION_LABEL}), PDF page {page_number}",
                    "native_char_count": len(content),
                }
            )
    for batch in batches(rows, 100):
        client.table("fmds_chunks").upsert(
            list(batch), on_conflict="revision_id,page_number,chunk_index"
        ).execute()
    print(f"chunks: {len(rows)} staged")
    return len(rows)


def stage_tables_and_figures(
    client: Client,
    revision: dict[str, Any],
    captions: list[CaptionEvidence],
    source_sha256: str,
    storage_prefix: str,
) -> tuple[int, int, int]:
    table_count = 0
    figure_count = 0
    cell_count = 0
    for caption in captions:
        evidence_path = f"{storage_prefix}/pages/page-{caption.page_number:03d}.png"
        if caption.kind == "table":
            structure = {
                "rows": caption.table_rows or [],
                "grid_detected": caption.table_bbox is not None,
                "requires_visual_validation": True,
            }
            table = (
                client.table("fmds_tables")
                .upsert(
                    {
                        "revision_id": revision["id"],
                        "table_identifier": caption.identifier,
                        "title": caption.title,
                        "page_start": caption.page_number,
                        "page_end": caption.page_number,
                        "caption_text": f"Table {caption.identifier}. {caption.title}",
                        "bounding_box": {
                            "caption": list(caption.bbox),
                            "table": list(caption.table_bbox) if caption.table_bbox else None,
                        },
                        "evidence_image_path": evidence_path,
                        "extracted_structure": structure,
                        "extraction_method": "pymupdf-caption+grid-v1",
                        "extraction_confidence": 0.75 if caption.table_bbox else 0.35,
                        "review_status": "needs_review",
                        "source_sha256": source_sha256,
                    },
                    on_conflict="revision_id,table_identifier,page_start",
                )
                .execute()
                .data[0]
            )
            if caption.table_rows:
                existing_cells = (
                    client.table("fmds_table_cells")
                    .select("id", count="exact")
                    .eq("table_id", table["id"])
                    .limit(1)
                    .execute()
                )
                if (existing_cells.count or 0) == 0:
                    cells = []
                    for row_index, values in enumerate(caption.table_rows):
                        for column_index, raw_value in enumerate(values):
                            cells.append(
                                {
                                    "table_id": table["id"],
                                    "row_index": row_index,
                                    "column_index": column_index,
                                    "raw_value": raw_value,
                                    "evidence": {"page_number": caption.page_number},
                                }
                            )
                    for batch in batches(cells, 250):
                        client.table("fmds_table_cells").insert(list(batch)).execute()
                    cell_count += len(cells)
            table_count += 1
        else:
            client.table("fmds_figures").upsert(
                {
                    "revision_id": revision["id"],
                    "figure_identifier": caption.identifier,
                    "title": caption.title,
                    "page_number": caption.page_number,
                    "caption_text": f"Figure {caption.identifier}. {caption.title}",
                    "bounding_box": {"caption": list(caption.bbox)},
                    "evidence_image_path": evidence_path,
                    "extracted_description": {"requires_visual_validation": True},
                    "extraction_method": "pymupdf-caption-inventory-v1",
                    "extraction_confidence": 0.4,
                    "review_status": "needs_review",
                    "source_sha256": source_sha256,
                },
                on_conflict="revision_id,figure_identifier,page_number",
            ).execute()
            figure_count += 1
    print(f"evidence: {table_count} table occurrences, {figure_count} figure occurrences")
    return table_count, figure_count, cell_count


def fetch_unembedded_chunks(client: Client, revision_id: str) -> list[dict[str, str]]:
    rows: list[dict[str, str]] = []
    start = 0
    page_size = 500
    while True:
        batch = (
            client.table("fmds_chunks")
            .select("id,content")
            .eq("revision_id", revision_id)
            .neq("embedding_status", "embedded")
            .order("page_number")
            .order("chunk_index")
            .range(start, start + page_size - 1)
            .execute()
            .data
        )
        rows.extend(batch)
        if len(batch) < page_size:
            break
        start += page_size
    return rows


def stage_embeddings(client: Client, revision: dict[str, Any], batch_size: int) -> int:
    pending = fetch_unembedded_chunks(client, revision["id"])
    if not pending:
        print("embeddings: all chunks already embedded")
        return 0
    openai_client, provider_model, provider = embedding_client()
    completed = 0
    for batch_number, batch in enumerate(batches(pending, batch_size), start=1):
        inputs = [row["content"] for row in batch]
        last_error: Exception | None = None
        for attempt in range(1, 5):
            try:
                response = openai_client.embeddings.create(
                    model=provider_model,
                    input=inputs,
                    dimensions=EMBEDDING_DIMENSIONS,
                )
                vectors = [item.embedding for item in response.data]
                if len(vectors) != len(batch):
                    raise RuntimeError(
                        f"Embedding provider returned {len(vectors)} vectors for {len(batch)} chunks"
                    )
                payload = []
                for row, vector in zip(batch, vectors, strict=True):
                    if len(vector) != EMBEDDING_DIMENSIONS:
                        raise RuntimeError(
                            f"Chunk {row['id']} returned embedding dimension {len(vector)}, expected 3072"
                        )
                    payload.append(
                        {
                            "id": row["id"],
                            "embedding": "[" + ",".join(f"{value:.8g}" for value in vector) + "]",
                        }
                    )
                result = client.rpc(
                    "store_fmds_chunk_embeddings",
                    {
                        "requested_revision_id": revision["id"],
                        "embedding_rows": payload,
                        "requested_model": "text-embedding-3-large",
                    },
                ).execute()
                if result.data != len(payload):
                    raise RuntimeError(
                        f"Embedding write acknowledged {result.data} rows, expected {len(payload)}"
                    )
                completed += len(payload)
                print(
                    f"embeddings: {completed}/{len(pending)} "
                    f"(batch {batch_number}, provider {provider})"
                )
                last_error = None
                break
            except Exception as exc:
                last_error = exc
                if attempt == 4:
                    break
                time.sleep(2**attempt)
        if last_error:
            failed_ids = [row["id"] for row in batch]
            client.table("fmds_chunks").update(
                {"embedding_status": "failed", "embedding_error": str(last_error)[:1000]}
            ).in_("id", failed_ids).execute()
            raise RuntimeError(
                f"Embedding batch {batch_number} failed after 4 attempts: {last_error}"
            ) from last_error
    return completed


def main() -> int:
    args = parse_args()
    apply_document_config(load_config(args.document_config))
    if not args.pdf.is_file():
        raise RuntimeError(f"PDF not found: {args.pdf}")

    source_sha256 = sha256_file(args.pdf)
    if (
        ACTIVE_CONFIG.expected_source_sha256
        and source_sha256 != ACTIVE_CONFIG.expected_source_sha256
    ):
        raise RuntimeError(
            f"Source hash mismatch for {DOCUMENT_CODE} {REVISION_LABEL}: "
            f"expected {ACTIVE_CONFIG.expected_source_sha256}, found {source_sha256}"
        )
    document = fitz.open(args.pdf)
    if document.page_count != EXPECTED_PAGE_COUNT:
        raise RuntimeError(
            f"Source page count mismatch: expected {EXPECTED_PAGE_COUNT}, found {document.page_count}"
        )
    caption_inventory = validate_document_caption_inventory(document)
    print(f"caption preflight: {caption_inventory}")

    supabase = create_client(
        required_env("SUPABASE_ASRS_URL"), required_env("SUPABASE_ASRS_SECRET_KEY")
    )
    storage_prefix = f"{DOCUMENT_CODE}/{REVISION_LABEL}/{source_sha256[:16]}"
    source_storage_path = f"{storage_prefix}/source/{args.pdf.name}"
    upload_bytes(supabase, source_storage_path, args.pdf.read_bytes(), "application/pdf")
    revision = create_or_validate_revision(
        supabase, args.pdf, source_sha256, source_storage_path
    )
    run = (
        supabase.table("fmds_ingestion_runs")
        .insert(
            {
                "revision_id": revision["id"],
                "stage": "full-corpus-staging",
                "command_version": COMMAND_VERSION,
                "source_sha256": source_sha256,
            }
        )
        .execute()
        .data[0]
    )

    try:
        page_ids, captions = stage_pages_and_evidence(
            supabase,
            document,
            revision,
            storage_prefix,
            render_upload=not args.skip_render_upload,
        )
        chunk_count = stage_chunks(supabase, document, revision, page_ids)
        table_count, figure_count, cell_count = stage_tables_and_figures(
            supabase, revision, captions, source_sha256, storage_prefix
        )
        embedded_now = 0
        if not args.skip_embeddings:
            embedded_now = stage_embeddings(supabase, revision, args.embedding_batch_size)
        coverage = (
            supabase.table("fmds_revision_coverage")
            .select("*")
            .eq("revision_id", revision["id"])
            .single()
            .execute()
            .data
        )
        counts = {
            "pages": len(page_ids),
            "chunks": chunk_count,
            "tables": table_count,
            "figures": figure_count,
            "table_cells_created": cell_count,
            "embeddings_created": embedded_now,
            "coverage": coverage,
        }
        supabase.table("fmds_ingestion_runs").update(
            {
                "status": "succeeded",
                "counts": counts,
                "finished_at": utc_now(),
            }
        ).eq("id", run["id"]).execute()
        print(json.dumps({"revision_id": revision["id"], **counts}, indent=2))
        return 0
    except Exception as exc:
        supabase.table("fmds_ingestion_runs").update(
            {
                "status": "failed",
                "errors": [{"message": str(exc), "type": type(exc).__name__}],
                "finished_at": utc_now(),
            }
        ).eq("id", run["id"]).execute()
        raise


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        print(f"fatal: {error}", file=sys.stderr)
        raise