"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Modal as Dialog,
  ModalContent as DialogContent,
  ModalDescription as DialogDescription,
  ModalFooter as DialogFooter,
  ModalHeader as DialogHeader,
  ModalTitle as DialogTitle,
} from "@/components/ui/unified-modal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ds";
import { apiFetch } from "@/lib/api-client";
import { useEstimates } from "@/hooks/use-estimates";
import { useQueryClient } from "@tanstack/react-query";
import { primeContractKeys } from "@/hooks/use-prime-contracts";

interface CreatePrimeContractFromEstimateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
}

interface EstimatePreview {
  estimateId: number;
  detailItems: number;
  gcItems: number;
  detailTotal: number;
  gcTotal: number;
  alternates: Array<{ alternate_id: number; alternate_number: number; description: string; amount: number }>;
  allowances: Array<{ allowance_id: number; allowance_number: number; description: string; amount: number }>;
}

interface CreateResponse {
  contractId: string;
  contractNumber: string;
  lineItemCount: number;
  totalValue: number;
}

const currency = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export function CreatePrimeContractFromEstimateModal({
  open,
  onOpenChange,
  projectId,
}: CreatePrimeContractFromEstimateModalProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const projectIdNum = Number.parseInt(projectId, 10);

  const estimatesQuery = useEstimates(projectIdNum, { status: "approved", limit: 100 });

  const [selectedEstimateId, setSelectedEstimateId] = React.useState<string>("");
  const [title, setTitle] = React.useState("");
  const [preview, setPreview] = React.useState<EstimatePreview | null>(null);
  const [previewLoading, setPreviewLoading] = React.useState(false);
  const [previewError, setPreviewError] = React.useState<string | null>(null);
  const [includedAlternateIds, setIncludedAlternateIds] = React.useState<Set<number>>(new Set());
  const [includedAllowanceIds, setIncludedAllowanceIds] = React.useState<Set<number>>(new Set());
  const [submitting, setSubmitting] = React.useState(false);

  const approvedEstimates = estimatesQuery.data?.data ?? [];

  React.useEffect(() => {
    if (!open) {
      setSelectedEstimateId("");
      setTitle("");
      setPreview(null);
      setPreviewError(null);
      setIncludedAlternateIds(new Set());
      setIncludedAllowanceIds(new Set());
    }
  }, [open]);

  React.useEffect(() => {
    if (!selectedEstimateId) {
      setPreview(null);
      return;
    }
    const id = Number.parseInt(selectedEstimateId, 10);
    const matched = approvedEstimates.find((e) => e.estimate_id === id);
    if (matched && !title) {
      setTitle(`Contract — ${matched.title}`);
    }
    setPreviewLoading(true);
    setPreviewError(null);
    apiFetch<{
      detailItems: Array<{ estimated_amount: number | null }>;
      gcItems: Array<{ qty: number | null; rate: number | null; allocation: number | null }>;
      alternates: EstimatePreview["alternates"];
      allowances: EstimatePreview["allowances"];
    }>(`/api/projects/${projectId}/estimates/${id}`)
      .then((data) => {
        const detailTotal = (data.detailItems ?? []).reduce(
          (s, r) => s + (Number(r.estimated_amount) || 0),
          0,
        );
        const gcTotal = (data.gcItems ?? []).reduce(
          (s, r) => s + (Number(r.qty) || 0) * (Number(r.rate) || 0) * ((Number(r.allocation) ?? 100) / 100),
          0,
        );
        setPreview({
          estimateId: id,
          detailItems: data.detailItems?.length ?? 0,
          gcItems: data.gcItems?.length ?? 0,
          detailTotal,
          gcTotal,
          alternates: data.alternates ?? [],
          allowances: data.allowances ?? [],
        });
      })
      .catch((err: Error) => setPreviewError(err.message))
      .finally(() => setPreviewLoading(false));
  }, [selectedEstimateId, approvedEstimates, projectId, title]);

  const toggleAlternate = (id: number) => {
    setIncludedAlternateIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const toggleAllowance = (id: number) => {
    setIncludedAllowanceIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const altTotal = preview
    ? preview.alternates.filter((a) => includedAlternateIds.has(a.alternate_id)).reduce((s, a) => s + Number(a.amount), 0)
    : 0;
  const allowTotal = preview
    ? preview.allowances.filter((a) => includedAllowanceIds.has(a.allowance_id)).reduce((s, a) => s + Number(a.amount), 0)
    : 0;
  const projectedTotal = preview ? preview.detailTotal + preview.gcTotal + altTotal + allowTotal : 0;

  const canSubmit = !!selectedEstimateId && title.trim().length > 0 && !!preview && !submitting;

  async function handleSubmit() {
    if (!canSubmit || !preview) return;
    setSubmitting(true);
    try {
      const result = await apiFetch<CreateResponse>(
        `/api/projects/${projectId}/contracts/from-estimate`,
        {
          method: "POST",
          body: JSON.stringify({
            estimateId: preview.estimateId,
            title: title.trim(),
            includedAlternateIds: [...includedAlternateIds],
            includedAllowanceIds: [...includedAllowanceIds],
          }),
        },
      );
      toast.success(`Contract ${result.contractNumber} created`, {
        description: `${result.lineItemCount} SOV line${result.lineItemCount === 1 ? "" : "s"} • ${currency(result.totalValue)}`,
      });
      queryClient.invalidateQueries({ queryKey: primeContractKeys.all(projectIdNum) });
      onOpenChange(false);
      router.push(`/${projectId}/prime-contracts/${result.contractId}`);
    } catch (err) {
      toast.error("Failed to create contract", {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create Prime Contract from Estimate</DialogTitle>
          <DialogDescription>
            Seeds the contract&apos;s Schedule of Values from an approved estimate. Cost codes will be activated on the project budget if needed.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* Estimate selector */}
          <div className="space-y-2">
            <Label htmlFor="estimate-select">Approved Estimate</Label>
            {estimatesQuery.isLoading ? (
              <Skeleton className="h-9 w-full" />
            ) : approvedEstimates.length === 0 ? (
              <EmptyState
                icon={<AlertTriangle />}
                title="No approved estimates"
                description="Approve an estimate before creating a contract from it."
              />
            ) : (
              <Select value={selectedEstimateId} onValueChange={setSelectedEstimateId}>
                <SelectTrigger id="estimate-select">
                  <SelectValue placeholder="Choose an approved estimate…" />
                </SelectTrigger>
                <SelectContent>
                  {approvedEstimates.map((e) => (
                    <SelectItem key={e.estimate_id} value={String(e.estimate_id)}>
                      {e.estimate_number ? `${e.estimate_number} — ` : ""}
                      {e.title} (rev {e.revision})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Preview */}
          {selectedEstimateId && (
            <div className="rounded-md bg-muted/40 p-4 space-y-3">
              {previewLoading && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading estimate data…
                </div>
              )}
              {previewError && (
                <p className="text-sm text-destructive">Failed to load preview: {previewError}</p>
              )}
              {preview && !previewLoading && (
                <>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <div className="text-muted-foreground">Detail items</div>
                      <div className="font-medium">
                        {preview.detailItems} lines · {currency(preview.detailTotal)}
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">GC items</div>
                      <div className="font-medium">
                        {preview.gcItems} lines · {currency(preview.gcTotal)}
                      </div>
                    </div>
                  </div>

                  {/* Alternates */}
                  {preview.alternates.length > 0 && (
                    <div className="space-y-1.5 border-t border-border/60 pt-3">
                      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Alternates (optional)
                      </div>
                      {preview.alternates.map((alt) => (
                        <label key={alt.alternate_id} className="flex items-center gap-2 text-sm cursor-pointer">
                          <Checkbox
                            checked={includedAlternateIds.has(alt.alternate_id)}
                            onCheckedChange={() => toggleAlternate(alt.alternate_id)}
                          />
                          <span className="flex-1">
                            #{alt.alternate_number}: {alt.description}
                          </span>
                          <span className="font-medium tabular-nums">{currency(Number(alt.amount))}</span>
                        </label>
                      ))}
                    </div>
                  )}

                  {/* Allowances */}
                  {preview.allowances.length > 0 && (
                    <div className="space-y-1.5 border-t border-border/60 pt-3">
                      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Allowances (optional)
                      </div>
                      {preview.allowances.map((al) => (
                        <label key={al.allowance_id} className="flex items-center gap-2 text-sm cursor-pointer">
                          <Checkbox
                            checked={includedAllowanceIds.has(al.allowance_id)}
                            onCheckedChange={() => toggleAllowance(al.allowance_id)}
                          />
                          <span className="flex-1">
                            #{al.allowance_number}: {al.description}
                          </span>
                          <span className="font-medium tabular-nums">{currency(Number(al.amount))}</span>
                        </label>
                      ))}
                    </div>
                  )}

                  <div className="border-t border-border/60 pt-3 flex justify-between items-baseline">
                    <span className="text-sm text-muted-foreground">Projected contract value</span>
                    <span className="text-lg font-semibold tabular-nums">{currency(projectedTotal)}</span>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="contract-title">Contract Title</Label>
            <Input
              id="contract-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., General Contractor Agreement"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Create Contract
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
