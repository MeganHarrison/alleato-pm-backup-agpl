"use client";

import * as React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { appToast as toast } from "@/lib/toast/app-toast";
import {
  AlertTriangle,
  Check,
  ChevronsUpDown,
  Eye,
  MoreVertical,
  Pencil,
  Plus,
  Trash2,
  UserPlus,
} from "lucide-react";

import { PermissionTemplateForm } from "./permission-template-form";
import { SectionRuleHeading } from "@/components/layout";
import { ErrorState } from "@/components/ds";
import {
  UnifiedTablePage,
  useUnifiedTableState,
  type TableColumn,
} from "@/components/tables/unified";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MultiSelectField } from "@/components/forms/MultiSelectField";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiFetch } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import type {
  GranularFlag,
  PermissionLevel,
  PermissionModule,
  PermissionTemplate,
} from "@/lib/permissions-shared";
import { UserAvatar } from "./_components/user-access-panel";
import {
  buildUserSlugMaps,
  fetchTemplates,
  fetchUsers,
  formatProjectCount,
  toAccessSummary,
  type TemplateScope,
  type UserAccessSummary,
  type UserLinkDiagnostic,
} from "./_lib/user-access-data";

type PermissionsTab =
  | "app-users"
  | "project-templates"
  | "company-templates";
type AccessScope = "all_projects" | "selected_projects";

type ProjectOption = {
  id: number;
  name: string;
  jobNumber: string | null;
};

type EmployeeOption = {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  jobTitle: string | null;
};

const USER_TYPE_OPTIONS = [
  { value: "employee", label: "Employee" },
  { value: "user", label: "User" },
  { value: "subcontractor", label: "Subcontractor" },
  { value: "contact", label: "Contact" },
];

const HIDE_TEAMS_DEFAULT_MIGRATION_KEY =
  "permissions-users:hide-teams-default:v1";

function splitEditableFullName(value: string) {
  const parts = value.trim().replace(/\s+/g, " ").split(" ").filter(Boolean);
  if (parts.length <= 1) {
    return { first_name: parts[0] ?? "Unnamed", last_name: "" };
  }

  return {
    first_name: parts.slice(0, -1).join(" "),
    last_name: parts.at(-1) ?? "",
  };
}

function formatUserType(value: string | null | undefined) {
  const normalized = value?.trim();
  if (!normalized) return "Unknown";

  return normalized
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function serializeProjectMembershipEdit(
  memberships: UserAccessSummary["memberships"],
) {
  const templatesByProjectId = Object.fromEntries(
    memberships.map((membership) => [
      String(membership.projectId),
      membership.templateId ?? "",
    ]),
  );

  return JSON.stringify({
    projectIds: memberships.map((membership) => String(membership.projectId)),
    templateId:
      memberships.find((membership) => Boolean(membership.templateId))
        ?.templateId ?? "",
    templatesByProjectId,
  });
}

function parseProjectMembershipEdit(value: string) {
  try {
    const parsed = JSON.parse(value) as {
      projectIds?: unknown;
      templateId?: unknown;
      templatesByProjectId?: unknown;
    };
    const fallbackTemplateId =
      typeof parsed.templateId === "string" ? parsed.templateId : "";
    const rawTemplatesByProjectId =
      parsed.templatesByProjectId &&
      typeof parsed.templatesByProjectId === "object"
        ? (parsed.templatesByProjectId as Record<string, unknown>)
        : {};
    const templatesByProjectId = Object.fromEntries(
      Object.entries(rawTemplatesByProjectId).map(([projectId, templateId]) => [
        projectId,
        typeof templateId === "string" ? templateId : fallbackTemplateId,
      ]),
    );

    return {
      projectIds: Array.isArray(parsed.projectIds)
        ? parsed.projectIds.map(String).filter(Boolean)
        : [],
      templateId: fallbackTemplateId,
      templatesByProjectId,
    };
  } catch {
    return { projectIds: [], templateId: "", templatesByProjectId: {} };
  }
}

function ProjectMembershipInlineEditor({
  value,
  projects,
  projectTemplates,
  onCommit,
  onCancel,
}: {
  value: string;
  projects: ProjectOption[];
  projectTemplates: PermissionTemplate[];
  onCommit: (value: string) => void;
  onCancel: () => void;
}) {
  const initialValue = useMemo(
    () => parseProjectMembershipEdit(value),
    [value],
  );
  const availableProjectTemplateIds = useMemo(
    () => new Set(projectTemplates.map((template) => template.id)),
    [projectTemplates],
  );
  const defaultTemplateId = projectTemplates[0]?.id ?? "";
  const resolveProjectTemplateId = (templateId: string | undefined) =>
    templateId && availableProjectTemplateIds.has(templateId)
      ? templateId
      : defaultTemplateId;
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>(
    initialValue.projectIds,
  );
  const [templatesByProjectId, setTemplatesByProjectId] = useState<
    Record<string, string>
  >(
    Object.fromEntries(
      initialValue.projectIds.map((projectId) => [
        projectId,
        resolveProjectTemplateId(
          initialValue.templatesByProjectId[projectId] ||
            initialValue.templateId,
        ),
      ]),
    ),
  );

  const selectedCount = selectedProjectIds.length;
  const selectedProjects = selectedProjectIds
    .map((projectId) =>
      projects.find((project) => String(project.id) === projectId),
    )
    .filter((project): project is ProjectOption => Boolean(project));

  const toggleProject = (projectId: string) => {
    setSelectedProjectIds((current) => {
      if (current.includes(projectId)) {
        return current.filter((id) => id !== projectId);
      }

      setTemplatesByProjectId((currentTemplates) => ({
        ...currentTemplates,
        [projectId]: resolveProjectTemplateId(
          currentTemplates[projectId] ||
            initialValue.templatesByProjectId[projectId] ||
            initialValue.templateId,
        ),
      }));
      return [...current, projectId];
    });
  };

  const setProjectTemplate = (projectId: string, templateId: string) => {
    setTemplatesByProjectId((current) => ({
      ...current,
      [projectId]: templateId,
    }));
  };

  const commit = () => {
    const selectedTemplatesByProjectId = Object.fromEntries(
      selectedProjectIds.map((projectId) => [
        projectId,
        resolveProjectTemplateId(templatesByProjectId[projectId]),
      ]),
    );

    onCommit(
      JSON.stringify({
        projectIds: selectedProjectIds,
        templateId: "",
        templatesByProjectId: selectedTemplatesByProjectId,
      }),
    );
  };

  return (
    <div className="flex min-w-96 items-center gap-2">
      <Popover defaultOpen>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="min-w-48 justify-between"
          >
            {selectedCount === 0
              ? "Select projects"
              : `${selectedCount} ${selectedCount === 1 ? "project" : "projects"}`}
            <ChevronsUpDown className="h-4 w-4 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-screen max-w-2xl p-0">
          <div className="flex divide-x">
            <div className="min-w-0 flex-1">
              <Command>
                <CommandInput placeholder="Search projects..." />
                <CommandEmpty>No projects found.</CommandEmpty>
                <CommandGroup className="max-h-80 overflow-y-auto">
                  {projects.map((project) => {
                    const projectId = String(project.id);
                    const selected = selectedProjectIds.includes(projectId);

                    return (
                      <CommandItem
                        key={project.id}
                        value={`${project.name} ${project.jobNumber ?? ""}`}
                        onSelect={() => toggleProject(projectId)}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            selected ? "opacity-100" : "opacity-0",
                          )}
                        />
                        <span className="truncate">
                          {project.jobNumber
                            ? `${project.jobNumber} - ${project.name}`
                            : project.name}
                        </span>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              </Command>
            </div>

            <div className="max-h-80 min-w-0 flex-1 space-y-2 overflow-y-auto p-3">
              {selectedProjects.length === 0 ? (
                <p className="px-1 py-6 text-sm text-muted-foreground">
                  Select projects to assign templates.
                </p>
              ) : (
                selectedProjects.map((project) => {
                  const projectId = String(project.id);

                  return (
                    <div key={project.id} className="flex items-center gap-2">
                      <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                        {project.jobNumber
                          ? `${project.jobNumber} - ${project.name}`
                          : project.name}
                      </span>
                      <Select
                        value={templatesByProjectId[projectId] ?? ""}
                        onValueChange={(templateId) =>
                          setProjectTemplate(projectId, templateId)
                        }
                      >
                        <SelectTrigger className="h-8 w-48">
                          <SelectValue placeholder="Template" />
                        </SelectTrigger>
                        <SelectContent>
                          {projectTemplates.map((template) => (
                            <SelectItem key={template.id} value={template.id}>
                              {template.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </PopoverContent>
      </Popover>
      <Button
        type="button"
        size="sm"
        onClick={commit}
        disabled={selectedProjectIds.some(
          (projectId) =>
            !availableProjectTemplateIds.has(
              templatesByProjectId[projectId] ?? "",
            ),
        )}
      >
        Save
      </Button>
      <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
        Cancel
      </Button>
    </div>
  );
}

async function fetchProjects(): Promise<ProjectOption[]> {
  const { data } = await apiFetch<{
    data: Array<{
      id: number;
      name: string | null;
      "job number"?: string | null;
    }>;
  }>("/api/projects?limit=500");

  return data.map((project) => ({
    id: project.id,
    name: project.name ?? `Project #${project.id}`,
    jobNumber: project["job number"] ?? null,
  }));
}

async function fetchEmployeeOptions(): Promise<EmployeeOption[]> {
  const { data } = await apiFetch<{
    data: Array<{
      id: string;
      first_name: string | null;
      last_name: string | null;
      email: string | null;
      job_title: string | null;
    }>;
  }>("/api/people?type=user&status=active&per_page=500");

  return data.map((person) => ({
    id: person.id,
    firstName: person.first_name ?? "",
    lastName: person.last_name ?? "",
    email: person.email ?? null,
    jobTitle: person.job_title ?? null,
  }));
}

function getUserSortValue(user: UserAccessSummary, sortBy: string) {
  switch (sortBy) {
    case "role":
      return user.primaryTemplateName;
    case "email":
      return user.email;
    case "personType":
      return user.personType;
    case "teams":
      return (
        user.teamsAccount?.displayName ??
        user.teamsAccount?.platformUserId ??
        ""
      );
    case "projects":
      return user.projectCount;
    case "exceptions":
      return user.granularOverrides.length;
    case "name":
    default:
      return user.fullName;
  }
}

function getTemplateSortValue(template: PermissionTemplate, sortBy: string) {
  switch (sortBy) {
    case "description":
      return template.description ?? "";
    case "scope":
      return template.scope ?? "project";
    case "granular":
      return template.granular_flags?.length ?? 0;
    case "name":
    default:
      return template.name;
  }
}

export default function PermissionsAdminPage() {
  const qc = useQueryClient();
  const router = useRouter();
  const pathname = usePathname()!;
  const searchParams = useSearchParams()!;
  const tabParam = searchParams.get("tab");
  const activeTab: PermissionsTab =
    tabParam === "company-templates"
      ? "company-templates"
      : tabParam === "project-templates"
        ? "project-templates"
        : "app-users";
  const tableState = useUnifiedTableState({
    entityKey: "permissions-users",
    searchParams,
    pathname,
    router,
    defaults: {
      view: "table",
      allowedViews: ["table", "list"],
      page: 1,
      perPage: 25,
      search: "",
      sortBy: "name",
      sortDirection: "asc",
      visibleColumns: [
        "name",
        "email",
        "personType",
        "role",
        "projects",
        "exceptions",
      ],
      filters: {},
    },
  });
  const [showInvite, setShowInvite] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [createScope, setCreateScope] = useState<TemplateScope>("project");
  const [editTarget, setEditTarget] = useState<PermissionTemplate | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PermissionTemplate | null>(
    null,
  );
  const [showBulkDeleteTemplates, setShowBulkDeleteTemplates] = useState(false);
  const [showBulkDeleteUsers, setShowBulkDeleteUsers] = useState(false);
  const [userDeleteTarget, setUserDeleteTarget] =
    useState<UserAccessSummary | null>(null);

  useEffect(() => {
    if (tabParam === "project-access") {
      router.replace("/user-management");
    }
  }, [router, tabParam]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.localStorage.getItem(HIDE_TEAMS_DEFAULT_MIGRATION_KEY)) return;

    if (tableState.visibleColumns.includes("teams")) {
      tableState.setVisibleColumns(
        tableState.visibleColumns.filter((columnId) => columnId !== "teams"),
      );
    }

    window.localStorage.setItem(HIDE_TEAMS_DEFAULT_MIGRATION_KEY, "true");
  }, [tableState]);

  const appUsersQuery = useQuery({
    queryKey: ["permission-users", "app"],
    queryFn: () => fetchUsers("app"),
  });
  const projectAccessUsersQuery = useQuery({
    queryKey: ["permission-users", "project"],
    queryFn: () => fetchUsers("project"),
  });
  const lastReconcileKeyRef = useRef<string | null>(null);

  const companyTemplatesQuery = useQuery({
    queryKey: ["permission-templates", "company"],
    queryFn: () => fetchTemplates("company"),
  });

  const projectTemplatesQuery = useQuery({
    queryKey: ["permission-templates", "project"],
    queryFn: () => fetchTemplates("project"),
  });

  const projectsQuery = useQuery({
    queryKey: ["permissions-project-options"],
    queryFn: fetchProjects,
  });
  const employeeOptionsQuery = useQuery({
    queryKey: ["permissions-employee-options"],
    queryFn: fetchEmployeeOptions,
  });
  const projectTemplates = projectTemplatesQuery.data ?? [];
  const companyTemplates = companyTemplatesQuery.data ?? [];

  // The "project-access" tab was retired (see redirect effect above) — the
  // users table now always shows app users.
  const activeUsersQuery = appUsersQuery;
  const linkDiagnostics =
    activeUsersQuery.data?.diagnostics?.missingAuthLinks ?? [];
  const users = useMemo(
    () => (activeUsersQuery.data?.data ?? []).map(toAccessSummary),
    [activeUsersQuery.data?.data],
  );
  // Build the slug map from the full combined universe (app + project users)
  // rather than the current tab's filtered subset. The detail page resolves
  // slugs against all users, so both sides must agree on who is "john-smith"
  // vs "john-smith-2" regardless of which tab the link came from.
  const allUsersForSlugs = useMemo(() => {
    const seen = new Set<string>();
    return [
      ...(appUsersQuery.data?.data ?? []),
      ...(projectAccessUsersQuery.data?.data ?? []),
    ]
      .filter((u) => {
        if (seen.has(u.personId)) return false;
        seen.add(u.personId);
        return true;
      })
      .map(toAccessSummary);
  }, [appUsersQuery.data?.data, projectAccessUsersQuery.data?.data]);
  const { slugByPersonId } = useMemo(
    () => buildUserSlugMaps(allUsersForSlugs),
    [allUsersForSlugs],
  );
  const userHref = useCallback(
    (user: UserAccessSummary) =>
      `/user-management/users/${slugByPersonId.get(user.personId) ?? user.personId}`,
    [slugByPersonId],
  );
  const appUserCount = appUsersQuery.data?.data.length ?? 0;
  // Descriptions below always use the "app users" copy — the "project-access"
  // tab was retired (see redirect effect above).
  const usersDescription =
    "Internal app users who administer the system or have company-wide access across projects.";
  const usersSearchPlaceholder = "Search app users...";
  const usersEmptyTitle = "No app users";
  const usersEmptyDescription =
    "Invite an app user to assign company-wide access or admin responsibility.";

  const usersFilteredDescription = "No app users match your search.";

  const usersAddLabel = "Grant App Access";
  const usersTotalCount = appUserCount;
  const canManageUserRows = activeTab === "app-users";
  const accessDialogMode: "app" | "project" = "app";

  const usersTopContent = null;

  const filteredUsers = useMemo(() => {
    const search = tableState.debouncedSearch.trim().toLowerCase();

    if (!search) return users;

    return users.filter((user) => {
      const projectNames = user.memberships
        .map((membership) => membership.projectName ?? "")
        .join(" ");
      return [
        user.fullName,
        user.email,
        user.personType,
        user.teamsAccount?.displayName,
        user.teamsAccount?.platformUserId,
        user.primaryTemplateName,
        projectNames,
      ]
        .join(" ")
        .toLowerCase()
        .includes(search);
    });
  }, [tableState.debouncedSearch, users]);

  const sortedUsers = useMemo(() => {
    const direction = tableState.sortDirection === "desc" ? -1 : 1;
    return [...filteredUsers].sort((left, right) => {
      const sortBy = tableState.sortBy ?? "name";
      const leftValue = getUserSortValue(left, sortBy);
      const rightValue = getUserSortValue(right, sortBy);
      if (typeof leftValue === "number" && typeof rightValue === "number") {
        return (leftValue - rightValue) * direction;
      }
      return String(leftValue).localeCompare(String(rightValue)) * direction;
    });
  }, [filteredUsers, tableState.sortBy, tableState.sortDirection]);

  const totalPages = Math.max(
    1,
    Math.ceil(sortedUsers.length / tableState.perPage),
  );
  const pagedUsers = useMemo(() => {
    const start = (tableState.page - 1) * tableState.perPage;
    return sortedUsers.slice(start, start + tableState.perPage);
  }, [sortedUsers, tableState.page, tableState.perPage]);

  // Export every app user matching the current search/sort — NOT just the
  // visible page. The page pre-paginates `pagedUsers`, so the table's built-in
  // exporter would silently emit only the current 25 rows; this exports the
  // full `sortedUsers` set instead.
  const handleExportUsers = useCallback(() => {
    const escapeCsv = (value: string) => `"${value.replace(/"/g, '""')}"`;
    const teamsLabel = (user: UserAccessSummary) =>
      user.teamsAccount?.displayName ?? user.teamsAccount?.platformUserId ?? "";
    const columns: Array<[string, (user: UserAccessSummary) => string]> = [
      ["Name", (user) => user.fullName],
      ["Email", (user) => user.email],
      ["User Type", (user) => formatUserType(user.personType)],
      ["Permission Template", (user) => user.primaryTemplateName],
      ["Admin", (user) => (user.isAdmin ? "Yes" : "No")],
      ["Teams Account", teamsLabel],
      [
        "Projects",
        (user) =>
          user.isAdmin ? "All projects" : formatProjectCount(user.projectCount),
      ],
      ["Active Exceptions", (user) => String(user.granularOverrides.length)],
    ];

    const headerRow = columns.map(([label]) => escapeCsv(label)).join(",");
    const dataRows = sortedUsers.map((user) =>
      columns.map(([, value]) => escapeCsv(value(user) ?? "")).join(","),
    );
    const csv = [headerRow, ...dataRows].join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `app-users-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }, [sortedUsers]);

  const updateUserMutation = useMutation({
    mutationFn: async ({
      personId,
      updates,
    }: {
      personId: string;
      updates: {
        first_name?: string;
        last_name?: string;
        email?: string;
        person_type?: string;
      };
    }) => {
      await apiFetch(`/api/permissions/users/${personId}`, {
        method: "PATCH",
        body: JSON.stringify(updates),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["permission-users"] });
    },
  });

  const tableCompanyTemplateMutation = useMutation({
    mutationFn: async ({
      personId,
      templateId,
    }: {
      personId: string;
      templateId: string | null;
    }) => {
      if (templateId) {
        await apiFetch(`/api/permissions/users/${personId}/company-template`, {
          method: "PUT",
          body: JSON.stringify({ template_id: templateId }),
        });
        return;
      }

      await apiFetch(`/api/permissions/users/${personId}/company-template`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["permission-users"] });
    },
  });

  const tableProjectTemplateMutation = useMutation({
    mutationFn: async ({
      user,
      templateId,
    }: {
      user: UserAccessSummary;
      templateId: string;
    }) => {
      const projectIds = user.memberships.map(
        (membership) => membership.projectId,
      );
      if (projectIds.length === 0) {
        throw new Error(
          "This user does not have project memberships to update.",
        );
      }

      await Promise.all(
        projectIds.map((projectId) =>
          apiFetch(`/api/projects/${projectId}/permissions/assign`, {
            method: "POST",
            body: JSON.stringify({
              person_id: user.personId,
              template_id: templateId,
            }),
          }),
        ),
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["permission-users"] });
    },
  });

  const tableProjectMembershipMutation = useMutation({
    mutationFn: async ({
      user,
      value,
    }: {
      user: UserAccessSummary;
      value: string;
    }) => {
      const { projectIds, templatesByProjectId } =
        parseProjectMembershipEdit(value);
      const nextProjectIds = Array.from(new Set(projectIds));
      const currentProjectIds = new Set(
        user.memberships.map((membership) => String(membership.projectId)),
      );
      const removedProjectIds = Array.from(currentProjectIds).filter(
        (projectId) => !nextProjectIds.includes(projectId),
      );
      const validProjectTemplateIds = new Set(
        projectTemplates.map((template) => template.id),
      );

      const missingTemplateProjectId = nextProjectIds.find(
        (projectId) =>
          !templatesByProjectId[projectId] ||
          !validProjectTemplateIds.has(templatesByProjectId[projectId]),
      );

      if (missingTemplateProjectId) {
        throw new Error(
          "Select a project permission template for every selected project.",
        );
      }

      await Promise.all([
        ...nextProjectIds.map((projectId) =>
          apiFetch(`/api/permissions/users/${user.personId}/project-access`, {
            method: "POST",
            body: JSON.stringify({
              project_id: Number(projectId),
              template_id: templatesByProjectId[projectId],
            }),
          }),
        ),
        ...removedProjectIds.map((projectId) =>
          apiFetch(`/api/permissions/users/${user.personId}/project-access`, {
            method: "DELETE",
            body: JSON.stringify({ project_id: Number(projectId) }),
          }),
        ),
      ]);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["permission-users"] });
    },
  });

  const userColumns = useMemo<TableColumn<UserAccessSummary>[]>(() => {
    const companyTemplateOptions = companyTemplates.map((template) => ({
      value: template.id,
      label: template.name,
    }));
    const projectTemplateOptions = projectTemplates.map((template) => ({
      value: template.id,
      label: template.name,
    }));

    const resolveCompanyTemplateId = (user: UserAccessSummary) => {
      if (user.companyTemplateId) return user.companyTemplateId;
      const matchingTemplate = companyTemplates.find(
        (template) => template.name === user.primaryTemplateName,
      );
      return matchingTemplate?.id ?? companyTemplates[0]?.id ?? null;
    };

    // The "project-access" tab was retired — this table only ever shows app
    // users now, so role edits always use company templates.
    const roleEditOptions = companyTemplateOptions;

    return [
      {
        id: "name",
        label: "User",
        defaultVisible: true,
        alwaysVisible: true,
        sortable: true,
        sortValue: (user) => user.fullName,
        editable: true,
        editValue: (user) => user.fullName,
        onEdit: async (user, value) => {
          await updateUserMutation.mutateAsync({
            personId: user.personId,
            updates: splitEditableFullName(value),
          });
        },
        render: (user) => (
          <div className="flex min-w-0 items-center gap-3">
            <UserAvatar user={user} />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">
                {user.fullName}
              </p>
            </div>
          </div>
        ),
      },
      {
        id: "email",
        label: "Email",
        defaultVisible: true,
        alwaysVisible: true,
        sortable: true,
        sortValue: (user) => user.email,
        editable: true,
        editInputType: "email",
        editValue: (user) => user.email,
        onEdit: async (user, value) => {
          await updateUserMutation.mutateAsync({
            personId: user.personId,
            updates: { email: value },
          });
        },
        render: (user) => (
          <span className="block truncate text-sm text-muted-foreground">
            {user.email || "No email"}
          </span>
        ),
      },
      {
        id: "personType",
        label: "User Type",
        defaultVisible: true,
        sortable: true,
        sortValue: (user) => user.personType,
        editable: true,
        editType: "select",
        editOptions: USER_TYPE_OPTIONS,
        editValue: (user) => user.personType || "employee",
        onEdit: async (user, value) => {
          await updateUserMutation.mutateAsync({
            personId: user.personId,
            updates: { person_type: value },
          });
        },
        render: (user) => (
          <span className="block truncate text-sm text-foreground">
            {formatUserType(user.personType)}
          </span>
        ),
      },
      {
        id: "role",
        label: "Permission Template",
        defaultVisible: true,
        sortable: true,
        sortValue: (user) => user.primaryTemplateName,
        editable: roleEditOptions.length > 0,
        editType: "select",
        editOptions: roleEditOptions,
        editValue: (user) => resolveCompanyTemplateId(user) ?? "",
        onEdit: async (user, value) => {
          await tableCompanyTemplateMutation.mutateAsync({
            personId: user.personId,
            templateId: value,
          });
        },
        render: (user) => (
          <span className="block truncate text-sm text-foreground">
            {user.primaryTemplateName}
          </span>
        ),
      },
      {
        id: "teams",
        label: "Teams Account",
        defaultVisible: false,
        sortable: true,
        sortValue: (user) =>
          user.teamsAccount?.displayName ??
          user.teamsAccount?.platformUserId ??
          "",
        render: (user) => {
          if (!user.teamsAccount) {
            return (
              <span className="text-sm text-muted-foreground">Not linked</span>
            );
          }

          return (
            <div className="min-w-0">
              <span className="block truncate text-sm text-foreground">
                {user.teamsAccount.displayName || "Linked"}
              </span>
            </div>
          );
        },
      },
      {
        id: "projects",
        label: "Projects",
        defaultVisible: true,
        sortable: true,
        sortValue: (user) =>
          user.isAdmin ? Number.MAX_SAFE_INTEGER : user.projectCount,
        editable:
          projectsQuery.data !== undefined && projectTemplateOptions.length > 0,
        editValue: (user) => serializeProjectMembershipEdit(user.memberships),
        renderEditor: ({ item, value, onCommit, onCancel }) => (
          <ProjectMembershipInlineEditor
            value={value}
            projects={projectsQuery.data ?? []}
            projectTemplates={projectTemplates}
            onCommit={onCommit}
            onCancel={onCancel}
          />
        ),
        onEdit: async (user, value) => {
          if (user.isAdmin) {
            throw new Error("Admin users already have all-project access.");
          }

          await tableProjectMembershipMutation.mutateAsync({ user, value });

          if (user.companyTemplateId) {
            await tableCompanyTemplateMutation.mutateAsync({
              personId: user.personId,
              templateId: null,
            });
          }
        },
        render: (user) => (
          <div className="text-sm text-foreground">
            {user.isAdmin
              ? "All projects"
              : formatProjectCount(user.projectCount)}
            {user.missingTemplateCount > 0 && (
              <span className="ml-2 text-destructive">
                {user.missingTemplateCount} missing template
              </span>
            )}
          </div>
        ),
      },
      {
        id: "exceptions",
        label: "Exceptions",
        defaultVisible: true,
        sortable: true,
        sortValue: (user) => user.granularOverrides.length,
        render: (user) => (
          <span className="text-sm text-muted-foreground">
            {user.granularOverrides.length === 0
              ? "None"
              : `${user.granularOverrides.length} active`}
          </span>
        ),
      },
    ];
  }, [
    activeTab,
    companyTemplates,
    projectTemplates,
    projectsQuery.data,
    tableCompanyTemplateMutation,
    tableProjectMembershipMutation,
    tableProjectTemplateMutation,
    updateUserMutation,
  ]);

  const createMutation = useMutation({
    mutationFn: async (payload: {
      name: string;
      description: string;
      rules_json: Record<PermissionModule, PermissionLevel[]>;
      granular_flags?: GranularFlag[];
    }) => {
      await apiFetch("/api/permissions/templates", {
        method: "POST",
        body: JSON.stringify({ ...payload, scope: createScope }),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["permission-templates"] });
      setShowCreate(false);
      toast.success("Template created");
    },
    onError: (err) => {
      toast.error("Failed to create template");
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      ...payload
    }: {
      id: string;
      scope: TemplateScope;
      name: string;
      description: string;
      rules_json: Record<PermissionModule, PermissionLevel[]>;
      granular_flags?: GranularFlag[];
    }) => {
      await apiFetch(`/api/permissions/templates/${id}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["permission-templates"] });
      setEditTarget(null);
      toast.success("Template updated");
    },
    onError: (err) => {
      toast.error("Failed to update template");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async ({ id }: { id: string; scope: TemplateScope }) => {
      await apiFetch(`/api/permissions/templates/${id}`, { method: "DELETE" });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["permission-templates"] });
      setDeleteTarget(null);
      toast.success("Template deleted");
    },
    onError: (err) => {
      toast.error("Failed to delete template");
    },
  });

  const bulkDeleteTemplatesMutation = useMutation({
    mutationFn: async (templateIds: string[]) => {
      await Promise.all(
        templateIds.map((id) =>
          apiFetch(`/api/permissions/templates/${id}`, {
            method: "DELETE",
          }),
        ),
      );
    },
    onSuccess: (_data, templateIds) => {
      qc.invalidateQueries({ queryKey: ["permission-templates"] });
      tableState.setSelectedIds([]);
      setShowBulkDeleteTemplates(false);
      const templateScopeLabel =
        activeTab === "company-templates" ? "company" : "project";
      toast.success(
        `Deleted ${templateIds.length} ${templateScopeLabel} template${templateIds.length === 1 ? "" : "s"}`,
      );
    },
    onError: (error) => {
      const templateScopeLabel =
        activeTab === "company-templates" ? "company" : "project";
      toast.error(`Failed to delete ${templateScopeLabel} templates`, {
        description:
          error instanceof Error ? error.message : "The selected templates could not be deleted.",
      });
    },
  });

  const inviteMutation = useMutation({
    mutationFn: async (payload: {
      first_name: string;
      last_name: string;
      email: string;
      job_title?: string;
      access_scope: AccessScope;
      template_id: string;
      project_ids: number[];
    }) => {
      await apiFetch("/api/permissions/users", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () => {
      toast.success("Access assigned");
      setShowInvite(false);
      qc.invalidateQueries({ queryKey: ["permission-users"] });
    },
    onError: (err) => {
      toast.error("Failed to invite user");
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (personId: string) => {
      await apiFetch(`/api/permissions/users/${personId}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["permission-users"] });
      setUserDeleteTarget(null);
      toast.success("User removed from App Users");
    },
    onError: (err) => {
      toast.error("Failed to delete user");
    },
  });

  const bulkDeleteUsersMutation = useMutation({
    mutationFn: async (personIds: string[]) => {
      await Promise.all(
        personIds.map((personId) =>
          apiFetch(`/api/permissions/users/${personId}`, {
            method: "DELETE",
          }),
        ),
      );
    },
    onSuccess: (_data, personIds) => {
      qc.invalidateQueries({ queryKey: ["permission-users"] });
      tableState.setSelectedIds([]);
      setShowBulkDeleteUsers(false);
      toast.success(
        `Removed ${personIds.length} app user${personIds.length === 1 ? "" : "s"}`,
      );
    },
    onError: (err) => {
      toast.error("Failed to delete app users");
    },
  });

  const reconcileLinksMutation = useMutation({
    mutationFn: async () => {
      return apiFetch<{
        success: boolean;
        data: {
          repaired: Array<{ email: string }>;
          unresolved: UserLinkDiagnostic[];
        };
      }>("/api/permissions/users/reconcile-links", { method: "POST" });
    },
    onSuccess: (result) => {
      const repairedCount = result.data.repaired.length;
      if (repairedCount > 0) {
        toast.success(
          `${repairedCount} user auth link${repairedCount === 1 ? "" : "s"} repaired`,
        );
      }
      qc.invalidateQueries({ queryKey: ["permission-users"] });
    },
    onError: (err) => {
      toast.error("User auth links need manual review");
    },
  });

  useEffect(() => {
    if (activeTab !== "app-users" || linkDiagnostics.length === 0) return;

    const reconcileKey = linkDiagnostics
      .map(
        (diagnostic) =>
          `${diagnostic.authUserId}:${diagnostic.issues.join(",")}`,
      )
      .sort()
      .join("|");

    if (
      lastReconcileKeyRef.current === reconcileKey ||
      reconcileLinksMutation.isPending
    )
      return;

    lastReconcileKeyRef.current = reconcileKey;
    reconcileLinksMutation.mutate();
  }, [activeTab, linkDiagnostics, reconcileLinksMutation]);

  const openCreateForScope = (scope: TemplateScope) => {
    setCreateScope(scope);
    setShowCreate(true);
  };

  const templateDetailHref = useCallback(
    (template: PermissionTemplate) => `/user-management/templates/${template.id}`,
    [],
  );

  const activeTemplates =
    activeTab === "company-templates" ? companyTemplates : projectTemplates;

  const filteredRoles = useMemo(() => {
    const search = tableState.debouncedSearch.trim().toLowerCase();
    if (!search) return activeTemplates;
    return activeTemplates.filter((role) =>
      [role.name, role.description ?? "", role.scope ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(search),
    );
  }, [activeTemplates, tableState.debouncedSearch]);
  const sortedRoles = useMemo(() => {
    const direction = tableState.sortDirection === "desc" ? -1 : 1;
    return [...filteredRoles].sort((left, right) => {
      const sortBy = tableState.sortBy ?? "name";
      const leftValue = getTemplateSortValue(left, sortBy);
      const rightValue = getTemplateSortValue(right, sortBy);
      if (typeof leftValue === "number" && typeof rightValue === "number") {
        return (leftValue - rightValue) * direction;
      }
      return String(leftValue).localeCompare(String(rightValue)) * direction;
    });
  }, [filteredRoles, tableState.sortBy, tableState.sortDirection]);
  const templateTotalPages = Math.max(
    1,
    Math.ceil(sortedRoles.length / tableState.perPage),
  );
  const selectedTemplateIds = useMemo(
    () =>
      tableState.selectedIds.filter((id) =>
        activeTemplates.some(
          (template) => template.id === id && template.is_system !== true,
        ),
      ),
    [activeTemplates, tableState.selectedIds],
  );

  useEffect(() => {
    if (tableState.selectedIds.length > 0) {
      tableState.setSelectedIds([]);
    }
  }, [activeTab, tableState.setSelectedIds, tableState.selectedIds.length]);

  const tabs = [
    {
      label: "App Users",
      href: "/user-management",
      count: appUserCount,
      isActive: activeTab === "app-users",
    },
    {
      label: "Company Permission Templates",
      href: "/user-management?tab=company-templates",
      count: companyTemplates.length,
      isActive: activeTab === "company-templates",
    },
    {
      label: "Project Permission Templates",
      href: "/user-management?tab=project-templates",
      count: projectTemplates.length,
      isActive: activeTab === "project-templates",
    },
  ];

  const roleColumns = useMemo<TableColumn<PermissionTemplate>[]>(() => {
    const updateTemplateFromCell = async (
      role: PermissionTemplate,
      updates: Partial<
        Pick<PermissionTemplate, "name" | "description" | "scope">
      >,
    ) => {
      if (role.is_system) {
        throw new Error("System templates cannot be edited inline.");
      }

      await apiFetch(`/api/permissions/templates/${role.id}`, {
        method: "PUT",
        body: JSON.stringify({
          scope:
            updates.scope ?? (role.scope === "company" ? "company" : "project"),
          name: updates.name ?? role.name,
          description: updates.description ?? role.description ?? "",
          rules_json: role.rules_json,
          granular_flags: role.granular_flags ?? [],
        }),
      });
      qc.invalidateQueries({ queryKey: ["permission-templates"] });
    };

    return [
      {
        id: "name",
        label: "Template",
        defaultVisible: true,
        alwaysVisible: true,
        sortable: true,
        sortValue: (role) => role.name,
        editable: true,
        editValue: (role) => role.name,
        onEdit: (role, value) => updateTemplateFromCell(role, { name: value }),
        render: (role) => (
          <span className="block truncate text-sm font-medium text-foreground">
            {role.name}
          </span>
        ),
      },
      {
        id: "description",
        label: "Description",
        defaultVisible: true,
        sortable: true,
        sortValue: (role) => role.description ?? "",
        editable: true,
        editValue: (role) => role.description ?? "",
        onEdit: (role, value) =>
          updateTemplateFromCell(role, { description: value }),
        render: (role) => (
          <span className="block truncate text-sm text-muted-foreground">
            {role.description || "No description"}
          </span>
        ),
      },
      {
        id: "scope",
        label: "Scope",
        defaultVisible: true,
        sortable: true,
        sortValue: (role) => role.scope ?? "project",
        editable: true,
        editType: "select",
        editOptions: [
          { value: "project", label: "Project" },
          { value: "company", label: "All projects" },
        ],
        editValue: (role) => (role.scope === "company" ? "company" : "project"),
        onEdit: (role, value) =>
          updateTemplateFromCell(role, {
            scope: value === "company" ? "company" : "project",
          }),
        render: (role) => (
          <Badge variant="outline">
            {role.scope === "company" ? "All projects" : "Project"}
          </Badge>
        ),
      },
      {
        id: "granular",
        label: "Granular",
        defaultVisible: true,
        sortable: true,
        sortValue: (role) => role.granular_flags?.length ?? 0,
        render: (role) => (
          <span className="text-sm text-muted-foreground">
            {(role.granular_flags ?? []).length || "None"}
          </span>
        ),
      },
    ];
  }, [qc]);

  return (
    <>
      {activeTab === "app-users" ? (
        <UnifiedTablePage<UserAccessSummary>
          header={{
            title: "Manage Users",
            description: usersDescription,
            actions: (
              <Button size="sm" onClick={() => setShowInvite(true)}>
                <UserPlus className="h-4 w-4" />
                {usersAddLabel}
              </Button>
            ),
          }}
          tabs={tabs}
          toolbar={{
            totalItems: usersTotalCount,
            filteredItems: sortedUsers.length,
            selectedCount: canManageUserRows ? tableState.selectedIds.length : 0,
            searchValue: tableState.searchInput,
            onSearchChange: tableState.setSearchInput,
            searchPlaceholder: usersSearchPlaceholder,
            currentView: tableState.currentView,
            onViewChange: (view) => {
              tableState.setCurrentView(view);
              tableState.setSearchParams({ view });
            },
            enabledViews: ["table"],
            columns: userColumns,
            visibleColumns: tableState.visibleColumns,
            onColumnVisibilityChange: tableState.setVisibleColumns,
            onExport: sortedUsers.length > 0 ? handleExportUsers : undefined,
            onBulkDelete:
              canManageUserRows && tableState.selectedIds.length > 0
                ? () => setShowBulkDeleteUsers(true)
                : undefined,
          }}
          data={{
            items: pagedUsers,
            isLoading: activeUsersQuery.isLoading,
            isFetching: activeUsersQuery.isFetching,
            error:
              activeUsersQuery.error instanceof Error
                ? activeUsersQuery.error
                : null,
          }}
          topContent={
            <div className="-mt-3 space-y-3">
              {usersTopContent}
              {linkDiagnostics.length > 0 ? (
                <UserLinkDiagnosticsAlert
                  diagnostics={linkDiagnostics}
                  isRepairing={reconcileLinksMutation.isPending}
                  onRepair={() => reconcileLinksMutation.mutate()}
                />
              ) : null}
            </div>
          }
          layout={{
            containerClassName: "min-h-svh",
          }}
          table={{
            columns: userColumns,
            getRowId: (user) => user.id,
            defaultPinnedLeftColumns: ["name"],
            onRowClick: (user) => router.push(userHref(user)),
            rowActions: canManageUserRows
              ? (user) => (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        aria-label={`Actions for ${user.fullName}`}
                      >
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => router.push(userHref(user))}
                      >
                        <Eye className="mr-2 h-4 w-4" />
                        View
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() =>
                          router.push(`${userHref(user)}?mode=edit`)
                        }
                      >
                        <Pencil className="mr-2 h-4 w-4" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => setUserDeleteTarget(user)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )
              : undefined,
            stickyHeader: true,
            density: "compact",
          }}
          sorting={{
            sortBy: tableState.sortBy,
            sortDirection: tableState.sortDirection,
            onSortChange: (sortBy, direction) => {
              tableState.setSortBy(sortBy);
              tableState.setSortDirection(direction);
              tableState.setSearchParams({
                sort: sortBy,
                sort_dir: direction,
                page: "1",
              });
            },
          }}
          emptyState={{
            title: usersEmptyTitle,
            description: usersEmptyDescription,
            filteredDescription: usersFilteredDescription,
            isFiltered: Boolean(tableState.debouncedSearch),
            action: (
              <Button size="sm" onClick={() => setShowInvite(true)}>
                <UserPlus className="h-4 w-4" />
                {usersAddLabel}
              </Button>
            ),
          }}
          pagination={{
            page: tableState.page,
            totalPages,
            perPage: tableState.perPage,
            onPageChange: tableState.setPage,
            onPerPageChange: (perPage) =>
              tableState.setPerPage(Number(perPage)),
            clientSide: true,
          }}
          features={{
            enableSearch: true,
            enableViews: false,
            enableColumnToggle: true,
            enableFilters: false,
            enableExport: true,
            enableBulkDelete: canManageUserRows,
            enableRowSelection: canManageUserRows,
            enableRowActions: canManageUserRows,
            enableInlineEditing: true,
          }}
        />
      ) : (
        <UnifiedTablePage<PermissionTemplate>
          header={{
            title: "Manage Users",
            description:
              activeTab === "company-templates"
                ? "Manage company-wide permission templates for users who need access across every project."
                : "Manage permission templates assigned to users on individual projects.",
            actions: (
              <Button
                size="sm"
                onClick={() =>
                  openCreateForScope(
                    activeTab === "company-templates" ? "company" : "project",
                  )
                }
              >
                <Plus className="h-4 w-4" />
                {activeTab === "company-templates"
                  ? "New Company Permission Template"
                  : "New Project Permission Template"}
              </Button>
            ),
          }}
          tabs={tabs}
          toolbar={{
            totalItems: activeTemplates.length,
            filteredItems: sortedRoles.length,
            selectedCount: selectedTemplateIds.length,
            searchValue: tableState.searchInput,
            onSearchChange: tableState.setSearchInput,
            searchPlaceholder:
              activeTab === "company-templates"
                ? "Search company permission templates..."
                : "Search project permission templates...",
            currentView: "table",
            onViewChange: () => undefined,
            columns: roleColumns,
            visibleColumns: [
              "name",
              "description",
              "scope",
              "granular",
            ],
            onColumnVisibilityChange: () => undefined,
            onBulkDelete:
              selectedTemplateIds.length > 0
                ? () => setShowBulkDeleteTemplates(true)
                : undefined,
          }}
          data={{
            items: sortedRoles,
            isLoading:
              companyTemplatesQuery.isLoading ||
              projectTemplatesQuery.isLoading,
          }}
          layout={{
            containerClassName: "min-h-svh",
          }}
          table={{
            columns: roleColumns,
            getRowId: (role) => role.id,
            onRowClick: (template) => router.push(templateDetailHref(template)),
            rowActions: (template) =>
              template.is_system ? null : (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      aria-label={`Actions for ${template.name}`}
                    >
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={() => setDeleteTarget(template)}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ),
            stickyHeader: true,
            density: "compact",
          }}
          selection={
            {
              selectedIds: selectedTemplateIds,
              onSelectAll: (checked) => {
                tableState.setSelectedIds(
                  checked
                    ? sortedRoles
                        .filter((template) => !template.is_system)
                        .map((template) => template.id)
                    : [],
                );
              },
              onSelectRow: (id, checked) => {
                const template = activeTemplates.find((item) => item.id === id);
                if (!template || template.is_system) return;

                tableState.setSelectedIds((current) =>
                  checked
                    ? current.includes(id)
                      ? current
                      : [...current, id]
                    : current.filter((selectedId) => selectedId !== id),
                );
              },
            }
          }
          sorting={{
            sortBy: tableState.sortBy,
            sortDirection: tableState.sortDirection,
            onSortChange: (sortBy, direction) => {
              tableState.setSortBy(sortBy);
              tableState.setSortDirection(direction);
              tableState.setSearchParams({
                sort: sortBy,
                sort_dir: direction,
                page: "1",
              });
            },
          }}
          emptyState={{
            title: "No permission templates",
            description:
              activeTab === "company-templates"
                ? "Create a company permission template for all-project access."
                : "Create a project permission template for project-specific access.",
            filteredDescription: "No permission templates match your search.",
            isFiltered: Boolean(tableState.debouncedSearch),
            action: (
              <Button
                size="sm"
                onClick={() =>
                  openCreateForScope(
                    activeTab === "company-templates" ? "company" : "project",
                  )
                }
              >
                <Plus className="h-4 w-4" />
                {activeTab === "company-templates"
                  ? "New Company Permission Template"
                  : "New Project Permission Template"}
              </Button>
            ),
          }}
          pagination={{
            page: tableState.page,
            totalPages: templateTotalPages,
            perPage: tableState.perPage,
            onPageChange: tableState.setPage,
            onPerPageChange: (perPage) =>
              tableState.setPerPage(Number(perPage)),
            clientSide: true,
          }}
          features={{
            enableSearch: true,
            enableViews: false,
            enableColumnToggle: false,
            enableFilters: false,
            enableExport: false,
            enableBulkDelete: true,
            enableRowSelection: true,
            enableRowActions: true,
            enableInlineEditing: true,
          }}
        />
      )}

      <InviteUserDialog
        open={showInvite}
        onOpenChange={setShowInvite}
        mode={accessDialogMode}
        projectTemplates={projectTemplatesQuery.data ?? []}
        companyTemplates={companyTemplatesQuery.data ?? []}
        employees={employeeOptionsQuery.data ?? []}
        projects={projectsQuery.data ?? []}
        isLoading={
          projectTemplatesQuery.isLoading ||
          companyTemplatesQuery.isLoading ||
          employeeOptionsQuery.isLoading ||
          projectsQuery.isLoading
        }
        isSaving={inviteMutation.isPending}
        onInvite={(payload) => inviteMutation.mutateAsync(payload)}
      />

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent
          size="form"
          className="max-h-[calc(100svh-2rem)] overflow-y-auto"
        >
          <DialogHeader>
            <DialogTitle>
              New {createScope === "company" ? "Company" : "Project"} Permission
              Template
            </DialogTitle>
            <DialogDescription>
              Define the module access and granular capabilities included in
              this permission template.
            </DialogDescription>
          </DialogHeader>
          <PermissionTemplateForm
            onSave={(data) => createMutation.mutateAsync(data)}
            onCancel={() => setShowCreate(false)}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={!!editTarget} onOpenChange={() => setEditTarget(null)}>
        <DialogContent
          size="form"
          className="max-h-[calc(100svh-2rem)] overflow-y-auto"
        >
          <DialogHeader>
            <DialogTitle>
              Edit Role: {editTarget?.name}
              {editTarget?.is_system && (
                <Badge variant="outline" className="ml-2 align-middle text-xs">
                  System
                </Badge>
              )}
            </DialogTitle>
            <DialogDescription>
              Adjust this permission template so future assignments inherit the
              updated access profile.
            </DialogDescription>
          </DialogHeader>
          {editTarget && (
            <PermissionTemplateForm
              template={editTarget}
              onSave={(data) =>
                updateMutation.mutateAsync({
                  id: editTarget.id,
                  scope: (editTarget.scope === "company"
                    ? "company"
                    : "project") as TemplateScope,
                  ...data,
                })
              }
              onCancel={() => setEditTarget(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={() => setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete template?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes <strong>{deleteTarget?.name}</strong>.
              Members using this template must be reassigned.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                deleteTarget &&
                deleteMutation.mutate({
                  id: deleteTarget.id,
                  scope: (deleteTarget.scope === "company"
                    ? "company"
                    : "project") as TemplateScope,
                })
              }
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog
        open={showBulkDeleteTemplates}
        onOpenChange={setShowBulkDeleteTemplates}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {selectedTemplateIds.length}{" "}
              {activeTab === "company-templates" ? "company" : "project"}{" "}
              template{selectedTemplateIds.length === 1 ? "" : "s"}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes the selected{" "}
              {activeTab === "company-templates" ? "company" : "project"}{" "}
              templates. Members using them must be reassigned.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() =>
                bulkDeleteTemplatesMutation.mutate(selectedTemplateIds)
              }
              disabled={
                selectedTemplateIds.length === 0 ||
                bulkDeleteTemplatesMutation.isPending
              }
            >
              {bulkDeleteTemplatesMutation.isPending
                ? "Deleting..."
                : `Delete ${selectedTemplateIds.length} template${selectedTemplateIds.length === 1 ? "" : "s"}`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog
        open={!!userDeleteTarget}
        onOpenChange={() => setUserDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete user?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes {userDeleteTarget?.fullName ?? "this user"} from App
              Users by removing company-wide access and admin status. Project
              access is still controlled from each project directory.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (userDeleteTarget) {
                  deleteUserMutation.mutate(userDeleteTarget.personId);
                }
              }}
              disabled={deleteUserMutation.isPending}
            >
              Delete user
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog
        open={showBulkDeleteUsers}
        onOpenChange={setShowBulkDeleteUsers}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {tableState.selectedIds.length} app user
              {tableState.selectedIds.length === 1 ? "" : "s"}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the selected users from App Users. This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() =>
                bulkDeleteUsersMutation.mutate(
                  sortedUsers
                    .filter((user) => tableState.selectedIds.includes(user.id))
                    .map((user) => user.personId),
                )
              }
              disabled={
                tableState.selectedIds.length === 0 ||
                bulkDeleteUsersMutation.isPending
              }
            >
              {bulkDeleteUsersMutation.isPending
                ? "Deleting..."
                : `Delete ${tableState.selectedIds.length} user${tableState.selectedIds.length === 1 ? "" : "s"}`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function InviteUserDialog({
  open,
  onOpenChange,
  mode,
  projectTemplates,
  companyTemplates,
  employees,
  projects,
  isLoading,
  isSaving,
  onInvite,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "app" | "project";
  projectTemplates: PermissionTemplate[];
  companyTemplates: PermissionTemplate[];
  employees: EmployeeOption[];
  projects: ProjectOption[];
  isLoading: boolean;
  isSaving: boolean;
  onInvite: (payload: {
    first_name: string;
    last_name: string;
    email: string;
    job_title?: string;
    access_scope: AccessScope;
    template_id: string;
    project_ids: number[];
  }) => Promise<void>;
}) {
  const initialAccessScope: AccessScope =
    mode === "project" ? "selected_projects" : "all_projects";
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(
    null,
  );
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [accessScope, setAccessScope] =
    useState<AccessScope>(initialAccessScope);
  const [projectTemplateId, setProjectTemplateId] = useState("");
  const [companyTemplateId, setCompanyTemplateId] = useState("");
  const [selectedProjectIds, setSelectedProjectIds] = useState<Set<number>>(
    new Set(),
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setSelectedEmployeeId(null);
      setFirstName("");
      setLastName("");
      setEmail("");
      setJobTitle("");
      setAccessScope(initialAccessScope);
      setProjectTemplateId("");
      setCompanyTemplateId("");
      setSelectedProjectIds(new Set());
      setError(null);
      return;
    }

    setProjectTemplateId(
      (current) =>
        current || findTemplateId(projectTemplates, "Project Manager"),
    );
    setCompanyTemplateId(
      (current) =>
        current ||
        findTemplateId(companyTemplates, "Project Manager") ||
        companyTemplates[0]?.id ||
        "",
    );
    setAccessScope(initialAccessScope);
  }, [open, projectTemplates, companyTemplates, initialAccessScope]);

  const selectedEmployee =
    employees.find((employee) => employee.id === selectedEmployeeId) ?? null;

  const selectEmployee = (employee: EmployeeOption | null) => {
    setSelectedEmployeeId(employee?.id ?? null);

    if (!employee) {
      setFirstName("");
      setLastName("");
      setEmail("");
      setJobTitle("");
      return;
    }

    setFirstName(employee.firstName);
    setLastName(employee.lastName);
    setEmail(employee.email ?? "");
    setJobTitle(employee.jobTitle ?? "");
  };

  const selectedTemplateId =
    accessScope === "all_projects"
      ? companyTemplateId || companyTemplates[0]?.id || ""
      : projectTemplateId ||
        findTemplateId(projectTemplates, "Project Manager") ||
        projectTemplates[0]?.id ||
        "";

  const canSubmit =
    firstName.trim() &&
    lastName.trim() &&
    email.trim() &&
    selectedTemplateId &&
    (accessScope === "all_projects" || selectedProjectIds.size > 0);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!canSubmit) {
      setError(
        "Add the user details, permission template, and project access before saving.",
      );
      return;
    }

    try {
      await onInvite({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email: email.trim(),
        job_title: jobTitle.trim() || undefined,
        access_scope: accessScope,
        template_id: selectedTemplateId,
        project_ids:
          accessScope === "all_projects" ? [] : Array.from(selectedProjectIds),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invite failed");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        size="form"
        className="max-h-[calc(100svh-2rem)] overflow-y-auto"
      >
        <DialogHeader>
          <DialogTitle>
            {mode === "project" ? "Add project access" : "Grant app access"}
          </DialogTitle>
        </DialogHeader>

        <form className="space-y-6" onSubmit={submit}>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">
              Employee
            </label>
            <EmployeeCombobox
              employees={employees}
              selectedEmployeeId={selectedEmployeeId}
              disabled={isLoading}
              onSelect={selectEmployee}
            />
            {selectedEmployee ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-auto px-0 text-xs text-muted-foreground hover:bg-transparent hover:text-foreground"
                onClick={() => selectEmployee(null)}
              >
                Clear selection and enter a new employee
              </Button>
            ) : null}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label
                htmlFor="invite-first-name"
                className="text-sm font-medium text-foreground"
              >
                First name
              </label>
              <Input
                id="invite-first-name"
                value={firstName}
                onChange={(event) => setFirstName(event.target.value)}
                autoComplete="given-name"
              />
            </div>
            <div className="space-y-1.5">
              <label
                htmlFor="invite-last-name"
                className="text-sm font-medium text-foreground"
              >
                Last name
              </label>
              <Input
                id="invite-last-name"
                value={lastName}
                onChange={(event) => setLastName(event.target.value)}
                autoComplete="family-name"
              />
            </div>
            <div className="space-y-1.5">
              <label
                htmlFor="invite-email"
                className="text-sm font-medium text-foreground"
              >
                Email
              </label>
              <Input
                id="invite-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
              />
            </div>
            <div className="space-y-1.5">
              <label
                htmlFor="invite-title"
                className="text-sm font-medium text-foreground"
              >
                Title
              </label>
              <Input
                id="invite-title"
                value={jobTitle}
                onChange={(event) => setJobTitle(event.target.value)}
                placeholder="Project Manager"
              />
            </div>
          </div>

          {mode === "app" ? (
            <div className="space-y-3">
              <SectionRuleHeading label="Access" />
              <div className="grid gap-3 sm:grid-cols-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setAccessScope("all_projects");
                    setCompanyTemplateId(
                      (current) => current || companyTemplates[0]?.id || "",
                    );
                  }}
                  className={cn(
                    "h-auto justify-start rounded-md px-4 py-3 text-left transition-colors",
                    accessScope === "all_projects"
                      ? "border-primary bg-primary/5 hover:bg-primary/5"
                      : "hover:bg-muted/50",
                  )}
                >
                  <span className="block min-w-0">
                    <span className="block text-sm font-semibold text-foreground">
                      All projects
                    </span>
                    <span className="mt-1 block whitespace-normal text-sm font-normal text-muted-foreground">
                      Access across every current and future project.
                    </span>
                  </span>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setAccessScope("selected_projects");
                    setProjectTemplateId(
                      (current) => current || projectTemplates[0]?.id || "",
                    );
                  }}
                  className={cn(
                    "h-auto justify-start rounded-md px-4 py-3 text-left transition-colors",
                    accessScope === "selected_projects"
                      ? "border-primary bg-primary/5 hover:bg-primary/5"
                      : "hover:bg-muted/50",
                  )}
                >
                  <span className="block min-w-0">
                    <span className="block text-sm font-semibold text-foreground">
                      Specific projects
                    </span>
                    <span className="mt-1 block whitespace-normal text-sm font-normal text-muted-foreground">
                      Access only to selected projects.
                    </span>
                  </span>
                </Button>
              </div>
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
            <div className="space-y-1.5">
              <label
                htmlFor="invite-role"
                className="text-sm font-medium text-foreground"
              >
                Permission template
              </label>
              <Select
                value={selectedTemplateId}
                disabled={isLoading}
                onValueChange={(value) => {
                  if (accessScope === "all_projects") {
                    setCompanyTemplateId(value);
                  } else {
                    setProjectTemplateId(value);
                  }
                }}
              >
                <SelectTrigger id="invite-role" className="h-9 text-sm">
                  <SelectValue placeholder="Select permission template" />
                </SelectTrigger>
                <SelectContent>
                  {(accessScope === "all_projects"
                    ? companyTemplates
                    : projectTemplates
                  ).map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Start with a permission template, then customize the user later
                if needed.
              </p>
            </div>

            <div className="space-y-2">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">
                  Projects
                  {accessScope === "selected_projects" &&
                    selectedProjectIds.size > 0 && (
                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                        {selectedProjectIds.size} selected
                      </span>
                    )}
                </label>
              </div>
              {accessScope === "all_projects" ? (
                <div className="rounded-md border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
                  This user will inherit access across every current and future
                  project through the selected company permission template.
                </div>
              ) : (
                <MultiSelectField
                  label=""
                  options={projects.map((project) => ({
                    value: String(project.id),
                    label: project.jobNumber
                      ? `${project.name} ${project.jobNumber}`
                      : project.name,
                  }))}
                  value={Array.from(selectedProjectIds).map(String)}
                  onChange={(values) =>
                    setSelectedProjectIds(
                      new Set(
                        values
                          .map((value) => Number(value))
                          .filter(Number.isFinite),
                      ),
                    )
                  }
                  placeholder={
                    isLoading ? "Loading projects..." : "Select projects..."
                  }
                  disabled={isLoading}
                />
              )}
            </div>
          </div>

          {error && (
            <ErrorState
              title="Invite blocked"
              error={error}
              className="items-start py-2 text-left"
            />
          )}

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving || !canSubmit}>
              {isSaving
                ? "Saving..."
                : mode === "project"
                  ? "Add Project Access"
                  : "Grant Access"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EmployeeCombobox({
  employees,
  selectedEmployeeId,
  disabled,
  onSelect,
}: {
  employees: EmployeeOption[];
  selectedEmployeeId: string | null;
  disabled: boolean;
  onSelect: (employee: EmployeeOption | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const selectedEmployee =
    employees.find((employee) => employee.id === selectedEmployeeId) ?? null;
  const selectedLabel = selectedEmployee
    ? formatEmployeeLabel(selectedEmployee)
    : "Search People before inviting...";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "h-11 w-full justify-between px-4 py-1 text-left text-base font-normal sm:h-9 md:text-sm",
            !selectedEmployee && "text-muted-foreground",
          )}
        >
          <span className="min-w-0 truncate">{selectedLabel}</span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="start">
        <Command>
          <CommandInput placeholder="Search employees..." />
          <CommandEmpty>No employee found.</CommandEmpty>
          <CommandGroup>
            {employees.map((employee) => (
              <CommandItem
                key={employee.id}
                value={[
                  employee.firstName,
                  employee.lastName,
                  employee.email ?? "",
                  employee.jobTitle ?? "",
                ].join(" ")}
                onSelect={() => {
                  onSelect(employee);
                  setOpen(false);
                }}
              >
                <Check
                  className={cn(
                    "mr-2 h-4 w-4",
                    employee.id === selectedEmployeeId
                      ? "opacity-100"
                      : "opacity-0",
                  )}
                />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">
                    {formatEmployeeName(employee)}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {[employee.email, employee.jobTitle]
                      .filter(Boolean)
                      .join(" · ") || "No email on file"}
                  </span>
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function formatEmployeeName(employee: EmployeeOption) {
  return (
    [employee.firstName, employee.lastName].filter(Boolean).join(" ") ||
    "Unnamed employee"
  );
}

function formatEmployeeLabel(employee: EmployeeOption) {
  const detail = [employee.email, employee.jobTitle]
    .filter(Boolean)
    .join(" · ");
  return detail
    ? `${formatEmployeeName(employee)} (${detail})`
    : formatEmployeeName(employee);
}

function findTemplateId(templates: PermissionTemplate[], name: string) {
  return (
    templates.find(
      (template) => template.name.toLowerCase() === name.toLowerCase(),
    )?.id ?? ""
  );
}

function UserLinkDiagnosticsAlert({
  diagnostics,
  isRepairing,
  onRepair,
}: {
  diagnostics: UserLinkDiagnostic[];
  isRepairing: boolean;
  onRepair: () => void;
}) {
  const names = diagnostics
    .slice(0, 3)
    .map((diagnostic) => diagnostic.fullName || diagnostic.email)
    .join(", ");
  const extraCount = Math.max(0, diagnostics.length - 3);

  return (
    <Alert className="border-status-warning/30 bg-status-warning/10 text-foreground">
      <AlertTriangle className="h-4 w-4 text-status-warning" />
      <AlertDescription className="flex flex-col gap-3 text-sm md:flex-row md:items-center md:justify-between">
        <span>
          {diagnostics.length} user auth link
          {diagnostics.length === 1 ? "" : "s"} need repair
          {names
            ? `: ${names}${extraCount > 0 ? `, +${extraCount} more` : ""}.`
            : "."}
        </span>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={isRepairing}
          onClick={onRepair}
          className="w-fit shrink-0"
        >
          {isRepairing ? "Repairing..." : "Repair links"}
        </Button>
      </AlertDescription>
    </Alert>
  );
}
