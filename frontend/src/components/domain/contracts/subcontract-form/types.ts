import type { SovLineItem } from "@/lib/schemas/create-subcontract-schema";

export interface BudgetCode {
  id: string;
  code: string;
  costCodeId?: string | null;
  costType: string | null;
  costTypeId?: string | null;
  description: string;
  fullLabel: string;
}

export interface VendorOption {
  value: string;
  label: string;
  companyId: string | null;
}

export const UNIT_OF_MEASURES = [
  { value: "EA", label: "Each" },
  { value: "LS", label: "Lump Sum" },
  { value: "LF", label: "Linear Foot" },
  { value: "SF", label: "Square Foot" },
  { value: "CY", label: "Cubic Yard" },
  { value: "HR", label: "Hour" },
  { value: "TON", label: "Ton" },
  { value: "GAL", label: "Gallon" },
  { value: "LB", label: "Pound" },
] as const;

export const COST_TYPE_LABELS: Record<string, string> = {
  R: "Contract Revenue",
  E: "Equipment",
  X: "Expense",
  L: "Labor",
  M: "Material",
  S: "Subcontract",
};

export interface AttachmentItem {
  name: string;
  size: number;
  type: string;
  url?: string;
}

export interface SovTotals {
  amount: number;
  billedToDate: number;
  amountRemaining: number;
}

export function calculateSOVTotals(sovLines: SovLineItem[]): SovTotals {
  const totals = sovLines.reduce(
    (acc, line) => {
      if (line.isGroup) return acc;
      const lineAmount = line.amount || 0;
      const lineBilled = line.billedToDate || 0;
      return {
        amount: acc.amount + lineAmount,
        billedToDate: acc.billedToDate + lineBilled,
      };
    },
    { amount: 0, billedToDate: 0 },
  );
  return {
    ...totals,
    amountRemaining: totals.amount - totals.billedToDate,
  };
}
