"use client";

import * as React from "react";
import { Upload, AlertCircle, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

// Shape returned by GET /api/projects/[projectId]/budget lineItems[]
interface BudgetLineItem {
  id: string;
  costCode: string;          // cost_code_id (e.g. "01-010")
  costCodeDescription: string;
  costType: string;           // cost type code (e.g. "MAT")
  description: string;
  originalBudgetAmount: number;
}

interface ImportFromBudgetModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  contractId?: string;
  existingCostCodeIds?: Set<string>;
  onImportSuccess?: (items: unknown[]) => void;
}

export function ImportFromBudgetModal({
  open,
  onOpenChange,
  projectId,
  contractId,
  existingCostCodeIds,
  onImportSuccess,
}: ImportFromBudgetModalProps) {
  const [budgetLines, setBudgetLines] = React.useState<BudgetLineItem[]>([]);
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(false);
  const [isImporting, setIsImporting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open && projectId) {
      fetchBudgetLines();
    } else {
      setBudgetLines([]);
      setSelectedIds(new Set());
      setSearchQuery("");
      setError(null);
    }
  }, [open, projectId]);

  const fetchBudgetLines = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/projects/${projectId}/budget`);
      if (!response.ok) throw new Error("Failed to fetch budget lines");
      const data = await response.json();
      setBudgetLines(data.lineItems || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load budget");
    } finally {
      setIsLoading(false);
    }
  };

  const filteredLines = React.useMemo(() => {
    if (!searchQuery.trim()) return budgetLines;
    const query = searchQuery.toLowerCase();
    return budgetLines.filter(
      (line) =>
        line.costCode?.toLowerCase().includes(query) ||
        line.description?.toLowerCase().includes(query) ||
        line.costCodeDescription?.toLowerCase().includes(query) ||
        line.costType?.toLowerCase().includes(query),
    );
  }, [budgetLines, searchQuery]);

  const selectableLines = React.useMemo(
    () => filteredLines.filter((line) => !existingCostCodeIds?.has(line.costCode)),
    [filteredLines, existingCostCodeIds],
  );

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(selectableLines.map((line) => line.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectLine = (lineId: string, checked: boolean) => {
    const next = new Set(selectedIds);
    if (checked) next.add(lineId);
    else next.delete(lineId);
    setSelectedIds(next);
  };

  const handleImport = async () => {
    if (selectedIds.size === 0) {
      toast.error("Please select at least one budget line to import");
      return;
    }

    setIsImporting(true);
    setError(null);

    try {
      if (contractId) {
        // Existing contract: server handles dedup + insert
        const response = await fetch(
          `/api/projects/${projectId}/contracts/${contractId}/line-items/import`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              source: "budget",
              lineItemIds: Array.from(selectedIds),
            }),
          },
        );

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || "Failed to import from budget");
        }

        const msg = result.message || `Imported ${result.importedCount} item(s)`;
        toast.success(msg);
        onImportSuccess?.(result.items || []);
        onOpenChange(false);
      } else {
        // New contract: return selected lines for client-side mapping
        const selectedLines = budgetLines.filter((line) => selectedIds.has(line.id));
        onImportSuccess?.(selectedLines);
        onOpenChange(false);
        toast.success(`Added ${selectedLines.length} line item${selectedLines.length !== 1 ? "s" : ""} from budget`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to import from budget";
      setError(msg);
      toast.error(msg);
    } finally {
      setIsImporting(false);
    }
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);

  const allSelectableSelected =
    selectableLines.length > 0 && selectableLines.every((line) => selectedIds.has(line.id));

  return (
    <Dialog open={open} onOpenChange={isImporting ? undefined : onOpenChange}>
      <DialogContent className="sm:max-w-[900px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Import from Budget</DialogTitle>
          <DialogDescription>
            Select budget line items to import into the schedule of values. Items already in the
            SOV are shown as unavailable.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col gap-4">
          <div className="flex items-center gap-2 px-1">
            <Search className="w-4 h-4 text-muted-foreground shrink-0" />
            <Input
              placeholder="Search by cost code, description, type..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1"
            />
            <div className="text-sm text-muted-foreground shrink-0">
              {selectedIds.size} of {selectableLines.length} selected
            </div>
          </div>

          <div className="flex-1 overflow-hidden border rounded-lg">
            {isLoading ? (
              <div className="space-y-2 p-4 min-h-[200px]">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="h-4 w-4 rounded" />
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-4 flex-1" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                ))}
              </div>
            ) : error ? (
              <div className="flex items-center justify-center h-full min-h-[200px]">
                <div className="text-center text-destructive">
                  <AlertCircle className="w-8 h-8 mx-auto mb-2" />
                  <p className="text-sm">{error}</p>
                  <Button onClick={fetchBudgetLines} variant="outline" size="sm" className="mt-2">
                    Retry
                  </Button>
                </div>
              </div>
            ) : filteredLines.length === 0 ? (
              <div className="flex items-center justify-center h-full min-h-[200px]">
                <p className="text-sm text-muted-foreground">
                  {budgetLines.length === 0
                    ? "No budget lines found. Add budget items first."
                    : "No budget lines match your search."}
                </p>
              </div>
            ) : (
              <div className="overflow-auto h-full">
                <table className="w-full">
                  <thead className="bg-muted sticky top-0 border-b">
                    <tr>
                      <th className="px-4 py-3 text-left w-10">
                        <Checkbox
                          checked={allSelectableSelected}
                          onCheckedChange={handleSelectAll}
                          disabled={selectableLines.length === 0}
                        />
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Cost Code
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Type
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Description
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Budget Amount
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLines.map((line) => {
                      const alreadyImported = existingCostCodeIds?.has(line.costCode) ?? false;
                      const isSelected = selectedIds.has(line.id);
                      return (
                        <tr
                          key={line.id}
                          className={cn(
                            "border-b transition-colors",
                            alreadyImported
                              ? "opacity-40 cursor-not-allowed"
                              : "hover:bg-muted cursor-pointer",
                            isSelected && !alreadyImported && "bg-primary/5",
                          )}
                          onClick={() => {
                            if (!alreadyImported) {
                              handleSelectLine(line.id, !isSelected);
                            }
                          }}
                        >
                          <td className="px-4 py-3">
                            <Checkbox
                              checked={isSelected}
                              disabled={alreadyImported}
                              onCheckedChange={(checked) =>
                                handleSelectLine(line.id, checked === true)
                              }
                              onClick={(e) => e.stopPropagation()}
                            />
                          </td>
                          <td className="px-4 py-3 text-sm font-mono">
                            {line.costCode}
                          </td>
                          <td className="px-4 py-3 text-sm text-muted-foreground">
                            {line.costType || "—"}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            <div className="font-medium">
                              {line.costCodeDescription || line.description}
                            </div>
                            {line.costCodeDescription && line.description && (
                              <div className="text-xs text-muted-foreground">{line.description}</div>
                            )}
                            {alreadyImported && (
                              <div className="text-xs text-muted-foreground italic">Already in SOV</div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm text-right font-medium tabular-nums">
                            {formatCurrency(line.originalBudgetAmount || 0)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {error && (
            <div className="flex items-start gap-2 text-destructive bg-destructive/10 p-3 rounded-md text-sm">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <p>{error}</p>
            </div>
          )}
        </div>

        <DialogFooter>
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
            disabled={selectedIds.size === 0 || isImporting || isLoading}
          >
            {isImporting ? (
              <>
                <div className="w-4 h-4 border-2 border-background border-t-transparent rounded-full animate-spin mr-2" />
                Importing...
              </>
            ) : (
              <>
                <Upload />
                Import {selectedIds.size > 0 && `(${selectedIds.size})`}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
