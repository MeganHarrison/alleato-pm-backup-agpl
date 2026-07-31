"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";

import { triggerBrowserDownload } from "@/lib/browser-download";

export interface UsePdfExportOptions {
  /**
   * The PDF endpoint to fetch, e.g.
   * `/api/projects/876/change-events/<id>/pdf`. Any route that streams a
   * `application/pdf` body works — bespoke per-tool routes and the generic
   * `/api/document-center/[recordType]/[recordId]/pdf` route alike.
   */
  endpoint: string;
  /** Downloaded file name. `.pdf` is appended automatically if missing. */
  filename: string;
  loadingMessage?: string;
  successMessage?: string;
  errorMessage?: string;
}

/**
 * Fetches a PDF endpoint and triggers a browser download, with loading/success/
 * error toasts. Plain async function — use this directly from imperative or
 * per-row call sites (e.g. a table row action) where a hook can't be called.
 * {@link usePdfExport} wraps this for the common single-button case.
 */
export async function downloadPdf({
  endpoint,
  filename,
  loadingMessage = "Generating PDF…",
  successMessage = "PDF downloaded",
  errorMessage = "Failed to generate PDF",
}: UsePdfExportOptions): Promise<void> {
  const toastId = `pdf-export:${endpoint}`;
  toast.loading(loadingMessage, { id: toastId });

  try {
    const downloadName = filename.toLowerCase().endsWith(".pdf") ? filename : `${filename}.pdf`;
    // Delegate transport to the shared downloader: it refreshes + attaches a
    // Supabase bearer token (robust against cookie/refresh races) and validates
    // the response is actually a PDF, not a JSON error rendered with a 200.
    await triggerBrowserDownload(endpoint, downloadName, "application/pdf");
    toast.success(successMessage, { id: toastId });
  } catch (error) {
    // Surface the real failure so a broken export is never silent (see CLAUDE.md).
    toast.error(errorMessage, {
      id: toastId,
      description: error instanceof Error ? error.message : undefined,
    });
  }
}

export interface UsePdfExportResult {
  /** Fetches the PDF and triggers a browser download. Safe to wire to any trigger. */
  exportPdf: () => Promise<void>;
  /** True while a download is in flight — drive a spinner / disabled state off this. */
  isExporting: boolean;
}

/**
 * Single source of truth for "download this record as a PDF". Encapsulates the
 * fetch-blob → object-URL → anchor-click → toast dance that was previously
 * copy-pasted into every detail page, so adding export to a new tool is one hook
 * call wired to any button or menu item — no per-page boilerplate.
 */
export function usePdfExport({
  endpoint,
  filename,
  loadingMessage = "Generating PDF…",
  successMessage = "PDF downloaded",
  errorMessage = "Failed to generate PDF",
}: UsePdfExportOptions): UsePdfExportResult {
  const [isExporting, setIsExporting] = useState(false);

  const exportPdf = useCallback(async () => {
    setIsExporting(true);
    try {
      await downloadPdf({ endpoint, filename, loadingMessage, successMessage, errorMessage });
    } finally {
      setIsExporting(false);
    }
  }, [endpoint, filename, loadingMessage, successMessage, errorMessage]);

  return { exportPdf, isExporting };
}
