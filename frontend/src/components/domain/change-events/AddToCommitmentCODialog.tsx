"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText } from "lucide-react";
import { toast } from "sonner";

import { StatusBadge } from "@/components/ds";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api-client";

interface Commitment {
  id: string;
  commitment_number: string;
  title: string | null;
  status: string | null;
  vendor_name: string | null;
  commitment_type: string | null;
}

interface AddToCommitmentCODialogProps {
  open: boolean;
  onClose: () => void;
  selectedChangeEventIds: string[];
  projectId: number;
  onSuccess: () => void;
  contractScope?: "all_contracts" | "matching_cost_codes";
  commitmentTypeFilter?: "any" | "subcontract" | "purchase_order";
}

interface CreatedCommitmentChangeOrder {
  id: string;
  change_order_number?: string | null;
}

export function AddToCommitmentCODialog({
  open,
  onClose,
  selectedChangeEventIds,
  projectId,
  onSuccess,
  contractScope = "all_contracts",
  commitmentTypeFilter = "any",
}: AddToCommitmentCODialogProps) {
  const router = useRouter();
  const [commitments, setCommitments] = useState<Commitment[]>([]);
  const [isLoadingCommitments, setIsLoadingCommitments] = useState(false);
  const [selectedCommitmentId, setSelectedCommitmentId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const count = selectedChangeEventIds.length;

  useEffect(() => {
    if (!open) {
      setSelectedCommitmentId("");
      return;
    }

    const fetchCommitments = async () => {
      setIsLoadingCommitments(true);
      try {
        const data = await apiFetch<unknown>(
          `/api/projects/${projectId}/change-events/commitment-options`,
          {
            method: "POST",
            body: JSON.stringify({
              change_event_ids: selectedChangeEventIds,
              scope: contractScope,
              commitment_type_filter: commitmentTypeFilter,
            }),
          },
        );
        const items = Array.isArray(data)
          ? data
          : (data as { data?: unknown[] }).data ?? [];

        setCommitments(
          items.map((commitment: Record<string, unknown>) => ({
            id: String(commitment.id),
            commitment_number: String(
              commitment.commitment_number ?? commitment.number ?? "",
            ),
            title: (commitment.title as string) ?? null,
            status: (commitment.status as string) ?? null,
            vendor_name: (commitment.vendor_name as string) ?? null,
            commitment_type:
              (commitment.commitment_type as string) ??
              (commitment.type as string) ??
              null,
          })),
        );
      } catch {
        toast.error("Could not load commitments. Please try again.");
        setCommitments([]);
      } finally {
        setIsLoadingCommitments(false);
      }
    };

    void fetchCommitments();
  }, [
    open,
    projectId,
    selectedChangeEventIds,
    contractScope,
    commitmentTypeFilter,
  ]);

  const handleSubmit = async () => {
    if (!selectedCommitmentId) {
      toast.error("Select a commitment before continuing.");
      return;
    }

    const selectedCommitment = commitments.find(
      (commitment) => commitment.id === selectedCommitmentId,
    );
    const title = `CCO for ${count} change event${count === 1 ? "" : "s"}${
      selectedCommitment
        ? ` - ${selectedCommitment.title || selectedCommitment.commitment_number}`
        : ""
    }`;

    setIsSubmitting(true);
    try {
      const created = await apiFetch<CreatedCommitmentChangeOrder>(
        `/api/projects/${projectId}/commitment-change-orders`,
        {
          method: "POST",
          body: JSON.stringify({
            contract_id: selectedCommitmentId,
            change_event_ids: selectedChangeEventIds,
            title,
            description: title,
            status: "draft",
          }),
        },
      );

      toast.success(
        created.change_order_number
          ? `Commitment CO ${created.change_order_number} created`
          : "Commitment CO created",
      );
      onSuccess();
      onClose();
      router.push(`/${projectId}/change-orders/commitment/${created.id}`);
    } catch (err) {
      toast.error("Failed to create Commitment CO", {
        description:
          err instanceof Error ? err.message : "An unexpected error occurred.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      onClose();
    }
  };

  function commitmentLabel(commitment: Commitment): string {
    const typeLabel =
      commitment.commitment_type === "purchase_order"
        ? "PO"
        : commitment.commitment_type === "subcontract"
          ? "Sub"
          : "";
    return [
      `#${commitment.commitment_number}`,
      commitment.title,
      commitment.vendor_name,
      typeLabel ? `(${typeLabel})` : "",
    ]
      .filter(Boolean)
      .join(" - ");
  }

  const isSubmitDisabled =
    isSubmitting || isLoadingCommitments || !selectedCommitmentId;

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) handleClose();
      }}
    >
      <DialogContent size="form">
        <DialogHeader>
          <DialogTitle>Add to Commitment CO</DialogTitle>
          <DialogDescription>
            Create a Commitment CO directly from{" "}
            {count === 1 ? "1 change event" : `${count} change events`}.
            {contractScope === "matching_cost_codes"
              ? " Showing contracts that match selected change event cost codes."
              : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {isLoadingCommitments ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : commitments.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-6 text-center">
              <FileText className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                {contractScope === "matching_cost_codes"
                  ? "No matching commitments found. Try all contracts to choose from every commitment."
                  : "No commitments found for this project. Create a subcontract or purchase order first."}
              </p>
            </div>
          ) : (
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase text-muted-foreground">
                Select commitment
              </p>
              <RadioGroup
                value={selectedCommitmentId}
                onValueChange={setSelectedCommitmentId}
                className="max-h-64 divide-y overflow-y-auto pr-1"
              >
                {commitments.map((commitment) => (
                  <div
                    key={commitment.id}
                    className="flex cursor-pointer items-center gap-3 py-2.5"
                    onClick={() => setSelectedCommitmentId(commitment.id)}
                  >
                    <RadioGroupItem
                      value={commitment.id}
                      id={`commitment-${commitment.id}`}
                    />
                    <Label
                      htmlFor={`commitment-${commitment.id}`}
                      className="min-w-0 flex-1 cursor-pointer text-sm leading-snug"
                    >
                      {commitmentLabel(commitment)}
                    </Label>
                    {commitment.status ? (
                      <StatusBadge
                        status={commitment.status}
                        className="shrink-0"
                      />
                    ) : null}
                  </div>
                ))}
              </RadioGroup>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitDisabled}>
            {isSubmitting
              ? "Creating..."
              : `Create CO for ${count} event${count === 1 ? "" : "s"}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
