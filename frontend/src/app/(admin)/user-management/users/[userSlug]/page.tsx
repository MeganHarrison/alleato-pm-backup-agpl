"use client";

import { useEffect, useMemo } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";

import {
  buildUserSlugMaps,
  fetchTemplates,
  fetchUsers,
  getProjectRoleTemplates,
  looksLikePersonId,
  toAccessSummary,
  type GranularOverrideEffect,
} from "../../_lib/user-access-data";
import { UserAccessPanel, UserAvatar } from "../../_components/user-access-panel";
import { PageShell } from "@/components/layout";
import { Button, EmptyState, ErrorState } from "@/components/ds";
import { apiFetch } from "@/lib/api-client";
import type { GranularFlag } from "@/lib/permissions-shared";

type ProjectOption = {
  id: number;
  name: string;
  jobNumber: string | null;
};

type ProjectsResponse = {
  data: Array<{
    id: number;
    name: string | null;
    "job number"?: string | null;
    job_number?: string | null;
  }>;
};

async function fetchProjectOptions(): Promise<ProjectOption[]> {
  const response = await apiFetch<ProjectsResponse>(
    "/api/projects?limit=500&fields=id,name,job_number&includeClient=false",
  );

  return response.data.map((project) => ({
    id: project.id,
    name: project.name?.trim() || `Project #${project.id}`,
    jobNumber: project["job number"] ?? project.job_number ?? null,
  }));
}

export default function PermissionUserDetailPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const searchParams = useSearchParams();
  const params = useParams<{ userSlug: string }>();
  const userSlug = params?.userSlug;
  const rawSlug = userSlug ?? "";
  const routeKey = (() => {
    try {
      return decodeURIComponent(rawSlug);
    } catch {
      return rawSlug;
    }
  })();

  const usersQuery = useQuery({
    queryKey: ["permission-users"],
    queryFn: () => fetchUsers(),
    retry: false,
  });

  const projectTemplatesQuery = useQuery({
    queryKey: ["permission-templates", "project"],
    queryFn: () => fetchTemplates("project"),
  });

  const companyTemplatesQuery = useQuery({
    queryKey: ["permission-templates", "company"],
    queryFn: () => fetchTemplates("company"),
  });

  const projectsQuery = useQuery({
    queryKey: ["permission-project-options"],
    queryFn: fetchProjectOptions,
  });

  const users = useMemo(
    () => (usersQuery.data?.data ?? []).map(toAccessSummary),
    [usersQuery.data?.data],
  );
  const { slugByPersonId, personIdBySlug } = useMemo(
    () => buildUserSlugMaps(users),
    [users],
  );

  // Resolve the route key as a name slug first, then fall back to a raw
  // personId/authUserId so legacy UUID links keep working.
  // Skip the slug map when the route key is already a UUID — the map won't
  // have a UUID key, so the lookup would always return undefined anyway.
  const personIdFromSlug = looksLikePersonId(routeKey) ? null : (personIdBySlug.get(routeKey) ?? null);
  const user = useMemo(
    () =>
      users.find(
        (item) =>
          item.personId === personIdFromSlug ||
          item.personId === routeKey ||
          item.authUserId === routeKey,
      ) ?? null,
    [users, personIdFromSlug, routeKey],
  );

  // Canonicalize the URL to the user's name slug (e.g. when arriving via a
  // legacy UUID link). Replace so the back button skips the UUID entry.
  useEffect(() => {
    if (!user) return;
    const canonicalSlug = slugByPersonId.get(user.personId);
    if (!canonicalSlug || canonicalSlug === routeKey) return;
    const query = searchParams?.toString();
    router.replace(
      `/user-management/users/${canonicalSlug}${query ? `?${query}` : ""}`,
    );
  }, [user, slugByPersonId, routeKey, router, searchParams]);

  const assignMutation = useMutation({
    mutationFn: async ({
      projectId,
      personId,
      templateId,
    }: {
      projectId: number | string;
      personId: string;
      templateId: string;
    }) => {
      await apiFetch(`/api/projects/${projectId}/permissions/assign`, {
        method: "POST",
        body: JSON.stringify({ person_id: personId, template_id: templateId }),
      });
    },
    onSuccess: () => {
      toast.success("Project access updated");
      qc.invalidateQueries({ queryKey: ["permission-users"] });
    },
    onError: (err) => {
      console.error("Project access role update failed", err);
      toast.error("Project access update failed", {
        description: err instanceof Error ? err.message : String(err),
      });
    },
  });

  const addProjectAccessMutation = useMutation({
    mutationFn: async ({
      projectIds,
      templateId,
    }: {
      projectIds: number[];
      templateId: string;
    }) => {
      if (!user?.personId) throw new Error("User ID required");
      await apiFetch(`/api/permissions/users/${user.personId}/project-access`, {
        method: "POST",
        body: JSON.stringify({ project_ids: projectIds, template_id: templateId }),
      });
    },
    onSuccess: (_data, variables) => {
      toast.success(
        variables.projectIds.length === 1
          ? "Project access added"
          : `${variables.projectIds.length} projects added`,
      );
      qc.invalidateQueries({ queryKey: ["permission-users"] });
    },
    onError: (err) => {
      console.error("Project access add failed", err);
      toast.error("Project access could not be added. Try again.");
    },
  });

  const removeProjectAccessMutation = useMutation({
    mutationFn: async ({ projectId }: { projectId: number | string }) => {
      if (!user?.personId) throw new Error("User ID required");
      await apiFetch(`/api/permissions/users/${user.personId}/project-access`, {
        method: "DELETE",
        body: JSON.stringify({ project_id: Number(projectId) }),
      });
    },
    onSuccess: () => {
      toast.success("Project access removed");
      qc.invalidateQueries({ queryKey: ["permission-users"] });
    },
    onError: (err) => {
      console.error("Project access remove failed", err);
      toast.error("Project access could not be removed. Try again.");
    },
  });

  const companyTemplateMutation = useMutation({
    mutationFn: async ({ personId, templateId }: { personId: string; templateId: string | null }) => {
      if (templateId) {
        await apiFetch(`/api/permissions/users/${personId}/company-template`, {
          method: "PUT",
          body: JSON.stringify({ template_id: templateId }),
        });
        return;
      }

      await apiFetch(`/api/permissions/users/${personId}/company-template`, { method: "DELETE" });
    },
    onSuccess: (_data, variables) => {
      toast.success(variables.templateId ? "Company access assigned" : "Company access removed");
      qc.invalidateQueries({ queryKey: ["permission-users"] });
    },
    onError: (err) => {
      console.error("Company access update failed", err);
      toast.error("Company access update failed", {
        description: err instanceof Error ? err.message : String(err),
      });
    },
  });

  const granularOverrideMutation = useMutation({
    mutationFn: async ({
      personId,
      flag,
      effect,
    }: {
      personId: string;
      flag: GranularFlag;
      effect: GranularOverrideEffect | null;
    }) => {
      const url = `/api/permissions/users/${personId}/granular-overrides`;
      if (effect) {
        await apiFetch(url, {
          method: "PUT",
          body: JSON.stringify({ flag, effect }),
        });
        return;
      }

      await apiFetch(url, {
        method: "DELETE",
        body: JSON.stringify({ flag }),
      });
    },
    onSuccess: (_data, variables) => {
      toast.success(variables.effect ? "Permission exception saved" : "Permission exception removed");
      qc.invalidateQueries({ queryKey: ["permission-users"] });
    },
    onError: (err) => {
      console.error("Permission exception update failed", err);
      toast.error("Permission exception update failed", {
        description: err instanceof Error ? err.message : String(err),
      });
    },
  });

  const isLoading =
    usersQuery.isLoading ||
    projectTemplatesQuery.isLoading ||
    companyTemplatesQuery.isLoading;
  const pageTitle = usersQuery.isError
    ? "Unable to load user"
    : user?.fullName ?? (isLoading ? "Loading user..." : "User not found");

  return (
    <PageShell
      variant="detail"
      title={pageTitle}
      titleContent={
        user ? (
          <div className="flex min-w-0 items-center gap-3">
            <UserAvatar user={user} size="lg" />
            <div className="min-w-0">
              <h1 className="truncate text-2xl font-semibold text-foreground">{user.fullName}</h1>
              <p className="truncate text-sm text-muted-foreground">{user.email || "No email on file"}</p>
            </div>
          </div>
        ) : undefined
      }
      onBack={() => router.push("/user-management")}
      actions={
        <Button type="button" variant="ghost" size="sm" onClick={() => router.push("/user-management")}>
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
      }
    >
      {isLoading ? (
        <div className="space-y-4">
          <div className="h-20 animate-pulse bg-muted" />
          <div className="h-40 animate-pulse bg-muted" />
          <div className="h-64 animate-pulse bg-muted" />
        </div>
      ) : usersQuery.isError ? (
        <ErrorState
          title="Unable to load user access"
          description="User Management rejected this request. Admin permission is required before this profile can load."
          error={usersQuery.error}
          onRetry={() => usersQuery.refetch()}
          className="border-y border-border py-14"
        />
      ) : user ? (
        <UserAccessPanel
          user={user}
          templates={getProjectRoleTemplates(projectTemplatesQuery.data ?? [])}
          companyTemplates={companyTemplatesQuery.data ?? []}
          projects={projectsQuery.data ?? []}
          isTemplatesLoading={projectTemplatesQuery.isLoading}
          isProjectsLoading={projectsQuery.isLoading}
          isAssignmentSaving={
            assignMutation.isPending ||
            addProjectAccessMutation.isPending ||
            removeProjectAccessMutation.isPending
          }
          isCompanyTemplateSaving={companyTemplateMutation.isPending}
          isGranularOverrideSaving={granularOverrideMutation.isPending}
          onAssignTemplate={(projectId, personId, templateId) =>
            assignMutation.mutate({ projectId, personId, templateId })
          }
          onAddProjectAccess={(projectIds, templateId) =>
            addProjectAccessMutation.mutate({ projectIds, templateId })
          }
          onRemoveProjectAccess={(projectId) =>
            removeProjectAccessMutation.mutate({ projectId })
          }
          onAssignCompanyTemplate={(personId, templateId) =>
            companyTemplateMutation.mutate({ personId, templateId })
          }
          onSetGranularOverride={(personId, flag, effect) =>
            granularOverrideMutation.mutate({ personId, flag, effect })
          }
        />
      ) : (
        <EmptyState
          title="User not found"
          description="This profile is not in the current User Management list. Return to User Management and choose a current person record."
          action={
            <Button type="button" variant="outline" onClick={() => router.push("/user-management")}>
              Back
            </Button>
          }
          className="border-y border-border py-14"
        />
      )}
    </PageShell>
  );
}
