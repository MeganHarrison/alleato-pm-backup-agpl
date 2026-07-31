import {
  ChevronDown,
  ChevronRight,
  FileText,
  GripVertical,
  MoreVertical,
  Plus,
  Rows3,
  Trash2,
  Upload,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import {
  ContentSectionStack,
  DetailPanel,
  LabelValueRow,
  SectionAction,
  SectionRuleHeading,
  SummaryPanel,
  SummaryValueRow,
} from "@/components/layout";
import {
  DetailField,
  DetailFieldGrid,
  EditableDetailField,
  EmptyState,
  EntityAttachments,
  InlineEditField,
} from "@/components/ds";
import {
  ProjectCostCodeSelector,
  ProjectCostTypeSelector,
} from "@/components/budget/budget-code-field-selectors";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoneyField } from "@/components/forms/MoneyField";
import { Input } from "@/components/ui/input";

import {
  InlineTable,
  InlineTableBody,
  InlineTableCell,
  InlineTableHeader,
  InlineTableHeaderCell,
  InlineTableHeaderRow,
  InlineTableRow,
} from "@/components/ds/inline-table";
import { formatPercent } from "@/lib/format";
import { resolveContractLineBudgetCode } from "@/components/domain/contracts/prime-contract-detail/budget-code-resolution";
import {
  buildSovSummaryValues,
  SovSummaryFooterRows,
} from "@/components/domain/contracts/prime-contract-detail/sov-summary-footer";
import type {
  BudgetCode,
  Contract,
  ContractLineItem,
  PrimeContractCO,
} from "../types";

function getLineTotal(item: ContractLineItem) {
  return (Number(item.quantity) || 0) * (Number(item.unit_cost) || 0);
}

interface PrimeContractOverviewTabProps {
  contract: Contract;
  changeOrders: PrimeContractCO[];
  projectId: string;
  companyOptions: Array<{ value: string; label: string }>;
  formatDate: (value: string | null | undefined) => string;
  getTextValue: (
    value: string | null | undefined,
  ) => { text: string; isMissing: boolean };
  inclusionsList: string[];
  exclusionsList: string[];
  formatStatusLabel: (status: Contract["status"]) => string;
  formatCurrency: (value: number | null | undefined) => string;
  lineItemsLoading: boolean;
  lineItems: ContractLineItem[];
  budgetCodes: BudgetCode[];
  financialMarkupSection: ReactNode;
  sovDraftBudgetCodeIds: Record<string, string>;
  isSovEditing: boolean;
  isSavingSovChanges: boolean;
  sovDraftItems: ContractLineItem[];
  onStartSovEdit: () => void;
  onCancelSovEdit: () => void;
  onSaveSovEdit: () => Promise<void>;
  onAddSovLine: () => void;
  onAddSovGroup: () => void;
  onUpdateSovLine: (
    lineId: string,
    updates: Partial<Pick<ContractLineItem, "description" | "quantity" | "unit_of_measure" | "unit_cost" | "cost_code_id">>,
  ) => void;
  onUpdateSovLineBudgetCode: (lineId: string, budgetCodeId: string) => void;
  onRemoveSovLine: (lineId: string) => void;
  onReorderSovLines: (oldIndex: number, newIndex: number) => void;
  onRequestCreateBudgetCode: (lineId: string) => void;
  onSaveContractField: (field: string, value: string | number | boolean | null) => Promise<void>;
  onDeleteSovLine?: (lineId: string) => Promise<void>;
  onImportEstimateToSov?: () => void;
}

const DIVISION_NAMES: Record<string, string> = {
  "00": "General Requirements",
  "01": "General Conditions",
  "02": "Existing Conditions",
  "03": "Concrete",
  "04": "Masonry",
  "05": "Metals",
  "06": "Wood, Plastics & Composites",
  "07": "Thermal & Moisture Protection",
  "08": "Openings",
  "09": "Finishes",
  "10": "Specialties",
  "11": "Equipment",
  "12": "Furnishings",
  "21": "Fire Suppression",
  "22": "Plumbing",
  "23": "HVAC",
  "26": "Electrical",
  "27": "Communications",
  "28": "Electronic Safety & Security",
  "31": "Earthwork",
  "32": "Exterior Improvements",
  "33": "Utilities",
  "55": "Contractor Fee",
};

const CONTRACT_STATUS_OPTIONS = [
  { value: "draft", label: "Draft" },
  { value: "out_for_signature", label: "Out for Signature" },
  { value: "approved", label: "Approved" },
  { value: "complete", label: "Complete" },
  { value: "terminated", label: "Terminated" },
];

const EMPTY_RELATION_VALUE = "__none__";

const toDateInputValue = (value: string | null | undefined) =>
  value ? value.slice(0, 10) : "";

export function PrimeContractOverviewTab(props: PrimeContractOverviewTabProps) {
  const {
    contract,
    changeOrders,
    projectId,
    companyOptions,
    formatDate,
    getTextValue,
    inclusionsList,
    exclusionsList,
    formatStatusLabel,
    formatCurrency,
    lineItemsLoading,
    lineItems,
    budgetCodes,
    financialMarkupSection,
    sovDraftBudgetCodeIds,
    isSovEditing,
    isSavingSovChanges,
    sovDraftItems,
    onStartSovEdit,
    onCancelSovEdit,
    onSaveSovEdit,
    onAddSovLine,
    onUpdateSovLine,
    onUpdateSovLineBudgetCode,
    onRemoveSovLine,
    onReorderSovLines,
    onRequestCreateBudgetCode,
    onSaveContractField,
    onDeleteSovLine,
    onImportEstimateToSov,
  } = props;
  const ownerName = contract.contract_company?.name || contract.client?.name;
  const displayedSovItems = isSovEditing ? sovDraftItems : lineItems;

  const pointerSensor = useSensor(PointerSensor, { activationConstraint: { distance: 8 } });
  const keyboardSensor = useSensor(KeyboardSensor);
  const sensors = useSensors(pointerSensor, keyboardSensor);

  const sortableIds = useMemo(
    () => displayedSovItems.map((item) => item.id),
    [displayedSovItems],
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = sortableIds.indexOf(active.id as string);
    const newIndex = sortableIds.indexOf(over.id as string);
    if (oldIndex !== -1 && newIndex !== -1) {
      onReorderSovLines(oldIndex, newIndex);
    }
  };

  const displayedSovTotal = displayedSovItems.reduce((sum, item) => {
    if (item.is_group_header) return sum;
    return sum + getLineTotal(item);
  }, 0);
  const computedChangeOrderTotals = useMemo(() => {
    const totals = { approved: 0, pending: 0, draft: 0 };
    for (const co of changeOrders) {
      const amount = Number(co.amount) || 0;
      const status = (co.status || "").toLowerCase();
      if (status === "approved") {
        totals.approved += amount;
      } else if (status === "pending") {
        totals.pending += amount;
      } else if (status === "draft" || status === "proposed") {
        totals.draft += amount;
      }
    }
    return totals;
  }, [changeOrders]);
  const approvedChangeOrdersTotal =
    changeOrders.length > 0
      ? computedChangeOrderTotals.approved
      : Number(contract.approved_change_orders) || 0;
  const pendingChangeOrdersTotal =
    changeOrders.length > 0
      ? computedChangeOrderTotals.pending
      : Number(contract.pending_change_orders) || 0;
  const draftChangeOrdersTotal =
    changeOrders.length > 0
      ? computedChangeOrderTotals.draft
      : Number(contract.draft_change_orders) || 0;
  const originalContractAmount =
    displayedSovTotal > 0
      ? displayedSovTotal
      : Number(contract.original_contract_value) || 0;
  const revisedContractAmount = originalContractAmount + approvedChangeOrdersTotal;
  const pendingRevisedContractAmount =
    revisedContractAmount + pendingChangeOrdersTotal;
  const invoicesTotal = Number(contract.invoiced_amount) || 0;
  const paymentsReceivedTotal = Number(contract.payments_received) || 0;
  const remainingBalanceTotal = revisedContractAmount - paymentsReceivedTotal;
  const percentPaid =
    revisedContractAmount > 0
      ? (paymentsReceivedTotal / revisedContractAmount) * 100
      : 0;
  const billedToDateRatio =
    displayedSovTotal > 0
      ? Math.min(1, Math.max(0, invoicesTotal / displayedSovTotal))
      : 0;
  const sovSummary = buildSovSummaryValues({
    subtotal: displayedSovTotal,
    originalContract: originalContractAmount,
    approvedChanges: approvedChangeOrdersTotal,
    billedToDate: invoicesTotal,
  });
  const addSovAction = (
    <div className="flex items-center gap-3">
      <Button
        variant="link"
        size="sm"
        className="h-auto gap-1 px-0 py-0 text-xs font-semibold text-primary no-underline hover:no-underline hover:text-primary/80 transition-transform active:scale-95"
        onClick={() => { onStartSovEdit(); onAddSovLine(); }}
      >
        <Plus className="h-3 w-3 text-primary" />
        Add Line Item
      </Button>
      {onImportEstimateToSov ? (
        <Button
          variant="ghost"
          size="sm"
          className="h-auto p-0 text-muted-foreground hover:bg-transparent hover:text-primary transition-transform active:scale-95"
          onClick={onImportEstimateToSov}
          title="Import Workbook"
        >
          <Upload className="h-3.5 w-3.5" />
        </Button>
      ) : null}
    </div>
  );

  const [collapsedDivisions, setCollapsedDivisions] = useState<Set<string>>(new Set());

  const getDivCode = (item: (typeof displayedSovItems)[number]) => {
    const code = resolveContractLineBudgetCode(item, budgetCodes).displayCode;
    return code === "Unmapped" ? "XX" : (code.split("-")[0] || "XX");
  };

  const divisionTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const item of displayedSovItems) {
      if (item.is_group_header) continue;
      const div = getDivCode(item);
      const lineTotal = getLineTotal(item);
      totals[div] = (totals[div] ?? 0) + lineTotal;
    }
    return totals;
   
  }, [displayedSovItems, budgetCodes]);

  const viewModeRows = useMemo(() => {
    const rows: Array<
      | { type: "division"; code: string }
      | { type: "subtotal"; key: string; label: string; amount: number; divCode: string }
      | { type: "item"; item: (typeof displayedSovItems)[number]; divCode: string }
    > = [];
    let lastDiv = "";

    // SOV line items render sorted by budget/cost code (ascending). Unmapped
    // lines fall to the bottom. Stable-sort preserves existing relative order
    // for ties. High-numbered codes (e.g. 55-xxxx insurance/fee) naturally land
    // at the bottom of the schedule of values.
    const orderedItems = displayedSovItems
      .map((item, index) => ({ item, index }))
      .sort((a, b) => {
        if (!a.item) return 1;
        if (!b.item) return -1;
        const ca = resolveContractLineBudgetCode(a.item, budgetCodes).displayCode;
        const cb = resolveContractLineBudgetCode(b.item, budgetCodes).displayCode;
        const aUnmapped = ca === "Unmapped";
        const bUnmapped = cb === "Unmapped";
        if (aUnmapped !== bUnmapped) return aUnmapped ? 1 : -1;
        const cmp = ca.localeCompare(cb, undefined, { numeric: true });
        return cmp !== 0 ? cmp : a.index - b.index;
      })
      .map((entry) => entry.item);

    for (const item of orderedItems) {
      // Guard against null/undefined entries that can arrive from the estimate
      // import path (apiFetch returns null on empty-body responses).
      if (!item) continue;
      if (item.is_group_header) continue;
      const divCode = getDivCode(item);
      if (divCode !== lastDiv) {
        rows.push({ type: "division", code: divCode });
        lastDiv = divCode;
      }
      rows.push({ type: "item", item, divCode });
    }
    return rows;
   
  }, [displayedSovItems, budgetCodes]);

  const renderDateOrDash = (value: string | null | undefined) =>
    value ? formatDate(value) : null;
  const descriptionValue = getTextValue(contract.description);
  const saveNullableDate = (field: string) => (value: string) =>
    onSaveContractField(field, value || null);
  const relationshipOptions = [
    { value: EMPTY_RELATION_VALUE, label: "None" },
    ...companyOptions,
  ];

  return (
    <ContentSectionStack className="space-y-16 pb-20">
      <section>
        <div className="grid grid-cols-1 gap-16 lg:grid-cols-[minmax(0,1fr)_minmax(320px,400px)]">
          <div className="space-y-10">
            <DetailPanel>
              <SectionRuleHeading label="General Information" />
              <DetailFieldGrid columns={2}>
                <EditableDetailField
                  label="Contract #"
                  value={contract.contract_number ?? ""}
                  onSave={(value) => onSaveContractField("contract_number", value)}
                />
                <EditableDetailField
                  label="Title"
                  value={contract.title ?? ""}
                  onSave={(value) => onSaveContractField("title", value)}
                />
                <EditableDetailField
                  label="Status"
                  type="select"
                  value={contract.status ?? "draft"}
                  display={formatStatusLabel(contract.status)}
                  options={CONTRACT_STATUS_OPTIONS}
                  onSave={(value) => onSaveContractField("status", value)}
                />
                <EditableDetailField
                  label="Executed"
                  type="boolean"
                  value={String(Boolean(contract.executed))}
                  display={contract.executed ? formatDate(contract.executed_at) || "Yes" : "No"}
                  onSave={(value) => onSaveContractField("executed", value === "true")}
                />
                <DetailField label="Owner/Client">
                  {ownerName && (contract.contract_company?.id || contract.client?.id) ? (
                      <Link
                        href={`/directory/vendors/${contract.contract_company?.id || contract.client?.id}`}
                        className="text-primary underline underline-offset-2 hover:text-primary/90"
                      >
                        {ownerName}
                      </Link>
                    ) : ownerName}
                </DetailField>
                <EditableDetailField
                  label="Contractor"
                  type="select"
                  value={contract.contractor_id || EMPTY_RELATION_VALUE}
                  display={contract.contractor?.name || undefined}
                  options={relationshipOptions}
                  onSave={(value) =>
                    onSaveContractField(
                      "contractor_id",
                      value === EMPTY_RELATION_VALUE ? null : value,
                    )
                  }
                />
                <EditableDetailField
                  label="Architect"
                  type="select"
                  value={contract.architect_engineer_id || EMPTY_RELATION_VALUE}
                  display={contract.architect_engineer?.name || undefined}
                  options={relationshipOptions}
                  onSave={(value) =>
                    onSaveContractField(
                      "architect_engineer_id",
                      value === EMPTY_RELATION_VALUE ? null : value,
                    )
                  }
                />
                <EditableDetailField
                  label="Start Date"
                  type="date"
                  value={toDateInputValue(contract.start_date)}
                  display={renderDateOrDash(contract.start_date)}
                  onSave={saveNullableDate("start_date")}
                />
                <EditableDetailField
                  label="Est. Completion"
                  editLabel="Estimated Completion"
                  type="date"
                  value={toDateInputValue(contract.end_date)}
                  display={renderDateOrDash(contract.end_date)}
                  onSave={saveNullableDate("end_date")}
                />
                <EditableDetailField
                  label="Substantial Date"
                  type="date"
                  value={toDateInputValue(contract.substantial_completion_date)}
                  display={renderDateOrDash(contract.substantial_completion_date)}
                  onSave={saveNullableDate("substantial_completion_date")}
                />
                <EditableDetailField
                  label="Actual Completion"
                  type="date"
                  value={toDateInputValue(contract.actual_completion_date)}
                  display={renderDateOrDash(contract.actual_completion_date)}
                  onSave={saveNullableDate("actual_completion_date")}
                />
                <EditableDetailField
                  label="Signed Date"
                  type="date"
                  value={toDateInputValue(contract.signed_contract_received_date)}
                  display={renderDateOrDash(contract.signed_contract_received_date)}
                  onSave={saveNullableDate("signed_contract_received_date")}
                />
                <EditableDetailField
                  label="Termination Date"
                  type="date"
                  value={toDateInputValue(contract.contract_termination_date)}
                  display={renderDateOrDash(contract.contract_termination_date)}
                  onSave={saveNullableDate("contract_termination_date")}
                />
                <EditableDetailField
                  label="Default Retainage"
                  type="number"
                  value={String(contract.retention_percentage ?? 0)}
                  display={`${contract.retention_percentage ?? 0}%`}
                  onSave={(value) => onSaveContractField("retention_percentage", Number(value || 0))}
                />
                <EditableDetailField
                  label="Description"
                  span={2}
                  type="textarea"
                  value={descriptionValue.isMissing ? "" : descriptionValue.text}
                  display={descriptionValue.isMissing ? undefined : <span className="whitespace-pre-wrap text-sm leading-relaxed">{descriptionValue.text}</span>}
                  onSave={(value) => onSaveContractField("description", value || null)}
                />
                <DetailField label="Attachments" span={2}>
                  <div className="max-w-sm">
                    <EntityAttachments
                      entityType="prime_contract"
                      entityId={String(contract.id)}
                      projectId={projectId}
                      showLabel={false}
                    />
                  </div>
                </DetailField>
              </DetailFieldGrid>
            </DetailPanel>

            <DetailPanel>
              <Collapsible defaultOpen>
                <SectionRuleHeading
                  label="Inclusions + Exclusions"
                  actions={
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs text-primary">
                        <ChevronDown className="h-3.5 w-3.5 transition-transform [[data-state=closed]_&]:rotate-[-90deg]" />
                      </Button>
                    </CollapsibleTrigger>
                  }
                />
                <CollapsibleContent>
                  <div className="space-y-6 text-sm">
                    <div className="flex flex-col gap-1.5">
                      <p className="text-xs text-muted-foreground">Inclusions</p>
                      <div className="font-normal leading-relaxed text-foreground">
                        <InlineEditField
                          label="Inclusions"
                          type="textarea"
                          className="font-normal"
                          value={contract.inclusions ?? ""}
                          display={inclusionsList.length === 0 ? undefined : inclusionsList.join("\n")}
                          onSave={(value) => onSaveContractField("inclusions", value || null)}
                        />
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <p className="text-xs text-muted-foreground">Exclusions</p>
                      <div className="font-normal leading-relaxed text-foreground">
                        <InlineEditField
                          label="Exclusions"
                          type="textarea"
                          className="font-normal"
                          value={contract.exclusions ?? ""}
                          display={exclusionsList.length === 0 ? undefined : exclusionsList.join("\n")}
                          onSave={(value) => onSaveContractField("exclusions", value || null)}
                        />
                      </div>
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </DetailPanel>

            <DetailPanel>
              {financialMarkupSection}
            </DetailPanel>
          </div>

          <aside>
            <SummaryPanel>
              <SectionRuleHeading label="Financial Summary" />
              <div className="space-y-3 text-sm">
                <SummaryValueRow label="Original Amount" value={formatCurrency(originalContractAmount)} />
                <SummaryValueRow label="Revised Amount" value={formatCurrency(revisedContractAmount)} />
                <SummaryValueRow label="Pending Amount" value={formatCurrency(pendingRevisedContractAmount)} />
                <SummaryValueRow label="Pending COs" value={formatCurrency(pendingChangeOrdersTotal)} />
                <SummaryValueRow label="Approved COs" value={formatCurrency(approvedChangeOrdersTotal)} />
                <SummaryValueRow label="Draft COs" value={formatCurrency(draftChangeOrdersTotal)} />
                <SummaryValueRow label="Invoices" value={formatCurrency(invoicesTotal)} />
                <SummaryValueRow label="Payments" value={formatCurrency(paymentsReceivedTotal)} />
                <SummaryValueRow label="Balance" value={formatCurrency(remainingBalanceTotal)} />
                <SummaryValueRow label="Percent Paid" value={formatPercent(percentPaid, 2)} bold border />
              </div>
            </SummaryPanel>
          </aside>
        </div>
      </section>

      {/* ─── Schedule of Values ─── */}
      <section>
        <SectionRuleHeading
          label="Schedule of Values"
          actions={
            isSovEditing ? (
              <>
                {addSovAction}
                <Button variant="ghost" size="sm" onClick={onCancelSovEdit}>
                  Cancel
                </Button>
                <Button size="sm" onClick={onSaveSovEdit} disabled={isSavingSovChanges}>
                  {isSavingSovChanges ? "Saving..." : "Save"}
                </Button>
              </>
            ) : (
              addSovAction
            )
          }
        />

        <div className="space-y-4">
          {isSovEditing && (
            <div className="rounded-md border border-border bg-muted/60 p-4 text-sm">
              <p className="font-semibold">Any changes will only apply to future invoices</p>
              <p className="text-muted-foreground">Existing invoices will not be affected.</p>
            </div>
          )}

          {lineItemsLoading ? (
            <EmptyState
              icon={<Rows3 />}
              title="Loading schedule of values"
              description="Please wait while we load line items."
              className="py-8"
            />
          ) : displayedSovItems.length === 0 ? (
            <EmptyState
              icon={<FileText />}
              title="No SOV lines yet"
              description="Add SOV lines with budget codes to track the contract value."
            />
          ) : isSovEditing ? (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={sortableIds}
                strategy={verticalListSortingStrategy}
              >
                <InlineTable variant="edit">
                    <InlineTableHeader>
                      <InlineTableHeaderRow>
                        <InlineTableHeaderCell className="w-10" />
                        <InlineTableHeaderCell className="min-w-64">
                          Cost Code
                        </InlineTableHeaderCell>
                        <InlineTableHeaderCell className="w-28">
                          Cost Type
                        </InlineTableHeaderCell>
                        <InlineTableHeaderCell className="min-w-64">
                          Description
                        </InlineTableHeaderCell>
                        <InlineTableHeaderCell align="right" className="w-20">
                          Qty
                        </InlineTableHeaderCell>
                        <InlineTableHeaderCell className="w-16">
                          UOM
                        </InlineTableHeaderCell>
                        <InlineTableHeaderCell align="right" className="w-40">
                          Amount
                        </InlineTableHeaderCell>
                        <InlineTableHeaderCell align="right" className="w-40">
                          Bill to Date
                        </InlineTableHeaderCell>
                        <InlineTableHeaderCell align="right" className="w-40">
                          Amount Remaining
                        </InlineTableHeaderCell>
                        <InlineTableHeaderCell className="w-24" />
                      </InlineTableHeaderRow>
                    </InlineTableHeader>
                    <InlineTableBody>
                      {displayedSovItems.map((item) => {
                        if (!item) return null;
                        if (item.is_group_header) {
                          return (
                            <SortableSovRow
                              key={item.id}
                              id={item.id}
                              className="border-b border-border/60 bg-muted/40 hover:bg-muted/50"
                            >
                              {({ attributes, listeners }) => (
                                <>
                              <InlineTableCell className="w-10 px-1 py-1">
                                <div
                                  className="mt-1 cursor-grab rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted active:cursor-grabbing"
                                  {...attributes}
                                  {...listeners}
                                >
                                  <GripVertical className="h-4 w-4" />
                                </div>
                              </InlineTableCell>
                              <InlineTableCell colSpan={8} className="px-1 py-1">
                                {isSovEditing ? (
                                  <Input
                                    value={item.group_name || item.description || ""}
                                    onChange={(e) =>
                                      onUpdateSovLine(item.id, { description: e.target.value })
                                    }
                                    placeholder="Group name..."
                                    className="h-8 font-semibold"
                                  />
                                ) : (
                                  <span className="text-sm font-semibold text-foreground">
                                    {item.group_name || item.description || "Unnamed Group"}
                                  </span>
                                )}
                              </InlineTableCell>
                              <InlineTableCell className="w-24 px-1 py-1">
                                {isSovEditing && (
                                  <div className="flex justify-end">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                                      onClick={() => onRemoveSovLine(item.id)}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                )}
                              </InlineTableCell>
                                </>
                              )}
                            </SortableSovRow>
                          );
                        }

                        const lineTotal =
                          (Number(item.quantity) || 0) * (Number(item.unit_cost) || 0);
                        const lineBilledToDate = lineTotal * billedToDateRatio;
                        const lineAmountRemaining = lineTotal - lineBilledToDate;
                        const budgetCodeResolution = resolveContractLineBudgetCode(item, budgetCodes);
                        const selectedBudgetCodeId =
                          (isSovEditing ? sovDraftBudgetCodeIds[item.id] : undefined) ||
                          budgetCodeResolution.budgetCodeId;
                        const selectedBudgetCode = budgetCodes.find(
                          (code) => code.id === selectedBudgetCodeId,
                        );

                        return (
                          <SortableSovRow
                            key={item.id}
                            id={item.id}
                            className="group border-b border-border/60 bg-background transition-colors hover:bg-muted/20"
                          >
                            {({ attributes, listeners }) => (
                              <>
                            <InlineTableCell className="w-10 px-1 py-1 align-top">
                              <div
                                className="mt-1 cursor-grab rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted active:cursor-grabbing"
                                {...attributes}
                                {...listeners}
                                aria-label="Drag to reorder line item"
                              >
                                <GripVertical className="h-4 w-4" />
                              </div>
                            </InlineTableCell>
                            <InlineTableCell className="min-w-64 px-1 py-1 align-top">
                              {isSovEditing ? (
                                <ProjectCostCodeSelector
                                  value={selectedBudgetCodeId}
                                  onValueChange={(code) =>
                                    onUpdateSovLineBudgetCode(item.id, code.id)
                                  }
                                  budgetCodes={budgetCodes}
                                  onCreateNew={() => onRequestCreateBudgetCode(item.id)}
                                  placeholder="Select cost code..."
                                  ariaLabel={`Cost Code for line item ${item.line_number}`}
                                />
                              ) : (
                                <span className="text-xs font-medium leading-tight">
                                  {budgetCodeResolution.displayDescription
                                    ? `${budgetCodeResolution.displayCode} - ${budgetCodeResolution.displayDescription}`
                                    : budgetCodeResolution.displayCode}
                                </span>
                              )}
                            </InlineTableCell>
                            <InlineTableCell className="w-28 px-1 py-1 align-top">
                              {isSovEditing ? (
                                <ProjectCostTypeSelector
                                  value={selectedBudgetCodeId}
                                  onValueChange={(code) =>
                                    onUpdateSovLineBudgetCode(item.id, code.id)
                                  }
                                  budgetCodes={budgetCodes}
                                  ariaLabel={`Cost Type for line item ${item.line_number}`}
                                />
                              ) : (
                                <span className="text-xs text-muted-foreground">
                                  {selectedBudgetCode?.costType ||
                                    budgetCodeResolution.displayCostType ||
                                    "Needs link"}
                                </span>
                              )}
                            </InlineTableCell>
                            <InlineTableCell className="min-w-64 px-1 py-1 align-top">
                              {isSovEditing ? (
                                <Input
                                  value={item.description || ""}
                                  onChange={(event) =>
                                    onUpdateSovLine(item.id, {
                                      description: event.target.value,
                                    })
                                  }
                                  placeholder="Enter description"
                                />
                              ) : (
                                <div className="pt-2 text-xs leading-tight">{item.description || "--"}</div>
                              )}
                            </InlineTableCell>
                            <InlineTableCell align="right" className="w-20 px-1 py-1 align-top">
                              {isSovEditing ? (
                                <Input
                                  type="number"
                                  min="0"
                                  step="1"
                                  className="h-10 text-right"
                                  placeholder="1"
                                  value={item.quantity ?? ""}
                                  onChange={(e) =>
                                    onUpdateSovLine(item.id, {
                                      quantity: e.target.value === "" ? undefined : Number(e.target.value),
                                    })
                                  }
                                />
                              ) : (
                                <div className="pt-2 text-right text-xs tabular-nums">
                                  {item.quantity ?? 1}
                                </div>
                              )}
                            </InlineTableCell>
                            <InlineTableCell className="w-16 px-1 py-1 align-top">
                              {isSovEditing ? (
                                <Input
                                  className="h-10"
                                  placeholder="EA"
                                  value={item.unit_of_measure ?? ""}
                                  onChange={(e) =>
                                    onUpdateSovLine(item.id, {
                                      unit_of_measure: e.target.value || null,
                                    })
                                  }
                                />
                              ) : (
                                <div className="pt-2 text-xs text-muted-foreground">
                                  {item.unit_of_measure || "EA"}
                                </div>
                              )}
                            </InlineTableCell>
                            <InlineTableCell align="right" className="w-40 px-1 py-1 align-top">
                              {isSovEditing ? (
                                <MoneyField
                                  inline
                                  label="Amount"
                                  value={lineTotal === 0 ? undefined : lineTotal}
                                  onChange={(val) => {
                                    if (val === undefined || val === 0) {
                                      onUpdateSovLine(item.id, { unit_cost: 0 });
                                      return;
                                    }
                                    const quantity = Number(item.quantity);
                                    const normalizedQuantity =
                                      quantity > 0 ? quantity : 1;
                                    onUpdateSovLine(item.id, {
                                      quantity: normalizedQuantity,
                                      unit_cost: val / normalizedQuantity,
                                    });
                                  }}
                                  showCurrency={false}
                                  className="h-10"
                                />
                              ) : (
                                <div className="pt-2 text-right text-xs tabular-nums">
                                  {formatCurrency(lineTotal)}
                                </div>
                              )}
                            </InlineTableCell>
                            <InlineTableCell align="right" className="w-40 px-1 py-1 align-top">
                              <div className="pt-2 text-right text-xs tabular-nums">
                                {formatCurrency(lineBilledToDate)}
                              </div>
                            </InlineTableCell>
                            <InlineTableCell align="right" className="w-40 px-1 py-1 align-top">
                              <div className="pt-2 text-right text-xs font-semibold tabular-nums">
                                {formatCurrency(lineAmountRemaining)}
                              </div>
                            </InlineTableCell>
                            <InlineTableCell className="w-24 px-1 py-1 align-top">
                              {isSovEditing ? (
                                <div className="flex justify-end">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                                    onClick={() => onRemoveSovLine(item.id)}
                                    aria-label={`Remove line item ${item.line_number}`}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              ) : (
                                <div className="flex justify-end">
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-8 w-8 p-0 text-muted-foreground"
                                        aria-label={`Actions for line item ${item.line_number}`}
                                      >
                                        <MoreVertical />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                      <DropdownMenuItem onClick={onStartSovEdit}>
                                        Edit
                                      </DropdownMenuItem>
                                      {onDeleteSovLine && (
                                        <DropdownMenuItem
                                          className="text-destructive focus:text-destructive"
                                          onClick={() => onDeleteSovLine(item.id)}
                                        >
                                          Delete
                                        </DropdownMenuItem>
                                      )}
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </div>
                              )}
                            </InlineTableCell>
                              </>
                            )}
                          </SortableSovRow>
                        );
                      })}
                    </InlineTableBody>
                    <tbody aria-label="Schedule of Values summary">
                      <SovSummaryFooterRows
                        summary={sovSummary}
                        formatCurrency={formatCurrency}
                        labelColSpan={8}
                      />
                    </tbody>
                  </InlineTable>
              </SortableContext>
            </DndContext>
          ) : (
              <InlineTable>
                <InlineTableHeader>
                  <InlineTableHeaderRow>
                    <InlineTableHeaderCell className="w-10" />
                    <InlineTableHeaderCell className="min-w-64">
                      Cost Code
                    </InlineTableHeaderCell>
                    <InlineTableHeaderCell className="w-28">
                      Cost Type
                    </InlineTableHeaderCell>
                    <InlineTableHeaderCell className="min-w-64">
                      Description
                    </InlineTableHeaderCell>
                    <InlineTableHeaderCell align="right" className="w-40">
                      Amount
                    </InlineTableHeaderCell>
                    <InlineTableHeaderCell align="right" className="w-40">
                      Bill to Date
                    </InlineTableHeaderCell>
                    <InlineTableHeaderCell align="right" className="w-40">
                      Amount Remaining
                    </InlineTableHeaderCell>
                    <InlineTableHeaderCell className="w-24" />
                  </InlineTableHeaderRow>
                </InlineTableHeader>
                <InlineTableBody>
                  {viewModeRows.map((row) => {
                    if (row.type === "division") {
                      const isCollapsed = collapsedDivisions.has(row.code);
                      return (
                        <tr
                          key={`div-${row.code}`}
                          className="border-b border-border/60 bg-muted/40"
                        >
                          <td className="w-10 px-1 py-2">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-muted-foreground hover:bg-muted"
                              onClick={() =>
                                setCollapsedDivisions((prev) => {
                                  const next = new Set(prev);
                                  if (next.has(row.code)) next.delete(row.code);
                                  else next.add(row.code);
                                  return next;
                                })
                              }
                            >
                              {isCollapsed ? (
                                <ChevronRight className="h-3.5 w-3.5" />
                              ) : (
                                <ChevronDown className="h-3.5 w-3.5" />
                              )}
                            </Button>
                          </td>
                          <td colSpan={5} className="px-1 py-2">
                            <span className="text-xs font-semibold text-foreground">
                              {row.code} {DIVISION_NAMES[row.code] ?? `Division ${row.code}`}
                            </span>
                          </td>
                          <td className="px-1 py-2 text-right">
                            <span className="text-xs font-semibold tabular-nums">
                              {formatCurrency(divisionTotals[row.code] ?? 0)}
                            </span>
                          </td>
                          <td />
                        </tr>
                      );
                    }

                    if (row.type === "subtotal") {
                      if (collapsedDivisions.has(row.divCode)) return null;
                      const subtotalBilled = row.amount * billedToDateRatio;
                      return (
                        <tr
                          key={row.key}
                          className="border-y border-border bg-muted/20"
                        >
                          <td className="w-10 px-1 py-1" />
                          <td
                            colSpan={3}
                            className="px-1 py-2 text-xs font-semibold text-muted-foreground"
                          >
                            {row.label}
                          </td>
                          <td className="w-40 px-1 py-2 text-right text-xs font-semibold tabular-nums">
                            {formatCurrency(row.amount)}
                          </td>
                          <td className="w-40 px-1 py-2 text-right text-xs font-medium tabular-nums text-muted-foreground">
                            {formatCurrency(subtotalBilled)}
                          </td>
                          <td className="w-40 px-1 py-2 text-right text-xs font-semibold tabular-nums">
                            {formatCurrency(row.amount - subtotalBilled)}
                          </td>
                          <td className="w-24 px-1 py-1" />
                        </tr>
                      );
                    }

                    // Exhaustive guard: only "item" rows reach this point.
                    // Without this check, a future union extension (or a null
                    // entry slipping through viewModeRows construction) would
                    // silently make `item` undefined and crash on `.markup_type`.
                    if (row.type !== "item") return null;
                    const { item, divCode } = row;
                    if (collapsedDivisions.has(divCode)) return null;

                    const budgetCodeResolution = resolveContractLineBudgetCode(item, budgetCodes);
                    const lineTotal = getLineTotal(item);
                    const lineBilledToDate = lineTotal * billedToDateRatio;

                    return (
                      <tr
                        key={item.id}
                        className="border-b border-border/60 bg-background transition-colors hover:bg-muted/20"
                      >
                        <td className="w-10 px-1 py-1" />
                        <td className="min-w-72 px-1 py-1 align-top">
                          <span className="text-xs font-medium leading-tight">
                            {budgetCodeResolution.displayDescription
                              ? `${budgetCodeResolution.displayCode} - ${budgetCodeResolution.displayDescription}`
                              : budgetCodeResolution.displayCode}
                          </span>
                        </td>
                        <td className="w-28 px-1 py-1 align-top">
                          <span className="text-xs text-muted-foreground">
                            {budgetCodeResolution.displayCostType ||
                              "Needs link"}
                          </span>
                        </td>
                        <td className="min-w-64 px-1 py-1 align-top">
                          <div className="pt-2 text-xs leading-tight">
                            {item.description || "--"}
                          </div>
                        </td>
                        <td className="w-40 px-1 py-1 align-top text-right">
                          <div className="pt-2 text-xs tabular-nums">
                            {formatCurrency(lineTotal)}
                          </div>
                        </td>
                        <td className="w-40 px-1 py-1 align-top text-right">
                          <div className="pt-2 text-xs tabular-nums">
                            {formatCurrency(lineBilledToDate)}
                          </div>
                        </td>
                        <td className="w-40 px-1 py-1 align-top text-right">
                          <div className="pt-2 text-xs font-semibold tabular-nums">
                            {formatCurrency(lineTotal - lineBilledToDate)}
                          </div>
                        </td>
                        <td className="w-24 px-1 py-1 align-top">
                          <div className="flex justify-end">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0 text-muted-foreground"
                                  aria-label={`Actions for line item ${item.line_number}`}
                                >
                                  <MoreVertical />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={onStartSovEdit}>
                                  Edit
                                </DropdownMenuItem>
                                {onDeleteSovLine && (
                                  <DropdownMenuItem
                                    className="text-destructive focus:text-destructive"
                                    onClick={() => onDeleteSovLine(item.id)}
                                  >
                                    Delete
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </InlineTableBody>
                <tbody aria-label="Schedule of Values summary">
                  <SovSummaryFooterRows
                    summary={sovSummary}
                    formatCurrency={formatCurrency}
                    labelColSpan={6}
                  />
                </tbody>
              </InlineTable>
          )}

        </div>
      </section>
    </ContentSectionStack>
  );
}

interface SortableSovRowProps {
  id: string;
  className?: string;
  children: (dragHandle: {
    attributes: ReturnType<typeof useSortable>["attributes"];
    listeners: ReturnType<typeof useSortable>["listeners"];
  }) => ReactNode;
}

function SortableSovRow({ id, className, children }: SortableSovRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className={`border-b border-border/60 group transition-colors hover:bg-muted/30${isDragging ? " opacity-80 bg-muted/30" : ""}${className ? ` ${className}` : ""}`}
    >
      {children({ attributes, listeners })}
    </tr>
  );
}
