"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import {
  ColumnDef,
  ColumnSizingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  useReactTable,
  getExpandedRowModel,
  ExpandedState,
  RowSelectionState,
} from "@tanstack/react-table";
import { ChevronRight, ChevronDown, X, Check, MoreVertical, Pencil, Trash2, Columns3 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BudgetLineItem, BudgetGrandTotals } from "@/types/budget";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import { Button } from "@/components/ui/button";
import { CellCommentIndicator } from "@/components/comments/cell-comment-indicator";

type ColumnTooltip = {
  title: string;
  type?: "Source Column" | "Calculated Column" | "Standard Column";
  formula: string;
  details?: readonly string[];
  sectionTitle?: string;
  sections?: ReadonlyArray<{
    label: string;
    items: readonly string[];
  }>;
};

const columnTooltips: Record<string, ColumnTooltip> = {
  originalBudgetAmount: {
    title: "Original Budget Amount",
    formula: "Original Budget Amount entered for this line item",
  },
  budgetModifications: {
    title: "Budget Changes",
    formula: "Sum of all approved budget changes to/from this line item",
  },
  approvedCOs: {
    title: "Approved COs",
    type: "Source Column",
    formula: "Approved COs (Prime Contract)",
    details: ["Change Orders", "Status: Approved"],
  },
  revisedBudget: {
    title: "Revised Budget",
    type: "Calculated Column",
    formula:
      "Original Budget Amount + Budget Changes + Approved COs = Revised Budget",
  },
  jobToDateCostDetail: {
    title: "Job to Date Cost Detail",
    type: "Source Column",
    formula: "Job to Date Cost Detail (Direct Costs)",
    details: [
      "Direct Costs",
      "Type: Invoice, Expense, Payroll, Subcontractor Invoice",
      "Status: Approved",
    ],
  },
  directCosts: {
    title: "Direct Costs",
    type: "Source Column",
    formula: "Direct Costs (Direct Costs)",
    sectionTitle: "Direct Costs",
    sections: [
      {
        label: "Type",
        items: ["Payroll", "Expense", "Invoice"],
      },
      {
        label: "Status",
        items: ["Approved", "Pending", "Revise and Resubmit"],
      },
    ],
  },
  pendingChanges: {
    title: "Pending Budget Changes",
    type: "Source Column",
    formula: "Pending Budget Changes (Prime Contract)",
    details: [
      "Change Orders",
      "Status: Pending - In Review; Pending - Not Pricing; Pending - Not Proceeding; Pending - Pricing; Pending - Proceeding; Pending - Revised",
    ],
  },
  projectedBudget: {
    title: "Projected Budget",
    type: "Calculated Column",
    formula: "Revised Budget + Pending Budget Changes = Projected Budget",
  },
  committedCosts: {
    title: "Committed Costs",
    type: "Source Column",
    formula: "Committed Costs (Commitment)",
    details: [
      "Subcontracts — Status: Approved, Complete",
      "Purchase Order Contracts — Status: Approved",
      "Change Orders — Status: Approved",
    ],
  },
  pendingCostChanges: {
    title: "Pending Cost Changes",
    type: "Source Column",
    formula: "Pending Cost Changes (Commitment)",
    details: [
      "Subcontracts — Status: Out For Signature",
      "Purchase Order Contracts — Status: Processing, Submitted, Partially Received, Received",
      "Change Orders — Status: Pending - In Review; Pending - Not Pricing; Pending - Not Proceeding; Pending - Pricing; Pending - Proceeding; Pending - Revised",
    ],
  },
  projectedCosts: {
    title: "Projected Costs",
    type: "Calculated Column",
    formula:
      "Committed Costs + Direct Costs + Pending Cost Changes = Projected Costs",
  },
  forecastToComplete: {
    title: "Forecast To Complete",
    type: "Standard Column",
    formula: "Projected Budget - Projected Costs = Forecast To Complete",
    details: ["If negative, column will show 0."],
  },
  estimatedCostAtCompletion: {
    title: "Estimated Cost at Completion",
    type: "Calculated Column",
    formula:
      "Projected Costs + Forecast To Complete = Estimated Cost at Completion",
  },
  projectedOverUnder: {
    title: "Projected over Under",
    type: "Calculated Column",
    formula:
      "Projected Budget - Estimated Cost at Completion = Projected over Under",
  },
};

type ColumnTooltipKey = keyof typeof columnTooltips;

interface ColumnHeaderProps {
  lines: string[];
  columnKey?: ColumnTooltipKey;
  align?: "left" | "right";
}

function TruncatedHeaderLabel({
  text,
  align = "left",
}: {
  text: string;
  align?: "left" | "right";
}) {
  const labelRef = React.useRef<HTMLDivElement>(null);
  const [isTruncated, setIsTruncated] = React.useState(false);

  React.useEffect(() => {
    const node = labelRef.current;
    if (!node) {
      return;
    }

    const checkTruncation = () => {
      setIsTruncated(node.scrollWidth > node.clientWidth);
    };

    checkTruncation();

    if (typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver(checkTruncation);
    observer.observe(node);

    return () => {
      observer.disconnect();
    };
  }, [text]);

  const label = (
    <div
      ref={labelRef}
      className={cn(
        "block w-full truncate whitespace-nowrap text-xs leading-tight",
        align === "right" ? "text-right" : "text-left",
      )}
    >
      {text}
    </div>
  );

  if (!isTruncated) {
    return label;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="cursor-help">{label}</div>
      </TooltipTrigger>
      <TooltipContent side="bottom" align="center" className="max-w-xs text-xs">
        {text}
      </TooltipContent>
    </Tooltip>
  );
}

function ColumnHeader({
  lines,
  columnKey,
  align = "left",
}: ColumnHeaderProps) {
  const labelText = lines.join(" ");

  const label = <TruncatedHeaderLabel text={labelText} align={align} />;

  if (!columnKey) {
    return label;
  }

  const tooltip = columnTooltips[columnKey];
  if (!tooltip) {
    return label;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={cn(
            "block w-full cursor-help whitespace-nowrap text-xs leading-tight text-foreground transition-colors hover:text-foreground",
            align === "right" ? "text-right" : "text-left",
          )}
        >
          {labelText}
        </div>
      </TooltipTrigger>
      <TooltipContent
        side="bottom"
        align="center"
        className="max-w-xs space-y-1.5 text-left text-xs leading-relaxed"
      >
        <p className="font-medium">{tooltip.formula}</p>
        {tooltip.type && <p className="opacity-70">{tooltip.type}</p>}
        {(tooltip.sectionTitle || tooltip.sections?.length) && <div className="h-px w-full bg-background/20" />}
        {tooltip.sectionTitle ? (
          <p className="font-medium">{tooltip.sectionTitle}</p>
        ) : null}
        {tooltip.sections?.length ? (
          <div className="space-y-1.5">
            {tooltip.sections.map((section) => (
              <div key={section.label}>
                <p className="font-medium">{section.label}</p>
                <ul className="list-disc space-y-0.5 pl-4 opacity-80">
                  {section.items.map((item) => (
                    <li key={`${section.label}-${item}`}>{item}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        ) : null}
        {tooltip.details?.length ? (
          <ul className="list-disc space-y-0.5 pl-4 opacity-80">
            {tooltip.details.map((detail) => (
              <li key={detail}>{detail}</li>
            ))}
          </ul>
        ) : null}
      </TooltipContent>
    </Tooltip>
  );
}

interface BudgetTableProps {
  data: BudgetLineItem[];
  grandTotals: BudgetGrandTotals;
  isLocked?: boolean;
  onEditLineItem?: (lineItem: BudgetLineItem) => void;
  onDeleteLineItem?: (lineItem: BudgetLineItem) => void;
  onSelectionChange?: (selectedIds: string[]) => void;
  onBudgetModificationsClick?: (lineItem: BudgetLineItem) => void;
  onApprovedCOsClick?: (lineItem: BudgetLineItem) => void;
  onJobToDateCostDetailClick?: (lineItem: BudgetLineItem) => void;
  onDirectCostsClick?: (lineItem: BudgetLineItem) => void;
  onPendingChangesClick?: (lineItem: BudgetLineItem) => void;
  onCommittedCostsClick?: (lineItem: BudgetLineItem) => void;
  onPendingCostChangesClick?: (lineItem: BudgetLineItem) => void;
  onForecastToCompleteClick?: (lineItem: BudgetLineItem) => void;
  onCreateLineItem?: (data: {
    costCode?: string;
    description: string;
    originalBudgetAmount: string | number;
  }) => Promise<void>;
  projectId?: string;
  columnControlsPortalId?: string;
  showInlineCreate?: boolean;
  onShowInlineCreateChange?: (show: boolean) => void;
  /** When provided, applies this visibility state to the table (e.g. from a saved view) */
  columnVisibilityOverride?: VisibilityState;
}

function formatCurrency(value: number): string {
  if (value === 0) return "$0.00";

  const isNegative = value < 0;
  const formatted = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(value));

  if (isNegative) {
    return `($${formatted})`;
  }
  return `$${formatted}`;
}

function CurrencyCell({ value }: { value: number }) {
  const isNegative = value < 0;
  return (
    <span className={cn("tabular-nums", isNegative && "text-destructive")}>
      {formatCurrency(value)}
    </span>
  );
}

type FormulaLine = {
  label: string;
  value: number;
  operator?: "+" | "-";
};

function FormulaTooltip({
  title,
  formula,
  lines,
  resultLabel,
  resultValue,
}: {
  title: string;
  formula: string;
  lines: FormulaLine[];
  resultLabel: string;
  resultValue: number;
}) {
  return (
    <div className="w-72 space-y-2 text-xs">
      <div>
        <p className="font-medium text-foreground">{title}</p>
        <p className="text-muted-foreground">{formula}</p>
      </div>
      <div className="space-y-1">
        {lines.map((line, index) => (
          <div key={line.label} className="flex items-center justify-between gap-3">
            <span className="min-w-0 truncate text-muted-foreground">
              {index > 0 && line.operator ? `${line.operator} ` : ""}
              {line.label}
            </span>
            <span className="shrink-0 tabular-nums text-foreground">
              {formatCurrency(line.value)}
            </span>
          </div>
        ))}
      </div>
      <div className="border-t border-border/70 pt-1.5">
        <div className="flex items-center justify-between gap-3 font-medium">
          <span>{resultLabel}</span>
          <span className="tabular-nums">{formatCurrency(resultValue)}</span>
        </div>
      </div>
    </div>
  );
}

function getCalculatedColumnTooltip(
  columnId: keyof Pick<
    BudgetLineItem,
    | "revisedBudget"
    | "projectedBudget"
    | "projectedCosts"
    | "forecastToComplete"
    | "estimatedCostAtCompletion"
    | "projectedOverUnder"
  >,
  lineItem: BudgetLineItem,
) {
  switch (columnId) {
    case "revisedBudget":
      return (
        <FormulaTooltip
          title="Revised Budget"
          formula="Original Budget + Budget Changes + Approved COs"
          lines={[
            { label: "Original Budget", value: lineItem.originalBudgetAmount },
            {
              label: "Budget Changes",
              value: lineItem.budgetModifications,
              operator: "+",
            },
            { label: "Approved COs", value: lineItem.approvedCOs, operator: "+" },
          ]}
          resultLabel="Revised Budget"
          resultValue={lineItem.revisedBudget}
        />
      );
    case "projectedBudget":
      return (
        <FormulaTooltip
          title="Projected Budget"
          formula="Revised Budget + Pending COs"
          lines={[
            { label: "Revised Budget", value: lineItem.revisedBudget },
            { label: "Pending COs", value: lineItem.pendingChanges, operator: "+" },
          ]}
          resultLabel="Projected Budget"
          resultValue={lineItem.projectedBudget}
        />
      );
    case "projectedCosts":
      return (
        <FormulaTooltip
          title="Projected Costs"
          formula="Committed Costs + Direct Costs + Pending Cost Changes"
          lines={[
            { label: "Committed Costs", value: lineItem.committedCosts },
            { label: "Direct Costs", value: lineItem.directCosts, operator: "+" },
            { label: "Pending Cost Changes", value: lineItem.pendingCostChanges, operator: "+" },
          ]}
          resultLabel="Projected Costs"
          resultValue={lineItem.projectedCosts}
        />
      );
    case "forecastToComplete":
      return (
        <FormulaTooltip
          title="Forecast To Complete"
          formula="Projected Budget - Projected Costs, floored at $0.00"
          lines={[
            { label: "Projected Budget", value: lineItem.projectedBudget },
            { label: "Projected Costs", value: lineItem.projectedCosts, operator: "-" },
          ]}
          resultLabel="Forecast To Complete"
          resultValue={lineItem.forecastToComplete}
        />
      );
    case "estimatedCostAtCompletion":
      return (
        <FormulaTooltip
          title="Estimated Cost at Completion"
          formula="Projected Costs + Forecast To Complete"
          lines={[
            { label: "Projected Costs", value: lineItem.projectedCosts },
            { label: "Forecast To Complete", value: lineItem.forecastToComplete, operator: "+" },
          ]}
          resultLabel="Est. Cost at Completion"
          resultValue={lineItem.estimatedCostAtCompletion}
        />
      );
    case "projectedOverUnder":
      return (
        <FormulaTooltip
          title="Projected +/-"
          formula="Projected Budget - Estimated Cost at Completion"
          lines={[
            { label: "Projected Budget", value: lineItem.projectedBudget },
            {
              label: "Est. Cost at Completion",
              value: lineItem.estimatedCostAtCompletion,
              operator: "-",
            },
          ]}
          resultLabel="Projected +/-"
          resultValue={lineItem.projectedOverUnder}
        />
      );
  }
}

export function getBudgetLineLabel(lineItem: BudgetLineItem) {
  const { costCode, costCodeDescription, costType, description } = lineItem;
  const codeLabelBase = costCode
    ? `${costCode}${costCodeDescription ? ` - ${costCodeDescription}` : ""}`
    : costCodeDescription || "";
  const codeLabel = codeLabelBase
    ? (costType ? `${codeLabelBase}.${costType}` : codeLabelBase)
    : null;
  const fallbackDescription = `${costCode}${costCodeDescription ? ` - ${costCodeDescription}` : ""}${costType ? ` (${costType})` : ""}`;
  const normalizedDescription = description.trim();
  const isGenericDivisionDescription = /^division\s+\d+$/i.test(
    normalizedDescription,
  );
  const isRedundantWithCode = Boolean(
    costCodeDescription &&
    normalizedDescription.toLowerCase().startsWith(costCodeDescription.toLowerCase()),
  );
  const showDescription = Boolean(
    normalizedDescription &&
    normalizedDescription !== codeLabel &&
    normalizedDescription !== fallbackDescription &&
    !isGenericDivisionDescription &&
    !isRedundantWithCode,
  );

  return {
    codeLabel,
    description: showDescription ? description : "",
    fullLabel: codeLabel && showDescription
      ? `${codeLabel} ${description}`
      : codeLabel || description || "",
  };
}

// Helper functions to create toast-aware click handlers
function createSafeClickHandler(
  isLocked: boolean,
  action: string,
  originalHandler?: () => void,
  options: { allowWhenLocked?: boolean; hideWhenLocked?: boolean } = {},
): (() => void) | undefined {
  if (!originalHandler) return undefined;
  // Locked budgets hide edit affordances entirely instead of showing a
  // clickable control that only produces an error toast.
  if (isLocked && options.hideWhenLocked) return undefined;

  return () => {
    if (isLocked && !options.allowWhenLocked) {
      toast.error(`Budget is locked. Unlock to ${action}.`);
      return;
    }
    originalHandler();
  };
}

function EditableCurrencyCell({
  value,
  onEdit,
  editable = false,
  tooltip,
}: {
  value: number;
  hasChildren?: boolean;
  onEdit?: () => void;
  editable?: boolean;
  tooltip?: React.ReactNode;
}) {
  // Allow clicking on both parent and child rows when onEdit is provided
  const isClickable = onEdit && editable;

  const cell = isClickable ? (
    <Button
      type="button"
      variant="ghost"
      aria-label={`Edit ${formatCurrency(value)}`}
      className={cn(
        "flex h-auto w-full cursor-pointer justify-end rounded px-1 py-0.5 text-right font-normal transition-colors",
        "hover:bg-muted/80 underline decoration-muted-foreground/40 underline-offset-2 hover:decoration-foreground",
      )}
      onClick={onEdit}
    >
      <CurrencyCell value={value} />
    </Button>
  ) : (
    <div className={cn("text-right", tooltip && "cursor-help")}>
      <CurrencyCell value={value} />
    </div>
  );

  if (!tooltip) {
    return cell;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>{cell}</TooltipTrigger>
      <TooltipContent side="top" align="end" className="max-w-none">
        {tooltip}
      </TooltipContent>
    </Tooltip>
  );
}

function MobileMetricButton({
  label,
  value,
  onClick,
}: {
  label: string;
  value: number;
  onClick?: () => void;
}) {
  const content = (
    <>
      <span className="text-[11px] font-medium uppercase text-muted-foreground">
        {label}
      </span>
      <span className="text-sm font-semibold tabular-nums text-foreground">
        <CurrencyCell value={value} />
      </span>
    </>
  );

  if (!onClick) {
    return <div className="flex min-w-0 flex-col gap-1">{content}</div>;
  }

  return (
    <Button
      type="button"
      variant="ghost"
      className="h-auto min-h-11 w-full flex-col items-start gap-1 px-0 py-0 text-left hover:bg-transparent"
      onClick={onClick}
    >
      {content}
    </Button>
  );
}

const depthPaddingClasses = ["pl-0", "pl-4", "pl-8", "pl-12", "pl-16", "pl-20"];

function getDepthPadding(depth: number) {
  const index = Math.min(depth, depthPaddingClasses.length - 1);
  return depthPaddingClasses[index];
}

const columnLabels: Record<string, string> = {
  description: "Description",
  originalBudgetAmount: "Original Budget",
  budgetModifications: "Budget Changes",
  approvedCOs: "Approved COs",
  revisedBudget: "Revised Budget",
  pendingChanges: "Pending COs",
  jobToDateCostDetail: "JTD Cost Detail",
  projectedBudget: "Projected Budget",
  committedCosts: "Committed Costs",
  directCosts: "Direct Costs",
  pendingCostChanges: "Pending Cost Changes",
  projectedCosts: "Projected Costs",
  forecastToComplete: "Forecast To Complete",
  estimatedCostAtCompletion: "Est. Cost at Completion",
  projectedOverUnder: "Projected +/-",
};

const budgetGrandTotalColumnKeys = new Set<keyof BudgetGrandTotals>([
  "originalBudgetAmount",
  "budgetModifications",
  "approvedCOs",
  "revisedBudget",
  "pendingChanges",
  "projectedBudget",
  "committedCosts",
  "jobToDateCostDetail",
  "directCosts",
  "pendingCostChanges",
  "projectedCosts",
  "forecastToComplete",
  "estimatedCostAtCompletion",
  "projectedOverUnder",
]);

function isBudgetGrandTotalColumn(
  columnId: string,
): columnId is keyof BudgetGrandTotals {
  return budgetGrandTotalColumnKeys.has(columnId as keyof BudgetGrandTotals);
}

export function BudgetTable({
  data,
  grandTotals,
  isLocked = false,
  onEditLineItem,
  onDeleteLineItem,
  onSelectionChange,
  onBudgetModificationsClick,
  onApprovedCOsClick,
  onJobToDateCostDetailClick,
  onDirectCostsClick,
  onPendingChangesClick,
  onCommittedCostsClick,
  onPendingCostChangesClick,
  onForecastToCompleteClick,
  onCreateLineItem,
  projectId,
  columnControlsPortalId,
  showInlineCreate: showInlineCreateProp = false,
  onShowInlineCreateChange,
  columnVisibilityOverride,
}: BudgetTableProps) {
  const [expanded, setExpanded] = React.useState<ExpandedState>({});
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});
  const [columnSizing, setColumnSizing] = React.useState<ColumnSizingState>({});
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});

  React.useEffect(() => {
    if (columnVisibilityOverride) {
      setColumnVisibility(columnVisibilityOverride);
    }
  }, [columnVisibilityOverride]);
  // Use prop if provided, otherwise use internal state
  const [showInlineCreateInternal, setShowInlineCreateInternal] = React.useState(false);
  const showInlineCreate = onShowInlineCreateChange ? showInlineCreateProp : showInlineCreateInternal;
  const setShowInlineCreate = onShowInlineCreateChange || setShowInlineCreateInternal;

  const [isCreating, setIsCreating] = React.useState(false);
  const [newLineItem, setNewLineItem] = React.useState({
    costCode: "",
    description: "",
    originalBudgetAmount: "",
  });

  const handleInlineCreate = async () => {
    if (!onCreateLineItem) return;

    // Validate required fields
    if (!newLineItem.description.trim()) {
      toast.error("Description is required");
      return;
    }

    try {
      setIsCreating(true);

      await onCreateLineItem({
        costCode: newLineItem.costCode.trim() || undefined,
        description: newLineItem.description.trim(),
        originalBudgetAmount: newLineItem.originalBudgetAmount,
      });

      // Reset form
      setNewLineItem({
        costCode: "",
        description: "",
        originalBudgetAmount: "",
      });
      setShowInlineCreate(false);
      toast.success("Budget line item created successfully");
    } catch (error) {
      toast.error("Failed to create budget line item");
    } finally {
      setIsCreating(false);
    }
  };

  const handleCancelInlineCreate = () => {
    setNewLineItem({
      costCode: "",
      description: "",
      originalBudgetAmount: "",
    });
    setShowInlineCreate(false);
  };

  // Effect to handle when showInlineCreate is triggered from parent
  React.useEffect(() => {
    if (showInlineCreateProp && onShowInlineCreateChange) {
      // Scroll to bottom to show the inline create row
      setTimeout(() => {
        const tableContainer = document.querySelector('[data-radix-scroll-area-viewport]') ||
                               document.querySelector('.overflow-auto');
        if (tableContainer) {
          tableContainer.scrollTo({
            top: tableContainer.scrollHeight,
            behavior: 'smooth'
          });
        }
      }, 100);
    }
  }, [showInlineCreateProp, onShowInlineCreateChange]);

  // Notify parent of selection changes
  React.useEffect(() => {
    if (onSelectionChange) {
      const selectedIds = Object.keys(rowSelection).filter(
        (key) => rowSelection[key],
      );
      onSelectionChange(selectedIds);
    }
  }, [rowSelection, onSelectionChange]);

  const columns: ColumnDef<BudgetLineItem>[] = [
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected()}
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
          className="h-4 w-4"
        />
      ),
      cell: ({ row }) => {
        // Only show checkbox for leaf nodes (no children)
        const hasChildren = Boolean(
          row.original.children && row.original.children.length > 0);
        if (hasChildren) {
          const label = getBudgetLineLabel(row.original).fullLabel;
          return (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                row.toggleExpanded();
              }}
              className="h-6 w-6 hover:bg-muted"
              aria-label={
                row.getIsExpanded()
                  ? `Collapse ${label}`
                  : `Expand ${label}`
              }
            >
              {row.getIsExpanded() ? (
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              )}
            </Button>
          );
        }
        return (
          <div onClick={(e) => e.stopPropagation()}>
            <Checkbox
              checked={row.getIsSelected()}
              onCheckedChange={(value) => row.toggleSelected(!!value)}
              aria-label="Select row"
              className="h-4 w-4"
            />
          </div>
        );
      },
      size: 44,
      minSize: 44,
      maxSize: 44,
      enableResizing: false,
    },
    {
      accessorKey: "description",
      header: () => <ColumnHeader lines={["Description"]} />,
      cell: ({ row }) => {
        const hasChildren = Boolean(
          row.original.children && row.original.children.length > 0);
        const isGroupRow = hasChildren;
        const { codeLabel, description, fullLabel } = getBudgetLineLabel(row.original);

        return (
          <div
            className={cn(
              "flex items-center gap-1.5 min-w-0",
              isGroupRow ? "text-foreground font-medium" : "text-foreground font-normal",
              getDepthPadding(row.depth),
            )}
            title={fullLabel}
          >
            {codeLabel && (
              <span className="text-muted-foreground font-mono text-xs shrink-0">
                {codeLabel}
              </span>
            )}
            {description && <span className="truncate">{description}</span>}
          </div>
        );
      },
      size: 250,
    },
    {
      accessorKey: "originalBudgetAmount",
      header: () => (
        <ColumnHeader
          columnKey="originalBudgetAmount"
          lines={["original"]}
          align="right"
        />
      ),
      cell: ({ row }) => {
        const hasChildren = Boolean(
          row.original.children && row.original.children.length > 0);
        const value = row.getValue("originalBudgetAmount") as number;

        return (
          <EditableCurrencyCell
            value={value}
            hasChildren={hasChildren}
            onEdit={createSafeClickHandler(
              isLocked,
              "edit line items",
              onEditLineItem ? () => onEditLineItem(row.original) : undefined,
              { hideWhenLocked: true },
            )}
            editable={!hasChildren}
          />
        );
      },
      size: 130,
    },
    {
      accessorKey: "budgetModifications",
      header: () => (
        <ColumnHeader
          columnKey="budgetModifications"
          lines={["Budget Changes"]}
          align="right"
        />
      ),
      cell: ({ row }) => {
        const hasChildren = Boolean(
          row.original.children && row.original.children.length > 0);
        return (
          <EditableCurrencyCell
            value={row.getValue("budgetModifications")}
            hasChildren={hasChildren}
            onEdit={createSafeClickHandler(
              isLocked,
              "view budget modifications",
              onBudgetModificationsClick
                ? () => onBudgetModificationsClick(row.original)
                : undefined,
              { allowWhenLocked: true },
            )}
            editable={!hasChildren}
          />
        );
      },
      size: 130,
    },
    {
      accessorKey: "approvedCOs",
      header: () => (
        <ColumnHeader
          columnKey="approvedCOs"
          lines={["Approved COs"]}
          align="right"
        />
      ),
      cell: ({ row }) => {
        const hasChildren = Boolean(
          row.original.children && row.original.children.length > 0);
        return (
          <EditableCurrencyCell
            value={row.getValue("approvedCOs")}
            hasChildren={hasChildren}
            onEdit={createSafeClickHandler(
              isLocked,
              "view approved change orders",
              onApprovedCOsClick
                ? () => onApprovedCOsClick(row.original)
                : undefined,
              { allowWhenLocked: true },
            )}
            editable={!hasChildren}
          />
        );
      },
      size: 120,
    },
    {
      accessorKey: "revisedBudget",
      header: () => (
        <ColumnHeader
          columnKey="revisedBudget"
          lines={["Revised Budget"]}
          align="right"
        />
      ),
      cell: ({ row }) => {
        const hasChildren = Boolean(
          row.original.children && row.original.children.length > 0);
        return (
          <EditableCurrencyCell
            value={row.getValue("revisedBudget")}
            hasChildren={hasChildren}
            onEdit={createSafeClickHandler(
              isLocked,
              "edit line items",
              onEditLineItem ? () => onEditLineItem(row.original) : undefined
            )}
            tooltip={getCalculatedColumnTooltip("revisedBudget", row.original)}
          />
        );
      },
      size: 130,
    },
    {
      accessorKey: "pendingChanges",
      header: () => (
        <ColumnHeader
          columnKey="pendingChanges"
          lines={["Pending COs"]}
          align="right"
        />
      ),
      cell: ({ row }) => {
        const hasChildren = Boolean(
          row.original.children && row.original.children.length > 0);
        return (
          <EditableCurrencyCell
            value={row.getValue("pendingChanges")}
            hasChildren={hasChildren}
            onEdit={createSafeClickHandler(
              isLocked,
              "view pending changes",
              onPendingChangesClick
                ? () => onPendingChangesClick(row.original)
                : undefined,
              { allowWhenLocked: true },
            )}
            editable={!hasChildren}
          />
        );
      },
      size: 110,
    },
    {
      accessorKey: "projectedBudget",
      header: () => (
        <ColumnHeader
          columnKey="projectedBudget"
          lines={["Projected Budget"]}
          align="right"
        />
      ),
      cell: ({ row }) => {
        const hasChildren = Boolean(
          row.original.children && row.original.children.length > 0);
        return (
          <EditableCurrencyCell
            value={row.getValue("projectedBudget")}
            hasChildren={hasChildren}
            onEdit={createSafeClickHandler(
              isLocked,
              "edit line items",
              onEditLineItem ? () => onEditLineItem(row.original) : undefined
            )}
            tooltip={getCalculatedColumnTooltip("projectedBudget", row.original)}
          />
        );
      },
      size: 130,
    },
    {
      accessorKey: "committedCosts",
      header: () => (
        <ColumnHeader
          columnKey="committedCosts"
          lines={["Committed Costs"]}
          align="right"
        />
      ),
      cell: ({ row }) => {
        const hasChildren = Boolean(
          row.original.children && row.original.children.length > 0);
        return (
          <EditableCurrencyCell
            value={row.getValue("committedCosts")}
            hasChildren={hasChildren}
            onEdit={createSafeClickHandler(
              isLocked,
              "view committed costs",
              onCommittedCostsClick
                ? () => onCommittedCostsClick(row.original)
                : undefined,
              { allowWhenLocked: true },
            )}
            editable={!hasChildren}
          />
        );
      },
      size: 130,
    },
    {
      accessorKey: "jobToDateCostDetail",
      header: () => (
        <ColumnHeader
          columnKey="jobToDateCostDetail"
          lines={["JTD Cost Detail"]}
          align="right"
        />
      ),
      cell: ({ row }) => {
        const hasChildren = Boolean(
          row.original.children && row.original.children.length > 0);
        return (
          <EditableCurrencyCell
            value={row.getValue("jobToDateCostDetail")}
            hasChildren={hasChildren}
            onEdit={createSafeClickHandler(
              isLocked,
              "view cost details",
              onJobToDateCostDetailClick
                ? () => onJobToDateCostDetailClick(row.original)
                : undefined,
              { allowWhenLocked: true },
            )}
            editable={!hasChildren}
          />
        );
      },
      size: 140,
    },
    {
      accessorKey: "directCosts",
      header: () => (
        <ColumnHeader
          columnKey="directCosts"
          lines={["Direct Costs"]}
          align="right"
        />
      ),
      cell: ({ row }) => {
        const hasChildren = Boolean(
          row.original.children && row.original.children.length > 0);
        return (
          <EditableCurrencyCell
            value={row.getValue("directCosts")}
            hasChildren={hasChildren}
            onEdit={createSafeClickHandler(
              isLocked,
              "view direct costs",
              onDirectCostsClick
                ? () => onDirectCostsClick(row.original)
                : undefined,
              { allowWhenLocked: true },
            )}
            editable={!hasChildren}
          />
        );
      },
      size: 120,
    },
    {
      accessorKey: "pendingCostChanges",
      header: () => (
        <ColumnHeader
          columnKey="pendingCostChanges"
          lines={["Pending Cost Changes"]}
          align="right"
        />
      ),
      cell: ({ row }) => {
        const hasChildren = Boolean(
          row.original.children && row.original.children.length > 0);
        return (
          <EditableCurrencyCell
            value={row.getValue("pendingCostChanges")}
            hasChildren={hasChildren}
            onEdit={createSafeClickHandler(
              isLocked,
              "view pending cost changes",
              onPendingCostChangesClick
                ? () => onPendingCostChangesClick(row.original)
                : undefined,
              { allowWhenLocked: true },
            )}
            editable={!hasChildren}
          />
        );
      },
      size: 130,
    },
    {
      accessorKey: "projectedCosts",
      header: () => (
        <ColumnHeader
          columnKey="projectedCosts"
          lines={["Projected Costs"]}
          align="right"
        />
      ),
      cell: ({ row }) => {
        const hasChildren = Boolean(
          row.original.children && row.original.children.length > 0);
        return (
          <EditableCurrencyCell
            value={row.getValue("projectedCosts")}
            hasChildren={hasChildren}
            onEdit={createSafeClickHandler(
              isLocked,
              "edit line items",
              onEditLineItem ? () => onEditLineItem(row.original) : undefined
            )}
            tooltip={getCalculatedColumnTooltip("projectedCosts", row.original)}
          />
        );
      },
      size: 130,
    },
    {
      accessorKey: "forecastToComplete",
      header: () => (
        <ColumnHeader
          columnKey="forecastToComplete"
          lines={["Forecast To Complete"]}
          align="right"
        />
      ),
      cell: ({ row }) => {
        const hasChildren = Boolean(
          row.original.children && row.original.children.length > 0);
        // Divisions / rollup rows do not carry a forecast (feedback #560).
        // Forecast to Complete is a leaf-level cost projection you enter per
        // line item, so parent rows render blank rather than an aggregated
        // value the user cannot act on. Matches Procore, where only detail
        // rows show a forecast.
        if (hasChildren) {
          return <div className="text-right" data-testid="forecast-blank" />;
        }
        return (
          <EditableCurrencyCell
            value={row.getValue("forecastToComplete")}
            hasChildren={hasChildren}
            onEdit={createSafeClickHandler(
              isLocked,
              "edit forecast",
              onForecastToCompleteClick
                ? () => onForecastToCompleteClick(row.original)
                : undefined,
              // Procore parity: forecasting stays editable after budget lock —
              // the lock freezes the budget, not the forecast. Forecast to
              // Complete is a forward-looking cost projection, not a committed
              // budget dollar.
              { allowWhenLocked: true },
            )}
            editable={!hasChildren}
            tooltip={getCalculatedColumnTooltip("forecastToComplete", row.original)}
          />
        );
      },
      size: 130,
    },
    {
      accessorKey: "estimatedCostAtCompletion",
      header: () => (
        <ColumnHeader
          columnKey="estimatedCostAtCompletion"
          lines={["Est. Cost at Completion"]}
          align="right"
        />
      ),
      cell: ({ row }) => {
        const hasChildren = Boolean(
          row.original.children && row.original.children.length > 0);
        return (
          <EditableCurrencyCell
            value={row.getValue("estimatedCostAtCompletion")}
            hasChildren={hasChildren}
            onEdit={createSafeClickHandler(
              isLocked,
              "edit line items",
              onEditLineItem ? () => onEditLineItem(row.original) : undefined
            )}
            tooltip={getCalculatedColumnTooltip("estimatedCostAtCompletion", row.original)}
          />
        );
      },
      size: 150,
    },
    {
      accessorKey: "projectedOverUnder",
      header: () => (
        <ColumnHeader
          columnKey="projectedOverUnder"
          lines={["Projected +/-"]}
          align="right"
        />
      ),
      cell: ({ row }) => {
        const hasChildren = Boolean(
          row.original.children && row.original.children.length > 0);
        return (
          <EditableCurrencyCell
            value={row.getValue("projectedOverUnder")}
            hasChildren={hasChildren}
            onEdit={createSafeClickHandler(
              isLocked,
              "edit line items",
              onEditLineItem ? () => onEditLineItem(row.original) : undefined
            )}
            tooltip={getCalculatedColumnTooltip("projectedOverUnder", row.original)}
          />
        );
      },
      size: 130,
    },
    {
      id: "actions",
      header: () => null,
      cell: ({ row }) => {
        const hasChildren = Boolean(
          row.original.children && row.original.children.length > 0
        );
        // Locked budgets do not allow line edits or deletes, so show no
        // row actions at all instead of disabled/toasting controls.
        if (hasChildren || !onEditLineItem || isLocked) {
          return null;
        }

        const handleEdit = createSafeClickHandler(
          isLocked,
          "edit line items",
          () => onEditLineItem(row.original)
        );

        // Procore-parity delete rule (tests 1.3.1–1.3.4): allowed only when
        // original budget is $0. Server also blocks when active budget
        // modifications reference the line's cost code (LINE_HAS_ACTIVE_MODIFICATIONS).
        const originalAmount = Number(row.original.originalBudgetAmount ?? 0);
        const hasOriginalBudget = originalAmount !== 0;
        const deleteDisabled = hasOriginalBudget;
        const deleteDisabledReason = hasOriginalBudget
          ? "Cannot delete a line with an original budget. Use a budget modification to remove or zero out funded lines."
          : "";

        return (
          <div className="flex items-center justify-end gap-0.5">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={handleEdit}
              aria-label="Edit line item"
            >
              <Pencil className="text-muted-foreground" />
            </Button>
            {onDeleteLineItem &&
              (deleteDisabled ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    {/* span wrapper so the disabled button still triggers the tooltip */}
                    <span className="inline-flex">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        disabled
                        aria-label="Delete line item (disabled)"
                      >
                        <Trash2 className="text-muted-foreground/50" />
                      </Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="left" className="max-w-xs">
                    {deleteDisabledReason}
                  </TooltipContent>
                </Tooltip>
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 hover:text-destructive"
                  onClick={() => onDeleteLineItem(row.original)}
                  aria-label="Delete line item"
                >
                  <Trash2 className="text-muted-foreground" />
                </Button>
              ))}
          </div>
        );
      },
      size: 80,
      minSize: 72,
      maxSize: 96,
    },
  ];

  const table = useReactTable({
    data,
    columns,
    state: {
      expanded,
      rowSelection,
      columnSizing,
      columnVisibility,
    },
    onExpandedChange: setExpanded,
    onRowSelectionChange: setRowSelection,
    onColumnSizingChange: setColumnSizing,
    onColumnVisibilityChange: setColumnVisibility,
    columnResizeMode: "onChange",
    enableColumnResizing: true,
    defaultColumn: {
      minSize: 96,
      maxSize: 600,
    },
    getCoreRowModel: getCoreRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getSubRows: (row) => row.children,
    getRowId: (row) => row.id,
    enableRowSelection: (row) =>
      !row.original.children || row.original.children.length === 0,
  });

  const rows = table.getRowModel().rows;
  const hasRows = rows.length > 0;
  const emptyRowCount = hasRows ? 0 : 8;
  const visibleColumnCount = table.getVisibleLeafColumns().length;
  const trailingInlineCreateColumnSpan = Math.max(0, visibleColumnCount - 4);
  const tableWidth = table.getTotalSize();
  const bodyScrollRef = React.useRef<HTMLDivElement>(null);
  const footerScrollRef = React.useRef<HTMLDivElement>(null);
  const syncingScrollRef = React.useRef(false);
  const [columnControlsPortal, setColumnControlsPortal] =
    React.useState<HTMLElement | null>(null);

  React.useEffect(() => {
    if (!columnControlsPortalId) {
      setColumnControlsPortal(null);
      return;
    }

    setColumnControlsPortal(document.getElementById(columnControlsPortalId));
  }, [columnControlsPortalId]);

  const mobileExpandedIds = React.useMemo(() => {
    if (expanded === true) {
      return new Set(data.map((item) => item.id));
    }
    return new Set(
      Object.entries(expanded)
        .filter(([, isExpanded]) => isExpanded)
        .map(([id]) => id),
    );
  }, [data, expanded]);
  const selectedIds = React.useMemo(
    () =>
      Object.entries(rowSelection)
        .filter(([, isSelected]) => isSelected)
        .map(([id]) => id),
    [rowSelection],
  );
  const getColumnSizeStyle = (columnId: string) => {
    const column = table.getColumn(columnId);
    const width = column?.getSize();
    return width ? { width: `${width}px`, minWidth: `${width}px` } : undefined;
  };

  const renderGrandTotalFooterCell = (columnId: string) => {
    const isUtilityColumn = columnId === "select" || columnId === "actions";
    const isDescriptionColumn = columnId === "description";
    const columnTotal = isBudgetGrandTotalColumn(columnId)
      ? grandTotals[columnId]
      : null;

    return (
      <td
        key={columnId}
        className={cn(
          "py-4 text-sm",
          columnId === "select" ? "pl-3 pr-2" : "px-1.5",
          isDescriptionColumn && "font-semibold text-foreground",
        )}
        style={getColumnSizeStyle(columnId)}
      >
        {isDescriptionColumn ? (
          "Grand Totals"
        ) : columnTotal !== null ? (
          <div className="flex w-full items-center gap-0.5">
            <div className="flex-1 min-w-0">
              <div className="flex h-auto w-full justify-end px-1 text-right">
                <CurrencyCell value={columnTotal} />
              </div>
            </div>
            <span className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
          </div>
        ) : isUtilityColumn ? null : (
          <span className="sr-only">
            No total for {columnLabels[columnId] ?? columnId}
          </span>
        )}
      </td>
    );
  };

  const syncHorizontalScroll = (
    source: HTMLDivElement | null,
    target: HTMLDivElement | null,
  ) => {
    if (!source || !target || syncingScrollRef.current) {
      return;
    }

    syncingScrollRef.current = true;
    target.scrollLeft = source.scrollLeft;
    requestAnimationFrame(() => {
      syncingScrollRef.current = false;
    });
  };

  const getBodyTableScrollElement = React.useCallback(() => {
    return bodyScrollRef.current?.querySelector<HTMLDivElement>(
      '[data-slot="table-container"]',
    ) ?? null;
  }, []);

  const toggleMobileExpanded = (lineItemId: string) => {
    setExpanded((current) => {
      if (current === true) {
        return data.reduce<Record<string, boolean>>((next, item) => {
          if (item.id !== lineItemId) next[item.id] = true;
          return next;
        }, {});
      }

      return {
        ...current,
        [lineItemId]: !current[lineItemId],
      };
    });
  };

  const toggleMobileSelection = (lineItemId: string, checked: boolean) => {
    setRowSelection((current) => {
      if (!checked) {
        const next = { ...current };
        delete next[lineItemId];
        return next;
      }
      return { ...current, [lineItemId]: true };
    });
  };

  const renderMobileBudgetLine = (lineItem: BudgetLineItem, depth = 0): React.ReactNode => {
    const children = lineItem.children ?? [];
    const hasChildren = children.length > 0;
    const isExpanded = mobileExpandedIds.has(lineItem.id);
    const { codeLabel, description, fullLabel } = getBudgetLineLabel(lineItem);
    const isSelected = selectedIds.includes(lineItem.id);
    const canDelete = Boolean(onDeleteLineItem);
    const originalAmount = Number(lineItem.originalBudgetAmount ?? 0);
    const deleteDisabled = isLocked || originalAmount !== 0;
    const overUnderIsNegative = lineItem.projectedOverUnder < 0;

    const handleEdit = createSafeClickHandler(
      isLocked,
      "edit line items",
      onEditLineItem ? () => onEditLineItem(lineItem) : undefined,
    );
    const handleDelete = () => {
      if (!onDeleteLineItem) return;
      if (deleteDisabled) {
        toast.error(
          isLocked
            ? "Budget is locked. Unlock the budget to delete line items."
            : "Cannot delete a line with an original budget.",
        );
        return;
      }
      onDeleteLineItem(lineItem);
    };

    return (
      <React.Fragment key={lineItem.id}>
        <article
          className={cn(
            "rounded-md border border-border bg-background px-3 py-3",
            depth > 0 && "ml-4",
            isSelected && "border-primary/40 bg-primary/5",
          )}
          data-budget-mobile-card
        >
          <div className="flex min-w-0 items-start gap-2">
            {hasChildren ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="mt-0.5 h-11 w-11 shrink-0"
                onClick={() => toggleMobileExpanded(lineItem.id)}
                aria-label={isExpanded ? `Collapse ${fullLabel}` : `Expand ${fullLabel}`}
              >
                {isExpanded ? <ChevronDown /> : <ChevronRight />}
              </Button>
            ) : (
              <div className="flex h-11 w-11 shrink-0 items-center justify-center">
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={(checked) =>
                    toggleMobileSelection(lineItem.id, Boolean(checked))
                  }
                  aria-label={`Select ${fullLabel}`}
                />
              </div>
            )}

            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 items-start justify-between gap-2">
                <div className="min-w-0">
                  {codeLabel ? (
                    <p className="truncate font-mono text-xs text-muted-foreground">
                      {codeLabel}
                    </p>
                  ) : null}
                  <p className="truncate text-sm font-semibold text-foreground">
                    {description || fullLabel}
                  </p>
                </div>

                {!hasChildren && !isLocked && (onEditLineItem || canDelete) ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-11 w-11 shrink-0"
                        aria-label={`Actions for ${fullLabel}`}
                      >
                        <MoreVertical />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {onEditLineItem ? (
                        <DropdownMenuItem onClick={handleEdit}>
                          <Pencil className="mr-2 h-4 w-4" />
                          Edit line item
                        </DropdownMenuItem>
                      ) : null}
                      {canDelete ? (
                        <DropdownMenuItem
                          className="text-destructive"
                          disabled={deleteDisabled}
                          onClick={handleDelete}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete line item
                        </DropdownMenuItem>
                      ) : null}
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : null}
              </div>

              <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3">
                <MobileMetricButton
                  label="Original"
                  value={lineItem.originalBudgetAmount}
                  onClick={hasChildren ? undefined : handleEdit}
                />
                <MobileMetricButton
                  label="Revised"
                  value={lineItem.revisedBudget}
                  onClick={hasChildren ? undefined : handleEdit}
                />
                <MobileMetricButton
                  label="Committed"
                  value={lineItem.committedCosts}
                  onClick={
                    hasChildren
                      ? undefined
                      : createSafeClickHandler(
                          isLocked,
                          "view committed costs",
                          onCommittedCostsClick ? () => onCommittedCostsClick(lineItem) : undefined,
                        )
                  }
                />
                <MobileMetricButton
                  label="Projected cost"
                  value={lineItem.projectedCosts}
                  onClick={hasChildren ? undefined : handleEdit}
                />
              </div>

              <div className="mt-3 flex items-center justify-between gap-3 border-t border-border/70 pt-3">
                <span className="text-[11px] font-medium uppercase text-muted-foreground">
                  Projected +/- 
                </span>
                <span
                  className={cn(
                    "text-sm font-semibold tabular-nums",
                    overUnderIsNegative ? "text-destructive" : "text-foreground",
                  )}
                >
                  <CurrencyCell value={lineItem.projectedOverUnder} />
                </span>
              </div>
            </div>
          </div>
        </article>

        {hasChildren && isExpanded ? (
          <div className="space-y-2">
            {children.map((child) => renderMobileBudgetLine(child, depth + 1))}
          </div>
        ) : null}
      </React.Fragment>
    );
  };

  React.useEffect(() => {
    const bodyTableScrollElement = getBodyTableScrollElement();
    if (!bodyTableScrollElement) {
      return;
    }

    bodyTableScrollElement.setAttribute("aria-label", "Budget table scroll area");
    bodyTableScrollElement.tabIndex = 0;
    bodyTableScrollElement.classList.add(
      "focus-visible:outline-none",
      "focus-visible:ring-1",
      "focus-visible:ring-border",
    );

    const handleBodyScroll = () =>
      syncHorizontalScroll(bodyTableScrollElement, footerScrollRef.current);

    bodyTableScrollElement.addEventListener("scroll", handleBodyScroll);

    return () => {
      bodyTableScrollElement.removeEventListener("scroll", handleBodyScroll);
    };
  }, [getBodyTableScrollElement]);

  const columnVisibilityControl = (
    <DropdownMenu>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
                aria-label="Toggle columns"
              >
                <Columns3 className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent>Select which columns to display</TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Columns</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {table
          .getAllLeafColumns()
          .filter((col) => col.id !== "select" && col.id !== "actions")
          .map((col) => (
            <DropdownMenuCheckboxItem
              key={col.id}
              checked={col.getIsVisible()}
              onSelect={(e) => e.preventDefault()}
              onCheckedChange={() => col.toggleVisibility()}
            >
              {columnLabels[col.id] ?? col.id}
            </DropdownMenuCheckboxItem>
          ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <div className="flex min-h-0 flex-col rounded-md bg-background sm:h-[calc(100vh-12.75rem)]">
      {columnControlsPortal
        ? createPortal(columnVisibilityControl, columnControlsPortal)
        : null}

      <div className="space-y-3 sm:hidden" data-testid="budget-mobile-list">
        <section
          className="rounded-md border border-border bg-muted/30 px-3 py-3"
          aria-label="Budget grand totals"
        >
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-foreground">Grand Totals</p>
            <span className="text-xs text-muted-foreground">
              {data.length} cost code groups
            </span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3">
            <MobileMetricButton
              label="Original"
              value={grandTotals.originalBudgetAmount}
            />
            <MobileMetricButton
              label="Revised"
              value={grandTotals.revisedBudget}
            />
            <MobileMetricButton
              label="Projected cost"
              value={grandTotals.projectedCosts}
            />
            <MobileMetricButton
              label="Projected +/-"
              value={grandTotals.projectedOverUnder}
            />
          </div>
        </section>

        {hasRows ? (
          <div className="space-y-2" aria-label="Budget mobile list">
            {data.map((lineItem) => renderMobileBudgetLine(lineItem))}
          </div>
        ) : (
          <div className="rounded-md border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
            No budget line items yet.
          </div>
        )}
      </div>

      <div className="hidden min-h-0 flex-1 flex-col sm:flex">
        {!columnControlsPortal ? (
          <div className="flex justify-end px-4 pb-2 sm:px-6 lg:px-8">
            {columnVisibilityControl}
          </div>
        ) : null}
        {/* Horizontal scroll container — allows the wide budget table to scroll on mobile */}
        <div
          ref={bodyScrollRef}
          className="min-h-0 flex-1 min-w-0 overflow-hidden [&_[data-slot=table-container]]:h-full [&_[data-slot=table-container]]:overflow-auto"
        >
        <Table
          className="table-fixed bg-background"
          style={{ width: `${tableWidth}px`, minWidth: "100%" }}
        >
              <TableHeader className="sticky top-0 bg-background z-10">
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow
                    key={headerGroup.id}
                    className="border-b border-border"
                  >
                    {headerGroup.headers.map((header) => (
                      <TableHead
                        key={header.id}
                        className={cn(
                          "relative bg-background py-2 text-left text-xs font-semibold text-foreground capitalize tracking-normal",
                          header.column.id === "select"
                            ? "pl-3 pr-2 sm:pl-3 sm:pr-2"
                            : "px-1.5 sm:px-1.5",
                        )}
                        style={getColumnSizeStyle(header.column.id)}
                      >
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext(),
                            )}
                        {header.column.getCanResize() ? (
                          <div
                            onMouseDown={header.getResizeHandler()}
                            onTouchStart={header.getResizeHandler()}
                            className={cn(
                              "absolute right-0 top-0 h-full w-1.5 cursor-col-resize select-none touch-none",
                              "bg-transparent hover:bg-border/80",
                              header.column.getIsResizing() && "bg-border",
                            )}
                            aria-hidden="true"
                          />
                        ) : null}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {rows.map((row) => {
                  const hasChildren =
                    row.original.children && row.original.children.length > 0;

                  return (
                    <TableRow
                      key={row.id}
                      className={cn(
                        "border-b border-border transition-colors",
                        "hover:bg-muted/20",
                        row.getIsSelected() && "bg-primary/5",
                        !row.getIsGrouped() &&
                          row.original.projectedCosts > row.original.revisedBudget
                          ? "text-destructive"
                          : "",
                      )}
                    >
                      {row.getVisibleCells().map((cell) => {
                        const isDataColumn =
                          cell.column.id !== "select" &&
                          cell.column.id !== "expander" &&
                          cell.column.id !== "description" &&
                          cell.column.id !== "actions";

                        return (
                          <TableCell
                            key={cell.id}
                            className={cn(
                              "py-2 text-sm",
                              cell.column.id === "select"
                                ? "pl-3 pr-2 sm:pl-3 sm:pr-2"
                                : "px-1.5 sm:px-1.5",
                              row.depth > 0 && "text-foreground",
                              isDataColumn && "group/cell",
                            )}
                            style={getColumnSizeStyle(cell.column.id)}
                          >
                            {isDataColumn ? (
                              <div className="flex w-full items-center gap-0.5">
                                <div className="flex-1 min-w-0">
                                  {flexRender(
                                    cell.column.columnDef.cell,
                                    cell.getContext(),
                                  )}
                                </div>
                                <CellCommentIndicator
                                  rowId={row.original.id}
                                  columnId={cell.column.id}
                                />
                              </div>
                            ) : (
                              flexRender(
                                cell.column.columnDef.cell,
                                cell.getContext(),
                              )
                            )}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  );
                })}
                {!hasRows &&
                  Array.from({ length: emptyRowCount }).map((_, index) => (
                    <TableRow key={`empty-row-${index}`} className="border-b border-border">
                      <TableCell
                        colSpan={visibleColumnCount}
                        className={cn(
                          "h-11 px-4",
                          index === 0 && "text-sm text-muted-foreground",
                        )}
                      >
                        {index === 0 ? "No budget line items yet." : null}
                      </TableCell>
                    </TableRow>
                  ))}

            {/* Inline Create Row */}
            {!isLocked && showInlineCreate && (
              <TableRow className="bg-primary/5 border-b border-border">
                <TableCell className="py-2 pl-2 pr-1">
                  {/* Empty checkbox cell */}
                </TableCell>
                <TableCell className="py-2 px-2">
                  <div className="flex items-center gap-2">
                    <Input
                      placeholder="Cost Code (optional)"
                      value={newLineItem.costCode}
                      onChange={(e) =>
                        setNewLineItem({ ...newLineItem, costCode: e.target.value })
                      }
                      className="h-8 w-24"
                      disabled={isCreating}
                    />
                    <Input
                      placeholder="Description *"
                      value={newLineItem.description}
                      onChange={(e) =>
                        setNewLineItem({ ...newLineItem, description: e.target.value })
                      }
                      className="h-8 flex-1"
                      disabled={isCreating}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !isCreating) {
                          handleInlineCreate();
                        }
                        if (e.key === "Escape") {
                          handleCancelInlineCreate();
                        }
                      }}
                    />
                  </div>
                </TableCell>
                <TableCell className="py-2 px-2 text-right">
                  <NumberInput
                    placeholder="Amount *"
                    value={newLineItem.originalBudgetAmount}
                    onChange={(e) =>
                      setNewLineItem({ ...newLineItem, originalBudgetAmount: e.target.value })
                    }
                    className="h-8 text-right"
                    disabled={isCreating}
                    clearZeroOnFocus={true}
                    autoSelectOnFocus={true}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !isCreating) {
                        handleInlineCreate();
                      }
                      if (e.key === "Escape") {
                        handleCancelInlineCreate();
                      }
                    }}
                  />
                </TableCell>
                {/* Empty cells for remaining data columns */}
                <TableCell className="py-2 px-2" colSpan={trailingInlineCreateColumnSpan}>
                  &nbsp;
                </TableCell>
                <TableCell className="py-2 px-2" style={getColumnSizeStyle("actions")}>
                  <div className="flex items-center gap-1 justify-end">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={handleInlineCreate}
                      disabled={isCreating || !newLineItem.description.trim()}
                      title="Save (Enter)"
                    >
                      <Check className="text-success" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={handleCancelInlineCreate}
                      disabled={isCreating}
                      title="Cancel (Escape)"
                    >
                      <X className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            )}

              </TableBody>
        </Table>
      </div>

      {/* Grand Totals Row - scrolls horizontally in sync with the table above */}
      <div
        ref={footerScrollRef}
        className="overflow-x-auto border-t border-border bg-background focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-border"
        aria-label="Budget totals scroll area"
        tabIndex={0}
        onScroll={() => syncHorizontalScroll(footerScrollRef.current, getBodyTableScrollElement())}
      >
          <table
            className="w-full caption-bottom text-sm table-fixed"
            style={{ width: `${tableWidth}px`, minWidth: "100%" }}
          >
            <TableFooter className="bg-muted/50 border-t">
              <tr className="bg-muted/50 hover:bg-muted/50 transition-colors">
                {table.getVisibleLeafColumns().map((column) =>
                  renderGrandTotalFooterCell(column.id),
                )}
              </tr>
            </TableFooter>
          </table>
        </div>
      </div>
    </div>
  );
}
