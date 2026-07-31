export interface FilenameInput {
  project_name: string | null;
  project_number: string | null;
  application_number: number;
}

export interface ContinuationLineItem {
  sort_order: number | null;
  budget_code: string | null;
  description: string | null;
  work_completed_previous: number | null;
  work_completed_period: number | null;
  materials_stored: number | null;
  total_completed_stored: number | null;
  retainage_amount: number | null;
  materials_retainage_amount: number | null;
}

export interface ContinuationContractLine {
  line_number: number | null;
  sort_order: number | null;
  budget_code: string | null;
  description: string | null;
  amount: number | null;
}

export interface ContinuationChangeOrder {
  change_order_number: string | null;
  title: string | null;
  description: string | null;
  amount: number | null;
}

export interface ContinuationRow {
  itemNo: string;
  budgetCode: string;
  description: string;
  scheduledValue: number;
  previousWork: number;
  thisPeriodWork: number;
  materialsStored: number;
  totalCompletedStored: number;
  percentComplete: number;
  balanceToFinish: number;
  retainage: number;
}

export interface ContinuationSections {
  contractRows: ContinuationRow[];
  changeOrderRows: ContinuationRow[];
  grandTotals: ContinuationRow;
}

function safeText(value: string | null | undefined, blank = "—"): string {
  return value && value.trim() ? value.trim() : blank;
}

function lineSortValue(
  sortOrder: number | null | undefined,
  lineNumber: number | null | undefined,
): number {
  if (typeof sortOrder === "number") return sortOrder;
  if (typeof lineNumber === "number") return lineNumber;
  return Number.MAX_SAFE_INTEGER;
}

function lineKey(item: {
  sort_order?: number | null;
  budget_code?: string | null;
  description?: string | null;
}): string {
  return [
    item.sort_order ?? "",
    item.budget_code?.trim().toLowerCase() ?? "",
    item.description?.trim().toLowerCase() ?? "",
  ].join("|");
}

function computeRowFromInvoice(
  itemNo: string,
  budgetCode: string | null,
  description: string | null,
  scheduledValue: number,
  invoiceLine?: ContinuationLineItem,
): ContinuationRow {
  const previousWork = invoiceLine?.work_completed_previous ?? 0;
  const thisPeriodWork = invoiceLine?.work_completed_period ?? 0;
  const materialsStored = invoiceLine?.materials_stored ?? 0;
  const totalCompletedStored =
    invoiceLine?.total_completed_stored ??
    previousWork + thisPeriodWork + materialsStored;
  const retainage =
    (invoiceLine?.retainage_amount ?? 0) +
    (invoiceLine?.materials_retainage_amount ?? 0);
  const percentComplete =
    scheduledValue > 0 ? (totalCompletedStored / scheduledValue) * 100 : 0;

  return {
    itemNo,
    budgetCode: safeText(budgetCode, ""),
    description: safeText(description, ""),
    scheduledValue,
    previousWork,
    thisPeriodWork,
    materialsStored,
    totalCompletedStored,
    percentComplete,
    balanceToFinish: scheduledValue - totalCompletedStored,
    retainage,
  };
}

export function buildSubcontractorInvoicePdfFilename(
  data: FilenameInput,
  now: Date = new Date(),
): string {
  const projectNumber = (data.project_number || "project").replace(/\s+/g, "-");
  const projectName = (data.project_name || "Project")
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, "_");
  const sequence = data.application_number;
  const date = now.toISOString().split("T")[0];
  return `${projectNumber}-${projectName}-${sequence}-Invoice_${sequence}-${date}.pdf`;
}

export function buildContinuationSections(input: {
  line_items: ContinuationLineItem[];
  contract_lines?: ContinuationContractLine[];
  approved_change_orders?: ContinuationChangeOrder[];
}): ContinuationSections {
  const invoiceLines = [...input.line_items].sort(
    (a, b) => lineSortValue(a.sort_order, null) - lineSortValue(b.sort_order, null),
  );
  const lineByCompositeKey = new Map(invoiceLines.map((item) => [lineKey(item), item]));
  const lineByBudgetAndDescription = new Map(
    invoiceLines.map((item) => [
      [
        item.budget_code?.trim().toLowerCase() ?? "",
        item.description?.trim().toLowerCase() ?? "",
      ].join("|"),
      item,
    ]),
  );

  const contractRows = [...(input.contract_lines ?? [])]
    .sort(
      (a, b) =>
        lineSortValue(a.sort_order, a.line_number) -
        lineSortValue(b.sort_order, b.line_number),
    )
    .map((line, index) => {
      const invoiceLine =
        lineByCompositeKey.get(
          lineKey({
            sort_order: line.sort_order,
            budget_code: line.budget_code,
            description: line.description,
          }),
        ) ??
        lineByBudgetAndDescription.get(
          [
            line.budget_code?.trim().toLowerCase() ?? "",
            line.description?.trim().toLowerCase() ?? "",
          ].join("|"),
        );

      const fallbackLineNumber =
        typeof line.line_number === "number" ? line.line_number : index + 1;

      return computeRowFromInvoice(
        String(fallbackLineNumber),
        line.budget_code,
        line.description,
        line.amount ?? 0,
        invoiceLine,
      );
    });

  const changeOrderRows = [...(input.approved_change_orders ?? [])].map((co, index) =>
    computeRowFromInvoice(
      `${contractRows.length + index + 1}`,
      co.change_order_number,
      [co.title, co.description].filter(Boolean).join(" - "),
      co.amount ?? 0,
      undefined,
    ),
  );

  const grandTotals = [...contractRows, ...changeOrderRows].reduce<ContinuationRow>(
    (acc, row) => ({
      itemNo: "",
      budgetCode: "",
      description: "GRAND TOTALS:",
      scheduledValue: acc.scheduledValue + row.scheduledValue,
      previousWork: acc.previousWork + row.previousWork,
      thisPeriodWork: acc.thisPeriodWork + row.thisPeriodWork,
      materialsStored: acc.materialsStored + row.materialsStored,
      totalCompletedStored: acc.totalCompletedStored + row.totalCompletedStored,
      percentComplete: 0,
      balanceToFinish: acc.balanceToFinish + row.balanceToFinish,
      retainage: acc.retainage + row.retainage,
    }),
    {
      itemNo: "",
      budgetCode: "",
      description: "GRAND TOTALS:",
      scheduledValue: 0,
      previousWork: 0,
      thisPeriodWork: 0,
      materialsStored: 0,
      totalCompletedStored: 0,
      percentComplete: 0,
      balanceToFinish: 0,
      retainage: 0,
    },
  );

  grandTotals.percentComplete =
    grandTotals.scheduledValue > 0
      ? (grandTotals.totalCompletedStored / grandTotals.scheduledValue) * 100
      : 0;

  return { contractRows, changeOrderRows, grandTotals };
}
