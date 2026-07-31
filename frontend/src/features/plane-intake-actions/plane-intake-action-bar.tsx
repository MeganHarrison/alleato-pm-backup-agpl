/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * Adapted directly from Plane's InboxIssueActionsHeader and related modals at
 * revision 39856932cd6b9bd17eab0920506d628190b47af2.
 */

"use client";

import * as React from "react";
import {
  CheckCircle2,
  Clock3,
  CopyCheck,
  MoreHorizontal,
  XCircle,
} from "lucide-react";

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
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ExpandableSearch } from "@/components/tables/unified/table-toolbar";
import { getErrorDetail } from "@/lib/format-error";
import { appToast as toast } from "@/lib/toast/app-toast";
import {
  actionSuccessMessage,
  type PlaneIntakeAction,
  type PlaneIntakeActionRequest,
  type PlaneIntakeActionResponse,
  type PlaneIntakeDecision,
  type PlaneIntakeSource,
} from "./contracts";
import { performPlaneIntakeAction } from "./client";

export interface PlaneIntakeDuplicateCandidate {
  id: string;
  identifier: string;
  title: string;
  status?: string | null;
}

interface PlaneIntakeActionBarProps {
  source: PlaneIntakeSource;
  sourceId: string;
  projectId: number;
  decision?: PlaneIntakeDecision;
  snoozedUntil?: string | null;
  duplicateCandidates: PlaneIntakeDuplicateCandidate[];
  disabled?: boolean;
  onCompleted?: (result: PlaneIntakeActionResponse) => void | Promise<void>;
  performAction?: typeof performPlaneIntakeAction;
}

type OpenModal = "accept" | "decline" | "snooze" | "duplicate" | null;

export function PlaneIntakeActionBar({
  source,
  sourceId,
  projectId,
  decision = "pending",
  snoozedUntil = null,
  duplicateCandidates,
  disabled = false,
  onCompleted,
  performAction = performPlaneIntakeAction,
}: PlaneIntakeActionBarProps) {
  const [openModal, setOpenModal] = React.useState<OpenModal>(null);
  const [pending, setPending] = React.useState<PlaneIntakeAction | null>(null);
  const [snoozeDate, setSnoozeDate] = React.useState<Date>();
  const [duplicateQuery, setDuplicateQuery] = React.useState("");
  const canResolve = decision === "pending";
  const isSnoozed =
    Boolean(snoozedUntil) && new Date(snoozedUntil ?? 0).getTime() > Date.now();
  const visibleCandidates = duplicateCandidates.filter((candidate) => {
    if (candidate.id === sourceId && source === "task") return false;
    const normalizedQuery = duplicateQuery.trim().toLowerCase();
    if (!normalizedQuery) return true;
    return `${candidate.identifier} ${candidate.title}`
      .toLowerCase()
      .includes(normalizedQuery);
  });

  async function execute(
    action: PlaneIntakeAction,
    details: Partial<PlaneIntakeActionRequest> = {},
  ) {
    setPending(action);
    try {
      const result = await performAction({
        source,
        sourceId,
        projectId,
        action,
        ...details,
      } as PlaneIntakeActionRequest);
      await onCompleted?.(result);
      toast.success(actionSuccessMessage(action));
      setOpenModal(null);
      setSnoozeDate(undefined);
      setDuplicateQuery("");
    } catch (error) {
      console.error(
        `Plane Intake ${action} failed for ${source}:${sourceId}`,
        error,
      );
      toast.error(`Could not ${action} this intake item`, {
        description: getErrorDetail(error),
      });
    } finally {
      setPending(null);
    }
  }

  if (!canResolve) return null;

  return (
    <>
      <div
        className="flex items-center gap-1 sm:gap-2"
        aria-label="Intake resolution actions"
      >
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="size-8 px-0 sm:w-auto sm:px-3"
          aria-label="Accept"
          disabled={disabled || pending !== null}
          onClick={() => setOpenModal("accept")}
        >
          <CheckCircle2 className="size-4 text-status-success" />
          <span className="hidden sm:inline">Accept</span>
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="size-8 px-0 sm:w-auto sm:px-3"
          aria-label="Decline"
          disabled={disabled || pending !== null}
          onClick={() => setOpenModal("decline")}
        >
          <XCircle className="size-4 text-destructive" />
          <span className="hidden sm:inline">Decline</span>
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-8"
              disabled={disabled || pending !== null}
              aria-label="More intake actions"
            >
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onSelect={() => {
                if (isSnoozed) {
                  void execute("unsnooze");
                  return;
                }
                setOpenModal("snooze");
              }}
            >
              <Clock3 className="size-4" />
              {isSnoozed ? "Un-snooze" : "Snooze"}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setOpenModal("duplicate")}>
              <CopyCheck className="size-4" />
              Mark as duplicate
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <AlertDialog
        open={openModal === "accept"}
        onOpenChange={(open) => setOpenModal(open ? "accept" : null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Add this item to the project?</AlertDialogTitle>
            <AlertDialogDescription>
              The item will leave the pending Intake queue and become project
              work.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={pending !== null}
              onClick={(event) => {
                event.preventDefault();
                void execute("accept");
              }}
            >
              {pending === "accept" ? "Adding…" : "Add to project"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={openModal === "decline"}
        onOpenChange={(open) => setOpenModal(open ? "decline" : null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Decline this intake item?</AlertDialogTitle>
            <AlertDialogDescription>
              The item will leave the pending queue. Its source record remains
              available for audit.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={pending !== null}
              onClick={(event) => {
                event.preventDefault();
                void execute("decline");
              }}
            >
              {pending === "decline" ? "Declining…" : "Decline"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={openModal === "snooze"}
        onOpenChange={(open) => setOpenModal(open ? "snooze" : null)}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Snooze intake item</DialogTitle>
            <DialogDescription>
              Choose when this item should return to the pending queue.
            </DialogDescription>
          </DialogHeader>
          <Calendar
            mode="single"
            selected={snoozeDate}
            onSelect={setSnoozeDate}
            disabled={{ before: new Date() }}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenModal(null)}>
              Cancel
            </Button>
            <Button
              disabled={!snoozeDate || pending !== null}
              onClick={() => {
                if (!snoozeDate) return;
                const until = new Date(snoozeDate);
                until.setHours(9, 0, 0, 0);
                if (until.getTime() <= Date.now()) {
                  until.setDate(until.getDate() + 1);
                }
                void execute("snooze", {
                  snoozeUntil: until.toISOString(),
                });
              }}
            >
              {pending === "snooze" ? "Snoozing…" : "Snooze"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={openModal === "duplicate"}
        onOpenChange={(open) => setOpenModal(open ? "duplicate" : null)}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Mark as duplicate</DialogTitle>
            <DialogDescription>
              Select the existing project task that already represents this
              work.
            </DialogDescription>
          </DialogHeader>
          <ExpandableSearch
            value={duplicateQuery}
            onChange={setDuplicateQuery}
            placeholder="Search project tasks"
            ariaLabel="Search duplicate candidates"
            collapsible={false}
            inputClassName="w-full"
          />
          <div className="max-h-72 divide-y overflow-y-auto">
            {visibleCandidates.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No matching project tasks.
              </p>
            ) : (
              visibleCandidates.map((candidate) => (
                <Button
                  key={candidate.id}
                  type="button"
                  variant="ghost"
                  className="h-auto w-full justify-start rounded-none px-2 py-3 text-left"
                  disabled={pending !== null}
                  onClick={() =>
                    void execute("duplicate", {
                      duplicateTaskId: candidate.id,
                    })
                  }
                >
                  <span className="min-w-0">
                    <span className="block text-xs text-muted-foreground">
                      {candidate.identifier}
                    </span>
                    <span className="block truncate text-sm font-medium">
                      {candidate.title}
                    </span>
                  </span>
                </Button>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
