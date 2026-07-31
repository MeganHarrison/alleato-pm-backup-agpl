/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * Adapted for Alleato on 2026-07-30. See PLANE-NOTICE.md.
 */

"use client";

import * as React from "react";
import { PanelRight, RotateCcw, SmilePlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

import type { ProjectPage } from "./plane-pages-data";
import { PlanePageDetailsPrimaryHeader } from "./plane-pages-header";

export type PageSaveState = "idle" | "saving" | "saved" | "error";

export interface PageDraft {
  title: string;
  body: string;
}

function SaveStatus({
  state,
  onRetry,
}: {
  state: PageSaveState;
  onRetry: () => void;
}) {
  if (state === "error") {
    return (
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-destructive">Save failed</span>
        <Button type="button" variant="ghost" size="xs" onClick={onRetry}>
          <RotateCcw className="size-3" />
          Retry
        </Button>
      </div>
    );
  }

  return (
    <span className="text-xs text-muted-foreground" aria-live="polite">
      {state === "saving" ? "Saving…" : state === "saved" ? "Saved" : ""}
    </span>
  );
}

export function PlanePageEditor({
  page,
  draft,
  saveState,
  isArchiving,
  onBack,
  onDraftChange,
  onSave,
  onToggleArchived,
}: {
  page: ProjectPage;
  draft: PageDraft;
  saveState: PageSaveState;
  isArchiving: boolean;
  onBack: () => void;
  onDraftChange: (draft: PageDraft) => void;
  onSave: () => void;
  onToggleArchived: () => void;
}) {
  const bodyRef = React.useRef<HTMLTextAreaElement>(null);

  return (
    <div className="relative flex h-full min-h-0 w-full flex-col overflow-hidden bg-background">
      <PlanePageDetailsPrimaryHeader
        page={page}
        saveStatus={<SaveStatus state={saveState} onRetry={onSave} />}
        isArchiving={isArchiving}
        onBack={onBack}
        onToggleArchived={onToggleArchived}
      />

      <div
        data-plane-page-toolbar
        className="relative flex min-h-[52px] shrink-0 items-center justify-end px-3 sm:px-5"
      >
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          disabled
          title="Outline and version history require Plane collaboration metadata."
          aria-label="Open page information"
        >
          <PanelRight className="size-3.5" />
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto">
        <div className="mx-auto block w-full max-w-[720px] px-6 pb-64 sm:px-8">
          <div className="group/page-header flex h-12 items-end">
            <button
              type="button"
              disabled
              title="Page icons require Plane logo metadata."
              className="flex items-center gap-1 rounded-sm p-1 text-[13px] font-medium text-muted-foreground opacity-0 transition-all group-hover/page-header:opacity-100 disabled:cursor-not-allowed"
            >
              <SmilePlus className="size-4" />
              Icon
            </button>
          </div>

          <div className="relative w-full shrink-0 py-3">
            <Textarea
              autoFocus
              value={draft.title}
              onChange={(event) =>
                onDraftChange({ ...draft, title: event.target.value })
              }
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  bodyRef.current?.focus();
                }
              }}
              maxLength={255}
              rows={1}
              placeholder="Untitled"
              aria-label="Page title"
              className="block min-h-10 w-full resize-none rounded-none border-0 bg-transparent p-0 text-[2rem] font-bold leading-[2.375rem] tracking-[-0.02em] shadow-none focus-visible:border-0 focus-visible:ring-0"
            />
            <span className="pointer-events-none absolute bottom-1 right-1 text-[11px] text-muted-foreground opacity-0 transition-opacity focus-within:opacity-100">
              {draft.title.length}/255
            </span>
          </div>

          <Textarea
            ref={bodyRef}
            value={draft.body}
            onChange={(event) =>
              onDraftChange({ ...draft, body: event.target.value })
            }
            onKeyDown={(event) => {
              if (
                (event.metaKey || event.ctrlKey) &&
                event.key.toLowerCase() === "s"
              ) {
                event.preventDefault();
                onSave();
              }
            }}
            placeholder="Start writing…"
            aria-label="Page content"
            className="mt-2 min-h-[420px] w-full resize-none rounded-none border-0 bg-transparent p-0 text-[15px] leading-7 shadow-none focus-visible:border-0 focus-visible:ring-0"
          />
        </div>
      </div>
    </div>
  );
}
