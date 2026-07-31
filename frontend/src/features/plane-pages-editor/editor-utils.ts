/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * Adapted for Alleato on 2026-07-31. See PLANE-NOTICE.md.
 */

import type {
  PlanePageBlock,
  PlanePageBlockType,
  PlanePageEditorDocument,
} from "./types";

export const PLANE_PAGE_BLOCK_LABELS: Record<PlanePageBlockType, string> = {
  paragraph: "Text",
  heading: "Heading",
  bullet: "Bulleted list",
  numbered: "Numbered list",
  quote: "Quote",
  check: "To-do",
};

export function createPlanePageBlock(
  type: PlanePageBlockType = "paragraph",
  text = "",
): PlanePageBlock {
  return {
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `block-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    type,
    text,
    ...(type === "check" ? { checked: false } : {}),
  };
}

export function normalizePlanePageDocument(
  document: PlanePageEditorDocument,
): PlanePageEditorDocument {
  return {
    ...document,
    blocks:
      document.blocks.length > 0
        ? document.blocks.map((block) => ({ ...block }))
        : [createPlanePageBlock()],
  };
}

export function clonePlanePageDocument(
  document: PlanePageEditorDocument,
): PlanePageEditorDocument {
  return {
    ...document,
    blocks: document.blocks.map((block) => ({ ...block })),
  };
}
