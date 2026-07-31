"use client";

import * as React from "react";
import { toast } from "sonner";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { cn } from "@/lib/utils";
import { FormSection } from "@/components/forms/FormSection";
import { MoneyField } from "@/components/forms/MoneyField";
import {
  ProjectCostCodeSelector,
  ProjectCostTypeSelector,
} from "@/components/budget/budget-code-field-selectors";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { InfoAlert } from "@/components/ds/InfoAlert";
import {
  Modal as Dialog,
  ModalContent as DialogContent,
  ModalDescription as DialogDescription,
  ModalFooter as DialogFooter,
  ModalHeader as DialogHeader,
  ModalTitle as DialogTitle,
} from "@/components/ui/unified-modal";
import { Input } from "@/components/ui/input";
import {
  InlineTable,
  InlineTableBody,
  InlineTableCell,
  InlineTableFooter,
  InlineTableFooterCell,
  InlineTableFooterRow,
  InlineTableHeader,
  InlineTableHeaderCell,
  InlineTableHeaderRow,
  InlineTableRow,
} from "@/components/ds/inline-table";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Download,
  FileSpreadsheet,
  GripVertical,
  Lock,
  Plus,
  Trash2,
  Upload,
  X,
} from "lucide-react";

import { ImportFromBudgetModal } from "@/components/domain/contracts/ImportFromBudgetModal";
import { apiFetch } from "@/lib/api-client";
import {
  resolveBudgetCodeByCodeAndCostType,
  resolvePrimeCoBudgetCode,
} from "@/lib/budget/budget-code-selection";
import type { EstimateWorkbookImportRow } from "@/lib/prime-contracts/estimate-workbook-sov";
import type { BudgetCode, ContractFormData, SOVLineItem } from "./types";

interface AvailableCostCode {
  id: string;
  title: string | null;
  status: string | null;
  division_title: string | null;
}

/**
 * A sortable SOV table row. Wraps `InlineTableRow` with dnd-kit's `useSortable`
 * so line items can be reordered by dragging. The row's cells are supplied via a
 * render prop so the drag `attributes`/`listeners` can be attached to a dedicated
 * grip handle (not the whole row) — keeping the inputs inside the row clickable.
 */
function SortableSovRow({
  id,
  type,
  className,
  children,
  ...rest
}: {
  id: string;
  type?: "default" | "group" | "markup";
  className?: string;
  children: (handle: {
    attributes: ReturnType<typeof useSortable>["attributes"];
    listeners: ReturnType<typeof useSortable>["listeners"];
  }) => React.ReactNode;
} & Omit<React.HTMLAttributes<HTMLTableRowElement>, "children">) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  return (
    <InlineTableRow
      ref={setNodeRef}
      type={type}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        isDragging && "relative z-10 bg-background opacity-80 shadow-sm",
        className,
      )}
      {...rest}
    >
      {children({ attributes, listeners })}
    </InlineTableRow>
  );
}

/** Grab handle shown at the start of a draggable SOV row. */
function SovDragHandle({
  attributes,
  listeners,
}: {
  attributes: ReturnType<typeof useSortable>["attributes"];
  listeners: ReturnType<typeof useSortable>["listeners"];
}) {
  return (
    <span
      {...attributes}
      {...listeners}
      className="inline-flex size-6 shrink-0 cursor-grab touch-none items-center justify-center rounded text-muted-foreground hover:bg-muted active:cursor-grabbing"
      aria-label="Drag to reorder line item"
    >
      <GripVertical className="h-3.5 w-3.5" />
    </span>
  );
}

export function PrimeContractSovSection({
  projectId,
  formData,
  budgetCodes,
  loadingBudgetCodes,
  showImportFromBudget,
  showImportEstimateWorkbook,
  sovColumnCount,
  isUnitQuantityMode,
  sovTotals,
  onShowImportFromBudgetChange,
  onShowImportEstimateWorkbookChange,
  onShowCreateBudgetCodeModal,
  onToggleSovAccountingMethod,
  onAddSovLine,
  onUpdateSovLine,
  onRemoveSovLine,
  onReorderSovLine,
  selectedSovItems,
  onToggleSovItemSelection,
  onToggleAllSovItems,
  onBulkRemoveSovLines,
  onHandleBudgetCodeSelect,
  onHandleImportFromBudgetSuccess,
  onHandleImportEstimateWorkbookSuccess,
  onBudgetCodesActivated,
}: {
  projectId: string;
  formData: Partial<ContractFormData>;
  budgetCodes: BudgetCode[];
  loadingBudgetCodes: boolean;
  showImportFromBudget: boolean;
  showImportEstimateWorkbook: boolean;
  sovColumnCount: number;
  isUnitQuantityMode: boolean;
  sovTotals: {
    amount: number;
    billedToDate: number;
    amountRemaining: number;
  };
  onShowImportFromBudgetChange: (open: boolean) => void;
  onShowImportEstimateWorkbookChange: (open: boolean) => void;
  onShowCreateBudgetCodeModal: () => void;
  onToggleSovAccountingMethod: () => void;
  onAddSovLine: () => void;
  onUpdateSovLine: (id: string, updates: Partial<SOVLineItem>) => void;
  onRemoveSovLine: (id: string) => void;
  onReorderSovLine: (activeId: string, overId: string) => void;
  selectedSovItems: Set<string>;
  onToggleSovItemSelection: (id: string) => void;
  onToggleAllSovItems: (checked: boolean) => void;
  onBulkRemoveSovLines: () => void;
  onHandleBudgetCodeSelect: (rowId: string, code: BudgetCode) => void;
  onHandleImportFromBudgetSuccess: (items: unknown[]) => void;
  onHandleImportEstimateWorkbookSuccess: (
    rows: EstimateWorkbookImportRow[],
  ) => void;
  onBudgetCodesActivated?: () => Promise<BudgetCode[]>;
}) {
  const sovSubtotal = (formData.sovItems || [])
    .filter((item) => !item.isMarkup && !item.isGroup)
    .reduce(
      (sum, item) =>
        sum +
        (isUnitQuantityMode
          ? (item.quantity ?? 0) * (item.unitCost ?? 0)
          : item.amount || 0),
      0,
    );
  const hasMarkupItems = (formData.sovItems || []).some(
    (item) => item.isMarkup,
  );
  const splitSovColumnCount = sovColumnCount + 1;

  const sortableIds = React.useMemo(
    () => (formData.sovItems || []).map((item) => item.id),
    [formData.sovItems],
  );

  const dndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleSovDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    onReorderSovLine(String(active.id), String(over.id));
  };

  return (
    <>
      <FormSection
        title="Schedule of Values"
        actions={
          <div className="flex items-center gap-6">
            <Button
              type="button"
              variant="link"
              size="xs"
              data-testid="sov-accounting-toggle"
              onClick={onToggleSovAccountingMethod}
              className="h-7 px-0 text-xs"
            >
              {isUnitQuantityMode ? "Use Amount" : "Use Quantity × Unit Cost"}
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => onShowImportEstimateWorkbookChange(true)}
            >
              Import from Estimate
            </Button>
          </div>
        }
      >
        <DndContext
          sensors={dndSensors}
          collisionDetection={closestCenter}
          modifiers={[restrictToVerticalAxis]}
          onDragEnd={handleSovDragEnd}
        >
        <InlineTable
          data-testid="sov-table"
          data-accounting-method={formData.accountingMethod}
          tableClassName="text-xs"
        >
          <InlineTableHeader>
            <InlineTableHeaderRow>
              <InlineTableHeaderCell className="w-16">
                {(() => {
                  const nonGroupItems = (formData.sovItems || []).filter(
                    (item) => !item.isGroup,
                  );
                  const allSelected =
                    nonGroupItems.length > 0 &&
                    nonGroupItems.every((item) =>
                      selectedSovItems.has(item.id),
                    );
                  const someSelected =
                    !allSelected && selectedSovItems.size > 0;
                  return (
                    <span className="inline-flex pl-7">
                      <Checkbox
                        checked={allSelected}
                        data-state={
                          someSelected ? "indeterminate" : undefined
                        }
                        disabled={nonGroupItems.length === 0}
                        onCheckedChange={(checked) =>
                          onToggleAllSovItems(checked === true)
                        }
                        aria-label="Select all line items"
                      />
                    </span>
                  );
                })()}
              </InlineTableHeaderCell>
              <InlineTableHeaderCell className="w-56 min-w-56">
                Cost Code
              </InlineTableHeaderCell>
              <InlineTableHeaderCell className="w-28 min-w-28">
                Cost Type
              </InlineTableHeaderCell>
              <InlineTableHeaderCell className="w-48 min-w-48">
                Description
              </InlineTableHeaderCell>
              {isUnitQuantityMode ? (
                <>
                  <InlineTableHeaderCell className="w-28">
                    Quantity
                  </InlineTableHeaderCell>
                  <InlineTableHeaderCell className="w-32">
                    Unit Cost
                  </InlineTableHeaderCell>
                </>
              ) : null}
              <InlineTableHeaderCell className="w-52 min-w-52">
                Amount
              </InlineTableHeaderCell>
              <InlineTableHeaderCell className="w-36 min-w-36">
                Billed to Date
              </InlineTableHeaderCell>
              <InlineTableHeaderCell className="w-44 min-w-44">
                Balance
              </InlineTableHeaderCell>
              <InlineTableHeaderCell className="w-10" />
            </InlineTableHeaderRow>
          </InlineTableHeader>
          <InlineTableBody>
            <SortableContext
              items={sortableIds}
              strategy={verticalListSortingStrategy}
            >
            {(formData.sovItems || []).length === 0 ? (
              <InlineTableRow>
                <InlineTableCell
                  colSpan={splitSovColumnCount}
                  className="py-8 text-center text-muted-foreground"
                >
                  <div className="flex flex-col items-center space-y-2">
                    <p className="text-sm text-muted-foreground">
                      No line items yet.
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Click &quot;Add Line Item&quot; to get started.
                    </p>
                  </div>
                </InlineTableCell>
              </InlineTableRow>
            ) : (
              formData.sovItems?.flatMap((item, index) => {
                const subtotalRow =
                  hasMarkupItems &&
                  item.isMarkup &&
                  (index === 0 || !formData.sovItems![index - 1].isMarkup) ? (
                    <InlineTableRow
                      key="__subtotal__"
                      className="border-t border-border bg-muted/20"
                    >
                      <InlineTableCell />
                      <InlineTableCell
                        colSpan={isUnitQuantityMode ? 5 : 3}
                        className="py-2"
                      >
                        <span className="text-xs font-medium text-muted-foreground">
                          Subtotal
                        </span>
                      </InlineTableCell>
                      <InlineTableCell className="py-2">
                        <span className="block h-8 text-right text-xs font-medium leading-8 tabular-nums">
                          $
                          {sovSubtotal.toLocaleString("en-US", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </span>
                      </InlineTableCell>
                      <InlineTableCell
                        align="right"
                        numeric
                        className="py-2 text-xs text-muted-foreground"
                      >
                        $0.00
                      </InlineTableCell>
                      <InlineTableCell
                        align="right"
                        numeric
                        className="py-2 text-xs"
                      >
                        $
                        {sovSubtotal.toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </InlineTableCell>
                      <InlineTableCell />
                    </InlineTableRow>
                  ) : null;

                const budgetCodeResolution = resolvePrimeCoBudgetCode(
                  item.budgetCodeId ?? item.budgetCodeLabel,
                  budgetCodes,
                );
                const selectedBudgetCode = budgetCodes.find(
                  (code) => code.id === budgetCodeResolution.selectorValue,
                );

                const itemRow = item.isGroup ? (
                  <SortableSovRow
                    key={item.id}
                    id={item.id}
                    type="group"
                    data-testid={`sov-group-${index}`}
                  >
                    {({ attributes, listeners }) => (
                      <>
                        <InlineTableCell>
                          <SovDragHandle
                            attributes={attributes}
                            listeners={listeners}
                          />
                        </InlineTableCell>
                        <InlineTableCell colSpan={splitSovColumnCount - 2}>
                          <Input
                            value={item.description}
                            onChange={(e) =>
                              onUpdateSovLine(item.id, {
                                description: e.target.value,
                              })
                            }
                            placeholder="Group name"
                            className="!h-8 !text-xs font-semibold"
                            data-testid="sov-group-name"
                          />
                        </InlineTableCell>
                        <InlineTableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            type="button"
                            onClick={() => onRemoveSovLine(item.id)}
                            className="h-8 w-8 shrink-0 p-0 text-muted-foreground hover:text-destructive"
                            aria-label="Remove group"
                            data-testid="sov-remove-group"
                          >
                            &times;
                          </Button>
                        </InlineTableCell>
                      </>
                    )}
                  </SortableSovRow>
                ) : item.isMarkup ? (
                  <SortableSovRow
                    key={item.id}
                    id={item.id}
                    type="markup"
                    data-testid={`sov-markup-${index}`}
                  >
                    {() => (
                      <>
                    <InlineTableCell>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span
                            tabIndex={0}
                            className="inline-flex size-7 items-center justify-center rounded-md bg-background/70 text-muted-foreground"
                            aria-label="Markup line item"
                          >
                            <Lock className="h-3.5 w-3.5" />
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          Edit in Financial Markup above.
                        </TooltipContent>
                      </Tooltip>
                    </InlineTableCell>
                    <InlineTableCell>
                      {selectedBudgetCode ? (
                        <span className="text-xs font-medium text-muted-foreground">
                          {selectedBudgetCode.code}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                          <span className="rounded bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary">
                            Markup
                          </span>
                        </span>
                      )}
                    </InlineTableCell>
                    <InlineTableCell>
                      <span className="text-xs text-muted-foreground">
                        {selectedBudgetCode?.costType || ""}
                      </span>
                    </InlineTableCell>
                    <InlineTableCell>
                      <span className="text-xs text-muted-foreground">
                        {item.description}
                      </span>
                    </InlineTableCell>
                    {isUnitQuantityMode ? (
                      <>
                        <InlineTableCell />
                        <InlineTableCell />
                      </>
                    ) : null}
                    <InlineTableCell>
                      <span className="block h-8 text-right text-xs leading-8 text-muted-foreground tabular-nums">
                        $
                        {(item.amount || 0).toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </span>
                    </InlineTableCell>
                    <InlineTableCell align="right" numeric>
                      $0.00
                    </InlineTableCell>
                    <InlineTableCell align="right" numeric>
                      $
                      {(item.amount || 0).toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </InlineTableCell>
                    <InlineTableCell />
                      </>
                    )}
                  </SortableSovRow>
                ) : (
                  <SortableSovRow
                    key={item.id}
                    id={item.id}
                    data-testid={`sov-line-${index}`}
                  >
                    {({ attributes, listeners }) => (
                      <>
                    <InlineTableCell>
                      <div className="flex items-center gap-1">
                        <SovDragHandle
                          attributes={attributes}
                          listeners={listeners}
                        />
                        <Checkbox
                          checked={selectedSovItems.has(item.id)}
                          onCheckedChange={() =>
                            onToggleSovItemSelection(item.id)
                          }
                          aria-label="Select line item"
                        />
                      </div>
                    </InlineTableCell>
                    <InlineTableCell>
                      <ProjectCostCodeSelector
                        value={budgetCodeResolution.selectorValue}
                        onValueChange={(code) =>
                          onHandleBudgetCodeSelect(item.id, code)
                        }
                        onCreateNew={onShowCreateBudgetCodeModal}
                        budgetCodes={budgetCodes}
                        loading={loadingBudgetCodes}
                        placeholder={
                          budgetCodeResolution.isMapped || !item.budgetCodeId
                            ? "Select cost code..."
                            : budgetCodeResolution.displayCode
                        }
                        ariaLabel={`Cost Code for SOV line ${index + 1}`}
                        error={
                          Boolean(item.budgetCodeId) &&
                          !budgetCodeResolution.isMapped
                        }
                        className="h-8 px-3 !text-xs"
                      />
                    </InlineTableCell>
                    <InlineTableCell>
                      <ProjectCostTypeSelector
                        value={budgetCodeResolution.selectorValue}
                        onValueChange={(code) =>
                          onHandleBudgetCodeSelect(item.id, code)
                        }
                        budgetCodes={budgetCodes}
                        loading={loadingBudgetCodes}
                        ariaLabel={`Cost Type for SOV line ${index + 1}`}
                        error={
                          Boolean(item.budgetCodeId) &&
                          !budgetCodeResolution.isMapped
                        }
                        className="h-8 !text-xs"
                      />
                    </InlineTableCell>
                    <InlineTableCell>
                      <Input
                        value={item.description}
                        onChange={(e) =>
                          onUpdateSovLine(item.id, {
                            description: e.target.value,
                          })
                        }
                        placeholder="Description"
                        className="!h-8 px-3 !text-xs"
                        data-testid="sov-line-description"
                      />
                    </InlineTableCell>
                    {isUnitQuantityMode ? (
                      <>
                        <InlineTableCell>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={String(item.quantity ?? 0)}
                            onChange={(e) =>
                              onUpdateSovLine(item.id, {
                                quantity: Number(e.target.value || 0),
                              })
                            }
                            className="!h-8 px-3 !text-xs"
                            data-testid="sov-line-quantity"
                          />
                        </InlineTableCell>
                        <InlineTableCell>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={String(item.unitCost ?? 0)}
                            onChange={(e) =>
                              onUpdateSovLine(item.id, {
                                unitCost: Number(e.target.value || 0),
                              })
                            }
                            className="!h-8 px-3 !text-xs"
                            data-testid="sov-line-unit-cost"
                          />
                        </InlineTableCell>
                      </>
                    ) : null}
                    <InlineTableCell>
                      <MoneyField
                        inline
                        label="Amount"
                        value={item.amount || undefined}
                        onChange={(val) =>
                          onUpdateSovLine(item.id, { amount: val ?? 0 })
                        }
                        showCurrency={false}
                        className="!h-8 pl-6 pr-2 !text-xs"
                        data-testid="sov-line-amount"
                        readOnly={formData.accountingMethod === "unit_quantity"}
                      />
                    </InlineTableCell>
                    <InlineTableCell align="right" numeric>
                      $
                      {(item.billedToDate || 0).toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </InlineTableCell>
                    <InlineTableCell
                      align="right"
                      numeric
                      data-testid="sov-line-amount-remaining"
                    >
                      $
                      {(
                        (item.amount || 0) - (item.billedToDate || 0)
                      ).toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </InlineTableCell>
                    <InlineTableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        type="button"
                        onClick={() => onRemoveSovLine(item.id)}
                        className="h-8 w-8 shrink-0 p-0 text-muted-foreground hover:text-destructive"
                        aria-label="Remove line item"
                        data-testid="sov-remove-line"
                      >
                        &times;
                      </Button>
                    </InlineTableCell>
                      </>
                    )}
                  </SortableSovRow>
                );

                return [subtotalRow, itemRow].filter(
                  (r): r is React.ReactElement => r !== null,
                );
              })
            )}
            </SortableContext>
          </InlineTableBody>
          <InlineTableFooter>
            <InlineTableFooterRow type="action">
              <InlineTableFooterCell
                colSpan={splitSovColumnCount - 1}
                className="font-normal"
              >
                <Button
                  type="button"
                  variant="link"
                  className="h-auto p-0 text-sm font-medium"
                  onClick={onAddSovLine}
                  data-testid={
                    (formData.sovItems || []).length === 0
                      ? "sov-add-line-empty"
                      : "sov-add-line-footer"
                  }
                >
                  Add Line Item
                </Button>
                {selectedSovItems.size > 0 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={onBulkRemoveSovLines}
                    className="ml-4 h-auto p-0 text-sm font-medium text-destructive hover:text-destructive"
                    data-testid="sov-bulk-delete"
                  >
                    <Trash2 className="mr-1 h-3.5 w-3.5" />
                    Delete {selectedSovItems.size} selected
                  </Button>
                ) : null}
              </InlineTableFooterCell>
              <InlineTableFooterCell />
            </InlineTableFooterRow>
            {(formData.sovItems || []).length > 0 ? (
              <InlineTableFooterRow type="totals">
                <InlineTableFooterCell
                  colSpan={isUnitQuantityMode ? 6 : 4}
                >
                  Totals
                </InlineTableFooterCell>
                <InlineTableFooterCell
                  align="right"
                  numeric
                  data-testid="sov-total-amount"
                >
                  $
                  {sovTotals.amount.toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </InlineTableFooterCell>
                <InlineTableFooterCell
                  align="right"
                  numeric
                  data-testid="sov-total-billed"
                >
                  $
                  {sovTotals.billedToDate.toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </InlineTableFooterCell>
                <InlineTableFooterCell
                  align="right"
                  numeric
                  data-testid="sov-total-remaining"
                >
                  $
                  {sovTotals.amountRemaining.toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </InlineTableFooterCell>
                <InlineTableFooterCell />
              </InlineTableFooterRow>
            ) : null}
          </InlineTableFooter>
        </InlineTable>
        </DndContext>
      </FormSection>

      <ImportFromBudgetModal
        open={showImportFromBudget}
        onOpenChange={onShowImportFromBudgetChange}
        projectId={projectId}
        existingCostCodeIds={
          new Set(
            (formData.sovItems || [])
              .map((item) => item.budgetCodeId)
              .filter((id): id is string => !!id),
          )
        }
        onImportSuccess={(items) =>
          onHandleImportFromBudgetSuccess(items as unknown[])
        }
      />

      <EstimateWorkbookImportModal
        open={showImportEstimateWorkbook}
        onOpenChange={onShowImportEstimateWorkbookChange}
        projectId={projectId}
        budgetCodes={budgetCodes}
        existingSovItems={formData.sovItems || []}
        onImportRows={onHandleImportEstimateWorkbookSuccess}
        onBudgetCodesActivated={onBudgetCodesActivated}
      />
    </>
  );
}

function resolveEstimateBudgetCode(
  row: EstimateWorkbookImportRow,
  budgetCodes: BudgetCode[],
): BudgetCode | undefined {
  return resolveBudgetCodeByCodeAndCostType(
    row.costCode,
    row.costTypeCode,
    budgetCodes,
  );
}

function getEstimateRowKey(row: EstimateWorkbookImportRow): string {
  return `${row.sourceSheet}:${row.rowNumber}`;
}

function formatEstimateDescription(row: EstimateWorkbookImportRow): string {
  return row.workDescription
    ? `${row.description} - ${row.workDescription}`
    : row.description;
}

function EstimateWorkbookImportModal({
  open,
  onOpenChange,
  projectId,
  budgetCodes,
  existingSovItems,
  onImportRows,
  onBudgetCodesActivated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  budgetCodes: BudgetCode[];
  existingSovItems: SOVLineItem[];
  onImportRows: (rows: EstimateWorkbookImportRow[]) => void;
  onBudgetCodesActivated?: () => Promise<BudgetCode[]>;
}) {
  const [file, setFile] = React.useState<File | null>(null);
  const [rows, setRows] = React.useState<EstimateWorkbookImportRow[]>([]);
  const [selectedRows, setSelectedRows] = React.useState<Set<string>>(
    new Set(),
  );
  const [resolvedBudgetCodes, setResolvedBudgetCodes] =
    React.useState<BudgetCode[]>(budgetCodes);
  const [warnings, setWarnings] = React.useState<string[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [isParsing, setIsParsing] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    setResolvedBudgetCodes(budgetCodes);
  }, [budgetCodes]);

  React.useEffect(() => {
    if (!open) {
      setFile(null);
      setRows([]);
      setSelectedRows(new Set());
      setResolvedBudgetCodes(budgetCodes);
      setWarnings([]);
      setError(null);
      setIsParsing(false);
    }
  }, [budgetCodes, open]);

  const existingBudgetCodeIds = React.useMemo(
    () =>
      new Set(
        existingSovItems
          .map((item) => item.budgetCodeId)
          .filter((id): id is string => Boolean(id)),
      ),
    [existingSovItems],
  );

  const selectableRows = React.useMemo(
    () =>
      rows.filter((row) => {
        const budgetCode = resolveEstimateBudgetCode(row, resolvedBudgetCodes);
        return (
          row.includeInOwnerSov &&
          row.warnings.length === 0 &&
          !existingBudgetCodeIds.has(budgetCode?.id ?? "")
        );
      }),
    [existingBudgetCodeIds, resolvedBudgetCodes, rows],
  );

  const selectedImportRows = React.useMemo(
    () => rows.filter((row) => selectedRows.has(getEstimateRowKey(row))),
    [rows, selectedRows],
  );

  const totalSelected = selectedImportRows.reduce(
    (sum, row) => sum + row.budgetAmount,
    0,
  );

  const handleFileSelect = async (selectedFile: File) => {
    const isExcel =
      selectedFile.name.endsWith(".xlsx") ||
      selectedFile.name.endsWith(".xlsm");
    if (!isExcel) {
      setError("Upload an Alleato estimate workbook as .xlsx or .xlsm.");
      setFile(null);
      return;
    }

    setFile(selectedFile);
    setRows([]);
    setSelectedRows(new Set());
    setWarnings([]);
    setError(null);
    setIsParsing(true);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      const preview = await apiFetch<{
        rows: EstimateWorkbookImportRow[];
        warnings: string[];
        missingBudgetCodeMappingCount?: number;
      }>(`/api/projects/${projectId}/contracts/estimate-import/preview`, {
        method: "POST",
        body: formData,
      });
      const ownerRows = preview.rows.filter((row) => row.includeInOwnerSov);

      // Auto-activate budget codes that are not yet mapped to this project.
      // The activate endpoint rejects cost codes that don't exist in the system —
      // those rows will stay as "Needs budget code" in the preview table.
      const rowsMissingCodes = ownerRows.filter(
        (row) =>
          row.warnings.length === 0 &&
          !(row as { hasBudgetCodeMapping?: boolean }).hasBudgetCodeMapping,
      );
      let nextBudgetCodes = resolvedBudgetCodes;
      if (rowsMissingCodes.length > 0 && onBudgetCodesActivated) {
        try {
          await apiFetch(`/api/projects/${projectId}/budget-codes/activate`, {
            method: "POST",
            body: JSON.stringify({
              rows: rowsMissingCodes.map((row) => ({
                costCode: row.costCode,
                costTypeCode: row.costTypeCode,
                description: row.description,
              })),
            }),
          });
          // Refresh parent's budget codes so mapping in handleImportEstimateWorkbookSuccess succeeds
          nextBudgetCodes = await onBudgetCodesActivated();
          setResolvedBudgetCodes(nextBudgetCodes);
        } catch (activateError) {
          // Surface the error (e.g. unknown cost code typo in template) as a warning
          // but still show the preview so the user can see which rows are affected
          const msg =
            activateError instanceof Error
              ? activateError.message
              : "Some rows reference cost codes that don't exist in the system.";
          toast.error(msg);
          setWarnings((prev) => [msg, ...prev]);
        }
      }

      setRows(ownerRows);
      setWarnings((prev) => [...prev, ...preview.warnings]);
      setSelectedRows(
        new Set(
          ownerRows
            .filter((row) => {
              const budgetCode = resolveEstimateBudgetCode(
                row,
                nextBudgetCodes,
              );
              return row.warnings.length === 0 && Boolean(budgetCode);
            })
            .map((row) => getEstimateRowKey(row)),
        ),
      );
    } catch (parseError) {
      const message =
        parseError instanceof Error
          ? parseError.message
          : "Failed to parse estimate workbook.";
      setError(message);
      toast.error(message);
    } finally {
      setIsParsing(false);
    }
  };

  const toggleRow = (row: EstimateWorkbookImportRow, checked: boolean) => {
    const key = getEstimateRowKey(row);
    setSelectedRows((current) => {
      const next = new Set(current);
      if (checked) next.add(key);
      else next.delete(key);
      return next;
    });
  };

  const toggleAll = (checked: boolean) => {
    setSelectedRows(
      checked
        ? new Set(selectableRows.map((row) => getEstimateRowKey(row)))
        : new Set(),
    );
  };

  const handleImport = () => {
    if (selectedImportRows.length === 0) {
      toast.error("Select at least one estimate row to import.");
      return;
    }
    onImportRows(selectedImportRows);
    onOpenChange(false);
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(value);

  return (
    <Dialog open={open} onOpenChange={isParsing ? undefined : onOpenChange}>
      <DialogContent className="flex max-h-screen flex-col sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Import Excel SOV</DialogTitle>
          <DialogDescription>
            Download the template, fill in the estimate rows, then import
            selected rows into this new prime contract.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 space-y-4 overflow-hidden">
          <InfoAlert variant="info">
            <p className="font-semibold">
              Nothing is saved until the prime contract is created.
            </p>
            <p className="text-muted-foreground">
              Imported rows stay in this form so you can review budget-code
              mappings before submitting.
            </p>
          </InfoAlert>

          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" asChild>
              <a
                href={`/api/projects/${projectId}/contracts/estimate-sov-template`}
              >
                <Download className="h-4 w-4" />
                Download template
              </a>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
            >
              <FileSpreadsheet className="h-4 w-4" />
              Choose workbook
            </Button>
            {file ? (
              <div className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                <span className="truncate">{file.name}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => {
                    setFile(null);
                    setRows([]);
                    setSelectedRows(new Set());
                    setWarnings([]);
                    setError(null);
                  }}
                  aria-label="Remove workbook"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : null}
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xlsm,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
              className="hidden"
              onChange={(event) => {
                const selectedFile = event.target.files?.[0];
                if (selectedFile) void handleFileSelect(selectedFile);
                event.currentTarget.value = "";
              }}
            />
          </div>

          {error ? <InfoAlert variant="error">{error}</InfoAlert> : null}

          {warnings.length > 0 ? (
            <InfoAlert variant="warning">
              <p className="font-medium">
                {warnings.length} workbook warning
                {warnings.length === 1 ? "" : "s"}
              </p>
              <ul className="mt-1 max-h-20 space-y-0.5 overflow-y-auto text-xs">
                {warnings.slice(0, 5).map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
                {warnings.length > 5 ? (
                  <li className="italic">+{warnings.length - 5} more</li>
                ) : null}
              </ul>
            </InfoAlert>
          ) : null}

          <div className="min-h-64 overflow-hidden rounded-md border">
            {rows.length === 0 ? (
              <div className="flex min-h-64 items-center justify-center text-sm text-muted-foreground">
                {isParsing
                  ? "Reading workbook..."
                  : "Choose a completed template to preview SOV rows."}
              </div>
            ) : (
              <div className="max-h-96 overflow-auto">
                <table className="w-full">
                  <thead className="sticky top-0 border-b bg-muted/40">
                    <tr>
                      <th className="w-10 px-3 py-2 text-left">
                        <Checkbox
                          checked={
                            selectableRows.length > 0 &&
                            selectableRows.every((row) =>
                              selectedRows.has(getEstimateRowKey(row)),
                            )
                          }
                          disabled={selectableRows.length === 0}
                          onCheckedChange={(checked) =>
                            toggleAll(checked === true)
                          }
                        />
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                        Code
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                        Description
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                        Type
                      </th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">
                        Amount
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {rows.map((row) => {
                      const key = getEstimateRowKey(row);
                      const budgetCode = resolveEstimateBudgetCode(
                        row,
                        resolvedBudgetCodes,
                      );
                      const alreadyInForm = existingBudgetCodeIds.has(
                        budgetCode?.id ?? "",
                      );
                      const hasWarnings = row.warnings.length > 0;
                      const isSelectable =
                        row.includeInOwnerSov && !alreadyInForm && !hasWarnings;
                      return (
                        <tr
                          key={key}
                          className={
                            isSelectable
                              ? "hover:bg-muted/40"
                              : "bg-muted/20 text-muted-foreground"
                          }
                        >
                          <td className="px-3 py-2">
                            <Checkbox
                              checked={selectedRows.has(key)}
                              disabled={!isSelectable}
                              onCheckedChange={(checked) =>
                                toggleRow(row, checked === true)
                              }
                            />
                          </td>
                          <td className="px-3 py-2 text-sm font-medium">
                            {row.costCode}
                          </td>
                          <td className="px-3 py-2 text-sm">
                            {formatEstimateDescription(row)}
                          </td>
                          <td className="px-3 py-2 text-sm">
                            {row.costTypeCode || row.costType}
                          </td>
                          <td className="px-3 py-2 text-right text-sm tabular-nums">
                            {formatCurrency(row.budgetAmount)}
                          </td>
                          <td className="px-3 py-2 text-xs text-muted-foreground">
                            {alreadyInForm
                              ? "Already in form"
                              : hasWarnings
                                ? "Review warning"
                                : budgetCode
                                  ? "Mapped"
                                  : "Needs budget code"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <div className="mr-auto text-sm text-muted-foreground">
            {selectedRows.size > 0
              ? `${selectedRows.size} selected, ${formatCurrency(totalSelected)}`
              : null}
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isParsing}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleImport}
            disabled={selectedRows.size === 0 || isParsing}
          >
            <Upload className="h-4 w-4" />
            Import {selectedRows.size > 0 ? selectedRows.size : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function PrimeContractCreateBudgetCodeModal({
  open,
  loadingCostCodes,
  groupedCostCodes,
  expandedDivisions,
  availableCostCodes,
  newBudgetCodeData,
  isCreating,
  getCostTypeLabel,
  onOpenChange,
  onToggleDivision,
  onNewBudgetCodeDataChange,
  onCreate,
}: {
  open: boolean;
  loadingCostCodes: boolean;
  groupedCostCodes: Record<string, AvailableCostCode[]>;
  expandedDivisions: Set<string>;
  availableCostCodes: AvailableCostCode[];
  newBudgetCodeData: {
    costCodeId: string;
    costType: string;
  };
  isCreating: boolean;
  getCostTypeLabel: (type: string) => string;
  onOpenChange: (open: boolean) => void;
  onToggleDivision: (division: string) => void;
  onNewBudgetCodeDataChange: (next: {
    costCodeId: string;
    costType: string;
  }) => void;
  onCreate: () => void;
}) {
  const selectedCostCode = availableCostCodes.find(
    (cc) => cc.id === newBudgetCodeData.costCodeId,
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create New Budget Code</DialogTitle>
          <DialogDescription>
            Add a new budget code that can be used for line items in this
            project.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="costCode">Cost Code*</Label>
            {loadingCostCodes ? (
              <div className="rounded-md border p-4 text-sm text-muted-foreground">
                Loading cost codes...
              </div>
            ) : (
              <div className="max-h-96 overflow-y-auto rounded-md border">
                {Object.entries(groupedCostCodes)
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([division]) => (
                    <div key={division} className="border-b last:border-b-0">
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => onToggleDivision(division)}
                        className="h-auto w-full justify-between px-4 py-2 text-left font-normal"
                      >
                        <span className="text-sm font-semibold text-foreground">
                          {division}
                        </span>
                        {expandedDivisions.has(division) ? (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        )}
                      </Button>

                      {expandedDivisions.has(division) ? (
                        <div className="bg-muted">
                          {groupedCostCodes[division].map((costCode) => (
                            <Button
                              key={costCode.id}
                              type="button"
                              variant="ghost"
                              onClick={() =>
                                onNewBudgetCodeDataChange({
                                  ...newBudgetCodeData,
                                  costCodeId: costCode.id,
                                })
                              }
                              className={`h-auto w-full justify-start px-6 py-2 text-left text-sm font-normal ${
                                newBudgetCodeData.costCodeId === costCode.id
                                  ? "bg-primary/10 font-medium text-primary"
                                  : "text-foreground"
                              }`}
                            >
                              {costCode.id} - {costCode.title}
                            </Button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ))}
              </div>
            )}
            <p className="text-sm text-muted-foreground">
              Click on a division to expand and select a cost code
            </p>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="costType">Cost Type*</Label>
            <Select
              value={newBudgetCodeData.costType || undefined}
              onValueChange={(value) =>
                onNewBudgetCodeDataChange({
                  ...newBudgetCodeData,
                  costType: value,
                })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select cost type..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="R">R - Contract Revenue</SelectItem>
                <SelectItem value="E">E - Equipment</SelectItem>
                <SelectItem value="X">X - Expense</SelectItem>
                <SelectItem value="L">L - Labor</SelectItem>
                <SelectItem value="M">M - Material</SelectItem>
                <SelectItem value="S">S - Subcontract</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="rounded-md bg-muted p-4">
            <p className="text-sm font-medium text-foreground">Preview:</p>
            <p className="mt-1 text-sm text-foreground">
              {selectedCostCode ? (
                <>
                  {selectedCostCode.id}.{newBudgetCodeData.costType} -{" "}
                  {selectedCostCode.title} -{" "}
                  {getCostTypeLabel(newBudgetCodeData.costType)}
                </>
              ) : (
                "Select cost code and cost type to see preview"
              )}
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={onCreate}
            disabled={
              isCreating ||
              !newBudgetCodeData.costCodeId ||
              !newBudgetCodeData.costType
            }
          >
            {isCreating ? "Creating..." : "Create Budget Code"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
