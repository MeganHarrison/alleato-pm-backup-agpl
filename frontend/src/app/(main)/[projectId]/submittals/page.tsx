"use client";

import * as React from "react";
import type { ReactElement, ReactNode } from "react";
import {
  useParams,
  usePathname,
  useRouter,
  useSearchParams,
} from "next/navigation";
import {
  Check,
  ChevronDown,
  ChevronsUpDown,
  Download,
  FileText,
  MoreVertical,
  Plus,
  RotateCcw,
  Save,
  Settings,
  Table2,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { apiFetch } from "@/lib/api-client";
import { handleFormError } from "@/lib/handle-form-error";
import { reportNonCriticalFailure } from "@/lib/report-non-critical-failure";
import {
  UnifiedTablePage,
  useUnifiedTableState,
  type FilterValue,
  type TableColumn,
} from "@/components/tables/unified";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useProjectTitle } from "@/hooks/useProjectTitle";
import {
  InlineTable,
  InlineTableBody,
  InlineTableCell,
  InlineTableHeader,
  InlineTableHeaderCell,
  InlineTableHeaderRow,
  InlineTableRow,
} from "@/components/ds";
import { ExpandableSearch } from "@/components/tables/unified/table-toolbar";
import { PageShell, PageTabs } from "@/components/layout";
import { SectionRuleHeading } from "@/components/layout/spacing";
import { FormSection, ToggleField } from "@/components/forms";
import {
  useSubmittals,
  useDeleteSubmittal,
  usePackages,
  useCreatePackage,
  useUpdatePackage,
  useDeletePackage,
  type SubmittalSummary,
  type PackageRow,
} from "@/hooks/use-submittals";
import {
  buildSubmittalTableColumns,
  submittalColumns,
  submittalDefaultVisibleColumns,
  submittalFilters,
  renderSubmittalCard,
  renderSubmittalList,
  type SubmittalTableRow,
} from "@/features/submittals/submittals-table-config";
import { useConfirm } from "@/hooks/use-confirm";
import { useContacts } from "@/hooks/use-contacts";
import {
  useDirectoryPermissions,
  type PermissionLevel,
} from "@/hooks/use-directory-permissions";
import {
  normalizeWorkflowTemplateRecord,
  type WorkflowTemplateRecord,
  type WorkflowTemplateStepDefinition,
} from "@/lib/submittals/workflow-template-utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScanDrawingsSheet } from "@/features/submittals/scan-drawings-sheet";
import { cn } from "@/lib/utils";

type SubmittalFilterState = Record<string, FilterValue>;

type SubmittalSettings = {
  project_id: number;
  default_submittal_manager_id: string | null;
  default_distribution: string | null;
  package_sort_order: "ascending" | "descending";
  default_submit_response_days: number;
  include_spec_section_number: boolean;
  submittals_private_by_default: boolean;
  allow_approvers_to_add_reviewers: boolean;
  approver_responses_required_by_default: boolean;
  enable_reject_workflow: boolean;
  enable_dynamic_approver_due_dates: boolean;
  enable_overdue_email_reminders: boolean;
  enable_qr_codes: boolean;
  enable_schedule_calculations: boolean;
  allow_email_attachment_download_without_login: boolean;
  email_notify_submittal_created: boolean;
  email_notify_submittal_updated: boolean;
  email_notify_submittal_distributed: boolean;
  email_notify_submittal_closed: boolean;
  updated_at: string | null;
};

type SubmittalSettingsKey = keyof Omit<
  SubmittalSettings,
  "project_id" | "updated_at"
>;

type SubmittalsPageTab = {
  label: string;
  href: string;
  count?: number;
  isActive?: boolean;
  testId?: string;
};

type SubmittalSettingsSection =
  | "general"
  | "responses"
  | "workflow-templates"
  | "replace-workflow-user"
  | "imports"
  | "custom-reports"
  | "permissions";

type EmailNotificationRole =
  | "creator"
  | "manager"
  | "submitter"
  | "approver"
  | "reviewer"
  | "distribution";

type EmailNotificationRow = {
  event: string;
} & Record<EmailNotificationRole, boolean>;

type ProjectDirectoryOption = {
  value: string;
  label: string;
  email?: string;
  keywords?: string[];
};

const WORKFLOW_TEMPLATE_ROLE_OPTIONS: WorkflowTemplateStepDefinition["step_type"][] =
  ["Submitter", "Approver"];

const SETTINGS_TAB_PARAM = "settings_tab";

const SUBMITTAL_SETTINGS_TABS: Array<{
  label: string;
  value: SubmittalSettingsSection;
}> = [
  { label: "General", value: "general" },
  { label: "Responses", value: "responses" },
  { label: "Workflow Templates", value: "workflow-templates" },
  { label: "Replace Workflow User", value: "replace-workflow-user" },
  { label: "Imports", value: "imports" },
  { label: "Custom Reports", value: "custom-reports" },
  { label: "Permissions", value: "permissions" },
];

const WORKFLOW_RESPONSE_ROWS = [
  ["Approved", "Approved"],
  ["Approved As Noted", "Approved as Noted"],
  ["For Record Only", "For Record Only"],
  ["Pending", "Pending"],
  ["Rejected", "Rejected"],
  ["Revise And Resubmit", "Revise and Resubmit"],
  ["Submitted", "Submitted"],
  ["Void", "Void"],
] as const;

const EMAIL_NOTIFICATION_ROWS: EmailNotificationRow[] = [
  {
    event: "Submittal Created",
    creator: false,
    manager: true,
    submitter: false,
    approver: false,
    reviewer: false,
    distribution: true,
  },
  {
    event: '"Submitter" Role Submits (via Workflow)',
    creator: false,
    manager: true,
    submitter: false,
    approver: false,
    reviewer: false,
    distribution: false,
  },
  {
    event: '"Approver" Role Responds (via Workflow)',
    creator: false,
    manager: true,
    submitter: false,
    approver: true,
    reviewer: false,
    distribution: true,
  },
  {
    event: '"Reviewer" Responds (via Workflow)',
    creator: false,
    manager: false,
    submitter: false,
    approver: true,
    reviewer: false,
    distribution: false,
  },
  {
    event: "Submittal Closed (Not Distributed)",
    creator: false,
    manager: true,
    submitter: false,
    approver: false,
    reviewer: false,
    distribution: false,
  },
  {
    event: "Submittal Distributed",
    creator: false,
    manager: true,
    submitter: true,
    approver: false,
    reviewer: false,
    distribution: true,
  },
  {
    event: "Submittal Updated",
    creator: false,
    manager: false,
    submitter: false,
    approver: false,
    reviewer: false,
    distribution: true,
  },
];

function getSettingsSection(value: string | null): SubmittalSettingsSection {
  return (
    SUBMITTAL_SETTINGS_TABS.find((tab) => tab.value === value)?.value ??
    "general"
  );
}

function parseDefaultDistributionSelection(
  value: string | null,
  options: ProjectDirectoryOption[],
): string[] {
  if (!value) return [];

  const validOptionIds = new Set(options.map((option) => option.value));

  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed.filter(
        (candidate): candidate is string =>
          typeof candidate === "string" && validOptionIds.has(candidate),
      );
    }
  } catch (error) {
    reportNonCriticalFailure({
      area: "submittals.default-distribution",
      operation: "parse-default-distribution",
      error,
      userVisibleFallback:
        "Failed to parse saved default submittal distribution as JSON. Falling back to legacy text matching.",
      metadata: {
        valuePreview: value.slice(0, 200),
      },
    });
  }

  const tokens = value
    .split(/[\n,]+/)
    .map((token) => token.trim().toLowerCase())
    .filter(Boolean);

  return options
    .filter((option) => {
      const label = option.label.trim().toLowerCase();
      const email = option.email?.trim().toLowerCase();
      return tokens.some((token) => token === label || token === email);
    })
    .map((option) => option.value);
}

function serializeDefaultDistributionSelection(
  selectedIds: string[],
): string | null {
  return selectedIds.length > 0 ? JSON.stringify(selectedIds) : null;
}

function DefaultDistributionSelect({
  value,
  onChange,
  options,
  isLoading,
}: {
  value: string | null;
  onChange: (value: string | null) => void;
  options: ProjectDirectoryOption[];
  isLoading: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const selectedIds = React.useMemo(
    () => parseDefaultDistributionSelection(value, options),
    [options, value],
  );
  const selectedLabels = React.useMemo(
    () =>
      selectedIds
        .map((selectedId) => options.find((option) => option.value === selectedId))
        .filter((option): option is ProjectDirectoryOption => Boolean(option))
        .map((option) => option.label),
    [options, selectedIds],
  );

  const toggle = React.useCallback(
    (selectedId: string) => {
      const nextSelectedIds = selectedIds.includes(selectedId)
        ? selectedIds.filter((value) => value !== selectedId)
        : [...selectedIds, selectedId];
      onChange(serializeDefaultDistributionSelection(nextSelectedIds));
    },
    [onChange, selectedIds],
  );

  return (
    <div className="space-y-2">
      <Label htmlFor="default-distribution">Default Distribution</Label>
      <p className="text-xs text-muted-foreground">
        People you select will automatically populate on the distribution list
        when new submittals are created.
      </p>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id="default-distribution"
            type="button"
            variant="outline"
            role="combobox"
            disabled={isLoading}
            className={cn(
              "h-auto min-h-10 w-full justify-between px-3 py-2 text-left font-normal",
              selectedLabels.length === 0 && "text-muted-foreground",
            )}
          >
            <span className="truncate">
              {isLoading
                ? "Loading project directory..."
                : selectedLabels.length > 0
                  ? `${selectedLabels.length} selected`
                  : "Select project directory members"}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
          <Command>
            <CommandInput placeholder="Search project directory..." />
            <CommandList className="max-h-72">
              <CommandEmpty>No project directory members found.</CommandEmpty>
              <CommandGroup>
                {options.map((option) => (
                  <CommandItem
                    key={option.value}
                    value={[
                      option.label,
                      option.email ?? "",
                      ...(option.keywords ?? []),
                    ].join(" ")}
                    onSelect={() => toggle(option.value)}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        selectedIds.includes(option.value)
                          ? "opacity-100"
                          : "opacity-0",
                      )}
                    />
                    <div className="min-w-0">
                      <div className="truncate">{option.label}</div>
                      {option.email ? (
                        <div className="truncate text-xs text-muted-foreground">
                          {option.email}
                        </div>
                      ) : null}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {selectedLabels.length > 0 ? (
        <p className="text-xs text-muted-foreground">
          {selectedLabels.join(", ")}
        </p>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Picker types
// ---------------------------------------------------------------------------

interface PackageItem {
  id: string;
  name: string;
  description?: string | null;
}

interface SpecItem {
  id: string;
  section_number: string;
  section_title: string;
  division: string | null;
}

// ---------------------------------------------------------------------------
// PackagePickerDialog
// ---------------------------------------------------------------------------

function PackagePickerDialog({
  projectId,
  open,
  onOpenChange,
  onSelect,
}: {
  projectId: number;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSelect: (pkg: PackageItem) => void;
}) {
  const [search, setSearch] = React.useState("");
  const [packages, setPackages] = React.useState<PackageItem[]>([]);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setLoading(true);
    apiFetch<PackageItem[]>(`/api/projects/${projectId}/submittals/packages`)
      .then((data) => setPackages(data ?? []))
      .catch(() => setPackages([]))
      .finally(() => setLoading(false));
  }, [open, projectId]);

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return packages;
    return packages.filter((p) => p.name.toLowerCase().includes(q));
  }, [packages, search]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Select a Package</DialogTitle>
        </DialogHeader>
        <Input
          placeholder="Search packages..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="mt-1"
          autoFocus
        />
        <ScrollArea className="mt-2 h-64">
          {loading ? (
            <div className="space-y-1.5 px-1 py-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-full rounded" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {packages.length === 0
                ? "No packages found for this project."
                : "No packages match your search."}
            </p>
          ) : (
            <div className="flex flex-col gap-0.5 pr-2">
              {filtered.map((pkg) => (
                <Button
                  key={pkg.id}
                  variant="ghost"
                  className="w-full justify-start rounded px-3 py-2 text-left text-sm h-auto"
                  onClick={() => {
                    onSelect(pkg);
                    onOpenChange(false);
                  }}
                >
                  <span className="font-medium text-foreground">
                    {pkg.name}
                  </span>
                  {pkg.description && (
                    <span className="ml-2 text-xs text-muted-foreground">
                      {pkg.description}
                    </span>
                  )}
                </Button>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// SpecPickerDialog
// ---------------------------------------------------------------------------

function SpecPickerDialog({
  projectId,
  open,
  onOpenChange,
  onSelect,
}: {
  projectId: number;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSelect: (spec: SpecItem) => void;
}) {
  const [search, setSearch] = React.useState("");
  const [specs, setSpecs] = React.useState<SpecItem[]>([]);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setLoading(true);
    apiFetch<SpecItem[]>(`/api/projects/${projectId}/submittals/specs`)
      .then((data) => setSpecs(data ?? []))
      .catch(() => setSpecs([]))
      .finally(() => setLoading(false));
  }, [open, projectId]);

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return specs;
    return specs.filter(
      (s) =>
        s.section_number.toLowerCase().includes(q) ||
        s.section_title.toLowerCase().includes(q) ||
        (s.division ?? "").toLowerCase().includes(q),
    );
  }, [specs, search]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Select a Spec Section</DialogTitle>
        </DialogHeader>
        <Input
          placeholder="Search spec sections..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="mt-1"
          autoFocus
        />
        <ScrollArea className="mt-2 h-64">
          {loading ? (
            <div className="space-y-1.5 px-1 py-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-full rounded" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {specs.length === 0
                ? "No specifications found for this project."
                : "No sections match your search."}
            </p>
          ) : (
            <div className="flex flex-col gap-0.5 pr-2">
              {filtered.map((spec) => (
                <Button
                  key={spec.id}
                  variant="ghost"
                  className="w-full justify-start rounded px-3 py-2 text-left text-sm h-auto"
                  onClick={() => {
                    onSelect(spec);
                    onOpenChange(false);
                  }}
                >
                  <span className="font-medium text-foreground">
                    {spec.section_number} — {spec.section_title}
                  </span>
                  {spec.division && (
                    <span className="ml-2 text-xs text-muted-foreground">
                      {spec.division}
                    </span>
                  )}
                </Button>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

const EMPTY_FILTERS: SubmittalFilterState = {
  status: undefined,
  latest_response: undefined,
  division: undefined,
};

type SubmittalSummaryWithRelations = SubmittalSummary & {
  responsible_contractor?: { name?: string | null } | null;
  submittal_workflow_steps?: {
    step_type: string;
    submittal_responses?: {
      responder_id: string;
      response_status: string;
    }[];
  }[];
};

function getSubmittalColumnValue(
  item: SubmittalTableRow,
  columnId: string,
): unknown {
  return item[columnId as keyof SubmittalTableRow];
}

function toTableRow(item: SubmittalSummary): SubmittalTableRow {
  // Resolve responsible contractor from joined company data
  const itemWithRelations = item as SubmittalSummaryWithRelations;
  const responsibleContractor =
    typeof itemWithRelations.responsible_contractor === "object" &&
    itemWithRelations.responsible_contractor
      ? (itemWithRelations.responsible_contractor.name ?? null)
      : null;

  // Resolve approvers and latest response from joined workflow steps
  const workflowSteps = itemWithRelations.submittal_workflow_steps;

  let approverNames: string | null = null;
  let latestResponse: string | null = null;

  if (workflowSteps?.length) {
    // Collect all approver responder IDs
    const approverIds = new Set<string>();
    for (const step of workflowSteps) {
      for (const resp of step.submittal_responses ?? []) {
        approverIds.add(resp.responder_id);
        // Track latest non-Pending response
        if (resp.response_status && resp.response_status !== "Pending") {
          latestResponse = resp.response_status;
        }
      }
    }
    if (approverIds.size > 0) {
      approverNames = `${approverIds.size} reviewer${approverIds.size > 1 ? "s" : ""}`;
    }
  }

  return {
    id: item.id,
    specification_section: item.specification_section ?? null,
    submittal_number: item.submittal_number ?? "",
    revision: item.revision ?? 0,
    title: item.title ?? "Untitled Submittal",
    submittal_type_name:
      typeof item.submittal_type === "object"
        ? ((item.submittal_type as { name?: string } | null)?.name ?? null)
        : (item.submittal_type ?? null),
    status: item.status ?? "Draft",
    responsible_contractor: responsibleContractor,
    received_from: item.received_from ?? null,
    ball_in_court: item.ball_in_court ?? null,
    approvers: approverNames,
    latest_response: latestResponse,
    sent_date: item.sent_date ?? null,
    is_private: item.is_private ?? false,
    division: item.division ?? null,
    final_due_date: item.final_due_date ?? null,
    deleted_at: item.deleted_at ?? null,
  };
}

// ---------------------------------------------------------------------------
// Inline grouped view component
// ---------------------------------------------------------------------------

function GroupedSubmittalView({
  groups,
  columns,
  onRowClick,
  visibleColumns,
  extraAction,
  groupAction,
}: {
  groups: { label: string; items: SubmittalTableRow[] }[];
  columns: TableColumn<SubmittalTableRow>[];
  onRowClick: (item: SubmittalTableRow) => void;
  visibleColumns: string[];
  extraAction?: (item: SubmittalTableRow) => ReactNode;
  groupAction?: (label: string) => ReactNode;
}) {
  const visibleCols = columns.filter((col) => visibleColumns.includes(col.id));
  const colSpan = visibleCols.length + (extraAction ? 1 : 0);

  if (groups.length === 0) {
    return (
      <div className="py-8 text-sm text-muted-foreground">
        No submittals match the current filters.
      </div>
    );
  }

  return (
    <div className="space-y-6 py-2">
      {groups.map((group) => (
        <section key={group.label} className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground">
              {group.label}
            </span>
            <span className="text-xs text-muted-foreground">
              {group.items.length}
            </span>
            {groupAction && groupAction(group.label)}
          </div>

          <div className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <InlineTable variant="read" tableClassName="min-w-[960px]">
              <InlineTableHeader>
                <InlineTableHeaderRow>
                  {visibleCols.map((col) => (
                    <InlineTableHeaderCell key={col.id}>
                      {col.label}
                    </InlineTableHeaderCell>
                  ))}
                  {extraAction && (
                    <InlineTableHeaderCell>Actions</InlineTableHeaderCell>
                  )}
                </InlineTableHeaderRow>
              </InlineTableHeader>
              <InlineTableBody>
                {group.items.length === 0 ? (
                  <InlineTableRow>
                    <InlineTableCell
                      colSpan={colSpan}
                      className="py-6 text-muted-foreground"
                    >
                      No submittals in this group.
                    </InlineTableCell>
                  </InlineTableRow>
                ) : (
                  group.items.map((item) => (
                    <InlineTableRow
                      key={item.id}
                      className="cursor-pointer transition-colors hover:bg-muted/50"
                      onClick={() => onRowClick(item)}
                    >
                      {visibleCols.map((col) => (
                        <InlineTableCell
                          key={col.id}
                          className="h-9 whitespace-nowrap"
                        >
                          {col.render(item)}
                        </InlineTableCell>
                      ))}
                      {extraAction && (
                        <InlineTableCell
                          className="h-9 whitespace-nowrap"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {extraAction(item)}
                        </InlineTableCell>
                      )}
                    </InlineTableRow>
                  ))
                )}
              </InlineTableBody>
            </InlineTable>
          </div>
        </section>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// PackageManageDialog
// ---------------------------------------------------------------------------

function PackageManageDialog({
  mode,
  initialPackage,
  onClose,
  onCreate,
  onUpdate,
  isPending,
}: {
  mode: "create" | "edit";
  initialPackage: PackageRow | null;
  onClose: () => void;
  onCreate: (name: string, description: string | null) => void;
  onUpdate: (id: string, name: string, description: string | null) => void;
  isPending: boolean;
}) {
  const [name, setName] = React.useState(initialPackage?.name ?? "");
  const [description, setDescription] = React.useState(
    initialPackage?.description ?? "",
  );

  // Reset when dialog opens with a new package
  React.useEffect(() => {
    setName(initialPackage?.name ?? "");
    setDescription(initialPackage?.description ?? "");
  }, [initialPackage]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    if (mode === "create") {
      onCreate(name.trim(), description.trim() || null);
    } else if (initialPackage) {
      onUpdate(initialPackage.id, name.trim(), description.trim() || null);
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "New Package" : "Edit Package"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="mt-2 space-y-3">
          <div className="space-y-1">
            <label
              className="text-xs font-medium text-foreground"
              htmlFor="pkg-name"
            >
              Name <span className="text-destructive">*</span>
            </label>
            <Input
              id="pkg-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Structural Package"
              autoFocus
              required
            />
          </div>
          <div className="space-y-1">
            <label
              className="text-xs font-medium text-foreground"
              htmlFor="pkg-desc"
            >
              Description
            </label>
            <Input
              id="pkg-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
            />
          </div>
          <div className="flex items-center justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={!name.trim() || isPending}
            >
              {mode === "create" ? "Create" : "Save"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ReadOnlyCheck({ checked, label }: { checked: boolean; label: string }) {
  return (
    <Checkbox
      checked={checked}
      disabled
      aria-label={label}
      className="mx-auto"
    />
  );
}

function SettingsTable({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-md border border-border/60">
      {children}
    </div>
  );
}

function SubmittalGeneralSettingsPanel({
  settings,
  update,
  managerOptions,
  contactsLoading,
  projectDirectoryOptions,
  projectDirectoryLoading,
}: {
  settings: SubmittalSettings;
  update: <K extends SubmittalSettingsKey>(
    key: K,
    value: SubmittalSettings[K],
  ) => void;
  managerOptions: Array<{ value: string; label: string; email?: string }>;
  contactsLoading: boolean;
  projectDirectoryOptions: ProjectDirectoryOption[];
  projectDirectoryLoading: boolean;
}) {
  const descriptionTextClassName = "text-xs text-muted-foreground";
  const toggleHintClassName = "text-xs text-muted-foreground";

  return (
    <div className="space-y-8">
      <FormSection
        title="General Settings"
        description={
          <span className={descriptionTextClassName}>
            Project defaults applied when new submittals are created.
          </span>
        }
      >
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="default-submittal-manager">
              Default Submittal Manager
            </Label>
            <Select
              value={settings.default_submittal_manager_id ?? "_none"}
              onValueChange={(value) =>
                update(
                  "default_submittal_manager_id",
                  value === "_none" ? null : value,
                )
              }
              disabled={contactsLoading}
            >
              <SelectTrigger id="default-submittal-manager">
                <SelectValue
                  placeholder={
                    contactsLoading
                      ? "Loading project contacts..."
                      : "Select Submittal Manager"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">No default manager</SelectItem>
                {managerOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.email
                      ? `${option.label} (${option.email})`
                      : option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="package-sort-order">Package Item Sort Order</Label>
            <Select
              value={settings.package_sort_order}
              onValueChange={(value) =>
                update(
                  "package_sort_order",
                  value as SubmittalSettings["package_sort_order"],
                )
              }
            >
              <SelectTrigger id="package-sort-order">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ascending">Ascending</SelectItem>
                <SelectItem value="descending">Descending</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

      </FormSection>

      <FormSection title="Submittal Numbering">
        <ToggleField
          label="Include Spec Section Number"
          hint="Example: the first submittal in spec section 03-3000-Concrete is numbered 03-3000-1."
          hintClassName={toggleHintClassName}
          controlPosition="left"
          checked={settings.include_spec_section_number}
          onCheckedChange={(checked) =>
            update("include_spec_section_number", checked)
          }
        />
      </FormSection>

      <FormSection
        title="Workflow Defaults"
        description={
          <span className={descriptionTextClassName}>
            Defaults for submit/respond due dates and approval routing.
          </span>
        }
      >
        <div className="space-y-2">
          <Label htmlFor="default-submit-response-days">
            Default Number of Days to Submit/Respond
          </Label>
          <p className="max-w-xl text-xs text-muted-foreground">
            Enter the number of working days users in each workflow step have
            to submit/respond.
          </p>
          <Input
            id="default-submit-response-days"
            type="number"
            className="max-w-xs"
            min={0}
            max={365}
            value={settings.default_submit_response_days}
            onChange={(event) =>
              update(
                "default_submit_response_days",
                Number.parseInt(event.target.value || "0", 10),
              )
            }
          />
        </div>

        <div className="space-y-4">
          <ToggleField
            label="Allow approvers to add reviewers"
            hint="Reviewers can view and respond, but cannot add more reviewers."
            hintClassName={toggleHintClassName}
            controlPosition="left"
            checked={settings.allow_approvers_to_add_reviewers}
            onCheckedChange={(checked) =>
              update("allow_approvers_to_add_reviewers", checked)
            }
          />
          <ToggleField
            label="Approver responses are required by default"
            controlPosition="left"
            checked={settings.approver_responses_required_by_default}
            onCheckedChange={(checked) =>
              update("approver_responses_required_by_default", checked)
            }
          />
          <ToggleField
            label="Enable Reject Workflow"
            hint="Reject or Revise and Resubmit responses route Ball in Court to the Submittal Manager for the next step."
            hintClassName={toggleHintClassName}
            controlPosition="left"
            checked={settings.enable_reject_workflow}
            onCheckedChange={(checked) =>
              update("enable_reject_workflow", checked)
            }
          />
          <ToggleField
            label="Enable dynamic approver due dates"
            controlPosition="left"
            checked={settings.enable_dynamic_approver_due_dates}
            onCheckedChange={(checked) =>
              update("enable_dynamic_approver_due_dates", checked)
            }
          />
        </div>
      </FormSection>

      <FormSection
        title="Access and Delivery"
        description={
          <span className={descriptionTextClassName}>
            Privacy, QR codes, and schedule calculation defaults.
          </span>
        }
      >
        <div className="space-y-4">
          <ToggleField
            label="Submittals private by default"
            hint="Limits new submittals to admins, distribution members, and assigned workflow reviewers."
            hintClassName={toggleHintClassName}
            controlPosition="left"
            checked={settings.submittals_private_by_default}
            onCheckedChange={(checked) =>
              update("submittals_private_by_default", checked)
            }
          />
          <ToggleField
            label="Enable QR codes"
            controlPosition="left"
            checked={settings.enable_qr_codes}
            onCheckedChange={(checked) => update("enable_qr_codes", checked)}
          />
          <ToggleField
            label="Enable submittal schedule calculations"
            hint="Adds schedule calculation defaults for required on-site and planned return dates."
            hintClassName={toggleHintClassName}
            controlPosition="left"
            checked={settings.enable_schedule_calculations}
            onCheckedChange={(checked) =>
              update("enable_schedule_calculations", checked)
            }
          />
          <ToggleField
            label="Allow email attachment downloads without login"
            hint="Email attachment links expire 14 calendar days after the email is sent."
            hintClassName={toggleHintClassName}
            controlPosition="left"
            checked={settings.allow_email_attachment_download_without_login}
            onCheckedChange={(checked) =>
              update("allow_email_attachment_download_without_login", checked)
            }
          />
        </div>
      </FormSection>

      <FormSection
        title="Email Notifications"
        description={
          <span className={descriptionTextClassName}>
            Recipient routing and reminder defaults for Submittals emails.
          </span>
        }
      >
        <div className="space-y-4">
          <ToggleField
            label="Enable email reminders for overdue submittals"
            controlPosition="left"
            checked={settings.enable_overdue_email_reminders}
            onCheckedChange={(checked) =>
              update("enable_overdue_email_reminders", checked)
            }
          />
          <DefaultDistributionSelect
            value={settings.default_distribution}
            onChange={(value) => update("default_distribution", value)}
            options={projectDirectoryOptions}
            isLoading={projectDirectoryLoading}
          />
        </div>

        <SettingsTable>
          <InlineTable variant="read">
            <InlineTableHeader>
              <InlineTableHeaderRow>
                <InlineTableHeaderCell>Email Event</InlineTableHeaderCell>
                <InlineTableHeaderCell align="center">Creator</InlineTableHeaderCell>
                <InlineTableHeaderCell align="center">
                  Submittal Manager
                </InlineTableHeaderCell>
                <InlineTableHeaderCell align="center">Submitter</InlineTableHeaderCell>
                <InlineTableHeaderCell align="center">Approver</InlineTableHeaderCell>
                <InlineTableHeaderCell align="center">Reviewer</InlineTableHeaderCell>
                <InlineTableHeaderCell align="center">
                  Distribution Group
                </InlineTableHeaderCell>
              </InlineTableHeaderRow>
            </InlineTableHeader>
            <InlineTableBody>
              {EMAIL_NOTIFICATION_ROWS.map((row) => (
                <InlineTableRow key={row.event}>
                  <InlineTableCell className="font-medium text-foreground">
                    {row.event}
                  </InlineTableCell>
                  {(
                    [
                      "creator",
                      "manager",
                      "submitter",
                      "approver",
                      "reviewer",
                      "distribution",
                    ] as const
                  ).map((role) => (
                    <InlineTableCell key={role} align="center">
                      <ReadOnlyCheck
                        checked={row[role]}
                        label={`${row.event} ${role}`}
                      />
                    </InlineTableCell>
                  ))}
                </InlineTableRow>
              ))}
            </InlineTableBody>
          </InlineTable>
        </SettingsTable>
      </FormSection>

    </div>
  );
}

function SubmittalResponsesPanel() {
  return (
    <FormSection
      title="Workflow Responses"
      description="Procore provides default submittal responses that you can modify as needed. You can also add new custom responses that map to the defaults."
      actions={
        <Button size="sm" disabled>
          Add Response
        </Button>
      }
    >
      <p className="text-sm text-muted-foreground">
        Custom response editing is not yet available on this Alleato route.
      </p>
      <SettingsTable>
        <InlineTable variant="read">
          <InlineTableHeader>
            <InlineTableHeaderRow>
              <InlineTableHeaderCell>Response Type</InlineTableHeaderCell>
              <InlineTableHeaderCell>Custom Response Label</InlineTableHeaderCell>
            </InlineTableHeaderRow>
          </InlineTableHeader>
          <InlineTableBody>
            {WORKFLOW_RESPONSE_ROWS.map(([type, label]) => (
              <InlineTableRow key={type}>
                <InlineTableCell className="font-medium text-foreground">
                  {type}
                </InlineTableCell>
                <InlineTableCell>{label}</InlineTableCell>
              </InlineTableRow>
            ))}
          </InlineTableBody>
        </InlineTable>
      </SettingsTable>
    </FormSection>
  );
}

function createEmptyWorkflowTemplateStep(): WorkflowTemplateStepDefinition {
  return {
    step_type: "Approver",
    required: true,
    user_id: null,
  };
}

function renderWorkflowTemplateAssignee(
  userId: string | null,
  projectDirectoryOptions: ProjectDirectoryOption[],
): string {
  if (!userId) return "Unassigned";
  return (
    projectDirectoryOptions.find((option) => option.value === userId)?.label ??
    "Unknown assignee"
  );
}

function WorkflowTemplateEditor({
  mode,
  projectDirectoryOptions,
  initialTemplate,
  onSave,
  onCancel,
  isPending,
}: {
  mode: "create" | "edit";
  projectDirectoryOptions: ProjectDirectoryOption[];
  initialTemplate: WorkflowTemplateRecord | null;
  onSave: (payload: {
    name: string;
    description: string | null;
    steps: WorkflowTemplateStepDefinition[];
  }) => Promise<void>;
  onCancel?: () => void;
  isPending: boolean;
}) {
  const [name, setName] = React.useState(initialTemplate?.name ?? "");
  const [description, setDescription] = React.useState(
    initialTemplate?.description ?? "",
  );
  const [steps, setSteps] = React.useState<WorkflowTemplateStepDefinition[]>(
    initialTemplate?.steps.length
      ? initialTemplate.steps
      : [createEmptyWorkflowTemplateStep()],
  );

  React.useEffect(() => {
    setName(initialTemplate?.name ?? "");
    setDescription(initialTemplate?.description ?? "");
    setSteps(
      initialTemplate?.steps.length
        ? initialTemplate.steps
        : [createEmptyWorkflowTemplateStep()],
    );
  }, [initialTemplate, mode]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;

    await onSave({
      name: name.trim(),
      description: description.trim() ? description.trim() : null,
      steps,
    });
  }

  function updateStep(
    index: number,
    nextStep: WorkflowTemplateStepDefinition,
  ) {
    setSteps((current) =>
      current.map((step, stepIndex) =>
        stepIndex === index ? nextStep : step,
      ),
    );
  }

  return (
    <SettingsTable>
      <form onSubmit={handleSubmit} className="divide-y divide-border/60">
        <div className="space-y-5 p-4 md:p-5">
          <div>
            <SectionRuleHeading
              label={
                mode === "create"
                  ? "Create Workflow Template"
                  : "Edit Workflow Template"
              }
              className="mb-0 pb-0"
            />
          </div>

          <div className="space-y-4 md:flex md:gap-4 md:space-y-0">
            <div className="space-y-2 md:flex-1">
              <Label htmlFor="workflow-template-name">Template Name</Label>
              <Input
                id="workflow-template-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Architect Review"
                autoFocus
                required
              />
            </div>
            <div className="space-y-2 md:flex-1">
              <Label htmlFor="workflow-template-description">Description</Label>
              <Input
                id="workflow-template-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Optional template description"
              />
            </div>
          </div>
        </div>

        <div className="space-y-4 p-4 md:p-5">
          <p className="text-sm font-semibold text-foreground">Workflow Steps</p>

          <div className="space-y-0">
            {steps.map((step, index) => (
              <div
                key={`${step.step_type}-${index}`}
                className="space-y-3 border-b border-border/60 py-4 last:border-b-0 first:pt-0 last:pb-0"
              >
                <div className="space-y-3 md:flex md:items-start md:gap-3 md:space-y-0">
                  <div className="space-y-2 md:w-32 md:shrink-0">
                    <Label>{`Step ${index + 1}`}</Label>
                    <Select
                      value={step.step_type}
                      onValueChange={(value) =>
                        updateStep(index, {
                          ...step,
                          step_type:
                            value as WorkflowTemplateStepDefinition["step_type"],
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {WORKFLOW_TEMPLATE_ROLE_OPTIONS.map((role) => (
                          <SelectItem key={role} value={role}>
                            {role}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2 md:min-w-0 md:flex-1">
                    <Label>Assignee</Label>
                    <Select
                      value={step.user_id ?? "_unassigned"}
                      onValueChange={(value) =>
                        updateStep(index, {
                          ...step,
                          user_id: value === "_unassigned" ? null : value,
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select assignee" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_unassigned">Unassigned</SelectItem>
                        {projectDirectoryOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.email
                              ? `${option.label} (${option.email})`
                              : option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <label className="flex items-center gap-2 whitespace-nowrap text-sm font-medium text-foreground">
                    <Checkbox
                      checked={step.required}
                      onCheckedChange={(checked) =>
                        updateStep(index, {
                          ...step,
                          required: checked === true,
                        })
                      }
                    />
                    Required
                  </label>

                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-auto justify-start px-0 text-muted-foreground hover:text-foreground"
                    disabled={steps.length === 1}
                    onClick={() =>
                      setSteps((current) =>
                        current.filter((_, stepIndex) => stepIndex !== index),
                      )
                    }
                  >
                    Remove
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() =>
                setSteps((current) => [
                  ...current,
                  createEmptyWorkflowTemplateStep(),
                ])
              }
            >
              <Plus className="h-4 w-4" />
              Add Step
            </Button>

            <div className="flex items-center justify-end gap-2">
              {onCancel ? (
                <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
                  Cancel
                </Button>
              ) : null}
              <Button type="submit" size="sm" disabled={isPending || !name.trim()}>
                {isPending
                  ? mode === "create"
                    ? "Creating..."
                    : "Saving..."
                  : mode === "create"
                    ? "Create Template"
                    : "Save Changes"}
              </Button>
            </div>
          </div>
        </div>
      </form>
    </SettingsTable>
  );
}

function WorkflowTemplatesPanel({
  projectId,
  projectDirectoryOptions,
}: {
  projectId: number;
  projectDirectoryOptions: ProjectDirectoryOption[];
}) {
  const { confirm, ConfirmDialog } = useConfirm();
  const [templates, setTemplates] = React.useState<WorkflowTemplateRecord[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [editorMode, setEditorMode] = React.useState<"create" | "edit" | null>(
    null,
  );
  const [editingTemplate, setEditingTemplate] =
    React.useState<WorkflowTemplateRecord | null>(null);
  const [savePending, setSavePending] = React.useState(false);
  const [deletePendingId, setDeletePendingId] = React.useState<string | null>(
    null,
  );
  const editorRef = React.useRef<HTMLDivElement | null>(null);

  const loadTemplates = React.useCallback(async () => {
    try {
      setLoading(true);
      setLoadError(null);
      const response = await apiFetch<unknown[]>(
        `/api/projects/${projectId}/submittals/workflow-templates`,
      );
      setTemplates(
        response
          .map((item) => normalizeWorkflowTemplateRecord(item))
          .filter((item): item is WorkflowTemplateRecord => item !== null),
      );
    } catch (error) {
      setLoadError(
        error instanceof Error
          ? error.message
          : "Failed to load workflow templates.",
      );
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  React.useEffect(() => {
    void loadTemplates();
  }, [loadTemplates]);

  const activeEditorMode =
    editorMode ??
    (!loading && !loadError && templates.length === 0 ? "create" : null);

  React.useEffect(() => {
    if (!activeEditorMode) return;
    editorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [activeEditorMode]);

  async function handleSaveTemplate(payload: {
    name: string;
    description: string | null;
    steps: WorkflowTemplateStepDefinition[];
  }) {
    const isCreateMode = activeEditorMode !== "edit" || !editingTemplate;

    try {
      setSavePending(true);
      const endpoint =
        isCreateMode
          ? `/api/projects/${projectId}/submittals/workflow-templates`
          : `/api/projects/${projectId}/submittals/workflow-templates/${editingTemplate.id}`;
      const method = isCreateMode ? "POST" : "PUT";

      const saved = await apiFetch<unknown>(endpoint, {
        method,
        body: JSON.stringify(payload),
      });

      const normalized = normalizeWorkflowTemplateRecord(saved);
      if (!normalized) {
        throw new Error("Workflow template response was invalid.");
      }

      setTemplates((current) => {
        if (isCreateMode) {
          return [...current, normalized].sort((a, b) =>
            a.name.localeCompare(b.name),
          );
        }
        return current
          .map((template) =>
            template.id === normalized.id ? normalized : template,
          )
          .sort((a, b) => a.name.localeCompare(b.name));
      });
      setEditorMode(null);
      setEditingTemplate(null);
      toast.success(
        isCreateMode
          ? "Workflow template created"
          : "Workflow template updated",
      );
    } catch (error) {
      handleFormError(error, {
        entity: "workflow template",
        action: isCreateMode ? "create" : "save",
      });
    } finally {
      setSavePending(false);
    }
  }

  async function handleDeleteTemplate(template: WorkflowTemplateRecord) {
    const confirmed = await confirm({
      title: "Delete workflow template?",
      description: `Delete "${template.name}"? This action cannot be undone.`,
      confirmLabel: "Delete",
      variant: "destructive",
    });
    if (!confirmed) return;

    try {
      setDeletePendingId(template.id);
      await apiFetch(
        `/api/projects/${projectId}/submittals/workflow-templates/${template.id}`,
        { method: "DELETE" },
      );
      setTemplates((current) =>
        current.filter((currentTemplate) => currentTemplate.id !== template.id),
      );
      toast.success("Workflow template deleted");
    } catch (error) {
      handleFormError(error, {
        entity: "workflow template",
        action: "delete",
      });
    } finally {
      setDeletePendingId(null);
    }
  }

  function openCreateEditor() {
    setEditorMode("create");
    setEditingTemplate(null);
  }

  function openEditEditor(template: WorkflowTemplateRecord) {
    setEditorMode("edit");
    setEditingTemplate(template);
  }

  function closeEditor() {
    setEditorMode(null);
    setEditingTemplate(null);
  }

  return (
    <>
      <FormSection
        title="Workflow Templates"
        actions={
          templates.length > 0 && !activeEditorMode ? (
            <Button size="sm" onClick={openCreateEditor}>
              <Plus className="h-4 w-4" />
              Create New Template
            </Button>
          ) : null
        }
      >
        {activeEditorMode ? (
          <div ref={editorRef}>
            <WorkflowTemplateEditor
              mode={activeEditorMode}
              projectDirectoryOptions={projectDirectoryOptions}
              initialTemplate={editingTemplate}
              onCancel={templates.length > 0 ? closeEditor : undefined}
              onSave={handleSaveTemplate}
              isPending={savePending}
            />
          </div>
        ) : null}

        {loading ? (
          <div className="space-y-3 py-6">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-3/4" />
          </div>
        ) : loadError ? (
          <div className="space-y-3 py-6">
            <p className="text-sm font-semibold text-destructive">
              Workflow templates failed to load
            </p>
            <p className="text-sm text-muted-foreground">{loadError}</p>
            <Button size="sm" variant="outline" onClick={() => void loadTemplates()}>
              <RotateCcw className="h-4 w-4" />
              Retry
            </Button>
          </div>
        ) : (
          <SettingsTable>
            <InlineTable variant="read">
              <InlineTableHeader>
                <InlineTableHeaderRow>
                  <InlineTableHeaderCell>Template</InlineTableHeaderCell>
                  <InlineTableHeaderCell>Workflow Steps</InlineTableHeaderCell>
                  <InlineTableHeaderCell align="right">Actions</InlineTableHeaderCell>
                </InlineTableHeaderRow>
              </InlineTableHeader>
              <InlineTableBody>
                {templates.map((template) => (
                  <InlineTableRow key={template.id}>
                    <InlineTableCell className="align-top">
                      <div className="space-y-1">
                        <p className="font-medium text-foreground">{template.name}</p>
                        {template.description ? (
                          <p className="text-sm text-muted-foreground">
                            {template.description}
                          </p>
                        ) : null}
                      </div>
                    </InlineTableCell>
                    <InlineTableCell className="align-top">
                      <div className="space-y-1">
                        {template.steps.length > 0 ? (
                          template.steps.map((step, index) => (
                            <p
                              key={`${template.id}-${index}`}
                              className="text-sm text-muted-foreground"
                            >
                              <span className="font-medium text-foreground">
                                {index + 1}. {step.step_type}
                              </span>
                              {" - "}
                              {renderWorkflowTemplateAssignee(
                                step.user_id,
                                projectDirectoryOptions,
                              )}
                              {step.required ? "" : " (optional)"}
                            </p>
                          ))
                        ) : (
                          <p className="text-sm text-muted-foreground">
                            No workflow steps configured.
                          </p>
                        )}
                      </div>
                    </InlineTableCell>
                    <InlineTableCell align="right" className="align-top">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openEditEditor(template)}
                        >
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={deletePendingId === template.id}
                          onClick={() => void handleDeleteTemplate(template)}
                        >
                          {deletePendingId === template.id ? "Deleting..." : "Delete"}
                        </Button>
                      </div>
                    </InlineTableCell>
                  </InlineTableRow>
                ))}
              </InlineTableBody>
            </InlineTable>
          </SettingsTable>
        )}
      </FormSection>
      {ConfirmDialog}
    </>
  );
}

function ReplaceWorkflowUserPanel({
  managerOptions,
  contactsLoading,
}: {
  managerOptions: Array<{ value: string; label: string; email?: string }>;
  contactsLoading: boolean;
}) {
  const [currentUser, setCurrentUser] = React.useState("");
  const [newUser, setNewUser] = React.useState("");
  const canReplace = Boolean(currentUser && newUser && currentUser !== newUser);

  return (
    <FormSection
      title="Replace Workflow User"
      description="If there is a user who has either left your project or who will be leaving the project, you can replace them in the submittal workflow with another user on all submittals that they have a Pending response for."
      actions={
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" disabled>
            Cancel
          </Button>
          <Button size="sm" disabled={!canReplace}>
            Replace and Save
          </Button>
        </div>
      }
    >
      <div className="space-y-3 text-sm text-muted-foreground">
        <p>
          Only current users with a Pending status will be replaced by the new
          user.
        </p>
        <p>
          If a current user has already responded in a workflow, they will not
          be replaced by the new user.
        </p>
        <p>
          The new user will only receive new workflow emails. They will not
          receive any workflow emails previously sent to the current user.
        </p>
        <p>
          This action will not replace users in any workflow templates. To
          replace users in a template, you'll need to change them manually.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="replace-current-user">
            Current User (Approver or Submitter)
            <span className="ml-1 text-destructive">*</span>
          </Label>
          <Select
            value={currentUser}
            onValueChange={setCurrentUser}
            disabled={contactsLoading}
          >
            <SelectTrigger id="replace-current-user">
              <SelectValue placeholder="Select A User" />
            </SelectTrigger>
            <SelectContent>
              {managerOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.email
                    ? `${option.label} (${option.email})`
                    : option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="replace-new-user">
            New User (Approver or Submitter)
            <span className="ml-1 text-destructive">*</span>
          </Label>
          <Select
            value={newUser}
            onValueChange={setNewUser}
            disabled={contactsLoading}
          >
            <SelectTrigger id="replace-new-user">
              <SelectValue placeholder="Select A User" />
            </SelectTrigger>
            <SelectContent>
              {managerOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.email
                    ? `${option.label} (${option.email})`
                    : option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </FormSection>
  );
}

function ImportsPanel() {
  return (
    <FormSection
      title="Submittal Imports"
      description="Procore Imports is only available on computers running Microsoft Windows 7 or newer."
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <SectionRuleHeading label="Import Submittals with Procore Imports" />
          <p className="text-sm text-muted-foreground">
            Procore Imports allows you to add your project's submittals in bulk
            without having to manually create them in the Submittals tool. Once
            you download the app and fill out the provided Submittals Import
            Template, you can start importing submittals into Procore.
          </p>
          <p className="text-sm text-muted-foreground">
            Import downloads are not yet available on this Alleato route.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" disabled>
            Download .xlsx Template
          </Button>
          <Button size="sm" disabled>
            Download Procore Imports
          </Button>
        </div>
      </div>
    </FormSection>
  );
}

function CustomReportsPanel() {
  return (
    <div className="space-y-8">
      <FormSection
        title="Custom Reports"
        actions={
          <Button size="sm" variant="outline" disabled>
            Go to Reports
          </Button>
        }
      >
        <div className="py-12 text-center">
          <p className="text-sm font-medium text-foreground">No Custom Reports</p>
          <p className="mt-1 text-sm text-muted-foreground">
            There are no custom reports to display. You can create and view
            custom reports in the Reports tool.
          </p>
        </div>
      </FormSection>

      <FormSection
        title="My Reports"
        actions={
          <Button size="sm" variant="outline" disabled>
            Go to Reports
          </Button>
        }
      >
        <div className="py-12 text-center">
          <p className="text-sm font-medium text-foreground">No Custom Reports</p>
          <p className="mt-1 text-sm text-muted-foreground">
            There are no custom reports to display. You can create and view
            custom reports in the Reports tool.
          </p>
        </div>
      </FormSection>
    </div>
  );
}

function PermissionsPanel({ projectId }: { projectId: number }) {
  const [search, setSearch] = React.useState("");
  const { users, isLoading, error, searchUsers } = useDirectoryPermissions(
    String(projectId),
  );
  const rows = users.slice(0, 10);

  React.useEffect(() => {
    const timeout = window.setTimeout(() => {
      searchUsers(search);
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [search, searchUsers]);

  const isLevel = (permissionLevel: PermissionLevel, level: PermissionLevel) =>
    permissionLevel === level;

  return (
    <FormSection
      title="User Permissions for Submittals"
      description="View user permissions for Submittals. You can't adjust permissions for Company Admins or users with assigned permission templates here. As a best practice, always manage user permissions through permission templates."
    >
      <ExpandableSearch
        placeholder="Search permissions"
        value={search}
        onChange={setSearch}
      />

      <SettingsTable>
        <InlineTable variant="read">
          <InlineTableHeader>
            <InlineTableHeaderRow>
              <InlineTableHeaderCell>Name</InlineTableHeaderCell>
              <InlineTableHeaderCell>Company</InlineTableHeaderCell>
              <InlineTableHeaderCell align="center">None</InlineTableHeaderCell>
              <InlineTableHeaderCell align="center">Read Only</InlineTableHeaderCell>
              <InlineTableHeaderCell align="center">Standard</InlineTableHeaderCell>
              <InlineTableHeaderCell align="center">Admin</InlineTableHeaderCell>
            </InlineTableHeaderRow>
          </InlineTableHeader>
          <InlineTableBody>
            {isLoading ? (
              <InlineTableRow>
                <InlineTableCell colSpan={6}>Loading permissions...</InlineTableCell>
              </InlineTableRow>
            ) : error ? (
              <InlineTableRow>
                <InlineTableCell colSpan={6} className="text-destructive">
                  {error.message}
                </InlineTableCell>
              </InlineTableRow>
            ) : rows.length > 0 ? (
              rows.map((user) => (
                <InlineTableRow key={user.id}>
                  <InlineTableCell className="font-medium text-primary">
                    {user.full_name || user.email || "Unnamed user"}
                  </InlineTableCell>
                  <InlineTableCell>{user.company_name ?? "-"}</InlineTableCell>
                  <InlineTableCell align="center">
                    <ReadOnlyCheck
                      checked={isLevel(user.permission_level, "none")}
                      label={`${user.full_name} none`}
                    />
                  </InlineTableCell>
                  <InlineTableCell align="center">
                    <ReadOnlyCheck
                      checked={isLevel(user.permission_level, "read_only")}
                      label={`${user.full_name} read only`}
                    />
                  </InlineTableCell>
                  <InlineTableCell align="center">
                    <ReadOnlyCheck
                      checked={isLevel(user.permission_level, "standard")}
                      label={`${user.full_name} standard`}
                    />
                  </InlineTableCell>
                  <InlineTableCell align="center">
                    <ReadOnlyCheck
                      checked={isLevel(user.permission_level, "admin")}
                      label={`${user.full_name} admin`}
                    />
                  </InlineTableCell>
                </InlineTableRow>
              ))
            ) : (
              <InlineTableRow>
                <InlineTableCell colSpan={6}>
                  No project users are available for permission display.
                </InlineTableCell>
              </InlineTableRow>
            )}
          </InlineTableBody>
        </InlineTable>
      </SettingsTable>
    </FormSection>
  );
}

function SubmittalSettingsTab({
  projectId,
  tabs,
}: {
  projectId: number;
  tabs: SubmittalsPageTab[];
}) {
  const pathname = usePathname()!;
  const router = useRouter();
  const searchParams = useSearchParams()!;
  const settingsSection = getSettingsSection(searchParams.get(SETTINGS_TAB_PARAM));
  const [settings, setSettings] = React.useState<SubmittalSettings | null>(
    null,
  );
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const { options: managerOptions, isLoading: contactsLoading } = useContacts({
    projectId: String(projectId),
    enabled: Number.isFinite(projectId),
  });
  const [projectDirectoryOptions, setProjectDirectoryOptions] = React.useState<
    ProjectDirectoryOption[]
  >([]);
  const [projectDirectoryLoading, setProjectDirectoryLoading] =
    React.useState(true);

  const settingsTabs = React.useMemo(
    () =>
      SUBMITTAL_SETTINGS_TABS.map((tab) => {
        const nextParams = new URLSearchParams(searchParams.toString());
        nextParams.set("tab", "settings");
        nextParams.set(SETTINGS_TAB_PARAM, tab.value);

        return {
          label: tab.label,
          href: `${pathname}?${nextParams.toString()}`,
          isActive: settingsSection === tab.value,
        };
      }),
    [pathname, searchParams, settingsSection],
  );

  React.useEffect(() => {
    let cancelled = false;

    async function loadSettings() {
      try {
        setLoading(true);
        setLoadError(null);
        const data = await apiFetch<SubmittalSettings>(
          `/api/projects/${projectId}/submittals/settings`,
        );
        if (!cancelled) setSettings(data);
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Failed to load submittal settings.";
        if (!cancelled) setLoadError(message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    if (Number.isFinite(projectId)) {
      void loadSettings();
    }

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  React.useEffect(() => {
    let cancelled = false;

    async function loadProjectDirectoryOptions() {
      if (!Number.isFinite(projectId)) return;

      try {
        setProjectDirectoryLoading(true);
        const contacts = await apiFetch<
          Array<{
            id: string;
            name: string;
            email?: string | null;
            person_type?: string | null;
          }>
        >(`/api/projects/${projectId}/contacts`);

        if (cancelled) return;

        setProjectDirectoryOptions(
          contacts.map((contact) => ({
            value: contact.id,
            label: contact.name,
            email: contact.email ?? undefined,
            keywords: [contact.email ?? "", contact.person_type ?? ""].filter(
              Boolean,
            ),
          })),
        );
      } catch {
        if (!cancelled) {
          setProjectDirectoryOptions([]);
        }
      } finally {
        if (!cancelled) {
          setProjectDirectoryLoading(false);
        }
      }
    }

    void loadProjectDirectoryOptions();

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const update = React.useCallback(
    <K extends SubmittalSettingsKey>(key: K, value: SubmittalSettings[K]) => {
      setSettings((prev) => (prev ? { ...prev, [key]: value } : prev));
    },
    [],
  );

  const handleSave = React.useCallback(async () => {
    if (!settings) return;
    try {
      setSaving(true);
      const saved = await apiFetch<SubmittalSettings>(
        `/api/projects/${projectId}/submittals/settings`,
        {
          method: "PUT",
          body: JSON.stringify({
            default_submittal_manager_id:
              settings.default_submittal_manager_id,
            default_distribution: settings.default_distribution,
            package_sort_order: settings.package_sort_order,
            default_submit_response_days:
              settings.default_submit_response_days,
            include_spec_section_number: settings.include_spec_section_number,
            submittals_private_by_default:
              settings.submittals_private_by_default,
            allow_approvers_to_add_reviewers:
              settings.allow_approvers_to_add_reviewers,
            approver_responses_required_by_default:
              settings.approver_responses_required_by_default,
            enable_reject_workflow: settings.enable_reject_workflow,
            enable_dynamic_approver_due_dates:
              settings.enable_dynamic_approver_due_dates,
            enable_overdue_email_reminders:
              settings.enable_overdue_email_reminders,
            enable_qr_codes: settings.enable_qr_codes,
            enable_schedule_calculations: settings.enable_schedule_calculations,
            allow_email_attachment_download_without_login:
              settings.allow_email_attachment_download_without_login,
            email_notify_submittal_created:
              settings.email_notify_submittal_created,
            email_notify_submittal_updated:
              settings.email_notify_submittal_updated,
            email_notify_submittal_distributed:
              settings.email_notify_submittal_distributed,
            email_notify_submittal_closed: settings.email_notify_submittal_closed,
          }),
        },
      );
      setSettings(saved);
      toast.success("Submittal settings saved");
    } catch (error) {
      handleFormError(error, {
        entity: "submittal settings",
        action: "save",
      });
    } finally {
      setSaving(false);
    }
  }, [projectId, settings]);

  const renderActiveSettingsPanel = () => {
    if (settingsSection === "general") {
      if (loading) {
        return (
          <div className="space-y-8">
            {["general", "numbering", "workflow", "email"].map((section) => (
              <section key={section} className="space-y-3">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-9 w-full max-w-xl" />
                <Skeleton className="h-9 w-full max-w-2xl" />
              </section>
            ))}
          </div>
        );
      }

      if (loadError) {
        return (
          <div className="space-y-2 py-6">
            <p className="text-sm font-semibold text-destructive">
              Submittal settings failed to load
            </p>
            <p className="text-sm text-muted-foreground">{loadError}</p>
          </div>
        );
      }

      if (settings) {
        return (
          <SubmittalGeneralSettingsPanel
            settings={settings}
            update={update}
            managerOptions={managerOptions}
            contactsLoading={contactsLoading}
            projectDirectoryOptions={projectDirectoryOptions}
            projectDirectoryLoading={projectDirectoryLoading}
          />
        );
      }

      return null;
    }

    if (settingsSection === "responses") return <SubmittalResponsesPanel />;
    if (settingsSection === "workflow-templates") {
      return (
        <WorkflowTemplatesPanel
          projectId={projectId}
          projectDirectoryOptions={projectDirectoryOptions}
        />
      );
    }
    if (settingsSection === "replace-workflow-user") {
      return (
        <ReplaceWorkflowUserPanel
          managerOptions={managerOptions}
          contactsLoading={contactsLoading}
        />
      );
    }
    if (settingsSection === "imports") return <ImportsPanel />;
    if (settingsSection === "custom-reports") return <CustomReportsPanel />;
    return <PermissionsPanel projectId={projectId} />;
  };

  return (
    <PageShell
      variant="table"
      title="Submittals"
      actions={
        settingsSection === "general" ? (
          <Button
            size="sm"
            onClick={handleSave}
            disabled={loading || saving || !settings}
          >
            <Save className="h-4 w-4" />
            {saving ? "Saving..." : "Save Settings"}
          </Button>
        ) : null
      }
    >
      <PageTabs tabs={tabs} variant="inline" className="mb-0" />
      <Tabs
        value={settingsSection}
        onValueChange={(value) => {
          const nextTab = settingsTabs.find(
            (tab) =>
              getSettingsSection(
                new URL(tab.href, "http://localhost").searchParams.get(
                  SETTINGS_TAB_PARAM,
                ),
              ) === value,
          );
          if (nextTab) {
            router.push(nextTab.href);
          }
        }}
        className="mb-6"
      >
        <TabsList spacing="comfortable" className="max-w-full justify-start">
          {SUBMITTAL_SETTINGS_TABS.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      {renderActiveSettingsPanel()}
    </PageShell>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function SubmittalsPage(): ReactElement {
  const params = useParams<{ projectId: string }>()!;
  const pathname = usePathname()!;
  const router = useRouter();
  const searchParams = useSearchParams()!;
  const qc = useQueryClient();

  const projectId = parseInt(params.projectId ?? "", 10);
  const activeTab = searchParams.get("tab") || "items";

  useProjectTitle("Submittals");

  const { confirm, ConfirmDialog } = useConfirm();
  const [packagePickerOpen, setPackagePickerOpen] = React.useState(false);
  const [specPickerOpen, setSpecPickerOpen] = React.useState(false);
  const [scanDrawingsOpen, setScanDrawingsOpen] = React.useState(false);
  const deleteSubmittal = useDeleteSubmittal(projectId);
  const [packageManageOpen, setPackageManageOpen] = React.useState(false);
  const [editingPackage, setEditingPackage] = React.useState<PackageRow | null>(
    null,
  );
  const { data: allPackages = [] } = usePackages(projectId);
  const createPackageMutation = useCreatePackage(projectId);
  const updatePackageMutation = useUpdatePackage(projectId);
  const deletePackageMutation = useDeletePackage(projectId);

  const initialFilters: SubmittalFilterState = {
    status: searchParams.get("status") ?? undefined,
    latest_response: searchParams.get("latest_response") ?? undefined,
    division: searchParams.get("division") ?? undefined,
  };

  const tableState = useUnifiedTableState({
    entityKey: "submittals",
    searchParams,
    pathname,
    router,
    defaults: {
      view: "table",
      allowedViews: ["table", "card", "list"],
      page: 1,
      perPage: 25,
      search: "",
      sortBy: "submittal_number",
      sortDirection: "asc",
      visibleColumns: submittalDefaultVisibleColumns,
      filters: initialFilters,
    },
  });

  const { data: submittals = [], isLoading } = useSubmittals(
    projectId,
    activeTab === "recycle-bin" ? "recycle-bin" : undefined,
  );

  const tableRows = React.useMemo<SubmittalTableRow[]>(
    () => submittals.map(toTableRow),
    [submittals],
  );

  const activeFilters = tableState.activeFilters as SubmittalFilterState;

  const filteredItems = React.useMemo(() => {
    const search = tableState.debouncedSearch.trim().toLowerCase();
    const statusFilter =
      typeof activeFilters.status === "string" ? activeFilters.status : "";
    const responseFilter =
      typeof activeFilters.latest_response === "string"
        ? activeFilters.latest_response
        : "";
    const divisionFilter =
      typeof activeFilters.division === "string" ? activeFilters.division : "";

    return tableRows.filter((row) => {
      if (statusFilter && row.status !== statusFilter) return false;
      if (responseFilter && row.latest_response !== responseFilter)
        return false;
      if (
        divisionFilter &&
        (row.division ?? "").toLowerCase() !== divisionFilter.toLowerCase()
      )
        return false;
      if (!search) return true;
      return (
        row.submittal_number.toLowerCase().includes(search) ||
        row.title.toLowerCase().includes(search) ||
        (row.specification_section ?? "").toLowerCase().includes(search) ||
        (row.submittal_type_name ?? "").toLowerCase().includes(search) ||
        row.status.toLowerCase().includes(search)
      );
    });
  }, [activeFilters, tableRows, tableState.debouncedSearch]);

  // Inline cell edits (Status / Title / Rev. / Spec Section / Due Date in table
  // view). Persists directly via single-field PUT and refreshes the cache. No
  // toast here — UnifiedTablePage shows its own per-cell confirmation on commit.
  const handleInlineUpdate = React.useCallback(
    async (submittalId: string, data: Record<string, unknown>) => {
      await apiFetch(`/api/projects/${projectId}/submittals/${submittalId}`, {
        method: "PUT",
        body: JSON.stringify(data),
      });
      await qc.invalidateQueries({ queryKey: ["submittals", projectId] });
    },
    [projectId, qc],
  );

  const tableColumns = React.useMemo(
    () => buildSubmittalTableColumns({ onUpdate: handleInlineUpdate }),
    [handleInlineUpdate],
  );

  // -------------------------------------------------------------------------
  // Grouped data derivations
  // -------------------------------------------------------------------------

  // Build a lookup from submittal id → package name using raw SubmittalSummary data
  const packageNameById = React.useMemo(() => {
    const m = new Map<string, string>();
    for (const s of submittals) {
      m.set(s.id, s.submittal_package?.name ?? "No Package");
    }
    return m;
  }, [submittals]);

  const packageIdByName = React.useMemo(() => {
    const m = new Map<string, PackageRow>();
    // Seed from allPackages first so empty packages are included
    for (const pkg of allPackages) {
      m.set(pkg.name, pkg);
    }
    // Also seed from submittals data (handles packages not yet in allPackages cache)
    for (const s of submittals) {
      const pkg = s.submittal_package;
      if (pkg?.id && pkg?.name && !m.has(pkg.name)) {
        m.set(pkg.name, {
          id: pkg.id,
          name: pkg.name,
          description:
            (pkg as { description?: string | null }).description ?? null,
        });
      }
    }
    return m;
  }, [submittals, allPackages]);

  const packageGroups = React.useMemo(() => {
    if (activeTab !== "packages") return [];
    const map = new Map<string, SubmittalTableRow[]>();
    // Seed all known packages (including empty ones) so they appear as group headers
    for (const pkg of allPackages) {
      map.set(pkg.name, []);
    }
    // "No Package" group always exists
    map.set("No Package", []);
    for (const row of filteredItems) {
      const key = packageNameById.get(row.id) ?? "No Package";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(row);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => {
        if (a === "No Package") return 1;
        if (b === "No Package") return -1;
        return a.localeCompare(b);
      })
      .map(([label, items]) => ({ label, items }));
  }, [activeTab, filteredItems, packageNameById, allPackages]);

  const specSectionGroups = React.useMemo(() => {
    if (activeTab !== "spec-sections") return [];
    const map = new Map<string, SubmittalTableRow[]>();
    for (const row of filteredItems) {
      const key = row.specification_section ?? "No Spec Section";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(row);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([label, items]) => ({ label, items }));
  }, [activeTab, filteredItems]);

  const ballInCourtGroups = React.useMemo(() => {
    if (activeTab !== "ball-in-court") return [];
    const withBic = filteredItems.filter((r) => r.ball_in_court);
    const map = new Map<string, SubmittalTableRow[]>();
    for (const row of withBic) {
      const key = row.ball_in_court!;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(row);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([label, items]) => ({ label, items }));
  }, [activeTab, filteredItems]);

  // -------------------------------------------------------------------------
  // Restore handler (recycle bin)
  // -------------------------------------------------------------------------

  const handleRestore = React.useCallback(
    async (submittalId: string) => {
      try {
        await apiFetch(
          `/api/projects/${projectId}/submittals/${submittalId}/restore`,
          {
            method: "PATCH",
          },
        );
        toast.success("Submittal restored");
        await qc.invalidateQueries({ queryKey: ["submittals", projectId] });
      } catch (error) {
        handleFormError(error, { entity: "submittal", action: "save" });
      }
    },
    [projectId, qc],
  );

  // -------------------------------------------------------------------------
  // Tabs
  // -------------------------------------------------------------------------

  const tabs: SubmittalsPageTab[] = [
    {
      label: "Items",
      href: `/${projectId}/submittals`,
      count: activeTab === "items" ? filteredItems.length : undefined,
      isActive: activeTab === "items",
      testId: "submittals-tab-items",
    },
    {
      label: "Packages",
      href: `/${projectId}/submittals?tab=packages`,
      isActive: activeTab === "packages",
    },
    {
      label: "Spec Sections",
      href: `/${projectId}/submittals?tab=spec-sections`,
      isActive: activeTab === "spec-sections",
    },
    {
      label: "Ball In Court",
      href: `/${projectId}/submittals?tab=ball-in-court`,
      isActive: activeTab === "ball-in-court",
      testId: "submittals-tab-ball-in-court",
    },
    {
      label: "Recycle Bin",
      href: `/${projectId}/submittals?tab=recycle-bin`,
      isActive: activeTab === "recycle-bin",
    },
    {
      label: "Settings",
      href: `/${projectId}/submittals?tab=settings`,
      isActive: activeTab === "settings",
      testId: "submittals-tab-settings",
    },
  ];

  const handleFilterChange = (nextFilters: SubmittalFilterState) => {
    tableState.setActiveFilters(nextFilters);
    tableState.setSearchParams({
      status:
        typeof nextFilters.status === "string" ? nextFilters.status : null,
      latest_response:
        typeof nextFilters.latest_response === "string"
          ? nextFilters.latest_response
          : null,
      division:
        typeof nextFilters.division === "string" ? nextFilters.division : null,
      page: "1",
    });
    tableState.setPage(1);
  };

  const isFiltered =
    Boolean(tableState.searchInput) ||
    Boolean(activeFilters.status) ||
    Boolean(activeFilters.latest_response) ||
    Boolean(activeFilters.division);

  const isGroupedTab =
    activeTab === "packages" ||
    activeTab === "spec-sections" ||
    activeTab === "ball-in-court";

  // -------------------------------------------------------------------------
  // Grouped tab: topContent replaces the table body; items=[] hides the table
  // -------------------------------------------------------------------------

  const groupedTopContent = React.useMemo<ReactNode>(() => {
    if (!isGroupedTab) return undefined;

    const groups =
      activeTab === "packages"
        ? packageGroups
        : activeTab === "spec-sections"
          ? specSectionGroups
          : ballInCourtGroups;

    return (
      <GroupedSubmittalView
        groups={groups}
        columns={tableColumns}
        onRowClick={(item) =>
          router.push(`/${projectId}/submittals/${item.id}`)
        }
        visibleColumns={tableState.visibleColumns}
        groupAction={
          activeTab === "packages"
            ? (label) => {
                const pkg = packageIdByName.get(label);
                if (!pkg) return null;
                return (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 ml-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MoreVertical className="h-3.5 w-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                      <DropdownMenuItem
                        onClick={() => {
                          setEditingPackage(pkg);
                          setPackageManageOpen(true);
                        }}
                      >
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={async () => {
                          const ok = await confirm({
                            description: `Delete package "${pkg.name}"? Submittals will be unlinked.`,
                            variant: "destructive",
                            confirmLabel: "Delete",
                          });
                          if (ok) {
                            deletePackageMutation.mutate(pkg.id);
                          }
                        }}
                      >
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                );
              }
            : undefined
        }
      />
    );
  }, [
    isGroupedTab,
    activeTab,
    packageGroups,
    specSectionGroups,
    ballInCourtGroups,
    tableColumns,
    tableState.visibleColumns,
    router,
    projectId,
    packageIdByName,
    deletePackageMutation,
    confirm,
  ]);

  // -------------------------------------------------------------------------
  // Recycle bin: restore row action
  // -------------------------------------------------------------------------

  const recycleRowActions = React.useCallback(
    (item: SubmittalTableRow): ReactNode => (
      <Button
        variant="outline"
        size="sm"
        onClick={(e) => {
          e.stopPropagation();
          void handleRestore(item.id);
        }}
      >
        <RotateCcw className="mr-1 h-3.5 w-3.5" />
        Restore
      </Button>
    ),
    [handleRestore],
  );

  // -------------------------------------------------------------------------
  // Export handlers
  // -------------------------------------------------------------------------

  const handleExport = React.useCallback(() => {
    const visibleCols = submittalColumns.filter((c) =>
      tableState.visibleColumns.includes(c.id),
    );
    const headers = visibleCols.map((c) => c.label);
    const rows = filteredItems.map((item) =>
      visibleCols.map((c) => {
        const val = getSubmittalColumnValue(item, c.id);
        if (val === null || val === undefined) return "";
        return String(val).replace(/,/g, ";").replace(/\n/g, " ");
      }),
    );
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `submittals-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [filteredItems, tableState.visibleColumns]);

  const handlePdfExport = React.useCallback(() => {
    window.open(`/api/projects/${projectId}/submittals/pdf`, "_blank", "noopener,noreferrer");
  }, [projectId]);

  if (activeTab === "settings") {
    return <SubmittalSettingsTab projectId={projectId} tabs={tabs} />;
  }

  return (
    <>
      <ScanDrawingsSheet
        projectId={projectId}
        open={scanDrawingsOpen}
        onOpenChange={setScanDrawingsOpen}
      />
      <PackagePickerDialog
        projectId={projectId}
        open={packagePickerOpen}
        onOpenChange={setPackagePickerOpen}
        onSelect={(pkg) => {
          router.push(
            `/${projectId}/submittals/new?package_id=${encodeURIComponent(pkg.id)}`,
          );
        }}
      />
      <SpecPickerDialog
        projectId={projectId}
        open={specPickerOpen}
        onOpenChange={setSpecPickerOpen}
        onSelect={(spec) => {
          const section = encodeURIComponent(
            `${spec.section_number} - ${spec.section_title}`,
          );
          router.push(
            `/${projectId}/submittals/new?specification_section=${section}`,
          );
        }}
      />
      {packageManageOpen && (
        <PackageManageDialog
          mode={editingPackage ? "edit" : "create"}
          initialPackage={editingPackage}
          onClose={() => {
            setPackageManageOpen(false);
            setEditingPackage(null);
          }}
          onCreate={(name, description) => {
            createPackageMutation.mutate(
              { name, description },
              {
                onSuccess: () => {
                  setPackageManageOpen(false);
                },
              },
            );
          }}
          onUpdate={(id, name, description) => {
            updatePackageMutation.mutate(
              { id, name, description },
              {
                onSuccess: () => {
                  setPackageManageOpen(false);
                  setEditingPackage(null);
                },
              },
            );
          }}
          isPending={
            createPackageMutation.isPending || updatePackageMutation.isPending
          }
        />
      )}
      {ConfirmDialog}
      <UnifiedTablePage
        header={{
          title: "Submittals",
          actions: (
            <div className="flex flex-wrap items-center justify-end gap-1.5">
              <Button
                variant="ghost"
                size="icon"
                aria-label="Submittal settings"
                title="Submittal settings"
                onClick={() => router.push(`/${projectId}/submittals?tab=settings`)}
              >
                <Settings className="h-4 w-4" />
              </Button>
              {activeTab === "packages" && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setEditingPackage(null);
                    setPackageManageOpen(true);
                  }}
                >
                  <Plus className="h-4 w-4" />
                  New Package
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={() => setScanDrawingsOpen(true)}
              >
                Scan drawings
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" data-testid="submittals-create-button">
                    <Plus className="h-4 w-4" />
                    Create Submittal
                    <ChevronDown className="ml-1 h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onSelect={() => router.push(`/${projectId}/submittals/new`)}
                  >
                    Create new submittal
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => setPackagePickerOpen(true)}>
                    Create from package
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => setSpecPickerOpen(true)}>
                    Create from specification
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ),
        }}
        tabs={tabs}
        toolbar={{
          totalItems: tableRows.length,
          filteredItems: filteredItems.length,
          selectedCount: tableState.selectedIds.length,
          searchValue: tableState.searchInput,
          onSearchChange: tableState.setSearchInput,
          searchPlaceholder: "Search submittals...",
          currentView: tableState.currentView,
          onViewChange: (view) => {
            tableState.setCurrentView(view);
            tableState.setSearchParams({ view });
          },
          enabledViews: ["table", "card", "list"],
          filters: submittalFilters,
          activeFilters,
          onFilterChange: handleFilterChange,
          onClearFilters: () => handleFilterChange(EMPTY_FILTERS),
          columns: submittalColumns,
          visibleColumns: tableState.visibleColumns,
          onColumnVisibilityChange: tableState.setVisibleColumns,
          customActions: (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Download className="h-4 w-4" />
                  Export
                  <ChevronDown className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handlePdfExport}>
                  <FileText className="h-4 w-4" />
                  PDF
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleExport}>
                  <Table2 className="h-4 w-4" />
                  CSV
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ),
        }}
        data={{
          // For grouped tabs, suppress the built-in table/empty-state entirely
          items: isGroupedTab ? [] : filteredItems,
          isLoading,
          isFetching: false,
        }}
        table={{
          columns: tableColumns,
          getRowId: (item) => item.id,
          onView: (item) =>
            router.push(`/${projectId}/submittals/${item.id}`),
          onEdit: (item) =>
            router.push(`/${projectId}/submittals/${item.id}/edit`),
          onRowClick: (item) =>
            router.push(`/${projectId}/submittals/${item.id}`),
          onDelete:
            activeTab === "recycle-bin"
              ? undefined
              : (item) => deleteSubmittal.mutate(item.id),
          rowActions:
            activeTab === "recycle-bin" ? recycleRowActions : undefined,
        }}
        sorting={{
          sortBy: tableState.sortBy,
          sortDirection: tableState.sortDirection,
          onSortChange: (sortBy, direction) => {
            tableState.setSortBy(sortBy);
            tableState.setSortDirection(direction);
            tableState.setSearchParams({ sort: sortBy, sort_dir: direction });
          },
        }}
        views={{
          card: (item) =>
            renderSubmittalCard(item, (r) =>
              router.push(`/${projectId}/submittals/${r.id}`),
            ),
          list: (item) =>
            renderSubmittalList(item, (r) =>
              router.push(`/${projectId}/submittals/${r.id}`),
            ),
        }}
        emptyState={{
          title: isGroupedTab ? "" : "No submittals found",
          description: isGroupedTab
            ? ""
            : activeTab === "recycle-bin"
              ? "No submittals in the Recycle Bin."
              : "Create your first submittal to get started.",
          filteredDescription: isGroupedTab
            ? ""
            : "Try adjusting your search or filters.",
          isFiltered: isFiltered && !isGroupedTab,
          action:
            isGroupedTab || activeTab === "recycle-bin" ? undefined : (
              <Button
                size="sm"
                onClick={() => router.push(`/${projectId}/submittals/new`)}
              >
                <Plus />
                Create your first submittal
              </Button>
            ),
        }}
        features={{
          enableExport: false,
          enableBulkDelete: activeTab === "items",
          enableRowSelection: activeTab === "items",
        }}
        layout={{
          hideTableBody: isGroupedTab,
        }}
        topContent={groupedTopContent}
      />
    </>
  );
}
