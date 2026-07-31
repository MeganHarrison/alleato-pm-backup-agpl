"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  MoreVertical,
  Pencil,
  Trash2,
  UserX,
  Package,
  Mail,
  Search,
  SlidersHorizontal,
  X,
  Plus,
  ChevronRight,
} from "lucide-react";
import {
  Button,
  Avatar,
  AvatarFallback,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
  Input,
  Label,
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Badge,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  ToggleGroup,
  ToggleGroupItem,
  EmptyState,
} from "@/components/ds";
import { PageShell, PageTabs } from "@/components/layout";
import {
  UnifiedTablePage,
  TableExpandedRow,
  type FilterConfig,
  type FilterValue,
  type TableColumn,
  type ViewMode,
} from "@/components/tables/unified";
import {
  InlineTable,
  InlineTableBody,
  InlineTableCell,
  InlineTableHeader,
  InlineTableHeaderCell,
  InlineTableHeaderRow,
  InlineTableRow,
} from "@/components/ds/inline-table";
import { AssignMemberDialog } from "@/components/domain/directory/AssignMemberDialog";
import { CompanyDetailSheet } from "@/components/domain/directory/CompanyDetailSheet";
import { ProjectTeamDialog } from "@/components/domain/directory/ProjectTeamDialog";
import { ContactFormSheet } from "@/components/domain/contacts/ContactFormSheet";
import { useProjectRoles, type ProjectRole } from "@/hooks/use-project-roles";
import { useProjectUsers } from "@/hooks/use-project-users";
import { useProjectVendors } from "@/hooks/use-project-vendors";
import {
  useProjectCompanies,
  useUpdateProjectCompany,
} from "@/hooks/use-project-companies";
import { usePermissionTemplates } from "@/hooks/use-permissions";
import { createClient } from "@/lib/supabase/client";
import { updateContact } from "@/app/(main)/actions/table-actions";
import { apiFetch, ApiError } from "@/lib/api-client";
import { filterProjectMembers } from "@/lib/directory/project-members";
import { reportNonCriticalFailure } from "@/lib/report-non-critical-failure";
import { useConfirm } from "@/hooks/use-confirm";
import { cn } from "@/lib/utils";
import {
  type PermissionModule,
  type PermissionLevel,
  type GranularFlag,
  ALL_MODULES,
  GRANULAR_FLAG_LABELS,
} from "@/lib/permissions-shared";
import { Check, ShieldCheck, UserPlus } from "lucide-react";
import { appToast as toast } from "@/lib/toast/app-toast";
import type { PersonWithDetails } from "@/services/directoryService";

// ─── Types ───────────────────────────────────────────────────────

type RoleRow = {
  id: string;
  role: ProjectRole;
  member: ProjectRole["members"][0] | null;
};

interface PersonOption {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  job_title: string | null;
  company_name: string | null;
}

interface VendorOption {
  id: string;
  name: string;
  legal_name: string | null;
  vendor_class: string | null;
  contact_name: string | null;
  city: string | null;
  state: string | null;
  status: string | null;
}

// ─── Helpers ─────────────────────────────────────────────────────

function memberStatusLabel(
  membership: PersonWithDetails["membership"],
): string {
  const status = membership?.status || "inactive";
  const invite = membership?.invite_status;
  if (status === "inactive") return "Inactive";
  if (invite === "not_invited") return "Not Invited";
  if (invite === "invited") return "Invite Sent";
  return "Active";
}

function accessLevelLabel(permission?: { name: string } | null): string {
  return permission?.name ?? "Standard";
}

function initials(first?: string | null, last?: string | null): string {
  return `${first?.[0] ?? ""}${last?.[0] ?? ""}`.toUpperCase() || "?";
}

// ─── Skeleton ────────────────────────────────────────────────────

function SectionSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-3">
          <div className="h-8 w-8 rounded-full animate-pulse bg-muted shrink-0" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3.5 w-36 animate-pulse rounded bg-muted" />
            <div className="h-3 w-24 animate-pulse rounded bg-muted" />
          </div>
        </div>
      ))}
    </div>
  );
}

function DirectoryUnifiedTable<T>({
  title,
  action,
  items,
  columns,
  getRowId,
  search,
  onSearch,
  searchPlaceholder,
  totalItems,
  filters,
  activeFilters,
  onFilterChange,
  onClearFilters,
  rowActions,
  onRowClick,
  emptyTitle,
  emptyDescription,
  filteredDescription,
  isFiltered,
  enablePagination = false,
  renderExpandedRow,
  groupByOptions,
  groupBy,
  onGroupByChange,
  leftContent,
}: {
  title: string;
  action?: React.ReactNode;
  items: T[];
  columns: TableColumn<T>[];
  getRowId: (item: T) => string;
  search?: string;
  onSearch?: (value: string) => void;
  searchPlaceholder?: string;
  totalItems?: number;
  filters?: FilterConfig[];
  activeFilters?: Record<string, FilterValue>;
  onFilterChange?: (filters: Record<string, FilterValue>) => void;
  onClearFilters?: () => void;
  rowActions?: (item: T) => React.ReactNode;
  onRowClick?: (item: T) => void;
  emptyTitle: string;
  emptyDescription: string;
  filteredDescription: string;
  isFiltered: boolean;
  enablePagination?: boolean;
  renderExpandedRow?: (item: T, colSpan: number) => React.ReactNode | null;
  groupByOptions?: { value: string; label: string }[];
  groupBy?: string | null;
  onGroupByChange?: (value: string) => void;
  leftContent?: React.ReactNode;
}) {
  const [currentView, setCurrentView] = React.useState<ViewMode>("table");

  return (
    <UnifiedTablePage<T>
      header={{
        title,
        hidden: true,
        mobileActionsInline: false,
      }}
      toolbar={{
        totalItems: totalItems ?? items.length,
        filteredItems: items.length,
        searchValue: search ?? "",
        onSearchChange: onSearch ?? (() => {}),
        searchPlaceholder:
          searchPlaceholder ?? `Search ${title.toLowerCase()}...`,
        currentView,
        onViewChange: (view) => {
          if (view === "table") setCurrentView(view);
        },
        filters,
        activeFilters,
        onFilterChange,
        onClearFilters,
        groupByOptions,
        groupBy,
        onGroupByChange,
        leftContent,
        customActions: action,
      }}
      data={{
        items,
        isLoading: false,
        error: null,
      }}
      table={{
        columns,
        getRowId,
        rowActions,
        onRowClick,
        density: "compact",
        renderExpandedRow,
      }}
      features={{
        enableSearch: Boolean(onSearch),
        enableFilters: Boolean(filters?.length),
        enableViews: false,
        enableColumnToggle: true,
        enableExport: true,
        enablePagination,
        enableBulkDelete: false,
        enableRowSelection: false,
      }}
      layout={{
        containerPadding: false,
        containerClassName: "pb-0",
        toolbarInlineWithHeader: false,
        minWidth: 880,
      }}
      emptyState={{
        title: emptyTitle,
        description: emptyDescription,
        filteredDescription,
        isFiltered,
      }}
    />
  );
}

// ─── Local: Expandable search ─────────────────────────────────────

function ExpandableSearch({
  value,
  onChange,
  placeholder = "Search...",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const [expanded, setExpanded] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (expanded) inputRef.current?.focus();
  }, [expanded]);

  React.useEffect(() => {
    if (value) setExpanded(true);
  }, [value]);

  if (!expanded) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="Search"
        onClick={() => setExpanded(true)}
        className="h-8 w-8 text-muted-foreground"
      >
        <Search className="h-4 w-4" />
      </Button>
    );
  }

  return (
    <div className="relative flex items-center">
      <Search className="absolute left-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
      <Input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => {
          if (!value) setExpanded(false);
        }}
        placeholder={placeholder}
        className="h-8 w-44 pl-8 pr-7 text-sm"
        aria-label="Search"
      />
      {value && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => {
            onChange("");
            inputRef.current?.focus();
          }}
          className="absolute right-0 h-7 w-7 text-muted-foreground"
          aria-label="Clear search"
        >
          <X className="h-3 w-3" />
        </Button>
      )}
    </div>
  );
}

function SectionActionsOnly({
  action,
}: {
  action: React.ReactNode;
}) {
  return <div className="mb-4 flex justify-end">{action}</div>;
}

// ─── Dialogs ─────────────────────────────────────────────────────

function AddMemberDialog({
  open,
  onOpenChange,
  projectId,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  onSuccess: () => void;
}) {
  const [people, setPeople] = React.useState<PersonOption[]>([]);
  const [selected, setSelected] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setSelected(null);

    const supabase = createClient();
    supabase
      .from("people")
      .select(
        "id, first_name, last_name, email, job_title, company:companies!people_company_id_fkey(name)",
      )
      .order("first_name")
      .then(({ data }) => {
        if (data) {
          setPeople(
            data.map((p) => ({
              id: p.id,
              first_name: p.first_name,
              last_name: p.last_name,
              email: p.email,
              job_title: p.job_title,
              company_name:
                (p.company as { name?: string } | null)?.name ?? null,
            })),
          );
        }
      });
  }, [open]);

  const handleAdd = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await apiFetch(`/api/projects/${projectId}/directory/people`, {
        method: "POST",
        body: JSON.stringify({ person_id: selected }),
      });
      toast.success("Member added to project");
      onSuccess();
      onOpenChange(false);
    } catch (err) {
      toast.error("Failed to add member");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 p-0 w-full sm:max-w-lg border-border/60 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 space-y-1">
          <DialogTitle className="text-lg tracking-tight">
            Add member
          </DialogTitle>
          <DialogDescription>
            Add an existing person from your directory to this project.
          </DialogDescription>
        </DialogHeader>
        <div className="px-6 pb-2">
          <Command className="overflow-visible" shouldFilter={true}>
            <CommandInput placeholder="Search people…" />
            <CommandList className="mt-2 max-h-72 -mx-1">
              <CommandEmpty>
                <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                  No people found.
                </div>
              </CommandEmpty>
              <CommandGroup className="p-0">
                {people.map((person) => {
                  const meta = [person.job_title, person.company_name]
                    .filter(Boolean)
                    .join(" · ");
                  const isSelected = selected === person.id;
                  return (
                    <CommandItem
                      key={person.id}
                      value={`${person.first_name} ${person.last_name} ${person.email ?? ""}`}
                      onSelect={() => setSelected(person.id)}
                      className={cn(
                        "flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 text-sm transition-colors",
                        "data-[selected=true]:bg-accent/60",
                      )}
                    >
                      <div
                        className={cn(
                          "flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border transition-colors",
                          isSelected
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-muted-foreground/25 bg-transparent",
                        )}
                      >
                        {isSelected && (
                          <Check
                            className="h-3 w-3 text-primary-foreground"
                            strokeWidth={3}
                          />
                        )}
                      </div>
                      <div className="min-w-0 flex-1 flex items-baseline gap-2">
                        <span className="truncate text-sm text-foreground">
                          {person.first_name} {person.last_name}
                        </span>
                        {meta && (
                          <span className="truncate text-xs text-muted-foreground">
                            {meta}
                          </span>
                        )}
                      </div>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </div>
        <DialogFooter className="px-6 pb-6 pt-2 gap-2">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleAdd} disabled={!selected || saving}>
            {saving ? "Adding..." : "Add member"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddVendorDialog({
  open,
  onOpenChange,
  existingVendorIds,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingVendorIds: string[];
  onAdd: (vendorId: string) => Promise<void>;
}) {
  const [allVendors, setAllVendors] = React.useState<VendorOption[]>([]);
  const [selected, setSelected] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setSelected(null);
    const supabase = createClient();
    supabase
      .from("companies")
      .select(
        "id, name, legal_name, vendor_class, contact_name, city, state, status",
      )
      .eq("is_vendor", true)
      .order("name")
      .then(({ data }) => {
        if (data) setAllVendors(data as VendorOption[]);
      });
  }, [open]);

  const available = allVendors.filter((v) => !existingVendorIds.includes(v.id));

  const handleAdd = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await onAdd(selected);
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 p-0 sm:max-w-md border-border/60 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 space-y-1">
          <DialogTitle className="text-lg tracking-tight">
            Add vendor
          </DialogTitle>
          <DialogDescription>
            Select a vendor from the company directory.
          </DialogDescription>
        </DialogHeader>
        <div className="px-6 pb-2">
          <Command className="overflow-visible" shouldFilter={true}>
            <CommandInput placeholder="Search vendors…" />
            <CommandList className="mt-2 max-h-72 -mx-1">
              <CommandEmpty>
                <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                  No vendors found.
                </div>
              </CommandEmpty>
              <CommandGroup className="p-0">
                {available.map((vendor) => {
                  const meta = [
                    vendor.vendor_class,
                    vendor.city && vendor.state
                      ? `${vendor.city}, ${vendor.state}`
                      : (vendor.city ?? vendor.state),
                  ]
                    .filter(Boolean)
                    .join(" · ");
                  const isSelected = selected === vendor.id;
                  return (
                    <CommandItem
                      key={vendor.id}
                      value={`${vendor.name} ${vendor.legal_name ?? ""} ${vendor.vendor_class ?? ""}`}
                      onSelect={() => setSelected(vendor.id)}
                      className={cn(
                        "flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 text-sm transition-colors",
                        "data-[selected=true]:bg-accent/60",
                      )}
                    >
                      <div
                        className={cn(
                          "flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border transition-colors",
                          isSelected
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-muted-foreground/25 bg-transparent",
                        )}
                      >
                        {isSelected && (
                          <Check
                            className="h-3 w-3 text-primary-foreground"
                            strokeWidth={3}
                          />
                        )}
                      </div>
                      <div className="min-w-0 flex-1 flex items-baseline gap-2">
                        <span className="truncate text-sm text-foreground">
                          {vendor.name}
                        </span>
                        {meta && (
                          <span className="truncate text-xs text-muted-foreground">
                            {meta}
                          </span>
                        )}
                      </div>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </div>
        <DialogFooter className="px-6 pb-6 pt-2 gap-2">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleAdd} disabled={!selected || saving}>
            {saving ? "Adding..." : "Add vendor"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Assign Existing Company Dialog ──────────────────────────────

interface CompanyOption {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
  vendor_class: string | null;
}

function AssignExistingCompanyDialog({
  open,
  onOpenChange,
  existingCompanyIds,
  projectId,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingCompanyIds: string[];
  projectId: string;
  onSuccess: () => void;
}) {
  const [allCompanies, setAllCompanies] = React.useState<CompanyOption[]>([]);
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setSelectedIds([]);
    const supabase = createClient();
    supabase
      .from("companies")
      .select("id, name, city, state, vendor_class")
      .order("name")
      .then(({ data }) => {
        if (data) setAllCompanies(data as CompanyOption[]);
      });
  }, [open]);

  const available = allCompanies.filter(
    (c) => !existingCompanyIds.includes(c.id),
  );

  const toggleSelected = (companyId: string) => {
    setSelectedIds((prev) =>
      prev.includes(companyId)
        ? prev.filter((id) => id !== companyId)
        : [...prev, companyId],
    );
  };

  const handleAssign = async () => {
    if (selectedIds.length === 0) return;
    setSaving(true);
    try {
      // Add each selected company. Settle all so one failure doesn't hide the
      // companies that did get added; surface a partial-failure count.
      const results = await Promise.allSettled(
        selectedIds.map((companyId) =>
          apiFetch(`/api/projects/${projectId}/directory/companies`, {
            method: "POST",
            body: JSON.stringify({ company_id: companyId }),
          }),
        ),
      );
      const failed = results.filter((r) => r.status === "rejected").length;
      const added = selectedIds.length - failed;
      if (added > 0) {
        toast.success(
          `${added} compan${added === 1 ? "y" : "ies"} added to project`,
        );
        onSuccess();
      }
      if (failed > 0) {
        toast.error(
          `${failed} compan${failed === 1 ? "y" : "ies"} could not be added`,
        );
      }
      if (failed === 0) onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100vh-2rem)] w-[calc(100vw-2rem)] gap-0 overflow-hidden border-border/60 p-0 sm:max-w-2xl">
        <DialogHeader className="px-6 pt-6 pb-4 space-y-1">
          <DialogTitle className="text-lg tracking-tight">
            Add companies
          </DialogTitle>
          <DialogDescription>
            Search and select one or more existing companies to add to this
            project.
          </DialogDescription>
        </DialogHeader>
        <div className="px-6 pb-2">
          <Command
            className="overflow-visible bg-transparent"
            shouldFilter={true}
          >
            <CommandInput
              className="bg-muted"
              placeholder="Search companies…"
            />
            <CommandList className="mt-3 max-h-72 -mx-1">
              <CommandEmpty>
                <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                  No companies found.
                </div>
              </CommandEmpty>
              <CommandGroup className="p-0">
                {available.map((company) => {
                  const meta = [
                    company.vendor_class,
                    company.city && company.state
                      ? `${company.city}, ${company.state}`
                      : (company.city ?? company.state),
                  ]
                    .filter(Boolean)
                    .join(" · ");
                  const isSelected = selectedIds.includes(company.id);
                  return (
                    <CommandItem
                      key={company.id}
                      value={`${company.name} ${company.city ?? ""} ${company.state ?? ""}`}
                      onSelect={() => toggleSelected(company.id)}
                      className={cn(
                        "flex min-w-0 cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 text-sm transition-colors",
                        "data-[selected=true]:bg-accent/60",
                      )}
                    >
                      <div
                        className={cn(
                          "flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border transition-colors",
                          isSelected
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-muted-foreground/25 bg-transparent",
                        )}
                      >
                        {isSelected && (
                          <Check
                            className="h-3 w-3 text-primary-foreground"
                            strokeWidth={3}
                          />
                        )}
                      </div>
                      <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2 gap-y-0.5">
                        <span className="min-w-0 truncate text-sm text-foreground">
                          {company.name}
                        </span>
                        {meta && (
                          <span className="min-w-0 truncate text-xs text-muted-foreground">
                            {meta}
                          </span>
                        )}
                      </div>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </div>
        <DialogFooter className="px-6 pb-6 pt-2 gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="w-full sm:w-auto"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            className="w-full sm:w-auto"
            onClick={handleAssign}
            disabled={selectedIds.length === 0 || saving}
          >
            {saving
              ? "Adding..."
              : selectedIds.length > 1
                ? `Add ${selectedIds.length} companies`
                : "Add company"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Project Team Section ────────────────────────────────────────

function ProjectTeamSection({
  projectId,
  manageRolesOpen,
  onManageRolesOpenChange,
}: {
  projectId: string;
  manageRolesOpen?: boolean;
  onManageRolesOpenChange?: (open: boolean) => void;
}) {
  const { roles, isLoading, updateRoleMembers, createRole, deleteRole } =
    useProjectRoles(projectId);
  const { confirm: confirmTeam, ConfirmDialog: TeamConfirmDialog } =
    useConfirm();
  const [search, setSearch] = React.useState("");
  const [assignDialog, setAssignDialog] = React.useState<{
    open: boolean;
    role: ProjectRole | null;
  }>({ open: false, role: null });
  const createRoleOpen = manageRolesOpen ?? false;
  const setCreateRoleOpen = (open: boolean) => {
    onManageRolesOpenChange?.(open);
  };

  const rows: RoleRow[] = roles.flatMap((role): RoleRow[] =>
    role.members.length > 0
      ? role.members.map((member) => ({ id: member.id, role, member }))
      : [{ id: role.id, role, member: null }],
  );

  const filteredRows = search
    ? rows.filter(
        (r) =>
          r.role.role_name.toLowerCase().includes(search.toLowerCase()) ||
          (r.member?.person?.full_name ?? "")
            .toLowerCase()
            .includes(search.toLowerCase()) ||
          (r.member?.person?.company_name ?? "")
            .toLowerCase()
            .includes(search.toLowerCase()),
      )
    : rows;

  const handleDeleteRole = async (role: ProjectRole) => {
    const ok = await confirmTeam({
      description: `Delete role "${role.role_name}"? This will remove all assignments for this role.`,
      variant: "destructive",
      confirmLabel: "Delete",
    });
    if (!ok) return;
    try {
      await deleteRole(role.id);
      toast.success("Role deleted");
    } catch (err) {
      toast.error("Failed to delete role");
    }
  };

  const teamColumns: TableColumn<RoleRow>[] = [
    {
      id: "role",
      label: "Role",
      width: 240,
      render: (item) => (
        <span className="block truncate text-sm text-muted-foreground">
          {item.role.role_name}
        </span>
      ),
      sortValue: (item) => item.role.role_name,
      csvValue: (item) => item.role.role_name,
    },
    {
      id: "name",
      label: "Name",
      render: (item) => {
        const { member, role } = item;
        if (!member) {
          return (
            <Button
              variant="link"
              size="sm"
              className="h-auto p-0 text-sm text-primary"
              onClick={() => setAssignDialog({ open: true, role })}
            >
              Assign
            </Button>
          );
        }
        const p = member.person;
        return (
          <div className="flex items-center gap-2.5">
            <Avatar className="h-7 w-7 shrink-0">
              <AvatarFallback className="bg-primary/10 text-primary text-xs font-medium">
                {initials(p?.first_name, p?.last_name)}
              </AvatarFallback>
            </Avatar>
            {p ? (
              <Link
                href={`/directory/contacts/${p.id}`}
                className="text-sm font-medium text-foreground hover:underline"
              >
                {p.full_name}
              </Link>
            ) : (
              <span className="text-sm font-medium text-muted-foreground">
                Unknown
              </span>
            )}
          </div>
        );
      },
      sortValue: (item) => item.member?.person?.full_name ?? "",
      csvValue: (item) => item.member?.person?.full_name ?? "",
    },
    {
      id: "company",
      label: "Company",
      render: (item) => (
        <span className="text-sm text-muted-foreground">
          {item.member?.person?.company_name ?? "—"}
        </span>
      ),
      sortValue: (item) => item.member?.person?.company_name ?? "",
      csvValue: (item) => item.member?.person?.company_name ?? "",
    },
    {
      id: "email",
      label: "Email",
      render: (item) => (
        <span className="text-sm text-muted-foreground">
          {item.member?.person?.email ?? "—"}
        </span>
      ),
      sortValue: (item) => item.member?.person?.email ?? "",
      csvValue: (item) => item.member?.person?.email ?? "",
    },
    {
      id: "phone",
      label: "Phone",
      render: (item) => {
        const p = item.member?.person;
        return (
          <span className="text-sm text-muted-foreground">
            {p?.phone_mobile || p?.phone_business || "—"}
          </span>
        );
      },
      sortValue: (item) => {
        const p = item.member?.person;
        return p?.phone_mobile || p?.phone_business || "";
      },
      csvValue: (item) => {
        const p = item.member?.person;
        return p?.phone_mobile || p?.phone_business || "";
      },
    },
    {
      id: "actions",
      label: "",
      render: (item) => {
        const { role, member } = item;
        const handleRemoveOne = async () => {
          if (!member) return;
          try {
            await updateRoleMembers(
              role.id,
              role.members
                .filter((m) => m.person_id !== member.person_id)
                .map((m) => m.person_id),
            );
            toast.success("Removed from role");
          } catch {
            toast.error("Could not remove person from role", {
              description: `${member.person?.full_name ?? "This person"} could not be removed from ${role.role_name}.`,
            });
          }
        };
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => setAssignDialog({ open: true, role })}
              >
                <UserPlus className="mr-2 h-3.5 w-3.5" />
                {member ? "Add another person" : "Assign someone"}
              </DropdownMenuItem>
              {member && (
                <DropdownMenuItem onClick={() => void handleRemoveOne()}>
                  <UserX className="mr-2 h-3.5 w-3.5" />
                  Remove this person
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                className="text-destructive"
                onClick={() => handleDeleteRole(role)}
              >
                <Trash2 className="mr-2 h-3.5 w-3.5" />
                Delete role
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];

  return (
    <>
      {isLoading ? (
        <>
          <SectionActionsOnly
            action={
              <Button
                size="xs"
                data-keep-text
                onClick={() => setCreateRoleOpen(true)}
              >
                Add Role
              </Button>
            }
          />
          <div className="mt-4">
            <SectionSkeleton rows={3} />
          </div>
        </>
      ) : roles.length === 0 ? (
        <>
          <SectionActionsOnly
            action={
              <Button
                size="xs"
                data-keep-text
                onClick={() => setCreateRoleOpen(true)}
              >
                Add Role
              </Button>
            }
          />
          <EmptyState
            title="No roles defined yet"
            description="Roles help organize your project team by responsibility."
            action={
              <Button size="sm" onClick={() => setCreateRoleOpen(true)}>
                Add a role
              </Button>
            }
            className="py-6"
          />
        </>
      ) : (
        <DirectoryUnifiedTable
          title="Project Team"
          action={
            <Button
              size="xs"
              data-keep-text
              onClick={() => setCreateRoleOpen(true)}
            >
              Add Role
            </Button>
          }
          items={filteredRows}
          columns={teamColumns}
          getRowId={(item) => item.id}
          search={search}
          onSearch={setSearch}
          searchPlaceholder="Search roles or members..."
          totalItems={rows.length}
          emptyTitle="No project team matches"
          emptyDescription="Assign project roles to keep responsibilities clear."
          filteredDescription="No roles or members match the current search."
          isFiltered={Boolean(search)}
        />
      )}

      <AssignMemberDialog
        open={assignDialog.open}
        onOpenChange={(open) => setAssignDialog((prev) => ({ ...prev, open }))}
        role={assignDialog.role}
        onSave={updateRoleMembers}
        projectId={projectId}
      />
      <ProjectTeamDialog
        open={createRoleOpen}
        onOpenChange={setCreateRoleOpen}
        projectId={projectId}
        roles={roles}
        createRole={createRole}
        updateRoleMembers={updateRoleMembers}
        deleteRole={deleteRole}
      />
      {TeamConfirmDialog}
    </>
  );
}

// ─── Effective Permissions Dialog ────────────────────────────────

const MODULE_LABELS: Record<PermissionModule, string> = {
  directory: "Directory",
  budget: "Budget",
  contracts: "Contracts",
  commitments: "Commitments",
  estimates: "Estimates",
  documents: "Documents",
  schedule: "Schedule",
  submittals: "Submittals",
  rfis: "RFIs",
  change_orders: "Change Orders",
  change_events: "Change Events",
  emails: "Emails",
};

const LEVEL_LABELS: Record<PermissionLevel, string> = {
  none: "None",
  read: "Read",
  write: "Write",
  admin: "Admin",
};

function EffectivePermissionsDialog({
  open,
  onOpenChange,
  person,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  person: PersonWithDetails | null;
}) {
  if (!person) return null;

  const template = person.permission_template;
  const rules = (template?.rules_json ?? {}) as Record<
    PermissionModule,
    PermissionLevel[]
  >;
  const granularFlags = (template?.granular_flags ?? []) as GranularFlag[];

  const getHighestLevel = (levels: PermissionLevel[]): PermissionLevel => {
    if (levels.includes("admin")) return "admin";
    if (levels.includes("write")) return "write";
    if (levels.includes("read")) return "read";
    return "none";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 p-0 sm:max-w-lg border-border/60 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 space-y-1">
          <DialogTitle className="text-lg tracking-tight">
            Effective permissions
          </DialogTitle>
          <DialogDescription>
            What {person.first_name} {person.last_name} can do on this project.
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 pb-6 space-y-5">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Template
            </span>
            <Badge
              variant={template ? "secondary" : "outline"}
              className="rounded-full"
            >
              {template?.name ?? "No template assigned"}
            </Badge>
          </div>

          <div>
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-2">
              Module access
            </p>
            <div className="divide-y divide-border/40 rounded-lg bg-muted/30">
              {ALL_MODULES.map((mod) => {
                const levels = rules[mod] ?? [];
                const highest = getHighestLevel(levels);
                return (
                  <div
                    key={mod}
                    className="flex items-center justify-between gap-3 px-3 py-2.5"
                  >
                    <span className="text-sm font-medium text-foreground">
                      {MODULE_LABELS[mod]}
                    </span>
                    <Badge
                      variant={highest === "none" ? "outline" : "secondary"}
                      className={cn(
                        "rounded-full px-2.5 text-[11px] font-medium",
                        highest === "admin" &&
                          "bg-primary/10 text-primary border-primary/20",
                        highest === "write" &&
                          "bg-primary/10 text-primary border-primary/20",
                        highest === "read" &&
                          "bg-success/10 text-success border-success/20",
                        highest === "none" && "text-muted-foreground",
                      )}
                    >
                      {LEVEL_LABELS[highest]}
                    </Badge>
                  </div>
                );
              })}
            </div>
          </div>

          {granularFlags.length > 0 && (
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-2">
                Additional capabilities
              </p>
              <ul className="space-y-1.5">
                {granularFlags.map((flag) => (
                  <li
                    key={flag}
                    className="flex items-center gap-2 text-sm text-foreground"
                  >
                    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary/10">
                      <Check
                        className="h-2.5 w-2.5 text-primary"
                        strokeWidth={3}
                      />
                    </span>
                    {GRANULAR_FLAG_LABELS[flag] ?? flag}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Inline Template Selector ───────────────────────────────────

function TemplateSelector({
  currentTemplateId,
  personId,
  projectId,
  onAssigned,
}: {
  currentTemplateId: string | null;
  personId: string;
  projectId: string;
  onAssigned: () => void;
}) {
  const { templates, assignTemplate } = usePermissionTemplates();
  const [assigning, setAssigning] = React.useState(false);

  const handleChange = async (templateId: string) => {
    if (templateId === (currentTemplateId ?? "")) return;
    setAssigning(true);
    try {
      await assignTemplate(projectId, personId, templateId);
      toast.success("Permission template updated");
      onAssigned();
    } catch (err) {
      toast.error("Failed to assign template");
    } finally {
      setAssigning(false);
    }
  };

  return (
    <Select
      value={currentTemplateId ?? ""}
      onValueChange={handleChange}
      disabled={assigning}
    >
      <SelectTrigger className="h-7 w-40 text-xs">
        <SelectValue placeholder="No template" />
      </SelectTrigger>
      <SelectContent>
        {templates.map((t) => (
          <SelectItem key={t.id} value={t.id} className="text-xs">
            {t.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// ─── Members Unified Table (stable component — avoids hook-in-render) ──

function MembersUnifiedTable({
  filtered,
  totalItems,
  action,
  search,
  onSearch,
  filters,
  activeFilters,
  onFilterChange,
  onClearFilters,
  isFiltered,
  removingPersonId,
  handleRemoveMember,
  projectId,
  onRefetch,
}: {
  filtered: PersonWithDetails[];
  totalItems: number;
  action: React.ReactNode;
  search: string;
  onSearch: (value: string) => void;
  filters?: FilterConfig[];
  activeFilters: Record<string, FilterValue>;
  onFilterChange: (filters: Record<string, FilterValue>) => void;
  onClearFilters: () => void;
  isFiltered: boolean;
  removingPersonId: string | null;
  handleRemoveMember: (id: string) => Promise<void>;
  projectId: string;
  onRefetch: () => void;
}) {
  const [permDialog, setPermDialog] = React.useState<{
    open: boolean;
    person: PersonWithDetails | null;
  }>({ open: false, person: null });

  const columns = React.useMemo<TableColumn<PersonWithDetails>[]>(
    () => [
      {
        id: "name",
        label: "Name",
        render: (person) => {
          return (
            <div className="flex items-center gap-2.5">
              <Avatar className="h-8 w-8 shrink-0">
                <AvatarFallback className="bg-primary/10 text-primary text-xs font-medium">
                  {initials(person.first_name, person.last_name)}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm font-medium text-foreground">
                {person.first_name} {person.last_name}
              </span>
            </div>
          );
        },
        sortValue: (person) => `${person.first_name} ${person.last_name}`,
        csvValue: (person) => `${person.first_name} ${person.last_name}`,
      },
      {
        id: "type",
        label: "Type",
        render: (person) => (
          <span className="text-sm text-muted-foreground capitalize">
            {person.person_type ?? "—"}
          </span>
        ),
        sortValue: (person) => person.person_type ?? "",
        csvValue: (person) => person.person_type ?? "",
      },
      {
        id: "role",
        label: "Job Title",
        render: (person) => (
          <span className="text-sm text-muted-foreground">
            {person.job_title ?? "—"}
          </span>
        ),
        sortValue: (person) => person.job_title ?? "",
        csvValue: (person) => person.job_title ?? "",
      },
      {
        id: "company",
        label: "Company",
        render: (person) => (
          <span className="text-sm text-muted-foreground">
            {person.company?.name ?? "—"}
          </span>
        ),
        sortValue: (person) => person.company?.name ?? "",
        csvValue: (person) => person.company?.name ?? "",
      },
      {
        id: "permission_template",
        label: "Permission Template",
        render: (person) => {
          const templateId = person.membership?.permission_template_id ?? null;
          return (
            <TemplateSelector
              currentTemplateId={templateId}
              personId={person.id}
              projectId={projectId}
              onAssigned={onRefetch}
            />
          );
        },
        sortValue: (person) => person.membership?.permission_template_id ?? "",
        csvValue: (person) => accessLevelLabel(person.permission_template),
      },
      {
        id: "email",
        label: "Email",
        render: (person) => (
          <span className="text-sm text-muted-foreground">
            {person.email ?? "—"}
          </span>
        ),
        sortValue: (person) => person.email ?? "",
        csvValue: (person) => person.email ?? "",
      },
      {
        id: "phone",
        label: "Phone",
        render: (person) => {
          const phone = person.phone_mobile || person.phone_business;
          return (
            <span className="text-sm text-muted-foreground">
              {phone ?? "—"}
            </span>
          );
        },
        sortValue: (person) =>
          person.phone_mobile || person.phone_business || "",
        csvValue: (person) =>
          person.phone_mobile || person.phone_business || "",
      },
      {
        id: "actions",
        label: "Actions",
        render: (person) => {
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreVertical />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => setPermDialog({ open: true, person })}
                >
                  <ShieldCheck className="mr-2 h-3.5 w-3.5" />
                  View Permissions
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Pencil className="mr-2 h-3.5 w-3.5" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Mail className="mr-2 h-3.5 w-3.5" />
                  Send Email
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-destructive"
                  disabled={removingPersonId === person.id}
                  onClick={() => void handleRemoveMember(person.id)}
                >
                  <UserX className="mr-2 h-3.5 w-3.5" />
                  {removingPersonId === person.id ? "Removing..." : "Remove"}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
      },
    ],
    [removingPersonId, handleRemoveMember, projectId, onRefetch],
  );

  return (
    <>
      <DirectoryUnifiedTable
        title="All Project Members"
        action={action}
        columns={columns}
        items={filtered}
        getRowId={(person) => person.id}
        search={search}
        onSearch={onSearch}
        searchPlaceholder="Search by name, role or company..."
        totalItems={totalItems}
        filters={filters}
        activeFilters={activeFilters}
        onFilterChange={onFilterChange}
        onClearFilters={onClearFilters}
        emptyTitle="No members"
        emptyDescription="Add project members to manage access and assignments."
        filteredDescription="No project members match the current filters."
        isFiltered={isFiltered}
        enablePagination={filtered.length > 15}
      />
      <EffectivePermissionsDialog
        open={permDialog.open}
        onOpenChange={(open) => setPermDialog((prev) => ({ ...prev, open }))}
        person={permDialog.person}
      />
    </>
  );
}

// ─── External Members Section ────────────────────────────────────

function ExternalMembersSection({
  projectId,
  onAddClick,
  onRefetch: externalRefetch,
}: {
  projectId: string;
  onAddClick: () => void;
  onRefetch?: () => void;
}) {
  const {
    users: members,
    isLoading,
    error,
    refetch,
  } = useProjectUsers(projectId, { type: "all" });
  const { confirm: confirmMember, ConfirmDialog: MemberConfirmDialog } =
    useConfirm();
  const [search, setSearch] = React.useState("");
  const deferredSearch = React.useDeferredValue(search);
  const [activeFilters, setActiveFilters] = React.useState<
    Record<string, string | undefined>
  >({});
  const [removingPersonId, setRemovingPersonId] = React.useState<string | null>(
    null,
  );

  const allMembers = React.useMemo(() => {
    return filterProjectMembers(members);
  }, [members]);

  const handleRemoveMember = async (personId: string) => {
    if (removingPersonId) return;
    const ok = await confirmMember({
      description: "Remove this member from the project directory?",
      variant: "destructive",
      confirmLabel: "Remove",
    });
    if (!ok) return;
    try {
      setRemovingPersonId(personId);
      await apiFetch(
        `/api/projects/${projectId}/directory/people/${personId}`,
        { method: "DELETE" },
      );
      await refetch();
      toast.success("Member removed");
    } catch (err) {
      toast.error("Could not remove member", {
        description:
          err instanceof Error
            ? err.message
            : "The project directory did not confirm the removal.",
      });
    } finally {
      setRemovingPersonId(null);
    }
  };

  const companies = React.useMemo(() => {
    const names = new Set<string>();
    allMembers.forEach((p) => {
      if (p.company?.name) names.add(p.company.name);
    });
    return Array.from(names).sort();
  }, [allMembers]);

  const companyFilter = activeFilters.company;

  const memberFilters = React.useMemo<FilterConfig[] | undefined>(
    () =>
      companies.length > 0
        ? [
            {
              id: "company",
              label: "Company",
              type: "select",
              options: companies.map((company) => ({
                value: company,
                label: company,
              })),
            },
          ]
        : undefined,
    [companies],
  );

  const handleMemberFilterChange = React.useCallback(
    (nextFilters: Record<string, FilterValue>) => {
      const nextCompany = nextFilters.company;
      setActiveFilters({
        company: typeof nextCompany === "string" ? nextCompany : undefined,
      });
    },
    [],
  );

  const handleClearMemberFilters = React.useCallback(() => {
    setActiveFilters({});
  }, []);

  const filtered = React.useMemo(() => {
    const q = deferredSearch.trim().toLowerCase();
    return allMembers.filter((p) => {
      const matchesSearch =
        !q ||
        `${p.first_name} ${p.last_name}`.toLowerCase().includes(q) ||
        (p.email ?? "").toLowerCase().includes(q) ||
        (p.company?.name ?? "").toLowerCase().includes(q) ||
        (p.job_title ?? "").toLowerCase().includes(q);
      const matchesCompany =
        !companyFilter || p.company?.name === companyFilter;
      return matchesSearch && matchesCompany;
    });
  }, [allMembers, companyFilter, deferredSearch]);

  if (isLoading) return <SectionSkeleton rows={5} />;
  if (error)
    return (
      <p className="text-sm text-destructive py-6">Failed to load members.</p>
    );

  return (
    <>
      <MembersUnifiedTable
        filtered={filtered}
        totalItems={allMembers.length}
        action={
          <Button size="xs" data-keep-text onClick={onAddClick}>
            Add Members
          </Button>
        }
        search={search}
        onSearch={setSearch}
        filters={memberFilters}
        activeFilters={activeFilters}
        onFilterChange={handleMemberFilterChange}
        onClearFilters={handleClearMemberFilters}
        isFiltered={Boolean(search || companyFilter)}
        removingPersonId={removingPersonId}
        handleRemoveMember={handleRemoveMember}
        projectId={projectId}
        onRefetch={() => {
          refetch();
          externalRefetch?.();
        }}
      />
      {MemberConfirmDialog}
    </>
  );
}

// ─── Vendors Section ─────────────────────────────────────────────

function VendorsSection({
  vendors,
  isLoading,
  error,
  onAddVendorClick,
  onRemoveVendor,
}: {
  vendors: ReturnType<typeof useProjectVendors>["vendors"];
  isLoading: boolean;
  error: Error | null;
  onAddVendorClick: () => void;
  onRemoveVendor: (id: string) => Promise<void>;
}) {
  const { confirm: confirmVendor, ConfirmDialog: VendorConfirmDialog } =
    useConfirm();
  const [removingId, setRemovingId] = React.useState<string | null>(null);

  const handleRemove = React.useCallback(
    async (pv: (typeof vendors)[0]) => {
      const name = pv.companies?.name ?? "this vendor";
      const ok = await confirmVendor({
        description: `Remove "${name}" from this project?`,
        variant: "destructive",
        confirmLabel: "Remove",
      });
      if (!ok) return;

      try {
        setRemovingId(pv.id);
        await onRemoveVendor(pv.id);
        toast.success(`${name} removed`);
      } catch (err) {
        toast.error("Could not remove vendor", {
          description:
            err instanceof Error
              ? err.message
              : `${name} could not be removed from this project.`,
        });
      } finally {
        setRemovingId(null);
      }
    },
    [confirmVendor, onRemoveVendor],
  );

  const vendorColumns = React.useMemo<TableColumn<(typeof vendors)[0]>[]>(
    () => [
      {
        id: "name",
        label: "Name",
        render: (projectVendor) => {
          const vendor = projectVendor.companies;
          return (
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted">
                <Package className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
              <span className="truncate text-sm font-medium text-foreground">
                {vendor?.name ?? "—"}
              </span>
            </div>
          );
        },
        sortValue: (projectVendor) => projectVendor.companies?.name ?? "",
        csvValue: (projectVendor) => projectVendor.companies?.name ?? "",
      },
      {
        id: "class",
        label: "Class",
        render: (projectVendor) => (
          <span className="text-sm text-muted-foreground">
            {projectVendor.companies?.vendor_class ?? "—"}
          </span>
        ),
        sortValue: (projectVendor) =>
          projectVendor.companies?.vendor_class ?? "",
        csvValue: (projectVendor) =>
          projectVendor.companies?.vendor_class ?? "",
      },
      {
        id: "location",
        label: "Location",
        render: (projectVendor) => {
          const vendor = projectVendor.companies;
          const location =
            vendor?.city && vendor?.state
              ? `${vendor.city}, ${vendor.state}`
              : (vendor?.city ?? vendor?.state ?? "—");
          return (
            <span className="text-sm text-muted-foreground">{location}</span>
          );
        },
        sortValue: (projectVendor) => {
          const vendor = projectVendor.companies;
          return vendor?.city && vendor?.state
            ? `${vendor.city}, ${vendor.state}`
            : (vendor?.city ?? vendor?.state ?? "");
        },
        csvValue: (projectVendor) => {
          const vendor = projectVendor.companies;
          return vendor?.city && vendor?.state
            ? `${vendor.city}, ${vendor.state}`
            : (vendor?.city ?? vendor?.state ?? "");
        },
      },
      {
        id: "actions",
        label: "",
        render: (projectVendor) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                className="text-destructive"
                disabled={removingId === projectVendor.id}
                onClick={() => void handleRemove(projectVendor)}
              >
                <Trash2 className="mr-2 h-3.5 w-3.5" />
                {removingId === projectVendor.id ? "Removing..." : "Remove"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ],
    [handleRemove, removingId],
  );

  if (isLoading) return <SectionSkeleton rows={3} />;
  if (error) {
    return (
      <p className="text-sm text-destructive py-4">Failed to load vendors.</p>
    );
  }

  if (vendors.length === 0) {
    return (
      <EmptyState
        title="No vendors yet"
        description="Add vendors to track subcontractors and suppliers on this project."
        action={
          <Button size="sm" onClick={onAddVendorClick}>
            Add vendor
          </Button>
        }
        className="py-6"
      />
    );
  }

  return (
    <>
      <DirectoryUnifiedTable
        title="Vendors"
        action={
          <Button
            type="button"
            size="xs"
            data-keep-text
            onClick={onAddVendorClick}
          >
            Add Vendor
          </Button>
        }
        items={vendors}
        columns={vendorColumns}
        getRowId={(projectVendor) => projectVendor.id}
        emptyTitle="No vendors"
        emptyDescription="Add vendors to keep project purchasing contacts available."
        filteredDescription="No vendors match the current filters."
        isFiltered={false}
        enablePagination={vendors.length > 10}
      />
      {VendorConfirmDialog}
    </>
  );
}

// ─── Companies Section ──────────────────────────────────────────

type SubcontractorContact = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone_business: string | null;
  phone_mobile: string | null;
};

function contactDisplayName(c: SubcontractorContact | null): string {
  if (!c) return "";
  const name = [c.first_name, c.last_name].filter(Boolean).join(" ").trim();
  return name || c.email || "";
}

type CompanyContact = SubcontractorContact & {
  job_title: string | null;
};

type EditableContactField = "job_title" | "email" | "phone_business";

type SubcontractorRow = {
  id: string;
  companyId: string;
  projectCompanyId: string;
  companyName: string;
  typeLabel: string;
  isPrimary: boolean;
  contact: CompanyContact | null;
};

// One row per company — used by the Subcontractors table's "By company"
// roll-up view, which collapses each company's contacts into a single row
// (expandable to see every contact) instead of one row per contact.
type CompanyGroupRow = {
  id: string;
  companyId: string;
  projectCompanyId: string;
  companyName: string;
  typeLabel: string;
  contacts: CompanyContact[];
  primaryContact: CompanyContact | null;
};

type DirectorySubcontractorView = "contacts" | "companies";
type DirectoryPageTab = "subcontractors" | "project-team";

function SubcontractorViewSwitch({
  value,
  onChange,
  className,
}: {
  value: DirectorySubcontractorView;
  onChange: (value: DirectorySubcontractorView) => void;
  className?: string;
}) {
  return (
    <ToggleGroup
      type="single"
      value={value}
      onValueChange={(nextValue) => {
        if (nextValue === "contacts" || nextValue === "companies") {
          onChange(nextValue);
        }
      }}
      aria-label="Subcontractors view"
      className={cn("rounded-md border border-border/60", className)}
      size="sm"
    >
      <ToggleGroupItem
        value="contacts"
        aria-label="View by contact"
        className="h-8 px-3 text-xs"
      >
        By contact
      </ToggleGroupItem>
      <ToggleGroupItem
        value="companies"
        aria-label="View by company"
        className="h-8 px-3 text-xs"
      >
        By company
      </ToggleGroupItem>
    </ToggleGroup>
  );
}

// Add-contact flow lifted out of the old per-company card. Lets the user attach
// an existing directory contact to a company, or jump to creating a new one —
// reused for every company from the flat Subcontractors table.
type CompanyContactOption = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  company_name: string | null;
  companyId: string | null;
};

// Multi-select contact picker for a company — same Modal + checkbox + assigned-
// pills layout as AssignMemberDialog (Project Team) so both flows are identical.
// Toggling a contact attaches/detaches them from this company immediately.
function AddCompanyContactDialog({
  open,
  onOpenChange,
  companyId,
  companyName,
  onAdded,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string | null;
  companyName: string;
  onAdded: () => void;
}) {
  const [createOpen, setCreateOpen] = React.useState(false);
  const [people, setPeople] = React.useState<CompanyContactOption[]>([]);
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
  const [search, setSearch] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  const load = React.useCallback(() => {
    if (!companyId) return;
    const supabase = createClient();
    supabase
      .from("people")
      .select(
        "id, first_name, last_name, email, company_id, company:companies!people_company_id_fkey(name)",
      )
      .order("first_name", { ascending: true })
      .limit(1000)
      .then(({ data }) => {
        const rows: CompanyContactOption[] = (
          (data ?? []) as Array<Record<string, unknown>>
        ).map((row) => ({
          id: row.id as string,
          first_name: (row.first_name as string | null) ?? null,
          last_name: (row.last_name as string | null) ?? null,
          email: (row.email as string | null) ?? null,
          company_name: (row.company as { name?: string } | null)?.name ?? null,
          companyId: (row.company_id as string | null) ?? null,
        }));
        setPeople(rows);
        setSelectedIds(
          rows.filter((r) => r.companyId === companyId).map((r) => r.id),
        );
      });
  }, [companyId]);

  React.useEffect(() => {
    if (!open) return;
    setSearch("");
    load();
  }, [open, load]);

  const personLabel = (p: CompanyContactOption) =>
    [p.first_name, p.last_name].filter(Boolean).join(" ").trim() ||
    p.email ||
    "Unnamed";

  const handleToggle = async (personId: string) => {
    if (!companyId || saving) return;
    const wasSelected = selectedIds.includes(personId);
    setSaving(true);
    setSelectedIds((prev) =>
      wasSelected ? prev.filter((id) => id !== personId) : [...prev, personId],
    );
    try {
      await updateContact(personId, {
        company_id: wasSelected ? null : companyId,
      });
      setPeople((prev) =>
        prev.map((p) =>
          p.id === personId
            ? { ...p, companyId: wasSelected ? null : companyId }
            : p,
        ),
      );
      onAdded();
    } catch (error) {
      setSelectedIds((prev) =>
        wasSelected
          ? [...prev, personId]
          : prev.filter((id) => id !== personId),
      );
      const message =
        error instanceof ApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Failed to update contact";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          size="2xl"
          className="flex flex-col overflow-hidden gap-0 p-0 border-border/60"
          style={{ maxHeight: "85vh" }}
        >
          <DialogHeader className="px-6 pt-6 pb-4 space-y-1">
            <DialogTitle className="text-lg tracking-tight">
              Add from company directory
            </DialogTitle>
            <DialogDescription>
              {companyName
                ? `Select people already in the company directory for ${companyName}, or create a new person.`
                : "Select people already in the company directory for this company, or create a new person."}
            </DialogDescription>
          </DialogHeader>

          <div className="flex min-h-0 flex-col px-6 pb-6">
            <Command className="overflow-visible" shouldFilter={true}>
              <div className="rounded-md bg-muted/50">
                <CommandInput
                  placeholder="Search company directory…"
                  value={search}
                  onValueChange={setSearch}
                />
              </div>
              <CommandList className="mt-2 max-h-80 overflow-y-auto overscroll-contain -mx-1">
                <CommandEmpty>
                  <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                    {search
                      ? `No matches for "${search}".`
                      : "No people found in the company directory."}
                  </div>
                </CommandEmpty>
                <CommandGroup className="p-0">
                  {people.map((person) => {
                    const displayName = personLabel(person);
                    const email = person.email ?? "";
                    const company = person.company_name ?? "";
                    const isSelected = selectedIds.includes(person.id);
                    return (
                      <CommandItem
                        key={person.id}
                        value={`${displayName} ${email} ${company}`}
                        onSelect={() => void handleToggle(person.id)}
                        className={cn(
                          "flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 text-sm transition-colors",
                          "data-[selected=true]:bg-accent/60",
                        )}
                        disabled={saving}
                      >
                        <div
                          className={cn(
                            "flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border transition-colors",
                            isSelected
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-muted-foreground/25 bg-transparent",
                          )}
                        >
                          {isSelected && (
                            <Check
                              className="h-3 w-3 text-primary-foreground"
                              strokeWidth={3}
                            />
                          )}
                        </div>
                        <div className="grid min-w-0 flex-1 grid-cols-[minmax(0,1.1fr)_minmax(0,1.4fr)_minmax(0,1fr)] items-baseline gap-3">
                          <span className="truncate text-sm text-foreground">
                            {displayName}
                          </span>
                          <span className="truncate text-xs text-muted-foreground">
                            {email}
                          </span>
                          <span className="truncate text-xs text-muted-foreground">
                            {company}
                          </span>
                        </div>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              </CommandList>
            </Command>

            {selectedIds.length > 0 && (
              <div className="mt-4">
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-2">
                  Assigned · {selectedIds.length}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {selectedIds.map((id) => {
                    const p = people.find((person) => person.id === id);
                    if (!p) return null;
                    return (
                      <span
                        key={id}
                        className="inline-flex items-center gap-1 rounded-full bg-secondary py-0.5 pl-2.5 pr-1 text-xs"
                      >
                        <span className="text-foreground">{personLabel(p)}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => void handleToggle(id)}
                          disabled={saving}
                          aria-label={`Remove ${personLabel(p)}`}
                          className="ml-0.5 h-4 w-4 rounded-full text-muted-foreground hover:bg-background hover:text-foreground disabled:opacity-40"
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </span>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="mt-4 flex justify-end">
              <Button
                type="button"
                variant="link"
                size="xs"
                onClick={() => {
                  onOpenChange(false);
                  setCreateOpen(true);
                }}
                className="text-xs font-medium"
              >
                <UserPlus className="h-3 w-3" />
                Create new person
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <ContactFormSheet
        open={createOpen}
        onOpenChange={setCreateOpen}
        defaultCompanyId={companyId ?? undefined}
        onSuccess={() => {
          onAdded();
          load();
        }}
      />
    </>
  );
}

function CompaniesSection({
  projectId,
  companies,
  isLoading,
  error,
  ownerCompanyId,
  onAssignClick,
  onRefetch,
  onCompanyClick,
}: {
  projectId: string;
  companies: Array<{
    id: string;
    company_id: string;
    company?: { name: string | null; vendor_class?: string | null } | null;
    user_count?: number | null;
    primary_contact_id?: string | null;
    primary_contact?: SubcontractorContact | null;
  }>;
  isLoading: boolean;
  error: Error | null;
  ownerCompanyId: string | null;
  onAssignClick: () => void;
  onRefetch: () => void;
  onCompanyClick: (companyId: string) => void;
}) {
  const { confirm: confirmCompany, ConfirmDialog: CompanyConfirmDialog } =
    useConfirm();
  const { confirm: confirmContact, ConfirmDialog: ContactConfirmDialog } =
    useConfirm();
  const updateMutation = useUpdateProjectCompany(projectId);
  const [search, setSearch] = React.useState("");
  const deferredSearch = React.useDeferredValue(search);
  const [removingCompanyId, setRemovingCompanyId] = React.useState<
    string | null
  >(null);
  const [addContact, setAddContact] = React.useState<{
    open: boolean;
    companyId: string | null;
    companyName: string;
  }>({ open: false, companyId: null, companyName: "" });
  const [subcontractorView, setSubcontractorView] =
    React.useState<DirectorySubcontractorView>("contacts");
  const isGrouped = subcontractorView === "companies";
  const [expandedCompanyIds, setExpandedCompanyIds] = React.useState<
    Set<string>
  >(new Set());
  const toggleExpandedCompany = React.useCallback((id: string) => {
    setExpandedCompanyIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);
  const subcontractorViewSwitch = (
    <SubcontractorViewSwitch
      value={subcontractorView}
      onChange={setSubcontractorView}
    />
  );

  const handleRemoveCompany = async (
    companyId: string,
    companyName: string,
  ) => {
    if (removingCompanyId) return;
    const ok = await confirmCompany({
      description: `Remove ${companyName} from this project directory?`,
      variant: "destructive",
      confirmLabel: "Remove",
    });
    if (!ok) return;
    try {
      setRemovingCompanyId(companyId);
      await apiFetch(
        `/api/projects/${projectId}/directory/companies/${companyId}`,
        { method: "DELETE" },
      );
      onRefetch();
      toast.success("Company removed");
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Failed to remove company";
      toast.error(message);
    } finally {
      setRemovingCompanyId(null);
    }
  };

  const companyIds = React.useMemo(
    () => companies.map((c) => c.company_id),
    [companies],
  );

  const [contactsByCompany, setContactsByCompany] = React.useState<
    Map<string, CompanyContact[]>
  >(new Map());

  const reloadContacts = React.useCallback(() => {
    if (companyIds.length === 0) {
      setContactsByCompany(new Map());
      return;
    }
    const supabase = createClient();
    supabase
      .from("people")
      .select(
        "id, first_name, last_name, email, phone_business, phone_mobile, job_title, company_id",
      )
      .in("company_id", companyIds)
      .order("first_name", { ascending: true })
      .then(({ data }) => {
        const map = new Map<string, CompanyContact[]>();
        (
          (data ?? []) as Array<CompanyContact & { company_id: string }>
        ).forEach((person) => {
          const list = map.get(person.company_id) ?? [];
          list.push(person);
          map.set(person.company_id, list);
        });
        setContactsByCompany(map);
      });
  }, [companyIds]);

  React.useEffect(() => {
    reloadContacts();
  }, [reloadContacts]);

  const companyCards = React.useMemo(() => {
    return companies
      .map((projectCompany) => {
        const vendorClass = projectCompany.company?.vendor_class ?? null;
        const isOwner =
          ownerCompanyId !== null &&
          projectCompany.company_id === ownerCompanyId;
        const typeLabel = isOwner
          ? "Owner"
          : vendorClass === "SUB"
            ? "Subcontractor"
            : vendorClass || "";
        return {
          companyId: projectCompany.company_id,
          projectCompanyId: projectCompany.id,
          name: projectCompany.company?.name || "Untitled Company",
          typeLabel,
          primaryContactId:
            projectCompany.primary_contact_id ??
            projectCompany.primary_contact?.id ??
            null,
          contacts: contactsByCompany.get(projectCompany.company_id) ?? [],
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [companies, ownerCompanyId, contactsByCompany]);

  // Flatten to one row per contact (placeholder row for companies with no
  // contacts), mirroring the Project Team table's one-row-per-member model so
  // both sections share the same compact UnifiedTablePage layout & row height.
  const allRows: SubcontractorRow[] = React.useMemo(
    () =>
      companyCards.flatMap((card): SubcontractorRow[] => {
        const effectivePrimaryId =
          card.primaryContactId ?? card.contacts[0]?.id ?? null;
        if (card.contacts.length === 0) {
          return [
            {
              id: `empty-${card.projectCompanyId}`,
              companyId: card.companyId,
              projectCompanyId: card.projectCompanyId,
              companyName: card.name,
              typeLabel: card.typeLabel,
              isPrimary: false,
              contact: null,
            },
          ];
        }
        return card.contacts.map((contact) => ({
          id: contact.id,
          companyId: card.companyId,
          projectCompanyId: card.projectCompanyId,
          companyName: card.name,
          typeLabel: card.typeLabel,
          isPrimary: contact.id === effectivePrimaryId,
          contact,
        }));
      }),
    [companyCards],
  );

  const filteredRows = React.useMemo(() => {
    const q = deferredSearch.trim().toLowerCase();
    if (!q) return allRows;
    return allRows.filter((row) => {
      if (row.companyName.toLowerCase().includes(q)) return true;
      const c = row.contact;
      return (
        !!c &&
        (contactDisplayName(c).toLowerCase().includes(q) ||
          (c.email ?? "").toLowerCase().includes(q) ||
          (c.job_title ?? "").toLowerCase().includes(q))
      );
    });
  }, [allRows, deferredSearch]);

  // "By company" roll-up: one row per company instead of one row per contact.
  const groupedRows: CompanyGroupRow[] = React.useMemo(() => {
    const q = deferredSearch.trim().toLowerCase();
    const cards = q
      ? companyCards.filter((card) => {
          if (card.name.toLowerCase().includes(q)) return true;
          return card.contacts.some(
            (c) =>
              contactDisplayName(c).toLowerCase().includes(q) ||
              (c.email ?? "").toLowerCase().includes(q) ||
              (c.job_title ?? "").toLowerCase().includes(q),
          );
        })
      : companyCards;
    return cards.map((card) => ({
      id: card.projectCompanyId,
      companyId: card.companyId,
      projectCompanyId: card.projectCompanyId,
      companyName: card.name,
      typeLabel: card.typeLabel,
      contacts: card.contacts,
      primaryContact:
        card.contacts.find((c) => c.id === card.primaryContactId) ??
        card.contacts[0] ??
        null,
    }));
  }, [companyCards, deferredSearch]);

  const handleSetPrimary = async (
    projectCompanyId: string,
    personId: string,
  ) => {
    try {
      await updateMutation.mutateAsync({
        companyId: projectCompanyId,
        data: { primary_contact_id: personId },
      });
      toast.success("Primary contact updated");
      onRefetch();
      reloadContacts();
    } catch (error) {
      const message =
        error instanceof ApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Failed to update primary contact";
      toast.error(message);
    }
  };

  const handleRemoveContact = async (
    contact: CompanyContact,
    companyName: string,
  ) => {
    const name = contactDisplayName(contact) || "this contact";
    const ok = await confirmContact({
      description: `Remove ${name} from ${companyName}? They stay in the directory but are no longer linked to this company.`,
      variant: "destructive",
      confirmLabel: "Remove",
    });
    if (!ok) return;
    try {
      await updateContact(contact.id, { company_id: null });
      toast.success(`${name} removed from ${companyName}`);
      onRefetch();
      reloadContacts();
    } catch (error) {
      const message =
        error instanceof ApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Failed to remove contact";
      toast.error(message);
    }
  };

  const handleInlineContactEdit = React.useCallback(
    async (
      contact: CompanyContact | null,
      field: EditableContactField,
      value: string,
    ) => {
      if (!contact) {
        throw new Error("Add a contact before editing contact fields.");
      }

      const result = await updateContact(contact.id, {
        [field]: value.trim() || null,
      });

      if (result.error) {
        throw new Error(result.error);
      }

      onRefetch();
      reloadContacts();
    },
    [onRefetch, reloadContacts],
  );

  const subcontractorColumns: TableColumn<SubcontractorRow>[] = [
    {
      id: "company",
      label: "Company",
      width: 240,
      render: (item) => (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onCompanyClick(item.companyId)}
          className="h-auto min-w-0 max-w-full justify-start truncate p-0 text-sm font-medium text-foreground hover:bg-transparent hover:text-foreground hover:underline"
        >
          {item.companyName}
        </Button>
      ),
      sortValue: (item) => item.companyName,
      csvValue: (item) => item.companyName,
    },
    {
      id: "type",
      label: "Type",
      width: 120,
      render: (item) => (
        <span className="text-sm text-muted-foreground">
          {item.typeLabel || "—"}
        </span>
      ),
      sortValue: (item) => item.typeLabel,
      csvValue: (item) => item.typeLabel,
    },
    {
      id: "name",
      label: "Name",
      render: (item) => {
        if (!item.contact) {
          return (
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm text-muted-foreground">—</span>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                className="h-6 w-6 text-muted-foreground hover:text-foreground"
                aria-label={`Add contact to ${item.companyName}`}
                onClick={() =>
                  setAddContact({
                    open: true,
                    companyId: item.companyId,
                    companyName: item.companyName,
                  })
                }
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
          );
        }
        const c = item.contact;
        return (
          <div className="flex items-center gap-2">
            <Link
              href={`/directory/contacts/${c.id}`}
              className="text-sm text-muted-foreground hover:text-foreground hover:underline"
            >
              {contactDisplayName(c) || "Unnamed"}
            </Link>
            {item.isPrimary && (
              <span className="shrink-0 text-[11px] text-muted-foreground">
                Primary
              </span>
            )}
          </div>
        );
      },
      sortValue: (item) => contactDisplayName(item.contact),
      csvValue: (item) => contactDisplayName(item.contact),
    },
    {
      id: "title",
      label: "Title",
      editable: true,
      editValue: (item) => item.contact?.job_title ?? "",
      editEmptyLabel: "",
      onEdit: (item, value) =>
        handleInlineContactEdit(item.contact, "job_title", value),
      render: (item) => (
        <span className="text-sm text-muted-foreground">
          {item.contact?.job_title ?? ""}
        </span>
      ),
      sortValue: (item) => item.contact?.job_title ?? "",
      csvValue: (item) => item.contact?.job_title ?? "",
    },
    {
      id: "email",
      label: "Email",
      editable: true,
      editInputType: "email",
      editValue: (item) => item.contact?.email ?? "",
      editEmptyLabel: "",
      onEdit: (item, value) =>
        handleInlineContactEdit(item.contact, "email", value),
      render: (item) =>
        item.contact?.email ? (
          <a
            href={`mailto:${item.contact.email}`}
            className="text-sm text-muted-foreground hover:underline"
          >
            {item.contact.email}
          </a>
        ) : (
          <span className="text-sm text-muted-foreground" />
        ),
      sortValue: (item) => item.contact?.email ?? "",
      csvValue: (item) => item.contact?.email ?? "",
    },
    {
      id: "phone",
      label: "Phone",
      editable: true,
      editInputType: "tel",
      editValue: (item) =>
        item.contact?.phone_business ?? item.contact?.phone_mobile ?? "",
      editEmptyLabel: "",
      onEdit: (item, value) =>
        handleInlineContactEdit(item.contact, "phone_business", value),
      render: (item) => {
        const c = item.contact;
        return (
          <span className="text-sm text-muted-foreground">
            {c?.phone_business || c?.phone_mobile || ""}
          </span>
        );
      },
      sortValue: (item) =>
        item.contact?.phone_business ?? item.contact?.phone_mobile ?? "",
      csvValue: (item) =>
        item.contact?.phone_business ?? item.contact?.phone_mobile ?? "",
    },
  ];

  const renderRowActions = (item: SubcontractorRow) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground"
          aria-label={`Actions for ${item.companyName}`}
        >
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onClick={() =>
            setAddContact({
              open: true,
              companyId: item.companyId,
              companyName: item.companyName,
            })
          }
        >
          <Plus className="mr-2 h-3.5 w-3.5" />
          Add from company directory
        </DropdownMenuItem>
        {item.contact && !item.isPrimary && (
          <DropdownMenuItem
            onClick={() =>
              void handleSetPrimary(item.projectCompanyId, item.contact!.id)
            }
          >
            <Check className="mr-2 h-3.5 w-3.5" />
            Set as primary
          </DropdownMenuItem>
        )}
        {item.contact && (
          <DropdownMenuItem asChild>
            <Link href={`/directory/contacts/${item.contact.id}`}>
              <Pencil className="mr-2 h-3.5 w-3.5" />
              Edit contact
            </Link>
          </DropdownMenuItem>
        )}
        {item.contact && (
          <DropdownMenuItem
            className="text-destructive"
            onClick={() =>
              void handleRemoveContact(item.contact!, item.companyName)
            }
          >
            <UserX className="mr-2 h-3.5 w-3.5" />
            Remove from company
          </DropdownMenuItem>
        )}
        <DropdownMenuItem
          className="text-destructive"
          disabled={removingCompanyId === item.projectCompanyId}
          onClick={() =>
            void handleRemoveCompany(item.projectCompanyId, item.companyName)
          }
        >
          <Trash2 className="mr-2 h-3.5 w-3.5" />
          Remove company
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const groupedColumns: TableColumn<CompanyGroupRow>[] = [
    {
      id: "company",
      label: "Company",
      width: 240,
      render: (item) => {
        const canExpand = item.contacts.length > 1;
        const isExpanded = expandedCompanyIds.has(item.id);
        return (
          <div className="flex min-w-0 items-center gap-1.5">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              disabled={!canExpand}
              onClick={(e) => {
                e.stopPropagation();
                if (canExpand) toggleExpandedCompany(item.id);
              }}
              className={cn(
                "h-5 w-5 shrink-0 text-muted-foreground hover:bg-muted hover:text-foreground disabled:cursor-default disabled:opacity-30",
                !canExpand && "text-muted-foreground/60",
              )}
              aria-expanded={canExpand ? isExpanded : undefined}
              aria-label={
                canExpand
                  ? isExpanded
                    ? `Collapse contacts for ${item.companyName}`
                    : `Expand contacts for ${item.companyName}`
                  : `${item.companyName} has ${item.contacts.length} contact${item.contacts.length === 1 ? "" : "s"}`
              }
            >
              <ChevronRight
                className={cn(
                  "h-3.5 w-3.5 transition-transform",
                  canExpand && isExpanded && "rotate-90",
                )}
              />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onCompanyClick(item.companyId)}
              className="h-auto min-w-0 max-w-full justify-start truncate p-0 text-sm font-medium text-foreground hover:bg-transparent hover:text-foreground hover:underline"
            >
              {item.companyName}
            </Button>
          </div>
        );
      },
      sortValue: (item) => item.companyName,
      csvValue: (item) => item.companyName,
    },
    {
      id: "type",
      label: "Type",
      width: 120,
      render: (item) => (
        <span className="text-sm text-muted-foreground">
          {item.typeLabel || "—"}
        </span>
      ),
      sortValue: (item) => item.typeLabel,
      csvValue: (item) => item.typeLabel,
    },
    {
      id: "name",
      label: "Contacts",
      render: (item) => {
        if (item.contacts.length === 0) {
          return (
            <Button
              variant="link"
              size="sm"
              className="h-auto p-0 text-sm text-primary"
              onClick={() =>
                setAddContact({
                  open: true,
                  companyId: item.companyId,
                  companyName: item.companyName,
                })
              }
            >
              Add person
            </Button>
          );
        }
        if (item.contacts.length === 1) {
          const c = item.contacts[0];
          return (
            <div className="flex items-center gap-2">
              <Link
                href={`/directory/contacts/${c.id}`}
                className="text-sm text-muted-foreground hover:text-foreground hover:underline"
              >
                {contactDisplayName(c) || "Unnamed"}
              </Link>
            </div>
          );
        }
        return (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="text-sm text-muted-foreground">
                {item.contacts.length} contacts
              </span>
            </TooltipTrigger>
            <TooltipContent align="start" className="max-w-64">
              <div className="space-y-1">
                {item.contacts.map((contact) => (
                  <p key={contact.id} className="text-xs text-foreground">
                    {contactDisplayName(contact) || "Unnamed"}
                  </p>
                ))}
              </div>
            </TooltipContent>
          </Tooltip>
        );
      },
      sortValue: (item) => item.contacts.length,
      csvValue: (item) => String(item.contacts.length),
    },
    {
      id: "title",
      label: "Title",
      editable: true,
      editValue: (item) => item.primaryContact?.job_title ?? "",
      editEmptyLabel: "",
      onEdit: (item, value) =>
        handleInlineContactEdit(item.primaryContact, "job_title", value),
      render: (item) => (
        <span className="text-sm text-muted-foreground">
          {item.primaryContact?.job_title ?? ""}
        </span>
      ),
      sortValue: (item) => item.primaryContact?.job_title ?? "",
      csvValue: (item) => item.primaryContact?.job_title ?? "",
    },
    {
      id: "email",
      label: "Email",
      editable: true,
      editInputType: "email",
      editValue: (item) => item.primaryContact?.email ?? "",
      editEmptyLabel: "",
      onEdit: (item, value) =>
        handleInlineContactEdit(item.primaryContact, "email", value),
      render: (item) =>
        item.primaryContact?.email ? (
          <a
            href={`mailto:${item.primaryContact.email}`}
            className="text-sm text-muted-foreground hover:underline"
          >
            {item.primaryContact.email}
          </a>
        ) : (
          <span className="text-sm text-muted-foreground" />
        ),
      sortValue: (item) => item.primaryContact?.email ?? "",
      csvValue: (item) => item.primaryContact?.email ?? "",
    },
    {
      id: "phone",
      label: "Phone",
      editable: true,
      editInputType: "tel",
      editValue: (item) =>
        item.primaryContact?.phone_business ??
        item.primaryContact?.phone_mobile ??
        "",
      editEmptyLabel: "",
      onEdit: (item, value) =>
        handleInlineContactEdit(item.primaryContact, "phone_business", value),
      render: (item) => (
        <span className="text-sm text-muted-foreground">
          {item.primaryContact?.phone_business ||
            item.primaryContact?.phone_mobile ||
            ""}
        </span>
      ),
      sortValue: (item) =>
        item.primaryContact?.phone_business ??
        item.primaryContact?.phone_mobile ??
        "",
      csvValue: (item) =>
        item.primaryContact?.phone_business ??
        item.primaryContact?.phone_mobile ??
        "",
    },
  ];

  const renderGroupedRowActions = (item: CompanyGroupRow) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground"
          aria-label={`Actions for ${item.companyName}`}
        >
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onClick={() =>
            setAddContact({
              open: true,
              companyId: item.companyId,
              companyName: item.companyName,
            })
          }
        >
          <Plus className="mr-2 h-3.5 w-3.5" />
          Add from company directory
        </DropdownMenuItem>
        <DropdownMenuItem
          className="text-destructive"
          disabled={removingCompanyId === item.projectCompanyId}
          onClick={() =>
            void handleRemoveCompany(item.projectCompanyId, item.companyName)
          }
        >
          <Trash2 className="mr-2 h-3.5 w-3.5" />
          Remove company
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const renderGroupedExpandedRow = (
    item: CompanyGroupRow,
    colSpan: number,
  ) => {
    if (item.contacts.length <= 1 || !expandedCompanyIds.has(item.id)) {
      return null;
    }
    return (
      <TableExpandedRow colSpan={colSpan}>
        <div className="px-6 py-3">
          <InlineTable variant="read">
            <InlineTableHeader>
              <InlineTableHeaderRow>
                <InlineTableHeaderCell>Name</InlineTableHeaderCell>
                <InlineTableHeaderCell>Title</InlineTableHeaderCell>
                <InlineTableHeaderCell>Email</InlineTableHeaderCell>
                <InlineTableHeaderCell>Phone</InlineTableHeaderCell>
              </InlineTableHeaderRow>
            </InlineTableHeader>
            <InlineTableBody>
              {item.contacts.map((c) => (
                <InlineTableRow key={c.id}>
                  <InlineTableCell>
                    <Link
                      href={`/directory/contacts/${c.id}`}
                      className="text-foreground hover:underline"
                    >
                      {contactDisplayName(c) || "Unnamed"}
                    </Link>
                    {item.primaryContact?.id === c.id && (
                      <span className="ml-1.5 text-[11px] text-muted-foreground">
                        Primary
                      </span>
                    )}
                  </InlineTableCell>
                  <InlineTableCell className="text-muted-foreground">
                    {c.job_title ?? "—"}
                  </InlineTableCell>
                  <InlineTableCell className="text-muted-foreground">
                    {c.email ?? "—"}
                  </InlineTableCell>
                  <InlineTableCell className="text-muted-foreground">
                    {c.phone_business || c.phone_mobile || "—"}
                  </InlineTableCell>
                </InlineTableRow>
              ))}
            </InlineTableBody>
          </InlineTable>
        </div>
      </TableExpandedRow>
    );
  };

  const addCompanyAction = (
    <Button size="xs" data-keep-text onClick={onAssignClick}>
      Add Company
    </Button>
  );

  return (
    <>
      {isLoading ? (
        <>
          <SectionActionsOnly action={addCompanyAction} />
          <div className="mt-4">
            <SectionSkeleton rows={3} />
          </div>
        </>
      ) : error ? (
        <>
          <SectionActionsOnly action={addCompanyAction} />
          <p className="py-4 text-sm text-destructive">
            Failed to load companies.
          </p>
        </>
      ) : isGrouped ? (
        <DirectoryUnifiedTable<CompanyGroupRow>
          title="Subcontractors"
          action={addCompanyAction}
          items={groupedRows}
          columns={groupedColumns}
          getRowId={(item) => item.id}
          search={search}
          onSearch={setSearch}
          searchPlaceholder="Search companies or contacts..."
          totalItems={companyCards.length}
          rowActions={renderGroupedRowActions}
          renderExpandedRow={renderGroupedExpandedRow}
          leftContent={subcontractorViewSwitch}
          emptyTitle="No subcontractors yet"
          emptyDescription="Add a company to start building the project directory."
          filteredDescription="No companies or contacts match the current search."
          isFiltered={Boolean(search)}
        />
      ) : (
        <DirectoryUnifiedTable<SubcontractorRow>
          title="Subcontractors"
          action={addCompanyAction}
          items={filteredRows}
          columns={subcontractorColumns}
          getRowId={(item) => item.id}
          search={search}
          onSearch={setSearch}
          searchPlaceholder="Search companies or contacts..."
          totalItems={allRows.length}
          rowActions={renderRowActions}
          leftContent={subcontractorViewSwitch}
          emptyTitle="No subcontractors yet"
          emptyDescription="Add a company to start building the project directory."
          filteredDescription="No companies or contacts match the current search."
          isFiltered={Boolean(search)}
        />
      )}

      <AddCompanyContactDialog
        open={addContact.open}
        onOpenChange={(open) => setAddContact((prev) => ({ ...prev, open }))}
        companyId={addContact.companyId}
        companyName={addContact.companyName}
        onAdded={() => {
          onRefetch();
          reloadContacts();
        }}
      />
      {CompanyConfirmDialog}
      {ContactConfirmDialog}
    </>
  );
}

// ─── Main Page ────────────────────────────────────────────────────

export default function ProjectDirectoryPage() {
  const params = useParams()! ?? {};
  const projectId = params.projectId as string;
  const [activeTab, setActiveTab] =
    React.useState<DirectoryPageTab>("subcontractors");

  const [clientName, setClientName] = React.useState<string | null>(null);
  const [ownerCompanyId, setOwnerCompanyId] = React.useState<string | null>(
    null,
  );
  React.useEffect(() => {
    if (!projectId) return;
    const supabase = createClient();
    supabase
      .from("projects")
      .select("company_id, companies(name)")
      .eq("id", parseInt(projectId, 10))
      .single()
      .then(({ data }) => {
        const companyName = (
          data as { companies?: { name?: string } | null } | null
        )?.companies?.name;
        if (companyName) setClientName(companyName);
      });
  }, [projectId]);

  React.useEffect(() => {
    if (!projectId) return;
    const supabase = createClient();
    supabase
      .from("prime_contracts")
      .select("contract_company_id")
      .eq("project_id", parseInt(projectId, 10))
      .not("contract_company_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        setOwnerCompanyId(
          (data as { contract_company_id?: string | null } | null)
            ?.contract_company_id ?? null,
        );
      });
  }, [projectId]);

  const [addCompanyOpen, setAddCompanyOpen] = React.useState(false);
  const [addVendorOpen, setAddVendorOpen] = React.useState(false);
  const [manageRolesOpen, setManageRolesOpen] = React.useState(false);
  const [companySheet, setCompanySheet] = React.useState<{
    open: boolean;
    companyId: string | null;
  }>({ open: false, companyId: null });
  const {
    companies: projectCompanies,
    isLoading: companiesLoading,
    error: companiesError,
    refetch: refetchCompanies,
  } = useProjectCompanies(projectId, {
    status: "all",
    sort: "name",
    per_page: 150,
  });
  const {
    vendors,
    isLoading: vendorsLoading,
    error: vendorsError,
    addVendor,
    removeVendor,
  } = useProjectVendors(projectId);

  const existingVendorIds = vendors
    .map((v) => v.companies?.id)
    .filter(Boolean) as string[];

  React.useEffect(() => {
    if (!projectId) return;
    apiFetch<{ added: number }>(
      `/api/projects/${projectId}/directory/companies/sync`,
      { method: "POST" },
    )
      .then((result: { added: number } | null) => {
        if (result && result.added > 0) refetchCompanies();
      })
      .catch((error: unknown) => {
        reportNonCriticalFailure({
          area: "project-directory",
          operation: "sync-companies-from-contracts",
          error,
          userVisibleFallback:
            "Project companies may be stale until contract company sync succeeds.",
          metadata: { projectId },
        });
      });
  }, [projectId]);

  const directoryTabs = React.useMemo(
    () => [
      {
        label: "Subcontractors",
        href: "#subcontractors",
        isActive: activeTab === "subcontractors",
      },
      {
        label: "Project Team",
        href: "#project-team",
        isActive: activeTab === "project-team",
      },
    ],
    [activeTab],
  );

  return (
    <PageShell
      variant="dashboard"
      title="Project Directory"
      statusBadge={
        clientName ? (
          <span className="text-sm text-muted-foreground">{clientName}</span>
        ) : undefined
      }
      contentClassName="space-y-6"
    >
      <PageTabs
        tabs={directoryTabs}
        variant="inline"
        className="mb-0"
        onTabClick={(href) => {
          if (href === "#project-team") {
            setActiveTab("project-team");
            return;
          }
          setActiveTab("subcontractors");
        }}
      />

      {activeTab === "subcontractors" ? (
        <section>
          <CompaniesSection
            projectId={projectId}
            companies={projectCompanies}
            isLoading={companiesLoading}
            error={companiesError}
            ownerCompanyId={ownerCompanyId}
            onAssignClick={() => setAddCompanyOpen(true)}
            onRefetch={() => {
              void refetchCompanies();
            }}
            onCompanyClick={(companyId) =>
              setCompanySheet({ open: true, companyId })
            }
          />
        </section>
      ) : (
        <section>
          <ProjectTeamSection
            projectId={projectId}
            manageRolesOpen={manageRolesOpen}
            onManageRolesOpenChange={setManageRolesOpen}
          />
        </section>
      )}

      <AssignExistingCompanyDialog
        open={addCompanyOpen}
        onOpenChange={setAddCompanyOpen}
        existingCompanyIds={projectCompanies.map((c) => c.company_id)}
        projectId={projectId}
        onSuccess={() => {
          void refetchCompanies();
        }}
      />
      <AddVendorDialog
        open={addVendorOpen}
        onOpenChange={setAddVendorOpen}
        existingVendorIds={existingVendorIds}
        onAdd={async (vendorId) => {
          await addVendor(vendorId);
          toast.success("Vendor added to project");
        }}
      />
      <CompanyDetailSheet
        companyId={companySheet.companyId}
        open={companySheet.open}
        onOpenChange={(open) => setCompanySheet((prev) => ({ ...prev, open }))}
        projectId={projectId}
      />
    </PageShell>
  );
}
