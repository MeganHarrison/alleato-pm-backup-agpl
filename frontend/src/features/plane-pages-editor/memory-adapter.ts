import {
  clonePlanePageDocument,
  normalizePlanePageDocument,
} from "./editor-utils";
import type {
  PlanePageComment,
  PlanePageEditorDocument,
  PlanePagesEditorAdapter,
  PlanePageVersion,
} from "./types";
import { PlanePagesEditorAdapterError } from "./types";

interface MemoryAdapterSeed {
  documents: PlanePageEditorDocument[];
  versions?: PlanePageVersion[];
  comments?: PlanePageComment[];
  authorName?: string;
}

const cloneVersion = (version: PlanePageVersion): PlanePageVersion => ({
  ...version,
  blocks: version.blocks.map((block) => ({ ...block })),
});

export function createMemoryPlanePagesEditorAdapter(
  seed: MemoryAdapterSeed,
): PlanePagesEditorAdapter {
  const documents = new Map(
    seed.documents.map((document) => [
      document.id,
      normalizePlanePageDocument(clonePlanePageDocument(document)),
    ]),
  );
  const versions = (seed.versions ?? []).map(cloneVersion);
  const comments = (seed.comments ?? []).map((comment) => ({ ...comment }));
  const authorName = seed.authorName ?? "Current user";

  const requireDocument = (pageId: string) => {
    const document = documents.get(pageId);
    if (!document) {
      throw new PlanePagesEditorAdapterError(
        "load",
        `Page ${pageId} was not found.`,
        "Return to Pages and choose an available page.",
      );
    }
    return document;
  };

  return {
    async loadDocument(pageId) {
      return clonePlanePageDocument(requireDocument(pageId));
    },
    async saveDocument(document) {
      requireDocument(document.id);
      const saved = {
        ...normalizePlanePageDocument(clonePlanePageDocument(document)),
        updatedAt: new Date().toISOString(),
        updatedBy: authorName,
      };
      documents.set(saved.id, saved);
      versions.unshift({
        id: `version-${versions.length + 1}`,
        pageId: saved.id,
        title: saved.title,
        blocks: saved.blocks.map((block) => ({ ...block })),
        createdAt: saved.updatedAt,
        createdBy: saved.updatedBy,
      });
      return clonePlanePageDocument(saved);
    },
    async listVersions(pageId) {
      requireDocument(pageId);
      return versions
        .filter((version) => version.pageId === pageId)
        .map(cloneVersion);
    },
    async restoreVersion(pageId, versionId) {
      requireDocument(pageId);
      const version = versions.find(
        (candidate) =>
          candidate.pageId === pageId && candidate.id === versionId,
      );
      if (!version) {
        throw new PlanePagesEditorAdapterError(
          "restore",
          "That version is no longer available.",
          "Refresh history and choose another version.",
        );
      }
      const restored = {
        id: pageId,
        title: version.title,
        blocks: version.blocks.map((block) => ({ ...block })),
        updatedAt: new Date().toISOString(),
        updatedBy: authorName,
      };
      documents.set(pageId, restored);
      return clonePlanePageDocument(restored);
    },
    async listComments(pageId) {
      requireDocument(pageId);
      return comments
        .filter((comment) => comment.pageId === pageId)
        .map((comment) => ({ ...comment }));
    },
    async createComment(pageId, body) {
      requireDocument(pageId);
      const trimmedBody = body.trim();
      if (!trimmedBody) {
        throw new PlanePagesEditorAdapterError(
          "comment",
          "A comment cannot be empty.",
          "Enter a comment before posting.",
        );
      }
      const comment: PlanePageComment = {
        id: `comment-${comments.length + 1}`,
        pageId,
        body: trimmedBody,
        authorName,
        createdAt: new Date().toISOString(),
      };
      comments.unshift(comment);
      return { ...comment };
    },
    async resolveComment(pageId, commentId) {
      requireDocument(pageId);
      const comment = comments.find(
        (candidate) =>
          candidate.pageId === pageId && candidate.id === commentId,
      );
      if (!comment) {
        throw new PlanePagesEditorAdapterError(
          "resolve",
          "That comment is no longer available.",
          "Refresh the discussion and try again.",
        );
      }
      comment.resolvedAt = new Date().toISOString();
      return { ...comment };
    },
  };
}
