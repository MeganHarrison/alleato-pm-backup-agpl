/**
 * Directly adapted from Plane's project issue-list and peek-overview templates:
 * - apps/web/core/components/issues/issue-layouts/list/default.tsx
 * - apps/web/core/components/issues/issue-layouts/list/list-group.tsx
 * - apps/web/core/components/issues/issue-layouts/list/block.tsx
 * - apps/web/core/components/issues/peek-overview/header.tsx
 * Revision: 39856932cd6b9bd17eab0920506d628190b47af2
 *
 * Copyright (c) 2023-present Plane Software, Inc. and contributors.
 * SPDX-License-Identifier: AGPL-3.0-only
 * See LICENSES/NOTICE-PLANE.md and /auth/source for corresponding source.
 */

"use client";

import {
  ArchiveRestore,
  ChevronDown,
  ChevronRight,
  CircleDot,
  FileCheck2,
  Filter,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import Link from "next/link";
import { type FormEvent, useMemo, useState } from "react";

import {
  type SubmittalSummary,
  useCreateSubmittal,
  useDeleteSubmittal,
  useRestoreSubmittal,
  useSubmittals,
  useUpdateSubmittal,
} from "@/hooks/use-submittals";
import { cn } from "@/lib/utils";

import {
  displaySubmittalDate,
  displaySubmittalType,
  filterSubmittals,
  SUBMITTAL_STATUSES,
  type SubmittalStatusFilter,
} from "./plane-submittals-model";

type PlaneSubmittalsPageProps = {
  projectId: number;
  projectName: string;
};

type SubmittalListTab = "items" | "recycle-bin";
type EditableSubmittalStatus = Exclude<SubmittalStatusFilter, "all">;

const STATUS_STYLES: Record<string, string> = {
  Draft: "border-[#d8dce1] bg-[#f5f6f7] text-[#59616b]",
  Open: "border-[#bfdbfe] bg-[#eff6ff] text-[#1d4ed8]",
  Distributed: "border-[#c7d2fe] bg-[#eef2ff] text-[#4338ca]",
  Closed: "border-[#bbf7d0] bg-[#f0fdf4] text-[#15803d]",
};

function MutationNotice({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div
      role="alert"
      className="border-b border-[#fecaca] bg-[#fff7f7] px-4 py-2 text-xs text-[#b91c1c]"
    >
      {message}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1.5 rounded border px-2 text-[11px] font-medium",
        STATUS_STYLES[status] ?? "border-[#d8dce1] bg-[#f5f6f7] text-[#59616b]",
      )}
    >
      <CircleDot className="size-3" />
      {status}
    </span>
  );
}

function SubmittalRow({
  submittal,
  selected,
  onSelect,
}: {
  submittal: SubmittalSummary;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "grid min-h-11 w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-[#eceef0] px-4 text-left hover:bg-[#f8f9fa]",
        selected && "bg-[#f2f3f4]",
      )}
    >
      <span className="flex min-w-0 items-center gap-3">
        <FileCheck2 className="size-4 shrink-0 text-[#858b93]" />
        <span className="min-w-0">
          <span className="flex min-w-0 items-baseline gap-2">
            <span className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-[#858b93]">
              {submittal.submittal_number}
            </span>
            <span className="truncate text-[13px] font-medium text-[#292d32]">
              {submittal.title}
            </span>
          </span>
          <span className="mt-0.5 flex min-w-0 gap-2 text-[11px] text-[#7b8189] md:hidden">
            <span className="truncate">
              {submittal.specification_section ||
                displaySubmittalType(submittal.submittal_type)}
            </span>
            <span aria-hidden="true">·</span>
            <span className="shrink-0">
              {displaySubmittalDate(submittal.final_due_date)}
            </span>
          </span>
        </span>
      </span>
      <span className="flex items-center gap-3">
        <span className="hidden w-28 truncate text-[11px] text-[#69707a] lg:block">
          {submittal.specification_section || "No spec section"}
        </span>
        <span className="hidden w-24 text-[11px] text-[#69707a] md:block">
          {displaySubmittalDate(submittal.final_due_date)}
        </span>
        <StatusPill status={submittal.status} />
        <ChevronRight className="size-3.5 text-[#a1a6ad]" />
      </span>
    </button>
  );
}

function EmptyList({
  filtered,
  tab,
}: {
  filtered: boolean;
  tab: SubmittalListTab;
}) {
  return (
    <div className="grid flex-1 place-items-center px-6 py-16 text-center">
      <div>
        <FileCheck2 className="mx-auto size-6 text-[#a1a6ad]" />
        <p className="mt-3 text-sm font-medium text-[#34383e]">
          {filtered
            ? "No matching submittals"
            : tab === "recycle-bin"
              ? "Recycle bin is empty"
              : "No submittals yet"}
        </p>
        <p className="mt-1 text-xs text-[#7b8189]">
          {filtered
            ? "Change the search or status filter."
            : tab === "recycle-bin"
              ? "Deleted submittals will appear here."
              : "Create the first submittal for this project."}
        </p>
      </div>
    </div>
  );
}

export function PlaneSubmittalsPage({
  projectId,
  projectName,
}: PlaneSubmittalsPageProps) {
  const [tab, setTab] = useState<SubmittalListTab>("items");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<SubmittalStatusFilter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [number, setNumber] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);

  const list = useSubmittals(
    projectId,
    tab === "recycle-bin" ? "recycle-bin" : undefined,
  );
  const createSubmittal = useCreateSubmittal(projectId);
  const updateSubmittal = useUpdateSubmittal(projectId, selectedId ?? "");
  const deleteSubmittal = useDeleteSubmittal(projectId);
  const restoreSubmittal = useRestoreSubmittal(projectId);
  const selected =
    list.data?.find((submittal) => submittal.id === selectedId) ?? null;
  const visibleSubmittals = useMemo(
    () => filterSubmittals(list.data ?? [], query, status),
    [list.data, query, status],
  );

  function reportMutationFailure(error: unknown, action: string) {
    setActionError(
      error instanceof Error
        ? `${action} failed: ${error.message}`
        : `${action} failed. Retry the action or refresh the list.`,
    );
  }

  async function submitNewSubmittal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setActionError(null);
    try {
      const created = await createSubmittal.mutateAsync({
        title: title.trim(),
        submittal_number: number.trim(),
        status: "Draft",
      });
      setTitle("");
      setNumber("");
      setCreateOpen(false);
      setSelectedId(created.id);
    } catch (error) {
      reportMutationFailure(error, "Create submittal");
    }
  }

  async function changeStatus(nextStatus: EditableSubmittalStatus) {
    if (!selected) return;
    setActionError(null);
    try {
      await updateSubmittal.mutateAsync({ status: nextStatus });
    } catch (error) {
      reportMutationFailure(error, "Update status");
    }
  }

  async function moveSelected() {
    if (!selected) return;
    setActionError(null);
    try {
      if (tab === "recycle-bin") {
        await restoreSubmittal.mutateAsync(selected.id);
      } else {
        await deleteSubmittal.mutateAsync(selected.id);
      }
      setSelectedId(null);
    } catch (error) {
      reportMutationFailure(
        error,
        tab === "recycle-bin" ? "Restore submittal" : "Move to recycle bin",
      );
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-1 overflow-hidden bg-white text-[#202124]">
      <main className="flex min-w-0 flex-1 flex-col">
        <div className="flex min-h-11 shrink-0 flex-wrap items-center gap-2 border-b border-[#e5e7eb] px-4 py-1.5">
          <span className="max-w-48 truncate text-xs text-[#69707a]">
            {projectName}
          </span>
          <ChevronRight className="size-3 text-[#a1a6ad]" />
          <span className="text-xs font-medium text-[#292d32]">Submittals</span>
          <span className="rounded-full bg-[#e0f2fe] px-2 py-0.5 text-[10px] font-medium text-[#0369a1]">
            {list.data?.length ?? 0}
          </span>
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="inline-flex h-8 items-center gap-1.5 rounded bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="size-3.5" />
              <span className="hidden sm:inline">Add submittal</span>
              <span className="sm:hidden">Add</span>
            </button>
          </div>
        </div>

        <div className="flex min-h-10 shrink-0 items-center gap-1 border-b border-[#e5e7eb] px-3">
          {(["items", "recycle-bin"] as const).map((nextTab) => (
            <button
              key={nextTab}
              type="button"
              onClick={() => {
                setTab(nextTab);
                setSelectedId(null);
              }}
              className={cn(
                "h-8 rounded px-2.5 text-xs text-[#69707a] hover:bg-[#f2f3f4]",
                tab === nextTab && "bg-[#eceeef] font-medium text-[#292d32]",
              )}
            >
              {nextTab === "items" ? "All submittals" : "Recycle bin"}
            </button>
          ))}
          <div className="ml-auto flex items-center gap-1">
            <label className="relative hidden sm:block">
              <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-[#858b93]" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                aria-label="Search submittals"
                placeholder="Search..."
                className="h-7 w-40 rounded border border-[#d9dce1] bg-white pl-7 pr-2 text-xs outline-none focus:border-[#9aa0a8]"
              />
            </label>
            <label className="relative">
              <Filter className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-[#858b93]" />
              <select
                value={status}
                onChange={(event) =>
                  setStatus(event.target.value as SubmittalStatusFilter)
                }
                aria-label="Filter by status"
                className="h-7 appearance-none rounded border border-[#d9dce1] bg-white pl-7 pr-7 text-xs text-[#4f5660] outline-none focus:border-[#9aa0a8]"
              >
                {SUBMITTAL_STATUSES.map((option) => (
                  <option key={option} value={option}>
                    {option === "all" ? "All statuses" : option}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 top-1/2 size-3 -translate-y-1/2 text-[#858b93]" />
            </label>
          </div>
        </div>

        <MutationNotice message={actionError} />

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          <label className="relative border-b border-[#e5e7eb] p-2 sm:hidden">
            <Search className="pointer-events-none absolute left-4 top-1/2 size-3.5 -translate-y-1/2 text-[#858b93]" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              aria-label="Search submittals"
              placeholder="Search submittals..."
              className="h-8 w-full rounded border border-[#d9dce1] bg-white pl-8 pr-3 text-xs outline-none"
            />
          </label>

          {list.isLoading ? (
            <div className="space-y-px" aria-label="Loading submittals">
              {[0, 1, 2, 3, 4].map((item) => (
                <div
                  key={item}
                  className="h-11 animate-pulse border-b border-[#eceef0] bg-[#fafafa]"
                />
              ))}
            </div>
          ) : list.isError ? (
            <div className="grid flex-1 place-items-center p-6 text-center">
              <div>
                <p className="text-sm font-medium text-[#34383e]">
                  Submittals could not load
                </p>
                <p className="mt-1 max-w-sm text-xs text-[#7b8189]">
                  {list.error instanceof Error
                    ? list.error.message
                    : "The project submittals request failed."}
                </p>
                <button
                  type="button"
                  onClick={() => void list.refetch()}
                  className="mt-3 h-8 rounded border border-[#d9dce1] px-3 text-xs font-medium hover:bg-[#f5f6f7]"
                >
                  Retry
                </button>
              </div>
            </div>
          ) : visibleSubmittals.length ? (
            <div>
              <div className="flex h-9 items-center border-b border-[#e5e7eb] px-4 text-xs font-medium text-[#59616b]">
                <span>All submittals</span>
                <span className="ml-2 text-[11px] font-normal text-[#858b93]">
                  {visibleSubmittals.length}
                </span>
              </div>
              {visibleSubmittals.map((submittal) => (
                <SubmittalRow
                  key={submittal.id}
                  submittal={submittal}
                  selected={submittal.id === selectedId}
                  onSelect={() => setSelectedId(submittal.id)}
                />
              ))}
            </div>
          ) : (
            <EmptyList
              filtered={Boolean(query.trim()) || status !== "all"}
              tab={tab}
            />
          )}
        </div>
      </main>

      {selected ? (
        <>
          <button
            type="button"
            aria-label="Close submittal details"
            onClick={() => setSelectedId(null)}
            className="fixed inset-0 z-40 bg-black/20 md:hidden"
          />
          <aside
            aria-label="Submittal details"
            className="fixed inset-y-0 right-0 z-50 flex w-[min(100vw,420px)] flex-col border-l border-[#e5e7eb] bg-white md:static md:z-auto md:w-[380px]"
          >
            <div className="flex min-h-11 items-center border-b border-[#e5e7eb] px-4">
              <span className="text-[11px] font-medium uppercase tracking-wide text-[#858b93]">
                {selected.submittal_number}
              </span>
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                className="ml-auto grid size-7 place-items-center rounded hover:bg-[#f2f3f4]"
                aria-label="Close details"
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-5">
              <div
                role="heading"
                aria-level={2}
                className="text-lg font-semibold leading-6 text-[#292d32]"
              >
                {selected.title}
              </div>
              <div className="mt-6 space-y-4">
                <div className="grid grid-cols-[112px_minmax(0,1fr)] items-center gap-3">
                  <span className="text-xs text-[#7b8189]">Status</span>
                  <select
                    value={selected.status}
                    onChange={(event) =>
                      void changeStatus(
                        event.target.value as EditableSubmittalStatus,
                      )
                    }
                    disabled={
                      updateSubmittal.isPending || tab === "recycle-bin"
                    }
                    className="h-8 rounded border border-[#d9dce1] bg-white px-2 text-xs outline-none disabled:opacity-60"
                  >
                    {!SUBMITTAL_STATUSES.includes(
                      selected.status as SubmittalStatusFilter,
                    ) ? (
                      <option value={selected.status}>{selected.status}</option>
                    ) : null}
                    {SUBMITTAL_STATUSES.filter(
                      (option) => option !== "all",
                    ).map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-[112px_minmax(0,1fr)] gap-3 text-xs">
                  <span className="text-[#7b8189]">Due date</span>
                  <span>{displaySubmittalDate(selected.final_due_date)}</span>
                </div>
                <div className="grid grid-cols-[112px_minmax(0,1fr)] gap-3 text-xs">
                  <span className="text-[#7b8189]">Spec section</span>
                  <span>
                    {selected.specification_section || "Not assigned"}
                  </span>
                </div>
                <div className="grid grid-cols-[112px_minmax(0,1fr)] gap-3 text-xs">
                  <span className="text-[#7b8189]">Type</span>
                  <span>{displaySubmittalType(selected.submittal_type)}</span>
                </div>
                <div className="grid grid-cols-[112px_minmax(0,1fr)] gap-3 text-xs">
                  <span className="text-[#7b8189]">Ball in court</span>
                  <span>{selected.ball_in_court || "Not assigned"}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 border-t border-[#e5e7eb] p-3">
              <Link
                href={`/${projectId}/submittals/${selected.id}`}
                className="inline-flex h-8 flex-1 items-center justify-center rounded border border-[#d9dce1] px-3 text-xs font-medium hover:bg-[#f5f6f7]"
              >
                Open full record
              </Link>
              <button
                type="button"
                onClick={() => void moveSelected()}
                disabled={
                  deleteSubmittal.isPending || restoreSubmittal.isPending
                }
                className="inline-flex h-8 items-center gap-1.5 rounded border border-[#d9dce1] px-3 text-xs font-medium hover:bg-[#f5f6f7] disabled:opacity-60"
              >
                {tab === "recycle-bin" ? (
                  <ArchiveRestore className="size-3.5" />
                ) : (
                  <Trash2 className="size-3.5" />
                )}
                {tab === "recycle-bin" ? "Restore" : "Delete"}
              </button>
            </div>
          </aside>
        </>
      ) : null}

      {createOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="new-submittal-title"
          className="fixed inset-0 z-[80] grid place-items-center bg-black/25 p-4"
        >
          <form
            onSubmit={submitNewSubmittal}
            className="w-full max-w-md rounded-lg border border-[#d9dce1] bg-white shadow-lg"
          >
            <div className="flex h-11 items-center border-b border-[#e5e7eb] px-4">
              <div
                role="heading"
                aria-level={2}
                id="new-submittal-title"
                className="text-sm font-semibold text-[#292d32]"
              >
                New submittal
              </div>
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                className="ml-auto grid size-7 place-items-center rounded hover:bg-[#f2f3f4]"
                aria-label="Close new submittal form"
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="space-y-4 p-4">
              <label className="block space-y-1.5 text-xs font-medium text-[#4f5660]">
                Number
                <input
                  required
                  value={number}
                  onChange={(event) => setNumber(event.target.value)}
                  placeholder="03 30 00-1"
                  className="h-9 w-full rounded border border-[#d9dce1] px-3 text-sm font-normal outline-none focus:border-[#9aa0a8]"
                />
              </label>
              <label className="block space-y-1.5 text-xs font-medium text-[#4f5660]">
                Title
                <input
                  required
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Enter a clear submittal title"
                  className="h-9 w-full rounded border border-[#d9dce1] px-3 text-sm font-normal outline-none focus:border-[#9aa0a8]"
                />
              </label>
            </div>
            <div className="flex justify-end gap-2 border-t border-[#e5e7eb] p-3">
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                className="h-8 rounded px-3 text-xs font-medium text-[#59616b] hover:bg-[#f2f3f4]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={
                  createSubmittal.isPending || !number.trim() || !title.trim()
                }
                className="h-8 rounded bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {createSubmittal.isPending ? "Creating..." : "Create submittal"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
