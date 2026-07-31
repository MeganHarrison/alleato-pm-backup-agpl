/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * Adapted for Alleato on 2026-07-31. See PLANE-NOTICE.md.
 */

"use client";

import * as React from "react";
import {
  Archive,
  ArchiveRestore,
  ArrowLeft,
  History,
  MessageSquare,
  PanelRight,
  RotateCcw,
  Save,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ErrorState } from "@/components/ds/error-state";

import { clonePlanePageDocument } from "./editor-utils";
import { PlaneBlockEditor } from "./plane-block-editor";
import {
  PlanePagesEditorPanel,
  type PlanePageSidePanel,
} from "./plane-pages-editor-panel";
import type {
  PlanePageComment,
  PlanePageEditorDocument,
  PlanePagesEditorAdapter,
  PlanePageVersion,
} from "./types";
import { PlanePagesEditorAdapterError } from "./types";

type SaveState = "idle" | "dirty" | "saving" | "saved" | "error";

interface PlanePagesEditorProps {
  pageId: string;
  adapter: PlanePagesEditorAdapter;
  onBack?: () => void;
  archiveAction?: {
    archived: boolean;
    isWorking: boolean;
    onToggle: () => void;
  };
}

function editorErrorMessage(error: unknown, fallback: string) {
  if (error instanceof PlanePagesEditorAdapterError) {
    return `${error.message} ${error.recovery}`;
  }
  if (error instanceof Error && error.message.trim()) return error.message;
  return fallback;
}

export function PlanePagesEditor({
  pageId,
  adapter,
  onBack,
  archiveAction,
}: PlanePagesEditorProps) {
  const [document, setDocument] =
    React.useState<PlanePageEditorDocument | null>(null);
  const [versions, setVersions] = React.useState<PlanePageVersion[]>([]);
  const [comments, setComments] = React.useState<PlanePageComment[]>([]);
  const [saveState, setSaveState] = React.useState<SaveState>("idle");
  const [error, setError] = React.useState<string | null>(null);
  const [panel, setPanel] = React.useState<PlanePageSidePanel | null>(null);
  const [isWorking, setIsWorking] = React.useState(false);
  const titleRef = React.useRef<HTMLTextAreaElement>(null);
  const editRevisionRef = React.useRef(0);
  const supportsComments = adapter.capabilities?.comments !== false;
  const supportsVersions = adapter.capabilities?.versions !== false;

  const loadSecondaryData = React.useCallback(async () => {
    const [versionsResult, commentsResult] = await Promise.allSettled([
      supportsVersions ? adapter.listVersions(pageId) : Promise.resolve([]),
      supportsComments ? adapter.listComments(pageId) : Promise.resolve([]),
    ]);
    if (versionsResult.status === "fulfilled") {
      setVersions(versionsResult.value);
    }
    if (commentsResult.status === "fulfilled") {
      setComments(commentsResult.value);
    }
    if (
      versionsResult.status === "rejected" ||
      commentsResult.status === "rejected"
    ) {
      throw new PlanePagesEditorAdapterError(
        "load-secondary",
        "Page history or comments could not be loaded.",
        "Page editing is still available. Reopen the panel to try again.",
      );
    }
  }, [adapter, pageId, supportsComments, supportsVersions]);

  React.useEffect(() => {
    let isActive = true;
    setDocument(null);
    setError(null);
    adapter
      .loadDocument(pageId)
      .then((loadedDocument) => {
        if (!isActive) return;
        setDocument(clonePlanePageDocument(loadedDocument));
        editRevisionRef.current = 0;
        setSaveState("idle");
        void loadSecondaryData().catch((secondaryError) => {
          if (!isActive) return;
          setError(
            editorErrorMessage(
              secondaryError,
              "Page history or comments could not be loaded. Page editing is still available.",
            ),
          );
        });
      })
      .catch((loadError) => {
        if (!isActive) return;
        setError(
          editorErrorMessage(
            loadError,
            "The page could not be loaded. Return to Pages and try again.",
          ),
        );
      });
    return () => {
      isActive = false;
    };
  }, [adapter, loadSecondaryData, pageId]);

  const updateDocument = (
    updater: (current: PlanePageEditorDocument) => PlanePageEditorDocument,
  ) => {
    editRevisionRef.current += 1;
    setDocument((current) => (current ? updater(current) : current));
    setSaveState("dirty");
    setError(null);
  };

  const saveDocument = React.useCallback(async () => {
    if (!document || saveState === "saving") return;
    const revisionAtSave = editRevisionRef.current;
    setSaveState("saving");
    setError(null);
    try {
      const saved = await adapter.saveDocument(
        clonePlanePageDocument(document),
      );
      const hasNewerEdits = editRevisionRef.current !== revisionAtSave;
      setDocument((current) =>
        hasNewerEdits && current
          ? {
              ...current,
              updatedAt: saved.updatedAt,
              updatedBy: saved.updatedBy,
            }
          : clonePlanePageDocument(saved),
      );
      setSaveState(hasNewerEdits ? "dirty" : "saved");
      void loadSecondaryData().catch((secondaryError) => {
        setError(
          editorErrorMessage(
            secondaryError,
            "The page was saved, but comments or history could not refresh.",
          ),
        );
      });
    } catch (saveError) {
      setSaveState("error");
      setError(
        editorErrorMessage(
          saveError,
          "The page could not be saved. Your edits are still here. Try again.",
        ),
      );
    }
  }, [adapter, document, loadSecondaryData, saveState]);

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void saveDocument();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [saveDocument]);

  if (!document && !error) {
    return (
      <div
        className="flex h-full min-h-96 items-center justify-center bg-background"
        aria-label="Loading page editor"
      >
        <span className="text-sm text-muted-foreground">Loading page…</span>
      </div>
    );
  }

  if (!document) {
    return (
      <div className="flex h-full min-h-96 flex-col items-center justify-center gap-4 bg-background px-6 text-center">
        <div role="alert">
          <ErrorState title="Page unavailable" error={error} className="py-0" />
        </div>
        {onBack ? (
          <Button type="button" variant="outline" onClick={onBack}>
            <ArrowLeft className="size-4" />
            Back to Pages
          </Button>
        ) : null}
      </div>
    );
  }

  const togglePanel = (nextPanel: PlanePageSidePanel) => {
    if (nextPanel === "comments" && !supportsComments) {
      setPanel(null);
      setError(
        "Comments are not available for Alleato Pages yet. Page editing and saving remain available.",
      );
      return;
    }
    if (nextPanel === "history" && !supportsVersions) {
      setPanel(null);
      setError(
        "Version history is not available for Alleato Pages yet. Page editing and saving remain available.",
      );
      return;
    }

    const isOpening = panel !== nextPanel;
    setPanel((current) => (current === nextPanel ? null : nextPanel));
    if (isOpening) {
      setError(null);
      void loadSecondaryData().catch((secondaryError) => {
        setError(
          editorErrorMessage(
            secondaryError,
            "Page history or comments could not be loaded. Page editing is still available.",
          ),
        );
      });
    }
  };

  return (
    <div className="relative flex h-full min-h-0 w-full overflow-hidden bg-background">
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex min-h-14 shrink-0 items-center gap-2 border-b border-border px-2 sm:px-4">
          {onBack ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-11 shrink-0 rounded-md"
              aria-label="Back to Pages"
              onClick={onBack}
            >
              <ArrowLeft className="size-4" />
            </Button>
          ) : null}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">
              {document.title || "Untitled"}
            </p>
            <p className="text-xs text-muted-foreground" aria-live="polite">
              {saveState === "saving"
                ? "Saving…"
                : saveState === "saved"
                  ? "Saved"
                  : saveState === "dirty"
                    ? "Unsaved changes"
                    : saveState === "error"
                      ? "Save failed"
                      : "Page"}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-11 shrink-0 rounded-md"
            aria-label="Open comments"
            aria-pressed={panel === "comments"}
            title={
              supportsComments
                ? undefined
                : "Comments are not available for Alleato Pages yet."
            }
            onClick={() => togglePanel("comments")}
          >
            <MessageSquare className="size-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-11 shrink-0 rounded-md"
            aria-label="Open version history"
            aria-pressed={panel === "history"}
            title={
              supportsVersions
                ? undefined
                : "Version history is not available for Alleato Pages yet."
            }
            onClick={() => togglePanel("history")}
          >
            <History className="size-4" />
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={saveState === "saving" || saveState === "idle"}
            onClick={() => void saveDocument()}
          >
            {saveState === "error" ? (
              <RotateCcw className="size-4" />
            ) : (
              <Save className="size-4" />
            )}
            {saveState === "error" ? "Retry" : "Save"}
          </Button>
          {archiveAction ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-11 shrink-0 rounded-md"
              disabled={archiveAction.isWorking}
              aria-label={
                archiveAction.archived ? "Restore page" : "Archive page"
              }
              title={
                saveState === "dirty" ||
                saveState === "saving" ||
                saveState === "error"
                  ? "Save this page before changing its archive status."
                  : undefined
              }
              onClick={() => {
                if (
                  saveState === "dirty" ||
                  saveState === "saving" ||
                  saveState === "error"
                ) {
                  setError(
                    "Save this page before changing its archive status. Your unsaved edits are still here.",
                  );
                  return;
                }
                archiveAction.onToggle();
              }}
            >
              {archiveAction.archived ? (
                <ArchiveRestore className="size-4" />
              ) : (
                <Archive className="size-4" />
              )}
            </Button>
          ) : null}
        </header>

        {error ? (
          <div
            role="alert"
            className="bg-destructive/10 px-4 py-2 text-sm text-destructive"
          >
            <span>{error}</span>
          </div>
        ) : null}

        <div className="flex min-h-0 flex-1 flex-col">
          <div className="hidden min-h-13 shrink-0 items-center justify-end px-4 md:flex">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-11 rounded-md"
              aria-label="Open page information"
              onClick={() => togglePanel("history")}
            >
              <PanelRight className="size-4" />
            </Button>
          </div>
          <main className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto">
            <div className="mx-auto w-full max-w-3xl px-4 pb-16 sm:px-8">
              <div className="h-12" />
              <div className="relative py-3">
                <Textarea
                  ref={titleRef}
                  autoFocus
                  value={document.title}
                  maxLength={255}
                  rows={1}
                  placeholder="Untitled"
                  aria-label="Page title"
                  className="min-h-11 w-full resize-none rounded-none border-0 bg-transparent p-0 text-3xl font-semibold leading-tight tracking-tight shadow-none focus-visible:ring-0"
                  onChange={(event) =>
                    updateDocument((current) => ({
                      ...current,
                      title: event.target.value,
                    }))
                  }
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      window.document
                        .querySelector<HTMLTextAreaElement>(
                          '[aria-label^="Block 1,"]',
                        )
                        ?.focus();
                    }
                  }}
                />
                <span className="pointer-events-none absolute bottom-1 right-1 text-xs text-muted-foreground opacity-0 transition-opacity focus-within:opacity-100">
                  {document.title.length}/255
                </span>
              </div>
              <PlaneBlockEditor
                blocks={document.blocks}
                onChange={(blocks) =>
                  updateDocument((current) => ({ ...current, blocks }))
                }
              />
            </div>
          </main>
        </div>
      </div>

      {panel ? (
        <PlanePagesEditorPanel
          mode={panel}
          comments={comments}
          versions={versions}
          isWorking={isWorking}
          onModeChange={togglePanel}
          onClose={() => setPanel(null)}
          onComment={async (body) => {
            setIsWorking(true);
            setError(null);
            try {
              const comment = await adapter.createComment(pageId, body);
              setComments((current) => [comment, ...current]);
              return true;
            } catch (commentError) {
              setError(
                editorErrorMessage(
                  commentError,
                  "The comment could not be posted. Your text is still here.",
                ),
              );
              return false;
            } finally {
              setIsWorking(false);
            }
          }}
          onResolveComment={async (commentId) => {
            setIsWorking(true);
            setError(null);
            try {
              const resolved = await adapter.resolveComment(pageId, commentId);
              setComments((current) =>
                current.map((comment) =>
                  comment.id === resolved.id ? resolved : comment,
                ),
              );
            } catch (resolveError) {
              setError(
                editorErrorMessage(
                  resolveError,
                  "The comment could not be resolved. Refresh and try again.",
                ),
              );
            } finally {
              setIsWorking(false);
            }
          }}
          onRestoreVersion={async (versionId) => {
            setIsWorking(true);
            setError(null);
            try {
              const restored = await adapter.restoreVersion(pageId, versionId);
              editRevisionRef.current += 1;
              setDocument(clonePlanePageDocument(restored));
              setSaveState("dirty");
              setPanel(null);
              requestAnimationFrame(() => titleRef.current?.focus());
            } catch (restoreError) {
              setError(
                editorErrorMessage(
                  restoreError,
                  "The version could not be restored. Refresh and try again.",
                ),
              );
            } finally {
              setIsWorking(false);
            }
          }}
        />
      ) : null}
    </div>
  );
}
