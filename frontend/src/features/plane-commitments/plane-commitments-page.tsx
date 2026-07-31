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
  Building2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  FileSignature,
  Filter,
  Pencil,
  Plus,
  Search,
  ShoppingCart,
  Trash2,
  X,
} from "lucide-react";
import Link from "next/link";
import { type FormEvent, useDeferredValue, useEffect, useState } from "react";

import { PermissionGate } from "@/components/domain/permissions/PermissionGate";
import {
  useCommitmentsList,
  useDeleteCommitment,
  useUpdateCommitmentInline,
} from "@/hooks/use-commitments-query";
import type { CommitmentListItem } from "@/lib/validation/commitments";
import { cn } from "@/lib/utils";

import {
  COMMITMENT_STATUS_FILTERS,
  COMMITMENT_TYPE_FILTERS,
  type CommitmentStatusFilter,
  type CommitmentTypeFilter,
  formatCommitmentCurrency,
  formatCommitmentType,
} from "./plane-commitments-model";

type PlaneCommitmentsPageProps = {
  projectId: string;
  projectName: string;
};

const PAGE_SIZE = 50;

const STATUS_STYLES: Record<string, string> = {
  draft: "border-[#d8dce1] bg-[#f5f6f7] text-[#59616b]",
  "out for bid": "border-[#fde68a] bg-[#fffbeb] text-[#a16207]",
  "out for signature": "border-[#bfdbfe] bg-[#eff6ff] text-[#1d4ed8]",
  approved: "border-[#bbf7d0] bg-[#f0fdf4] text-[#15803d]",
  complete: "border-[#c7d2fe] bg-[#eef2ff] text-[#4338ca]",
  terminated: "border-[#fecaca] bg-[#fff7f7] text-[#b91c1c]",
};

function StatusPill({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center rounded border px-2 text-[11px] font-medium",
        STATUS_STYLES[status.toLowerCase()] ??
          "border-[#d8dce1] bg-[#f5f6f7] text-[#59616b]",
      )}
    >
      {status}
    </span>
  );
}

function CommitmentRow({
  commitment,
  selected,
  onSelect,
}: {
  commitment: CommitmentListItem;
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
        {commitment.type === "purchase_order" ? (
          <ShoppingCart className="size-4 shrink-0 text-[#858b93]" />
        ) : (
          <FileSignature className="size-4 shrink-0 text-[#858b93]" />
        )}
        <span className="min-w-0">
          <span className="flex min-w-0 items-baseline gap-2">
            <span className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-[#858b93]">
              {commitment.number}
            </span>
            <span className="truncate text-[13px] font-medium text-[#292d32]">
              {commitment.title || "Untitled commitment"}
            </span>
          </span>
          <span className="mt-0.5 flex min-w-0 gap-2 text-[11px] text-[#7b8189] md:hidden">
            <span className="truncate">
              {commitment.contract_company?.name || "No company"}
            </span>
            <span aria-hidden="true">·</span>
            <span className="shrink-0">
              {formatCommitmentCurrency(commitment.revised_contract_amount)}
            </span>
          </span>
        </span>
      </span>
      <span className="flex items-center gap-3">
        <span className="hidden w-32 truncate text-[11px] text-[#69707a] lg:block">
          {commitment.contract_company?.name || "No company"}
        </span>
        <span className="hidden w-24 text-right text-[11px] tabular-nums text-[#69707a] md:block">
          {formatCommitmentCurrency(commitment.revised_contract_amount)}
        </span>
        <StatusPill status={commitment.status} />
        <ChevronRight className="size-3.5 text-[#a1a6ad]" />
      </span>
    </button>
  );
}

function EmptyCommitments({ filtered }: { filtered: boolean }) {
  return (
    <div className="grid flex-1 place-items-center px-6 py-16 text-center">
      <div>
        <CircleDollarSign className="mx-auto size-6 text-[#a1a6ad]" />
        <p className="mt-3 text-sm font-medium text-[#34383e]">
          {filtered ? "No matching commitments" : "No commitments yet"}
        </p>
        <p className="mt-1 text-xs text-[#7b8189]">
          {filtered
            ? "Change the search or filter selection."
            : "Create the first subcontract or purchase order."}
        </p>
      </div>
    </div>
  );
}

export function PlaneCommitmentsPage({
  projectId,
  projectName,
}: PlaneCommitmentsPageProps) {
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query.trim());
  const [status, setStatus] = useState<CommitmentStatusFilter>("all");
  const [type, setType] = useState<CommitmentTypeFilter>("all");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draftNumber, setDraftNumber] = useState("");
  const [draftTitle, setDraftTitle] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);

  const commitmentsQuery = useCommitmentsList(projectId, {
    page,
    limit: PAGE_SIZE,
    search: deferredQuery || undefined,
    status: status === "all" ? undefined : status,
    type: type === "all" ? undefined : type,
    deleted: "exclude",
  });
  const updateCommitment = useUpdateCommitmentInline();
  const deleteCommitment = useDeleteCommitment(projectId);

  const selected =
    commitmentsQuery.data?.data.find(
      (commitment) => commitment.id === selectedId,
    ) ?? null;
  const meta = commitmentsQuery.data?.meta;

  useEffect(() => {
    setPage(1);
  }, [deferredQuery, status, type]);

  function openCommitment(commitment: CommitmentListItem) {
    setSelectedId(commitment.id);
    setEditing(false);
    setDraftNumber(commitment.number);
    setDraftTitle(commitment.title ?? "");
    setActionError(null);
  }

  async function saveCommitment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    setActionError(null);

    try {
      if (draftNumber.trim() !== selected.number) {
        await updateCommitment.mutateAsync({
          id: selected.id,
          field: "number",
          value: draftNumber.trim(),
        });
      }
      if (draftTitle.trim() !== (selected.title ?? "")) {
        await updateCommitment.mutateAsync({
          id: selected.id,
          field: "title",
          value: draftTitle.trim(),
        });
      }
      setEditing(false);
    } catch (error) {
      setActionError(
        error instanceof Error
          ? `Update commitment failed: ${error.message}`
          : "Update commitment failed. Retry the edit.",
      );
    }
  }

  async function removeCommitment() {
    if (!selected) return;
    if (
      !window.confirm(`Move commitment ${selected.number} to the recycle bin?`)
    ) {
      return;
    }

    setActionError(null);
    try {
      await deleteCommitment.mutateAsync(selected.id);
      setSelectedId(null);
    } catch (error) {
      setActionError(
        error instanceof Error
          ? `Delete commitment failed: ${error.message}`
          : "Delete commitment failed. Retry the action.",
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
          <span className="text-xs font-medium text-[#292d32]">
            Commitments
          </span>
          <span className="rounded-full bg-[#e0f2fe] px-2 py-0.5 text-[10px] font-medium text-[#0369a1]">
            {meta?.total ?? 0}
          </span>
          <PermissionGate
            projectId={projectId}
            module="contracts"
            level="write"
          >
            <div className="relative ml-auto">
              <button
                type="button"
                onClick={() => setCreateOpen((current) => !current)}
                className="inline-flex h-11 items-center gap-1.5 rounded bg-[#075985] px-3 text-xs font-medium text-white hover:bg-[#0c4a6e] md:h-8"
                aria-expanded={createOpen}
              >
                <Plus className="size-3.5" />
                <span className="hidden sm:inline">Add commitment</span>
                <span className="sm:hidden">Add</span>
                <ChevronDown className="size-3" />
              </button>
              {createOpen ? (
                <div className="absolute right-0 top-12 z-30 w-52 rounded-md border border-[#d9dce1] bg-white p-1 shadow-lg md:top-9">
                  <Link
                    href={`/${projectId}/commitments/new?type=subcontract`}
                    className="flex min-h-11 items-center gap-2 rounded px-3 text-xs text-[#34383e] hover:bg-[#f2f3f4]"
                  >
                    <FileSignature className="size-4 text-[#69707a]" />
                    New subcontract
                  </Link>
                  <Link
                    href={`/${projectId}/commitments/new?type=purchase_order`}
                    className="flex min-h-11 items-center gap-2 rounded px-3 text-xs text-[#34383e] hover:bg-[#f2f3f4]"
                  >
                    <ShoppingCart className="size-4 text-[#69707a]" />
                    New purchase order
                  </Link>
                </div>
              ) : null}
            </div>
          </PermissionGate>
        </div>

        <div className="flex min-h-11 shrink-0 items-center gap-1 border-b border-[#e5e7eb] px-3">
          <label className="relative hidden sm:block">
            <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-[#858b93]" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              aria-label="Search commitments"
              placeholder="Search commitments..."
              className="h-8 w-52 rounded border border-[#d9dce1] bg-white pl-7 pr-2 text-xs outline-none focus:border-[#9aa0a8]"
            />
          </label>
          <div className="ml-auto flex items-center gap-1">
            <label className="relative">
              <Filter className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-[#858b93]" />
              <select
                value={status}
                onChange={(event) =>
                  setStatus(event.target.value as CommitmentStatusFilter)
                }
                aria-label="Filter commitments by status"
                className="h-8 appearance-none rounded border border-[#d9dce1] bg-white pl-7 pr-7 text-xs text-[#4f5660] outline-none"
              >
                {COMMITMENT_STATUS_FILTERS.map((option) => (
                  <option key={option} value={option}>
                    {option === "all" ? "All statuses" : option}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 top-1/2 size-3 -translate-y-1/2 text-[#858b93]" />
            </label>
            <label className="relative">
              <select
                value={type}
                onChange={(event) =>
                  setType(event.target.value as CommitmentTypeFilter)
                }
                aria-label="Filter commitments by type"
                className="h-8 appearance-none rounded border border-[#d9dce1] bg-white pl-2 pr-7 text-xs text-[#4f5660] outline-none"
              >
                {COMMITMENT_TYPE_FILTERS.map((option) => (
                  <option key={option} value={option}>
                    {option === "all"
                      ? "All types"
                      : formatCommitmentType(option)}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 top-1/2 size-3 -translate-y-1/2 text-[#858b93]" />
            </label>
          </div>
        </div>

        {actionError ? (
          <div
            role="alert"
            className="border-b border-[#fecaca] bg-[#fff7f7] px-4 py-2 text-xs text-[#b91c1c]"
          >
            {actionError}
          </div>
        ) : null}

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          <label className="relative border-b border-[#e5e7eb] p-2 sm:hidden">
            <Search className="pointer-events-none absolute left-4 top-1/2 size-3.5 -translate-y-1/2 text-[#858b93]" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              aria-label="Search commitments"
              placeholder="Search commitments..."
              className="h-11 w-full rounded border border-[#d9dce1] bg-white pl-8 pr-3 text-sm outline-none"
            />
          </label>

          {commitmentsQuery.isLoading ? (
            <div className="space-y-px" aria-label="Loading commitments">
              {[0, 1, 2, 3, 4].map((item) => (
                <div
                  key={item}
                  className="h-11 animate-pulse border-b border-[#eceef0] bg-[#fafafa]"
                />
              ))}
            </div>
          ) : commitmentsQuery.isError ? (
            <div className="grid flex-1 place-items-center p-6 text-center">
              <div>
                <p className="text-sm font-medium text-[#34383e]">
                  Commitments could not load
                </p>
                <p className="mt-1 max-w-sm text-xs text-[#7b8189]">
                  {commitmentsQuery.error instanceof Error
                    ? commitmentsQuery.error.message
                    : "The project commitments request failed."}
                </p>
                <button
                  type="button"
                  onClick={() => void commitmentsQuery.refetch()}
                  className="mt-3 h-11 rounded border border-[#d9dce1] px-3 text-xs font-medium hover:bg-[#f5f6f7] md:h-8"
                >
                  Retry
                </button>
              </div>
            </div>
          ) : commitmentsQuery.data?.data.length ? (
            <div>
              <div className="flex h-9 items-center border-b border-[#e5e7eb] px-4 text-xs font-medium text-[#59616b]">
                <span>All commitments</span>
                <span className="ml-2 text-[11px] font-normal text-[#858b93]">
                  {meta?.total ?? commitmentsQuery.data.data.length}
                </span>
              </div>
              {commitmentsQuery.data.data.map((commitment) => (
                <CommitmentRow
                  key={commitment.id}
                  commitment={commitment}
                  selected={commitment.id === selectedId}
                  onSelect={() => openCommitment(commitment)}
                />
              ))}
            </div>
          ) : (
            <EmptyCommitments
              filtered={
                Boolean(deferredQuery) || status !== "all" || type !== "all"
              }
            />
          )}
        </div>

        {meta && meta.totalPages > 1 ? (
          <div className="flex min-h-11 shrink-0 items-center justify-between border-t border-[#e5e7eb] px-4 text-xs text-[#69707a]">
            <span>
              Page {meta.page} of {meta.totalPages}
            </span>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={page <= 1}
                className="grid size-11 place-items-center rounded hover:bg-[#f2f3f4] disabled:opacity-40 md:size-8"
                aria-label="Previous commitments page"
              >
                <ChevronLeft className="size-4" />
              </button>
              <button
                type="button"
                onClick={() =>
                  setPage((current) => Math.min(meta.totalPages, current + 1))
                }
                disabled={page >= meta.totalPages}
                className="grid size-11 place-items-center rounded hover:bg-[#f2f3f4] disabled:opacity-40 md:size-8"
                aria-label="Next commitments page"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>
          </div>
        ) : null}
      </main>

      {selected ? (
        <>
          <button
            type="button"
            aria-label="Close commitment details"
            onClick={() => setSelectedId(null)}
            className="fixed inset-0 z-40 bg-black/20 md:hidden"
          />
          <aside
            aria-label="Commitment details"
            className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-[#e5e7eb] bg-white md:static md:z-auto md:w-96"
          >
            <div className="flex min-h-11 items-center border-b border-[#e5e7eb] px-4">
              <span className="text-[11px] font-medium uppercase tracking-wide text-[#858b93]">
                {selected.number}
              </span>
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                className="ml-auto grid size-11 place-items-center rounded hover:bg-[#f2f3f4] md:size-8"
                aria-label="Close details"
              >
                <X className="size-4" />
              </button>
            </div>

            {editing ? (
              <form
                onSubmit={saveCommitment}
                className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5"
              >
                <label className="block space-y-1.5 text-xs font-medium text-[#59616b]">
                  Number
                  <input
                    required
                    value={draftNumber}
                    onChange={(event) => setDraftNumber(event.target.value)}
                    className="h-11 w-full rounded border border-[#d9dce1] px-3 text-sm font-normal outline-none md:h-9"
                  />
                </label>
                <label className="block space-y-1.5 text-xs font-medium text-[#59616b]">
                  Title
                  <input
                    required
                    value={draftTitle}
                    onChange={(event) => setDraftTitle(event.target.value)}
                    className="h-11 w-full rounded border border-[#d9dce1] px-3 text-sm font-normal outline-none md:h-9"
                  />
                </label>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setEditing(false)}
                    className="h-11 rounded px-3 text-xs font-medium text-[#59616b] hover:bg-[#f2f3f4] md:h-8"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={
                      updateCommitment.isPending ||
                      !draftNumber.trim() ||
                      !draftTitle.trim()
                    }
                    className="h-11 rounded bg-[#075985] px-3 text-xs font-medium text-white hover:bg-[#0c4a6e] disabled:opacity-50 md:h-8"
                  >
                    {updateCommitment.isPending ? "Saving..." : "Save"}
                  </button>
                </div>
              </form>
            ) : (
              <>
                <div className="min-h-0 flex-1 overflow-y-auto p-5">
                  <div
                    role="heading"
                    aria-level={2}
                    className="text-lg font-semibold leading-6 text-[#292d32]"
                  >
                    {selected.title || "Untitled commitment"}
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <StatusPill status={selected.status} />
                    <span className="text-xs text-[#69707a]">
                      {formatCommitmentType(selected.type)}
                    </span>
                  </div>

                  <div className="mt-7 space-y-4">
                    <div className="grid grid-cols-[112px_minmax(0,1fr)] gap-3 text-xs">
                      <span className="text-[#7b8189]">Company</span>
                      <span className="flex items-start gap-1.5">
                        <Building2 className="mt-px size-3.5 shrink-0 text-[#858b93]" />
                        {selected.contract_company?.name || "Not assigned"}
                      </span>
                    </div>
                    <div className="grid grid-cols-[112px_minmax(0,1fr)] gap-3 text-xs">
                      <span className="text-[#7b8189]">Contract value</span>
                      <span className="font-medium tabular-nums">
                        {formatCommitmentCurrency(
                          selected.revised_contract_amount,
                        )}
                      </span>
                    </div>
                    <div className="grid grid-cols-[112px_minmax(0,1fr)] gap-3 text-xs">
                      <span className="text-[#7b8189]">Billed to date</span>
                      <span className="tabular-nums">
                        {formatCommitmentCurrency(selected.billed_to_date)}
                      </span>
                    </div>
                    <div className="grid grid-cols-[112px_minmax(0,1fr)] gap-3 text-xs">
                      <span className="text-[#7b8189]">Remaining</span>
                      <span className="tabular-nums">
                        {formatCommitmentCurrency(selected.remaining_balance)}
                      </span>
                    </div>
                    <div className="grid grid-cols-[112px_minmax(0,1fr)] gap-3 text-xs">
                      <span className="text-[#7b8189]">Trades</span>
                      <span>
                        {selected.trade_names.length
                          ? selected.trade_names.join(", ")
                          : "Not assigned"}
                      </span>
                    </div>
                    <div className="grid grid-cols-[112px_minmax(0,1fr)] gap-3 text-xs">
                      <span className="text-[#7b8189]">Scope</span>
                      <span>{selected.scope_summary || "Not provided"}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 border-t border-[#e5e7eb] p-3">
                  <Link
                    href={`/${projectId}/commitments/${selected.id}`}
                    className="inline-flex h-11 flex-1 items-center justify-center rounded border border-[#d9dce1] px-3 text-xs font-medium hover:bg-[#f5f6f7] md:h-8"
                  >
                    Open full record
                  </Link>
                  <PermissionGate
                    projectId={projectId}
                    module="contracts"
                    level="write"
                  >
                    <button
                      type="button"
                      onClick={() => setEditing(true)}
                      className="grid size-11 place-items-center rounded border border-[#d9dce1] hover:bg-[#f5f6f7] md:size-8"
                      aria-label="Edit commitment"
                    >
                      <Pencil className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => void removeCommitment()}
                      disabled={deleteCommitment.isPending}
                      className="grid size-11 place-items-center rounded border border-[#d9dce1] text-[#b91c1c] hover:bg-[#fff7f7] disabled:opacity-50 md:size-8"
                      aria-label="Delete commitment"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </PermissionGate>
                </div>
              </>
            )}
          </aside>
        </>
      ) : null}
    </div>
  );
}
