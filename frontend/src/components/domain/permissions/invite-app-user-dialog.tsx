"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api-client";
import { appToast as toast } from "@/lib/toast/app-toast";
import type { PermissionTemplate } from "@/lib/permissions-shared";
import {
  InviteUserDialog,
  type EmployeeOption,
  type InviteUserPayload,
  type ProjectOption,
} from "./invite-user-dialog";

async function fetchTemplates(
  scope: "company" | "project",
): Promise<PermissionTemplate[]> {
  const { data } = await apiFetch<{ data: PermissionTemplate[] }>(
    `/api/permissions/templates?scope=${scope}`,
  );
  return data;
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

type PersonRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  job_title: string | null;
};

function mapToEmployeeOption(person: PersonRow): EmployeeOption {
  return {
    id: person.id,
    firstName: person.first_name ?? "",
    lastName: person.last_name ?? "",
    email: person.email ?? null,
    jobTitle: person.job_title ?? null,
  };
}

/** Anyone flagged as an app user — the broad list (admin user-management). */
async function fetchAppUserOptions(): Promise<EmployeeOption[]> {
  const { data } = await apiFetch<{ data: PersonRow[] }>(
    "/api/people?type=user&status=active&per_page=500",
  );
  return data.map(mapToEmployeeOption);
}

/**
 * Actual Alleato Group employees — same definition the Employees directory
 * table uses (company = "Alleato Group", active). Keeps the invite prefill on
 * that page from suggesting non-employees (subcontractors, system accounts).
 */
async function fetchAlleatoEmployeeOptions(): Promise<EmployeeOption[]> {
  const { data } = await apiFetch<{ data: PersonRow[] }>(
    "/api/directory/employees/table?per_page=500&status=active&sort=full_name:asc",
  );
  return data.map(mapToEmployeeOption);
}

/**
 * Self-contained "invite a person to the PM app" dialog.
 *
 * Owns its own data fetching (permission templates, projects, existing people)
 * and the invite mutation (`POST /api/permissions/users`, which creates the
 * Supabase auth account, emails the invite, and assigns the chosen access).
 * Drop it on any page that needs an app-user invite entry point — the caller
 * only controls open/close and reacts to a successful invite via `onInvited`.
 *
 * The invite endpoint is admin-gated (`requireUserManagementAccess`); callers
 * should only render the trigger for users who have that access.
 */
export function InviteAppUserDialog({
  open,
  onOpenChange,
  onInvited,
  peopleScope = "app-users",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInvited?: () => void;
  /**
   * Which people the prefill dropdown suggests. "app-users" (default) lists
   * anyone flagged as an app user; "alleato-employees" restricts to actual
   * Alleato Group employees (used on the Employees directory page).
   */
  peopleScope?: "app-users" | "alleato-employees";
}) {
  const qc = useQueryClient();

  const companyTemplatesQuery = useQuery({
    queryKey: ["permission-templates", "company"],
    queryFn: () => fetchTemplates("company"),
    enabled: open,
  });
  const projectTemplatesQuery = useQuery({
    queryKey: ["permission-templates", "project"],
    queryFn: () => fetchTemplates("project"),
    enabled: open,
  });
  const projectsQuery = useQuery({
    queryKey: ["permissions-project-options"],
    queryFn: fetchProjects,
    enabled: open,
  });
  const employeeOptionsQuery = useQuery({
    queryKey: ["invite-people-options", peopleScope],
    queryFn:
      peopleScope === "alleato-employees"
        ? fetchAlleatoEmployeeOptions
        : fetchAppUserOptions,
    enabled: open,
  });

  const inviteMutation = useMutation({
    mutationFn: async (payload: InviteUserPayload) => {
      // On the Employees surface, tag invitees with the Alleato company so the
      // company-scoped Employees table actually shows them after invite.
      const body: InviteUserPayload =
        peopleScope === "alleato-employees"
          ? { ...payload, company: "Alleato Group" }
          : payload;
      await apiFetch("/api/permissions/users", {
        method: "POST",
        body: JSON.stringify(body),
      });
    },
    onSuccess: () => {
      toast.success("Invitation sent");
      onOpenChange(false);
      qc.invalidateQueries({ queryKey: ["permission-users"] });
      onInvited?.();
    },
    onError: () => {
      // The detailed error is surfaced inline in the dialog's ErrorState via
      // the rejected mutateAsync; keep the toast a friendly static message.
      toast.error("Failed to send invitation");
    },
  });

  return (
    <InviteUserDialog
      open={open}
      onOpenChange={onOpenChange}
      mode="app"
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
  );
}
