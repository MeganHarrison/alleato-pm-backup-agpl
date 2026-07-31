/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * Adapted for Alleato on 2026-07-31. See PLANE-NOTICE.md.
 */

export type PlanePageBlockType =
  | "paragraph"
  | "heading"
  | "bullet"
  | "numbered"
  | "quote"
  | "check";

export interface PlanePageBlock {
  id: string;
  type: PlanePageBlockType;
  text: string;
  checked?: boolean;
}

export interface PlanePageEditorDocument {
  id: string;
  title: string;
  blocks: PlanePageBlock[];
  updatedAt: string;
  updatedBy?: string;
}

export interface PlanePageVersion {
  id: string;
  pageId: string;
  title: string;
  blocks: PlanePageBlock[];
  createdAt: string;
  createdBy?: string;
}

export interface PlanePageComment {
  id: string;
  pageId: string;
  body: string;
  authorName: string;
  createdAt: string;
  resolvedAt?: string;
}

export interface PlanePagesEditorAdapter {
  capabilities?: {
    comments?: boolean;
    versions?: boolean;
  };
  loadDocument(pageId: string): Promise<PlanePageEditorDocument>;
  saveDocument(
    document: PlanePageEditorDocument,
  ): Promise<PlanePageEditorDocument>;
  listVersions(pageId: string): Promise<PlanePageVersion[]>;
  restoreVersion(
    pageId: string,
    versionId: string,
  ): Promise<PlanePageEditorDocument>;
  listComments(pageId: string): Promise<PlanePageComment[]>;
  createComment(pageId: string, body: string): Promise<PlanePageComment>;
  resolveComment(pageId: string, commentId: string): Promise<PlanePageComment>;
}

export class PlanePagesEditorAdapterError extends Error {
  readonly action: string;
  readonly recovery: string;

  constructor(action: string, message: string, recovery: string) {
    super(message);
    this.name = "PlanePagesEditorAdapterError";
    this.action = action;
    this.recovery = recovery;
  }
}
