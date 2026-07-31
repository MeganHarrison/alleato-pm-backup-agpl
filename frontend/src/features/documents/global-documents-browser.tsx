"use client";

import * as React from "react";

import { ProjectDocumentsBrowser } from "@/features/documents/project-documents-browser";

/**
 * Global document library consumer of the canonical project document browser.
 * The global route leaves project scope unset while preserving the exact same
 * rail, card, toolbar, preview, and full-height overflow contract.
 */
export function GlobalDocumentsBrowser(): React.ReactElement {
  return <ProjectDocumentsBrowser />;
}
