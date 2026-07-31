"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Check, ArrowRight, RefreshCw, RotateCcw } from "lucide-react";

import {
  UnifiedTablePage,
  useUnifiedTableState,
  type FilterValue,
  type TableColumn,
} from "@/components/tables/unified";
import { DetailField, InfoAlert, StatusBadge } from "@/components/ds";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  centsToUsd,
  type ApBillCopy,
  type FindingKind,
  type FindingTier,
} from "@/lib/accounting/reconciliation";
import {
  useReconciliationFindings,
  useResolveFinding,
  useRunReconciliation,
  type ReconciliationFindingItem,
  type ReviewStatus,
} from "@/hooks/use-reconciliation-findings";
import {
  kindLabels,
  kindMeaning,
  reconciliationFilters,
  tierLabels,
} from "@/features/reconciliation/reconciliation-table-config";
import { buildAcumaticaApBillHref } from "@/lib/acumatica/ap-bill-url";

const ACUMATICA_BASE = "https://alleatogroup.acumatica.com";
const ACUMATICA_PROJECTS_URL = `${ACUMATICA_BASE}/Main?ScreenId=PM301000`;

function acumaticaBillUrl(copy: ApBillCopy): string {
  return buildAcumaticaApBillHref(copy.docType, copy.ref ?? "");
}

const tierVariant: Record<FindingTier, "error" | "warning" | "neutral"> = {
  HIGH: "error",
  MED: "warning",
  INFO: "neutral",
};

const statusVariant: Record<ReviewStatus, "success" | "info" | "neutral"> = {
  resolved: "success",
  reviewed: "info",
  open: "neutral",
};

const recordTypeLabels: Record<ReconciliationFindingItem["recordType"], string> = {
  budget_line: "Budget line",
  commitment_co: "Commitment CO",
  prime_co: "Prime CO",
  budget: "Budget",
  ap_bill: "AP bill",
};

// Each tab is a focused "job": one task, one view.
type ViewKey = "all" | "duplicates" | "onhold" | "sync";

const VIEW_KINDS: Record<ViewKey, FindingKind[] | null> = {
  all: null,
  duplicates: ["duplicate-ap-bill"],
  onhold: ["stale-on-hold-bill"],
  sync: [
    "unlinked-budget-line",
    "drift-budget-line",
    "value-mismatch-actuals",
    "unlinked-cco",
    "unlinked-pcco",
    "underwater-budget",
    "thin-margin",
    "billed-over-contract",
  ],
};

function tabLabel(view: ViewKey): string {
  return { all: "All findings", duplicates: "Duplicate bills", onhold: "On-hold bills", sync: "Sync issues" }[view];
}

const VIEW_HELP: Record<ViewKey, string> = {
  all: "Everything that disagrees between Job Planner and Acumatica. Use the tabs to focus on one job.",
  duplicates:
    "Vendors billed more than once for the same job in the same period. Open a row — it tells you which copy to keep and which to void in Acumatica.",
  onhold:
    "Subcontractor bills synced from Job Planner but never released in Acumatica. Work the oldest down; rows marked High are also duplicates.",
  sync: "Job Planner budget records that disagree with Acumatica — unlinked, drifted, or value-mismatched.",
};

function fmtDate(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function relativeDays(value: string | null): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "1 day ago";
  if (days < 60) return `${days} days ago`;
  return `${Math.floor(days / 30)} mo ago`;
}

const columns: TableColumn<ReconciliationFindingItem>[] = [
  {
    id: "project",
    label: "Project",
    alwaysVisible: true,
    sortable: true,
    sortValue: (f) => f.jpProjectName,
    csvValue: (f) => f.jpProjectName,
    render: (f) => <span className="font-medium">{f.jpProjectName}</span>,
  },
  {
    id: "costCode",
    label: "Cost code / record",
    defaultVisible: true,
    sortable: true,
    sortValue: (f) => f.costCodeLabel ?? f.recordRef,
    csvValue: (f) => f.costCodeLabel ?? recordTypeLabels[f.recordType],
    render: (f) =>
      f.costCodeLabel ? (
        <span>{f.costCodeLabel}</span>
      ) : (
        <span className="text-muted-foreground">{recordTypeLabels[f.recordType]}</span>
      ),
  },
  {
    id: "tier",
    label: "Confidence",
    defaultVisible: true,
    sortable: true,
    sortValue: (f) => ({ HIGH: 0, MED: 1, INFO: 2 })[f.tier],
    csvValue: (f) => tierLabels[f.tier],
    render: (f) => (
      <span className="inline-flex items-center gap-1">
        <StatusBadge status={tierLabels[f.tier]} variant={tierVariant[f.tier]} />
        {f.acumaticaChecked && <Check className="h-3.5 w-3.5 text-muted-foreground" />}
      </span>
    ),
  },
  {
    id: "kind",
    label: "Finding",
    defaultVisible: true,
    sortable: true,
    sortValue: (f) => f.kind,
    csvValue: (f) => kindLabels[f.kind],
    render: (f) => <span>{kindLabels[f.kind]}</span>,
  },
  {
    id: "status",
    label: "Status",
    defaultVisible: true,
    sortable: true,
    sortValue: (f) => f.reviewStatus,
    csvValue: (f) => f.reviewStatus,
    render: (f) =>
      f.reviewStatus === "open" ? (
        <span className="text-xs text-muted-foreground">Open</span>
      ) : (
        <StatusBadge
          status={f.reviewStatus === "resolved" ? "Resolved" : "Reviewed"}
          variant={statusVariant[f.reviewStatus]}
        />
      ),
  },
  {
    id: "modified",
    label: "Date",
    defaultVisible: true,
    sortable: true,
    sortValue: (f) => (f.jpModifiedOn ? new Date(f.jpModifiedOn).getTime() : 0),
    csvValue: (f) => f.jpModifiedOn ?? "",
    render: (f) => (
      <span className="whitespace-nowrap">
        {fmtDate(f.jpModifiedOn)}
        {f.jpModifiedOn && (
          <span className="ml-1 text-xs text-muted-foreground">({relativeDays(f.jpModifiedOn)})</span>
        )}
      </span>
    ),
  },
  {
    id: "synced",
    label: "Last synced",
    defaultVisible: true,
    sortable: true,
    sortValue: (f) => (f.lastSyncedOn ? new Date(f.lastSyncedOn).getTime() : 0),
    csvValue: (f) => f.lastSyncedOn ?? "",
    render: (f) => <span className="whitespace-nowrap text-muted-foreground">{fmtDate(f.lastSyncedOn)}</span>,
  },
  {
    id: "amount",
    label: "Amount",
    defaultVisible: true,
    sortable: true,
    sortValue: (f) => Math.abs(f.amountCents ?? 0),
    csvValue: (f) => (f.amountCents == null ? "" : centsToUsd(Math.abs(f.amountCents))),
    render: (f) =>
      f.amountCents == null ? (
        <span className="text-muted-foreground">—</span>
      ) : (
        <span className="tabular-nums">{centsToUsd(Math.abs(f.amountCents))}</span>
      ),
  },
];

const defaultVisibleColumns = columns.map((c) => c.id);

function FindingDetail({
  finding,
  onReview,
  isUpdating,
}: {
  finding: ReconciliationFindingItem;
  onReview: (status: ReviewStatus) => void;
  isUpdating: boolean;
}) {
  const showValues = (finding.jpValueCents ?? 0) !== 0 || (finding.acuValueCents ?? 0) !== 0;
  return (
    <div className="space-y-5 px-6 pb-6">
      <InfoAlert variant="info">{kindMeaning[finding.kind]}</InfoAlert>

      <div className="space-y-3">
        <DetailField label="Project">
          {finding.jpProjectId > 0
            ? `${finding.jpProjectName} (JP #${finding.jpProjectId})`
            : finding.jpProjectName}
        </DetailField>
        {finding.costCodeLabel && (
          <DetailField label={finding.recordType === "ap_bill" ? "Vendor" : "Cost code"}>
            {finding.costCodeLabel}
          </DetailField>
        )}
        <DetailField label="Record">{recordTypeLabels[finding.recordType]}</DetailField>
        <DetailField label="What to do">{finding.detail}</DetailField>
        {showValues && (
          <DetailField label="Values">
            <span className="tabular-nums">
              {finding.jpValueCents != null && (
                <>Job Planner {centsToUsd(finding.jpValueCents)}{finding.acuValueCents != null && " · "}</>
              )}
              {finding.acuValueCents != null && <>Acumatica {centsToUsd(finding.acuValueCents)}</>}
              {finding.acumaticaChecked && (
                <span className="ml-2 text-xs text-muted-foreground">✓ verified against Acumatica</span>
              )}
            </span>
          </DetailField>
        )}
        <DetailField label="Date">
          {`${fmtDate(finding.jpModifiedOn)}${
            relativeDays(finding.jpModifiedOn) ? ` (${relativeDays(finding.jpModifiedOn)})` : ""
          }`}
        </DetailField>
        {finding.recordType !== "ap_bill" && (
          <DetailField label="Last synced">{fmtDate(finding.lastSyncedOn)}</DetailField>
        )}
        {finding.externalId && (
          <DetailField label="Acumatica id">
            <code className="break-all text-xs">{finding.externalModel}: {finding.externalId}</code>
          </DetailField>
        )}
      </div>

      {finding.evidence?.copies?.length ? (
        <div className="space-y-3">
          <DetailField label="Invoice # match">
            {finding.evidence.invoiceMatch ? (
              <span className="inline-flex items-center gap-1.5 text-success">
                <Check className="h-4 w-4" /> Same invoice — {finding.evidence.matchedInvoiceNo}
              </span>
            ) : (
              <span className="text-warning">Different invoice numbers — open both to confirm</span>
            )}
          </DetailField>
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">The two bills</p>
            {finding.evidence.copies.map((c, i) => (
              <div key={`${c.ref}-${i}`} className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <StatusBadge
                    status={c.role === "keep" ? "Keep" : "Void"}
                    variant={c.role === "keep" ? "success" : "error"}
                  />
                  <div className="min-w-0 text-sm">
                    <div className="truncate">
                      #{c.ref} · inv {c.invoiceNo ?? "—"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {fmtDate(c.date)} · {(c.status ?? "").toLowerCase()}
                      {c.balanceCents != null && c.balanceCents > 0
                        ? ` · ${centsToUsd(c.balanceCents)} owed`
                        : " · paid"}
                    </div>
                  </div>
                </div>
                <a
                  href={acumaticaBillUrl(c)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex shrink-0 items-center gap-1 text-xs text-primary hover:underline"
                >
                  Open <ArrowRight className="h-3 w-3" />
                </a>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="flex flex-col gap-2 pt-1">
        <div className="flex gap-2">
          {finding.reviewStatus !== "resolved" ? (
            <Button size="sm" onClick={() => onReview("resolved")} disabled={isUpdating}>
              <Check className="h-4 w-4 mr-2" />
              Mark resolved
            </Button>
          ) : (
            <Button size="sm" variant="outline" onClick={() => onReview("open")} disabled={isUpdating}>
              <RotateCcw className="h-4 w-4 mr-2" />
              Reopen
            </Button>
          )}
          {finding.reviewStatus === "open" && (
            <Button size="sm" variant="outline" onClick={() => onReview("reviewed")} disabled={isUpdating}>
              Mark reviewed
            </Button>
          )}
        </div>
        {!finding.evidence?.copies?.length && (
          <>
            <a href={ACUMATICA_PROJECTS_URL} target="_blank" rel="noreferrer">
              <Button variant="outline" size="sm" className="w-full justify-start">
                <ArrowRight className="h-4 w-4 mr-2" />
                Open Acumatica Projects screen
              </Button>
            </a>
            <p className="text-xs text-muted-foreground">
              Search the Acumatica id above to find this exact line. Job Planner deep-links are
              pending the JP web address.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

export default function ReconciliationPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { data, isLoading, isFetching, error } = useReconciliationFindings();
  const runScan = useRunReconciliation();
  const resolveFinding = useResolveFinding();
  const [selected, setSelected] = useState<ReconciliationFindingItem | null>(null);

  const tableState = useUnifiedTableState({
    entityKey: "reconciliation-findings",
    searchParams,
    pathname,
    router,
    defaults: {
      view: "table",
      allowedViews: ["table"],
      page: 1,
      perPage: 25,
      search: "",
      sortBy: "modified",
      sortDirection: "desc",
      visibleColumns: defaultVisibleColumns,
      filters: { tier: undefined, kind: undefined },
    },
  });

  const activeFilters = useMemo<Record<string, FilterValue>>(
    () => ({
      tier: (searchParams?.get("tier") as FilterValue) || undefined,
      kind: (searchParams?.get("kind") as FilterValue) || undefined,
    }),
    [searchParams],
  );

  const rawView = searchParams?.get("view") ?? "all";
  const view: ViewKey = (rawView in VIEW_KINDS ? rawView : "all") as ViewKey;
  const viewKinds = VIEW_KINDS[view];

  const allFindings = data?.findings ?? [];
  const viewFindings = useMemo(
    () => (viewKinds ? allFindings.filter((f) => viewKinds.includes(f.kind)) : allFindings),
    [allFindings, viewKinds],
  );
  const filteredItems = useMemo(() => {
    return viewFindings.filter((f) => {
      if (activeFilters.tier && f.tier !== activeFilters.tier) return false;
      if (activeFilters.kind && f.kind !== activeFilters.kind) return false;
      return true;
    });
  }, [viewFindings, activeFilters]);

  const summary = data?.summary;
  const generatedAt = data?.generatedAt ? fmtDate(data.generatedAt) : "—";
  const atRisk = viewFindings
    .filter((f) => f.tier === "HIGH")
    .reduce((sum, f) => sum + Math.abs(f.amountCents ?? 0), 0);
  const description =
    view === "all"
      ? summary
        ? `${summary.highCount} high-confidence findings · ${centsToUsd(summary.dollarsAtRiskCents)} at risk · ${summary.projects} projects · scanned ${generatedAt}. ${VIEW_HELP.all}`
        : VIEW_HELP.all
      : `${viewFindings.length} ${tabLabel(view).toLowerCase()} · ${centsToUsd(atRisk)} at risk. ${VIEW_HELP[view]}`;

  const tabBase = pathname ?? "/accounting/reconciliation";
  const tabs = (Object.keys(VIEW_KINDS) as ViewKey[]).map((key) => ({
    label: tabLabel(key),
    href: key === "all" ? tabBase : `${tabBase}?view=${key}`,
    isActive: view === key,
  }));

  const handleFilterChange = (next: Record<string, FilterValue>) => {
    tableState.setSearchParams({
      tier: (next.tier as string) ?? null,
      kind: (next.kind as string) ?? null,
    });
  };

  const handleReview = (status: ReviewStatus) => {
    if (!selected) return;
    resolveFinding.mutate(
      { fingerprint: selected.fingerprint, reviewStatus: status },
      { onSuccess: () => setSelected(null) },
    );
  };

  const scanning = runScan.isPending || isFetching;

  return (
    <>
      <UnifiedTablePage
        header={{
          title: "Reconciliation",
          description,
          actions: (
            <Button size="sm" variant="outline" onClick={() => runScan.mutate()} disabled={scanning}>
              <RefreshCw className={`h-4 w-4 mr-2 ${scanning ? "animate-spin" : ""}`} />
              {runScan.isPending ? "Re-scanning…" : "Re-scan"}
            </Button>
          ),
        }}
        tabs={tabs}
        layout={{ fullBleedTable: false, toolbarInlineWithHeader: true }}
        toolbar={{
          totalItems: viewFindings.length,
          filteredItems: filteredItems.length,
          searchValue: tableState.searchInput,
          onSearchChange: tableState.setSearchInput,
          searchPlaceholder: "Search by project, cost code, detail…",
          currentView: tableState.currentView,
          onViewChange: tableState.setCurrentView,
          filters: reconciliationFilters,
          activeFilters,
          onFilterChange: handleFilterChange,
          onClearFilters: () => handleFilterChange({ tier: undefined, kind: undefined }),
        }}
        data={{
          items: filteredItems,
          isLoading,
          isFetching,
          error: error instanceof Error ? error : null,
        }}
        table={{
          columns,
          getRowId: (f) => f.fingerprint,
          onRowClick: (f) => setSelected(f),
        }}
        emptyState={{
          title: "No findings",
          description: "Job Planner and Acumatica are in sync, or no scan has run yet.",
          filteredDescription: "No findings match your current filters.",
          isFiltered: Boolean(tableState.debouncedSearch) || Boolean(activeFilters.tier) || Boolean(activeFilters.kind),
        }}
      />

      <Sheet open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent className="overflow-y-auto">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <StatusBadge status={tierLabels[selected.tier]} variant={tierVariant[selected.tier]} />
                  {kindLabels[selected.kind]}
                </SheetTitle>
              </SheetHeader>
              <FindingDetail finding={selected} onReview={handleReview} isUpdating={resolveFinding.isPending} />
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
