#!/usr/bin/env python3
"""Render one revision-locked FMDS table and its governing context.

The crop is derived from native PDF geometry. It fails instead of silently
returning a full page when the target table grid cannot be localized or when a
different table caption would be included in the result.
"""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path
from typing import Any

import fitz


TABLE_CAPTION_RE = re.compile(
    r"^Table\s+(?P<identifier>\d+(?:\.\d+)+(?:\([A-Za-z]\))?)\.*(?:\s|$)",
    re.IGNORECASE,
)


def parse_rect(value: str, label: str) -> fitz.Rect:
    try:
        coordinates = json.loads(value)
    except json.JSONDecodeError as error:
        raise ValueError(f"{label} must be a JSON array of four numbers") from error
    if not isinstance(coordinates, list) or len(coordinates) != 4:
        raise ValueError(f"{label} must be a JSON array of four numbers")
    try:
        rect = fitz.Rect(*(float(coordinate) for coordinate in coordinates))
    except (TypeError, ValueError) as error:
        raise ValueError(f"{label} must contain only numbers") from error
    if rect.is_empty or rect.is_infinite:
        raise ValueError(f"{label} must describe a non-empty rectangle")
    return rect


def normalized_text(value: str) -> str:
    return " ".join(value.split())


def display_rect(page: fitz.Page, rect: fitz.Rect) -> fitz.Rect:
    """Return PDF geometry in the same coordinate space as ``page.rect``.

    PyMuPDF text blocks and drawing geometry are expressed in unrotated PDF
    coordinates. ``find_tables`` bounding boxes are expressed in displayed
    page coordinates. Comparing those values directly on a 90/270 degree page
    can produce a plausible-looking crop from the wrong side of the page.
    """

    return rect * page.rotation_matrix if page.rotation else fitz.Rect(rect)


def display_text_blocks(
    page: fitz.Page,
) -> list[tuple[float, float, float, float, str]]:
    blocks: list[tuple[float, float, float, float, str]] = []
    for block in page.get_text("blocks", sort=True):
        rect = display_rect(page, fitz.Rect(block[:4]))
        blocks.append((rect.x0, rect.y0, rect.x1, rect.y1, normalized_text(str(block[4]))))
    return sorted(blocks, key=lambda block: (block[1], block[0]))


def horizontal_grid_lines(page: fitz.Page, caption: fitz.Rect) -> list[fitz.Rect]:
    minimum_width = page.rect.width * 0.4
    lines: list[fitz.Rect] = []
    for drawing in page.get_drawings():
        rect = display_rect(page, fitz.Rect(drawing["rect"]))
        if (
            rect.y0 >= caption.y1 - 2
            and rect.height <= 1.5
            and rect.width >= minimum_width
        ):
            lines.append(rect)
    return sorted(lines, key=lambda rect: (rect.y0, rect.x0))


def next_table_caption_y(page: fitz.Page, caption: fitz.Rect) -> float | None:
    candidates = []
    for block in display_text_blocks(page):
        text = block[4]
        if block[1] > caption.y1 + 2 and TABLE_CAPTION_RE.match(text):
            candidates.append(block[1])
    return min(candidates) if candidates else None


def next_table_caption_x(page: fitz.Page, caption: fitz.Rect) -> float | None:
    candidates = []
    for block in display_text_blocks(page):
        text = block[4]
        if block[0] > caption.x1 + 2 and TABLE_CAPTION_RE.match(text):
            candidates.append(block[0])
    return min(candidates) if candidates else None


def locate_rotated_grid_from_drawings(
    page: fitz.Page, caption: fitz.Rect
) -> fitz.Rect | None:
    geometry = page.cropbox
    minimum_height = geometry.height * 0.4
    lines = []
    for drawing in page.get_drawings():
        rect = display_rect(page, fitz.Rect(drawing["rect"]))
        if (
            rect.x0 >= caption.x1 - 2
            and rect.width <= 1.5
            and rect.height >= minimum_height
        ):
            lines.append(rect)
    next_caption_x = next_table_caption_x(page, caption)
    if next_caption_x is not None:
        lines = [line for line in lines if line.x0 < next_caption_x]
    if not lines:
        return None

    nearby = [line for line in lines if line.x0 - caption.x1 <= 60]
    if not nearby:
        return None
    left = min(nearby, key=lambda line: line.x0)
    compatible = [
        line
        for line in lines
        if line.x0 >= left.x0
        and line.height >= left.height * 0.75
        and abs(line.y0 - left.y0) <= 6
        and abs(line.y1 - left.y1) <= 6
    ]
    if len(compatible) < 2:
        return None
    right = max(compatible, key=lambda line: line.x0)
    if right.x0 - left.x0 < 15:
        return None
    return fitz.Rect(
        left.x0,
        min(line.y0 for line in compatible),
        right.x0,
        max(line.y1 for line in compatible),
    )


def locate_grid_from_drawings(page: fitz.Page, caption: fitz.Rect) -> fitz.Rect | None:
    lines = horizontal_grid_lines(page, caption)
    next_caption_y = next_table_caption_y(page, caption)
    if next_caption_y is not None:
        lines = [line for line in lines if line.y0 < next_caption_y]
    if not lines:
        return None

    nearby = [line for line in lines if line.y0 - caption.y1 <= 60]
    if not nearby:
        return None
    top = min(nearby, key=lambda line: line.y0)

    compatible = [
        line
        for line in lines
        if line.y0 >= top.y0
        and line.width >= top.width * 0.75
        and abs(line.x0 - top.x0) <= 6
        and abs(line.x1 - top.x1) <= 6
    ]
    if len(compatible) < 2:
        return None

    bottom = max(compatible, key=lambda line: line.y0)
    if bottom.y0 - top.y0 < 15:
        return None
    return fitz.Rect(top.x0, top.y0, top.x1, bottom.y0)


def target_context_blocks(
    page: fitz.Page, identifier: str, caption: fitz.Rect
) -> list[tuple[float, float, float, float, str]]:
    blocks: list[tuple[float, float, float, float, str]] = []
    identifier_heading = re.compile(rf"^{re.escape(identifier)}(?:\s|$)")
    display_blocks = display_text_blocks(page)
    for block in display_blocks:
        text = block[4]
        if (
            block[1] < caption.y0
            and caption.y0 - block[1] <= 180
            and identifier_heading.match(text)
        ):
            blocks.append(block)
    if not blocks:
        return []

    heading = max(blocks, key=lambda block: block[1])
    context: list[tuple[float, float, float, float, str]] = []
    for block in display_blocks:
        if block[1] >= heading[1] - 0.5 and block[3] < caption.y0:
            context.append(block)
    return context


def horizontal_overlap(left: fitz.Rect, right: fitz.Rect) -> float:
    return max(0.0, min(left.x1, right.x1) - max(left.x0, right.x0))


def stored_table_is_compatible(
    page: fitz.Page, caption: fitz.Rect, table: fitz.Rect
) -> bool:
    """Reject a stored table box that cannot belong to the target caption."""

    gap = table.y0 - caption.y1
    required_overlap = min(caption.width, table.width) * 0.25
    return (
        table.width >= page.rect.width * 0.25
        and -4 <= gap <= 90
        and horizontal_overlap(caption, table) >= required_overlap
    )


def trailing_context_blocks(
    page: fitz.Page, table: fitz.Rect, next_caption_y: float | None
) -> list[tuple[float, float, float, float, str]]:
    """Keep footnotes and governing text immediately following the table."""

    limit = min(table.y1 + 180, next_caption_y - 4 if next_caption_y else page.rect.y1)
    trailing: list[tuple[float, float, float, float, str]] = []
    for block in display_text_blocks(page):
        rect = fitz.Rect(block[:4])
        text = block[4]
        if block[1] < table.y1 - 2 or block[1] >= limit:
            continue
        if horizontal_overlap(rect, table) < min(20.0, table.width * 0.1):
            continue
        if text.startswith("©") or re.match(r"^Page\s+\d+\b", text, re.IGNORECASE):
            continue
        trailing.append(block)
    return trailing


def clamp_rect(rect: fitz.Rect, page_rect: fitz.Rect) -> fitz.Rect:
    return fitz.Rect(
        max(page_rect.x0, rect.x0),
        max(page_rect.y0, rect.y0),
        min(page_rect.x1, rect.x1),
        min(page_rect.y1, rect.y1),
    )


def localize(
    page: fitz.Page,
    identifier: str,
    caption: fitz.Rect,
    stored_table: fitz.Rect | None,
) -> tuple[fitz.Rect, fitz.Rect, str, list[str]]:
    source_caption = fitz.Rect(caption)
    caption = display_rect(page, caption)
    if stored_table and stored_table_is_compatible(page, caption, stored_table):
        table = stored_table
        method = "stored_table_bbox"
    else:
        table = locate_grid_from_drawings(page, caption)
        method = "vector_grid_lines"
    if not table:
        raise RuntimeError(
            f"Table {identifier} could not be localized from its caption and PDF grid geometry"
        )

    context = target_context_blocks(page, identifier, caption)
    trailing = trailing_context_blocks(page, table, next_table_caption_y(page, caption))
    included = context + [
        (
            caption.x0,
            caption.y0,
            caption.x1,
            caption.y1,
            normalized_text(page.get_textbox(source_caption)),
        )
    ] + trailing
    left = min([table.x0, caption.x0, *(block[0] for block in context + trailing)])
    top = min([caption.y0, *(block[1] for block in context)])
    right = max([table.x1, caption.x1, *(block[2] for block in context + trailing)])
    bottom = max([table.y1, *(block[3] for block in trailing)])
    crop = clamp_rect(
        fitz.Rect(left - 10, top - 8, right + 10, bottom + 10), page.rect
    )

    seen_identifiers = set()
    for block in display_text_blocks(page):
        block_rect = fitz.Rect(block[:4])
        if not crop.intersects(block_rect):
            continue
        match = TABLE_CAPTION_RE.match(block[4])
        if match:
            seen_identifiers.add(match.group("identifier").rstrip("."))
    foreign = sorted(value for value in seen_identifiers if value != identifier)
    if foreign:
        raise RuntimeError(
            f"Localized crop for Table {identifier} also contains Table reference(s): {', '.join(foreign)}"
        )
    if identifier not in seen_identifiers:
        raise RuntimeError(
            f"Localized crop does not contain the requested Table {identifier} identity"
        )

    return crop, table, method, [normalized_text(block[4]) for block in included]


def arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--pdf", type=Path, required=True)
    parser.add_argument("--page-number", type=int, required=True)
    parser.add_argument("--table-identifier", required=True)
    parser.add_argument("--caption-bbox-json", required=True)
    parser.add_argument("--table-bbox-json")
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--scale", type=float, default=3.0)
    return parser.parse_args()


def main() -> None:
    args = arguments()
    caption = parse_rect(args.caption_bbox_json, "caption bbox")
    stored_table = (
        parse_rect(args.table_bbox_json, "table bbox")
        if args.table_bbox_json
        else None
    )
    document = fitz.open(args.pdf)
    if args.page_number < 1 or args.page_number > document.page_count:
        raise RuntimeError(
            f"Page {args.page_number} is outside the PDF page count {document.page_count}"
        )
    page = document[args.page_number - 1]
    crop, table, method, context = localize(
        page, args.table_identifier, caption, stored_table
    )
    args.output.parent.mkdir(parents=True, exist_ok=True)
    pixmap = page.get_pixmap(
        matrix=fitz.Matrix(args.scale, args.scale), clip=crop, alpha=False
    )
    pixmap.save(args.output)
    metadata: dict[str, Any] = {
        "page_number": args.page_number,
        "table_identifier": args.table_identifier,
        "crop_bbox_points": list(crop),
        "render_clip_bbox_points": list(crop),
        "table_bbox_points": list(table),
        "caption_bbox_points": list(caption),
        "locator_method": method,
        "context_text": context,
        "pixel_width": pixmap.width,
        "pixel_height": pixmap.height,
    }
    print(json.dumps(metadata, ensure_ascii=False))


if __name__ == "__main__":
    main()
