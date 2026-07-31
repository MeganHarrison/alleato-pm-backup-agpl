"use client";

import { useState } from "react";
import { Plus, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { KpiRow, SectionHeader, EmptyState } from "@/components/ds";
import { Button } from "@/components/ui/button";
import {
  useFinancialAlerts,
  useScanPortfolio,
  useCrossReference,
  type CrossReferenceResult,
} from "@/hooks/use-financial-insights";
import { AlertsTable } from "@/components/financial-insights/alerts-table";
import { DiscrepancyTable } from "@/components/financial-insights/discrepancy-table";
import { ScanButton } from "@/components/financial-insights/scan-button";

export default function FinancialInsightsPage() {
  const [crossRefResult, setCrossRefResult] =
    useState<CrossReferenceResult | null>(null);

  // Alerts query
  const { data: alertsData, isLoading: alertsLoading } = useFinancialAlerts({
    status: "open",
    limit: 100,
  });

  // Scan mutation
  const scanMutation = useScanPortfolio();

  // Cross-reference mutation
  const crossRefMutation = useCrossReference();

  const alerts = alertsData?.alerts ?? [];

  // Compute KPI values
  const totalAlerts = alerts.length;
  const criticalCount = alerts.filter(
    (a) => a.severity === "critical",
  ).length;
  const warningCount = alerts.filter(
    (a) => a.severity === "warning",
  ).length;
  const totalImpact = alerts.reduce(
    (sum, a) => sum + (a.financial_impact ?? 0),
    0,
  );

  const handleScan = async () => {
    try {
      const result = await scanMutation.mutateAsync();
      toast.success(
        `Scan complete: ${result.scanned} projects scanned, ${result.alertsGenerated} alerts generated`,
      );
      if (result.errors.length > 0) {
        toast.warning(
          `${result.errors.length} project(s) had errors during scan`,
        );
      }
    } catch {
      toast.error("Portfolio scan failed. Check server logs.");
    }
  };

  const handleCrossReference = async (projectId: number) => {
    try {
      const result = await crossRefMutation.mutateAsync({ projectId });
      setCrossRefResult(result);
    } catch (err) {
      toast.error("Cross-reference failed");
    }
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(value);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Financial Insights
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Cross-reference Alleato and Acumatica data to detect budget
            discrepancies, overruns, and financial red flags.
          </p>
        </div>
        <ScanButton
          onScan={handleScan}
          isScanning={scanMutation.isPending}
          lastScanResult={scanMutation.data ?? null}
        />
      </div>

      {/* KPI Row */}
      <KpiRow
        metrics={[
          {
            label: "Total Alerts",
            value: String(totalAlerts),
          },
          {
            label: "Critical",
            value: String(criticalCount),
            context: criticalCount > 0 ? "Requires immediate attention" : undefined,
          },
          {
            label: "Warnings",
            value: String(warningCount),
            context: warningCount > 0 ? "Review recommended" : undefined,
          },
          {
            label: "Total Financial Impact",
            value: formatCurrency(totalImpact),
            context:
              totalImpact > 100000
                ? "Significant exposure"
                : totalImpact > 0
                  ? "Monitor closely"
                  : undefined,
          },
        ]}
      />

      {/* Alerts Table */}
      <div>
        <SectionHeader title="Active Alerts" count={totalAlerts} />
        {totalAlerts === 0 && !alertsLoading ? (
          <EmptyState
            icon={
              <ShieldCheck className="h-5 w-5 text-muted-foreground" />
            }
            title="No financial alerts"
            description="Run a portfolio scan to detect budget discrepancies and financial red flags across your projects."
            action={
              <Button size="sm" variant="outline" onClick={handleScan}>
                <Plus />
                Run First Scan
              </Button>
            }
          />
        ) : (
          <AlertsTable
            alerts={alerts}
            isLoading={alertsLoading}
            onCrossReference={handleCrossReference}
          />
        )}
      </div>

      {/* Cross-Reference Detail */}
      {(crossRefResult || crossRefMutation.isPending) && (
        <div>
          <SectionHeader
            title={
              crossRefResult
                ? `Budget Cross-Reference — ${crossRefResult.project.name}`
                : "Budget Cross-Reference"
            }
          />
          <DiscrepancyTable
            data={crossRefResult}
            isLoading={crossRefMutation.isPending}
          />
        </div>
      )}
    </div>
  );
}
