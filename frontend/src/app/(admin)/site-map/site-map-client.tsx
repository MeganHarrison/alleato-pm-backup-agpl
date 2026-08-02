"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  MoreVertical,
  PanelRightOpen,
  Plus,
  Tag as TagIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  UnifiedTablePage,
  useUnifiedTableState,
  type ColumnConfig,
  type FilterConfig,
  type FilterValue,
  type TableColumn,
} from "@/components/tables/unified";
import { StatusBadge } from "@/components/ds/status-badge";
import { ExpandableSearch } from "@/components/tables/unified/table-toolbar";
import { PageTabs } from "@/components/layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch } from "@/lib/api-client";
import {
  PAGE_ACCESS_LEVEL_LABELS,
  PAGE_ACCESS_LEVELS,
  PAGE_ACCESS_MODULE_LABELS,
  PAGE_ACCESS_MODULES,
  accessLevelRequiresModule,
  inferPageAccessDefaults,
  normalizePageAccessInput,
  type PageAccessLevel,
  type PageAccessPolicy,
  type PageAccessPolicyInput,
} from "@/lib/page-access";
import {
  formatAllowedRoleNames,
  sortPermissionTemplates,
  type PageRoleAccessMode,
  type PageRoleAccessPolicy,
  type PageRoleAccessPolicyInput,
} from "@/lib/page-role-access";
import {
  slugifyTagLabel,
  type PageTag,
  type PageTagAssignment,
  type PageTagsResponse,
} from "@/lib/page-tags";
import type {
  PermissionLevel,
  PermissionModule,
  PermissionTemplate,
} from "@/lib/permissions-shared";
import { appToast as toast } from "@/lib/toast/app-toast";
import { cn } from "@/lib/utils";
import { reportNonCriticalFailure } from "@/lib/report-non-critical-failure";

export type InventoryCategory =
  | "Project Management"
  | "Financials"
  | "Accounting"
  | "Documents"
  | "Team / Directory"
  | "Admin"
  | "AI Intelligence"
  | "RAG"
  | "Emails"
  | "Design"
  | "Testing / QA"
  | "Development"
  | "Procore"
  | "System";

export type InventoryType =
  | "Project Page"
  | "Admin Page"
  | "Report"
  | "AI / Intelligence"
  | "Workflow"
  | "Settings"
  | "Database / Table"
  | "Utility";

export type InventoryLayout =
  | "Form"
  | "Edit"
  | "Detail"
  | "Table"
  | "Dashboard"
  | "Content"
  | "Deprecated"
  | "Other";

export type InventoryStatus =
  | "Active"
  | "Needs Review"
  | "Missing Nav"
  | "Internal Only"
  | "Deprecated"
  | "Broken"
  | "Planned"
  | "Design Issues";

export type InventoryRoute = {
  route: string;
  page: string;
  category: InventoryCategory;
  type: InventoryType;
  layout: InventoryLayout;
  status: InventoryStatus;
  notes: string;
  lastReviewed: string;
  dynamic: boolean;
  kind: string;
  refCount: number;
  file: string;
  refSample: string;
  accessLevel: PageAccessLevel;
  permissionModule: PermissionModule | null;
  accessUpdatedAt: string | null;
  accessIsExplicit: boolean;
  roleAccessMode: PageRoleAccessMode;
  allowedPermissionTemplateIds: string[];
  roleAccessUpdatedAt: string | null;
  roleAccessIsExplicit: boolean;
  /** Slugs of the tags applied to this route (from app_page_tag_assignments). */
  tags: string[];
  _group?: string;
  _groupCount?: number;
};

type InventoryOverlay = Partial<
  Pick<
    InventoryRoute,
    "category" | "type" | "layout" | "status" | "notes" | "lastReviewed"
  >
> & {
  updatedAt?: string;
};

type GroupBy = "none" | "category" | "type" | "layout" | "status";
type SitemapTab =
  | "all"
  | "access-review"
  | "pages"
  | "api"
  | "project-pages"
  | "admin-pages"
  | "table-pages"
  | "form-pages"
  | "detail-pages"
  | "edit-pages"
  | "deprecated-pages"
  | "needs-review";

const OVERLAY_STORAGE_KEY = "sitemap-inventory-overrides";

const CATEGORIES: InventoryCategory[] = [
  "Project Management",
  "Financials",
  "Accounting",
  "Documents",
  "Team / Directory",
  "Admin",
  "AI Intelligence",
  "RAG",
  "Emails",
  "Design",
  "Testing / QA",
  "Development",
  "Procore",
  "System",
];

const TYPES: InventoryType[] = [
  "Project Page",
  "Admin Page",
  "Report",
  "AI / Intelligence",
  "Workflow",
  "Settings",
  "Database / Table",
  "Utility",
];

const LAYOUTS: InventoryLayout[] = [
  "Form",
  "Edit",
  "Detail",
  "Table",
  "Dashboard",
  "Content",
  "Deprecated",
  "Other",
];

const STATUSES: InventoryStatus[] = [
  "Active",
  "Needs Review",
  "Missing Nav",
  "Internal Only",
  "Deprecated",
  "Broken",
  "Planned",
  "Design Issues",
];

const GROUP_BY_LABELS: Record<GroupBy, string> = {
  none: "None",
  category: "Category",
  type: "Type",
  layout: "Layout",
  status: "Status",
};

const TAB_LABELS: Record<SitemapTab, string> = {
  pages: "Pages",
  all: "All",
  "access-review": "Access Review",
  api: "API",
  "project-pages": "Project Pages",
  "admin-pages": "Admin Pages",
  "table-pages": "Table Pages",
  "form-pages": "Form Pages",
  "detail-pages": "Detail Pages",
  "edit-pages": "Edit Pages",
  "deprecated-pages": "Deprecated",
  "needs-review": "Needs Review",
};

const columns: ColumnConfig[] = [
  { id: "page", label: "Page", alwaysVisible: true },
  { id: "route", label: "Route", defaultVisible: true },
  { id: "status", label: "Status", defaultVisible: true },
  { id: "category", label: "Category", defaultVisible: true },
  { id: "type", label: "Type", defaultVisible: true },
  { id: "layout", label: "Layout", defaultVisible: true },
  { id: "tags", label: "Tags", defaultVisible: true },
  { id: "accessLevel", label: "Required Access", defaultVisible: true },
  { id: "permissionModule", label: "Required Module", defaultVisible: true },
  { id: "allowedRoles", label: "Allowed Roles", defaultVisible: true },
  { id: "qualifyingRoles", label: "Roles That Qualify", defaultVisible: true },
  { id: "accessSource", label: "Policy Source", defaultVisible: true },
  { id: "dynamic", label: "Dynamic", defaultVisible: true },
  { id: "notes", label: "Notes", defaultVisible: true },
  { id: "lastReviewed", label: "Last Reviewed", defaultVisible: true },
  { id: "refCount", label: "Refs", defaultVisible: false },
  { id: "actions", label: "Actions", alwaysVisible: true },
];

// Lookup config by id so column blocks stay aligned regardless of array order.
const columnById = Object.fromEntries(
  columns.map((column) => [column.id, column]),
) as Record<string, ColumnConfig>;

const defaultVisibleColumns = columns
  .filter((column) => column.defaultVisible !== false)
  .map((column) => column.id);

function parseTab(value: string | null): SitemapTab {
  if (
    value === "pages" ||
    value === "access-review" ||
    value === "api" ||
    value === "project-pages" ||
    value === "admin-pages" ||
    value === "table-pages" ||
    value === "form-pages" ||
    value === "detail-pages" ||
    value === "edit-pages" ||
    value === "deprecated-pages" ||
    value === "needs-review"
  ) {
    return value;
  }
  return "all";
}

function deriveParent(route: string): string {
  const parts = route.split("/").filter(Boolean);
  if (parts.length <= 1) return "/";
  return `/${parts.slice(0, -1).join("/")}`;
}

function isDynamicRoute(route: string): boolean {
  return route.includes("[");
}

/**
 * Project id injected into `[projectId]` routes so the site-map links resolve to
 * a real project instead of 404-ing on the literal `/[projectId]/...` path.
 * Project 876 = "Exol Morrisville".
 */
const PREVIEW_PROJECT_ID = "876";

/**
 * Replaces the `[projectId]` segment with a concrete project id. Any other
 * dynamic segment (a specific record id like `[commitmentId]`) is left intact —
 * those can't be linked without a real record, so the caller treats them as
 * non-navigable.
 */
function resolveProjectScopedRoute(route: string): string {
  return route.replace(/\[projectId\]/g, PREVIEW_PROJECT_ID);
}

function routeHref(route: string): string | null {
  const resolved = resolveProjectScopedRoute(route);
  // Still has an unfilled record-id segment (e.g. [commitmentId]) — not navigable.
  return isDynamicRoute(resolved) ? null : resolved;
}

function formatDateTime(value: string | undefined): string {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function nowIso(): string {
  return new Date().toISOString();
}

function loadOverlay(): Record<string, InventoryOverlay> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(OVERLAY_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, InventoryOverlay>) : {};
  } catch (error) {
    reportNonCriticalFailure({
      area: "site-map",
      operation: "load-inventory-overrides",
      error,
      userVisibleFallback: "Sitemap inventory edits could not be restored.",
    });
    return {};
  }
}

function saveOverlay(overlay: Record<string, InventoryOverlay>) {
  try {
    localStorage.setItem(OVERLAY_STORAGE_KEY, JSON.stringify(overlay));
  } catch (error) {
    reportNonCriticalFailure({
      area: "site-map",
      operation: "save-inventory-overrides",
      error,
      userVisibleFallback: "Sitemap inventory edit was not saved locally.",
    });
  }
}

function applyOverlay(
  routes: InventoryRoute[],
  overlay: Record<string, InventoryOverlay>,
): InventoryRoute[] {
  return routes.map((route) => ({ ...route, ...overlay[route.route] }));
}

function applyPageAccessPolicies(
  routes: InventoryRoute[],
  policies: PageAccessPolicy[],
): InventoryRoute[] {
  const policyByRoute = new Map(
    policies.map((policy) => [policy.route, policy]),
  );

  return routes.map((route) => {
    const policy = policyByRoute.get(route.route);
    const inferred = inferPageAccessDefaults({
      route: route.route,
      file: route.file,
      category: route.category,
    });

    return {
      ...route,
      accessLevel: policy?.accessLevel ?? inferred.accessLevel,
      permissionModule: policy?.permissionModule ?? inferred.permissionModule,
      accessUpdatedAt: policy?.updatedAt ?? null,
      accessIsExplicit: Boolean(policy),
    };
  });
}

function applyPageRoleAccessPolicies(
  routes: InventoryRoute[],
  policies: PageRoleAccessPolicy[],
): InventoryRoute[] {
  const policyByRoute = new Map(
    policies.map((policy) => [policy.route, policy]),
  );

  return routes.map((route) => {
    const policy = policyByRoute.get(route.route);

    return {
      ...route,
      roleAccessMode: policy?.mode ?? "inherit_requirement",
      allowedPermissionTemplateIds: policy?.allowedPermissionTemplateIds ?? [],
      roleAccessUpdatedAt: policy?.updatedAt ?? null,
      roleAccessIsExplicit: Boolean(policy),
    };
  });
}

async function fetchPageAccessPolicies(): Promise<PageAccessPolicy[]> {
  const { data } = await apiFetch<{ data: PageAccessPolicy[] }>(
    "/api/permissions/page-access",
  );
  return data;
}

async function fetchPageRoleAccessPolicies(): Promise<PageRoleAccessPolicy[]> {
  const { data } = await apiFetch<{ data: PageRoleAccessPolicy[] }>(
    "/api/permissions/page-role-access",
  );
  return data;
}

async function fetchPermissionTemplates(): Promise<PermissionTemplate[]> {
  const { data } = await apiFetch<{ data: PermissionTemplate[] }>(
    "/api/permissions/templates",
  );
  return data;
}

async function fetchPageTags(): Promise<PageTagsResponse> {
  return apiFetch<PageTagsResponse>("/api/admin/page-tags");
}

function applyPageTagAssignments(
  routes: InventoryRoute[],
  assignments: PageTagAssignment[],
): InventoryRoute[] {
  const tagsByRoute = new Map<string, string[]>();
  for (const assignment of assignments) {
    tagsByRoute.set(assignment.route, [
      ...(tagsByRoute.get(assignment.route) ?? []),
      assignment.tagSlug,
    ]);
  }

  return routes.map((route) => ({
    ...route,
    tags: tagsByRoute.get(route.route) ?? [],
  }));
}

function defaultModuleForRoute(route: InventoryRoute): PermissionModule {
  return (
    route.permissionModule ??
    inferPageAccessDefaults(route).permissionModule ??
    "directory"
  );
}

function buildTabHref(
  pathname: string,
  searchParams: URLSearchParams,
  tab: SitemapTab,
): string {
  const nextParams = new URLSearchParams(searchParams.toString());
  if (tab === "all") nextParams.delete("tab");
  else nextParams.set("tab", tab);
  nextParams.set("page", "1");
  const query = nextParams.toString();
  return query ? `${pathname}?${query}` : pathname;
}

function matchesTab(route: InventoryRoute, tab: SitemapTab): boolean {
  const isPageRoute = route.kind === "page" || route.kind === "page.nonprod";
  if (tab === "access-review")
    return isPageRoute && routeNeedsAccessReview(route);
  if (tab === "pages") return isPageRoute;
  if (tab === "api") return route.kind === "api";
  if (tab === "project-pages")
    return (
      isPageRoute &&
      (route.type === "Project Page" || route.route.includes("[projectId]"))
    );
  if (tab === "admin-pages")
    return (
      isPageRoute && (route.type === "Admin Page" || route.category === "Admin")
    );
  if (tab === "table-pages") return isPageRoute && route.layout === "Table";
  if (tab === "form-pages") return isPageRoute && route.layout === "Form";
  if (tab === "detail-pages") return isPageRoute && route.layout === "Detail";
  if (tab === "edit-pages") return isPageRoute && route.layout === "Edit";
  if (tab === "deprecated-pages")
    return isPageRoute && route.layout === "Deprecated";
  if (tab === "needs-review")
    return (
      route.status === "Needs Review" ||
      route.status === "Broken" ||
      route.status === "Missing Nav"
    );
  return true;
}

function tabNoun(tab: SitemapTab): string {
  if (tab === "api") return "API routes";
  if (tab === "access-review") return "pages needing access review";
  if (tab === "all") return "routes";
  return "pages";
}

function routeNeedsAccessReview(route: InventoryRoute): boolean {
  return (
    !route.accessIsExplicit ||
    route.status === "Needs Review" ||
    route.status === "Broken" ||
    route.status === "Missing Nav"
  );
}

const MODULE_ACCESS_TO_LEVEL: Partial<
  Record<PageAccessLevel, PermissionLevel>
> = {
  module_read: "read",
  module_write: "write",
  module_admin: "admin",
};

function permissionLevelMeets(
  actual: PermissionLevel,
  required: PermissionLevel,
): boolean {
  const order: PermissionLevel[] = ["none", "read", "write", "admin"];
  return order.indexOf(actual) >= order.indexOf(required);
}

function getTemplateModuleLevels(
  template: PermissionTemplate,
  module: PermissionModule,
): PermissionLevel[] {
  const levels = template.rules_json[module];
  return Array.isArray(levels) ? levels : [];
}

function templateSatisfiesRoute(
  template: PermissionTemplate,
  route: InventoryRoute,
): boolean {
  const requiredLevel = MODULE_ACCESS_TO_LEVEL[route.accessLevel];
  if (!requiredLevel || !route.permissionModule) return false;

  return getTemplateModuleLevels(template, route.permissionModule).some(
    (level) => permissionLevelMeets(level, requiredLevel),
  );
}

function getQualifyingRoleNames(
  route: InventoryRoute,
  templates: PermissionTemplate[],
): string[] {
  if (route.accessLevel === "public") return ["Everyone"];
  if (route.accessLevel === "signed_in") return ["Signed-in users"];
  if (route.accessLevel === "project_member") return ["Project members"];
  if (route.accessLevel === "app_admin") return ["App admins"];
  if (route.accessLevel === "developer") return ["Developers"];

  return templates
    .filter((template) => templateSatisfiesRoute(template, route))
    .map((template) => template.name)
    .sort((left, right) => left.localeCompare(right));
}

function formatQualifyingRoles(roleNames: string[]): string {
  if (roleNames.length === 0) return "No matching role";
  if (roleNames.length <= 3) return roleNames.join(", ");
  return `${roleNames.slice(0, 3).join(", ")} +${roleNames.length - 3}`;
}

function RoleAccessSelect({
  route,
  permissionTemplates,
  onChange,
}: {
  route: InventoryRoute;
  permissionTemplates: PermissionTemplate[];
  onChange: (route: InventoryRoute, input: PageRoleAccessPolicyInput) => void;
}) {
  const sortedTemplates = sortPermissionTemplates(permissionTemplates);
  const selectedIds = new Set(route.allowedPermissionTemplateIds);
  const policy: PageRoleAccessPolicy = {
    route: route.route,
    mode: route.roleAccessMode,
    allowedPermissionTemplateIds: route.allowedPermissionTemplateIds,
    notes: null,
    updatedAt: route.roleAccessUpdatedAt,
    updatedBy: null,
  };
  const label = formatAllowedRoleNames(policy, permissionTemplates);

  const setInherited = () => {
    onChange(route, {
      route: route.route,
      mode: "inherit_requirement",
      allowedPermissionTemplateIds: [],
    });
  };

  const toggleTemplate = (templateId: string) => {
    const nextIds = new Set(selectedIds);
    if (nextIds.has(templateId)) nextIds.delete(templateId);
    else nextIds.add(templateId);

    onChange(route, {
      route: route.route,
      mode: "explicit_allowlist",
      allowedPermissionTemplateIds: [...nextIds],
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          data-row-interactive="true"
          className={cn(
            "h-8 max-w-60 justify-start px-0 text-left text-xs font-normal",
            route.roleAccessMode === "inherit_requirement"
              ? "text-muted-foreground"
              : "text-foreground",
          )}
          onClick={(event) => event.stopPropagation()}
        >
          <span className="truncate">{label}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="max-h-80 w-72 overflow-y-auto"
        onClick={(event) => event.stopPropagation()}
      >
        <DropdownMenuCheckboxItem
          checked={route.roleAccessMode === "inherit_requirement"}
          onCheckedChange={setInherited}
          onSelect={(event) => event.preventDefault()}
        >
          Inherit required access
        </DropdownMenuCheckboxItem>
        <DropdownMenuSeparator />
        {sortedTemplates.map((template) => (
          <DropdownMenuCheckboxItem
            key={template.id}
            checked={
              route.roleAccessMode === "explicit_allowlist" &&
              selectedIds.has(template.id)
            }
            onCheckedChange={() => toggleTemplate(template.id)}
            onSelect={(event) => event.preventDefault()}
          >
            <span className="truncate">{template.name}</span>
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Tag editor for a single route. Renders the applied tags as badges and opens a
 * dropdown to toggle any catalog tag on/off or create a brand-new tag inline.
 */
function TagCell({
  route,
  catalog,
  isBusy,
  onToggleTag,
  onCreateTag,
}: {
  route: InventoryRoute;
  catalog: PageTag[];
  isBusy: boolean;
  onToggleTag: (route: InventoryRoute, slug: string, next: boolean) => void;
  onCreateTag: (route: InventoryRoute, label: string) => void;
}) {
  const [draft, setDraft] = useState("");
  const applied = new Set(route.tags);
  const appliedTags = catalog.filter((tag) => applied.has(tag.slug));
  const trimmed = draft.trim();
  const draftSlug = slugifyTagLabel(trimmed);
  const draftExists =
    draftSlug.length > 0 && catalog.some((tag) => tag.slug === draftSlug);
  const canCreate = draftSlug.length > 0 && !draftExists;

  const submitCreate = () => {
    if (!canCreate) return;
    onCreateTag(route, trimmed);
    setDraft("");
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          data-row-interactive="true"
          className="h-8 max-w-60 justify-start gap-1 px-0 text-left text-xs font-normal"
          onClick={(event) => event.stopPropagation()}
        >
          {appliedTags.length > 0 ? (
            <span className="flex flex-wrap items-center gap-1">
              {appliedTags.map((tag) => (
                <Badge
                  key={tag.slug}
                  variant="secondary"
                  className="font-normal"
                >
                  {tag.label}
                </Badge>
              ))}
            </span>
          ) : (
            <span className="flex items-center gap-1 text-muted-foreground">
              <TagIcon className="h-3.5 w-3.5" />
              Add tags
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="w-64"
        onClick={(event) => event.stopPropagation()}
      >
        {catalog.length === 0 ? (
          <p className="px-2 py-1.5 text-xs text-muted-foreground">
            No tags yet — create the first one below.
          </p>
        ) : (
          catalog.map((tag) => (
            <DropdownMenuCheckboxItem
              key={tag.slug}
              checked={applied.has(tag.slug)}
              disabled={isBusy}
              onCheckedChange={(checked) =>
                onToggleTag(route, tag.slug, checked === true)
              }
              onSelect={(event) => event.preventDefault()}
            >
              <span className="truncate">{tag.label}</span>
            </DropdownMenuCheckboxItem>
          ))
        )}
        <DropdownMenuSeparator />
        <div
          className="flex items-center gap-1.5 p-1.5"
          onKeyDown={(event) => event.stopPropagation()}
        >
          <Input
            value={draft}
            placeholder="New tag name"
            className="h-8 text-xs"
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                submitCreate();
              }
            }}
          />
          <Button
            type="button"
            size="icon"
            variant="outline"
            className="h-8 w-8 shrink-0"
            disabled={!canCreate || isBusy}
            onClick={submitCreate}
            aria-label="Create tag"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        {draftExists ? (
          <p className="px-2 pb-1.5 text-[11px] text-muted-foreground">
            A tag with that name already exists.
          </p>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function BulkTagAssignmentMenu({
  catalog,
  isBusy,
  onApply,
}: {
  catalog: PageTag[];
  isBusy: boolean;
  onApply: (slug: string) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 text-xs"
          disabled={catalog.length === 0 || isBusy}
        >
          <TagIcon className="h-3.5 w-3.5" />
          Apply tags
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {catalog.map((tag) => (
          <DropdownMenuItem key={tag.slug} onSelect={() => onApply(tag.slug)}>
            {tag.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function getGroupKey(route: InventoryRoute, groupBy: GroupBy): string {
  if (groupBy === "category") return route.category;
  if (groupBy === "type") return route.type;
  if (groupBy === "layout") return route.layout;
  if (groupBy === "status") return route.status;
  return "";
}

function buildGroupedItems(
  routes: InventoryRoute[],
  groupBy: GroupBy,
  collapsedGroups: Set<string>,
): InventoryRoute[] {
  if (groupBy === "none") return routes;

  const grouped = new Map<string, InventoryRoute[]>();
  for (const route of routes) {
    const groupKey = getGroupKey(route, groupBy);
    grouped.set(groupKey, [...(grouped.get(groupKey) ?? []), route]);
  }

  const items: InventoryRoute[] = [];
  for (const [group, groupRoutes] of grouped) {
    items.push({
      route: `__group__${group}`,
      page: group,
      category: "System",
      type: "Utility",
      layout: "Other",
      status: "Needs Review",
      notes: "",
      lastReviewed: "",
      dynamic: false,
      kind: "group",
      refCount: groupRoutes.length,
      file: "",
      refSample: "",
      accessLevel: "signed_in",
      permissionModule: null,
      accessUpdatedAt: null,
      accessIsExplicit: false,
      roleAccessMode: "inherit_requirement",
      allowedPermissionTemplateIds: [],
      roleAccessUpdatedAt: null,
      roleAccessIsExplicit: false,
      tags: [],
      _group: group,
      _groupCount: groupRoutes.length,
    });

    if (!collapsedGroups.has(group)) items.push(...groupRoutes);
  }

  return items;
}

function applyFilters(
  routes: InventoryRoute[],
  search: string,
  filters: Record<string, FilterValue>,
): InventoryRoute[] {
  let filtered = routes;

  if (search) {
    const query = search.toLowerCase();
    filtered = filtered.filter(
      (route) =>
        route.page.toLowerCase().includes(query) ||
        route.route.toLowerCase().includes(query) ||
        route.category.toLowerCase().includes(query) ||
        route.type.toLowerCase().includes(query) ||
        route.layout.toLowerCase().includes(query) ||
        route.status.toLowerCase().includes(query) ||
        route.notes.toLowerCase().includes(query) ||
        route.file.toLowerCase().includes(query),
    );
  }

  if (filters.category)
    filtered = filtered.filter((route) => route.category === filters.category);
  if (filters.type)
    filtered = filtered.filter((route) => route.type === filters.type);
  if (filters.layout)
    filtered = filtered.filter((route) => route.layout === filters.layout);
  if (filters.status)
    filtered = filtered.filter((route) => route.status === filters.status);
  if (filters.accessSource) {
    filtered = filtered.filter((route) =>
      filters.accessSource === "explicit"
        ? route.accessIsExplicit
        : !route.accessIsExplicit,
    );
  }
  if (filters.dynamic)
    filtered = filtered.filter(
      (route) => route.dynamic === (filters.dynamic === "true"),
    );

  return filtered;
}

function sortRoutes(
  routes: InventoryRoute[],
  sortBy: string,
  direction: "asc" | "desc",
): InventoryRoute[] {
  const sorted = [...routes].sort((left, right) => {
    if (sortBy === "parent")
      return deriveParent(left.route).localeCompare(deriveParent(right.route));
    const leftValue = left[sortBy as keyof InventoryRoute];
    const rightValue = right[sortBy as keyof InventoryRoute];
    if (typeof leftValue === "number" && typeof rightValue === "number")
      return leftValue - rightValue;
    return String(leftValue ?? "").localeCompare(String(rightValue ?? ""));
  });
  return direction === "desc" ? sorted.reverse() : sorted;
}

function PanelField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center gap-4">
      <label className="w-28 shrink-0 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </label>
      <div className="flex-1">{children}</div>
    </div>
  );
}

function fieldSelect<TValue extends string>({
  value,
  options,
  onChange,
}: {
  value: TValue;
  options: TValue[];
  onChange: (value: TValue) => void;
}) {
  return (
    <Select value={value} onValueChange={(next) => onChange(next as TValue)}>
      <SelectTrigger
        className="h-8 min-w-36 border-0 bg-transparent px-0 text-xs font-normal text-muted-foreground shadow-none focus:ring-0 focus:ring-offset-0"
        onClick={(event) => event.stopPropagation()}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option} value={option}>
            {option}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function statusSelect({
  value,
  onChange,
}: {
  value: InventoryStatus;
  onChange: (value: InventoryStatus) => void;
}) {
  return (
    <Select
      value={value}
      onValueChange={(next) => onChange(next as InventoryStatus)}
    >
      <SelectTrigger
        className="h-8 min-w-36 border-0 bg-transparent px-0 shadow-none focus:ring-0 focus:ring-offset-0"
        onClick={(event) => event.stopPropagation()}
      >
        <StatusBadge status={value} />
      </SelectTrigger>
      <SelectContent>
        {STATUSES.map((option) => (
          <SelectItem key={option} value={option}>
            <StatusBadge status={option} />
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function pageAccessSelect({
  value,
  onChange,
}: {
  value: PageAccessLevel;
  onChange: (value: PageAccessLevel) => void;
}) {
  return (
    <Select
      value={value}
      onValueChange={(next) => onChange(next as PageAccessLevel)}
    >
      <SelectTrigger
        className="h-8 min-w-36 border-0 bg-transparent px-0 shadow-none focus:ring-0 focus:ring-offset-0"
        onClick={(event) => event.stopPropagation()}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {PAGE_ACCESS_LEVELS.map((option) => (
          <SelectItem key={option} value={option}>
            {PAGE_ACCESS_LEVEL_LABELS[option]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function pageModuleSelect({
  value,
  disabled,
  onChange,
}: {
  value: PermissionModule | null;
  disabled: boolean;
  onChange: (value: PermissionModule) => void;
}) {
  if (disabled) {
    return <span className="text-xs text-muted-foreground">N/A</span>;
  }

  return (
    <Select
      value={value ?? "directory"}
      onValueChange={(next) => onChange(next as PermissionModule)}
    >
      <SelectTrigger
        className="h-8 min-w-36 border-0 bg-transparent px-0 shadow-none focus:ring-0 focus:ring-offset-0"
        onClick={(event) => event.stopPropagation()}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {PAGE_ACCESS_MODULES.map((option) => (
          <SelectItem key={option} value={option}>
            {PAGE_ACCESS_MODULE_LABELS[option]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/**
 * Reusable detail/editor for a single route. Rendered both in the slide-out side
 * panel (table tabs) and as the right pane of the admin-pages split view.
 */
function RouteDetailPanel({
  route,
  permissionTemplates,
  tagCatalog,
  isTagBusy,
  onFieldChange,
  onAccessChange,
  onModuleChange,
  onRoleAccessChange,
  onToggleTag,
  onCreateTag,
  onMarkReviewed,
}: {
  route: InventoryRoute;
  permissionTemplates: PermissionTemplate[];
  tagCatalog: PageTag[];
  isTagBusy: boolean;
  onFieldChange: <TKey extends keyof InventoryOverlay>(
    route: string,
    key: TKey,
    value: InventoryOverlay[TKey],
  ) => void;
  onAccessChange: (route: InventoryRoute, accessLevel: PageAccessLevel) => void;
  onModuleChange: (
    route: InventoryRoute,
    permissionModule: PermissionModule,
  ) => void;
  onRoleAccessChange: (
    route: InventoryRoute,
    input: PageRoleAccessPolicyInput,
  ) => void;
  onToggleTag: (route: InventoryRoute, slug: string, next: boolean) => void;
  onCreateTag: (route: InventoryRoute, label: string) => void;
  onMarkReviewed: (route: string) => void;
}) {
  const qualifyingRoleNames = getQualifyingRoleNames(
    route,
    permissionTemplates,
  );

  return (
    <div className="space-y-6 p-5">
      <div className="space-y-1">
        <p className="text-lg font-semibold text-foreground">{route.page}</p>
        <code className="block break-all text-xs text-muted-foreground">
          {route.route}
        </code>
      </div>

      {/* All editable fields — horizontal detail layout */}
      <div className="space-y-3">
        <PanelField label="Status">
          <Select
            value={route.status}
            onValueChange={(value) =>
              onFieldChange(route.route, "status", value as InventoryStatus)
            }
          >
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUSES.map((option) => (
                <SelectItem key={option} value={option}>
                  <StatusBadge status={option} />
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </PanelField>

        <PanelField label="Category">
          <Select
            value={route.category}
            onValueChange={(value) =>
              onFieldChange(route.route, "category", value as InventoryCategory)
            }
          >
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </PanelField>

        <PanelField label="Type">
          <Select
            value={route.type}
            onValueChange={(value) =>
              onFieldChange(route.route, "type", value as InventoryType)
            }
          >
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TYPES.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </PanelField>

        <PanelField label="Layout">
          <Select
            value={route.layout}
            onValueChange={(value) =>
              onFieldChange(route.route, "layout", value as InventoryLayout)
            }
          >
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LAYOUTS.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </PanelField>

        <PanelField label="Required access">
          <Select
            value={route.accessLevel}
            onValueChange={(value) =>
              onAccessChange(route, value as PageAccessLevel)
            }
          >
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_ACCESS_LEVELS.map((level) => (
                <SelectItem key={level} value={level}>
                  {PAGE_ACCESS_LEVEL_LABELS[level]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </PanelField>

        <PanelField label="Required module">
          {accessLevelRequiresModule(route.accessLevel) ? (
            <Select
              value={route.permissionModule ?? "directory"}
              onValueChange={(value) =>
                onModuleChange(route, value as PermissionModule)
              }
            >
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAGE_ACCESS_MODULES.map((module) => (
                  <SelectItem key={module} value={module}>
                    {PAGE_ACCESS_MODULE_LABELS[module]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <div className="flex h-9 items-center rounded-md border border-input bg-background px-3 text-sm text-muted-foreground">
              N/A
            </div>
          )}
        </PanelField>

        <PanelField label="Allowed roles">
          <RoleAccessSelect
            route={route}
            permissionTemplates={permissionTemplates}
            onChange={onRoleAccessChange}
          />
        </PanelField>

        <PanelField label="Tags">
          <TagCell
            route={route}
            catalog={tagCatalog}
            isBusy={isTagBusy}
            onToggleTag={onToggleTag}
            onCreateTag={onCreateTag}
          />
        </PanelField>
      </div>

      <div className="space-y-2">
        <label
          className="text-sm font-medium text-foreground"
          htmlFor="sitemap-notes"
        >
          Notes
        </label>
        <Textarea
          id="sitemap-notes"
          value={route.notes}
          placeholder="Add review notes, cleanup decisions, or nav gaps."
          className="min-h-40 resize-y"
          onChange={(event) =>
            onFieldChange(route.route, "notes", event.target.value)
          }
        />
      </div>

      {/* Read-only metadata */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-3 border-t pt-4 text-sm">
        <div>
          <p className="text-xs text-muted-foreground">Policy source</p>
          <p className="font-medium">
            {route.accessIsExplicit ? "Explicit" : "Inferred"}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Roles that qualify</p>
          <p className="font-medium">
            {formatQualifyingRoles(qualifyingRoleNames)}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Role policy</p>
          <p className="font-medium">
            {route.roleAccessMode === "explicit_allowlist"
              ? "Explicit allowlist"
              : "Inherited requirement"}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Dynamic</p>
          <p className="font-medium">
            {isDynamicRoute(route.route) ? "Dynamic" : "Static"}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Kind</p>
          <p className="font-medium">{route.kind || "—"}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">References</p>
          <p className="font-medium">{route.refCount}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Last reviewed</p>
          <p className="font-medium">
            {formatDateTime(route.lastReviewed) || "—"}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Access updated</p>
          <p className="font-medium">
            {formatDateTime(route.accessUpdatedAt ?? undefined) || "—"}
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium text-foreground">Source</p>
        <div className="space-y-1 rounded-md bg-muted/30 p-3 text-xs text-muted-foreground">
          <p className="break-all">{route.file}</p>
          {route.refSample ? (
            <p className="break-all">Refs: {route.refSample}</p>
          ) : null}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button
          size="sm"
          className="gap-1.5"
          onClick={() => onMarkReviewed(route.route)}
        >
          <CheckCircle2 className="h-4 w-4" />
          Mark reviewed
        </Button>
        {routeHref(route.route) ? (
          <Button variant="outline" size="sm" asChild className="gap-1.5">
            <Link href={routeHref(route.route) as string}>
              Open route
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        ) : null}
      </div>
    </div>
  );
}

/** Single selectable row in the admin-pages split list. */
function AdminPageRow({
  route,
  isSelected,
  onSelect,
}: {
  route: InventoryRoute;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <Button
      variant="ghost"
      onClick={onSelect}
      className={cn(
        "h-auto w-full justify-start rounded-none px-3 py-2.5 text-left",
        "hover:bg-accent/60 focus-visible:ring-1 focus-visible:ring-primary/30",
        isSelected && "bg-accent hover:bg-accent",
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="mb-0.5 flex items-baseline justify-between gap-2">
          <span className="truncate text-sm font-medium text-foreground">
            {route.page}
          </span>
          {!route.accessIsExplicit && (
            <span className="shrink-0 text-[10px] text-muted-foreground">
              Inferred
            </span>
          )}
        </div>
        <code className="mb-1 block truncate text-xs text-muted-foreground">
          {route.route}
        </code>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="inline-flex items-center rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium leading-none text-muted-foreground">
            {PAGE_ACCESS_LEVEL_LABELS[route.accessLevel]}
          </span>
          {route.permissionModule &&
            accessLevelRequiresModule(route.accessLevel) && (
              <span className="inline-flex items-center rounded bg-info-subtle px-1.5 py-0.5 text-[10px] font-medium leading-none text-info">
                {PAGE_ACCESS_MODULE_LABELS[route.permissionModule]}
              </span>
            )}
        </div>
      </div>
    </Button>
  );
}

/** Left list pane of the admin-pages split view. */
function AdminPagesListPanel({
  routes,
  selectedRouteId,
  onSelect,
  search,
  onSearchChange,
  noun,
  searchPlaceholder,
}: {
  routes: InventoryRoute[];
  selectedRouteId: string | null;
  onSelect: (route: string) => void;
  search: string;
  onSearchChange: (value: string) => void;
  noun: string;
  searchPlaceholder: string;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center justify-between gap-2 px-3 py-2">
        <span className="text-xs font-medium text-muted-foreground">
          {routes.length} {routes.length === 1 ? noun : `${noun}s`}
        </span>
        <ExpandableSearch
          value={search}
          onChange={onSearchChange}
          placeholder={searchPlaceholder}
        />
      </div>
      <div className="flex-1 overflow-y-auto">
        {routes.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 px-6 py-12 text-center">
            <PanelRightOpen className="size-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              {search
                ? "No routes match your search."
                : "No routes need review."}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border/30 pb-4">
            {routes.map((route) => (
              <AdminPageRow
                key={route.route}
                route={route}
                isSelected={route.route === selectedRouteId}
                onSelect={() => onSelect(route.route)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function buildColumns({
  overlay,
  permissionTemplates,
  tagCatalog,
  isTagBusy,
  selectedRouteId,
  collapsedGroups,
  onFieldChange,
  onAccessChange,
  onModuleChange,
  onRoleAccessChange,
  onToggleTag,
  onCreateTag,
  onToggleGroup,
  onOpenDetails,
  onMarkReviewed,
}: {
  overlay: Record<string, InventoryOverlay>;
  permissionTemplates: PermissionTemplate[];
  tagCatalog: PageTag[];
  isTagBusy: boolean;
  selectedRouteId: string | null;
  collapsedGroups: Set<string>;
  onFieldChange: <TKey extends keyof InventoryOverlay>(
    route: string,
    key: TKey,
    value: InventoryOverlay[TKey],
  ) => void;
  onAccessChange: (route: InventoryRoute, accessLevel: PageAccessLevel) => void;
  onModuleChange: (
    route: InventoryRoute,
    permissionModule: PermissionModule,
  ) => void;
  onRoleAccessChange: (
    route: InventoryRoute,
    input: PageRoleAccessPolicyInput,
  ) => void;
  onToggleTag: (route: InventoryRoute, slug: string, next: boolean) => void;
  onCreateTag: (route: InventoryRoute, label: string) => void;
  onToggleGroup: (group: string) => void;
  onOpenDetails: (route: string) => void;
  onMarkReviewed: (route: string) => void;
}): TableColumn<InventoryRoute>[] {
  return [
    {
      ...columnById.page,
      width: 220,
      render: (item) => {
        if (item._group) {
          const collapsed = collapsedGroups.has(item._group);
          return (
            <Button
              variant="ghost"
              className="h-auto w-full justify-start gap-2 p-0 text-left"
              onClick={(event) => {
                event.stopPropagation();
                onToggleGroup(item._group!);
              }}
            >
              {collapsed ? (
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              )}
              <span className="text-sm font-semibold">{item._group}</span>
              <Badge variant="secondary" className="font-normal">
                {item._groupCount}
              </Badge>
            </Button>
          );
        }

        return (
          <span className="block min-w-0 truncate pl-5 text-sm font-medium text-foreground">
            {item.page}
          </span>
        );
      },
      csvValue: (item) => item.page,
      sortValue: (item) => item.page,
      sortable: true,
    },
    {
      ...columnById.route,
      width: 300,
      render: (item) => {
        if (item._group) return null;
        const href = routeHref(item.route);

        if (!href) {
          return (
            <code className="block max-w-80 truncate text-xs text-muted-foreground">
              {item.route}
            </code>
          );
        }

        return (
          <Link
            href={href}
            target="_blank"
            rel="noreferrer"
            className="block max-w-80 truncate text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
            onClick={(event) => event.stopPropagation()}
          >
            <code>{item.route}</code>
          </Link>
        );
      },
      csvValue: (item) => item.route,
      sortValue: (item) => item.route,
      sortable: true,
    },
    {
      ...columnById.status,
      render: (item) =>
        item._group
          ? null
          : statusSelect({
              value: item.status,
              onChange: (value) => onFieldChange(item.route, "status", value),
            }),
      csvValue: (item) => item.status,
      sortValue: (item) => item.status,
      sortable: true,
    },
    {
      ...columnById.category,
      render: (item) =>
        item._group
          ? null
          : fieldSelect({
              value: item.category,
              options: CATEGORIES,
              onChange: (value) => onFieldChange(item.route, "category", value),
            }),
      csvValue: (item) => item.category,
      sortValue: (item) => item.category,
      sortable: true,
    },
    {
      ...columnById.type,
      render: (item) =>
        item._group
          ? null
          : fieldSelect({
              value: item.type,
              options: TYPES,
              onChange: (value) => onFieldChange(item.route, "type", value),
            }),
      csvValue: (item) => item.type,
      sortValue: (item) => item.type,
      sortable: true,
    },
    {
      ...columnById.layout,
      render: (item) =>
        item._group
          ? null
          : fieldSelect({
              value: item.layout,
              options: LAYOUTS,
              onChange: (value) => onFieldChange(item.route, "layout", value),
            }),
      csvValue: (item) => item.layout,
      sortValue: (item) => item.layout,
      sortable: true,
    },
    {
      ...columnById.tags,
      width: 220,
      render: (item) =>
        item._group ? null : (
          <TagCell
            route={item}
            catalog={tagCatalog}
            isBusy={isTagBusy}
            onToggleTag={onToggleTag}
            onCreateTag={onCreateTag}
          />
        ),
      csvValue: (item) =>
        item.tags
          .map(
            (slug) =>
              tagCatalog.find((tag) => tag.slug === slug)?.label ?? slug,
          )
          .join(", "),
      sortValue: (item) => item.tags.length,
      sortable: true,
    },
    {
      ...columnById.accessLevel,
      render: (item) =>
        item._group
          ? null
          : pageAccessSelect({
              value: item.accessLevel,
              onChange: (value) => onAccessChange(item, value),
            }),
      csvValue: (item) => PAGE_ACCESS_LEVEL_LABELS[item.accessLevel],
      sortValue: (item) => item.accessLevel,
      sortable: true,
    },
    {
      ...columnById.permissionModule,
      render: (item) =>
        item._group
          ? null
          : pageModuleSelect({
              value: item.permissionModule,
              disabled: !accessLevelRequiresModule(item.accessLevel),
              onChange: (value) => onModuleChange(item, value),
            }),
      csvValue: (item) =>
        item.permissionModule
          ? PAGE_ACCESS_MODULE_LABELS[item.permissionModule]
          : "",
      sortValue: (item) => item.permissionModule ?? "",
      sortable: true,
    },
    {
      ...columnById.allowedRoles,
      width: 250,
      render: (item) =>
        item._group ? null : (
          <RoleAccessSelect
            route={item}
            permissionTemplates={permissionTemplates}
            onChange={onRoleAccessChange}
          />
        ),
      csvValue: (item) =>
        formatAllowedRoleNames(
          {
            route: item.route,
            mode: item.roleAccessMode,
            allowedPermissionTemplateIds: item.allowedPermissionTemplateIds,
            notes: null,
            updatedAt: item.roleAccessUpdatedAt,
            updatedBy: null,
          },
          permissionTemplates,
        ),
      sortValue: (item) =>
        formatAllowedRoleNames(
          {
            route: item.route,
            mode: item.roleAccessMode,
            allowedPermissionTemplateIds: item.allowedPermissionTemplateIds,
            notes: null,
            updatedAt: item.roleAccessUpdatedAt,
            updatedBy: null,
          },
          permissionTemplates,
        ),
      sortable: true,
    },
    {
      ...columnById.qualifyingRoles,
      width: 240,
      render: (item) =>
        item._group ? null : (
          <span className="block max-w-60 truncate text-xs text-muted-foreground">
            {formatQualifyingRoles(
              getQualifyingRoleNames(item, permissionTemplates),
            )}
          </span>
        ),
      csvValue: (item) =>
        getQualifyingRoleNames(item, permissionTemplates).join(", "),
      sortValue: (item) =>
        formatQualifyingRoles(
          getQualifyingRoleNames(item, permissionTemplates),
        ),
      sortable: true,
    },
    {
      ...columnById.accessSource,
      render: (item) =>
        item._group ? null : (
          <span className="text-xs text-muted-foreground">
            {item.accessIsExplicit ? "Explicit" : "Inferred"}
          </span>
        ),
      csvValue: (item) => (item.accessIsExplicit ? "Explicit" : "Inferred"),
      sortValue: (item) => (item.accessIsExplicit ? "explicit" : "inferred"),
      sortable: true,
    },
    {
      ...columnById.dynamic,
      render: (item) =>
        item._group ? null : (
          <span className="text-xs text-muted-foreground">
            {isDynamicRoute(item.route) ? "Dynamic" : ""}
          </span>
        ),
      csvValue: (item) => (isDynamicRoute(item.route) ? "Dynamic" : ""),
      sortValue: (item) => (isDynamicRoute(item.route) ? "Dynamic" : ""),
      sortable: true,
    },
    {
      ...columnById.notes,
      width: 280,
      render: (item) => {
        if (item._group) return null;
        const note = overlay[item.route]?.notes ?? item.notes;
        if (!note) return null;

        return (
          <Button
            type="button"
            variant="ghost"
            data-row-interactive="true"
            className={cn(
              "h-auto max-w-72 justify-start truncate p-0 text-left text-xs font-normal text-muted-foreground hover:bg-transparent hover:text-foreground",
              selectedRouteId === item.route && "text-foreground",
            )}
            onClick={(event) => {
              event.stopPropagation();
              onOpenDetails(item.route);
            }}
          >
            {note}
          </Button>
        );
      },
      csvValue: (item) => overlay[item.route]?.notes ?? item.notes,
      sortable: false,
    },
    {
      ...columnById.lastReviewed,
      render: (item) =>
        item._group ? null : (
          <span className="text-xs text-muted-foreground">
            {formatDateTime(item.lastReviewed)}
          </span>
        ),
      csvValue: (item) => item.lastReviewed,
      sortValue: (item) => item.lastReviewed,
      sortable: true,
    },
    {
      ...columnById.refCount,
      align: "right",
      render: (item) =>
        item._group ? null : (
          <span className="text-xs text-muted-foreground">{item.refCount}</span>
        ),
      csvValue: (item) => String(item.refCount),
      sortValue: (item) => item.refCount,
      sortable: true,
    },
    {
      ...columnById.actions,
      render: (item) => {
        if (item._group) return null;
        const href = routeHref(item.route);
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={(event) => event.stopPropagation()}
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onOpenDetails(item.route)}>
                <PanelRightOpen className="mr-2 h-4 w-4" />
                Review details
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onMarkReviewed(item.route)}>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Mark reviewed
              </DropdownMenuItem>
              {href ? (
                <DropdownMenuItem asChild>
                  <Link href={href} target="_blank" rel="noreferrer">
                    <ArrowRight className="mr-2 h-4 w-4" />
                    Open route
                  </Link>
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
      csvValue: (item) => item.route,
      sortable: false,
    },
  ];
}

export default function SiteMapClient({
  routes,
}: {
  routes: InventoryRoute[];
}) {
  const queryClient = useQueryClient();
  const rawSearchParams = useSearchParams()!;
  const searchParams = rawSearchParams ?? new URLSearchParams();
  const pathname = usePathname()! ?? "";
  const router = useRouter();
  const currentTab = parseTab(searchParams.get("tab"));

  const [overlay, setOverlay] = useState<Record<string, InventoryOverlay>>({});
  const [groupBy, setGroupBy] = useState<GroupBy>("none");
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(
    new Set(),
  );
  const [activeRouteId, setActiveRouteId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [adminSearch, setAdminSearch] = useState("");

  useEffect(() => {
    setOverlay(loadOverlay());
  }, []);

  useEffect(() => {
    if (!savedAt) return;
    const timeout = window.setTimeout(() => setSavedAt(null), 1200);
    return () => window.clearTimeout(timeout);
  }, [savedAt]);

  const pageAccessQuery = useQuery({
    queryKey: ["page-access-policies"],
    queryFn: fetchPageAccessPolicies,
  });

  const pageRoleAccessQuery = useQuery({
    queryKey: ["page-role-access-policies"],
    queryFn: fetchPageRoleAccessPolicies,
  });

  const permissionTemplatesQuery = useQuery({
    queryKey: ["permission-templates", "site-map-role-coverage"],
    queryFn: fetchPermissionTemplates,
  });

  const pageTagsQuery = useQuery({
    queryKey: ["page-tags"],
    queryFn: fetchPageTags,
  });

  const pageAccessMutation = useMutation({
    mutationFn: async (policies: PageAccessPolicyInput[]) => {
      const normalizedPolicies = policies.map(normalizePageAccessInput);
      const { data } = await apiFetch<{ data: PageAccessPolicy[] }>(
        "/api/permissions/page-access",
        {
          method: "PUT",
          body: JSON.stringify({ policies: normalizedPolicies }),
        },
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["page-access-policies"] });
      toast.success("Page access saved");
    },
    onError: (error) => {
      reportNonCriticalFailure({
        area: "site-map",
        operation: "save-page-access-policy",
        error,
        userVisibleFallback: "Page access was not saved.",
      });
      toast.error("Page access was not saved. Try refreshing the page.");
    },
  });

  const pageRoleAccessMutation = useMutation({
    mutationFn: async (policies: PageRoleAccessPolicyInput[]) => {
      const { data } = await apiFetch<{ data: PageRoleAccessPolicy[] }>(
        "/api/permissions/page-role-access",
        {
          method: "PUT",
          body: JSON.stringify({ policies }),
        },
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["page-role-access-policies"],
      });
      toast.success("Allowed roles saved");
    },
    onError: (error) => {
      reportNonCriticalFailure({
        area: "site-map",
        operation: "save-page-role-access-policy",
        error,
        userVisibleFallback: "Allowed roles were not saved.",
      });
      toast.error("Allowed roles were not saved. Try refreshing the page.");
    },
  });

  const setRouteTagsMutation = useMutation({
    mutationFn: async (input: { route: string; tagSlugs: string[] }) => {
      const { assignments } = await apiFetch<{
        route: string;
        assignments: PageTagAssignment[];
      }>("/api/admin/page-tags", {
        method: "PUT",
        body: JSON.stringify(input),
      });
      return assignments;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["page-tags"] });
    },
    onError: (error) => {
      reportNonCriticalFailure({
        area: "site-map",
        operation: "save-page-tags",
        error,
        userVisibleFallback: "Page tags were not saved.",
      });
      toast.error("Tags were not saved. Try refreshing the page.");
    },
  });

  const bulkAssignTagsMutation = useMutation({
    mutationFn: async (input: { routes: string[]; tagSlugs: string[] }) => {
      await apiFetch("/api/admin/page-tags", {
        method: "POST",
        body: JSON.stringify({ action: "bulk-assign-tags", ...input }),
      });
      return input;
    },
    onSuccess: (input) => {
      queryClient.invalidateQueries({ queryKey: ["page-tags"] });
      toast.success(
        `Tag added to ${input.routes.length} ${input.routes.length === 1 ? "page" : "pages"}`,
      );
    },
    onError: (error) => {
      reportNonCriticalFailure({
        area: "site-map",
        operation: "bulk-assign-page-tags",
        error,
        userVisibleFallback: "Tags were not added to the selected pages.",
      });
      toast.error("Tags were not added. Try refreshing the page.");
    },
  });

  const createTagMutation = useMutation({
    mutationFn: async (label: string) => {
      const { tag } = await apiFetch<{ tag: PageTag }>("/api/admin/page-tags", {
        method: "POST",
        body: JSON.stringify({ action: "create-tag", label }),
      });
      return tag;
    },
    onError: (error) => {
      reportNonCriticalFailure({
        area: "site-map",
        operation: "create-page-tag",
        error,
        userVisibleFallback: "Tag could not be created.",
      });
      toast.error("Tag could not be created.");
    },
  });

  const routesWithAccess = useMemo(
    () => applyPageAccessPolicies(routes, pageAccessQuery.data ?? []),
    [pageAccessQuery.data, routes],
  );

  const routesWithRoleAccess = useMemo(
    () =>
      applyPageRoleAccessPolicies(
        routesWithAccess,
        pageRoleAccessQuery.data ?? [],
      ),
    [pageRoleAccessQuery.data, routesWithAccess],
  );

  const routesWithTags = useMemo(
    () =>
      applyPageTagAssignments(
        routesWithRoleAccess,
        pageTagsQuery.data?.assignments ?? [],
      ),
    [pageTagsQuery.data?.assignments, routesWithRoleAccess],
  );

  const mergedRoutes = useMemo(
    () => applyOverlay(routesWithTags, overlay),
    [routesWithTags, overlay],
  );

  const tableState = useUnifiedTableState({
    entityKey: "sitemap-inventory",
    searchParams: rawSearchParams,
    pathname,
    router,
    defaults: {
      view: "table",
      allowedViews: ["table"],
      page: 1,
      perPage: 50,
      search: "",
      sortBy: "category",
      sortDirection: "asc",
      visibleColumns: defaultVisibleColumns,
      filters: {},
    },
  });

  const persistOverlay = useCallback(
    (
      updater: (
        previous: Record<string, InventoryOverlay>,
      ) => Record<string, InventoryOverlay>,
    ) => {
      setOverlay((previous) => {
        const next = updater(previous);
        saveOverlay(next);
        setSavedAt(nowIso());
        return next;
      });
    },
    [],
  );

  const handleFieldChange = useCallback(
    <TKey extends keyof InventoryOverlay>(
      route: string,
      key: TKey,
      value: InventoryOverlay[TKey],
    ) => {
      persistOverlay((previous) => ({
        ...previous,
        [route]: {
          ...previous[route],
          [key]: value,
          updatedAt: nowIso(),
        },
      }));
    },
    [persistOverlay],
  );

  const handleMarkReviewed = useCallback(
    (route: string) => {
      persistOverlay((previous) => ({
        ...previous,
        [route]: {
          ...previous[route],
          status: "Active",
          lastReviewed: nowIso(),
          updatedAt: nowIso(),
        },
      }));
    },
    [persistOverlay],
  );

  const handleBulkFieldChange = useCallback(
    <TKey extends keyof InventoryOverlay>(
      key: TKey,
      value: InventoryOverlay[TKey],
    ) => {
      if (selectedIds.length === 0) return;
      persistOverlay((previous) => {
        const next = { ...previous };
        for (const route of selectedIds) {
          next[route] = {
            ...next[route],
            [key]: value,
            updatedAt: nowIso(),
          };
        }
        return next;
      });
    },
    [persistOverlay, selectedIds],
  );

  const handleBulkAddTag = useCallback(
    (slug: string) => {
      if (selectedIds.length === 0) return;
      bulkAssignTagsMutation.mutate({
        routes: selectedIds,
        tagSlugs: [slug],
      });
    },
    [bulkAssignTagsMutation, selectedIds],
  );

  const handleBulkReviewed = useCallback(() => {
    if (selectedIds.length === 0) return;
    const reviewedAt = nowIso();
    persistOverlay((previous) => {
      const next = { ...previous };
      for (const route of selectedIds) {
        next[route] = {
          ...next[route],
          status: "Active",
          lastReviewed: reviewedAt,
          updatedAt: reviewedAt,
        };
      }
      return next;
    });
  }, [persistOverlay, selectedIds]);

  const handleAccessChange = useCallback(
    (route: InventoryRoute, accessLevel: PageAccessLevel) => {
      pageAccessMutation.mutate([
        {
          route: route.route,
          accessLevel,
          permissionModule: accessLevelRequiresModule(accessLevel)
            ? defaultModuleForRoute(route)
            : null,
        },
      ]);
    },
    [pageAccessMutation],
  );

  const handleModuleChange = useCallback(
    (route: InventoryRoute, permissionModule: PermissionModule) => {
      pageAccessMutation.mutate([
        {
          route: route.route,
          accessLevel: route.accessLevel,
          permissionModule,
        },
      ]);
    },
    [pageAccessMutation],
  );

  const handleRoleAccessChange = useCallback(
    (route: InventoryRoute, input: PageRoleAccessPolicyInput) => {
      pageRoleAccessMutation.mutate([
        {
          route: route.route,
          mode: input.mode,
          allowedPermissionTemplateIds: input.allowedPermissionTemplateIds,
          notes: input.notes ?? null,
        },
      ]);
    },
    [pageRoleAccessMutation],
  );

  const handleToggleTag = useCallback(
    (route: InventoryRoute, slug: string, next: boolean) => {
      const current = new Set(route.tags);
      if (next) current.add(slug);
      else current.delete(slug);
      setRouteTagsMutation.mutate({
        route: route.route,
        tagSlugs: [...current],
      });
    },
    [setRouteTagsMutation],
  );

  const handleCreateTag = useCallback(
    (route: InventoryRoute, label: string) => {
      // Errors surface loudly through createTagMutation's onError handler.
      createTagMutation.mutate(label, {
        onSuccess: (tag) => {
          // Apply the freshly created tag to the route it was created from.
          setRouteTagsMutation.mutate({
            route: route.route,
            tagSlugs: [...new Set([...route.tags, tag.slug])],
          });
          toast.success(`Created "${tag.label}"`);
        },
      });
    },
    [createTagMutation, setRouteTagsMutation],
  );

  const handleBulkAccessChange = useCallback(
    (accessLevel: PageAccessLevel) => {
      const selectedRoutes = mergedRoutes.filter((route) =>
        selectedIds.includes(route.route),
      );
      if (selectedRoutes.length === 0) return;

      pageAccessMutation.mutate(
        selectedRoutes.map((route) => ({
          route: route.route,
          accessLevel,
          permissionModule: accessLevelRequiresModule(accessLevel)
            ? defaultModuleForRoute(route)
            : null,
        })),
      );
    },
    [mergedRoutes, pageAccessMutation, selectedIds],
  );

  const handleBulkModuleChange = useCallback(
    (permissionModule: PermissionModule) => {
      const selectedRoutes = mergedRoutes.filter((route) =>
        selectedIds.includes(route.route),
      );
      const moduleRoutes = selectedRoutes.filter((route) =>
        accessLevelRequiresModule(route.accessLevel),
      );
      if (moduleRoutes.length === 0) return;

      pageAccessMutation.mutate(
        moduleRoutes.map((route) => ({
          route: route.route,
          accessLevel: route.accessLevel,
          permissionModule,
        })),
      );
    },
    [mergedRoutes, pageAccessMutation, selectedIds],
  );

  const handleToggleGroup = useCallback((group: string) => {
    setCollapsedGroups((previous) => {
      const next = new Set(previous);
      if (next.has(group)) next.delete(group);
      else next.add(group);
      return next;
    });
  }, []);

  const tabbedRoutes = useMemo(
    () => mergedRoutes.filter((route) => matchesTab(route, currentTab)),
    [currentTab, mergedRoutes],
  );

  const filters = useMemo<FilterConfig[]>(
    () => [
      {
        id: "category",
        label: "Category",
        type: "select",
        options: CATEGORIES.map((category) => ({
          value: category,
          label: category,
        })),
      },
      {
        id: "type",
        label: "Type",
        type: "select",
        options: TYPES.map((type) => ({ value: type, label: type })),
      },
      {
        id: "layout",
        label: "Layout",
        type: "select",
        options: LAYOUTS.map((layout) => ({ value: layout, label: layout })),
      },
      {
        id: "status",
        label: "Status",
        type: "select",
        options: STATUSES.map((status) => ({ value: status, label: status })),
      },
      {
        id: "accessSource",
        label: "Policy source",
        type: "select",
        options: [
          { value: "explicit", label: "Explicit" },
          { value: "inferred", label: "Inferred" },
        ],
      },
      {
        id: "dynamic",
        label: "Dynamic",
        type: "select",
        options: [
          { value: "true", label: "Dynamic" },
          { value: "false", label: "Static" },
        ],
      },
    ],
    [],
  );

  const activeFilters = useMemo(() => {
    const next: Record<string, FilterValue> = {};
    if (tableState.activeFilters?.category)
      next.category = tableState.activeFilters.category;
    if (tableState.activeFilters?.type)
      next.type = tableState.activeFilters.type;
    if (tableState.activeFilters?.layout)
      next.layout = tableState.activeFilters.layout;
    if (tableState.activeFilters?.status)
      next.status = tableState.activeFilters.status;
    if (tableState.activeFilters?.accessSource)
      next.accessSource = tableState.activeFilters.accessSource;
    if (tableState.activeFilters?.dynamic)
      next.dynamic = tableState.activeFilters.dynamic;
    return next;
  }, [tableState.activeFilters]);

  useEffect(() => {
    setCollapsedGroups(new Set());
    setSelectedIds([]);
    setActiveRouteId(null);
    setAdminSearch("");
    tableState.setActiveFilters({});
    tableState.setPage(1);
  }, [currentTab, tableState.setActiveFilters, tableState.setPage]);

  const filteredRoutes = useMemo(
    () =>
      applyFilters(
        tabbedRoutes,
        tableState.debouncedSearch ?? "",
        activeFilters,
      ),
    [activeFilters, tabbedRoutes, tableState.debouncedSearch],
  );

  const sortedRoutes = useMemo(
    () =>
      groupBy === "none"
        ? sortRoutes(
            filteredRoutes,
            tableState.sortBy ?? "category",
            tableState.sortDirection,
          )
        : sortRoutes(filteredRoutes, groupBy, "asc"),
    [filteredRoutes, groupBy, tableState.sortBy, tableState.sortDirection],
  );

  const groupedItems = useMemo(
    () => buildGroupedItems(sortedRoutes, groupBy, collapsedGroups),
    [collapsedGroups, groupBy, sortedRoutes],
  );

  const itemsForTable = useMemo(() => {
    if (groupBy !== "none") return groupedItems;
    const start = (tableState.page - 1) * tableState.perPage;
    return sortedRoutes.slice(start, start + tableState.perPage);
  }, [
    groupBy,
    groupedItems,
    sortedRoutes,
    tableState.page,
    tableState.perPage,
  ]);

  const activeRoute = useMemo(
    () => mergedRoutes.find((route) => route.route === activeRouteId) ?? null,
    [activeRouteId, mergedRoutes],
  );

  const tableColumns = useMemo(
    () =>
      buildColumns({
        overlay,
        permissionTemplates: permissionTemplatesQuery.data ?? [],
        tagCatalog: pageTagsQuery.data?.tags ?? [],
        isTagBusy:
          setRouteTagsMutation.isPending || createTagMutation.isPending,
        selectedRouteId: activeRouteId,
        collapsedGroups,
        onFieldChange: handleFieldChange,
        onAccessChange: handleAccessChange,
        onModuleChange: handleModuleChange,
        onRoleAccessChange: handleRoleAccessChange,
        onToggleTag: handleToggleTag,
        onCreateTag: handleCreateTag,
        onToggleGroup: handleToggleGroup,
        onOpenDetails: setActiveRouteId,
        onMarkReviewed: handleMarkReviewed,
      }),
    [
      activeRouteId,
      collapsedGroups,
      createTagMutation.isPending,
      handleAccessChange,
      handleCreateTag,
      handleFieldChange,
      handleMarkReviewed,
      handleModuleChange,
      handleRoleAccessChange,
      handleToggleGroup,
      handleToggleTag,
      overlay,
      pageTagsQuery.data?.tags,
      permissionTemplatesQuery.data,
      setRouteTagsMutation.isPending,
    ],
  );

  // Split review views: alphabetical routes filtered by the panel search.
  const splitReviewRoutes = useMemo(() => {
    if (currentTab !== "admin-pages" && currentTab !== "access-review")
      return [];
    const sorted = [...tabbedRoutes].sort((left, right) =>
      left.page.localeCompare(right.page),
    );
    const query = adminSearch.trim().toLowerCase();
    if (!query) return sorted;
    return sorted.filter(
      (route) =>
        route.page.toLowerCase().includes(query) ||
        route.route.toLowerCase().includes(query) ||
        route.file.toLowerCase().includes(query),
    );
  }, [adminSearch, currentTab, tabbedRoutes]);

  // Keep a selection on split review tabs so the right pane is never empty.
  useEffect(() => {
    if (
      (currentTab !== "admin-pages" && currentTab !== "access-review") ||
      splitReviewRoutes.length === 0
    )
      return;
    if (
      activeRouteId &&
      splitReviewRoutes.some((route) => route.route === activeRouteId)
    )
      return;
    setActiveRouteId(splitReviewRoutes[0].route);
  }, [activeRouteId, currentTab, splitReviewRoutes]);

  const totalPages = Math.max(
    1,
    Math.ceil(sortedRoutes.length / tableState.perPage),
  );
  const isFiltered =
    Boolean(tableState.debouncedSearch) ||
    Object.keys(activeFilters).length > 0;
  const activeTabNoun = tabNoun(currentTab);

  const tabs = useMemo(
    () =>
      (Object.keys(TAB_LABELS) as SitemapTab[]).map((tab) => ({
        label: TAB_LABELS[tab],
        href: buildTabHref(
          pathname,
          new URLSearchParams(searchParams.toString()),
          tab,
        ),
        count: mergedRoutes.filter((route) => matchesTab(route, tab)).length,
        isActive: currentTab === tab,
      })),
    [currentTab, mergedRoutes, pathname, searchParams],
  );

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const groupByOptions = useMemo(
    () =>
      Object.entries(GROUP_BY_LABELS).map(([value, label]) => ({
        value,
        label,
      })),
    [],
  );

  const handleGroupByChange = useCallback((value: string) => {
    setGroupBy(value as GroupBy);
    setCollapsedGroups(new Set());
    setSelectedIds([]);
  }, []);

  const tagCatalog = pageTagsQuery.data?.tags ?? [];

  const bulkToolbar =
    selectedIds.length > 0 ? (
      <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2">
        <span className="text-xs font-medium text-foreground">
          {selectedIds.length} selected
        </span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
              Edit
              <ChevronDown className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-52">
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>Required access</DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                {PAGE_ACCESS_LEVELS.map((level) => (
                  <DropdownMenuItem
                    key={level}
                    onSelect={() => handleBulkAccessChange(level)}
                  >
                    {PAGE_ACCESS_LEVEL_LABELS[level]}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>Required module</DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                {PAGE_ACCESS_MODULES.map((module) => (
                  <DropdownMenuItem
                    key={module}
                    onSelect={() => handleBulkModuleChange(module)}
                  >
                    {PAGE_ACCESS_MODULE_LABELS[module]}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>Category</DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                {CATEGORIES.map((category) => (
                  <DropdownMenuItem
                    key={category}
                    onSelect={() => handleBulkFieldChange("category", category)}
                  >
                    {category}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>Type</DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                {TYPES.map((type) => (
                  <DropdownMenuItem
                    key={type}
                    onSelect={() => handleBulkFieldChange("type", type)}
                  >
                    {type}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>Layout</DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                {LAYOUTS.map((layout) => (
                  <DropdownMenuItem
                    key={layout}
                    onSelect={() => handleBulkFieldChange("layout", layout)}
                  >
                    {layout}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>Status</DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                {STATUSES.map((status) => (
                  <DropdownMenuItem
                    key={status}
                    onSelect={() => handleBulkFieldChange("status", status)}
                  >
                    {status}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          </DropdownMenuContent>
        </DropdownMenu>
        <BulkTagAssignmentMenu
          catalog={tagCatalog}
          isBusy={bulkAssignTagsMutation.isPending}
          onApply={handleBulkAddTag}
        />
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 text-xs"
          onClick={handleBulkReviewed}
        >
          <CheckCircle2 className="h-3.5 w-3.5" />
          Mark reviewed
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 text-xs"
          onClick={() => setSelectedIds([])}
        >
          Clear
        </Button>
      </div>
    ) : null;

  // Focused review tabs render as a master-detail split (left list + right editor).
  if (currentTab === "admin-pages" || currentTab === "access-review") {
    const isAccessReview = currentTab === "access-review";
    const splitTitle = isAccessReview
      ? "Access Review"
      : "Page Access Requirements";
    const splitNoun = isAccessReview ? "access review item" : "admin page";

    return (
      <div className="-mx-4 -mb-12 -mt-2 flex h-[calc(100vh-4rem)] flex-col overflow-hidden sm:-mx-6 lg:-mx-8">
        <div className="shrink-0 border-b border-border/50 px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-2 pt-3">
            <div>
              <p className="text-base font-semibold text-foreground">
                {splitTitle}
              </p>
              <p className="text-xs text-muted-foreground">
                {splitReviewRoutes.length}{" "}
                {splitReviewRoutes.length === 1 ? splitNoun : `${splitNoun}s`}
              </p>
            </div>
            <div className="flex items-center gap-3">
              {savedAt ? (
                <span className="text-xs text-muted-foreground">Saved</span>
              ) : null}
              {pageAccessMutation.isPending ? (
                <span className="text-xs text-muted-foreground">
                  Saving access
                </span>
              ) : null}
            </div>
          </div>
          <PageTabs tabs={tabs} variant="inline" className="!mb-0 !mt-1" />
        </div>

        <div className="flex min-h-0 flex-1 overflow-hidden">
          <div className="flex w-96 shrink-0 flex-col overflow-hidden border-r border-border/50">
            <AdminPagesListPanel
              routes={splitReviewRoutes}
              selectedRouteId={activeRouteId}
              onSelect={setActiveRouteId}
              search={adminSearch}
              onSearchChange={setAdminSearch}
              noun={splitNoun}
              searchPlaceholder={
                isAccessReview
                  ? "Search access review..."
                  : "Search admin pages..."
              }
            />
          </div>
          <div className="min-w-0 flex-1 overflow-y-auto">
            {activeRoute ? (
              <RouteDetailPanel
                route={activeRoute}
                permissionTemplates={permissionTemplatesQuery.data ?? []}
                tagCatalog={pageTagsQuery.data?.tags ?? []}
                isTagBusy={
                  setRouteTagsMutation.isPending || createTagMutation.isPending
                }
                onFieldChange={handleFieldChange}
                onAccessChange={handleAccessChange}
                onModuleChange={handleModuleChange}
                onRoleAccessChange={handleRoleAccessChange}
                onToggleTag={handleToggleTag}
                onCreateTag={handleCreateTag}
                onMarkReviewed={handleMarkReviewed}
              />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground/60">
                <PanelRightOpen className="size-8 text-muted-foreground/40" />
                <p className="text-sm">Select a page to review its access</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <UnifiedTablePage<InventoryRoute>
      header={{
        title: "Page Access Requirements",
        description: `${filteredRoutes.length} of ${tabbedRoutes.length} ${activeTabNoun} shown`,
        actions: (
          <div className="flex items-center gap-2">
            {savedAt ? (
              <span className="text-xs text-muted-foreground">Saved</span>
            ) : null}
            {pageAccessMutation.isPending ? (
              <span className="text-xs text-muted-foreground">
                Saving access
              </span>
            ) : null}
            <Button
              variant="outline"
              size="sm"
              asChild
              className="h-8 gap-1.5 text-xs"
            >
              <Link href="/sitemap.xml" target="_blank" rel="noreferrer">
                XML Sitemap
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        ),
      }}
      tabs={tabs}
      topContent={bulkToolbar}
      layout={{ fullBleedTable: false }}
      toolbar={{
        totalItems: tabbedRoutes.length,
        filteredItems: filteredRoutes.length,
        selectedCount: selectedIds.length,
        searchValue: tableState.searchInput,
        onSearchChange: tableState.setSearchInput,
        searchPlaceholder: "Search route, page, file, notes...",
        currentView: tableState.currentView,
        onViewChange: tableState.setCurrentView,
        filters,
        activeFilters,
        onFilterChange: (nextFilters) => {
          tableState.setActiveFilters(nextFilters);
          tableState.setPage(1);
        },
        onClearFilters: () => tableState.setActiveFilters({}),
        columns,
        visibleColumns: tableState.visibleColumns,
        onColumnVisibilityChange: tableState.setVisibleColumns,
        groupByOptions,
        groupBy,
        onGroupByChange: handleGroupByChange,
      }}
      data={{
        items: itemsForTable,
        isLoading:
          pageAccessQuery.isLoading ||
          pageRoleAccessQuery.isLoading ||
          permissionTemplatesQuery.isLoading,
        isFetching:
          pageAccessQuery.isFetching ||
          pageRoleAccessQuery.isFetching ||
          permissionTemplatesQuery.isFetching,
        error:
          pageAccessQuery.error instanceof Error
            ? pageAccessQuery.error
            : pageRoleAccessQuery.error instanceof Error
              ? pageRoleAccessQuery.error
              : permissionTemplatesQuery.error instanceof Error
                ? permissionTemplatesQuery.error
                : null,
      }}
      table={{
        columns: tableColumns,
        defaultPinnedLeftColumns: ["page"],
        getRowId: (item) => item.route,
        activeRowId: activeRouteId,
        density: "compact",
        onRowClick: (item) => {
          if (item._group) {
            handleToggleGroup(item._group);
            return;
          }
          setActiveRouteId(item.route);
        },
      }}
      sorting={
        groupBy === "none"
          ? {
              sortBy: tableState.sortBy,
              sortDirection: tableState.sortDirection,
              onSortChange: (sortBy, direction) => {
                tableState.setSortBy(sortBy);
                tableState.setSortDirection(direction);
                tableState.setPage(1);
              },
            }
          : undefined
      }
      selection={{
        selectedIds,
        onSelectAll: (checked) => {
          setSelectedIds(
            checked
              ? itemsForTable
                  .filter((item) => !item._group)
                  .map((item) => item.route)
              : [],
          );
        },
        onSelectRow: (id, checked) => {
          if (checked) {
            if (selectedSet.has(id)) return;
            setSelectedIds((previous) => [...previous, id]);
            return;
          }
          setSelectedIds((previous) =>
            previous.filter((route) => route !== id),
          );
        },
      }}
      sidePanel={
        activeRoute
          ? {
              storageKey: "sitemap-inventory-details",
              content: (
                <RouteDetailPanel
                  route={activeRoute}
                  permissionTemplates={permissionTemplatesQuery.data ?? []}
                  tagCatalog={pageTagsQuery.data?.tags ?? []}
                  isTagBusy={
                    setRouteTagsMutation.isPending ||
                    createTagMutation.isPending
                  }
                  onFieldChange={handleFieldChange}
                  onAccessChange={handleAccessChange}
                  onModuleChange={handleModuleChange}
                  onRoleAccessChange={handleRoleAccessChange}
                  onToggleTag={handleToggleTag}
                  onCreateTag={handleCreateTag}
                  onMarkReviewed={handleMarkReviewed}
                />
              ),
              onClose: () => setActiveRouteId(null),
            }
          : undefined
      }
      emptyState={{
        title: "No routes found",
        description: "The generated route inventory did not return any routes.",
        filteredDescription: "Try clearing search or filters.",
        isFiltered,
      }}
      pagination={
        groupBy === "none"
          ? {
              page: tableState.page,
              totalPages,
              perPage: tableState.perPage,
              onPageChange: (page) => {
                tableState.setPage(page);
                tableState.setSearchParams({ page: String(page) });
              },
              onPerPageChange: (perPage) => {
                tableState.setPerPage(Number(perPage));
                tableState.setPage(1);
              },
            }
          : undefined
      }
    />
  );
}
