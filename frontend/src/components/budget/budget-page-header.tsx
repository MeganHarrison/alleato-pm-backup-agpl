"use client";

import * as React from "react";
import {
  Plus,
  RefreshCw,
  Unlock,
  Lock,
  Download,
  Upload,
  MoreVertical,
  ChevronDown,
  AlertTriangle,
  Camera,
  FilePlus,
  FileSearch,
  BarChart2,
  FileText,
  Activity,
  PieChart,
  Plug,
  SlidersHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { PageHeader } from "@/components/layout/page-header-unified";
import { cn } from "@/lib/utils";

interface BudgetPageHeaderProps {
  title?: string;
  isLocked?: boolean;
  lockedAt?: string | null;
  lockedBy?: string | null;
  onCreateClick?: () => void;
  onCreateSnapshot?: () => void;
  onModificationClick?: () => void;
  onResendToERP?: () => void;
  onLockBudget?: () => void;
  onUnlockBudget?: () => void;
  onImport?: () => void;
  onImportFromContract?: () => void;
  onExport?: (format: string) => void;
  onOpenBuyoutSummaryReport?: () => void;
  onOpenLegacyBudgetDetailReport?: () => void;
  onOpenMonitoredResourcesReport?: () => void;
  onOpenCustomReports?: () => void;
  onOpenErpIntegrations?: () => void;
  onConfigureBudgetViews?: () => void;
}

export function BudgetPageHeader({
  title = "Budget",
  isLocked = false,
  lockedAt,
  lockedBy,
  onCreateClick,
  onCreateSnapshot,
  onModificationClick,
  onResendToERP,
  onLockBudget,
  onUnlockBudget,
  onImportFromContract,
  onImport,
  onExport,
  onOpenBuyoutSummaryReport,
  onOpenLegacyBudgetDetailReport,
  onOpenMonitoredResourcesReport,
  onOpenCustomReports,
  onOpenErpIntegrations,
  onConfigureBudgetViews,
}: BudgetPageHeaderProps) {
  const [showLockDialog, setShowLockDialog] = React.useState(false);
  const canSyncToErp = Boolean(onResendToERP);

  const handleLockConfirm = () => {
    onLockBudget?.();
    setShowLockDialog(false);
  };

  const lockStateClassName = isLocked
    ? "h-9 border-red-200/80 bg-background px-3 text-red-700 hover:bg-red-50 hover:text-red-800"
    : "h-9 border-green-200/80 bg-background px-3 text-green-700 hover:bg-green-50 hover:text-green-800";
  const LockStateIcon = isLocked ? Lock : Unlock;
  const lockStateLabel = isLocked ? "Locked" : "Unlocked";
  const lockActionLabel = isLocked
    ? "Budget locked. Click to unlock budget."
    : "Budget unlocked. Click to lock budget.";
  const primaryActionClassName =
    "h-9 rounded-md px-4 text-sm font-medium";
  const utilityIconButtonClassName =
    "size-9 text-muted-foreground hover:bg-muted hover:text-foreground";

  const renderSnapshotButton = () => (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={utilityIconButtonClassName}
          onClick={onCreateSnapshot}
          aria-label="Create budget snapshot"
        >
          <Camera />
        </Button>
      </TooltipTrigger>
      <TooltipContent>Create a budget snapshot</TooltipContent>
    </Tooltip>
  );

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return "";
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const isUuid = (value: string) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      value.trim(),
    );
  const lockOwnerDisplay = lockedBy && !isUuid(lockedBy) ? lockedBy : null;

  const titleContent = (
    <h1 className="text-2xl sm:text-3xl lg:text-[2rem] font-medium text-foreground/90 break-words">{title}</h1>
  );

  const statusDescription =
    isLocked && lockedAt
      ? `Locked ${formatDate(lockedAt)}${lockOwnerDisplay ? ` by ${lockOwnerDisplay}` : ""}`
      : undefined;
  const lockTooltip = statusDescription ?? lockActionLabel;

  const lockStateButton = (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          onClick={isLocked ? onUnlockBudget : () => setShowLockDialog(true)}
          className={lockStateClassName}
          aria-label={lockTooltip}
        >
          <LockStateIcon />
          <span>{lockStateLabel}</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent>{lockTooltip}</TooltipContent>
    </Tooltip>
  );

  const actionButtons = (
    <div className="flex w-full gap-2 min-w-0">
      {/* Mobile: Show primary actions and bundle others in dropdown */}
      <div className="flex flex-wrap gap-2 sm:hidden w-full">
        {isLocked ? (
          <Button
            size="sm"
            className="bg-primary text-primary-foreground hover:bg-primary/90 flex-1"
            onClick={onModificationClick}
          >
            <Plus />
            Budget Change
          </Button>
        ) : (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="sm"
                className="bg-primary text-primary-foreground hover:bg-primary/90 flex-1"
              >
                <Plus />
                Create
                <ChevronDown />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onCreateClick}>
                <FilePlus className="w-4 h-4 mr-2" />
                Budget Line Item
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onImport}>
                <Upload className="w-4 h-4 mr-2" />
                Import from File
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onImportFromContract}>
                <FileSearch className="w-4 h-4 mr-2" />
                Import from Prime Contract SOV
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {renderSnapshotButton()}

        {/* More Actions Dropdown for Mobile — icon-only trigger, no border */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label="More actions"
              className="shrink-0"
            >
              <MoreVertical />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem
              onClick={onResendToERP}
              disabled={!canSyncToErp}
              title={
                canSyncToErp
                  ? undefined
                  : "ERP sync is not configured for this budget yet."
              }
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Sync to ERP
            </DropdownMenuItem>
            {isLocked ? (
              <DropdownMenuItem onClick={onUnlockBudget} className="text-red-700">
                <Lock className="w-4 h-4 mr-2" />
                Budget Locked
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onClick={() => setShowLockDialog(true)} className="text-green-700">
                <Unlock className="w-4 h-4 mr-2" />
                Budget Unlocked
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onExport?.("excel")}>
              <Download className="w-4 h-4 mr-2" />
              Export to Excel
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onExport?.("csv")}>
              <Download className="w-4 h-4 mr-2" />
              Export to CSV
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onExport?.("pdf")}>
              <FileText className="w-4 h-4 mr-2" />
              Export to PDF
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <BarChart2 className="w-4 h-4 mr-2" />
                Budget Reports
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuItem onClick={onOpenBuyoutSummaryReport}>
                  <FileText className="w-4 h-4 mr-2" />
                  Buyout Summary Report
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onOpenLegacyBudgetDetailReport}>
                  <FileText className="w-4 h-4 mr-2" />
                  Legacy Budget Detail
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onOpenMonitoredResourcesReport}>
                  <Activity className="w-4 h-4 mr-2" />
                  Monitored Resources Report
                </DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuItem onClick={onOpenCustomReports}>
              <PieChart className="w-4 h-4 mr-2" />
              Custom Reports
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onOpenErpIntegrations}>
              <Plug className="w-4 h-4 mr-2" />
              ERP Integrations
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onConfigureBudgetViews}>
              <SlidersHorizontal className="w-4 h-4 mr-2" />
              Configure Budget Views
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Desktop: Show all buttons */}
      <div className="hidden items-center justify-end gap-3 sm:flex">
        {isLocked ? (
          <Button
            className={cn(
              "bg-primary text-primary-foreground hover:bg-primary/90",
              primaryActionClassName,
            )}
            onClick={onModificationClick}
          >
            <Plus />
            Budget Change
          </Button>
        ) : (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                className={cn(
                  "bg-primary text-primary-foreground hover:bg-primary/90",
                  primaryActionClassName,
                )}
              >
                <Plus />
                Create
                <ChevronDown />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onCreateClick}>
                <FilePlus className="w-4 h-4 mr-2" />
                Budget Line Item
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onImport}>
                <Upload className="w-4 h-4 mr-2" />
                Import from File
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onImportFromContract}>
                <FileSearch className="w-4 h-4 mr-2" />
                Import from Prime Contract SOV
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        <div className="flex items-center gap-1">
          {/* Lock/Unlock Budget State Button */}
          {lockStateButton}

          {renderSnapshotButton()}

          {/* Sync + Export */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={utilityIconButtonClassName}
                onClick={onResendToERP}
                disabled={!canSyncToErp}
                title={
                  canSyncToErp
                    ? undefined
                    : "ERP sync is not configured for this budget yet."
                }
                aria-label="Sync to ERP"
              >
                <RefreshCw />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Sync to ERP</TooltipContent>
          </Tooltip>

          {/* Export Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={utilityIconButtonClassName}
                aria-label="Export"
                title="Export"
              >
                <Download />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onExport?.("excel")}>
                Export to Excel
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onExport?.("csv")}>
                Export to CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onExport?.("pdf")}>
                Export to PDF
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* More Options */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={utilityIconButtonClassName}
                aria-label="More budget actions"
              >
                <MoreVertical />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>Budget Reports</DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  <DropdownMenuItem onClick={onOpenBuyoutSummaryReport}>
                    Buyout Summary Report
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={onOpenLegacyBudgetDetailReport}>
                    Legacy Budget Detail
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={onOpenMonitoredResourcesReport}>
                    Monitored Resources Report
                  </DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>Custom Reports</DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  <DropdownMenuItem onClick={onOpenCustomReports}>
                    Open Custom Reports
                  </DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>ERP Integrations</DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  <DropdownMenuItem onClick={onOpenErpIntegrations}>
                    Open ERP Integrations
                  </DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuItem onClick={onConfigureBudgetViews}>
                Configure Budget Views
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

      </div>
    </div>
  );

  return (
    <>
      <PageHeader
        title={title}
        variant="budget"
        titleContent={titleContent}
        actions={actionButtons}
      />

      {/* Lock Budget Confirmation Dialog */}
      <AlertDialog open={showLockDialog} onOpenChange={setShowLockDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Lock className="w-5 h-5" />
              Lock Budget
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to lock the budget for this project?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="rounded-md border bg-muted p-4">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-5 w-5" />
              <div className="text-sm">
                <p className="font-medium text-foreground">
                  What happens when you lock:
                </p>
                <ul className="mt-1 list-disc space-y-1 pl-5 text-muted-foreground">
                  <li>Budget line items cannot be added, edited, or deleted</li>
                  <li>Original budget amounts become read-only</li>
                  <li>Changes can only be made through approved change orders</li>
                  <li>Budget changes must be made through budget modifications</li>
                </ul>
              </div>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleLockConfirm}>
              Lock Budget
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </>
  );
}
