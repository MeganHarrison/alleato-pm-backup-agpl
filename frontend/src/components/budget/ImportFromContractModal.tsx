"use client";

import * as React from "react";
import { AlertCircle, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiFetch } from "@/lib/api-client";
import { BaseModal, ModalBody, ModalFooter } from "@/components/budget/modals/BaseModal";
import { toast } from "sonner";

interface PrimeContract {
  id: string;
  title: string | null;
  contract_number: string | null;
  status: string;
}

interface SovLineItem {
  id: string;
  line_number: number;
  description: string;
  total_cost: number | null;
  unit_cost: number | null;
  quantity: number | null;
  unit_of_measure: string | null;
  budget_code_id: string | null;
  cost_code_id: string | null;
}

interface ImportResult {
  success: boolean;
  importedCount: number;
  createdCount?: number;
  updatedCount?: number;
  matchedCount?: number;
  reconciledCount?: number;
  totalRows: number;
  skippedCount: number;
  skipped?: string[];
  message: string;
}

interface ImportFromContractModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  onSuccess?: () => void;
}

const formatCurrency = (value: number | null | undefined) => {
  if (value == null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
};

export function ImportFromContractModal({
  open,
  onOpenChange,
  projectId,
  onSuccess,
}: ImportFromContractModalProps) {
  const [contracts, setContracts] = React.useState<PrimeContract[]>([]);
  const [selectedContractId, setSelectedContractId] = React.useState<string>("");
  const [previewItems, setPreviewItems] = React.useState<SovLineItem[] | null>(null);
  const [loadingContracts, setLoadingContracts] = React.useState(false);
  const [loadingPreview, setLoadingPreview] = React.useState(false);
  const [isImporting, setIsImporting] = React.useState(false);

  // Reset state on close
  React.useEffect(() => {
    if (!open) {
      setSelectedContractId("");
      setPreviewItems(null);
    }
  }, [open]);

  // Load contracts when modal opens
  React.useEffect(() => {
    if (!open) return;
    setLoadingContracts(true);
    apiFetch<PrimeContract[]>(`/api/projects/${projectId}/contracts`)
      .then((data) => setContracts(Array.isArray(data) ? data : []))
      .catch(() => toast.error("Failed to load prime contracts"))
      .finally(() => setLoadingContracts(false));
  }, [open, projectId]);

  // Load SOV preview when contract selection changes
  React.useEffect(() => {
    if (!selectedContractId) {
      setPreviewItems(null);
      return;
    }
    setLoadingPreview(true);
    apiFetch<SovLineItem[]>(`/api/projects/${projectId}/contracts/${selectedContractId}/line-items`)
      .then((data) => setPreviewItems(Array.isArray(data) ? data : []))
      .catch(() => {
        toast.error("Failed to load Schedule of Values");
        setPreviewItems([]);
      })
      .finally(() => setLoadingPreview(false));
  }, [selectedContractId, projectId]);

  const handleImport = async () => {
    if (!selectedContractId) return;
    setIsImporting(true);
    try {
      const result = await apiFetch<ImportResult>(`/api/projects/${projectId}/budget/import-from-contract`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contractId: selectedContractId }),
      });

      toast.success(result.message);
      if (result.skipped && result.skipped.length > 0) {
        toast.warning(`${result.skippedCount} budget group(s) need review`);
      }
      onOpenChange(false);
      onSuccess?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to import from contract");
    } finally {
      setIsImporting(false);
    }
  };

  const selectedContract = contracts.find((c) => c.id === selectedContractId);
  const contractLabel = (c: PrimeContract) =>
    [c.contract_number, c.title].filter(Boolean).join(" — ") || c.id;

  const totalValue = previewItems?.reduce((sum, item) => sum + (item.total_cost ?? 0), 0) ?? 0;

  return (
    <BaseModal
      isOpen={open}
      onClose={() => { if (!isImporting) onOpenChange(false); }}
      title="Import from Prime Contract SOV"
      size="lg"
    >
      <ModalBody>
        <div className="space-y-5">
          {/* Info banner */}
          <div className="rounded-lg bg-muted/50 p-4 text-sm text-muted-foreground flex items-start gap-3">
            <FileText className="h-4 w-4 mt-0.5 shrink-0 text-foreground" />
            <p>
              Reconciles the budget to a Prime Contract Schedule of Values.
              Each SOV row becomes its own budget line so repeated budget codes can keep separate cost detail.
            </p>
          </div>

          {/* Contract selector */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              Prime Contract <span className="text-destructive">*</span>
            </label>
            {loadingContracts ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading contracts…
              </div>
            ) : contracts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No prime contracts found for this project.</p>
            ) : (
              <Select value={selectedContractId} onValueChange={setSelectedContractId} disabled={isImporting}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a prime contract…" />
                </SelectTrigger>
                <SelectContent>
                  {contracts.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {contractLabel(c)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* SOV preview */}
          {selectedContractId && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Schedule of Values — {selectedContract ? contractLabel(selectedContract) : ""}
              </p>

              {loadingPreview ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading line items…
                </div>
              ) : previewItems === null || previewItems.length === 0 ? (
                <div className="flex items-start gap-2 rounded-md bg-warning/10 p-3 text-sm">
                  <AlertCircle className="h-4 w-4 text-warning mt-0.5 shrink-0" />
                  <p className="text-warning">This contract has no Schedule of Values line items.</p>
                </div>
              ) : (
                <>
                  <div className="rounded-lg border overflow-hidden">
                    <div className="max-h-56 overflow-y-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/50 sticky top-0">
                          <tr>
                            <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground w-10">#</th>
                            <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Description</th>
                            <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground">Amount</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {previewItems.map((item) => (
                            <tr key={item.id} className="hover:bg-muted/30">
                              <td className="px-3 py-2 text-muted-foreground text-xs">{item.line_number}</td>
                              <td className="px-3 py-2 text-foreground truncate max-w-xs">{item.description}</td>
                              <td className="px-3 py-2 text-right tabular-nums text-foreground">
                                {formatCurrency(item.total_cost)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-muted/30 border-t">
                          <tr>
                            <td colSpan={2} className="px-3 py-2 text-xs font-medium text-foreground">
                              Total ({previewItems.length} line item{previewItems.length !== 1 ? "s" : ""})
                            </td>
                            <td className="px-3 py-2 text-right text-xs font-semibold text-foreground tabular-nums">
                              {formatCurrency(totalValue)}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Unsupported rows without a budget code or markup mapping will be reported after import.
                  </p>
                </>
              )}
            </div>
          )}
        </div>
      </ModalBody>

      <ModalFooter>
        <Button
          type="button"
          variant="outline"
          onClick={() => onOpenChange(false)}
          disabled={isImporting}
        >
          Cancel
        </Button>
        <Button
          type="button"
          onClick={handleImport}
          disabled={!selectedContractId || isImporting || (previewItems !== null && previewItems.length === 0)}
        >
          {isImporting ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Importing…
            </>
          ) : (
            "Import to Budget"
          )}
        </Button>
      </ModalFooter>
    </BaseModal>
  );
}
