import type { FilterConfig } from "@/components/tables/unified";

export type CostCodeDetailRow = {
  id: string;
  direct_cost_id: string;
  budget_code_id: string;
  budget_code: string;
  budget_description: string;
  division_label: string;
  date: string;
  vendor_name: string;
  employee_name: string | null;
  cost_type: string;
  invoice_number: string | null;
  status: string;
  description: string | null;
  amount: number;
  received_date: string | null;
};

export const DIRECT_COST_FILTERS: FilterConfig[] = [
  {
    id: "status",
    label: "Status",
    type: "select",
    options: [
      { value: "Draft", label: "Draft" },
      { value: "Pending", label: "Pending" },
      { value: "Revise and Resubmit", label: "Revise and Resubmit" },
      { value: "Approved", label: "Approved" },
    ],
  },
  {
    id: "costType",
    label: "Cost Type",
    type: "select",
    options: [
      { value: "Expense", label: "Expense" },
      { value: "Invoice", label: "Invoice" },
      { value: "Subcontractor Invoice", label: "Subcontractor Invoice" },
    ],
  },
  { id: "dateFrom", label: "Date From", type: "date" },
  { id: "dateTo", label: "Date To", type: "date" },
  { id: "minAmount", label: "Min Amount", type: "number", placeholder: "0.00" },
  { id: "maxAmount", label: "Max Amount", type: "number", placeholder: "100,000.00" },
];

export const SUMMARY_COLUMNS = [
  { id: "date", label: "Date", defaultVisible: true },
  { id: "vendor", label: "Vendor", defaultVisible: true },
  { id: "cost_type", label: "Type", defaultVisible: true },
  { id: "status", label: "Status", defaultVisible: true },
  { id: "total_amount", label: "Amount", defaultVisible: true },
  { id: "erp_status", label: "ERP Status", defaultVisible: true },
  { id: "received_date", label: "Received", defaultVisible: false },
  { id: "paid_date", label: "Paid", defaultVisible: false },
  { id: "description", label: "Description", defaultVisible: false },
];

export const COST_CODE_COLUMNS = [
  { id: "group", label: "", defaultVisible: true },
  { id: "date", label: "Date", defaultVisible: true },
  { id: "employee_name", label: "Employee", defaultVisible: true },
  { id: "vendor_name", label: "Vendor", defaultVisible: true },
  { id: "cost_type", label: "Type", defaultVisible: true },
  { id: "invoice_number", label: "Invoice #", defaultVisible: true },
  { id: "status", label: "Status", defaultVisible: true },
  { id: "description", label: "Description", defaultVisible: true },
  { id: "amount", label: "Amount", defaultVisible: true },
  { id: "received_date", label: "Received", defaultVisible: true },
];

export const DEFAULT_VISIBLE_COLUMNS = SUMMARY_COLUMNS.filter((column) => column.defaultVisible).map(
  (column) => column.id,
);

export const DEFAULT_COST_CODE_VISIBLE_COLUMNS = COST_CODE_COLUMNS.filter(
  (column) => column.defaultVisible,
).map((column) => column.id);

export function formatDate(value: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function formatAmount(value: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value ?? 0);
}

export function getStatusVariant(status: string): "default" | "secondary" | "outline" | "destructive" {
  if (status === "Approved") return "default";
  if (status === "Draft") return "secondary";
  if (status === "Revise and Resubmit") return "destructive";
  return "outline";
}

export function csvCell(value: unknown): string {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}
