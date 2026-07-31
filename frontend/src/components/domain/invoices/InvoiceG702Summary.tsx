"use client";

import { cn, formatCurrency } from "@/lib/utils";
import type {
  PaymentApplication,
  PaymentApplicationLineItem,
} from "@/app/(main)/[projectId]/prime-contracts/[contractId]/types";
import { SectionRuleHeading } from "@/components/layout/spacing";
import { computePrimePaymentApplication } from "@/lib/invoicing/payment-application";

interface ContractSummary {
  original_contract_value: number;
  revised_contract_value: number;
  title: string;
  contract_number: string | null;
  start_date: string | null;
}

interface InvoiceG702SummaryProps {
  invoice: PaymentApplication;
  lineItems: PaymentApplicationLineItem[];
  contract: ContractSummary;
  previousPaymentDue: number;
}

export function InvoiceG702Summary({
  lineItems,
  contract,
  previousPaymentDue,
}: InvoiceG702SummaryProps) {
  const { lines } = computePrimePaymentApplication({
    lineItems,
    contract,
    previousPaymentDue,
  });

  return (
    <div className="space-y-3">
      <SectionRuleHeading label="AIA G702 — Contractor's Application for Payment" />

      <div className="overflow-hidden rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted">
              <th className="px-4 py-2 text-left font-medium text-muted-foreground w-12">
                #
              </th>
              <th className="px-4 py-2 text-left font-medium text-muted-foreground">
                Description
              </th>
              <th className="px-4 py-2 text-right font-medium text-muted-foreground w-40">
                Amount
              </th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => (
              <tr
                key={line.number}
                className={cn(
                  "border-t border-border",
                  line.highlight && "bg-primary/5 font-semibold",
                )}
              >
                <td className="px-4 py-2 text-muted-foreground">
                  {line.number}
                </td>
                <td
                  className={cn(
                    "px-4 py-2 text-foreground",
                    line.indent && "pl-8",
                  )}
                >
                  {line.label}
                </td>
                <td className="px-4 py-2 text-right text-foreground tabular-nums">
                  {formatCurrency(line.value)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
