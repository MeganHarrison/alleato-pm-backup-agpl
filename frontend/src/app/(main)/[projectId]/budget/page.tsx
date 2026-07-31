"use client";

import * as React from "react";
import { Suspense } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Trash2 } from "lucide-react";

import {
  BudgetPageHeader,
  BudgetTabs,
  BudgetFilters,
  BudgetTable,
  BudgetChangesTab,
  BudgetDetailsTable,
  BudgetModificationModal,
  BudgetViewsModal,
  CostCodesTab,
  OriginalBudgetEditModal,
  ForecastingTab,
  SnapshotsTab,
  ChangeHistoryTab,
  BudgetSettingsPanel,
} from "@/components/budget";
import { UnlockBudgetDialog } from "@/components/budget/unlock-budget-dialog";
import { BudgetLineItemCreatorModal, type InlineLineItemData } from "@/components/budget/BudgetLineItemCreatorModal";
import { BudgetLineItemModalAnimated } from "@/components/budget/budget-line-item-modal-animated";
import { BudgetModificationsModal } from "@/components/budget/modals/BudgetModificationsModal";
import { ApprovedCOsModal } from "@/components/budget/modals/ApprovedCOsModal";
import { JobToDateCostDetailModal } from "@/components/budget/modals/JobToDateCostDetailModal";
import { DirectCostsModal } from "@/components/budget/modals/DirectCostsModal";
import { PendingBudgetChangesModal } from "@/components/budget/modals/PendingBudgetChangesModal";
import { CommittedCostsModal } from "@/components/budget/modals/CommittedCostsModal";
import { PendingCostChangesModal } from "@/components/budget/modals/PendingCostChangesModal";
import { ForecastToCompleteModal } from "@/components/budget/modals/ForecastToCompleteModal";
import { ImportBudgetModal } from "@/components/budget/ImportBudgetModal";
import { ImportFromContractModal } from "@/components/budget/ImportFromContractModal";
import type { BudgetDetailLineItem } from "@/components/budget/budget-details-table";
import { Skeleton } from "@/components/ui/skeleton";
import type { BudgetLineItem } from "@/types/budget";
import type { BudgetViewDefinition } from "@/types/budget-views";
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
import { Button } from "@/components/ui/button";
import { budgetSnapshots, budgetGroups } from "@/config/budget";
import { useProjectTitle } from "@/hooks/useProjectTitle";
import {
  formatBudgetUpdateError,
  updateBudgetLineItem,
} from "@/lib/budget/update-budget-line-item";
import { appToast as toast } from "@/lib/toast/app-toast";
import {
  apiFetch,
  apiFetchBlob,
  summarizeBulkResults,
} from "@/lib/api-client";
import { useConfirm } from "@/hooks/use-confirm";
import { useBudgetNewLinePolicy } from "@/hooks/use-budget-new-line-policy";
import {
  applyQuickFilter,
  loadQuickFilterPreference,
  saveQuickFilterPreference,
} from "@/lib/budget-filters";
import type { QuickFilterType } from "@/components/budget/budget-filters";
import {
  applyGrouping,
  calculateGrandTotals,
  type GroupingType,
} from "@/lib/budget-grouping";
import { BudgetTableCommentsWrapper } from "@/components/budget/budget-table-comments-wrapper";
import { PermissionGate } from "@/components/domain/permissions/PermissionGate";

const EMPTY_GRAND_TOTALS = {
  originalBudgetAmount: 0,
  budgetModifications: 0,
  approvedCOs: 0,
  revisedBudget: 0,
  jobToDateCostDetail: 0,
  directCosts: 0,
  pendingChanges: 0,
  projectedBudget: 0,
  committedCosts: 0,
  pendingCostChanges: 0,
  projectedCosts: 0,
  forecastToComplete: 0,
  estimatedCostAtCompletion: 0,
  projectedOverUnder: 0,
};

const BUDGET_COLUMN_CONTROLS_SLOT_ID = "budget-column-controls-slot";
const BUDGET_CHANGES_TOOLBAR_SLOT_ID = "budget-changes-toolbar-slot";

function BudgetTableSkeleton() {
  return (
    <div className="rounded-lg border bg-background shadow-sm overflow-hidden">
      {/* Table header skeleton */}
      {/* eslint-disable-next-line design-system/require-info-alert -- table skeleton row, not a user-facing callout */}
      <div className="flex items-center gap-2 px-4 py-4 border-b bg-muted/50">
        <Skeleton className="h-4 w-4" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-32 ml-4" />
        <Skeleton className="h-4 w-20 ml-4" />
        <Skeleton className="h-4 w-28 ml-auto" />
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-4 w-28" />
      </div>
      {/* Table rows skeleton */}
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex items-center gap-2 px-4 py-4 border-b last:border-b-0">
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-48 ml-4" />
          <Skeleton className="h-4 w-12 ml-4" />
          <Skeleton className="h-5 w-24 ml-auto" />
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-5 w-24" />
        </div>
      ))}
      {/* Grand total row skeleton */}
      {/* eslint-disable-next-line design-system/require-info-alert -- table skeleton total row, not a user-facing callout */}
      <div className="flex items-center gap-2 px-4 py-4 bg-muted/30 border-t">
        <Skeleton className="h-5 w-20" />
        <Skeleton className="h-5 w-28 ml-auto" />
        <Skeleton className="h-5 w-28" />
        <Skeleton className="h-5 w-28" />
      </div>
    </div>
  );
}

function BudgetPageContent() {
  const router = useRouter();
  const params = useParams()!;
  const { confirm, ConfirmDialog } = useConfirm();
  const searchParams = useSearchParams()!;
  const projectId = params.projectId as string;
  useProjectTitle("Budget");

  // Get active tab from URL query parameter, default to 'budget'
  const activeTab = searchParams.get("tab") || "budget";
  const [selectedSnapshot, setSelectedSnapshot] = React.useState("current");
  const [selectedGroup, setSelectedGroup] = React.useState("cost-code-tier-1");
  const [budgetData, setBudgetData] = React.useState<BudgetLineItem[]>([]);
  const [budgetDetailsData, setBudgetDetailsData] = React.useState<
    BudgetDetailLineItem[]
  >([]);
  const [quickFilter, setQuickFilter] = React.useState<QuickFilterType>("all");
  const [grandTotals, setGrandTotals] = React.useState(EMPTY_GRAND_TOTALS);
  const [loading, setLoading] = React.useState(true);
  const [detailsLoading, setDetailsLoading] = React.useState(false);
  const [detailsRequested, setDetailsRequested] = React.useState(false);
  const [detailsFetchError, setDetailsFetchError] = React.useState(false);
  const [showLineItemModal, setShowLineItemModal] = React.useState(false);
  const [showModificationModal, setShowModificationModal] =
    React.useState(false);
  const [showImportModal, setShowImportModal] = React.useState(false);
  const [showImportFromContractModal, setShowImportFromContractModal] = React.useState(false);
  const [showEditModal, setShowEditModal] = React.useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = React.useState(false);
  const [showUnlockDialog, setShowUnlockDialog] = React.useState(false);
  const [selectedLineItem, setSelectedLineItem] =
    React.useState<BudgetLineItem | null>(null);
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
  const [deleting, setDeleting] = React.useState(false);
  const [showInlineCreate, setShowInlineCreate] = React.useState(false);

  // New modal states for budget column modals
  const [showBudgetModificationsModal, setShowBudgetModificationsModal] =
    React.useState(false);
  const [showApprovedCOsModal, setShowApprovedCOsModal] = React.useState(false);
  const [showJobToDateCostDetailModal, setShowJobToDateCostDetailModal] =
    React.useState(false);
  const [showDirectCostsModal, setShowDirectCostsModal] = React.useState(false);
  const [showPendingChangesModal, setShowPendingChangesModal] =
    React.useState(false);
  const [showCommittedCostsModal, setShowCommittedCostsModal] =
    React.useState(false);
  const [showPendingCostChangesModal, setShowPendingCostChangesModal] =
    React.useState(false);
  const [showForecastToCompleteModal, setShowForecastToCompleteModal] =
    React.useState(false);
  const [isFullscreen, setIsFullscreen] = React.useState(false);
  const [snapshotsRefreshToken, setSnapshotsRefreshToken] = React.useState(0);
  const [showViewsModal, setShowViewsModal] = React.useState(false);

  // Budget views (named column configurations)
  const [budgetViews, setBudgetViews] = React.useState<BudgetViewDefinition[]>([]);
  const [activeViewId, setActiveViewId] = React.useState<string>("");

  // Derive column visibility from the active view's columns
  const activeViewColumnVisibility = React.useMemo(() => {
    if (!activeViewId) return undefined;
    const view = budgetViews.find((v) => v.id === activeViewId);
    if (!view?.columns?.length) return undefined;
    const visibility: Record<string, boolean> = {};
    for (const col of view.columns) {
      visibility[col.column_key] = col.is_visible;
    }
    return visibility;
  }, [activeViewId, budgetViews]);

  // Budget lock state
  const [isLocked, setIsLocked] = React.useState(false);
  const [lockedAt, setLockedAt] = React.useState<string | null>(null);
  const [lockedBy, setLockedBy] = React.useState<string | null>(null);

  // Post-execution amount lock: when the prime contract is executed and the
  // feature flag is on, new budget lines must be created at $0.00.
  const newLinePolicy = useBudgetNewLinePolicy(projectId);

  // Fetch available budget views for the view switcher
  const fetchBudgetViews = React.useCallback(async () => {
    if (!projectId) return;
    try {
      const data = await apiFetch<{ views?: BudgetViewDefinition[] }>(
        `/api/projects/${projectId}/budget/views`,
      );
      const views = data.views ?? [];
      setBudgetViews(views);
      // Auto-select default view if none is active yet
      if (!activeViewId) {
        const defaultView = views.find((v) => v.is_default);
        if (defaultView) setActiveViewId(defaultView.id);
      }
    } catch (error) {
      // Non-critical: silently ignore — the table still works without named views
      console.error("Failed to fetch budget views:", error);
    }
  }, [projectId, activeViewId]);

  // Fetch budget lock status
  const fetchLockStatus = React.useCallback(async () => {
    try {
      const data = await apiFetch<{
        isLocked?: boolean;
        lockedAt?: string | null;
        lockedBy?: string | null;
        lockedByUserId?: string | null;
      }>(`/api/projects/${projectId}/budget/lock`);
      setIsLocked(data.isLocked || false);
      setLockedAt(data.lockedAt || null);
      setLockedBy(data.lockedBy || null);
    } catch (error) {
      console.error("Failed to fetch budget lock status:", error);
      // Intentionally swallowed: lock status fetch is non-critical
    }
  }, [projectId]);

  // Fetch budget data
  const fetchBudgetData = React.useCallback(async () => {
    if (!projectId) return;
    try {
      setLoading(true);
      const budgetDataResponse = await apiFetch<{
        lineItems?: BudgetLineItem[];
        grandTotals?: typeof EMPTY_GRAND_TOTALS;
      }>(`/api/projects/${projectId}/budget`);

      setBudgetData(budgetDataResponse.lineItems || []);
      setGrandTotals(budgetDataResponse.grandTotals || EMPTY_GRAND_TOTALS);
    } catch (error) {
      console.error("Failed to fetch budget data:", error);
      setBudgetData([]);
      setGrandTotals(EMPTY_GRAND_TOTALS);
      toast.error("Failed to load budget", { description: "Please try again." });
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  const shouldPreloadBudgetData =
    activeTab === "budget" || activeTab === "budget-details";

  React.useEffect(() => {
    if (projectId) {
      fetchLockStatus();
      if (shouldPreloadBudgetData) {
        fetchBudgetData();
      } else {
        setLoading(false);
      }
      fetchBudgetViews();
      // Load saved quick filter preference
      const savedFilter = loadQuickFilterPreference(projectId);
      setQuickFilter(savedFilter);
    }
    // fetchBudgetViews intentionally omitted from deps to avoid re-fetching on
    // every activeViewId change — only re-fetch when projectId changes.
     
  }, [projectId, fetchBudgetData, fetchLockStatus, shouldPreloadBudgetData]);

  // Apply quick filter to budget data
  // Apply filtering and grouping to budget data
  const filteredData = React.useMemo(() => {
    // First apply quick filter
    const filtered = applyQuickFilter(budgetData, quickFilter);

    // Then apply grouping
    const grouped = applyGrouping(filtered, selectedGroup as GroupingType);

    return grouped;
  }, [budgetData, quickFilter, selectedGroup]);
  const displayedGrandTotals = React.useMemo(
    () => calculateGrandTotals(filteredData),
    [filteredData],
  );

  // Handle quick filter change
  const handleQuickFilterChange = React.useCallback(
    (filter: QuickFilterType) => {
      setQuickFilter(filter);
      saveQuickFilterPreference(projectId, filter);
      toast.success(
        `Filter applied: ${
          filter === "all"
            ? "All Items"
            : filter
                .split("-")
                .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                .join(" ")
        }`,
      );
    },
    [projectId],
  );

  const handleCreateClick = () => {
    if (isLocked) {
      toast.error("Budget is locked. Unlock to add new line items.");
      return;
    }
    // Don't open the modal, instead trigger the inline creation
    // This will be passed to BudgetTable component
    setShowInlineCreate(true);
  };

  const handleModificationClick = () => {
    setShowModificationModal(true);
  };

  const handleLockBudget = async () => {
    try {
      const data = await apiFetch<{
        data: {
          budget_locked_at: string | null;
          budget_locked_by: string | null;
          budget_locked_by_name: string | null;
        };
      }>(`/api/projects/${projectId}/budget/lock`, {
        method: "POST",
      });

      setIsLocked(true);
      setLockedAt(data.data.budget_locked_at);
      setLockedBy(data.data.budget_locked_by_name);
      toast.success("Budget locked successfully");
    } catch (error) {
      toast.error("Failed to lock budget", {
        description:
          error instanceof Error ? error.message : "An unexpected error occurred.",
      });
    }
  };

  const handleUnlockBudget = () => {
    // Open the unlock dialog instead of immediately unlocking
    setShowUnlockDialog(true);
  };

  const handleUnlockSuccess = async () => {
    // Refetch budget data and lock status after successful unlock
    setIsLocked(false);
    setLockedAt(null);
    setLockedBy(null);

    try {
      setLoading(true);
      await fetchLockStatus();
      const budgetDataResponse = await apiFetch<{
        lineItems?: BudgetLineItem[];
        grandTotals?: typeof EMPTY_GRAND_TOTALS;
      }>(`/api/projects/${projectId}/budget`);

      setBudgetData(budgetDataResponse.lineItems || []);
      setGrandTotals(budgetDataResponse.grandTotals || EMPTY_GRAND_TOTALS);
    } catch (fetchError) {
      console.error("Failed to refetch budget data after unlock:", fetchError);
      toast.error("Failed to refresh data after unlock", {
        description: "Please refresh the page.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleImport = () => {
    if (isLocked) {
      toast.error("Budget is locked. Unlock to import budget data.");
      return;
    }
    setShowImportModal(true);
  };

  const handleImportFromContract = () => {
    if (isLocked) {
      toast.error("Budget is locked. Unlock to import budget data.");
      return;
    }
    setShowImportFromContractModal(true);
  };

  const handleCreateSnapshot = React.useCallback(async () => {
    let toastId: string | number | undefined;
    try {
      toastId = toast.loading("Creating snapshot...");
      await apiFetch(`/api/projects/${projectId}/budget/snapshots`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: `Snapshot ${new Date().toLocaleDateString()}`,
          description: "Manual snapshot",
        }),
      });

      setSnapshotsRefreshToken((prev) => prev + 1);
      toast.success("Snapshot created successfully", { id: toastId });
      if (activeTab !== "snapshots") {
        router.push(`/${projectId}/budget?tab=snapshots`);
      }
    } catch (error) {
      // Surface the real reason — never a bare "Failed to create snapshot".
      // A generic message left an actual failure undiagnosable (CLAUDE.md Rule 1).
      toast.error("Failed to create snapshot", {
        id: toastId,
        description:
          error instanceof Error ? error.message : "An unexpected error occurred.",
      });
    }
  }, [activeTab, projectId, router]);

  const handleExport = async (format: string) => {
    let toastId: string | number | undefined;

    try {
      // Validate format
      if (!["excel", "csv", "pdf"].includes(format)) {
        toast.error("Invalid export format");
        return;
      }

      // Show initial loading state
      toastId = toast.loading(`Preparing ${format.toUpperCase()} export...`, {
        description: "Gathering budget data...",
      });

      // Call export API (PDF renders server-side via its own route)
      const exportUrl =
        format === "pdf"
          ? `/api/projects/${projectId}/budget/export/pdf`
          : `/api/projects/${projectId}/budget/export?format=${format}`;
      const blob = await apiFetchBlob(exportUrl, { method: "GET" });

      // Update progress
      toast.loading(`Generating ${format.toUpperCase()} file...`, {
        id: toastId,
        description: "Processing data and creating file...",
      });

      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;

      // Extract filename from Content-Disposition header or use default
      const filename = `budget-export.${format === "excel" ? "xlsx" : format}`;

      // Update progress before download
      toast.loading("Starting download...", {
        id: toastId,
        description: `File: ${filename}`,
      });

      link.download = filename;
      document.body.appendChild(link);
      link.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(link);

      // Show success message with details
      const fileSize = (blob.size / 1024 / 1024).toFixed(2);
      toast.success(`Export completed successfully!`, {
        id: toastId,
        description: `${filename} (${fileSize} MB) has been downloaded`,
      });
    } catch (error) {
      const errorMessage = error instanceof Error
        ? error.message
        : "Failed to export budget data";

      toast.error(`Export failed: ${errorMessage}`, {
        id: toastId,
        description: "Please try again or contact support if the problem persists",
      });
    }
  };

  const handleTabChange = (tabId: string) => {
    // Update URL to reflect tab change
    if (tabId === "budget") {
      router.push(`/${projectId}/budget`);
    } else {
      router.push(`/${projectId}/budget?tab=${tabId}`);
    }

    // Fetch budget details when switching to budget-details tab
    if (
      tabId === "budget-details" &&
      !detailsLoading &&
      (budgetDetailsData.length === 0 || detailsFetchError)
    ) {
      fetchBudgetDetails();
    }
  };

  // Fetch budget details data
  const fetchBudgetDetails = React.useCallback(async () => {
    try {
      setDetailsRequested(true);
      setDetailsLoading(true);
      setDetailsFetchError(false);
      const data = await apiFetch<{ details?: BudgetDetailLineItem[] }>(
        `/api/projects/${projectId}/budget/details`,
      );
      setBudgetDetailsData(data.details || []);
    } catch (error) {
      console.error("Failed to load budget details:", error);
      toast.error("Failed to load budget details", {
        description:
          error instanceof Error ? error.message : "An unexpected error occurred.",
      });
      setDetailsFetchError(true);
    } finally {
      setDetailsLoading(false);
    }
  }, [projectId]);

  React.useEffect(() => {
    if (
      activeTab === "budget-details" &&
      budgetDetailsData.length === 0 &&
      !detailsLoading &&
      !detailsRequested
    ) {
      fetchBudgetDetails();
    }
  }, [
    activeTab,
    budgetDetailsData.length,
    detailsLoading,
    detailsRequested,
    fetchBudgetDetails,
  ]);

  const handleToggleFullscreen = React.useCallback(async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        setIsFullscreen(false);
        return;
      }

      await document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } catch {
      toast.error("Unable to toggle full page view");
    }
  }, []);

  React.useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };

    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", onFullscreenChange);
    };
  }, []);

  const showViewControls =
    activeTab === "budget" || activeTab === "budget-details";
  const showBudgetChangesControls = activeTab === "budget-changes";

  const handleOpenBuyoutSummaryReport = React.useCallback(() => {
    router.push(`/${projectId}/reporting?report=buyout-summary`);
  }, [router, projectId]);

  const handleOpenLegacyBudgetDetailReport = React.useCallback(() => {
    router.push(`/${projectId}/budget?tab=budget-details`);
  }, [router, projectId]);

  const handleOpenMonitoredResourcesReport = React.useCallback(() => {
    router.push(`/${projectId}/budget?tab=forecasting&view=monitored-resources`);
  }, [router, projectId]);

  const handleOpenCustomReports = React.useCallback(() => {
    router.push(`/${projectId}/reporting?type=custom`);
  }, [router, projectId]);

  const handleOpenErpIntegrations = React.useCallback(() => {
    toast.info("ERP accounting integration is not connected yet.", {
      description:
        "Sending a budget to your accounting system for acceptance will be available once the ERP integration is enabled.",
    });
  }, []);

  const handleConfigureBudgetViews = React.useCallback(() => {
    setShowViewsModal(true);
  }, []);

  const handleLineItemSuccess = React.useCallback(async () => {
    // Keep mutation follow-up synchronous from the caller's perspective so
    // modals and delete flows don't close until fresh budget data is visible.
    setLoading(true);
    try {
      const budgetDataResponse = await apiFetch<{
        lineItems?: BudgetLineItem[];
        grandTotals?: typeof EMPTY_GRAND_TOTALS;
      }>(`/api/projects/${projectId}/budget`);
      setBudgetData(budgetDataResponse.lineItems || []);
      setGrandTotals(budgetDataResponse.grandTotals || EMPTY_GRAND_TOTALS);

      // Also refresh budget details if that tab has been loaded
      if (detailsRequested) {
        const detailsDataResponse = await apiFetch<{
          details?: BudgetDetailLineItem[];
          lineItems?: BudgetDetailLineItem[];
        }>(`/api/projects/${projectId}/budget/details`);
        setBudgetDetailsData(
          detailsDataResponse.details || detailsDataResponse.lineItems || [],
        );
      }
    } catch (error) {
      console.error("Failed to refresh budget data:", error);
      toast.error("Failed to refresh budget", {
        description:
          error instanceof Error
            ? error.message
            : "Please reload the page.",
      });
    } finally {
      setLoading(false);
    }
  }, [projectId, detailsRequested]);

  const handleInlineCreateLineItem = React.useCallback(async (lineItem: {
    costCode?: string;
    description: string;
    originalBudgetAmount: string | number
  }) => {
    try {
      // Prepare the data for the API
      const amount = typeof lineItem.originalBudgetAmount === 'string'
        ? parseFloat(lineItem.originalBudgetAmount)
        : lineItem.originalBudgetAmount;

      // Fetch available cost codes to find or validate the cost code
      let costCodeId: string | null = null;

      try {
        const codesData = await apiFetch<{
          budgetCodes?: Array<{ code: string; id: string }>;
        }>(`/api/projects/${projectId}/budget-codes`);
        const fetchedBudgetCodes = codesData.budgetCodes || [];

        if (lineItem.costCode) {
          // User provided a cost code - try to match it
          const matchingCode = fetchedBudgetCodes.find(
            (c) => c.code === lineItem.costCode || c.id === lineItem.costCode,
          );
          if (matchingCode) {
            costCodeId = matchingCode.code;
          } else {
            // Try using the provided code directly (it might be a valid cost_code id)
            costCodeId = lineItem.costCode;
          }
        } else if (fetchedBudgetCodes.length > 0) {
          // No cost code provided but budget codes exist - use the first one
          costCodeId = fetchedBudgetCodes[0].code;
        }
      } catch {
        // If fetching budget codes fails and user provided one, use it directly
        if (lineItem.costCode) {
          costCodeId = lineItem.costCode;
        }
      }

      // If we still don't have a valid cost code, show helpful error
      if (!costCodeId) {
        toast.error("A budget code is required. Use the Budget Code field in the panel below to select one, or create a new budget code first.", {
          duration: 6000,
        });
        throw new Error("Budget code is required");
      }

      const payload = {
        lineItems: [{
          costCodeId: costCodeId,
          costType: null,
          qty: "",
          uom: null,
          unitCost: "",
          amount: amount.toString(),
          description: lineItem.description,
        }]
      };

      await apiFetch(`/api/projects/${projectId}/budget`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });

      // Refresh the budget data
      await handleLineItemSuccess();
    } catch (error) {
      throw error;
    }
  }, [projectId, handleLineItemSuccess]);

  const handleInlineCreateMultipleLineItems = React.useCallback(async (lineItems: InlineLineItemData[]) => {
    try {
      const payload = {
        lineItems: lineItems.map((item) => ({
          costCodeId: item.costCodeId,
          costType: item.costTypeId ?? null,
          qty: item.qty,
          uom: item.uom,
          unitCost: item.unitCost,
          amount: item.amount,
        })),
      };

      await apiFetch(`/api/projects/${projectId}/budget`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      // Refresh the budget data
      await handleLineItemSuccess();
      toast.success(`Created ${lineItems.length} budget line item${lineItems.length > 1 ? "s" : ""}`);
    } catch (error) {
      throw error;
    }
  }, [projectId, handleLineItemSuccess]);

  // Keyboard shortcuts
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle shortcuts when typing in inputs/textareas
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) {
        return;
      }

      // Escape: Close any open modals (only if one is actually open)
      if (e.key === "Escape") {
        const hasOpenModal =
          showLineItemModal ||
          showModificationModal ||
          showImportModal ||
          showEditModal ||
          showDeleteDialog;

        if (hasOpenModal) {
          setShowLineItemModal(false);
          setShowModificationModal(false);
          setShowImportModal(false);
          setShowEditModal(false);
          setShowDeleteDialog(false);
        }
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showLineItemModal, showModificationModal, showImportModal, showEditModal, showDeleteDialog]);

  const handleModificationSuccess = () => {
    // Refresh budget data after creating modification
    void handleLineItemSuccess();
    router.push(`/${projectId}/budget?tab=budget-changes`);
  };

  const handleEditLineItem = (lineItem: BudgetLineItem) => {
    if (isLocked) {
      toast.error("Budget is locked. Unlock to edit line items.");
      return;
    }
    setSelectedLineItem(lineItem);
    setShowEditModal(true);
  };

  // Modal handlers for budget column clicks
  const handleBudgetModificationsClick = (lineItem: BudgetLineItem) => {
    setSelectedLineItem(lineItem);
    setShowBudgetModificationsModal(true);
  };

  const handleApprovedCOsClick = (lineItem: BudgetLineItem) => {
    setSelectedLineItem(lineItem);
    setShowApprovedCOsModal(true);
  };

  const handleJobToDateCostDetailClick = (lineItem: BudgetLineItem) => {
    setSelectedLineItem(lineItem);
    setShowJobToDateCostDetailModal(true);
  };

  const handleDirectCostsClick = (lineItem: BudgetLineItem) => {
    setSelectedLineItem(lineItem);
    setShowDirectCostsModal(true);
  };

  const handlePendingChangesClick = (lineItem: BudgetLineItem) => {
    setSelectedLineItem(lineItem);
    setShowPendingChangesModal(true);
  };

  const handleCommittedCostsClick = (lineItem: BudgetLineItem) => {
    setSelectedLineItem(lineItem);
    setShowCommittedCostsModal(true);
  };

  const handlePendingCostChangesClick = (lineItem: BudgetLineItem) => {
    setSelectedLineItem(lineItem);
    setShowPendingCostChangesModal(true);
  };

  const handleForecastToCompleteClick = (lineItem: BudgetLineItem) => {
    setSelectedLineItem(lineItem);
    setShowForecastToCompleteModal(true);
  };

  const handleForecastSave = async (data: {
    budgetLineId: string;
    forecastMethod: string;
    forecastAmount: number;
    notes?: string | null;
    lineItems?: Array<{
      id?: string;
      description: string;
      quantity: number;
      units: string;
      unitCost: number;
      utilizationRate?: number | null;
      startDate?: string | null;
      endDate?: string | null;
      unitsRemainingMode?: "weeks" | "months";
      sortOrder?: number;
    }>;
  }) => {
    try {
      await apiFetch(`/api/projects/${projectId}/budget/forecast`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });
      toast.success("Forecast saved successfully");
      await handleLineItemSuccess();
    } catch (error) {
      toast.error("Failed to save forecast", {
        description:
          error instanceof Error ? error.message : "An unexpected error occurred.",
      });
      throw error;
    }
  };

  const handleSelectionChange = React.useCallback((ids: string[]) => {
    setSelectedIds(ids);
  }, []);

  const handleDeleteSelected = () => {
    if (isLocked) {
      toast.error("Budget is locked. Unlock to delete line items.");
      return;
    }
    if (selectedIds.length === 0) return;
    setShowDeleteDialog(true);
  };

  // Per-row delete (Procore-parity tests 1.3.1–1.3.4). Surfaces the real
  // server reason on 409 (LINE_HAS_BUDGET, LINE_HAS_ACTIVE_MODIFICATIONS,
  // BUDGET_LOCKED) so users know exactly what's blocking the delete.
  const handleDeleteLineItem = React.useCallback(
    async (lineItem: BudgetLineItem) => {
      if (isLocked) {
        toast.error("Budget is locked. Unlock to delete line items.");
        return;
      }
      const original = Number(lineItem.originalBudgetAmount ?? 0);
      if (original !== 0) {
        toast.error("Cannot delete a line with an original budget", {
          description:
            "Use a budget modification to remove or zero out funded lines.",
        });
        return;
      }
      const label = lineItem.description || lineItem.costCode || "this line item";
      const ok = await confirm({
        description: `Delete "${label}"? This cannot be undone.`,
        variant: "destructive",
        confirmLabel: "Delete",
      });
      if (!ok) return;

      try {
        await apiFetch(
          `/api/projects/${projectId}/budget/lines/${lineItem.id}`,
          { method: "DELETE" },
        );
        toast.success("Line item deleted");
        await handleLineItemSuccess();
      } catch (error) {
        toast.error("Could not delete line item", {
          description:
            error instanceof Error
              ? error.message
              : "An unexpected error occurred — please try again.",
        });
      }
    },
    [confirm, isLocked, projectId, handleLineItemSuccess],
  );

  const confirmDeleteSelected = async () => {
    if (selectedIds.length === 0) return;

    setDeleting(true);
    try {
      // Sensitive write path: delete failures must surface the real server reason instead of collapsing into a partial-success shrug.
      const deletePromises = selectedIds.map((id) =>
        apiFetch(`/api/projects/${projectId}/budget/lines/${id}`, {
          method: "DELETE",
        }),
      );

      const results = await Promise.allSettled(deletePromises);
      const { succeeded, failed, firstError } = summarizeBulkResults(results);

      if (failed === 0) {
        toast.success(
          `${selectedIds.length} line item(s) deleted successfully`,
        );
        setSelectedIds([]);
        await handleLineItemSuccess();
      } else {
        if (succeeded > 0) {
          toast.error(`Deleted ${succeeded} line item(s), but ${failed} failed`, {
            description: firstError,
          });
          setSelectedIds([]);
          await handleLineItemSuccess();
        } else {
          toast.error("Failed to delete line items", {
            description: firstError,
          });
        }
      }
    } catch (error) {
      toast.error("Failed to delete line items", {
        description:
          error instanceof Error ? error.message : "An unexpected error occurred.",
      });
    } finally {
      setDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  const handleEditSave = async (data: {
    unitQty: number;
    uom: string;
    unitCost: number;
    originalBudget: number;
  }) => {
    if (!selectedLineItem) return;

    try {
      // Sensitive write path: preserve actionable server errors so failed budget edits stay visible and traceable.
      await updateBudgetLineItem(projectId, selectedLineItem.id, {
        quantity: data.unitQty,
        uom: data.uom,
        unitCost: data.unitCost,
        originalAmount: data.originalBudget,
      });
      toast.success("Line item updated successfully");
      await handleLineItemSuccess();
    } catch (error) {
      toast.error("Failed to update budget", {
        description: formatBudgetUpdateError(error),
      });

      throw error instanceof Error
        ? error
        : new Error("Failed to update budget");
    }
  };

  return (
    <>
      <div className="px-4 pt-0.5 sm:px-6 sm:pt-1 lg:px-8">
        <BudgetPageHeader
          title="Budget"
          isLocked={isLocked}
          lockedAt={lockedAt}
          lockedBy={lockedBy}
          onCreateClick={handleCreateClick}
          onCreateSnapshot={handleCreateSnapshot}
          onModificationClick={handleModificationClick}
          onLockBudget={handleLockBudget}
          onUnlockBudget={handleUnlockBudget}
          onImport={handleImport}
          onImportFromContract={handleImportFromContract}
          onExport={handleExport}
          onOpenBuyoutSummaryReport={handleOpenBuyoutSummaryReport}
          onOpenLegacyBudgetDetailReport={handleOpenLegacyBudgetDetailReport}
          onOpenMonitoredResourcesReport={handleOpenMonitoredResourcesReport}
          onOpenCustomReports={handleOpenCustomReports}
          onOpenErpIntegrations={handleOpenErpIntegrations}
          onConfigureBudgetViews={handleConfigureBudgetViews}
        />
      </div>

      <BudgetTabs
        activeTab={activeTab}
        onTabChange={handleTabChange}
        controls={
          showBudgetChangesControls ? (
            <div
              id={BUDGET_CHANGES_TOOLBAR_SLOT_ID}
              className="flex min-w-0 items-center"
            />
          ) : showViewControls ? (
            <BudgetFilters
              snapshots={budgetSnapshots}
              groups={budgetGroups}
              selectedSnapshot={selectedSnapshot}
              selectedGroup={selectedGroup}
              columnControlsSlotId={BUDGET_COLUMN_CONTROLS_SLOT_ID}
              onSnapshotChange={setSelectedSnapshot}
              onGroupChange={setSelectedGroup}
              onToggleFullscreen={handleToggleFullscreen}
              onQuickFilterChange={handleQuickFilterChange}
              activeQuickFilter={quickFilter}
              isFullscreen={isFullscreen}
              budgetViews={budgetViews}
              activeViewId={activeViewId}
              onViewChange={setActiveViewId}
            />
          ) : null
        }
      />

      <div className="flex min-h-0 flex-1 flex-col gap-4 bg-background px-4 pt-2 pb-6 sm:px-6 lg:px-8">
        {activeTab === "settings" ? (
          <div className="flex-1 p-6">
            <BudgetSettingsPanel projectId={projectId} />
          </div>
        ) : activeTab === "cost-codes" ? (
          <div className="flex-1 p-6">
            <CostCodesTab projectId={projectId} onSave={fetchBudgetData} />
          </div>
        ) : activeTab === "forecasting" ? (
          <div className="flex-1">
            <ForecastingTab projectId={projectId} />
          </div>
        ) : activeTab === "snapshots" ? (
          <div className="flex-1">
            <SnapshotsTab key={`${projectId}-${snapshotsRefreshToken}`} projectId={projectId} />
          </div>
        ) : activeTab === "change-history" ? (
          <div className="flex-1">
            <ChangeHistoryTab projectId={projectId} />
          </div>
        ) : activeTab === "budget-changes" ? (
          <div className="flex min-h-0 flex-1 flex-col">
            <BudgetChangesTab
              projectId={projectId}
              onModificationChanged={handleLineItemSuccess}
              toolbarSlotId={BUDGET_CHANGES_TOOLBAR_SLOT_ID}
            />
          </div>
        ) : activeTab === "budget-details" ? (
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
            <BudgetDetailsTable
              data={budgetDetailsData}
              loading={detailsLoading}
            />
          </div>
        ) : (
          <div className="flex min-h-0 min-w-0 flex-1 -mx-4 sm:-mx-6 lg:-mx-8">
            <div className="flex min-h-0 min-w-0 flex-1 flex-col">
              {/* Selection action bar */}
              {selectedIds.length > 0 && !isLocked && (
                /* eslint-disable-next-line design-system/require-info-alert -- selection action bar with destructive control, not an informational callout */
                <div className="flex items-center gap-4 px-4 py-2 mb-4 bg-primary/5 border border-primary/20 rounded-lg">
                  <span className="text-sm text-primary font-medium">
                    {selectedIds.length} item(s) selected
                  </span>
                  <PermissionGate projectId={projectId} module="budget" level="admin">
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={handleDeleteSelected}
                      disabled={isLocked}
                    >
                      <Trash2 className="w-4 h-4 mr-1" />
                      Delete Selected
                    </Button>
                  </PermissionGate>
                </div>
              )}

              <Suspense
                fallback={
                  <BudgetTableSkeleton />
                }
              >
                {loading ? (
                  <BudgetTableSkeleton />
                ) : (
                  <BudgetTableCommentsWrapper projectId={projectId}>
                    <BudgetTable
                      data={filteredData}
                      grandTotals={displayedGrandTotals}
                      isLocked={isLocked}
                      onEditLineItem={handleEditLineItem}
                      onDeleteLineItem={handleDeleteLineItem}
                      onSelectionChange={handleSelectionChange}
                      projectId={projectId}
                      onBudgetModificationsClick={handleBudgetModificationsClick}
                      onApprovedCOsClick={handleApprovedCOsClick}
                      onJobToDateCostDetailClick={handleJobToDateCostDetailClick}
                      onDirectCostsClick={handleDirectCostsClick}
                      onPendingChangesClick={handlePendingChangesClick}
                      onCommittedCostsClick={handleCommittedCostsClick}
                      onPendingCostChangesClick={handlePendingCostChangesClick}
                      onForecastToCompleteClick={handleForecastToCompleteClick}
                      columnControlsPortalId={BUDGET_COLUMN_CONTROLS_SLOT_ID}
                      columnVisibilityOverride={activeViewColumnVisibility}
                    />
                  </BudgetTableCommentsWrapper>
                )}
              </Suspense>
            </div>
          </div>
        )}
      </div>

      <BudgetLineItemModalAnimated
        open={showLineItemModal}
        onOpenChange={setShowLineItemModal}
        projectId={projectId}
        onSuccess={handleLineItemSuccess}
      />
      <BudgetModificationModal
        open={showModificationModal}
        onOpenChange={setShowModificationModal}
        projectId={projectId}
        onSuccess={handleModificationSuccess}
      />
      <ImportBudgetModal
        open={showImportModal}
        onOpenChange={setShowImportModal}
        projectId={projectId}
        onSuccess={handleLineItemSuccess}
      />
      <ImportFromContractModal
        open={showImportFromContractModal}
        onOpenChange={setShowImportFromContractModal}
        projectId={projectId}
        onSuccess={handleLineItemSuccess}
      />

      {/* Add Budget Line Items Modal */}
      <BudgetLineItemCreatorModal
        projectId={projectId}
        isOpen={showInlineCreate}
        onClose={() => setShowInlineCreate(false)}
        onCreate={handleInlineCreateMultipleLineItems}
        isLocked={isLocked}
        requireZeroAmount={newLinePolicy.requireZeroAmount}
      />

      {/* Edit Original Budget Modal */}
      {selectedLineItem && (
        <OriginalBudgetEditModal
          open={showEditModal}
          onClose={() => {
            setShowEditModal(false);
            setSelectedLineItem(null);
          }}
          lineItem={{
            id: selectedLineItem.id,
            description: selectedLineItem.description,
            costCode: selectedLineItem.costCode,
            originalBudgetAmount: selectedLineItem.originalBudgetAmount,
            unitQty: selectedLineItem.unitQty,
            uom: selectedLineItem.uom,
            unitCost: selectedLineItem.unitCost,
            children: selectedLineItem.children,
          }}
          projectId={projectId}
          onSave={handleEditSave}
        />
      )}

      {/* Budget Column Detail Modals */}
      {selectedLineItem && (
        <>
          <BudgetModificationsModal
            open={showBudgetModificationsModal}
            onClose={() => {
              setShowBudgetModificationsModal(false);
              setSelectedLineItem(null);
            }}
            costCode={selectedLineItem.costCode}
            budgetLineId={selectedLineItem.id}
            projectId={projectId}
            onModificationChanged={handleLineItemSuccess}
          />

          <ApprovedCOsModal
            open={showApprovedCOsModal}
            onClose={() => {
              setShowApprovedCOsModal(false);
              setSelectedLineItem(null);
            }}
            costCode={selectedLineItem.costCode}
            budgetLineId={selectedLineItem.id}
            projectId={projectId}
          />

          <JobToDateCostDetailModal
            open={showJobToDateCostDetailModal}
            onClose={() => {
              setShowJobToDateCostDetailModal(false);
              setSelectedLineItem(null);
            }}
            costCode={selectedLineItem.costCode}
            budgetLineId={selectedLineItem.id}
            projectId={projectId}
          />

          <DirectCostsModal
            open={showDirectCostsModal}
            onClose={() => {
              setShowDirectCostsModal(false);
              setSelectedLineItem(null);
            }}
            costCode={selectedLineItem.costCode}
            budgetLineId={selectedLineItem.id}
            projectId={projectId}
          />

          <PendingBudgetChangesModal
            open={showPendingChangesModal}
            onClose={() => {
              setShowPendingChangesModal(false);
              setSelectedLineItem(null);
            }}
            costCode={selectedLineItem.costCode}
            budgetLineId={selectedLineItem.id}
            projectId={projectId}
          />

          <CommittedCostsModal
            open={showCommittedCostsModal}
            onClose={() => {
              setShowCommittedCostsModal(false);
              setSelectedLineItem(null);
            }}
            costCode={selectedLineItem.costCode}
            budgetLineId={selectedLineItem.id}
            projectId={projectId}
          />

          <PendingCostChangesModal
            open={showPendingCostChangesModal}
            onClose={() => {
              setShowPendingCostChangesModal(false);
              setSelectedLineItem(null);
            }}
            costCode={selectedLineItem.costCode}
            budgetLineId={selectedLineItem.id}
            projectId={projectId}
          />

          <ForecastToCompleteModal
            open={showForecastToCompleteModal}
            onClose={() => {
              setShowForecastToCompleteModal(false);
              setSelectedLineItem(null);
            }}
            costCode={selectedLineItem.costCode}
            budgetLineId={selectedLineItem.id}
            projectId={projectId}
            currentData={{
              forecastMethod: selectedLineItem.forecastMethod ?? "automatic",
              forecastAmount: selectedLineItem.forecastToComplete ?? undefined,
              projectedBudget: selectedLineItem.projectedBudget ?? undefined,
              projectedCosts: selectedLineItem.projectedCosts ?? undefined,
              notes: selectedLineItem.forecastNotes ?? undefined,
            }}
            onSave={handleForecastSave}
          />
        </>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Line Items</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedIds.length} selected line
              item(s)? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteSelected}
              disabled={deleting}
              className="bg-destructive hover:bg-destructive/90 focus:ring-destructive"
            >
              {deleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Unlock Budget Dialog */}
      <UnlockBudgetDialog
        open={showUnlockDialog}
        onOpenChange={setShowUnlockDialog}
        projectId={projectId}
        onUnlockSuccess={handleUnlockSuccess}
      />

      {/* Financial Views Modal */}
      <BudgetViewsModal
        open={showViewsModal}
        onOpenChange={setShowViewsModal}
        projectId={projectId}
        mode="create"
        onSuccess={() => { setShowViewsModal(false); fetchBudgetViews(); }}
      />
      {ConfirmDialog}
    </>
  );
}

export default function ProjectBudgetPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-1 flex-col gap-4 p-6">
          <div className="flex items-center gap-4">
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-6 w-20" />
          </div>
          <BudgetTableSkeleton />
        </div>
      }
    >
      <BudgetPageContent />
    </Suspense>
  );
}
