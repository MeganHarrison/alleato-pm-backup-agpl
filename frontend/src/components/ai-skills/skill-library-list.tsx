"use client";

import * as React from "react";
import Link from "next/link";

import {
  Button,
  EmptyState,
  ErrorState,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ds";
import { apiFetch } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import type { SkillLibraryFilters, SkillLibrarySkill } from "./skill-library-types";

interface SkillLibraryResponse {
  skills: SkillLibrarySkill[];
  filters?: {
    categories?: string[];
    scopes?: string[];
    projects?: Array<{ id: number; name: string }>;
    statuses?: string[];
  };
  dependencyStatus?: string;
}

interface SkillLibraryListProps {
  mode: "user" | "admin";
  endpoint: string;
}

const ALL = "all";

function normalizeLabel(value: string | null | undefined) {
  if (!value) return "-";
  return value.replace(/_/g, " ");
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function buildQuery(filters: SkillLibraryFilters, includeStatus: boolean) {
  const params = new URLSearchParams();
  if (filters.category && filters.category !== ALL) params.set("category", filters.category);
  if (filters.scope && filters.scope !== ALL) params.set("scope", filters.scope);
  if (filters.projectId && filters.projectId !== ALL) params.set("projectId", filters.projectId);
  if (includeStatus && filters.status && filters.status !== ALL) params.set("status", filters.status);
  const query = params.toString();
  return query ? `?${query}` : "";
}

function getSkillExamples(skill: SkillLibrarySkill) {
  return (skill.examples ?? [])
    .map((example) => example.title ?? example.input ?? example.output)
    .filter((value): value is string => Boolean(value?.trim()))
    .slice(0, 2);
}

function tableStatus(skill: SkillLibrarySkill) {
  if (skill.status) return normalizeLabel(skill.status);
  if (skill.isActive === false) return "inactive";
  if (skill.isVisible === false) return "hidden";
  return "active";
}

export function SkillLibraryList({ mode, endpoint }: SkillLibraryListProps) {
  const [filters, setFilters] = React.useState<SkillLibraryFilters>({});
  const [data, setData] = React.useState<SkillLibraryResponse | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);

  const includeStatus = mode === "admin";

  const loadSkills = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiFetch<SkillLibraryResponse>(
        `${endpoint}${buildQuery(filters, includeStatus)}`,
      );
      setData(response);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Skill Library could not load.");
    } finally {
      setLoading(false);
    }
  }, [endpoint, filters, includeStatus]);

  React.useEffect(() => {
    void loadSkills();
  }, [loadSkills]);

  const skills = data?.skills ?? [];
  const categories = data?.filters?.categories ?? [];
  const scopes = data?.filters?.scopes ?? [];
  const projects = data?.filters?.projects ?? [];
  const statuses = data?.filters?.statuses ?? ["active", "candidate", "paused", "archived"];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Select
            value={filters.category ?? ALL}
            onValueChange={(value) => setFilters((current) => ({ ...current, category: value }))}
          >
            <SelectTrigger aria-label="Filter by category">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All categories</SelectItem>
              {categories.map((category) => (
                <SelectItem key={category} value={category}>
                  {category}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={filters.scope ?? ALL}
            onValueChange={(value) => setFilters((current) => ({ ...current, scope: value }))}
          >
            <SelectTrigger aria-label="Filter by scope">
              <SelectValue placeholder="Scope" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All scopes</SelectItem>
              {scopes.map((scope) => (
                <SelectItem key={scope} value={scope}>
                  {normalizeLabel(scope)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={filters.projectId ?? ALL}
            onValueChange={(value) => setFilters((current) => ({ ...current, projectId: value }))}
          >
            <SelectTrigger aria-label="Filter by project">
              <SelectValue placeholder="Project" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All projects</SelectItem>
              {projects.map((project) => (
                <SelectItem key={project.id} value={String(project.id)}>
                  {project.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {includeStatus ? (
            <Select
              value={filters.status ?? ALL}
              onValueChange={(value) => setFilters((current) => ({ ...current, status: value }))}
            >
              <SelectTrigger aria-label="Filter by status">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All statuses</SelectItem>
                {statuses.map((status) => (
                  <SelectItem key={status} value={status}>
                    {normalizeLabel(status)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
        </div>

        {mode === "user" ? (
          <Button asChild size="sm">
            <Link href="/ai/teach">Teach Alleato</Link>
          </Button>
        ) : null}
      </div>

      {error ? (
        <ErrorState
          title="Skill Library could not load"
          error={error}
          onRetry={loadSkills}
          className="items-start py-6 text-left"
        />
      ) : null}

      {!error && loading ? (
        <div className="divide-y rounded-md border" aria-label="Loading skills">
          {[0, 1, 2].map((item) => (
            <div key={item} className="grid gap-3 p-4 md:grid-cols-6">
              <div className="h-4 rounded bg-muted" />
              <div className="h-4 rounded bg-muted" />
              <div className="h-4 rounded bg-muted" />
              <div className="h-4 rounded bg-muted" />
              <div className="h-4 rounded bg-muted" />
              <div className="h-4 rounded bg-muted" />
            </div>
          ))}
        </div>
      ) : null}

      {!error && !loading && skills.length === 0 ? (
        <EmptyState
          title="No skills match these filters"
          description="Clear a filter or submit a reviewed candidate through Teach Alleato."
        />
      ) : null}

      {!error && !loading && skills.length > 0 ? (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full min-w-max border-collapse text-left text-sm">
            <thead className="bg-muted/40 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Skill</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Scope</th>
                <th className="px-4 py-3">Owner</th>
                <th className="px-4 py-3">Reviewer</th>
                <th className="px-4 py-3">Version</th>
                <th className="px-4 py-3 text-right">Uses</th>
                <th className="px-4 py-3">Last used</th>
                {includeStatus ? <th className="px-4 py-3">Status</th> : null}
              </tr>
            </thead>
            <tbody className="divide-y">
              {skills.map((skill) => {
                const examples = getSkillExamples(skill);
                return (
                  <tr key={skill.id} className="align-top">
                    <td className="px-4 py-4">
                      <div className="space-y-1.5">
                        <p className="font-medium text-foreground">{skill.title}</p>
                        <p className="max-w-xl text-muted-foreground">{skill.summary}</p>
                        {examples.length > 0 ? (
                          <p className="max-w-xl text-xs text-muted-foreground">
                            Examples: {examples.join(" / ")}
                          </p>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-muted-foreground">{skill.category || "-"}</td>
                    <td className="px-4 py-4">
                      <div className="space-y-1">
                        <p className="capitalize text-foreground">{normalizeLabel(skill.scope)}</p>
                        {skill.projectName ? (
                          <p className="text-xs text-muted-foreground">{skill.projectName}</p>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-muted-foreground">{skill.ownerName ?? "-"}</td>
                    <td className="px-4 py-4 text-muted-foreground">{skill.reviewerName ?? "-"}</td>
                    <td className="px-4 py-4 text-muted-foreground">{skill.version ?? "-"}</td>
                    <td className="px-4 py-4 text-right tabular-nums text-muted-foreground">
                      {skill.usageCount ?? 0}
                    </td>
                    <td className="px-4 py-4 text-muted-foreground">{formatDate(skill.lastUsedAt)}</td>
                    {includeStatus ? (
                      <td className={cn("px-4 py-4 capitalize", skill.isVisible === false && "text-muted-foreground")}>
                        {tableStatus(skill)}
                      </td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
