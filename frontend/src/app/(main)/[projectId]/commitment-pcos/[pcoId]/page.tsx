"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Copy,
  Download,
  FileText,
  MoreVertical,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { apiFetch } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { Inline } from "@/components/layout/inline";
import { Text } from "@/components/ds/text";
import { PageShell, PageTabs } from "@/components/layout";
import {
  StatusBadge,
  EmptyState,
  ErrorState,
  InlineTable,
  InlineTableHeader,
  InlineTableHeaderRow,
  InlineTableHeaderCell,
  InlineTableBody,
  InlineTableRow,
  InlineTableCell,
  InlineTableFooter,
  InlineTableFooterRow,
  InlineTableFooterCell,
} from "@/components/ds";
import { useProjectTitle } from "@/hooks/useProjectTitle";
import {
  formatMoney,
  statusLabel,
  commitmentTypeLabel,
  type CommitmentPcoDetail,
} from "@/features/commitment-pcos/commitment-pcos-table-config";

/* ── Page component ──────────────────────────────────────────────── */

export default function CommitmentPcoDetailPage() {
  const router = useRouter();
  const params = useParams()!;
  const projectId = parseInt(params.projectId as string, 10);
  const pcoId = params.pcoId as string;

  const [pco, setPco] = useState<CommitmentPcoDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("line-items");
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showPromoteDialog, setShowPromoteDialog] = useState(false);

  const fetchPco = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiFetch(
        `/api/projects/${projectId}/commitment-pcos/${pcoId}`,
      );
      setPco(data as typeof pco);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load PCO");
    } finally {
      setIsLoading(false);
    }
  }, [projectId, pcoId]);

  useEffect(() => {
    fetchPco();
  }, [fetchPco]);

  useProjectTitle(
    pco ? `${pco.pco_number} - ${pco.title}` : "Loading...",
  );

  /* ── Navigation ─────────────────────────────────────────────────── */

  const handleBack = useCallback(() => {
    router.push(`/${projectId}/commitment-pcos`);
  }, [router, projectId]);

  /* ── Actions ────────────────────────────────────────────────────── */

  const handleDelete = useCallback(async () => {
    try {
      await apiFetch(
        `/api/projects/${projectId}/commitment-pcos/${pcoId}`,
        { method: "DELETE" },
      );
      toast.success("PCO deleted");
      setShowDeleteDialog(false);
      router.push(`/${projectId}/commitment-pcos`);
    } catch (err) {
      toast.error("Failed to delete PCO");
    }
  }, [projectId, pcoId, router]);

  const handlePromote = useCallback(async () => {
    try {
      await apiFetch(
        `/api/projects/${projectId}/commitment-pcos/${pcoId}/promote`,
        { method: "POST" },
      );
      toast.success("PCO promoted to Change Order");
      setShowPromoteDialog(false);
      fetchPco();
    } catch (err) {
      toast.error("Failed to promote PCO");
    }
  }, [projectId, pcoId, fetchPco]);

  const handleExport = useCallback(() => {
    if (!pco) return;
    const rows = [
      ["Field", "Value"],
      ["PCO Number", pco.pco_number || ""],
      ["Title", pco.title || ""],
      ["Status", pco.status || ""],
      ["Commitment Type", commitmentTypeLabel(pco.commitment_type)],
      ["Commitment", pco.commitment?.title || ""],
      ["Total Amount", String(pco.total_amount ?? 0)],
      ["Schedule Impact", String(pco.schedule_impact ?? "N/A")],
      ["Description", (pco.description || "").replace(/\n/g, " ")],
    ];
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `commitment-pco-${pco.pco_number || pco.id}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Exported PCO");
  }, [pco]);

  const handleCopyId = useCallback(() => {
    navigator.clipboard.writeText(pcoId);
    toast.success("PCO ID copied");
  }, [pcoId]);

  /* ── Derived state ──────────────────────────────────────────────── */

  const canEdit = pco?.status === "draft" || pco?.status === "pending";
  const canDelete = pco?.status === "draft";
  const canPromote =
    (pco?.status === "pending" || pco?.status === "approved") &&
    !pco?.promoted_to_co_id;

  const linkedCeCount = pco?.linked_change_events?.length ?? 0;

  /* ── Loading state ──────────────────────────────────────────────── */

  if (isLoading) {
    return (
      <PageShell variant="detail" title="Loading...">
        <div className="space-y-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </PageShell>
    );
  }

  /* ── Error state ────────────────────────────────────────────────── */

  if (error || !pco) {
    return (
      <PageShell
        variant="detail"
        title="Error"
        onBack={handleBack}
      >
        <ErrorState
          error={error || "Commitment PCO not found"}
          onRetry={handleBack}
        />
      </PageShell>
    );
  }

  /* ── Header actions ─────────────────────────────────────────────── */

  const pcoTitle = `PCO ${pco.pco_number}: ${pco.title || "Untitled"}`;

  const headerActions = (
    <Inline gap="sm">
      {canEdit && (
        <Button
          variant="outline"
          size="sm"
          disabled
          title="Edit form coming soon"
        >
          Edit
        </Button>
      )}
      {canPromote && (
        <Button size="sm" onClick={() => setShowPromoteDialog(true)}>
          <ArrowRight className="mr-1 h-4 w-4" />
          Promote to CCO
        </Button>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <MoreVertical />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" />
            Export as CSV
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleCopyId}>
            <Copy className="mr-2 h-4 w-4" />
            Copy ID
          </DropdownMenuItem>
          {canDelete && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive"
                onClick={() => setShowDeleteDialog(true)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </Inline>
  );

  /* ── Main render ────────────────────────────────────────────────── */

  return (
    <PageShell
      variant="detail"
      title={pcoTitle}
      actions={headerActions}
      onBack={handleBack}
    >
      {/* Summary info */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <StatusBadge status={statusLabel(pco.status)} />
        <Text tone="muted" className="text-sm">
          {commitmentTypeLabel(pco.commitment_type)}
          {pco.commitment?.title && ` — ${pco.commitment.title}`}
          {pco.commitment?.vendor_name && ` (${pco.commitment.vendor_name})`}
        </Text>
      </div>

      {/* Total amount */}
      <div className="mb-8 rounded-lg bg-muted/50 px-5 py-4">
        <Text tone="muted" className="text-xs uppercase tracking-wider">
          Total Amount
        </Text>
        <p className="text-2xl font-semibold tabular-nums text-foreground">
          {formatMoney(pco.total_amount)}
        </p>
        {pco.schedule_impact != null && pco.schedule_impact !== 0 && (
          <Text tone="muted" className="mt-1 text-sm">
            Schedule impact: {pco.schedule_impact} day
            {Math.abs(pco.schedule_impact) !== 1 ? "s" : ""}
          </Text>
        )}
      </div>

      {/* Description */}
      {pco.description && (
        <div className="mb-8">
          <Text tone="muted" className="mb-1 text-xs uppercase tracking-wider">
            Description
          </Text>
          <p className="text-sm text-foreground whitespace-pre-wrap">
            {pco.description}
          </p>
        </div>
      )}

      {/* Promoted CO banner */}
      {pco.promoted_co && (
        <div className="mb-8 rounded-lg border border-border bg-muted/30 px-5 py-4">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <Text className="text-sm font-medium">
              Promoted to CCO: {pco.promoted_co.change_order_number} —{" "}
              {pco.promoted_co.title}
            </Text>
            <StatusBadge status={pco.promoted_co.status} />
          </div>
        </div>
      )}

      <PageTabs
        variant="inline"
        tabs={[
          {
            label: "Line Items",
            href: "line-items",
            isActive: activeTab === "line-items",
            testId: "pco-tab-line-items",
          },
          {
            label: `Source Change Events (${linkedCeCount})`,
            href: "source-ces",
            isActive: activeTab === "source-ces",
            testId: "pco-tab-source-ces",
          },
        ]}
        onTabClick={(href) => setActiveTab(href)}
      />

      <div className="pt-4">
        {activeTab === "line-items" && <PcoLineItemsTable pco={pco} />}

        {activeTab === "source-ces" && (
          <PcoLinkedChangeEvents
            changeEvents={pco.linked_change_events}
            projectId={projectId}
          />
        )}
      </div>

      {/* Delete dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete PCO?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete PCO {pco.pco_number}. This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Promote dialog */}
      <AlertDialog open={showPromoteDialog} onOpenChange={setShowPromoteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Promote to Change Order?</AlertDialogTitle>
            <AlertDialogDescription>
              This will create an official Commitment Change Order (CCO) from PCO{" "}
              {pco.pco_number}. The CCO will be created with &quot;approved&quot;
              status.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handlePromote}>
              Promote to CCO
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageShell>
  );
}

/* ── Line Items sub-component ─────────────────────────────────────── */

function PcoLineItemsTable({ pco }: { pco: CommitmentPcoDetail }) {
  // The detail API doesn't return line_items yet (table may not exist),
  // so we show an empty state or a basic table if data is present.
  const lineItems = (
    pco as CommitmentPcoDetail & {
      line_items?: Array<{
        id: string;
        description: string;
        quantity: number;
        unit_of_measure: string;
        unit_cost: number;
        amount: number;
      }>;
    }
  ).line_items;

  if (!lineItems || lineItems.length === 0) {
    return (
      <EmptyState
        icon={<FileText />}
        title="No line items"
        description="Line items for this PCO will appear here once added."
      />
    );
  }

  return (
    <InlineTable variant="read">
      <InlineTableHeader>
        <InlineTableHeaderRow>
          <InlineTableHeaderCell>Description</InlineTableHeaderCell>
          <InlineTableHeaderCell align="right">Qty</InlineTableHeaderCell>
          <InlineTableHeaderCell>UOM</InlineTableHeaderCell>
          <InlineTableHeaderCell align="right">Unit Cost</InlineTableHeaderCell>
          <InlineTableHeaderCell align="right">Amount</InlineTableHeaderCell>
        </InlineTableHeaderRow>
      </InlineTableHeader>
      <InlineTableBody>
        {lineItems.map((item) => (
          <InlineTableRow key={item.id}>
            <InlineTableCell>{item.description || "--"}</InlineTableCell>
            <InlineTableCell align="right" numeric>
              {item.quantity}
            </InlineTableCell>
            <InlineTableCell>{item.unit_of_measure || "--"}</InlineTableCell>
            <InlineTableCell align="right" numeric>
              {formatMoney(item.unit_cost)}
            </InlineTableCell>
            <InlineTableCell align="right" numeric className="font-medium">
              {formatMoney(item.amount)}
            </InlineTableCell>
          </InlineTableRow>
        ))}
      </InlineTableBody>
      <InlineTableFooter>
        <InlineTableFooterRow type="totals">
          <InlineTableFooterCell colSpan={4} align="right">
            Total
          </InlineTableFooterCell>
          <InlineTableFooterCell align="right" numeric>
            {formatMoney(
              lineItems.reduce((sum, item) => sum + (item.amount ?? 0), 0),
            )}
          </InlineTableFooterCell>
        </InlineTableFooterRow>
      </InlineTableFooter>
    </InlineTable>
  );
}

/* ── Linked Change Events sub-component ───────────────────────────── */

function PcoLinkedChangeEvents({
  changeEvents,
  projectId,
}: {
  changeEvents: CommitmentPcoDetail["linked_change_events"];
  projectId: number;
}) {
  const router = useRouter();

  if (!changeEvents || changeEvents.length === 0) {
    return (
      <EmptyState
        icon={<FileText />}
        title="No linked change events"
        description="Change events linked to this PCO will appear here."
      />
    );
  }

  return (
    <InlineTable variant="read">
      <InlineTableHeader>
        <InlineTableHeaderRow>
          <InlineTableHeaderCell>CE #</InlineTableHeaderCell>
          <InlineTableHeaderCell>Title</InlineTableHeaderCell>
          <InlineTableHeaderCell>Status</InlineTableHeaderCell>
          <InlineTableHeaderCell>Type</InlineTableHeaderCell>
          <InlineTableHeaderCell align="right">Revenue ROM</InlineTableHeaderCell>
          <InlineTableHeaderCell align="right">Cost ROM</InlineTableHeaderCell>
          <InlineTableHeaderCell>Linked</InlineTableHeaderCell>
        </InlineTableHeaderRow>
      </InlineTableHeader>
      <InlineTableBody>
        {changeEvents.map((ce) => (
          <InlineTableRow
            key={ce.id}
            className="cursor-pointer transition-colors hover:bg-muted/50"
            onClick={() =>
              router.push(`/${projectId}/change-events/${ce.id}`)
            }
          >
            <InlineTableCell className="font-mono text-muted-foreground">
              {ce.number || `CE-${ce.id.slice(0, 8)}`}
            </InlineTableCell>
            <InlineTableCell className="font-medium">
              {ce.title || "--"}
            </InlineTableCell>
            <InlineTableCell>
              <StatusBadge status={ce.status || "unknown"} />
            </InlineTableCell>
            <InlineTableCell>{ce.type || "--"}</InlineTableCell>
            <InlineTableCell align="right" numeric>
              {formatMoney(ce.total_revenue_rom)}
            </InlineTableCell>
            <InlineTableCell align="right" numeric>
              {formatMoney(ce.total_cost_rom)}
            </InlineTableCell>
            <InlineTableCell className="text-muted-foreground">
              {ce.linked_at
                ? new Date(ce.linked_at).toLocaleDateString()
                : "--"}
            </InlineTableCell>
          </InlineTableRow>
        ))}
      </InlineTableBody>
    </InlineTable>
  );
}
