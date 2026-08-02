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
  ChevronRight,
  FileSignature,
  Lock,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import Link from "next/link";
import { type FormEvent, useDeferredValue, useState } from "react";

import { PermissionGate } from "@/components/domain/permissions/PermissionGate";
import {
  useDeletePrimeContract,
  usePrimeContracts,
  useUpdatePrimeContract,
} from "@/hooks/use-prime-contracts";
import type { PrimeContract } from "@/lib/validation/prime-contracts";
import { cn } from "@/lib/utils";

import {
  formatPrimeContractCurrency,
  formatPrimeContractStatus,
  PRIME_CONTRACT_STATUS_FILTERS,
  type PrimeContractStatusFilter,
} from "./plane-prime-contracts-model";

type PlanePrimeContractsPageProps = {
  projectId: number;
  projectName: string;
};

const STATUS_STYLES: Record<string, string> = {
  draft: "border-[#d8dce1] bg-[#f5f6f7] text-[#59616b]",
  out_for_signature: "border-[#bfdbfe] bg-[#eff6ff] text-[#1d4ed8]",
  approved: "border-[#bbf7d0] bg-[#f0fdf4] text-[#15803d]",
  complete: "border-[#c7d2fe] bg-[#eef2ff] text-[#4338ca]",
  terminated: "border-[#fecaca] bg-[#fff7f7] text-[#b91c1c]",
};

function StatusPill({ status }: { status: PrimeContract["status"] }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center rounded border px-2 text-[11px] font-medium",
        status
          ? STATUS_STYLES[status]
          : "border-[#d8dce1] bg-[#f5f6f7] text-[#59616b]",
      )}
    >
      {formatPrimeContractStatus(status)}
    </span>
  );
}

function PrimeContractRow({
  contract,
  selected,
  onSelect,
}: {
  contract: PrimeContract;
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
        <FileSignature className="size-4 shrink-0 text-[#858b93]" />
        <span className="min-w-0">
          <span className="flex min-w-0 items-baseline gap-2">
            <span className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-[#858b93]">
              {contract.contract_number || "No number"}
            </span>
            <span className="truncate text-[13px] font-medium text-[#292d32]">
              {contract.title || "Untitled prime contract"}
            </span>
          </span>
          <span className="mt-0.5 flex min-w-0 gap-2 text-[11px] text-[#7b8189] md:hidden">
            <span className="truncate">
              {contract.client?.name || "No owner/client"}
            </span>
            <span aria-hidden="true">·</span>
            <span className="shrink-0">
              {formatPrimeContractCurrency(contract.revised_contract_value)}
            </span>
          </span>
        </span>
      </span>
      <span className="flex items-center gap-3">
        <span className="hidden w-32 truncate text-[11px] text-[#69707a] lg:block">
          {contract.client?.name || "No owner/client"}
        </span>
        <span className="hidden w-24 text-right text-[11px] tabular-nums text-[#69707a] md:block">
          {formatPrimeContractCurrency(contract.revised_contract_value)}
        </span>
        <StatusPill status={contract.status} />
        <ChevronRight className="size-3.5 text-[#a1a6ad]" />
      </span>
    </button>
  );
}

export function PlanePrimeContractsPage({
  projectId,
  projectName,
}: PlanePrimeContractsPageProps) {
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query.trim());
  const [status, setStatus] = useState<PrimeContractStatusFilter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [draftNumber, setDraftNumber] = useState("");
  const [draftTitle, setDraftTitle] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);

  const contractsQuery = usePrimeContracts(projectId, {
    status: status === "all" ? undefined : status,
    search: deferredQuery || undefined,
  });
  const updateContract = useUpdatePrimeContract(projectId, selectedId ?? "");
  const deleteContract = useDeletePrimeContract(projectId);
  const selected =
    contractsQuery.data?.find((contract) => contract.id === selectedId) ?? null;

  function openContract(contract: PrimeContract) {
    setSelectedId(contract.id);
    setDraftNumber(contract.contract_number ?? "");
    setDraftTitle(contract.title ?? "");
    setEditing(false);
    setActionError(null);
  }

  async function saveContract(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    setActionError(null);

    try {
      await updateContract.mutateAsync({
        contract_number: draftNumber.trim(),
        title: draftTitle.trim(),
      });
      setEditing(false);
    } catch (error) {
      setActionError(
        error instanceof Error
          ? `Update prime contract failed: ${error.message}`
          : "Update prime contract failed. Retry the edit.",
      );
    }
  }

  async function removeContract() {
    if (!selected) return;
    if (
      !window.confirm(
        `Delete prime contract ${selected.contract_number || selected.title || selected.id}?`,
      )
    ) {
      return;
    }

    setActionError(null);
    try {
      await deleteContract.mutateAsync(selected.id);
      setSelectedId(null);
    } catch (error) {
      setActionError(
        error instanceof Error
          ? `Delete prime contract failed: ${error.message}`
          : "Delete prime contract failed. Retry the action.",
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
            Prime Contracts
          </span>
          <span className="rounded-full bg-[#e0f2fe] px-2 py-0.5 text-[10px] font-medium text-[#0369a1]">
            {contractsQuery.data?.length ?? 0}
          </span>
          <PermissionGate
            projectId={projectId}
            module="contracts"
            level="write"
          >
            <Link
              href={`/${projectId}/prime-contracts/new`}
              className="ml-auto inline-flex h-11 items-center gap-1.5 rounded bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90 md:h-8"
            >
              <Plus className="size-3.5" />
              <span className="hidden sm:inline">Add prime contract</span>
              <span className="sm:hidden">Add</span>
            </Link>
          </PermissionGate>
        </div>

        <div className="flex min-h-11 shrink-0 items-center gap-2 border-b border-[#e5e7eb] px-3">
          <label className="relative hidden sm:block">
            <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-[#858b93]" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              aria-label="Search prime contracts"
              placeholder="Search prime contracts..."
              className="h-8 w-56 rounded border border-[#d9dce1] bg-white pl-7 pr-2 text-xs outline-none focus:border-[#9aa0a8]"
            />
          </label>
          <label className="relative ml-auto">
            <select
              value={status}
              onChange={(event) =>
                setStatus(event.target.value as PrimeContractStatusFilter)
              }
              aria-label="Filter prime contracts by status"
              className="h-8 appearance-none rounded border border-[#d9dce1] bg-white pl-3 pr-8 text-xs text-[#4f5660] outline-none"
            >
              {PRIME_CONTRACT_STATUS_FILTERS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 size-3 -translate-y-1/2 text-[#858b93]" />
          </label>
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
              aria-label="Search prime contracts"
              placeholder="Search prime contracts..."
              className="h-11 w-full rounded border border-[#d9dce1] bg-white pl-8 pr-3 text-sm outline-none"
            />
          </label>

          {contractsQuery.isLoading ? (
            <div className="space-y-px" aria-label="Loading prime contracts">
              {[0, 1, 2, 3, 4].map((item) => (
                <div
                  key={item}
                  className="h-11 animate-pulse border-b border-[#eceef0] bg-[#fafafa]"
                />
              ))}
            </div>
          ) : contractsQuery.isError ? (
            <div className="grid flex-1 place-items-center p-6 text-center">
              <div>
                <p className="text-sm font-medium text-[#34383e]">
                  Prime contracts could not load
                </p>
                <p className="mt-1 max-w-sm text-xs text-[#7b8189]">
                  {contractsQuery.error instanceof Error
                    ? contractsQuery.error.message
                    : "The project prime contracts request failed."}
                </p>
                <button
                  type="button"
                  onClick={() => void contractsQuery.refetch()}
                  className="mt-3 h-11 rounded border border-[#d9dce1] px-3 text-xs font-medium hover:bg-[#f5f6f7] md:h-8"
                >
                  Retry
                </button>
              </div>
            </div>
          ) : contractsQuery.data?.length ? (
            <div>
              <div className="flex h-9 items-center border-b border-[#e5e7eb] px-4 text-xs font-medium text-[#59616b]">
                <span>All prime contracts</span>
                <span className="ml-2 text-[11px] font-normal text-[#858b93]">
                  {contractsQuery.data.length}
                </span>
              </div>
              {contractsQuery.data.map((contract) => (
                <PrimeContractRow
                  key={contract.id}
                  contract={contract}
                  selected={contract.id === selectedId}
                  onSelect={() => openContract(contract)}
                />
              ))}
            </div>
          ) : (
            <div className="grid flex-1 place-items-center px-6 py-16 text-center">
              <div>
                <FileSignature className="mx-auto size-6 text-[#a1a6ad]" />
                <p className="mt-3 text-sm font-medium text-[#34383e]">
                  {deferredQuery || status !== "all"
                    ? "No matching prime contracts"
                    : "No prime contracts yet"}
                </p>
                <p className="mt-1 text-xs text-[#7b8189]">
                  {deferredQuery || status !== "all"
                    ? "Change the search or status filter."
                    : "Create the first prime contract for this project."}
                </p>
              </div>
            </div>
          )}
        </div>
      </main>

      {selected ? (
        <>
          <button
            type="button"
            aria-label="Close prime contract details"
            onClick={() => setSelectedId(null)}
            className="fixed inset-0 z-40 bg-black/20 md:hidden"
          />
          <aside
            aria-label="Prime contract details"
            className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-[#e5e7eb] bg-white md:static md:z-auto md:w-96"
          >
            <div className="flex min-h-11 items-center border-b border-[#e5e7eb] px-4">
              <span className="text-[11px] font-medium uppercase tracking-wide text-[#858b93]">
                {selected.contract_number || "No number"}
              </span>
              {selected.is_private ? (
                <Lock
                  className="ml-2 size-3.5 text-[#858b93]"
                  aria-label="Private contract"
                />
              ) : null}
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
                onSubmit={saveContract}
                className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5"
              >
                <label className="block space-y-1.5 text-xs font-medium text-[#59616b]">
                  Contract number
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
                      updateContract.isPending ||
                      !draftNumber.trim() ||
                      !draftTitle.trim()
                    }
                    className="h-11 rounded bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 md:h-8"
                  >
                    {updateContract.isPending ? "Saving..." : "Save"}
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
                    {selected.title || "Untitled prime contract"}
                  </div>
                  <div className="mt-3">
                    <StatusPill status={selected.status} />
                  </div>

                  <div className="mt-7 space-y-4">
                    <div className="grid grid-cols-[112px_minmax(0,1fr)] gap-3 text-xs">
                      <span className="text-[#7b8189]">Owner/client</span>
                      <span className="flex items-start gap-1.5">
                        <Building2 className="mt-px size-3.5 shrink-0 text-[#858b93]" />
                        {selected.client?.name || "Not assigned"}
                      </span>
                    </div>
                    <div className="grid grid-cols-[112px_minmax(0,1fr)] gap-3 text-xs">
                      <span className="text-[#7b8189]">Original value</span>
                      <span className="tabular-nums">
                        {formatPrimeContractCurrency(
                          selected.original_contract_value,
                        )}
                      </span>
                    </div>
                    <div className="grid grid-cols-[112px_minmax(0,1fr)] gap-3 text-xs">
                      <span className="text-[#7b8189]">Revised value</span>
                      <span className="font-medium tabular-nums">
                        {formatPrimeContractCurrency(
                          selected.revised_contract_value,
                        )}
                      </span>
                    </div>
                    <div className="grid grid-cols-[112px_minmax(0,1fr)] gap-3 text-xs">
                      <span className="text-[#7b8189]">Invoiced</span>
                      <span className="tabular-nums">
                        {formatPrimeContractCurrency(selected.invoiced_amount)}
                      </span>
                    </div>
                    <div className="grid grid-cols-[112px_minmax(0,1fr)] gap-3 text-xs">
                      <span className="text-[#7b8189]">Remaining</span>
                      <span className="tabular-nums">
                        {formatPrimeContractCurrency(
                          selected.remaining_balance,
                        )}
                      </span>
                    </div>
                    <div className="grid grid-cols-[112px_minmax(0,1fr)] gap-3 text-xs">
                      <span className="text-[#7b8189]">Executed</span>
                      <span>{selected.executed ? "Yes" : "No"}</span>
                    </div>
                    <div className="grid grid-cols-[112px_minmax(0,1fr)] gap-3 text-xs">
                      <span className="text-[#7b8189]">Description</span>
                      <span>{selected.description || "Not provided"}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 border-t border-[#e5e7eb] p-3">
                  <Link
                    href={`/${projectId}/prime-contracts/${selected.id}`}
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
                      aria-label="Edit prime contract"
                    >
                      <Pencil className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => void removeContract()}
                      disabled={deleteContract.isPending}
                      className="grid size-11 place-items-center rounded border border-[#d9dce1] text-[#b91c1c] hover:bg-[#fff7f7] disabled:opacity-50 md:size-8"
                      aria-label="Delete prime contract"
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
