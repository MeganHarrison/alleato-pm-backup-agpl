#!/usr/bin/env python3
"""Generate the first reviewer evidence packet for FMDS 8-34 April 2026.

This command is deterministic and idempotent. It writes candidate evidence and
private storage artifacts, but never creates review events or changes review_status.
"""

from __future__ import annotations

import argparse
import hashlib
import html
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import fitz
from supabase import Client, create_client

from ingest_fmds0834 import (
    BUCKET,
    DOCUMENT_CODE,
    REVISION_LABEL,
    required_env,
    sha256_bytes,
    upload_bytes,
)


BATCH_ID = "batch-1"
BATCH_VERSION = "2026-07-20.3"
EXPECTED_OBJECTS = 9
EXPECTED_PAGES = {12, 17, 18, 19, 20, 21}


REVIEW_PROPOSALS: dict[tuple[str, str], dict[str, Any]] = {
    ("table", "2.1.4.5.4"): {
        "kind": "table_transcription",
        "columns": [
            "Ceiling Sprinkler Type",
            "Number of Sprinklers in the Ceiling Sprinkler System Design",
            "Hose Demand, gpm (L/min)",
            "Water Supply Duration, min",
        ],
        "rows": [
            ["Standard-Coverage", "12 or less", "250 (950)", "60"],
            ["Standard-Coverage", "13 to 19", "500 (1,900)", "90"],
            ["Standard-Coverage", "20 or more", "500 (1,900)", "120"],
            ["Extended-Coverage", "6 or less", "250 (950)", "60"],
            ["Extended-Coverage", "7 to 9", "500 (1,900)", "90"],
            ["Extended-Coverage", "10 or more", "500 (1,900)", "120"],
        ],
        "verify": [
            "The four logical column headings match the source table.",
            "The merged Standard-Coverage and Extended-Coverage categories apply to the correct three rows.",
            "Every range operator, US value, metric value, and duration matches the source image.",
        ],
        "questions": [],
    },
    ("figure", "2.2.1.4.1.1"): {
        "kind": "figure_fact_review",
        "facts": [
            "The governing paragraph defines gross transverse-flue-space width as the horizontal distance between containers and/or trays.",
            "The drawing labels the Gross Width of Transverse Flue Space (TFS), two Container or Tray blocks, and an Elevation View.",
        ],
        "verify": [
            "The measured endpoints and horizontal direction shown by the bracket are interpreted correctly.",
            "The figure caption and all drawing labels match the source crop.",
        ],
        "questions": [],
    },
    ("figure", "2.2.1.4.1.2"): {
        "kind": "figure_fact_review",
        "facts": [
            "The figure states: Net Transverse Flue Space (TFS) Width = Sum of Open Widths Within TFS.",
            "Both examples identify openings A and B between containers or trays at upper and lower tier levels.",
            "One example uses flat, solid horizontal supports; the other uses angle-iron horizontal supports.",
            "Each example labels an object at an angle less than 30 degrees within the transverse flue space.",
        ],
        "verify": [
            "The A and B opening widths are the only widths intended to be summed in each example.",
            "The support types, angle condition, tier labels, and elevation-view labels match the source.",
        ],
        "questions": [],
    },
    ("figure", "2.2.1.4.1.3(a)"): {
        "kind": "figure_fact_review",
        "facts": [
            "The example concerns an object within the transverse flue space whose horizontal profile is at least 70% uniformly open.",
            "The plan view labels the product-supporting structure, the transverse flue space, and adjacent containers or trays.",
        ],
        "verify": [
            "The at-least-70% threshold and uniformly-open requirement match the caption and drawing.",
            "The plan-view orientation and labeled structure are interpreted correctly.",
        ],
        "questions": [],
    },
    ("figure", "2.2.1.4.1.3(b)"): {
        "kind": "figure_fact_review",
        "facts": [
            "The caption concerns an object no wider than 4 in. (100 mm) within the transverse flue space at an angle at least 30 degrees.",
            "The elevation view labels a rack upright, rack structural member, and container or tray.",
        ],
        "verify": [
            "The 4 in. (100 mm) maximum width and angle threshold are transcribed correctly.",
            "The caption and drawing both use an angle of at least 30 degrees, measured against the intended reference direction.",
        ],
        "questions": [],
    },
    ("figure", "2.2.1.4.2.1"): {
        "kind": "figure_fact_review",
        "facts": [
            "The governing text says gaps less than 1.5 in. (38 mm) are not treated as transverse flue spaces.",
            "The drawing shows the nominal horizontal distance between qualifying transverse flue spaces.",
            "The drawing labels qualifying net flue-space widths as greater than 1.5 in. (38 mm) and a nonqualifying space as less than 1.5 in. (38 mm).",
        ],
        "verify": [
            "The nominal horizontal distance is measured between the intended qualifying transverse flue spaces.",
            "All 1.5 in. (38 mm) callouts and container/tray labels match the source.",
        ],
        "questions": [
            "The prose describes a minimum net width of 1.5 in. (38 mm), while the drawing uses greater-than 1.5 in. Confirm whether exactly 1.5 in. qualifies.",
        ],
    },
    ("table", "2.2.1.4.2.1"): {
        "kind": "table_transcription",
        "columns": [
            "Nominal Horizontal Distance Between Transverse Flue Spaces, ft (m)",
            "Recommended Minimum Nominal Net Transverse Flue Space Width, in. (mm)",
        ],
        "rows": [
            ["2 (0.6)", "1.5 (38)"],
            ["2.5 (0.75)", "2 (50)"],
            ["5 (1.5)", "3 (75)"],
            ["10 (3.0)", "6 (150)"],
            ["> 10 (3.0)", "In-rack sprinklers are needed. See Section 2.2.1.5 to see if vertical barriers are needed too."],
        ],
        "verify": [
            "The two logical column headings match the source table.",
            "Every distance-to-width mapping and paired metric value matches the source image.",
            "The final row's in-rack-sprinkler and vertical-barrier direction is complete and correctly associated with distances greater than 10 ft (3.0 m).",
        ],
        "questions": [],
    },
    ("figure", "2.2.1.4.2.2"): {
        "kind": "figure_fact_review",
        "facts": [
            "The figure is an elevation-view example of vertically aligned transverse flue spaces in a horizontal-loading ASRS.",
            "The drawing alternates Container A and Container B and labels widths based on the applicable container.",
        ],
        "verify": [
            "Each width is associated with the correct adjacent container geometry.",
            "The vertical alignment and repeated Container A / Container B labels match the source.",
        ],
        "questions": [],
    },
    ("figure", "2.2.1.5.1"): {
        "kind": "figure_fact_review",
        "facts": [
            "The governing text recommends vertical barriers at rack uprights on spacing not exceeding 12 ft (3.7 m) when all three listed conditions are met.",
            "Condition 1: transverse flue spaces between rack uprights have a minimum gross width of 1.5 in. (38 mm).",
            "Condition 2: material-handling supports reduce those transverse flue spaces to a maximum net width of 0.5 in. (13 mm).",
            "Condition 3: the horizontal distance between the affected transverse flue spaces is greater than 10 ft (3.0 m).",
            "The elevation drawing labels rack uprights, material-handling supports, containers or trays, and the greater-than-10-ft horizontal distance.",
        ],
        "verify": [
            "All three conditions must be satisfied together before the recommendation applies.",
            "The 12 ft, 1.5 in., 0.5 in., and 10 ft thresholds and paired metric units match the governing text.",
            "The drawing callouts are tied to the correct gross width, net width, and horizontal distance.",
        ],
        "questions": [
            "The prose uses minimum gross width 1.5 in. and maximum net width 0.5 in.; the drawing appears to use greater-than 1.5 in. and less-than 0.5 in. Confirm whether equality is included at either boundary.",
        ],
    },
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("pdf", type=Path)
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--packet-pdf", type=Path)
    return parser.parse_args()


def is_batch_identifier(identifier: str) -> bool:
    return (
        identifier == "2.1.4.5.4"
        or identifier.startswith("2.2.1.4")
        or identifier.startswith("2.2.1.5")
    )


def safe_slug(value: str) -> str:
    return re.sub(r"[^a-zA-Z0-9]+", "-", value).strip("-").lower()


def rect_from(value: Any) -> fitz.Rect | None:
    if not value or len(value) != 4:
        return None
    return fitz.Rect(*(float(part) for part in value))


def clamp_rect(rect: fitz.Rect, page_rect: fitz.Rect) -> fitz.Rect:
    return fitz.Rect(
        max(page_rect.x0, rect.x0),
        max(page_rect.y0, rect.y0),
        min(page_rect.x1, rect.x1),
        min(page_rect.y1, rect.y1),
    )


def expanded(rect: fitz.Rect, page_rect: fitz.Rect, margin: float = 12) -> fitz.Rect:
    return clamp_rect(
        fitz.Rect(rect.x0 - margin, rect.y0 - margin, rect.x1 + margin, rect.y1 + margin),
        page_rect,
    )


def normalized_rows(rows: list[list[Any]] | None) -> list[list[str | None]]:
    normalized: list[list[str | None]] = []
    for row in rows or []:
        normalized.append(
            [
                None if cell is None else re.sub(r"\s+", " ", str(cell)).strip()
                for cell in row
            ]
        )
    return normalized


def rows_sha256(rows: list[list[str | None]]) -> str:
    encoded = json.dumps(rows, sort_keys=True, ensure_ascii=False).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def overlap_ratio(first: fitz.Rect, second: fitz.Rect) -> float:
    intersection = first & second
    if intersection.is_empty:
        return 0.0
    denominator = max(1.0, first.get_area() + second.get_area() - intersection.get_area())
    return intersection.get_area() / denominator


def table_diagnostics(
    page: fitz.Page, item: dict[str, Any], crop_rect: fitz.Rect
) -> dict[str, Any]:
    expected_bbox = rect_from((item.get("bounding_box") or {}).get("table"))
    attempts: list[dict[str, Any]] = []
    detected: list[Any] = []
    selected_strategy = None
    error = None
    strategies = (
        ("lines_default", {"clip": crop_rect}),
        ("lines_strict", {"clip": crop_rect, "strategy": "lines_strict"}),
        (
            "text_vertical_lines_horizontal",
            {
                "clip": crop_rect,
                "vertical_strategy": "text",
                "horizontal_strategy": "lines",
            },
        ),
        ("text", {"clip": crop_rect, "strategy": "text"}),
    )
    detected_by_strategy: list[tuple[str, list[Any]]] = []
    for strategy_name, kwargs in strategies:
        try:
            tables = list(page.find_tables(**kwargs).tables)
            detected_by_strategy.append((strategy_name, tables))
            attempts.append(
                {
                    "strategy": strategy_name,
                    "table_count": len(tables),
                    "tables": [
                        {
                            "bbox": list(table.bbox),
                            "row_count": table.row_count,
                            "column_count": table.col_count,
                        }
                        for table in tables
                    ],
                }
            )
        except Exception as exc:
            attempts.append({"strategy": strategy_name, "error": str(exc), "table_count": 0})
            error = str(exc)

    for preferred in ("lines_strict", "text_vertical_lines_horizontal", "text", "lines_default"):
        match = next(
            ((name, tables) for name, tables in detected_by_strategy if name == preferred and tables),
            None,
        )
        if match:
            selected_strategy, detected = match
            break

    selected = None
    if detected and expected_bbox:
        selected = max(detected, key=lambda table: overlap_ratio(fitz.Rect(table.bbox), expected_bbox))
    elif detected:
        caption = rect_from((item.get("bounding_box") or {}).get("caption"))
        selected = min(
            detected,
            key=lambda table: abs(float(table.bbox[1]) - (caption.y1 if caption else 0)),
        )

    fresh_rows = normalized_rows(selected.extract() if selected else [])
    stored_rows = normalized_rows(
        ((item.get("existing_candidate") or {}).get("output") or {})
        .get("extracted_structure", {})
        .get("rows", [])
    )
    max_columns = max((len(row) for row in fresh_rows), default=0)
    none_cells = sum(cell is None for row in fresh_rows for cell in row)
    multiline_cells = sum(
        "\n" in str(cell) for row in (selected.extract() if selected else []) for cell in row if cell
    )
    fresh_hash = rows_sha256(fresh_rows)
    stored_hash = rows_sha256(stored_rows)
    same_as_stored = bool(fresh_rows) and fresh_hash == stored_hash
    merged_cell_suspected = none_cells > 0 or multiline_cells > 0

    if not selected or not fresh_rows:
        discrepancy = "extraction_incomplete"
    elif not same_as_stored or merged_cell_suspected:
        discrepancy = "manual_validation_required"
    else:
        discrepancy = "no_structural_discrepancy_detected"

    return {
        "detected_table_count_on_page": len(detected),
        "selected_strategy": selected_strategy,
        "strategy_attempts": attempts,
        "selected_bbox": list(selected.bbox) if selected else None,
        "row_count": len(fresh_rows),
        "column_count": max_columns,
        "none_cell_count": none_cells,
        "multiline_cell_count": multiline_cells,
        "merged_cell_suspected": merged_cell_suspected,
        "fresh_rows_sha256": fresh_hash,
        "stored_rows_sha256": stored_hash,
        "same_as_stored_candidate": same_as_stored,
        "fresh_rows": fresh_rows,
        "extraction_error": error,
        "discrepancy_state": discrepancy,
    }


def caption_rect(item: dict[str, Any]) -> fitz.Rect:
    value = (item.get("bounding_box") or {}).get("caption")
    result = rect_from(value)
    if not result:
        raise RuntimeError(f"{item['source_type']} {item['identifier']} has no caption bounding box")
    return result


def object_crop_rect(
    page: fitz.Page,
    item: dict[str, Any],
    page_items: list[dict[str, Any]],
) -> fitz.Rect:
    caption = caption_rect(item)
    if item["source_type"] == "table":
        table = rect_from((item.get("bounding_box") or {}).get("table"))
        if not table:
            next_heading_y = None
            for block in page.get_text("blocks", sort=True):
                block_text = " ".join(block[4].split())
                if (
                    float(block[1]) > caption.y1 + 8
                    and re.match(r"^\d+(?:\.\d+){2,}(?:\s|$)", block_text)
                ):
                    next_heading_y = float(block[1])
                    break
            bottom = next_heading_y - 6 if next_heading_y else min(page.rect.y1 - 45, caption.y1 + 220)
            return clamp_rect(
                fitz.Rect(70, caption.y0 - 6, page.rect.x1 - 70, bottom),
                page.rect,
            )
        union = fitz.Rect(
            min(caption.x0, table.x0),
            min(caption.y0, table.y0),
            max(caption.x1, table.x1),
            max(caption.y1, table.y1),
        )
        return expanded(union, page.rect, 14)

    ordered = sorted(page_items, key=lambda row: caption_rect(row).y1)
    position = next(index for index, row in enumerate(ordered) if row["source_id"] == item["source_id"])
    prior_bottom = 55.0 if position == 0 else caption_rect(ordered[position - 1]).y1 + 4
    if position == 0:
        matching_requirement_y = None
        requirement_pattern = re.compile(rf"^{re.escape(item['identifier'])}(?:\s|$)")
        for block in page.get_text("blocks", sort=True):
            block_text = " ".join(block[4].split())
            if float(block[1]) < caption.y0 - 8 and requirement_pattern.match(block_text):
                matching_requirement_y = float(block[1])
        if matching_requirement_y is not None:
            prior_bottom = max(55.0, matching_requirement_y - 6)
    rect = fitz.Rect(35, prior_bottom, page.rect.x1 - 35, caption.y1 + 8)
    if rect.height < 150:
        rect.y0 = max(55, rect.y1 - 180)
    return clamp_rect(rect, page.rect)


def render_png(page: fitz.Page, scale: float, clip: fitz.Rect | None = None) -> bytes:
    pixmap = page.get_pixmap(matrix=fitz.Matrix(scale, scale), clip=clip, alpha=False)
    return pixmap.tobytes("png")


def proposal_table_html(proposal: dict[str, Any]) -> str:
    headings = "".join(f"<th>{html.escape(column)}</th>" for column in proposal["columns"])
    body = "".join(
        "<tr>" + "".join(f"<td>{html.escape(cell)}</td>" for cell in row) + "</tr>"
        for row in proposal["rows"]
    )
    return (
        '<p class="merge-note">Repeated category labels represent merged source cells.</p>'
        '<div class="proposal-table"><table><thead><tr>'
        + headings
        + "</tr></thead><tbody>"
        + body
        + "</tbody></table></div>"
    )


def checklist_html(values: list[str]) -> str:
    return "<ul class=\"verify-list\">" + "".join(
        f"<li><span class=\"box\">□</span>{html.escape(value)}</li>" for value in values
    ) + "</ul>"


def facts_html(values: list[str]) -> str:
    return "<ul class=\"facts\">" + "".join(
        f"<li>{html.escape(value)}</li>" for value in values
    ) + "</ul>"


def generate_html(manifest: dict[str, Any], output_dir: Path) -> None:
    sections: list[str] = []
    appendix_sections: list[str] = []
    approved_count = sum(item["review_status"] == "reviewed" for item in manifest["items"])
    for item in manifest["items"]:
        proposal = item["review_proposal"]
        diagnostics = item.get("table_diagnostics")
        proposed_content = (
            proposal_table_html(proposal)
            if proposal["kind"] == "table_transcription"
            else facts_html(proposal["facts"])
        )
        questions_html = ""
        if proposal["questions"]:
            questions_html = f"""
              <section class="questions">
                <h3>Source-consistency question</h3>
                {facts_html(proposal['questions'])}
              </section>
            """
        is_approved = item["review_status"] == "reviewed"
        state_label = "approved" if is_approved else "review required"
        state_class = "state approved" if is_approved else "state"
        if is_approved:
            decision_html = f"""
              <section class="decision recorded">
                <h3>Recorded decision</h3>
                <p><strong>Approved as transcribed</strong></p>
                <p class="decision-note">Reviewer: {html.escape(item.get('latest_reviewer_id') or 'Recorded reviewer')} · Decision stored through the controlled database workflow.</p>
              </section>
            """
        else:
            decision_html = """
              <section class="decision">
                <h3>Reviewer decision</h3>
                <p class="decision-note">Select one. This paper/PDF decision must then be recorded through the controlled database review workflow.</p>
                <div class="decision-options"><span>□ Approve as transcribed</span><span>□ Correct</span><span>□ Reject</span></div>
                <div class="write-line"><strong>Corrections or rejection reason</strong></div>
                <div class="write-space"></div>
                <div class="signature"><span>Reviewer name / role</span><span>Date</span></div>
              </section>
            """
        sections.append(
            f"""
            <article class="review-item">
              <div class="item-heading">
                <div>
                  <p class="item-kicker">{html.escape(item['source_type'])} · PDF page {item['page_number']}</p>
                  <h2>{html.escape(item['identifier'])}</h2>
                  <p class="title">{html.escape(item['title'] or '')}</p>
                </div>
                <span class="{state_class}">{state_label}</span>
              </div>
              <p class="reason">{html.escape(item['review_reason'])}</p>
              <figure class="source-crop"><img src="{html.escape(item['crop_relative_path'])}" alt="Localized source crop for {html.escape(item['identifier'])}"/><figcaption>Authoritative source crop · PDF page {item['page_number']}</figcaption></figure>
              <section class="proposal">
                <p class="section-label">{'Proposed transcription' if proposal['kind'] == 'table_transcription' else 'Source facts proposed for capture'}</p>
                {proposed_content}
              </section>
              {questions_html}
              <section class="verify">
                <h3>What the reviewer must verify</h3>
                {checklist_html(proposal['verify'])}
              </section>
              {decision_html}
            </article>
            """
        )
        appendix_sections.append(
            f"""
            <article class="appendix-item">
              <p class="item-kicker">{html.escape(item['source_type'])} · PDF page {item['page_number']}</p>
              <h2>{html.escape(item['identifier'])} technical evidence</h2>
              <div class="appendix-images">
                <figure><img src="{html.escape(item['crop_relative_path'])}" alt="Localized crop for {html.escape(item['identifier'])}"/><figcaption>Localized source crop</figcaption></figure>
                <figure class="page"><img src="{html.escape(item['page_relative_path'])}" alt="Full source page {item['page_number']}"/><figcaption>Full source page</figcaption></figure>
              </div>
              <h3>Native text inside crop</h3>
              <pre>{html.escape(item['region_native_text'])}</pre>
              <h3>Machine extraction diagnostics</h3>
              <pre>{html.escape(json.dumps(diagnostics or {'note': 'No table-grid diagnostics for figures.'}, indent=2, ensure_ascii=False))}</pre>
              <h3>Original stored candidate evidence</h3>
              <pre>{html.escape(json.dumps(item['existing_candidate'], indent=2, ensure_ascii=False))}</pre>
            </article>
            """
        )

    document = f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>FMDS 8-34 2026 Review Batch 1</title>
<style>
@page {{ size: Letter; margin: .45in; }}
* {{ box-sizing: border-box; }}
body {{ margin:0; font-family:Inter,Arial,sans-serif; background:#f5f6f8; color:#17191d; }}
main {{ width:min(1100px,calc(100% - 48px)); margin:0 auto; padding:40px 0 80px; }}
.cover {{ background:#0d1015; color:#f7f8fa; padding:42px; border-radius:14px; margin-bottom:24px; }}
.eyebrow,.item-kicker {{ text-transform:uppercase; letter-spacing:.1em; font-size:11px; font-weight:700; color:#788195; }}
.cover h1 {{ font-size:36px; margin:10px 0; }} .cover p {{ color:#b7becb; max-width:720px; line-height:1.5; }}
.warning {{ border-left:3px solid #d6a23f; padding-left:14px; color:#e2c887!important; }}
.review-item {{ background:white; padding:30px; border-radius:12px; margin:22px 0; break-before:page; box-shadow:0 1px 3px rgba(0,0,0,.08); }}
.item-heading {{ display:flex; justify-content:space-between; gap:24px; align-items:flex-start; }}
h2 {{ margin:5px 0; font-size:27px; }} h3 {{ margin:24px 0 10px; font-size:15px; }} .title,.reason {{ color:#555e6d; line-height:1.45; }}
.state {{ background:#fff3d6; color:#785b16; padding:7px 9px; border-radius:999px; font-size:11px; font-weight:700; white-space:nowrap; }}
.state.approved {{ background:#e4f6ea; color:#21633a; }}
figure {{ margin:0; }} img {{ width:100%; height:auto; border:1px solid #d9dde4; }} figcaption {{ color:#7b8391; font-size:11px; margin-top:6px; }}
.source-crop {{ margin-top:20px; }} .source-crop img {{ max-height:510px; object-fit:contain; object-position:left center; background:#f7f8fa; }}
.section-label {{ margin:24px 0 10px; font-size:15px; font-weight:700; }}
.proposal-table {{ overflow:auto; }} table {{ border-collapse:collapse; width:100%; font-size:12px; line-height:1.35; }} th,td {{ border:1px solid #cfd4dc; padding:8px; vertical-align:top; }} th {{ background:#f0f2f5; text-align:left; }}
.merge-note {{ color:#707887; font-size:11px; margin:0 0 8px; }}
.facts,.verify-list {{ margin:8px 0 0; padding-left:22px; color:#343a45; line-height:1.5; font-size:12px; }} .facts li,.verify-list li {{ margin:7px 0; }}
.verify-list {{ list-style:none; padding-left:0; }} .verify-list .box {{ display:inline-block; width:22px; color:#697386; }}
.questions {{ margin-top:18px; background:#fff8e7; border-left:3px solid #d6a23f; padding:2px 16px 10px; }} .questions h3 {{ color:#6e541a; margin-top:12px; }}
.decision {{ margin-top:24px; border-top:2px solid #20242b; padding-top:2px; }} .decision-note {{ color:#687180; font-size:11px; }}
.decision.recorded {{ border-top-color:#2f7a49; background:#f1faf4; padding:2px 14px 10px; }}
.decision-options {{ display:flex; flex-wrap:wrap; gap:24px; font-size:13px; font-weight:700; margin:14px 0 22px; }}
.write-line {{ border-bottom:1px solid #9299a5; padding-bottom:6px; font-size:11px; color:#5c6470; }} .write-space {{ height:42px; border-bottom:1px solid #d0d4da; }}
.signature {{ display:grid; grid-template-columns:2fr 1fr; gap:30px; margin-top:26px; }} .signature span {{ border-top:1px solid #9299a5; padding-top:5px; color:#687180; font-size:10px; }}
.appendix-cover,.appendix-item {{ break-before:page; background:white; padding:30px; }} .appendix-cover {{ min-height:9in; display:flex; flex-direction:column; justify-content:center; }}
.appendix-images {{ display:grid; grid-template-columns:2.2fr .8fr; gap:18px; align-items:start; margin-top:20px; }}
.page img {{ max-height:430px; object-fit:contain; background:#f1f3f5; }}
pre {{ white-space:pre-wrap; background:#f3f5f7; border-left:3px solid #aeb6c3; padding:12px; font:11px/1.4 ui-monospace,monospace; max-height:260px; overflow:auto; }}
@media print {{ body {{ background:white; }} main {{ width:100%; padding:0; }} .cover,.review-item {{ box-shadow:none; border-radius:0; }} .review-item,.appendix-item {{ padding:0; }} .source-crop img {{ max-height:4.5in; }} }}
</style></head><body><main>
<section class="cover"><p class="eyebrow">AAI-1198 · Reviewer evidence packet</p><h1>FMDS 8-34 · April 2026<br/>Review Batch 1</h1>
<p>Table 2.1.4.5.4, transverse-flue guidance, and the new vertical-barrier condition.</p>
<p class="warning"><strong>Review the clean proposal against the source crop.</strong> Select Approve, Correct, or Reject for each object. Technical extractor output is isolated in the appendix and must not be approved as source data.</p>
<p>Scope: {len(manifest['items'])} objects · {len(manifest['pages'])} source pages · {manifest['table_count']} tables · {manifest['figure_count']} figures · {approved_count} approvals</p></section>
{''.join(sections)}
<section class="appendix-cover"><p class="eyebrow">Technical appendix</p><h1>Machine evidence<br/>Not an approval surface</h1><p>Native PDF text, extraction diagnostics, full-page images, and original stored candidates are retained here for traceability. Review decisions belong on the clean review pages above.</p></section>
{''.join(appendix_sections)}
</main></body></html>"""
    (output_dir / "review-packet.html").write_text(document, encoding="utf-8")


def generate_checklist(manifest: dict[str, Any], output_dir: Path) -> None:
    lines = [
        "# FMDS 8-34 2026 Review Batch 1 Checklist",
        "",
        "> This checklist prepares review evidence. Checking a box here does not change database approval status.",
        "",
    ]
    for item in manifest["items"]:
        proposal = item["review_proposal"]
        lines.extend(
            [
                f"## {item['source_type'].title()} {item['identifier']} — PDF page {item['page_number']}",
                "",
                "### Verify",
                "",
                *[f"- [ ] {value}" for value in proposal["verify"]],
                *(
                    ["", "### Source-consistency questions", ""]
                    + [f"- [ ] Resolved: {value}" for value in proposal["questions"]]
                    if proposal["questions"]
                    else []
                ),
                "",
                "### Decision",
                "",
                "- [ ] Approve as transcribed",
                "- [ ] Correct — corrections documented",
                "- [ ] Reject — reason documented",
                f"- [ ] Controlled decision includes reviewer identity, role, notes, and `{item['storage_crop_path']}`",
                "",
            ]
        )
    (output_dir / "reviewer-checklist.md").write_text("\n".join(lines), encoding="utf-8")


def fetch_batch_items(client: Client, revision_id: str) -> list[dict[str, Any]]:
    queue = (
        client.table("fmds_visual_review_queue")
        .select("*")
        .eq("revision_id", revision_id)
        .order("page_number")
        .execute()
        .data
    )
    items = [row for row in queue if is_batch_identifier(row["identifier"])]
    if len(items) != EXPECTED_OBJECTS:
        raise RuntimeError(f"Batch source coverage mismatch: {len(items)}/{EXPECTED_OBJECTS}")
    if {row["page_number"] for row in items} != EXPECTED_PAGES:
        raise RuntimeError(
            f"Batch page coverage mismatch: {sorted({row['page_number'] for row in items})}"
        )

    for item in items:
        source_table = "fmds_tables" if item["source_type"] == "table" else "fmds_figures"
        source = (
            client.table(source_table)
            .select("*")
            .eq("id", item["source_id"])
            .single()
            .execute()
            .data
        )
        candidate = (
            client.table("fmds_visual_review_candidates")
            .select("*")
            .eq("source_type", item["source_type"])
            .eq("source_id", item["source_id"])
            .eq("prompt_version", "queue-seed-2026-07-20.1")
            .single()
            .execute()
            .data
        )
        item.update(source)
        item["existing_candidate"] = candidate
    return items


def main() -> int:
    args = parse_args()
    if not args.pdf.is_file():
        raise RuntimeError(f"PDF not found: {args.pdf}")
    args.output_dir.mkdir(parents=True, exist_ok=True)
    pages_dir = args.output_dir / "pages"
    objects_dir = args.output_dir / "objects"
    pages_dir.mkdir(exist_ok=True)
    objects_dir.mkdir(exist_ok=True)

    client = create_client(
        required_env("SUPABASE_ASRS_URL"), required_env("SUPABASE_ASRS_SECRET_KEY")
    )
    revision = (
        client.table("fmds_corpus_revisions")
        .select("*")
        .eq("document_code", DOCUMENT_CODE)
        .eq("revision_label", REVISION_LABEL)
        .single()
        .execute()
        .data
    )
    if revision["status"] != "staging":
        raise RuntimeError(f"Review packet requires staging revision, found {revision['status']}")
    source_prefix = revision["source_storage_path"].split("/source/", 1)[0]
    storage_prefix = f"{source_prefix}/review-batches/{BATCH_ID}"
    items = fetch_batch_items(client, revision["id"])
    missing_proposals = [
        (item["source_type"], item["identifier"])
        for item in items
        if (item["source_type"], item["identifier"]) not in REVIEW_PROPOSALS
    ]
    if missing_proposals:
        raise RuntimeError(f"Review proposal coverage is incomplete: {missing_proposals}")
    document = fitz.open(args.pdf)

    items_by_page: dict[int, list[dict[str, Any]]] = {}
    for item in items:
        items_by_page.setdefault(item["page_number"], []).append(item)

    page_paths: dict[int, dict[str, str]] = {}
    for page_number in sorted(EXPECTED_PAGES):
        page = document[page_number - 1]
        page_bytes = render_png(page, 2.0)
        local_path = pages_dir / f"page-{page_number:03d}.png"
        local_path.write_bytes(page_bytes)
        storage_path = f"{storage_prefix}/pages/page-{page_number:03d}.png"
        upload_bytes(client, storage_path, page_bytes, "image/png")
        page_paths[page_number] = {
            "local": str(local_path.relative_to(args.output_dir)),
            "storage": storage_path,
            "sha256": sha256_bytes(page_bytes),
        }

    manifest_items: list[dict[str, Any]] = []
    for item in sorted(items, key=lambda row: (row["page_number"], caption_rect(row).y1)):
        page = document[item["page_number"] - 1]
        crop_rect = object_crop_rect(page, item, items_by_page[item["page_number"]])
        crop_bytes = render_png(page, 3.0, crop_rect)
        filename = (
            f"{item['source_type']}-{safe_slug(item['identifier'])}-"
            f"page-{item['page_number']:03d}.png"
        )
        local_crop = objects_dir / filename
        local_crop.write_bytes(crop_bytes)
        storage_crop = f"{storage_prefix}/objects/{filename}"
        upload_bytes(client, storage_crop, crop_bytes, "image/png")

        diagnostics = (
            table_diagnostics(page, item, crop_rect)
            if item["source_type"] == "table"
            else None
        )
        discrepancy = (
            diagnostics["discrepancy_state"] if diagnostics else "manual_validation_required"
        )
        region_text = page.get_textbox(crop_rect).strip()
        if not region_text:
            discrepancy = "extraction_incomplete"
        review_proposal = REVIEW_PROPOSALS[(item["source_type"], item["identifier"])]

        candidate_output = {
            "batch_id": BATCH_ID,
            "batch_version": BATCH_VERSION,
            "identifier": item["identifier"],
            "page_number": item["page_number"],
            "crop_bbox_points": list(crop_rect),
            "crop_sha256": sha256_bytes(crop_bytes),
            "page_sha256": page_paths[item["page_number"]]["sha256"],
            "storage_crop_path": storage_crop,
            "storage_page_path": page_paths[item["page_number"]]["storage"],
            "region_native_text": region_text,
            "table_diagnostics": diagnostics,
            "review_proposal": review_proposal,
            "discrepancy_state": discrepancy,
            "candidate_only": True,
            "requires_qualified_review": True,
        }
        candidate_kind = "native_grid" if item["source_type"] == "table" else "manual_import"
        client.table("fmds_visual_review_candidates").update(
            {"status": "superseded"}
        ).eq("source_type", item["source_type"]).eq("source_id", item["source_id"]).eq(
            "model", "review-packet-native-geometry"
        ).eq("status", "candidate").execute()
        client.table("fmds_visual_review_candidates").upsert(
            {
                "revision_id": revision["id"],
                "source_type": item["source_type"],
                "source_id": item["source_id"],
                "candidate_kind": candidate_kind,
                "provider": "pymupdf",
                "model": "review-packet-native-geometry",
                "prompt_version": BATCH_VERSION,
                "input_sha256": sha256_bytes(crop_bytes),
                "output": candidate_output,
                "confidence": 0.7 if discrepancy == "no_structural_discrepancy_detected" else 0.35,
                "status": "candidate",
            },
            on_conflict=(
                "source_type,source_id,candidate_kind,provider,model,"
                "prompt_version,input_sha256"
            ),
        ).execute()

        manifest_items.append(
            {
                "source_type": item["source_type"],
                "source_id": item["source_id"],
                "identifier": item["identifier"],
                "title": item.get("title"),
                "page_number": item["page_number"],
                "review_reason": item["review_reason"],
                "review_status": item["review_status"],
                "latest_decision": item.get("latest_decision"),
                "latest_reviewer_id": item.get("latest_reviewer_id"),
                "discrepancy_state": discrepancy,
                "crop_bbox_points": list(crop_rect),
                "crop_relative_path": str(local_crop.relative_to(args.output_dir)),
                "crop_sha256": sha256_bytes(crop_bytes),
                "storage_crop_path": storage_crop,
                "page_relative_path": page_paths[item["page_number"]]["local"],
                "storage_page_path": page_paths[item["page_number"]]["storage"],
                "region_native_text": region_text,
                "table_diagnostics": diagnostics,
                "review_proposal": review_proposal,
                "existing_candidate": {
                    "id": item["existing_candidate"]["id"],
                    "provider": item["existing_candidate"]["provider"],
                    "model": item["existing_candidate"]["model"],
                    "confidence": item["existing_candidate"].get("confidence"),
                    "output": item["existing_candidate"].get("output") or {},
                },
            }
        )

    reviewed_count = sum(row["review_status"] == "reviewed" for row in manifest_items)
    if reviewed_count == len(manifest_items):
        approval_status = "approved"
    elif reviewed_count:
        approval_status = "partially_reviewed"
    else:
        approval_status = "not_approved"
    manifest = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "batch_id": BATCH_ID,
        "batch_version": BATCH_VERSION,
        "document_code": DOCUMENT_CODE,
        "revision_label": REVISION_LABEL,
        "revision_id": revision["id"],
        "revision_status": revision["status"],
        "approval_status": approval_status,
        "pages": sorted(EXPECTED_PAGES),
        "table_count": sum(row["source_type"] == "table" for row in manifest_items),
        "figure_count": sum(row["source_type"] == "figure" for row in manifest_items),
        "items": manifest_items,
    }
    (args.output_dir / "manifest.json").write_text(
        json.dumps(manifest, indent=2) + "\n", encoding="utf-8"
    )
    generate_checklist(manifest, args.output_dir)
    generate_html(manifest, args.output_dir)

    if args.packet_pdf:
        if not args.packet_pdf.is_file():
            raise RuntimeError(f"Packet PDF not found: {args.packet_pdf}")
        upload_bytes(
            client,
            f"{storage_prefix}/review-packet.pdf",
            args.packet_pdf.read_bytes(),
            "application/pdf",
        )

    print(
        json.dumps(
            {
                "batch_id": BATCH_ID,
                "objects": len(manifest_items),
                "pages": len(EXPECTED_PAGES),
                "tables": manifest["table_count"],
                "figures": manifest["figure_count"],
                "discrepancy_states": {
                    state: sum(row["discrepancy_state"] == state for row in manifest_items)
                    for state in (
                        "no_structural_discrepancy_detected",
                        "manual_validation_required",
                        "extraction_incomplete",
                    )
                },
                "approval_status": manifest["approval_status"],
                "reviewed_objects": reviewed_count,
            },
            indent=2,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
