#!/usr/bin/env python3
"""Prepare a table/figure-heavy PDF for Alleato RAG ingestion.

This script converts a source PDF into RAG-friendly artifacts:

* layout-preserved text
* PyMuPDF table extracts as CSV + Markdown
* rendered figure-heavy pages
* optional vision captions for rendered figure pages
* ready-to-ingest folders for scripts/ingestion/ingest_local_documents.py

The output is intentionally file-based so ingestion can remain owned by the
existing local ingestion script and backend pipeline.

Example:
  python3 scripts/ingestion/prepare_pdf_for_rag.py \
    "/Users/meganharrison/Downloads/FMDS0834 (1).pdf" \
    --output-root tmp/rag-upload-fmds0834 \
    --with-vision-captions

Then ingest:
  DOC_SEGMENT_USE_LLM=false PYTHONPATH="$PWD/backend" \
    python3 scripts/ingestion/ingest_local_documents.py \
    --source-dir tmp/rag-upload-fmds0834/ingest --process-now

  DOC_SEGMENT_USE_LLM=false PYTHONPATH="$PWD/backend" \
    python3 scripts/ingestion/ingest_local_documents.py \
    --source-dir tmp/rag-upload-fmds0834/caption-ingest --process-now
"""

from __future__ import annotations

import argparse
import base64
import csv
import json
import re
import shutil
import subprocess
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple

try:
    import fitz
except ImportError as exc:  # pragma: no cover - environment setup guard
    raise SystemExit(
        "PyMuPDF is required. Install backend requirements or `pip install pymupdf`."
    ) from exc


FIGURE_PATTERN = re.compile(r"\bFig\.\s*[^\n]+", re.IGNORECASE)
TABLE_CAPTION_PATTERN = re.compile(r"\bTable\s+\d+(?:\.\d+)*[^\n]*", re.IGNORECASE)
PAGE_HEADING_PATTERN = re.compile(r"\n\n---\n\n## Page ")


@dataclass(frozen=True)
class TableExtract:
    page: int
    index: int
    rows: int
    cols: int
    csv_path: Path
    markdown_path: Path
    nearby_captions: List[str]


@dataclass(frozen=True)
class PreparedPdf:
    page_count: int
    layout_text_path: Path
    structured_markdown_path: Path
    manifest_path: Path
    table_count: int
    figure_page_count: int
    caption_markdown_path: Optional[Path]
    caption_json_path: Optional[Path]


def sanitize_slug(value: str) -> str:
    slug = re.sub(r"[^A-Za-z0-9._-]+", "-", value.strip())
    slug = re.sub(r"-+", "-", slug).strip("-._")
    return slug or "document"


def run_pdftotext(pdf_path: Path, output_path: Path) -> bool:
    """Write layout text with pdftotext when available."""

    binary = shutil.which("pdftotext")
    if not binary:
        return False
    subprocess.run([binary, "-layout", str(pdf_path), str(output_path)], check=True)
    return True


def extract_text_with_pymupdf(doc: fitz.Document, output_path: Path) -> None:
    pages = [page.get_text("text") for page in doc]
    output_path.write_text("\f".join(pages), encoding="utf-8")


def split_layout_pages(layout_text_path: Path) -> List[str]:
    return layout_text_path.read_text(encoding="utf-8", errors="replace").split("\f")


def markdown_table(rows: List[List[str]]) -> str:
    header = rows[0]
    lines = [
        "| " + " | ".join(header) + " |",
        "| " + " | ".join(["---"] * len(header)) + " |",
    ]
    for row in rows[1:]:
        lines.append("| " + " | ".join(row) + " |")
    return "\n".join(lines)


def clean_table_rows(data: Sequence[Sequence[Any]]) -> List[List[str]]:
    cleaned: List[List[str]] = []
    for row in data:
        values = [" ".join(str(cell or "").split()) for cell in row]
        if any(values):
            cleaned.append(values)
    if len(cleaned) < 2:
        return []
    max_cols = max(len(row) for row in cleaned)
    return [row + [""] * (max_cols - len(row)) for row in cleaned]


def extract_page_tables(
    page: fitz.Page,
    page_num: int,
    table_dir: Path,
    table_captions: List[str],
) -> List[Tuple[TableExtract, str]]:
    extracts: List[Tuple[TableExtract, str]] = []
    tables = page.find_tables()
    for table_index, table in enumerate(tables.tables, start=1):
        cleaned = clean_table_rows(table.extract())
        if not cleaned:
            continue

        csv_path = table_dir / f"page-{page_num:03d}-table-{table_index:02d}.csv"
        md_path = table_dir / f"page-{page_num:03d}-table-{table_index:02d}.md"

        with csv_path.open("w", newline="", encoding="utf-8") as handle:
            writer = csv.writer(handle)
            writer.writerows(cleaned)

        table_markdown = markdown_table(cleaned)
        md_path.write_text(table_markdown + "\n", encoding="utf-8")
        extracts.append(
            (
                TableExtract(
                    page=page_num,
                    index=table_index,
                    rows=len(cleaned),
                    cols=len(cleaned[0]),
                    csv_path=csv_path,
                    markdown_path=md_path,
                    nearby_captions=table_captions[:3],
                ),
                table_markdown,
            )
        )
    return extracts


def render_figure_pages(doc: fitz.Document, page_nums: Iterable[int], figure_dir: Path) -> List[Dict[str, Any]]:
    figure_pages: List[Dict[str, Any]] = []
    for page_num in sorted(set(page_nums)):
        page = doc[page_num - 1]
        pix = page.get_pixmap(matrix=fitz.Matrix(2, 2), alpha=False)
        image_path = figure_dir / f"page-{page_num:03d}.png"
        pix.save(str(image_path))
        figure_pages.append({"page": page_num, "image": str(image_path)})
    return figure_pages


def page_context(structured_markdown: str, page_num: int, max_chars: int = 4_500) -> str:
    match = re.search(
        rf"## Page {page_num}\n(?P<body>.*?)(?=\n\n---\n\n## Page |\Z)",
        structured_markdown,
        re.S,
    )
    if not match:
        return ""
    return match.group("body")[:max_chars]


def load_openai_client():
    repo_root = Path(__file__).resolve().parents[2]
    backend_src = repo_root / "backend" / "src"
    if str(backend_src) not in sys.path:
        sys.path.insert(0, str(backend_src))
    try:
        from services.env_loader import load_env

        load_env()
    except Exception:
        pass
    try:
        from openai import OpenAI
    except ImportError as exc:  # pragma: no cover - environment setup guard
        raise RuntimeError("openai package is required for --with-vision-captions") from exc
    return OpenAI()


def caption_figure_pages(
    figure_pages: List[Dict[str, Any]],
    structured_markdown_path: Path,
    output_dir: Path,
    model: str,
    delay_seconds: float,
) -> Tuple[Path, Path]:
    client = load_openai_client()
    structured_markdown = structured_markdown_path.read_text(encoding="utf-8", errors="replace")
    json_path = output_dir / "figure-captions.json"
    md_path = output_dir / "figure-captions.md"
    output_dir.mkdir(parents=True, exist_ok=True)

    existing_by_page: Dict[int, Dict[str, Any]] = {}
    if json_path.exists():
        try:
            for item in json.loads(json_path.read_text(encoding="utf-8")):
                existing_by_page[int(item["page"])] = item
        except Exception:
            existing_by_page = {}

    results: List[Dict[str, Any]] = []
    for index, figure in enumerate(figure_pages, start=1):
        page_num = int(figure["page"])
        image_path = Path(figure["image"])
        if page_num in existing_by_page and existing_by_page[page_num].get("caption"):
            results.append(existing_by_page[page_num])
            print(f"[{index}/{len(figure_pages)}] page {page_num}: reused", flush=True)
            continue

        context = page_context(structured_markdown, page_num)
        image_data = base64.b64encode(image_path.read_bytes()).decode()
        prompt = (
            "Caption this FM Property Loss Prevention Data Sheet page for "
            "construction/fire-protection RAG retrieval. Focus on figures, diagrams, "
            "tables, dimensions, sprinkler layout, ASRS terms, labels, decision logic, "
            "and what a user could ask. Do not infer beyond the page. Return strict JSON "
            "with keys: summary (string), visual_elements (array), engineering_details "
            "(array), retrieval_keywords (array), limitations (string).\n\n"
            f"Page {page_num} extracted text context:\n{context[:3_800]}"
        )
        try:
            response = client.chat.completions.create(
                model=model,
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": prompt},
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": f"data:image/png;base64,{image_data}",
                                    "detail": "high",
                                },
                            },
                        ],
                    }
                ],
                response_format={"type": "json_object"},
                max_tokens=750,
            )
            parsed = json.loads(response.choices[0].message.content or "{}")
            item = {"page": page_num, "image": str(image_path), "caption": parsed}
            print(f"[{index}/{len(figure_pages)}] page {page_num}: captioned", flush=True)
        except Exception as exc:
            item = {"page": page_num, "image": str(image_path), "caption": None, "error": str(exc)}
            print(f"[{index}/{len(figure_pages)}] page {page_num}: error {exc}", flush=True)
        results.append(item)
        json_path.write_text(json.dumps(sorted(results, key=lambda row: row["page"]), indent=2), encoding="utf-8")
        if delay_seconds > 0:
            time.sleep(delay_seconds)

    results = sorted(results, key=lambda row: row["page"])
    json_path.write_text(json.dumps(results, indent=2), encoding="utf-8")
    write_caption_markdown(results, md_path)
    return json_path, md_path


def listify(value: Any) -> List[str]:
    if not value:
        return []
    if isinstance(value, list):
        return [str(item) for item in value]
    if isinstance(value, dict):
        return [f"{key}: {val}" for key, val in value.items()]
    return [str(value)]


def write_caption_markdown(results: List[Dict[str, Any]], output_path: Path) -> None:
    lines = [
        "# Figure Captions for RAG",
        "",
        "Generated from rendered page images for diagram-aware retrieval. Captions supplement extracted PDF text and table Markdown.",
    ]
    for item in results:
        page_num = item["page"]
        caption = item.get("caption") or {}
        lines.append(f"\n## Figure Page {page_num}")
        lines.append(f"Image artifact: `{item['image']}`")
        if item.get("error"):
            lines.append(f"Caption error: {item['error']}")
            continue
        lines.append(f"Summary: {caption.get('summary', '')}")
        for label, key in (
            ("Visual elements", "visual_elements"),
            ("Engineering details", "engineering_details"),
            ("Retrieval keywords", "retrieval_keywords"),
        ):
            lines.append(f"{label}:")
            for value in listify(caption.get(key)):
                lines.append(f"- {value}")
        if caption.get("limitations"):
            lines.append(f"Limitations: {caption.get('limitations')}")
    output_path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def prepare_pdf(args: argparse.Namespace) -> PreparedPdf:
    pdf_path = Path(args.pdf).expanduser().resolve()
    if not pdf_path.exists():
        raise RuntimeError(f"PDF not found: {pdf_path}")

    output_root = Path(args.output_root).expanduser().resolve()
    processed_dir = output_root / "processed"
    text_dir = processed_dir / "text"
    table_dir = processed_dir / "tables"
    figure_dir = processed_dir / "figures"
    ingest_dir = output_root / "ingest"
    caption_ingest_dir = output_root / "caption-ingest"
    for directory in (text_dir, table_dir, figure_dir, ingest_dir):
        directory.mkdir(parents=True, exist_ok=True)

    doc = fitz.open(pdf_path)
    slug = sanitize_slug(args.title or pdf_path.stem)
    layout_text_path = text_dir / f"{slug}.layout.txt"
    if not run_pdftotext(pdf_path, layout_text_path):
        extract_text_with_pymupdf(doc, layout_text_path)
    layout_pages = split_layout_pages(layout_text_path)

    if args.copy_pdf:
        shutil.copy2(pdf_path, ingest_dir / pdf_path.name)

    manifest: Dict[str, Any] = {
        "source_pdf": str(pdf_path),
        "title": args.title or pdf_path.stem,
        "page_count": doc.page_count,
        "tables": [],
        "figure_pages": [],
        "processed_artifacts": {},
    }
    figure_page_nums: set[int] = set()
    structured_parts = [
        f"# {args.title or pdf_path.stem}",
        "",
        f"Source PDF: {pdf_path.name}",
        f"Pages: {doc.page_count}",
        "",
        "Extraction note: Generated for Alleato RAG ingestion from the PDF text layer. "
        "Detected tables are included as Markdown tables; figure-heavy pages are rendered "
        "and can be vision-captioned into a separate RAG document.",
    ]

    table_count = 0
    for page_index in range(doc.page_count):
        page_num = page_index + 1
        page = doc[page_index]
        page_text = layout_pages[page_index].strip() if page_index < len(layout_pages) else page.get_text("text").strip()
        figure_captions = FIGURE_PATTERN.findall(page_text)
        table_captions = TABLE_CAPTION_PATTERN.findall(page_text)
        if figure_captions:
            figure_page_nums.add(page_num)

        try:
            page_tables = extract_page_tables(page, page_num, table_dir, table_captions)
        except Exception as exc:
            manifest.setdefault("table_errors", []).append({"page": page_num, "error": str(exc)})
            page_tables = []

        structured_parts.append(f"\n\n---\n\n## Page {page_num}\n")
        if table_captions:
            structured_parts.append("Table references on this page:\n" + "\n".join(f"- {caption}" for caption in table_captions[:8]) + "\n")
        if figure_captions:
            structured_parts.append("Figure references on this page:\n" + "\n".join(f"- {caption}" for caption in figure_captions[:8]) + "\n")
        structured_parts.append("\n### Extracted page text\n")
        structured_parts.append("```text\n" + page_text[: args.max_page_chars] + "\n```\n")

        for table_info, table_markdown in page_tables:
            table_count += 1
            manifest["tables"].append(
                {
                    "page": table_info.page,
                    "index": table_info.index,
                    "rows": table_info.rows,
                    "cols": table_info.cols,
                    "csv": str(table_info.csv_path),
                    "markdown": str(table_info.markdown_path),
                    "nearby_captions": table_info.nearby_captions,
                }
            )
            structured_parts.append(f"\n### Extracted table page {page_num}, table {table_info.index}\n")
            if table_info.nearby_captions:
                structured_parts.append(
                    "Nearby table caption candidates:\n"
                    + "\n".join(f"- {caption}" for caption in table_info.nearby_captions)
                    + "\n"
                )
            structured_parts.append(table_markdown + "\n")

    figure_pages = render_figure_pages(doc, figure_page_nums, figure_dir)
    manifest["figure_pages"] = figure_pages

    structured_markdown_path = ingest_dir / f"{slug}-rag-structured.md"
    structured_markdown_path.write_text("\n".join(structured_parts), encoding="utf-8")

    caption_json_path = None
    caption_markdown_path = None
    if args.with_vision_captions:
        caption_json_path, caption_markdown_path = caption_figure_pages(
            figure_pages=figure_pages,
            structured_markdown_path=structured_markdown_path,
            output_dir=processed_dir / "figure-captions",
            model=args.vision_model,
            delay_seconds=args.caption_delay_seconds,
        )
        caption_ingest_dir.mkdir(parents=True, exist_ok=True)
        caption_ingest_path = caption_ingest_dir / f"{slug}-figure-captions.md"
        shutil.copy2(caption_markdown_path, caption_ingest_path)

    manifest["processed_artifacts"] = {
        "layout_text": str(layout_text_path),
        "structured_markdown": str(structured_markdown_path),
        "table_dir": str(table_dir),
        "figure_dir": str(figure_dir),
        "caption_json": str(caption_json_path) if caption_json_path else None,
        "caption_markdown": str(caption_markdown_path) if caption_markdown_path else None,
        "ingest_dir": str(ingest_dir),
        "caption_ingest_dir": str(caption_ingest_dir) if caption_markdown_path else None,
    }
    manifest_path = processed_dir / "manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")

    return PreparedPdf(
        page_count=doc.page_count,
        layout_text_path=layout_text_path,
        structured_markdown_path=structured_markdown_path,
        manifest_path=manifest_path,
        table_count=table_count,
        figure_page_count=len(figure_pages),
        caption_markdown_path=caption_markdown_path,
        caption_json_path=caption_json_path,
    )


def parse_args(argv: Optional[Sequence[str]] = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Prepare a PDF for Alleato RAG ingestion")
    parser.add_argument("pdf", help="Path to source PDF")
    parser.add_argument("--output-root", required=True, help="Output folder for processed artifacts")
    parser.add_argument("--title", help="Document title for generated Markdown")
    parser.add_argument("--copy-pdf", action="store_true", help="Copy the original PDF into the ingest folder")
    parser.add_argument(
        "--with-vision-captions",
        action="store_true",
        help="Caption rendered figure pages with OpenAI vision and create caption-ingest folder",
    )
    parser.add_argument("--vision-model", default="gpt-4o-mini", help="OpenAI vision model for captions")
    parser.add_argument("--caption-delay-seconds", type=float, default=0.2, help="Delay between vision caption calls")
    parser.add_argument("--max-page-chars", type=int, default=18_000, help="Max extracted page text chars in Markdown")
    return parser.parse_args(argv)


def main(argv: Optional[Sequence[str]] = None) -> int:
    args = parse_args(argv)
    result = prepare_pdf(args)
    print(
        json.dumps(
            {
                "pages": result.page_count,
                "layout_text": str(result.layout_text_path),
                "structured_markdown": str(result.structured_markdown_path),
                "tables": result.table_count,
                "figure_pages": result.figure_page_count,
                "caption_markdown": str(result.caption_markdown_path) if result.caption_markdown_path else None,
                "caption_json": str(result.caption_json_path) if result.caption_json_path else None,
                "manifest": str(result.manifest_path),
                "next_ingest_commands": [
                    "DOC_SEGMENT_USE_LLM=false PYTHONPATH=$PWD/backend python3 scripts/ingestion/ingest_local_documents.py --source-dir <output-root>/ingest --process-now",
                    "DOC_SEGMENT_USE_LLM=false PYTHONPATH=$PWD/backend python3 scripts/ingestion/ingest_local_documents.py --source-dir <output-root>/caption-ingest --process-now",
                ],
            },
            indent=2,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
