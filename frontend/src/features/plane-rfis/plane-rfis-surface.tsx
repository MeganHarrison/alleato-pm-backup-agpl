/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * Adapted from Plane project work-item header, filter row, list block, peek,
 * and empty-state templates at revision
 * 39856932cd6b9bd17eab0920506d628190b47af2.
 * Alleato's canonical RFI hooks, routes, permissions, and mutations remain the
 * data and behavior owners.
 */

"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  CalendarDays,
  MessageSquareText,
  Plus,
  Trash2,
  UserRound,
} from "lucide-react";

import { StatusDot } from "@/components/ds";
import { ExpandableSearch } from "@/components/tables/unified/table-toolbar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { useDeleteRfi, useRfis, useUpdateRfi } from "@/hooks/use-rfis";
import { getErrorDetail } from "@/lib/format-error";
import { RFI_STATUS_OPTIONS } from "@/lib/schemas/rfi-schema";
import type { RFI } from "@/types/database-extensions";
import {
  filterPlaneRfis,
  formatPlaneRfiDate,
  formatPlaneRfiIdentifier,
  planeRfiMatchesStatus,
  type PlaneRfiStatusFilter,
} from "./plane-rfis-model";
import { PlaneRfisList, PlaneRfisStatusTabs } from "./plane-rfis-view";

function DetailProperty({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-11 items-center gap-4 border-b border-border/60 py-2 text-sm">
      <div className="w-32 shrink-0 text-muted-foreground">{label}</div>
      <div className="min-w-0 flex-1 text-foreground">{children}</div>
    </div>
  );
}

function PlaneRfiDetail({
  projectId,
  rfi,
  updating,
  deleting,
  onStatusChange,
  onDelete,
}: {
  projectId: number;
  rfi: RFI;
  updating: boolean;
  deleting: boolean;
  onStatusChange: (status: string) => void;
  onDelete: () => void;
}) {
  const statusOptions = React.useMemo(() => {
    if (RFI_STATUS_OPTIONS.some((option) => option.value === rfi.status)) {
      return RFI_STATUS_OPTIONS;
    }
    return [
      ...RFI_STATUS_OPTIONS,
      { value: rfi.status, label: rfi.status.replaceAll("-", " ") },
    ];
  }, [rfi.status]);

  return (
    <>
      <SheetHeader className="pb-4">
        <div className="pr-8 text-xs font-medium text-muted-foreground">
          {formatPlaneRfiIdentifier(rfi.number)}
        </div>
        <SheetTitle className="pr-8 text-lg leading-6">
          {rfi.subject || "Untitled RFI"}
        </SheetTitle>
      </SheetHeader>

      <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-4">
        {rfi.question ? (
          <p className="border-b border-border/60 py-5 text-base leading-7 text-foreground">
            {rfi.question}
          </p>
        ) : null}

        <div className="pt-2">
          <DetailProperty label="Status">
            <Select
              value={rfi.status}
              disabled={updating}
              onValueChange={onStatusChange}
            >
              <SelectTrigger
                className="h-9 w-full max-w-56 border-transparent shadow-none"
                aria-label="RFI status"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </DetailProperty>
          <DetailProperty label="Ball in court">
            <span className="inline-flex items-center gap-2">
              <UserRound className="size-4 text-muted-foreground" />
              {rfi.ball_in_court ||
                rfi.assignees?.join(", ") ||
                "Unassigned"}
            </span>
          </DetailProperty>
          <DetailProperty label="Due date">
            <span className="inline-flex items-center gap-2">
              <CalendarDays className="size-4 text-muted-foreground" />
              {formatPlaneRfiDate(rfi.due_date)}
            </span>
          </DetailProperty>
          <DetailProperty label="RFI manager">
            {rfi.rfi_manager || "Not assigned"}
          </DetailProperty>
          <DetailProperty label="Location">
            {rfi.location || "Not specified"}
          </DetailProperty>
          <DetailProperty label="Cost impact">
            {rfi.cost_impact || "Not specified"}
          </DetailProperty>
          <DetailProperty label="Schedule impact">
            {rfi.schedule_impact || "Not specified"}
          </DetailProperty>
        </div>
      </div>

      <SheetFooter className="border-t border-border/70">
        <Button
          type="button"
          variant="ghost"
          className="mr-auto text-destructive hover:text-destructive"
          disabled={deleting}
          onClick={onDelete}
        >
          <Trash2 className="size-4" />
          Delete
        </Button>
        <Button asChild variant="outline">
          <Link href={`/${projectId}/rfis/${rfi.id}`}>
            Open full RFI
            <ArrowRight className="size-4" />
          </Link>
        </Button>
      </SheetFooter>
    </>
  );
}

export function PlaneRfisSurface({ projectId }: { projectId: number }) {
  const router = useRouter();
  const rfisQuery = useRfis(projectId);
  const updateRfi = useUpdateRfi(projectId);
  const deleteRfi = useDeleteRfi(projectId);
  const [query, setQuery] = React.useState("");
  const [statusFilter, setStatusFilter] =
    React.useState<PlaneRfiStatusFilter>("all");
  const [selectedRfiId, setSelectedRfiId] = React.useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = React.useState(false);

  const rfis = rfisQuery.data ?? [];
  const counts = React.useMemo(
    () => ({
      all: rfis.length,
      open: rfis.filter((rfi) => planeRfiMatchesStatus(rfi, "open")).length,
      closed: rfis.filter((rfi) => planeRfiMatchesStatus(rfi, "closed")).length,
    }),
    [rfis],
  );
  const visibleRfis = React.useMemo(
    () => filterPlaneRfis(rfis, statusFilter, query),
    [query, rfis, statusFilter],
  );
  const selectedRfi =
    rfis.find((rfi) => rfi.id === selectedRfiId) ?? null;

  function updateSelectedStatus(status: string) {
    if (!selectedRfi) return;
    updateRfi.mutate({
      rfiId: selectedRfi.id,
      data: { status },
    });
  }

  function deleteSelectedRfi() {
    if (!selectedRfi) return;
    deleteRfi.mutate(selectedRfi.id, {
      onSuccess: () => {
        setDeleteOpen(false);
        setSelectedRfiId(null);
      },
    });
  }

  return (
    <div
      className="flex h-full min-h-0 w-full flex-col bg-background"
      data-plane-rfis-surface
    >
      <div className="flex min-h-12 shrink-0 items-center gap-3 border-b border-border/70 px-3 md:px-4">
        <div className="flex min-w-0 items-center gap-2">
          <MessageSquareText
            className="size-4 shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
          <h1 className="truncate text-base font-semibold text-foreground">
            RFIs
          </h1>
          {rfis.length > 0 ? (
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium tabular-nums text-muted-foreground">
              {rfis.length}
            </span>
          ) : null}
        </div>
        <Button
          type="button"
          className="ml-auto h-11 md:h-8"
          onClick={() => router.push(`/${projectId}/rfis/new`)}
        >
          <Plus className="size-4" />
          <span className="hidden sm:inline">Add RFI</span>
          <span className="sm:hidden">Add</span>
        </Button>
      </div>

      <div className="flex shrink-0 flex-col border-b border-border/70 md:flex-row md:items-center md:justify-between">
        <PlaneRfisStatusTabs
          activeFilter={statusFilter}
          counts={counts}
          onFilterChange={setStatusFilter}
        />
        <ExpandableSearch
          value={query}
          onChange={setQuery}
          placeholder="Search RFIs"
          ariaLabel="Search RFIs"
          defaultExpanded
          collapsible={false}
          className="mx-3 mb-3 md:mx-4 md:mb-0 md:w-64"
          inputClassName="h-11 md:h-8"
        />
      </div>

      {rfisQuery.isLoading ? (
        <div className="space-y-1 p-4" aria-label="Loading RFIs">
          {Array.from({ length: 7 }).map((_, index) => (
            <Skeleton key={index} className="h-14 w-full" />
          ))}
        </div>
      ) : rfisQuery.error ? (
        <div className="flex min-h-72 flex-1 flex-col items-center justify-center px-6 text-center">
          <div className="text-base font-medium text-foreground">
            RFIs could not load
          </div>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            {getErrorDetail(rfisQuery.error)}
          </p>
          <Button
            type="button"
            variant="outline"
            className="mt-4"
            onClick={() => void rfisQuery.refetch()}
          >
            Retry
          </Button>
        </div>
      ) : (
        <PlaneRfisList rfis={visibleRfis} onSelect={setSelectedRfiId} />
      )}

      <Sheet
        open={selectedRfi !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedRfiId(null);
        }}
      >
        <SheetContent className="gap-0 p-0 sm:max-w-xl">
          {selectedRfi ? (
            <PlaneRfiDetail
              projectId={projectId}
              rfi={selectedRfi}
              updating={updateRfi.isPending}
              deleting={deleteRfi.isPending}
              onStatusChange={updateSelectedStatus}
              onDelete={() => setDeleteOpen(true)}
            />
          ) : null}
        </SheetContent>
      </Sheet>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this RFI?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the RFI and its project history.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteRfi.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(event) => {
                event.preventDefault();
                deleteSelectedRfi();
              }}
            >
              Delete RFI
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
