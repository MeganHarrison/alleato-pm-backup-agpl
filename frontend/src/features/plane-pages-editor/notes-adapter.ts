/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * Adapted for Alleato on 2026-07-31. See PLANE-NOTICE.md.
 */

import {
  listProjectPages,
  type ProjectPage,
  updateProjectPage,
} from "@/features/plane-pages/plane-pages-data";

import {
  createPlanePageBlock,
  normalizePlanePageDocument,
} from "./editor-utils";
import type {
  PlanePageBlock,
  PlanePageEditorDocument,
  PlanePagesEditorAdapter,
} from "./types";
import { PlanePagesEditorAdapterError } from "./types";

const BLOCK_DOCUMENT_MARKER = "<!-- alleato-plane-pages-blocks:v1 -->";
const BLOCK_TYPES = new Set([
  "paragraph",
  "heading",
  "bullet",
  "numbered",
  "quote",
  "check",
]);

type StoredBlockDocument = {
  blocks: PlanePageBlock[];
};

function unavailable(action: string, capability: string): never {
  const verb = capability === "Comments" ? "are" : "is";
  throw new PlanePagesEditorAdapterError(
    action,
    `${capability} ${verb} not available for Alleato Pages yet.`,
    "Page editing and saving remain available.",
  );
}

function parsePageId(pageId: string): number {
  if (!/^[1-9]\d*$/.test(pageId)) {
    throw new PlanePagesEditorAdapterError(
      "load",
      "The requested project page has an invalid identifier.",
      "Return to Pages and open the page again.",
    );
  }

  const parsed = Number(pageId);
  if (!Number.isSafeInteger(parsed)) {
    throw new PlanePagesEditorAdapterError(
      "load",
      "The requested project page has an invalid identifier.",
      "Return to Pages and open the page again.",
    );
  }

  return parsed;
}

function parseStoredBlocks(body: string | null): PlanePageBlock[] {
  if (!body?.startsWith(BLOCK_DOCUMENT_MARKER)) {
    return [createPlanePageBlock("paragraph", body ?? "")];
  }

  try {
    const payload = JSON.parse(
      body.slice(BLOCK_DOCUMENT_MARKER.length).trim(),
    ) as StoredBlockDocument;

    if (!Array.isArray(payload.blocks)) throw new Error("Missing blocks");

    return payload.blocks.map((block) => {
      if (
        !block ||
        typeof block !== "object" ||
        typeof block.id !== "string" ||
        !BLOCK_TYPES.has(block.type)
      ) {
        throw new Error("Invalid block record");
      }

      return {
        id: block.id,
        type: block.type,
        text: String(block.text ?? ""),
        ...(block.type === "check" ? { checked: Boolean(block.checked) } : {}),
      };
    });
  } catch (error) {
    console.error(
      "Failed to parse the stored Plane Page block document",
      error,
    );
    throw new PlanePagesEditorAdapterError(
      "load",
      "This page contains a damaged block document and cannot be edited safely.",
      "Return to Pages and contact support with the page identifier.",
    );
  }
}

function serializeBlocks(blocks: PlanePageBlock[]): string {
  return `${BLOCK_DOCUMENT_MARKER}\n${JSON.stringify({ blocks })}`;
}

function toEditorDocument(page: ProjectPage): PlanePageEditorDocument {
  return normalizePlanePageDocument({
    id: String(page.id),
    title: page.title ?? "",
    blocks: parseStoredBlocks(page.body),
    updatedAt: page.updated_at ?? page.created_at,
    updatedBy: page.created_by ?? undefined,
  });
}

export function createProjectNotesEditorAdapter({
  projectId,
  onPageSaved,
}: {
  projectId: number;
  onPageSaved: (page: ProjectPage) => void;
}): PlanePagesEditorAdapter {
  return {
    capabilities: { comments: false, versions: false },

    async loadDocument(pageId) {
      const numericPageId = parsePageId(pageId);
      try {
        const pages = await listProjectPages(projectId);
        const page = pages.find((candidate) => candidate.id === numericPageId);
        if (!page) {
          throw new PlanePagesEditorAdapterError(
            "load",
            "The requested project page was not found.",
            "Return to Pages and refresh the list.",
          );
        }
        return toEditorDocument(page);
      } catch (error) {
        if (error instanceof PlanePagesEditorAdapterError) throw error;
        console.error("Failed to load a project-scoped Plane Page", {
          projectId,
          pageId: numericPageId,
          error,
        });
        throw new PlanePagesEditorAdapterError(
          "load",
          "The page could not be loaded from this project.",
          "Return to Pages and try again.",
        );
      }
    },

    async saveDocument(document) {
      const numericPageId = parsePageId(document.id);
      try {
        const page = await updateProjectPage(projectId, numericPageId, {
          title: document.title,
          body: serializeBlocks(document.blocks),
        });
        onPageSaved(page);
        return toEditorDocument(page);
      } catch (error) {
        console.error("Failed to save a project-scoped Plane Page", {
          projectId,
          pageId: numericPageId,
          error,
        });
        throw new PlanePagesEditorAdapterError(
          "save",
          "The page could not be saved to this project.",
          "Your edits are still here. Try Save again.",
        );
      }
    },

    async listVersions() {
      return unavailable("list-versions", "Version history");
    },

    async restoreVersion() {
      return unavailable("restore-version", "Version history");
    },

    async listComments() {
      return unavailable("list-comments", "Comments");
    },

    async createComment() {
      return unavailable("create-comment", "Comments");
    },

    async resolveComment() {
      return unavailable("resolve-comment", "Comments");
    },
  };
}

export const projectNotesBlockDocumentMarker = BLOCK_DOCUMENT_MARKER;
