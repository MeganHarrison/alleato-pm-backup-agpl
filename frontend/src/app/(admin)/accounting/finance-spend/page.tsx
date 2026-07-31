"use client";

import * as React from "react";
import { RefreshCw } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { PageShell } from "@/components/layout";
import { InfoAlert, KpiRow, StatusBadge } from "@/components/ds";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { apiFetch } from "@/lib/api-client";

type FinanceSpendCategory =
  | "audit_tax"
  | "controller_accounting_services"
  | "erp_accounting_software"
  | "payroll_timekeeping"
  | "finance_legal_compliance"
  | "other_finance_overhead";

type FinanceSpendBill = {
  id: number;
  referenceNbr: string;
  vendorId: string | null;
  vendorRef: string | null;
  date: string | null;
  month: string;
  status: string | null;
  description: string | null;
  amount: number;
  projectCode: string | null;
  category: FinanceSpendCategory | null;
  categoryLabel: string | null;
  confidence: number;
  classificationSource: string;
  included: boolean;
  exclusionReason: string | null;
  flags: string[];
};

type FinanceSpendRollup = {
  generatedAt: string;
  window: {
    startDate: string;
    endDate: string;
    months: string[];
  };
  totals: {
    includedSpend: number;
    includedBillCount: number;
    excludedBillCount: number;
    uncertainBillCount: number;
  };
  monthlyTotals: Array<{ month: string; total: number; billCount: number }>;
  monthlyByCategory: Array<{
    month: string;
    category: FinanceSpendCategory;
    categoryLabel: string;
    total: number;
    billCount: number;
  }>;
  monthlyByVendor: Array<{
    month: string;
    vendorId: string;
    total: number;
    billCount: number;
  }>;
  exceptions: FinanceSpendBill[];
  includedBills: FinanceSpendBill[];
};

type FinanceSpendClassificationRule = {
  id: string;
  rule_name: string;
  match_text: string;
  category: FinanceSpendCategory;
  priority: number;
  confidence: number;
  exclude: boolean;
  exclusion_reason: string | null;
  active: boolean;
  updated_at: string;
};

type FinanceSpendRulesResponse = {
  rules: FinanceSpendClassificationRule[];
  generatedAt: string;
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatCurrencyFull(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatMonth(value: string): string {
  if (value === "undated") return "Undated";
  const date = new Date(`${value}-01T00:00:00`);
  return date.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
}

function formatDate(value: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "-";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function categoryTotals(rollup: FinanceSpendRollup | null) {
  const totals = new Map<string, { categoryLabel: string; total: number; billCount: number }>();
  for (const row of rollup?.monthlyByCategory ?? []) {
    const current = totals.get(row.category) ?? {
      categoryLabel: row.categoryLabel,
      total: 0,
      billCount: 0,
    };
    current.total += row.total;
    current.billCount += row.billCount;
    totals.set(row.category, current);
  }
  return [...totals.values()].sort((a, b) => b.total - a.total);
}

function vendorTotals(rollup: FinanceSpendRollup | null) {
  const totals = new Map<string, { vendorId: string; total: number; billCount: number }>();
  for (const row of rollup?.monthlyByVendor ?? []) {
    const current = totals.get(row.vendorId) ?? {
      vendorId: row.vendorId,
      total: 0,
      billCount: 0,
    };
    current.total += row.total;
    current.billCount += row.billCount;
    totals.set(row.vendorId, current);
  }
  return [...totals.values()].sort((a, b) => b.total - a.total).slice(0, 12);
}

export default function FinanceSpendPage() {
  const [rollup, setRollup] = React.useState<FinanceSpendRollup | null>(null);
  const [rules, setRules] = React.useState<FinanceSpendClassificationRule[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [ruleSavingId, setRuleSavingId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const loadRollup = React.useCallback(() => {
    setIsLoading(true);
    setError(null);
    Promise.all([
      apiFetch<FinanceSpendRollup>("/api/accounting/finance-spend?months=12"),
      apiFetch<FinanceSpendRulesResponse>("/api/accounting/finance-spend/rules"),
    ])
      .then(([rollupResponse, rulesResponse]) => {
        setRollup(rollupResponse);
        setRules(rulesResponse.rules);
      })
      .catch((loadError: unknown) => {
        setError(loadError instanceof Error ? loadError.message : "Failed to load finance spend rollup.");
      })
      .finally(() => setIsLoading(false));
  }, []);

  React.useEffect(() => {
    loadRollup();
  }, [loadRollup]);

  const chartData = (rollup?.monthlyTotals ?? []).map((row) => ({
    ...row,
    label: formatMonth(row.month),
  }));
  const categories = categoryTotals(rollup);
  const vendors = vendorTotals(rollup);
  const disabledRules = rules.filter((rule) => !rule.active).length;

  async function updateRuleActive(rule: FinanceSpendClassificationRule, active: boolean) {
    const previous = rules;
    setRuleSavingId(rule.id);
    setError(null);
    setRules((current) =>
      current.map((item) => (item.id === rule.id ? { ...item, active } : item)),
    );

    try {
      const response = await apiFetch<{ rule: FinanceSpendClassificationRule }>(
        `/api/accounting/finance-spend/rules/${rule.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ active }),
        },
      );
      setRules((current) =>
        current.map((item) => (item.id === rule.id ? response.rule : item)),
      );
      loadRollup();
    } catch (ruleError) {
      setRules(previous);
      setError(ruleError instanceof Error ? ruleError.message : "Failed to update classification rule.");
    } finally {
      setRuleSavingId(null);
    }
  }

  return (
    <PageShell
      variant="dashboard"
      title="Finance Spend"
      description="Trailing 12-month accounting and finance overhead from classified Acumatica AP bills."
      actions={
        <Button variant="outline" size="sm" onClick={loadRollup} disabled={isLoading}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      }
    >
      <div className="space-y-8">
        {error && (
          <InfoAlert variant="error" role="alert">
            {error}
          </InfoAlert>
        )}

        <KpiRow
          metrics={[
            {
              label: "Included spend",
              value: rollup ? formatCurrency(rollup.totals.includedSpend) : "-",
              context: "After project/noise exclusions",
            },
            {
              label: "Included bills",
              value: String(rollup?.totals.includedBillCount ?? "-"),
              context: "Classified AP bills",
            },
            {
              label: "Excluded bills",
              value: String(rollup?.totals.excludedBillCount ?? "-"),
              context: "Project costs and accounting noise",
            },
            {
              label: "Needs review",
              value: String(rollup?.totals.uncertainBillCount ?? "-"),
              context: "Low confidence or flagged rows",
            },
            {
              label: "Rules disabled",
              value: String(disabledRules),
              context: "Held for human review",
            },
          ]}
        />

        <section className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Monthly total spend</h2>
            <p className="text-sm text-muted-foreground">
              {rollup
                ? `${rollup.window.startDate} through ${rollup.window.endDate}`
                : "Loading trailing 12-month window"}
            </p>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border/40" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis
                  tickFormatter={(value: number) => formatCurrency(value)}
                  tick={{ fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={72}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const row = payload[0]?.payload as { label: string; total: number; billCount: number };
                    return (
                      <div className="rounded-md border border-border bg-popover px-3 py-2 text-xs shadow-sm">
                        <div className="font-medium text-foreground">{row.label}</div>
                        <div className="tabular-nums text-foreground">{formatCurrencyFull(row.total)}</div>
                        <div className="text-muted-foreground">{row.billCount} bill(s)</div>
                      </div>
                    );
                  }}
                />
                <Bar dataKey="total" fill="hsl(var(--primary) / 0.75)" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-8 xl:grid-cols-2">
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-foreground">Spend by category</h2>
            <div className="overflow-hidden rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Category</th>
                    <th className="px-4 py-3 text-right font-medium">Spend</th>
                    <th className="px-4 py-3 text-right font-medium">Bills</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {categories.map((row) => (
                    <tr key={row.categoryLabel}>
                      <td className="px-4 py-3 font-medium text-foreground">{row.categoryLabel}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-foreground">
                        {formatCurrencyFull(row.total)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                        {row.billCount}
                      </td>
                    </tr>
                  ))}
                  {!isLoading && categories.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-4 py-6 text-center text-muted-foreground">
                        No classified finance spend found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-foreground">Spend by vendor</h2>
            <div className="overflow-hidden rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Vendor</th>
                    <th className="px-4 py-3 text-right font-medium">Spend</th>
                    <th className="px-4 py-3 text-right font-medium">Bills</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {vendors.map((row) => (
                    <tr key={row.vendorId}>
                      <td className="px-4 py-3 font-medium text-foreground">{row.vendorId}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-foreground">
                        {formatCurrencyFull(row.total)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                        {row.billCount}
                      </td>
                    </tr>
                  ))}
                  {!isLoading && vendors.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-4 py-6 text-center text-muted-foreground">
                        No classified vendor spend found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Classification rule review</h2>
            <p className="text-sm text-muted-foreground">
              Enable only rules that are specific enough to count as accounting or finance overhead.
            </p>
          </div>
          <div className="overflow-hidden rounded-lg border border-border">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Active</th>
                    <th className="px-4 py-3 text-left font-medium">Rule</th>
                    <th className="px-4 py-3 text-left font-medium">Match</th>
                    <th className="px-4 py-3 text-left font-medium">Category</th>
                    <th className="px-4 py-3 text-right font-medium">Confidence</th>
                    <th className="px-4 py-3 text-left font-medium">Review note</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rules.map((rule) => (
                    <tr key={rule.id}>
                      <td className="px-4 py-3">
                        <Switch
                          checked={rule.active}
                          disabled={ruleSavingId === rule.id}
                          aria-label={`${rule.active ? "Disable" : "Enable"} ${rule.rule_name}`}
                          onCheckedChange={(active) => updateRuleActive(rule, active)}
                        />
                      </td>
                      <td className="px-4 py-3 font-medium text-foreground">{rule.rule_name}</td>
                      <td className="px-4 py-3 font-mono text-xs text-foreground">{rule.match_text}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {rule.category.replace(/_/g, " ")}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-foreground">
                        {Math.round(Number(rule.confidence) * 100)}%
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {rule.exclusion_reason ?? (rule.active ? "Included in rollup" : "Disabled")}
                      </td>
                    </tr>
                  ))}
                  {!isLoading && rules.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">
                        No classification rules found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Exceptions and cleanup flags</h2>
            <p className="text-sm text-muted-foreground">
              Rows excluded from totals or marked for review by the classifier.
            </p>
          </div>
          <div className="overflow-hidden rounded-lg border border-border">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Bill</th>
                    <th className="px-4 py-3 text-left font-medium">Vendor</th>
                    <th className="px-4 py-3 text-left font-medium">Date</th>
                    <th className="px-4 py-3 text-left font-medium">Category</th>
                    <th className="px-4 py-3 text-right font-medium">Amount</th>
                    <th className="px-4 py-3 text-left font-medium">Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {(rollup?.exceptions ?? []).slice(0, 50).map((bill) => (
                    <tr key={`${bill.id}-${bill.exclusionReason ?? "flag"}`}>
                      <td className="px-4 py-3">
                        <div className="font-mono text-xs font-medium text-foreground">
                          {bill.referenceNbr}
                        </div>
                        <div className="mt-1 max-w-md text-xs text-muted-foreground">
                          {bill.description ?? "-"}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-foreground">{bill.vendorId ?? "-"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{formatDate(bill.date)}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {bill.categoryLabel ?? "Unclassified"}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-foreground">
                        {formatCurrencyFull(bill.amount)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="space-y-1">
                          <StatusBadge status={bill.exclusionReason ?? "review"} />
                          {bill.flags.map((flag) => (
                            <div key={flag} className="text-xs text-muted-foreground">
                              {flag}
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!isLoading && (rollup?.exceptions.length ?? 0) === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">
                        No finance spend exceptions found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>
    </PageShell>
  );
}
