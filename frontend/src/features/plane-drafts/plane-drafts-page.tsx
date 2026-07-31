/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * Directly adapted from makeplane/plane workspace Drafts templates at commit
 * 39856932cd6b9bd17eab0920506d628190b47af2:
 * - drafts/{page,layout,header}.tsx
 * - issues/workspace-draft/{root,draft-issue-block,empty-state,loader}.tsx
 *
 * Plane's MobX draft-issue store is adapted to Alleato's existing authenticated
 * workspace_artifacts API. See LICENSES/NOTICE-PLANE.md and /source.
 */

"use client";

import {
  Archive,
  Check,
  Copy,
  FilePenLine,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import React, {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useParams } from "next/navigation";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch } from "@/lib/api-client";
import { appToast as toast } from "@/lib/toast/app-toast";
import { cn } from "@/lib/utils";

import {
  buildPlaneDraftsUrl,
  formatPlaneDraftUpdatedAt,
  getPlaneDraftPreview,
  getPlaneDraftText,
  matchesPlaneDraftQuery,
  PLANE_DRAFT_TYPE_LABELS,
  type PlaneDraftArtifact,
  type PlaneDraftArtifactType,
} from "./plane-drafts-model";

type PlaneDraftsPageProps = {
  projectId?: number;
};

type PlaneDraftsResponse = {
  artifacts?: PlaneDraftArtifact[];
};

type EditorState = {
  artifact: PlaneDraftArtifact | null;
  title: string;
  text: string;
};

const EMPTY_EDITOR: EditorState = {
  artifact: null,
  title: "",
  text: "",
};

export function PlaneDraftsPage({ projectId }: PlaneDraftsPageProps) {
  const params = useParams<{ projectId?: string }>();
  const routeProjectId = Number.parseInt(params?.projectId ?? "", 10);
  const resolvedProjectId = projectId ?? (Number.isFinite(routeProjectId) && routeProjectId > 0 ? routeProjectId : null);
  const [drafts, setDrafts] = useState<PlaneDraftArtifact[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [saving, setSaving] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadDrafts = useCallback(async () => {
    if (!resolvedProjectId) {
      setLoading(false);
      setError("Drafts need a valid project before they can be loaded.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await apiFetch<PlaneDraftsResponse>(
        buildPlaneDraftsUrl(resolvedProjectId),
      );
      setDrafts(response.artifacts ?? []);
    } catch (loadError) {
      const message =
        loadError instanceof Error
          ? loadError.message
          : "Drafts could not be loaded.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [resolvedProjectId]);

  useEffect(() => {
    void loadDrafts();
  }, [loadDrafts]);

  const visibleDrafts = useMemo(
    () => drafts.filter((draft) => matchesPlaneDraftQuery(draft, query)),
    [drafts, query],
  );

  function openEditor(artifact?: PlaneDraftArtifact) {
    setPendingDeleteId(null);
    setEditor(
      artifact
        ? {
            artifact,
            title: artifact.title,
            text: getPlaneDraftText(artifact.content),
          }
        : EMPTY_EDITOR,
    );
  }

  async function saveDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editor) return;
    if (!resolvedProjectId) {
      setError("Drafts need a valid project before they can be saved.");
      return;
    }
    const title = editor.title.trim();
    if (!title) {
      setError("Enter a title before saving this draft.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      if (editor.artifact) {
        await apiFetch("/api/plane-drafts", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "update",
            project_id: resolvedProjectId,
            id: editor.artifact.id,
            version: editor.artifact.version,
            title,
            text: editor.text,
          }),
        });
        toast.success("Draft updated");
      } else {
        await apiFetch("/api/plane-drafts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "create",
            project_id: resolvedProjectId,
            title,
            text: editor.text,
          }),
        });
        toast.success("Draft created");
      }
      setEditor(null);
      await loadDrafts();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "The draft could not be saved.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function copyDraft(artifact: PlaneDraftArtifact) {
    if (!resolvedProjectId) return;
    setBusyId(artifact.id);
    setError(null);
    try {
      await apiFetch("/api/plane-drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "copy",
          project_id: resolvedProjectId,
          id: artifact.id,
        }),
      });
      toast.success("Draft copied");
      await loadDrafts();
    } catch (copyError) {
      setError(
        copyError instanceof Error
          ? copyError.message
          : "The draft could not be copied.",
      );
    } finally {
      setBusyId(null);
    }
  }

  async function updateDraftStatus(
    artifact: PlaneDraftArtifact,
    status: "final" | "archived",
  ) {
    if (!resolvedProjectId) return;
    setBusyId(artifact.id);
    setError(null);
    try {
      await apiFetch("/api/plane-drafts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: status === "archived" ? "archive" : "finalize",
          project_id: resolvedProjectId,
          id: artifact.id,
          version: artifact.version,
        }),
      });
      toast.success(
        status === "archived" ? "Draft archived" : "Draft finalized",
      );
      await loadDrafts();
    } catch (statusError) {
      setError(
        statusError instanceof Error
          ? statusError.message
          : "The draft status could not be changed.",
      );
    } finally {
      setBusyId(null);
    }
  }

  async function deleteDraft(artifact: PlaneDraftArtifact) {
    if (!resolvedProjectId) return;
    setBusyId(artifact.id);
    setError(null);
    try {
      await apiFetch("/api/plane-drafts", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_id: resolvedProjectId, id: artifact.id }),
      });
      toast.success("Draft deleted");
      setPendingDeleteId(null);
      await loadDrafts();
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "The draft could not be deleted.",
      );
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div
      className="flex h-full min-h-0 flex-col bg-white text-[#202124]"
      data-plane-drafts-root
    >
      <header className="flex min-h-11 items-center justify-between gap-3 border-b border-[#e5e7eb] px-4">
        <div className="flex min-w-0 items-center gap-2">
          <FilePenLine className="size-4 text-[#69707a]" aria-hidden="true" />
          <h1 className="truncate text-sm font-medium">Drafts</h1>
          {drafts.length > 0 ? (
            <span className="rounded-full bg-[#eef1f4] px-2 py-0.5 text-xs text-[#59616b]">
              {drafts.length}
            </span>
          ) : null}
        </div>
        <Button
          type="button"
          size="sm"
          className="h-8 bg-[#075985] px-3 text-white hover:bg-[#0c4a6e]"
          onClick={() => openEditor()}
        >
          <Plus className="size-3.5" />
          Draft work
        </Button>
      </header>

      <div className="flex min-h-11 items-center border-b border-[#e5e7eb] px-4">
        <label className="flex w-full max-w-sm items-center gap-2 text-[#69707a]">
          <Search className="size-4" aria-hidden="true" />
          <span className="sr-only">Search drafts</span>
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search drafts..."
            className="h-8 border-0 px-0 text-sm shadow-none focus-visible:ring-0"
          />
          {query ? (
            <button
              type="button"
              aria-label="Clear draft search"
              className="grid size-11 place-items-center rounded hover:bg-[#eef1f4] lg:size-8"
              onClick={() => setQuery("")}
            >
              <X className="size-3.5" />
            </button>
          ) : null}
        </label>
      </div>

      {error ? (
        <Alert variant="destructive" className="m-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {editor ? (
        <form
          className="space-y-3 border-b border-[#e5e7eb] bg-[#fafafa] px-4 py-4"
          onSubmit={saveDraft}
        >
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium">
              {editor.artifact ? "Edit draft" : "New draft"}
            </p>
            <button
              type="button"
              aria-label="Close draft editor"
              className="grid size-11 place-items-center rounded hover:bg-[#eef1f4] lg:size-8"
              onClick={() => setEditor(null)}
            >
              <X className="size-4" />
            </button>
          </div>
          <Input
            aria-label="Draft title"
            value={editor.title}
            onChange={(event) =>
              setEditor((current) =>
                current ? { ...current, title: event.target.value } : current,
              )
            }
            placeholder="Draft title"
            autoFocus
          />
          <Textarea
            aria-label="Draft content"
            value={editor.text}
            onChange={(event) =>
              setEditor((current) =>
                current ? { ...current, text: event.target.value } : current,
              )
            }
            placeholder="Capture the work before it is ready..."
            className="min-h-24 resize-y"
          />
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setEditor(null)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={saving}
              className="bg-[#075985] text-white hover:bg-[#0c4a6e]"
            >
              {saving ? "Saving..." : "Save draft"}
            </Button>
          </div>
        </form>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto">
        {loading ? (
          <div aria-label="Loading drafts">
            {Array.from({ length: 7 }, (_, index) => (
              <div
                key={index}
                className="flex min-h-14 animate-pulse items-center gap-3 border-b border-[#e5e7eb] px-4"
              >
                <span className="h-3 w-12 rounded bg-[#eef1f4]" />
                <span className="h-3 flex-1 rounded bg-[#eef1f4]" />
                <span className="h-3 w-24 rounded bg-[#eef1f4]" />
              </div>
            ))}
          </div>
        ) : error && drafts.length === 0 ? (
          <div className="grid min-h-72 place-items-center px-6 text-center">
            <div>
              <p className="text-sm font-medium">Drafts are unavailable</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => void loadDrafts()}
              >
                Retry
              </Button>
            </div>
          </div>
        ) : visibleDrafts.length === 0 ? (
          <div className="grid min-h-72 place-items-center px-6 text-center">
            <div className="max-w-sm">
              <FilePenLine
                className="mx-auto mb-3 size-8 text-[#a4a9b0]"
                aria-hidden="true"
              />
              <p className="text-sm font-medium">
                {query ? "No matching drafts" : "No drafts yet"}
              </p>
              <p className="mt-1 text-sm text-[#69707a]">
                {query
                  ? "Try a different title, type, or phrase."
                  : "Save unfinished work here and return to it when you are ready."}
              </p>
              {!query ? (
                <Button
                  type="button"
                  size="sm"
                  className="mt-4 bg-[#075985] text-white hover:bg-[#0c4a6e]"
                  onClick={() => openEditor()}
                >
                  Draft work
                </Button>
              ) : null}
            </div>
          </div>
        ) : (
          visibleDrafts.map((artifact) => {
            const busy = busyId === artifact.id;
            const confirmingDelete = pendingDeleteId === artifact.id;
            return (
              <article
                key={artifact.id}
                className="group flex min-h-14 flex-col gap-2 border-b border-[#e5e7eb] px-4 py-3 hover:bg-[#fafafa] lg:flex-row lg:items-center"
              >
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <span className="mt-0.5 shrink-0 text-[11px] font-medium uppercase text-[#858b93]">
                    {artifact.project_id
                      ? `P${artifact.project_id}`
                      : "Workspace"}
                  </span>
                  <button
                    type="button"
                    className="min-w-0 flex-1 text-left"
                    onDoubleClick={() => openEditor(artifact)}
                    onClick={() => openEditor(artifact)}
                  >
                    <span className="block truncate text-[13px] font-medium">
                      {artifact.title}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-[#69707a]">
                      {getPlaneDraftPreview(artifact.content)}
                    </span>
                  </button>
                </div>

                <div className="flex shrink-0 items-center gap-2 pl-14 lg:pl-0">
                  <span className="rounded border border-[#dfe3e8] px-2 py-0.5 text-[11px] text-[#59616b]">
                    {PLANE_DRAFT_TYPE_LABELS[
                      artifact.artifact_type as PlaneDraftArtifactType
                    ] ?? "Draft"}
                  </span>
                  <span className="hidden min-w-24 text-xs text-[#858b93] xl:block">
                    {formatPlaneDraftUpdatedAt(artifact.updated_at)}
                  </span>

                  {confirmingDelete ? (
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-[#b42318]">Delete?</span>
                      <button
                        type="button"
                        aria-label={`Confirm delete ${artifact.title}`}
                        className="grid size-11 place-items-center rounded text-[#b42318] hover:bg-[#feeceb] lg:size-8"
                        disabled={busy}
                        onClick={() => void deleteDraft(artifact)}
                      >
                        <Check className="size-3.5" />
                      </button>
                      <button
                        type="button"
                        aria-label={`Cancel delete ${artifact.title}`}
                        className="grid size-11 place-items-center rounded hover:bg-[#eef1f4] lg:size-8"
                        onClick={() => setPendingDeleteId(null)}
                      >
                        <X className="size-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div
                      className={cn(
                        "flex items-center opacity-100 lg:opacity-0 lg:group-hover:opacity-100 lg:group-focus-within:opacity-100",
                        busy && "pointer-events-none opacity-40",
                      )}
                    >
                      <DraftAction
                        label={`Edit ${artifact.title}`}
                        icon={Pencil}
                        onClick={() => openEditor(artifact)}
                      />
                      <DraftAction
                        label={`Copy ${artifact.title}`}
                        icon={Copy}
                        onClick={() => void copyDraft(artifact)}
                      />
                      <DraftAction
                        label={`Finalize ${artifact.title}`}
                        icon={Check}
                        onClick={() =>
                          void updateDraftStatus(artifact, "final")
                        }
                      />
                      <DraftAction
                        label={`Archive ${artifact.title}`}
                        icon={Archive}
                        onClick={() =>
                          void updateDraftStatus(artifact, "archived")
                        }
                      />
                      <DraftAction
                        label={`Delete ${artifact.title}`}
                        icon={Trash2}
                        destructive
                        onClick={() => setPendingDeleteId(artifact.id)}
                      />
                    </div>
                  )}
                </div>
              </article>
            );
          })
        )}
      </div>
    </div>
  );
}

function DraftAction({
  label,
  icon: Icon,
  destructive = false,
  onClick,
}: {
  label: string;
  icon: typeof Pencil;
  destructive?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        "grid size-11 place-items-center rounded text-[#69707a] hover:bg-[#eef1f4] hover:text-[#202124] lg:size-8",
        destructive && "hover:bg-[#feeceb] hover:text-[#b42318]",
      )}
      onClick={onClick}
    >
      <Icon className="size-3.5" />
    </button>
  );
}
