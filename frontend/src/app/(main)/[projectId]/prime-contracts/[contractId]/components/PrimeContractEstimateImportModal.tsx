"use client";

import * as React from "react";
import {
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { InfoAlert } from "@/components/ds/InfoAlert";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Modal,
  ModalContent,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from "@/components/ui/unified-modal";
import { apiFetch } from "@/lib/api-client";
import { resolveBudgetCodeByCodeAndCostType } from "@/lib/budget/budget-code-selection";
import { cn } from "@/lib/utils";
import type { BudgetCode, ContractLineItem } from "../types";

interface EstimateSovPreviewRow {
  sourceSheet: "General Conditions" | "Details";
  rowNumber: number;
  costCode: string;
  costType: string;
  costTypeCode: string;
  description: string;
  workDescription: string | null;
  budgetAmount: number;
  unitQty: number | null;
  unitOfMeasure: string | null;
  unitCost: number | null;
  includeInPrimeContract: boolean;
  includeInOwnerSov: boolean;
  costTypeId: string | null;
  budgetCodeId: string | null;
  hasBudgetCodeMapping: boolean;
  alreadyInSov: boolean;
  selectedByDefault: boolean;
  warnings: string[];
}

interface EstimateSovPreview {
  importableCount: number;
  ownerSovCount: number;
  selectedByDefaultCount: number;
  existingSovMatchCount: number;
  missingBudgetCodeMappingCount: number;
  totalBudgetAmount: number;
  warnings: string[];
  rows: EstimateSovPreviewRow[];
}

interface ActivateBudgetCodesResponse {
  success: boolean;
  createdCostCodes: number;
  addedProjectBudgetCodes: number;
  reactivatedProjectBudgetCodes: number;
  budgetCodes: Array<{
    id: string;
    costCode: string;
    costTypeId: string | null;
  }>;
}

interface EstimateSovRowEdit {
  description: string;
  costTypeCode: string;
  quantity: string;
  unitOfMeasure: string;
  scheduledValue: string;
}

interface ActiveBudgetCodeMapping {
  id: string;
  costCode: string;
  costTypeId: string | null;
}

interface CostTypeOption {
  code: string;
  id: string | null;
}

interface PrimeContractEstimateImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  contractId: string;
  budgetCodes: BudgetCode[];
  existingLineItems: ContractLineItem[];
  onImported: (items: ContractLineItem[]) => void;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDescription(row: EstimateSovPreviewRow): string {
  return row.workDescription
    ? `${row.description} - ${row.workDescription}`
    : row.description;
}

function getRowKey(row: EstimateSovPreviewRow): string {
  return `${row.sourceSheet}:${row.rowNumber}`;
}

function createRowEdit(row: EstimateSovPreviewRow): EstimateSovRowEdit {
  return {
    description: formatDescription(row),
    costTypeCode: row.costTypeCode,
    quantity: row.unitQty && row.unitQty > 0 ? String(row.unitQty) : "1",
    unitOfMeasure: row.unitOfMeasure || "LS",
    scheduledValue: String(row.budgetAmount),
  };
}

function parsePositiveNumber(value: string, fallback: number): number {
  const parsed = Number(value.replace(/,/g, ""));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function resolveBudgetCodeId(
  row: EstimateSovPreviewRow,
  costTypeCode: string,
  budgetCodes: BudgetCode[],
  activatedBudgetCodes: ActiveBudgetCodeMapping[],
  costTypeIdByCode: Map<string, string | null>,
): string | null {
  if (costTypeCode === row.costTypeCode && row.budgetCodeId) {
    return row.budgetCodeId;
  }

  const match = resolveBudgetCodeByCodeAndCostType(
    row.costCode,
    costTypeCode,
    budgetCodes,
  );
  if (match?.id) return match.id;

  const costTypeId = costTypeIdByCode.get(costTypeCode);
  const activatedMatch = activatedBudgetCodes.find(
    (code) => code.costCode === row.costCode && code.costTypeId === costTypeId,
  );
  return activatedMatch?.id ?? null;
}

export function PrimeContractEstimateImportModal({
  open,
  onOpenChange,
  projectId,
  contractId,
  budgetCodes,
  existingLineItems,
  onImported,
}: PrimeContractEstimateImportModalProps) {
  const [file, setFile] = React.useState<File | null>(null);
  const [preview, setPreview] = React.useState<EstimateSovPreview | null>(null);
  const [selectedRows, setSelectedRows] = React.useState<Set<string>>(
    new Set(),
  );
  const [rowEdits, setRowEdits] = React.useState<
    Record<string, EstimateSovRowEdit>
  >({});
  const [activatedBudgetCodes, setActivatedBudgetCodes] = React.useState<
    ActiveBudgetCodeMapping[]
  >([]);
  const [isConfirmingAppend, setIsConfirmingAppend] = React.useState(false);
  const [isPreviewing, setIsPreviewing] = React.useState(false);
  const [isImporting, setIsImporting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (!open) {
      setFile(null);
      setPreview(null);
      setSelectedRows(new Set());
      setRowEdits({});
      setActivatedBudgetCodes([]);
      setIsConfirmingAppend(false);
      setIsPreviewing(false);
      setIsImporting(false);
      setError(null);
    }
  }, [open]);

  const previewRows =
    preview?.rows.filter((row) => row.includeInOwnerSov) ?? [];
  const costTypeOptions = React.useMemo<CostTypeOption[]>(() => {
    const options = new Map<string, CostTypeOption>();
    for (const code of budgetCodes) {
      if (code.costType) {
        options.set(code.costType, {
          code: code.costType,
          id: code.costTypeId ?? null,
        });
      }
    }
    for (const row of previewRows) {
      if (row.costTypeCode) {
        options.set(row.costTypeCode, {
          code: row.costTypeCode,
          id: row.costTypeId,
        });
      }
    }
    return [...options.values()].sort((a, b) => a.code.localeCompare(b.code));
  }, [budgetCodes, previewRows]);
  const costTypeIdByCode = React.useMemo(
    () => new Map(costTypeOptions.map((option) => [option.code, option.id])),
    [costTypeOptions],
  );
  const selectedPreviewRows = previewRows.filter((row) =>
    selectedRows.has(getRowKey(row)),
  );
  const selectedScheduledValue = selectedPreviewRows.reduce((total, row) => {
    const edit = rowEdits[getRowKey(row)] ?? createRowEdit(row);
    return total + parsePositiveNumber(edit.scheduledValue, row.budgetAmount);
  }, 0);
  const nextLineNumber =
    existingLineItems.reduce(
      (max, item) => Math.max(max, item.line_number),
      0,
    ) + 1;
  const rowsMissingBudgetCodes = previewRows.filter((row) => {
    const edit = rowEdits[getRowKey(row)] ?? createRowEdit(row);
    return (
      !resolveBudgetCodeId(
        row,
        edit.costTypeCode,
        budgetCodes,
        activatedBudgetCodes,
        costTypeIdByCode,
      ) &&
      !row.alreadyInSov &&
      row.warnings.length === 0
    );
  });

  const handleFileSelect = (selectedFile: File) => {
    const isExcel =
      selectedFile.name.endsWith(".xlsx") ||
      selectedFile.name.endsWith(".xlsm");
    if (!isExcel) {
      setError("Upload an Alleato estimate workbook as .xlsx or .xlsm.");
      setFile(null);
      return;
    }
    setFile(selectedFile);
    setPreview(null);
    setSelectedRows(new Set());
    setRowEdits({});
    setActivatedBudgetCodes([]);
    setIsConfirmingAppend(false);
    setError(null);
  };

  const handlePreview = async () => {
    if (!file) return;
    setIsPreviewing(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const result = await apiFetch<EstimateSovPreview>(
        `/api/projects/${projectId}/contracts/${contractId}/line-items/estimate-import/preview`,
        { method: "POST", body: formData },
      );
      setPreview(result);
      setSelectedRows(
        new Set(
          result.rows
            .filter((row) => row.selectedByDefault)
            .map((row) => getRowKey(row)),
        ),
      );
      setRowEdits(
        Object.fromEntries(
          result.rows
            .filter((row) => row.includeInOwnerSov)
            .map((row) => [getRowKey(row), createRowEdit(row)]),
        ),
      );
      setActivatedBudgetCodes([]);
      setIsConfirmingAppend(false);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Failed to preview estimate workbook.";
      setError(message);
      toast.error(message);
    } finally {
      setIsPreviewing(false);
    }
  };

  const toggleRow = (row: EstimateSovPreviewRow, checked: boolean) => {
    const key = getRowKey(row);
    setSelectedRows((prev) => {
      const next = new Set(prev);
      if (checked) next.add(key);
      else next.delete(key);
      return next;
    });
    setIsConfirmingAppend(false);
  };

  const updateRowEdit = (
    row: EstimateSovPreviewRow,
    patch: Partial<EstimateSovRowEdit>,
  ) => {
    const key = getRowKey(row);
    setRowEdits((current) => ({
      ...current,
      [key]: {
        ...(current[key] ?? createRowEdit(row)),
        ...patch,
      },
    }));
    if (patch.costTypeCode !== undefined) {
      setSelectedRows((current) => {
        const next = new Set(current);
        next.delete(key);
        return next;
      });
    }
    setIsConfirmingAppend(false);
  };

  const handleAppendToSov = async () => {
    if (selectedPreviewRows.length === 0) return;
    setIsImporting(true);
    setError(null);

    try {
      const maxLineNumber = existingLineItems.reduce(
        (max, item) => Math.max(max, item.line_number),
        0,
      );

      // Auto-activate any budget codes that are missing for selected rows
      const rowsNeedingActivation = selectedPreviewRows.filter((row) => {
        const edit = rowEdits[getRowKey(row)] ?? createRowEdit(row);
        return !resolveBudgetCodeId(
          row,
          edit.costTypeCode,
          budgetCodes,
          activatedBudgetCodes,
          costTypeIdByCode,
        );
      });

      let currentActivatedBudgetCodes = activatedBudgetCodes;
      if (rowsNeedingActivation.length > 0) {
        const activationResult = await apiFetch<ActivateBudgetCodesResponse>(
          `/api/projects/${projectId}/contracts/${contractId}/line-items/estimate-import/activate-budget-codes`,
          {
            method: "POST",
            body: JSON.stringify({
              rows: rowsNeedingActivation.map((row) => ({
                costCode: row.costCode,
                costTypeCode:
                  rowEdits[getRowKey(row)]?.costTypeCode ?? row.costTypeCode,
                description: (
                  rowEdits[getRowKey(row)]?.description ?? row.description
                ).trim(),
              })),
            }),
          },
        );
        currentActivatedBudgetCodes = [
          ...activatedBudgetCodes,
          ...activationResult.budgetCodes,
        ];
        setActivatedBudgetCodes(currentActivatedBudgetCodes);
      }

      const createdItems: ContractLineItem[] = [];

      for (const [index, row] of selectedPreviewRows.entries()) {
        const edit = rowEdits[getRowKey(row)] ?? createRowEdit(row);
        const quantity = parsePositiveNumber(edit.quantity, 1);
        const scheduledValue = parsePositiveNumber(
          edit.scheduledValue,
          row.budgetAmount,
        );
        const unitCost = scheduledValue / quantity;
        const created = await apiFetch<ContractLineItem>(
          `/api/projects/${projectId}/contracts/${contractId}/line-items`,
          {
            method: "POST",
            body: JSON.stringify({
              line_number: maxLineNumber + index + 1,
              description: edit.description.trim() || formatDescription(row),
              cost_code_id: row.costCode,
              budget_code_id: resolveBudgetCodeId(
                row,
                edit.costTypeCode,
                budgetCodes,
                currentActivatedBudgetCodes,
                costTypeIdByCode,
              ),
              quantity,
              unit_of_measure: edit.unitOfMeasure.trim() || "LS",
              unit_cost: unitCost,
            }),
          },
        );
        // apiFetch returns null at runtime for empty-body or 204 responses even
        // though it's typed as T. Guard here so a failed/empty response never
        // injects undefined into lineItems and crashes the SOV render.
        if (created) createdItems.push(created);
      }

      toast.success(
        `Added ${createdItems.length} SOV line${createdItems.length === 1 ? "" : "s"}.`,
      );
      onImported(createdItems);
      onOpenChange(false);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Failed to add estimate rows to SOV.";
      setError(message);
      toast.error(message);
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={(nextOpen) => !isImporting && onOpenChange(nextOpen)}
    >
      <ModalContent className="sm:max-w-4xl">
        <ModalHeader>
          <ModalTitle>Import Estimate To SOV</ModalTitle>
          <ModalDescription>
            Preview the estimate workbook and append selected rows to this prime
            contract.
          </ModalDescription>
        </ModalHeader>

        <div className="space-y-5 py-2">
          <InfoAlert variant="info">
            <p className="font-semibold">Nothing is overwritten.</p>
            <p className="text-muted-foreground">
              Existing SOV cost codes are detected and left unselected until you
              choose otherwise.
            </p>
          </InfoAlert>

          <div className="space-y-2">
            <Button type="button" variant="outline" size="sm" asChild>
              <a
                href={`/api/projects/${projectId}/contracts/estimate-sov-template`}
              >
                <Download className="h-4 w-4" />
                Download template
              </a>
            </Button>

            {!file ? (
              <Button
                type="button"
                variant="outline"
                className="h-auto w-full justify-start gap-3 px-4 py-4"
                onClick={() => fileInputRef.current?.click()}
              >
                <FileSpreadsheet className="h-5 w-5" />
                <span className="text-left">
                  <span className="block text-sm font-medium">
                    Choose estimate workbook
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    .xlsx or .xlsm
                  </span>
                </span>
              </Button>
            ) : (
              <div className="flex items-center justify-between rounded-md bg-muted/40 px-4 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
                  <p className="truncate text-sm font-medium text-foreground">
                    {file.name}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => {
                    setFile(null);
                    setPreview(null);
                    setSelectedRows(new Set());
                    setRowEdits({});
                    setIsConfirmingAppend(false);
                  }}
                  disabled={isImporting}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xlsm,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
              className="hidden"
              onChange={(event) => {
                const selectedFile = event.target.files?.[0];
                if (selectedFile) handleFileSelect(selectedFile);
              }}
            />

            {error ? <InfoAlert variant="error">{error}</InfoAlert> : null}
          </div>

          {preview ? (
            <div className="space-y-3">
              <div className="grid grid-cols-4 gap-2">
                <div className="rounded-md bg-muted/40 px-3 py-2">
                  <p className="text-xs text-muted-foreground">
                    SOV candidates
                  </p>
                  <p className="text-sm font-semibold text-foreground">
                    {preview.ownerSovCount}
                  </p>
                </div>
                <div className="rounded-md bg-muted/40 px-3 py-2">
                  <p className="text-xs text-muted-foreground">Selected</p>
                  <p className="text-sm font-semibold text-foreground">
                    {selectedRows.size}
                  </p>
                </div>
                <div className="rounded-md bg-muted/40 px-3 py-2">
                  <p className="text-xs text-muted-foreground">
                    Already in SOV
                  </p>
                  <p className="text-sm font-semibold text-foreground">
                    {preview.existingSovMatchCount}
                  </p>
                </div>
                <div className="rounded-md bg-muted/40 px-3 py-2">
                  <p className="text-xs text-muted-foreground">New budget codes</p>
                  <p className="text-sm font-semibold text-foreground">
                    {rowsMissingBudgetCodes.length}
                  </p>
                </div>
              </div>

              {rowsMissingBudgetCodes.length > 0 ? (
                <InfoAlert variant="info">
                  <p className="font-medium">
                    {rowsMissingBudgetCodes.length} new budget code
                    {rowsMissingBudgetCodes.length === 1 ? "" : "s"} will be
                    added to this project automatically on import.
                  </p>
                </InfoAlert>
              ) : null}

              {preview.warnings.length > 0 ? (
                <InfoAlert variant="warning">
                  <p className="font-medium">
                    {preview.warnings.length} workbook warning
                    {preview.warnings.length === 1 ? "" : "s"}
                  </p>
                  <ul className="mt-1 max-h-20 space-y-0.5 overflow-y-auto text-xs">
                    {preview.warnings.slice(0, 5).map((warning) => (
                      <li key={warning}>{warning}</li>
                    ))}
                    {preview.warnings.length > 5 ? (
                      <li className="italic">
                        +{preview.warnings.length - 5} more
                      </li>
                    ) : null}
                  </ul>
                </InfoAlert>
              ) : null}

              <div className="max-h-96 overflow-auto rounded-md border">
                <div className="grid min-w-full grid-cols-[36px_92px_minmax(240px,1fr)_96px_64px_68px_112px] gap-3 bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground">
                  <span />
                  <span>Code</span>
                  <span>Description</span>
                  <span>Type</span>
                  <span>Qty</span>
                  <span>UOM</span>
                  <span className="text-right">Amount</span>
                </div>
                <div className="divide-y">
                  {previewRows.map((row) => {
                    const key = getRowKey(row);
                    const hasWarnings = row.warnings.length > 0;
                    const edit = rowEdits[key] ?? createRowEdit(row);
                    const hasBudgetCodeMapping = Boolean(
                      resolveBudgetCodeId(
                        row,
                        edit.costTypeCode,
                        budgetCodes,
                        activatedBudgetCodes,
                        costTypeIdByCode,
                      ),
                    );
                    const cannotSelect = row.alreadyInSov || hasWarnings;
                    const cannotEdit =
                      row.alreadyInSov || hasWarnings || isImporting;
                    return (
                      <div
                        key={key}
                        className={cn(
                          "grid min-w-full grid-cols-[36px_92px_minmax(240px,1fr)_96px_64px_68px_112px] gap-3 px-3 py-2 text-xs",
                          cannotSelect && "bg-muted/20 text-muted-foreground",
                        )}
                      >
                        <Checkbox
                          checked={selectedRows.has(key)}
                          disabled={cannotSelect || isImporting}
                          onCheckedChange={(checked) =>
                            toggleRow(row, checked === true)
                          }
                          aria-label={`Select ${row.costCode}`}
                        />
                        <span className="min-w-0">
                          <span className="block font-medium text-foreground">
                            {row.costCode}
                          </span>
                          <span className="block text-muted-foreground">
                            Row {row.rowNumber}
                          </span>
                        </span>
                        <span className="min-w-0 space-y-1">
                          <Input
                            value={edit.description}
                            variant="inline"
                            className="h-7 px-1 text-xs"
                            disabled={cannotEdit}
                            onChange={(event) =>
                              updateRowEdit(row, {
                                description: event.target.value,
                              })
                            }
                            aria-label={`Description for ${row.costCode}`}
                          />
                          {row.alreadyInSov || hasWarnings ? (
                            <span className="block text-[11px] text-muted-foreground">
                              {row.alreadyInSov ? "Already in SOV" : null}
                              {hasWarnings ? "Review warning" : null}
                            </span>
                          ) : null}
                        </span>
                        <Select
                          value={edit.costTypeCode}
                          disabled={cannotEdit}
                          onValueChange={(value) =>
                            updateRowEdit(row, { costTypeCode: value })
                          }
                        >
                          <SelectTrigger
                            size="sm"
                            variant="inline"
                            className="h-7 px-1 text-xs"
                            aria-label={`Cost type for ${row.costCode}`}
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {costTypeOptions.map((option) => (
                              <SelectItem key={option.code} value={option.code}>
                                {option.code}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={edit.quantity}
                          variant="inline"
                          className="h-7 px-1 text-right text-xs tabular-nums"
                          disabled={cannotEdit}
                          onChange={(event) =>
                            updateRowEdit(row, { quantity: event.target.value })
                          }
                          aria-label={`Quantity for ${row.costCode}`}
                        />
                        <Input
                          value={edit.unitOfMeasure}
                          variant="inline"
                          className="h-7 px-1 text-xs uppercase"
                          disabled={cannotEdit}
                          onChange={(event) =>
                            updateRowEdit(row, {
                              unitOfMeasure: event.target.value,
                            })
                          }
                          aria-label={`Unit of measure for ${row.costCode}`}
                        />
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={edit.scheduledValue}
                          variant="inline"
                          className="h-7 px-1 text-right text-xs tabular-nums"
                          disabled={cannotEdit}
                          onChange={(event) =>
                            updateRowEdit(row, {
                              scheduledValue: event.target.value,
                            })
                          }
                          aria-label={`Scheduled value for ${row.costCode}`}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>

              {isConfirmingAppend ? (
                <InfoAlert variant="success">
                  <p className="font-medium">
                    Confirm append of {selectedPreviewRows.length} SOV line
                    {selectedPreviewRows.length === 1 ? "" : "s"} totaling{" "}
                    {formatCurrency(selectedScheduledValue)}.
                  </p>
                  <p className="text-muted-foreground">
                    These rows will be added as lines {nextLineNumber}
                    {selectedPreviewRows.length > 1
                      ? `-${nextLineNumber + selectedPreviewRows.length - 1}`
                      : ""}
                    . Existing SOV lines and budget rows are not overwritten.
                  </p>
                </InfoAlert>
              ) : null}
            </div>
          ) : null}
        </div>

        <ModalFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isImporting}
          >
            Cancel
          </Button>
          {!preview ? (
            <Button
              onClick={handlePreview}
              disabled={!file || isPreviewing || isImporting}
            >
              <Upload className="h-4 w-4" />
              {isPreviewing ? "Analyzing..." : "Preview Workbook"}
            </Button>
          ) : (
            <>
              {isConfirmingAppend ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsConfirmingAppend(false)}
                  disabled={isImporting}
                >
                  Back To Edit
                </Button>
              ) : null}
              <Button
                onClick={() => {
                  if (!isConfirmingAppend) {
                    setIsConfirmingAppend(true);
                    return;
                  }
                  void handleAppendToSov();
                }}
                disabled={selectedRows.size === 0 || isImporting}
              >
                {isImporting
                  ? "Adding..."
                  : isConfirmingAppend
                    ? `Confirm Add ${selectedRows.size}`
                    : `Review Add ${selectedRows.size}`}
              </Button>
            </>
          )}
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
