"use client";

import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { toast } from "sonner";
import { CircleCheck, Download, RotateCcw } from "lucide-react";

import {
  Button,
  DetailActions,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ds";
import { useUpdateRfi, useDeleteRfi } from "@/hooks/use-rfis";
import { apiFetch } from "@/lib/api-client";
import { reportNonCriticalFailure } from "@/lib/report-non-critical-failure";
import type { RfiEditValues } from "@/lib/schemas/rfi-schema";
import type { RFI } from "@/types/database-extensions";

interface RfiHeaderActionsProps {
  rfi: Pick<RFI, "id" | "status" | "number" | "subject">;
  projectId: number;
}

export function RfiHeaderActions({ rfi, projectId }: RfiHeaderActionsProps) {
  const router = useRouter();
  const pathname = usePathname()!;
  const updateRfi = useUpdateRfi(projectId);
  const deleteRfi = useDeleteRfi(projectId);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [isCreatingCE, setIsCreatingCE] = useState(false);

  const handleStatusChange = async (newStatus: string) => {
    try {
      await updateRfi.mutateAsync({
        rfiId: rfi.id,
        data: { status: newStatus } as Record<string, unknown> & RfiEditValues,
      });
      router.refresh();
    } catch (error) {
      // The user-facing message is surfaced by useUpdateRfi's onError
      // (handleFormError); this catch stops a rejected mutation from becoming an
      // unhandled rejection and records the failure for observability.
      reportNonCriticalFailure({
        area: "rfi-header-actions",
        operation: "update-rfi-status",
        error,
        userVisibleFallback: "The RFI status could not be updated.",
        metadata: { rfiId: rfi.id, newStatus },
      });
    }
  };

  const handleDelete = async () => {
    await deleteRfi.mutateAsync(rfi.id);
    router.push(`/${projectId}/rfis`);
  };

  const handleCreateChangeEvent = async () => {
    setIsCreatingCE(true);
    try {
      const result = await apiFetch<{ id?: string; data?: { id?: string } }>(
        `/api/projects/${projectId}/change-events`,
        {
          method: "POST",
          body: JSON.stringify({
            title: rfi.subject,
            type: "TBD",
            scope: "TBD",
            origin: "rfis",
            originId: rfi.id,
            status: "Open",
          }),
        },
      );
      const newId = result?.data?.id ?? result?.id;
      if (!newId) {
        throw new Error("Change event creation succeeded without returning an id.");
      }
      toast.success("Change event created from RFI");
      router.push(`/${projectId}/change-events/${newId}`);
    } catch (err) {
      reportNonCriticalFailure({
        area: "rfi-header-actions",
        operation: "create-change-event",
        error: err,
        userVisibleFallback: "The change event could not be created from this RFI.",
        metadata: { projectId, rfiId: rfi.id },
      });
      const message =
        err instanceof Error && err.message
          ? err.message
          : "The change event could not be created from this RFI.";
      toast.error(message);
    } finally {
      setIsCreatingCE(false);
    }
  };

  // Status transition shown as an overflow-menu action rather than a standalone button.
  const statusAction =
    rfi.status === "draft"
      ? { label: "Open RFI", next: "open", icon: <CircleCheck className="h-4 w-4" /> }
      : rfi.status === "open"
        ? { label: "Close RFI", next: "closed", icon: <CircleCheck className="h-4 w-4" /> }
        : rfi.status === "closed" || rfi.status === "closed-draft"
          ? {
              label: "Reopen RFI",
              next: rfi.status === "closed-draft" ? "draft" : "open",
              icon: <RotateCcw className="h-4 w-4" />,
            }
          : null;

  return (
    <>
      <div className="flex w-full items-stretch gap-2 sm:w-auto sm:flex-row sm:items-center">
        <Button
          size="sm"
          className="min-h-11 flex-1 justify-center sm:min-h-9 sm:flex-none"
          onClick={() => void handleCreateChangeEvent()}
          disabled={isCreatingCE}
        >
          {isCreatingCE ? "Creating…" : "Create Change Event"}
        </Button>

        <DetailActions
          onEdit={() => router.push(`${pathname}?mode=edit`)}
          onDelete={() => setDeleteOpen(true)}
          extraActions={[
            ...(statusAction
              ? [
                  {
                    label: statusAction.label,
                    icon: statusAction.icon,
                    onClick: () => void handleStatusChange(statusAction.next),
                  },
                ]
              : []),
            {
              label: "Export PDF",
              icon: <Download className="h-4 w-4" />,
              onClick: () =>
                window.open(
                  `/api/projects/${projectId}/rfis/${rfi.id}/pdf`,
                  "_blank",
                  "noopener,noreferrer",
                ),
            },
          ]}
        />
      </div>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete RFI #{rfi.number}?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This RFI will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
