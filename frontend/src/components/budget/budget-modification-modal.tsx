"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BaseModal,
  ModalBody,
  ModalFooter,
} from "@/components/budget/modals/BaseModal";

interface BudgetLineItem {
  id: string;
  costCode: string;
  costCodeDescription?: string;
  costType?: string;
  description: string;
}

interface BudgetModificationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  onSuccess?: () => void;
  preselectedLineItem?: BudgetLineItem | null;
}

interface TransferRow {
  id: string;
  fromBudgetLineId: string;
  toBudgetLineId: string;
  amount: string;
  notes: string;
}

function createTransferRow(
  fromBudgetLineId = "",
  toBudgetLineId = "",
): TransferRow {
  return {
    id: crypto.randomUUID(),
    fromBudgetLineId,
    toBudgetLineId,
    amount: "",
    notes: "",
  };
}

function formatBudgetLineLabel(item: BudgetLineItem): string {
  const code = [item.costCode, item.costType].filter(Boolean).join(".");
  const label = item.costCodeDescription || item.description;
  return label ? `${code} - ${label}` : code;
}

export function BudgetModificationModal({
  open,
  onOpenChange,
  projectId,
  onSuccess,
  preselectedLineItem,
}: BudgetModificationModalProps) {
  const [loading, setLoading] = useState(false);
  const [loadingItems, setLoadingItems] = useState(false);
  const [budgetItems, setBudgetItems] = useState<BudgetLineItem[]>([]);
  const [rows, setRows] = useState<TransferRow[]>([
    createTransferRow(preselectedLineItem?.id),
  ]);

  useEffect(() => {
    if (!open) return;

    setRows([createTransferRow(preselectedLineItem?.id)]);

    const fetchBudgetItems = async () => {
      try {
        setLoadingItems(true);
        const data = await apiFetch<{ lineItems?: BudgetLineItem[] }>(
          `/api/projects/${projectId}/budget`,
        );
        setBudgetItems(data.lineItems ?? []);
      } catch {
        setBudgetItems([]);
        toast.error("Unable to load budget items for modifications");
      } finally {
        setLoadingItems(false);
      }
    };

    fetchBudgetItems();
  }, [open, projectId, preselectedLineItem]);

  const budgetItemOptions = useMemo(
    () =>
      budgetItems.map((item) => ({
        id: item.id,
        label: formatBudgetLineLabel(item),
      })),
    [budgetItems],
  );

  const updateRow = (rowId: string, updates: Partial<TransferRow>) => {
    setRows((current) =>
      current.map((row) => (row.id === rowId ? { ...row, ...updates } : row)),
    );
  };

  const addRow = () => {
    setRows((current) => [...current, createTransferRow()]);
  };

  const removeRow = (rowId: string) => {
    setRows((current) => current.filter((row) => row.id !== rowId));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    const invalidRow = rows.find(
      (row) =>
        !row.fromBudgetLineId ||
        !row.toBudgetLineId ||
        row.fromBudgetLineId === row.toBudgetLineId ||
        !row.amount ||
        Number(row.amount) <= 0,
    );

    if (invalidRow) {
      toast.error("Complete each modification row", {
        description:
          "Choose different From and To line items and enter an amount greater than zero.",
      });
      return;
    }

    setLoading(true);
    try {
      const result = await apiFetch<{ data?: { number?: string } }>(
        `/api/projects/${projectId}/budget/modifications`,
        {
          method: "POST",
          body: JSON.stringify({
            title: "Budget Transfer",
            reason: rows.map((row) => row.notes).find(Boolean) ?? undefined,
            transferLines: rows.map((row) => ({
              fromBudgetLineId: row.fromBudgetLineId,
              toBudgetLineId: row.toBudgetLineId,
              amount: row.amount,
              notes: row.notes,
            })),
          }),
        },
      );

      toast.success(
        `Budget modification ${result.data?.number ?? ""} created as draft.`,
      );
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      toast.error("Failed to create budget modification", {
        description:
          error instanceof Error ? error.message : "An unexpected error occurred.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <BaseModal
      isOpen={open}
      onClose={() => onOpenChange(false)}
      title="Add Budget Modification"
      description="Transfer budget value between existing line items. Each row creates a balanced move from one line to another."
      size="lg"
    >
      <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
        <ModalBody className="space-y-4">
          {rows.map((row, index) => (
            <div
              key={row.id}
              className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_9rem_minmax(12rem,1fr)_auto]"
            >
              <div className="grid gap-2">
                <Label htmlFor={`from-${row.id}`}>From</Label>
                <Select
                  value={row.fromBudgetLineId}
                  onValueChange={(value) =>
                    updateRow(row.id, { fromBudgetLineId: value })
                  }
                  disabled={loadingItems || !budgetItemOptions.length}
                >
                  <SelectTrigger id={`from-${row.id}`}>
                    <SelectValue
                      placeholder={loadingItems ? "Loading..." : "Select line item"}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {budgetItemOptions.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor={`to-${row.id}`}>To</Label>
                <Select
                  value={row.toBudgetLineId}
                  onValueChange={(value) =>
                    updateRow(row.id, { toBudgetLineId: value })
                  }
                  disabled={loadingItems || !budgetItemOptions.length}
                >
                  <SelectTrigger id={`to-${row.id}`}>
                    <SelectValue
                      placeholder={loadingItems ? "Loading..." : "Select line item"}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {budgetItemOptions.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor={`amount-${row.id}`}>Amount</Label>
                <div className="flex overflow-hidden rounded-md border border-input bg-background">
                  <span className="flex h-10 items-center border-r border-input px-3 text-sm text-muted-foreground">
                    $
                  </span>
                  <Input
                    id={`amount-${row.id}`}
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={row.amount}
                    onChange={(event) =>
                      updateRow(row.id, { amount: event.target.value })
                    }
                    className="h-10 rounded-none border-0 focus-visible:ring-0"
                    placeholder=""
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor={`notes-${row.id}`}>Notes</Label>
                <Input
                  id={`notes-${row.id}`}
                  value={row.notes}
                  onChange={(event) =>
                    updateRow(row.id, { notes: event.target.value })
                  }
                />
              </div>

              <div className="flex items-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeRow(row.id)}
                  disabled={rows.length === 1 || loading}
                  aria-label={`Remove modification row ${index + 1}`}
                >
                  <Trash2 />
                </Button>
              </div>
            </div>
          ))}

          <Button
            type="button"
            variant="secondary"
            className="w-full"
            onClick={addRow}
            disabled={loading}
          >
            <Plus />
            Add Additional Modifications
          </Button>

          {!budgetItemOptions.length && !loadingItems && (
            <p className="text-sm text-muted-foreground">
              No budget line items are available for modification.
            </p>
          )}
        </ModalBody>

        <ModalFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={loading || loadingItems}>
            {loading ? "Saving..." : "Save"}
          </Button>
        </ModalFooter>
      </form>
    </BaseModal>
  );
}
