"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { toast } from "sonner";

const VeltFeedbackComments = dynamic(
  () => import("@/components/velt/VeltFeedbackComments").then((m) => m.VeltFeedbackComments),
  { ssr: false },
);
import { Project } from "@/types/portfolio";
import { buildAcumaticaProjectHref } from "@/lib/acumatica/project-url";
import {
  getDefaultPortfolioFilters,
  getPortfolioScope,
  matchesPortfolioFilters,
  matchesPortfolioScope,
  type PortfolioScope,
} from "./portfolio-filtering";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EditProjectDialog } from "@/components/portfolio/edit-project-dialog";
import {
  Plus,
  Check,
  X,
  MapPin,
  Calendar,
  Building2,
  MoreVertical,
  Clock3,
  Tag,
  Eye,
  Pencil,
  Trash2,
} from "lucide-react";
import { TbBrandOnedrive } from "react-icons/tb";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  UnifiedTablePage,
  useUnifiedTableState,
  type ColumnConfig,
  type FilterConfig,
  type FilterValue,
  type TableColumn,
} from "@/components/tables/unified";
import {
  usePathname,
  useRouter,
  useSearchParams,
} from "next/navigation";
import { useConfirm } from "@/hooks/use-confirm";

const PROJECT_COLUMNS: ColumnConfig[] = [
  { id: "name", label: "Project", alwaysVisible: true },
  { id: "jobNumber", label: "Job Number", defaultVisible: true },
  { id: "client", label: "Client", defaultVisible: true },
  { id: "erp_system", label: "ERP System", defaultVisible: true },
  {
    id: "acumatica_project_id",
    label: "Acumatica Record",
    defaultVisible: true,
  },
  { id: "budget", label: "Budget", defaultVisible: true },
  { id: "startDate", label: "Start Date", defaultVisible: true },
  { id: "state", label: "State", defaultVisible: true },
  { id: "phase", label: "Phase", defaultVisible: false },
  { id: "category", label: "Category", defaultVisible: false },
  { id: "type", label: "Type", defaultVisible: false },
  { id: "onedrive", label: "OneDrive", defaultVisible: true },
  { id: "access", label: "Access", defaultVisible: false },
];

// Map frontend field keys to database column names
const FIELD_TO_DB_COLUMN: Record<string, string> = {
  name: "name",
  client: "client",
  startDate: "start date",
  state: "state",
  phase: "phase",
  category: "category",
  type: "type",
  onedrive: "onedrive",
  access: "access",
};

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "-";

  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  let date: Date;

  if (dateOnlyMatch) {
    const year = Number(dateOnlyMatch[1]);
    const monthIndex = Number(dateOnlyMatch[2]) - 1;
    const day = Number(dateOnlyMatch[3]);
    date = new Date(year, monthIndex, day);
  } else {
    date = new Date(dateStr);
  }

  if (isNaN(date.getTime())) return dateStr;
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatCurrency(value: number | null | undefined): string {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "-";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: value >= 1_000_000 ? "compact" : "standard",
    maximumFractionDigits: value >= 1_000_000 ? 1 : 0,
  }).format(value);
}

function getScheduleContext(startDate: string | null | undefined): {
  label: string;
  tone: "default" | "warning" | "muted";
} {
  if (!startDate) {
    return { label: "No start date", tone: "muted" };
  }

  const parsed = new Date(startDate);
  if (Number.isNaN(parsed.getTime())) {
    return { label: startDate, tone: "muted" };
  }

  const today = new Date();
  const midnightToday = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );
  const midnightStart = new Date(
    parsed.getFullYear(),
    parsed.getMonth(),
    parsed.getDate(),
  );
  const diffDays = Math.round(
    (midnightStart.getTime() - midnightToday.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (diffDays === 0) {
    return { label: "Starts today", tone: "warning" };
  }

  if (diffDays > 0) {
    return {
      label: diffDays === 1 ? "Starts in 1 day" : `Starts in ${diffDays} days`,
      tone: diffDays <= 14 ? "warning" : "default",
    };
  }

  const elapsed = Math.abs(diffDays);
  return {
    label: elapsed === 1 ? "Started 1 day ago" : `Started ${elapsed} days ago`,
    tone: "default",
  };
}

// ── Inline Editable Cell ────────────────────────────────────────────────
function EditableCell({
  value,
  projectId,
  field,
  onSave,
  type = "text",
  displayValue,
}: {
  value: string;
  projectId: string;
  field: string;
  onSave: (projectId: string, field: string, value: string) => Promise<void>;
  type?: "text" | "date";
  displayValue?: string;
}) {
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(value);
  const [saving, setSaving] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  // Sync draft when value changes externally
  React.useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  const handleSave = async () => {
    if (draft === value) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await onSave(projectId, field, draft);
      setEditing(false);
    } catch {
      setDraft(value);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setDraft(value);
    setEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSave();
    if (e.key === "Escape") handleCancel();
  };

  if (editing) {
    return (
      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
        <Input
          ref={inputRef}
          type={type}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleSave}
          className="h-7 min-w-20 text-sm"
          disabled={saving}
        />
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0"
          onClick={(e) => { e.stopPropagation(); handleSave(); }}
          disabled={saving}
        >
          <Check />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0"
          onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); handleCancel(); }}
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
    );
  }

  const displayText = displayValue ?? (value || "-");

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className="cursor-text rounded px-1 py-0.5 transition-colors"
          onClick={(e) => {
            e.stopPropagation();
            setEditing(true);
          }}
        >
          {displayText}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" collisionPadding={8}>
        {displayText}
      </TooltipContent>
    </Tooltip>
  );
}

// ── Project Card View ───────────────────────────────────────────────────
function ProjectCard({
  project,
  onClick,
  onEdit,
}: {
  project: Project;
  onClick: () => void;
  onEdit: () => void;
}) {
  const scheduleContext = getScheduleContext(project.startDate);
  const scheduleToneClass =
    scheduleContext.tone === "warning"
      ? "text-amber-700"
      : scheduleContext.tone === "default"
        ? "text-foreground"
        : "text-muted-foreground";
  const categoryOrType = project.category || project.type || null;
  const locationAndClient = [project.client, project.state]
    .filter((value): value is string => Boolean(value))
    .join(" • ");

  return (
    <div
      className="group cursor-pointer rounded-lg border border-border p-4 transition-colors hover:border-primary/30"
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {/* eslint-disable-next-line design-system/no-raw-heading */}
          <h3 className="line-clamp-2 font-medium text-foreground leading-tight">
            {project.name}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">#{project.jobNumber}</p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
          aria-label={`Project actions for ${project.name}`}
          onClick={(event) => {
            event.stopPropagation();
            onEdit();
          }}
        >
          <MoreVertical />
        </Button>
      </div>

      <div className="mt-3 space-y-1.5 text-sm">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-1.5 text-muted-foreground">
            <Calendar className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{formatDate(project.startDate)}</span>
          </div>
          {project.phase && (
            <Badge variant="outline" className="shrink-0 text-xs">
              {project.phase}
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Clock3 className="h-3.5 w-3.5 shrink-0" />
          <span className={scheduleToneClass}>{scheduleContext.label}</span>
        </div>

        {locationAndClient && (
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Building2 className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{locationAndClient}</span>
          </div>
        )}

        {categoryOrType && (
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Tag className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{categoryOrType}</span>
          </div>
        )}
      </div>

      <div className="mt-3 flex items-center justify-end">
        {(typeof project.estRevenue === "number" || typeof project.estProfit === "number") && (
          <span className="text-xs text-muted-foreground">
            {typeof project.estRevenue === "number"
              ? `Rev ${formatCurrency(project.estRevenue)}`
              : `Profit ${formatCurrency(project.estProfit)}`}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Project List View ───────────────────────────────────────────────────
function ProjectListItem({
  project,
  onClick,
}: {
  project: Project;
  onClick: () => void;
}) {
  return (
    <div
      className="group flex cursor-pointer items-center gap-4 rounded-md border border-transparent px-3 py-2.5 transition-colors"
      onClick={onClick}
    >
      <div className="min-w-0 flex-1">
        <span className="font-medium text-foreground">{project.name}</span>
        <span className="ml-2 text-sm text-muted-foreground">#{project.jobNumber}</span>
      </div>
      <div className="hidden items-center gap-3 text-sm text-muted-foreground sm:flex">
        {project.client && <span>{project.client}</span>}
        {project.state && <span>{project.state}</span>}
        {project.startDate && <span>{formatDate(project.startDate)}</span>}
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        {project.phase && (
          <Badge variant="outline" className="text-xs">{project.phase}</Badge>
        )}
        <Badge
          variant={project.status === "Active" ? "default" : "secondary"}
          className="text-xs"
        >
          {project.status}
        </Badge>
      </div>
    </div>
  );
}

// ── Main Page ───────────────────────────────────────────────────────────

export default function PortfolioPage() {
  const router = useRouter();
  const pathname = usePathname()!;
  const searchParams = useSearchParams()!;
  const { confirm, ConfirmDialog } = useConfirm();
  const [projects, setProjects] = React.useState<Project[]>([]);
  const [isAdmin, setIsAdmin] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [editingProject, setEditingProject] = React.useState<Project | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = React.useState(false);
  const activeScope = getPortfolioScope(searchParams.get("scope"));

  const parseProjectsResponse = React.useCallback(
    async (response: Response) => {
      const contentType = response.headers.get("content-type") || "";

      if (contentType.includes("application/json")) {
        try {
          return await response.json();
        } catch {
          return null;
        }
      }

      const fallbackBody = await response.text();
      console.error('Failed to fetch projects:', fallbackBody);
      return null;
    },
    [],
  );

  const mapProjectRow = React.useCallback((p: Record<string, unknown>): Project => {
    const toStringValue = (value: unknown, fallback = ""): string => {
      if (typeof value === "string") return value;
      if (typeof value === "number") return String(value);
      return fallback;
    };
    const toNullableString = (value: unknown): string | null =>
      typeof value === "string" ? value : null;
    const toNullableNumber = (value: unknown): number | null =>
      typeof value === "number" ? value : null;

    const address = toStringValue(p.address);
    const phase = toStringValue(p.phase);
    const category = toStringValue(p.category);
    const type = toStringValue(p.type, category || "General");
    const onedrive = toStringValue(p.onedrive);
    const access = toStringValue(p.access);

    return {
      id: toStringValue(p.id, "0"),
      name: toStringValue(p.name, "Untitled Project"),
      jobNumber: toStringValue(p["job number"], toStringValue(p.id, "0")),
      client: toStringValue(p.client),
      startDate: toNullableString(p["start date"]),
      state: toStringValue(p.state),
      phase,
      estRevenue: toNullableNumber(p["est revenue"]),
      estProfit: toNullableNumber(p["est profit"]),
      budget: toNullableNumber(p.budget),
      category,
      type,
      onedrive,
      access,
      erpSystem: toNullableString(p.erp_system),
      acumaticaProjectId: toNullableString(p.acumatica_project_id),
      // Legacy fields for backward compatibility
      projectNumber: toStringValue(
        p["job number"],
        toStringValue(p.id, "0"),
      ),
      address,
      city: address ? address.split(",")[0] || "" : "",
      zip: "",
      phone: "",
      status: p.archived ? "Inactive" : "Active",
      stage: phase || "Unknown",
      notes: toStringValue(p.summary),
      isFlagged: false,
    };
  }, []);

  const fetchProjects = React.useCallback(async () => {
    try {
      setLoading(true);
      const baseParams = new URLSearchParams();
      baseParams.append("archived", "false");

      const allProjectRows: Record<string, unknown>[] = [];
      let page = 1;
      let totalPages = 1;

      while (page <= totalPages) {
        const pagedParams = new URLSearchParams(baseParams);
        pagedParams.set("page", String(page));
        pagedParams.set("limit", "100");

        const response = await fetch(`/api/projects?${pagedParams.toString()}`);
        const result = await parseProjectsResponse(response);

        if (!result || !response.ok) {
          setProjects([]);
          return;
        }

        const pageRows = Array.isArray(result.data) ? result.data : [];
        allProjectRows.push(...pageRows);
        setIsAdmin(result.meta?.isAdmin === true);
        const apiTotalPages =
          typeof result.meta?.totalPages === "number"
            ? result.meta.totalPages
            : 1;
        totalPages = Math.max(apiTotalPages, 1);
        page += 1;
      }

      const mappedProjects: Project[] = allProjectRows.map(mapProjectRow);
      setProjects(mappedProjects);
    } catch (error) {
      console.error("Failed to fetch projects:", error);
      // Intentionally swallowed: UI shows empty state on error
    } finally {
      setLoading(false);
    }
  }, [mapProjectRow, parseProjectsResponse]);

  // Fetch projects from Supabase
  React.useEffect(() => {
    void fetchProjects();
  }, [fetchProjects]);

  // ── Inline edit save handler ────────────────────────────────────────
  const handleInlineSave = React.useCallback(
    async (projectId: string, field: string, value: string) => {
      const dbColumn = FIELD_TO_DB_COLUMN[field];
      if (!dbColumn) return;

      const res = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [dbColumn]: value || null }),
      });

      if (!res.ok) throw new Error("Failed to save");

      // Optimistic update local state
      setProjects((prev) =>
        prev.map((p) =>
          p.id === projectId ? { ...p, [field]: value } : p,
        ),
      );
    },
    [],
  );

  // Extract unique phase, category, and client options from projects
  const phaseOptions = React.useMemo(() => {
    const phases = new Set(
      projects.map((p) => p.phase).filter((p): p is string => Boolean(p)),
    );
    return Array.from(phases).sort();
  }, [projects]);

  const categoryOptions = React.useMemo(() => {
    const categories = new Set(
      projects.map((p) => p.category).filter((c): c is string => Boolean(c)),
    );
    return Array.from(categories).sort();
  }, [projects]);

  const clientOptions = React.useMemo(() => {
    const clients = new Set(
      projects.map((p) => p.client).filter((c): c is string => Boolean(c)),
    );
    return Array.from(clients).sort();
  }, [projects]);

  const handleCreateProject = () => {
    router.push("/create-project");
  };

  const projectFilters = React.useMemo<FilterConfig[]>(
    () => [
      {
        id: "client",
        label: "Client",
        type: "select",
        options: clientOptions.map((client) => ({ value: client, label: client })),
      },
      {
        id: "phase",
        label: "Phase",
        type: "select",
        options: phaseOptions.map((phase) => ({ value: phase, label: phase })),
      },
      {
        id: "category",
        label: "Category",
        type: "select",
        options: categoryOptions.map((category) => ({ value: category, label: category })),
      },
    ],
    [categoryOptions, clientOptions, phaseOptions],
  );

  const defaultVisibleColumns = React.useMemo(
    () =>
      PROJECT_COLUMNS
        .filter((column) => column.id !== "access" || isAdmin)
        .filter((column) => column.defaultVisible !== false)
        .map((column) => column.id),
    [isAdmin],
  );

  const tableColumns = React.useMemo(
    () => PROJECT_COLUMNS.filter((column) => column.id !== "access" || isAdmin),
    [isAdmin],
  );

  const tableState = useUnifiedTableState({
    entityKey: "homepage-projects",
    searchParams,
    pathname,
    router,
    defaults: {
      view: "table",
      allowedViews: ["table", "card"],
      page: 1,
      perPage: 25,
      search: "",
      sortBy: "name",
      sortDirection: "asc",
      visibleColumns: defaultVisibleColumns,
      filters: getDefaultPortfolioFilters(searchParams),
    },
  });

  React.useEffect(() => {
    if (tableState.visibleColumns.length === 0) {
      tableState.setVisibleColumns(defaultVisibleColumns);
      return;
    }

    // Keep "access" out of non-admin views even if persisted in local state.
    if (!isAdmin && tableState.visibleColumns.includes("access")) {
      tableState.setVisibleColumns(
        tableState.visibleColumns.filter((column) => column !== "access"),
      );
      return;
    }

    if (isAdmin && !tableState.visibleColumns.includes("access")) {
      tableState.setVisibleColumns([
        ...tableState.visibleColumns,
        "access",
      ]);
    }
  }, [defaultVisibleColumns, isAdmin, tableState]);

  React.useEffect(() => {
    if (typeof window === "undefined") return;

    const migrationKey = "homepage-projects:visibleColumns:add-budget-2026-05-12";
    if (window.localStorage.getItem(migrationKey) === "1") return;

    tableState.setVisibleColumns((previousColumns) => {
      if (previousColumns.includes("budget")) {
        return previousColumns;
      }

      const clientIndex = previousColumns.indexOf("client");
      if (clientIndex === -1) {
        return [...previousColumns, "budget"];
      }

      return [
        ...previousColumns.slice(0, clientIndex + 1),
        "budget",
        ...previousColumns.slice(clientIndex + 1),
      ];
    });

    window.localStorage.setItem(migrationKey, "1");
  }, [tableState]);

  React.useEffect(() => {
    if (typeof window === "undefined") return;

    const migrationKey =
      "homepage-projects:visibleColumns:add-erp-columns-2026-07-22";
    if (window.localStorage.getItem(migrationKey) === "1") return;

    tableState.setVisibleColumns((previousColumns) => {
      const erpColumns = ["erp_system", "acumatica_project_id"].filter(
        (column) => !previousColumns.includes(column),
      );
      if (erpColumns.length === 0) return previousColumns;

      const clientIndex = previousColumns.indexOf("client");
      if (clientIndex === -1) {
        return [...previousColumns, ...erpColumns];
      }

      return [
        ...previousColumns.slice(0, clientIndex + 1),
        ...erpColumns,
        ...previousColumns.slice(clientIndex + 1),
      ];
    });

    window.localStorage.setItem(migrationKey, "1");
  }, [tableState]);

  const activeFilters = tableState.activeFilters;

  const projectTabs = React.useMemo(() => {
    const buildScopeHref = (scope: PortfolioScope) => {
      const params = new URLSearchParams(searchParams.toString());

      params.set("page", "1");
      params.delete("phase");

      if (scope === "all") {
        params.delete("scope");
      } else {
        params.set("scope", scope);
      }

      const query = params.toString();
      return query ? `${pathname}?${query}` : pathname;
    };

    return [
      {
        label: "All",
        href: buildScopeHref("all"),
        isActive: activeScope === "all",
      },
      {
        label: "Clients",
        href: buildScopeHref("client"),
        isActive: activeScope === "client",
      },
      {
        label: "Estimating",
        href: buildScopeHref("estimating"),
        isActive: activeScope === "estimating",
      },
      {
        label: "Internal",
        href: buildScopeHref("internal"),
        isActive: activeScope === "internal",
      },
    ];
  }, [activeScope, pathname, searchParams]);

  const filteredProjects = React.useMemo(() => {
    const normalizedSearch = tableState.debouncedSearch.trim().toLowerCase();

    return projects.filter((project) => {
      if (!matchesPortfolioScope(project, activeScope)) return false;
      if (!matchesPortfolioFilters(project, activeFilters)) return false;

      if (!normalizedSearch) return true;

      return [
        project.name,
        project.jobNumber,
        project.client,
        project.phase,
        project.category,
        project.type,
        project.erpSystem,
        project.acumaticaProjectId,
        project.onedrive,
        project.access,
        project.state,
      ]
        .map((value) => (value ?? "").toLowerCase())
        .some((value) => value.includes(normalizedSearch));
    });
  }, [activeFilters.category, activeFilters.client, activeFilters.phase, activeScope, projects, tableState.debouncedSearch]);

  const handleFilterChange = (nextFilters: Record<string, FilterValue>) => {
    tableState.setActiveFilters(nextFilters);
    tableState.setSearchParams({
      client:
        typeof nextFilters.client === "string" ? nextFilters.client : null,
      phase: typeof nextFilters.phase === "string" ? nextFilters.phase : null,
      category:
        typeof nextFilters.category === "string" ? nextFilters.category : null,
      page: "1",
    });
  };

  const PROJECT_TABLE_COLUMNS: TableColumn<Project>[] = [
    {
      ...PROJECT_COLUMNS[0],
      render: (item) => (
        <span
          className="font-medium text-primary hover:underline cursor-pointer"
          onClick={(e) => {
            e.stopPropagation();
            router.push(`/${item.id}/home`);
          }}
        >
          {item.name}
        </span>
      ),
      sortValue: (item) => item.name,
    },
    {
      ...PROJECT_COLUMNS[1],
      render: (item) => (
        <span className="text-muted-foreground">{item.jobNumber ?? "-"}</span>
      ),
      sortValue: (item) => item.jobNumber ?? "",
    },
    {
      ...PROJECT_COLUMNS[2],
      render: (item) => (
        <span className="text-foreground">{item.client || "-"}</span>
      ),
      sortValue: (item) => item.client ?? "",
    },
    {
      ...PROJECT_COLUMNS[3],
      render: (item) =>
        item.erpSystem ? (
          <span className="text-foreground">{item.erpSystem}</span>
        ) : (
          <span className="text-muted-foreground">Not set</span>
        ),
      csvValue: (item) => item.erpSystem ?? "",
      sortValue: (item) => item.erpSystem ?? "",
    },
    {
      ...PROJECT_COLUMNS[4],
      render: (item) => {
        const acumaticaProjectId = item.acumaticaProjectId?.trim();
        if (!acumaticaProjectId) {
          return <span className="text-muted-foreground">Not linked</span>;
        }

        return (
          <a
            href={buildAcumaticaProjectHref(acumaticaProjectId)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(event) => event.stopPropagation()}
            className="font-medium tabular-nums text-primary hover:underline"
            aria-label={`Open Acumatica project ${acumaticaProjectId}`}
          >
            {acumaticaProjectId}
          </a>
        );
      },
      csvValue: (item) => item.acumaticaProjectId ?? "",
      sortValue: (item) => item.acumaticaProjectId ?? "",
    },
    {
      ...PROJECT_COLUMNS[5],
      render: (item) => (
        <span className="block text-right font-medium tabular-nums">
          {formatCurrency(item.budget)}
        </span>
      ),
      sortValue: (item) => item.budget ?? 0,
    },
    {
      ...PROJECT_COLUMNS[6],
      render: (item) => (
        <EditableCell
          value={item.startDate || ""}
          projectId={item.id}
          field="startDate"
          onSave={handleInlineSave}
          type="date"
          displayValue={formatDate(item.startDate)}
        />
      ),
      sortValue: (item) => item.startDate ?? "",
    },
    {
      ...PROJECT_COLUMNS[7],
      render: (item) => (
        <EditableCell
          value={item.state || ""}
          projectId={item.id}
          field="state"
          onSave={handleInlineSave}
        />
      ),
      sortValue: (item) => item.state ?? "",
    },
    {
      ...PROJECT_COLUMNS[8],
      render: (item) => (
        <EditableCell
          value={item.phase || ""}
          projectId={item.id}
          field="phase"
          onSave={handleInlineSave}
          displayValue={item.phase || "-"}
        />
      ),
      sortValue: (item) => item.phase ?? "",
    },
    {
      ...PROJECT_COLUMNS[9],
      render: (item) => (
        <EditableCell
          value={item.category || ""}
          projectId={item.id}
          field="category"
          onSave={handleInlineSave}
        />
      ),
      sortValue: (item) => item.category ?? "",
    },
    {
      ...PROJECT_COLUMNS[10],
      render: (item) => (
        <EditableCell
          value={item.type || ""}
          projectId={item.id}
          field="type"
          onSave={handleInlineSave}
        />
      ),
      sortValue: (item) => item.type ?? "",
    },
    {
      ...PROJECT_COLUMNS[11],
      render: (item) => {
        const url = item.onedrive;
        if (!url) return <span className="text-muted-foreground">-</span>;
        return (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center justify-center p-1.5 rounded-md text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Open OneDrive folder"
            title="Open OneDrive folder"
          >
            <TbBrandOnedrive className="w-4 h-4" />
          </a>
        );
      },
      sortValue: (item) => item.onedrive ?? "",
    },
    {
      ...PROJECT_COLUMNS[12],
      render: (item) => (
        <EditableCell
          value={item.access || ""}
          projectId={item.id}
          field="access"
          onSave={handleInlineSave}
        />
      ),
      sortValue: (item) => item.access ?? "",
    },
  ];

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      tableState.setSelectedIds(filteredProjects.map((project) => project.id));
      return;
    }
    tableState.setSelectedIds([]);
  };

  const handleSelectRow = (id: string, checked: boolean) => {
    if (checked) {
      tableState.setSelectedIds((previous) => [...previous, id]);
      return;
    }
    tableState.setSelectedIds((previous) =>
      previous.filter((itemId) => itemId !== id),
    );
  };

  const isFiltered =
    Boolean(tableState.searchInput) ||
    Boolean(activeFilters.client) ||
    (Boolean(activeFilters.phase) &&
      String(activeFilters.phase).toLowerCase() !== "current") ||
    Boolean(activeFilters.category);

  const navigateToProject = React.useCallback(
    (project: Project) => router.push(`/${project.id}/home`),
    [router],
  );

  const handleDeleteProject = React.useCallback(
    async (project: Project) => {
      try {
        const res = await fetch(`/api/projects/${project.id}`, { method: "DELETE" });
        if (!res.ok) throw new Error("Failed to delete project");
        setProjects((prev) => prev.filter((p) => p.id !== project.id));
        tableState.setSelectedIds((prev) => prev.filter((id) => id !== project.id));
        toast.success(`Project "${project.name}" deleted`);
      } catch {
        toast.error("Failed to delete project");
      }
    },
    [tableState],
  );

  const handleBulkDelete = React.useCallback(async () => {
    const selectedIds = tableState.selectedIds;
    if (selectedIds.length === 0) {
      toast.info("Select at least one project to delete.");
      return;
    }

    const confirmed = await confirm({
      description: `Delete ${selectedIds.length} selected project(s)? This cannot be undone.`,
      variant: "destructive",
      confirmLabel: "Delete",
    });
    if (!confirmed) return;

    const deleteResults = await Promise.allSettled(
      selectedIds.map(async (projectId) => {
        const response = await fetch(`/api/projects/${projectId}`, { method: "DELETE" });
        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          throw new Error(body.details || body.error || `Failed to delete project ${projectId}`);
        }
      }),
    );

    const failed = deleteResults.filter(
      (r): r is PromiseRejectedResult => r.status === "rejected",
    );
    const successCount = deleteResults.length - failed.length;

    if (successCount > 0) {
      const deletedIds = new Set(
        selectedIds.filter((_, index) => deleteResults[index]?.status === "fulfilled"),
      );
      setProjects((prev) => prev.filter((project) => !deletedIds.has(project.id)));
      toast.success(`${successCount} project(s) deleted.`);
    }

    if (failed.length > 0) {
      const reason = failed[0].reason?.message || "Unknown error";
      toast.error(
        failed.length === 1
          ? reason
          : `Failed to delete ${failed.length} project(s): ${reason}`,
      );
    }

    tableState.setSelectedIds([]);
  }, [tableState]);

  return (
    <>
      <VeltFeedbackComments
        documentId="homepage-projects"
        documentName="Company"
        showSidebar={false}
      />
      <UnifiedTablePage
      header={{
        title: "Company",
        description: (
          <span className="hidden sm:inline">
            All projects across your organization
          </span>
        ),
        mobileActionsInline: true,
        actions: (
          <Button
            size="sm"
            onClick={handleCreateProject}
            aria-label="Create new project"
          >
            <Plus className="h-4 w-4" />
            <span>New Project</span>
          </Button>
        ),
      }}
      tabs={projectTabs}
      layout={{
        toolbarInlineWithHeader: false,
        toolbarWithTabs: true,
      }}
      toolbar={{
        totalItems: projects.length,
        filteredItems: filteredProjects.length,
        selectedCount: tableState.selectedIds.length,
        searchValue: tableState.searchInput,
        onSearchChange: tableState.setSearchInput,
        searchPlaceholder: "Search projects...",
        currentView: tableState.currentView,
        enabledViews: ["table", "card"],
        onViewChange: (view) => {
          tableState.setCurrentView(view);
          tableState.setSearchParams({ view });
        },
        filters: projectFilters,
        activeFilters,
        onFilterChange: handleFilterChange,
        onClearFilters: () =>
          handleFilterChange({
            client: undefined,
            phase: undefined,
            category: undefined,
          }),
        columns: tableColumns,
        visibleColumns: tableState.visibleColumns,
        onColumnVisibilityChange: tableState.setVisibleColumns,
        onBulkDelete: handleBulkDelete,
      }}
      data={{
        items: filteredProjects,
        isLoading: loading,
      }}
      table={{
        columns: PROJECT_TABLE_COLUMNS,
        getRowId: (item) => item.id,
        onRowClick: navigateToProject,
        onDelete: handleDeleteProject,
        rowActions: (item) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => navigateToProject(item)}>
                <Eye className="mr-2 h-4 w-4" />
                View
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  setEditingProject(item);
                  setIsEditDialogOpen(true);
                }}
              >
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive"
                onClick={() => handleDeleteProject(item)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      }}
      views={{
        card: (item) => (
          <ProjectCard
            key={item.id}
            project={item}
            onClick={() => navigateToProject(item)}
            onEdit={() => {
              setEditingProject(item);
              setIsEditDialogOpen(true);
            }}
          />
        ),
        list: (item) => (
          <ProjectListItem
            key={item.id}
            project={item}
            onClick={() => navigateToProject(item)}
          />
        ),
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
      selection={{
        selectedIds: tableState.selectedIds,
        onSelectAll: handleSelectAll,
        onSelectRow: handleSelectRow,
      }}
      emptyState={{
        title: "No projects found",
        description: "No projects are available yet.",
        filteredDescription: "No projects match your current search or filters.",
        isFiltered,
      }}
      />

      {editingProject && (
        <EditProjectDialog
          project={editingProject}
          open={isEditDialogOpen}
          onOpenChange={(open) => {
            setIsEditDialogOpen(open);
            if (!open) {
              setEditingProject(null);
            }
          }}
          onSuccess={() => {
            void fetchProjects();
          }}
        />
      )}
      {ConfirmDialog}
    </>
  );
}
