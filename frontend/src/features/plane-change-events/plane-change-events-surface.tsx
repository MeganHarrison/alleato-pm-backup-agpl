/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * Adapted from Plane project work-item header, filter row, list block, peek,
 * and empty-state templates at revision
 * 39856932cd6b9bd17eab0920506d628190b47af2.
 * Alleato's canonical Change Event hooks, APIs, permissions, and routes remain
 * the data and behavior owners.
 */

"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  CircleDollarSign,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import {
  CHANGE_EVENT_ORIGIN_VALUES,
  CHANGE_EVENT_REASON_VALUES,
  CHANGE_EVENT_SCOPE_VALUES,
  CHANGE_EVENT_TYPE_VALUES,
} from "@/app/api/projects/[projectId]/change-events/validation";
import { StatusBadge } from "@/components/ds";
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
import { formatMoney } from "@/features/change-events/change-events-table-config";
import { useProjectChangeEvents } from "@/hooks/use-change-events";
import { apiFetch } from "@/lib/api-client";
import { getErrorDetail } from "@/lib/format-error";
import type { ChangeEvent } from "@/types/change-events";
import {
  filterPlaneChangeEvents,
  formatPlaneChangeEventDate,
  formatPlaneChangeEventIdentifier,
  type PlaneChangeEventDataTab,
} from "./plane-change-events-model";
import {
  PlaneChangeEventsList,
  PlaneChangeEventsTabs,
} from "./plane-change-events-view";

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

function PropertySelect({
  label,
  value,
  options,
  disabled,
  onChange,
}: {
  label: string;
  value: string | null;
  options: readonly string[];
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <DetailProperty label={label}>
      <Select
        value={value ?? undefined}
        disabled={disabled}
        onValueChange={onChange}
      >
        <SelectTrigger
          className="h-9 w-full max-w-64 border-transparent shadow-none"
          aria-label={`Change Event ${label.toLowerCase()}`}
        >
          <SelectValue placeholder={`Select ${label.toLowerCase()}`} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option} value={option}>
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </DetailProperty>
  );
}

function PlaneChangeEventDetail({
  projectId,
  event,
  pendingField,
  deleting,
  onUpdate,
  onDelete,
}: {
  projectId: number;
  event: ChangeEvent;
  pendingField: string | null;
  deleting: boolean;
  onUpdate: (field: string, value: string) => void;
  onDelete: () => void;
}) {
  return (
    <>
      <SheetHeader className="pb-4">
        <div className="pr-8 text-xs font-medium text-muted-foreground">
          {formatPlaneChangeEventIdentifier(event)}
        </div>
        <SheetTitle className="pr-8 text-lg leading-6">
          {event.title || "Untitled Change Event"}
        </SheetTitle>
      </SheetHeader>

      <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-4">
        {event.description ? (
          <p className="border-b border-border/60 py-5 text-base leading-7 text-foreground">
            {event.description}
          </p>
        ) : null}

        <div className="pt-2">
          <DetailProperty label="Status">
            <StatusBadge status={event.status || "Open"} />
          </DetailProperty>
          <PropertySelect
            label="Scope"
            value={event.scope}
            options={CHANGE_EVENT_SCOPE_VALUES}
            disabled={pendingField === "scope"}
            onChange={(value) => onUpdate("scope", value)}
          />
          <PropertySelect
            label="Type"
            value={event.type}
            options={CHANGE_EVENT_TYPE_VALUES}
            disabled={pendingField === "type"}
            onChange={(value) => onUpdate("type", value)}
          />
          <PropertySelect
            label="Reason"
            value={event.reason}
            options={CHANGE_EVENT_REASON_VALUES}
            disabled={pendingField === "reason"}
            onChange={(value) => onUpdate("reason", value)}
          />
          <PropertySelect
            label="Origin"
            value={event.origin}
            options={CHANGE_EVENT_ORIGIN_VALUES}
            disabled={pendingField === "origin"}
            onChange={(value) => onUpdate("origin", value)}
          />
          <DetailProperty label="Cost ROM">
            <span className="tabular-nums">{formatMoney(event.cost_rom)}</span>
          </DetailProperty>
          <DetailProperty label="Revenue ROM">
            <span className="tabular-nums">{formatMoney(event.rom)}</span>
          </DetailProperty>
          <DetailProperty label="RFQ">
            {event.rfq_title || "No RFQ"}
          </DetailProperty>
          <DetailProperty label="Created">
            {formatPlaneChangeEventDate(event.created_at)}
          </DetailProperty>
        </div>
      </div>

      <SheetFooter>
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
          <Link href={`/${projectId}/change-events/${event.id}?edit=1`}>
            <Pencil className="size-4" />
            Edit
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href={`/${projectId}/change-events/${event.id}`}>
            Open full event
            <ArrowRight className="size-4" />
          </Link>
        </Button>
      </SheetFooter>
    </>
  );
}

export function PlaneChangeEventsSurface({ projectId }: { projectId: number }) {
  const router = useRouter();
  const [activeTab, setActiveTab] =
    React.useState<PlaneChangeEventDataTab>("all");
  const [query, setQuery] = React.useState("");
  const [selectedEventId, setSelectedEventId] = React.useState<string | null>(
    null,
  );
  const [pendingField, setPendingField] = React.useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  const changeEventsQuery = useProjectChangeEvents(projectId, {
    tab: activeTab,
    page: 1,
    perPage: 100,
    enabled: projectId > 0,
  });
  const events = changeEventsQuery.changeEvents;
  const visibleEvents = React.useMemo(
    () => filterPlaneChangeEvents(events, query),
    [events, query],
  );
  const selectedEvent =
    events.find((event) => String(event.id) === selectedEventId) ?? null;
  const tabSummary = changeEventsQuery.tabSummary;
  const counts: Record<PlaneChangeEventDataTab, number> = {
    all:
      (tabSummary?.lineItems ?? 0) + (tabSummary?.noLineItems ?? 0) ||
      changeEventsQuery.total,
    line_items: tabSummary?.lineItems ?? 0,
    no_line_items: tabSummary?.noLineItems ?? 0,
    rfqs: tabSummary?.rfqs ?? 0,
  };

  async function updateSelectedEvent(field: string, value: string) {
    if (!selectedEvent) return;
    setPendingField(field);
    try {
      await apiFetch(
        `/api/projects/${projectId}/change-events/${selectedEvent.id}`,
        {
          method: "PATCH",
          body: JSON.stringify({ [field]: value }),
        },
      );
      await changeEventsQuery.refetch();
      toast.success(`Change event ${field} updated`);
    } catch (error) {
      console.error(
        `[plane-change-events] Failed to update ${field} for change event ${selectedEvent.id}`,
        error,
      );
      toast.error(`Could not update the change event ${field}.`);
    } finally {
      setPendingField(null);
    }
  }

  async function deleteSelectedEvent() {
    if (!selectedEvent) return;
    setDeleting(true);
    try {
      await apiFetch(
        `/api/projects/${projectId}/change-events/${selectedEvent.id}`,
        { method: "DELETE" },
      );
      await changeEventsQuery.refetch();
      setDeleteOpen(false);
      setSelectedEventId(null);
      toast.success("Change event moved to the recycle bin");
    } catch (error) {
      console.error(
        `[plane-change-events] Failed to delete change event ${selectedEvent.id}`,
        error,
      );
      toast.error(
        "Could not move this change event to the recycle bin. Only Open or Void events can be deleted.",
      );
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div
      className="flex h-full min-h-0 w-full flex-col bg-background"
      data-plane-change-events-surface
    >
      <div className="flex min-h-12 shrink-0 items-center gap-3 border-b border-border/70 px-3 md:px-4">
        <div className="flex min-w-0 items-center gap-2">
          <CircleDollarSign
            className="size-4 shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
          <h1 className="truncate text-base font-semibold text-foreground">
            Change Events
          </h1>
          {counts.all > 0 ? (
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium tabular-nums text-muted-foreground">
              {counts.all}
            </span>
          ) : null}
        </div>
        <Button
          type="button"
          className="ml-auto h-11 md:h-8"
          onClick={() => router.push(`/${projectId}/change-events/new`)}
        >
          <Plus className="size-4" />
          <span className="hidden sm:inline">Add Change Event</span>
          <span className="sm:hidden">Add</span>
        </Button>
      </div>

      <div className="flex shrink-0 flex-col border-b border-border/70 md:flex-row md:items-center md:justify-between">
        <div className="overflow-x-auto">
          <PlaneChangeEventsTabs
            activeTab={activeTab}
            counts={counts}
            onTabChange={setActiveTab}
          />
        </div>
        <ExpandableSearch
          value={query}
          onChange={setQuery}
          placeholder="Search change events"
          ariaLabel="Search change events"
          defaultExpanded
          collapsible={false}
          className="mx-3 mb-3 md:mx-4 md:mb-0 md:w-64"
          inputClassName="h-11 md:h-8"
        />
      </div>

      {changeEventsQuery.isLoading ? (
        <div className="space-y-1 p-4" aria-label="Loading change events">
          {Array.from({ length: 7 }).map((_, index) => (
            <Skeleton key={index} className="h-14 w-full" />
          ))}
        </div>
      ) : changeEventsQuery.error ? (
        <div className="flex min-h-72 flex-1 flex-col items-center justify-center px-6 text-center">
          <div className="text-base font-medium text-foreground">
            Change events could not load
          </div>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            {getErrorDetail(changeEventsQuery.error)}
          </p>
          <Button
            type="button"
            variant="outline"
            className="mt-4"
            onClick={() => void changeEventsQuery.refetch()}
          >
            Retry
          </Button>
        </div>
      ) : (
        <PlaneChangeEventsList
          events={visibleEvents}
          onSelect={setSelectedEventId}
        />
      )}

      <Sheet
        open={selectedEvent !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedEventId(null);
        }}
      >
        <SheetContent className="gap-0 p-0 sm:max-w-xl">
          {selectedEvent ? (
            <PlaneChangeEventDetail
              projectId={projectId}
              event={selectedEvent}
              pendingField={pendingField}
              deleting={deleting}
              onUpdate={(field, value) =>
                void updateSelectedEvent(field, value)
              }
              onDelete={() => setDeleteOpen(true)}
            />
          ) : null}
        </SheetContent>
      </Sheet>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Move this change event?</AlertDialogTitle>
            <AlertDialogDescription>
              The event moves to the recycle bin. Only Open or Void events can
              be moved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(event) => {
                event.preventDefault();
                void deleteSelectedEvent();
              }}
            >
              Move to recycle bin
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
