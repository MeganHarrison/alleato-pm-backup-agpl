"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ds";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { FileText } from "lucide-react";
import { apiFetch } from "@/lib/api-client";

interface PrimeContract {
  id: string;
  contract_number: string;
  title: string | null;
  status: string | null;
  client: { id: string; name: string } | null;
  vendor: { id: string; name: string } | null;
}

interface AddToPrimePCODialogProps {
  open: boolean;
  onClose: () => void;
  selectedChangeEventIds: string[];
  projectId: number;
  onSuccess: () => void;
}

export function AddToPrimePCODialog({
  open,
  onClose,
  selectedChangeEventIds,
  projectId,
  onSuccess,
}: AddToPrimePCODialogProps) {
  const router = useRouter();
  const [contracts, setContracts] = useState<PrimeContract[]>([]);
  const [isLoadingContracts, setIsLoadingContracts] = useState(false);
  const [selectedContractId, setSelectedContractId] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const count = selectedChangeEventIds.length;

  // Fetch prime contracts when dialog opens
  useEffect(() => {
    if (!open) {
      setSelectedContractId("");
      return;
    }

    const fetchContracts = async () => {
      setIsLoadingContracts(true);
      try {
        const data = await apiFetch<PrimeContract[]>(`/api/projects/${projectId}/contracts`);
        setContracts(data);
      } catch {
        toast.error("Could not load prime contracts. Please try again.");
        setContracts([]);
      } finally {
        setIsLoadingContracts(false);
      }
    };

    fetchContracts();
  }, [open, projectId]);

  const handleCreatePco = async () => {
    if (!selectedContractId) {
      toast.error("Select a prime contract before continuing.");
      return;
    }

    setIsSubmitting(true);
    try {
      const query = new URLSearchParams({
        contractId: selectedContractId,
        changeEventIds: selectedChangeEventIds.join(","),
      });
      const formPath = `/${projectId}/prime-contracts/${selectedContractId}/change-orders/pcos/new?${query.toString()}`;

      toast.success("Opening Prime Contract PCO form");
      onSuccess();
      onClose();
      router.push(formPath);
    } catch (err) {
      toast.error("Failed to open Prime PCO form");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) handleClose(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add to Prime Contract PCO</DialogTitle>
          <DialogDescription>
            Select a prime contract to create a PCO for{" "}
            {count === 1 ? "1 change event" : `${count} change events`}.
          </DialogDescription>
        </DialogHeader>

        <div className="py-2 space-y-3">
          {isLoadingContracts ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : contracts.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-6 text-center">
              <FileText className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                No prime contracts found for this project.
              </p>
            </div>
          ) : (
            <RadioGroup
              value={selectedContractId}
              onValueChange={setSelectedContractId}
              className="space-y-1"
            >
              {contracts.map((contract) => {
                const partyName =
                  contract.client?.name ?? contract.vendor?.name ?? null;
                const label = [
                  `#${contract.contract_number}`,
                  contract.title,
                  partyName,
                ]
                  .filter(Boolean)
                  .join(" — ");

                return (
                  <div
                    key={contract.id}
                    className="flex items-center gap-3 rounded-md border border-border px-3 py-2.5 cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => setSelectedContractId(contract.id)}
                  >
                    <RadioGroupItem
                      value={contract.id}
                      id={`contract-${contract.id}`}
                    />
                    <Label
                      htmlFor={`contract-${contract.id}`}
                      className="flex-1 cursor-pointer text-sm leading-snug"
                    >
                      {label}
                    </Label>
                    {contract.status && (
                      <StatusBadge status={contract.status} />
                    )}
                  </div>
                );
              })}
            </RadioGroup>
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
          <Button
            onClick={handleCreatePco}
            disabled={isSubmitting || !selectedContractId || isLoadingContracts}
          >
            {isSubmitting
              ? "Creating…"
              : `Create PCO for ${count} event${count === 1 ? "" : "s"}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
