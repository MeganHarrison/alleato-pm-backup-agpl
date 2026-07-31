"use client";

import * as React from "react";
import { Loader2, Sparkles } from "lucide-react";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { apiFetch } from "@/lib/api-client";

interface SeedBudgetFromEstimateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  estimateId: number;
  estimateTitle?: string;
  onSuccess?: () => void;
}

interface SeedResponse {
  upsertedCount: number;
  skippedCount: number;
  totalBudget: number;
}

type MergeStrategy = "replace" | "merge_add" | "merge_max";

const currency = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export function SeedBudgetFromEstimateModal({
  open,
  onOpenChange,
  projectId,
  estimateId,
  estimateTitle,
  onSuccess,
}: SeedBudgetFromEstimateModalProps) {
  const [strategy, setStrategy] = React.useState<MergeStrategy>("replace");
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (!open) setStrategy("replace");
  }, [open]);

  async function handleSubmit() {
    setSubmitting(true);
    try {
      const result = await apiFetch<SeedResponse>(
        `/api/projects/${projectId}/budget/seed-from-estimate`,
        {
          method: "POST",
          body: JSON.stringify({ estimateId, mergeStrategy: strategy }),
        },
      );
      toast.success("Budget seeded from estimate", {
        description: `${result.upsertedCount} line${result.upsertedCount === 1 ? "" : "s"} written · ${result.skippedCount} unchanged · total ${currency(result.totalBudget)}`,
      });
      onSuccess?.();
      onOpenChange(false);
    } catch (err) {
      toast.error("Seed failed", {
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
            <Sparkles className="h-4 w-4" />
            Seed Budget from Estimate
          </DialogTitle>
          <DialogDescription>
            Creates or updates project budget lines from {estimateTitle ? <span className="font-medium">{estimateTitle}</span> : "this estimate"}. Cost codes will be activated as needed.
          </DialogDescription>
        </DialogHeader>

        <RadioGroup
          value={strategy}
          onValueChange={(v) => setStrategy(v as MergeStrategy)}
          className="space-y-3"
        >
          <label className="flex items-start gap-3 cursor-pointer rounded-md p-2 hover:bg-muted/40">
            <RadioGroupItem value="replace" id="seed-replace" className="mt-1" />
            <div className="flex-1">
              <Label htmlFor="seed-replace" className="font-medium cursor-pointer">
                Replace
              </Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Overwrite existing budget line amounts with estimate amounts.
              </p>
            </div>
          </label>
          <label className="flex items-start gap-3 cursor-pointer rounded-md p-2 hover:bg-muted/40">
            <RadioGroupItem value="merge_add" id="seed-add" className="mt-1" />
            <div className="flex-1">
              <Label htmlFor="seed-add" className="font-medium cursor-pointer">
                Add to existing
              </Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Increase existing budget amounts by the estimate&apos;s amount (totals grow).
              </p>
            </div>
          </label>
          <label className="flex items-start gap-3 cursor-pointer rounded-md p-2 hover:bg-muted/40">
            <RadioGroupItem value="merge_max" id="seed-max" className="mt-1" />
            <div className="flex-1">
              <Label htmlFor="seed-max" className="font-medium cursor-pointer">
                Take higher (conservative)
              </Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Update only when the estimate amount is higher than the existing budget.
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
            Seed Budget
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
