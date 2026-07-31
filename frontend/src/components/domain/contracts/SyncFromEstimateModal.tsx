"use client";

import * as React from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Modal as Dialog,
  ModalContent as DialogContent,
  ModalDescription as DialogDescription,
  ModalFooter as DialogFooter,
  ModalHeader as DialogHeader,
  ModalTitle as DialogTitle,
} from "@/components/ui/unified-modal";
import { Label } from "@/components/ui/label";
import {
  RadioGroup,
  RadioGroupItem,
} from "@/components/ui/radio-group";
import { apiFetch } from "@/lib/api-client";

interface SyncFromEstimateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  contractId: string;
  /** Optional callback after a successful sync (typically used to invalidate queries). */
  onSuccess?: () => void;
}

interface SyncResponse {
  updatedCount: number;
  addedCount: number;
  skippedCount: number;
  estimateVersion: number;
}

type MergeStrategy = "replace_amounts" | "add_new_lines_only";

export function SyncFromEstimateModal({
  open,
  onOpenChange,
  projectId,
  contractId,
  onSuccess,
}: SyncFromEstimateModalProps) {
  const [strategy, setStrategy] = React.useState<MergeStrategy>("replace_amounts");
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (!open) setStrategy("replace_amounts");
  }, [open]);

  async function handleSubmit() {
    setSubmitting(true);
    try {
      const result = await apiFetch<SyncResponse>(
        `/api/projects/${projectId}/contracts/${contractId}/sync-from-estimate`,
        {
          method: "POST",
          body: JSON.stringify({ mergeStrategy: strategy }),
        },
      );
      toast.success(`Synced from estimate (rev ${result.estimateVersion})`, {
        description: `${result.updatedCount} updated · ${result.addedCount} added · ${result.skippedCount} skipped`,
      });
      onSuccess?.();
      onOpenChange(false);
    } catch (err) {
      toast.error("Sync failed", {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4" />
            Sync from Estimate
          </DialogTitle>
          <DialogDescription>
            Refresh this contract&apos;s Schedule of Values from the linked estimate&apos;s current revision.
          </DialogDescription>
        </DialogHeader>

        <RadioGroup
          value={strategy}
          onValueChange={(v) => setStrategy(v as MergeStrategy)}
          className="space-y-3"
        >
          <label className="flex items-start gap-3 cursor-pointer rounded-md p-2 hover:bg-muted/40">
            <RadioGroupItem value="replace_amounts" id="strategy-replace" className="mt-1" />
            <div className="flex-1">
              <Label htmlFor="strategy-replace" className="font-medium cursor-pointer">
                Replace amounts
              </Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Update existing SOV line totals to match the estimate. New cost codes are added; no lines are deleted.
              </p>
            </div>
          </label>
          <label className="flex items-start gap-3 cursor-pointer rounded-md p-2 hover:bg-muted/40">
            <RadioGroupItem value="add_new_lines_only" id="strategy-add" className="mt-1" />
            <div className="flex-1">
              <Label htmlFor="strategy-add" className="font-medium cursor-pointer">
                Add new lines only
              </Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Only insert SOV lines for cost codes not already on this contract. Existing amounts are untouched.
              </p>
            </div>
          </label>
        </RadioGroup>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Sync now
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
