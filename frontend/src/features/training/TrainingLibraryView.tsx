"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, BookOpen, GraduationCap, Search } from "lucide-react";

import { EmptyState } from "@/components/ds";
import { Input } from "@/components/ui/input";
import type {
  LearningLibraryItem,
  TrainingRoleOption,
} from "@/lib/learning/types";

interface TrainingLibraryViewProps {
  items: LearningLibraryItem[];
  roles: TrainingRoleOption[];
}

function label(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function TrainingLibraryView({ items, roles }: TrainingLibraryViewProps) {
  const [search, setSearch] = useState("");
  const [roleId, setRoleId] = useState("all");
  const [kind, setKind] = useState("all");
  const kinds = useMemo(
    () => [...new Set(items.map((item) => item.kind))].sort(),
    [items],
  );
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return items.filter((item) => {
      if (roleId !== "all" && !item.roles.some((role) => role.id === roleId)) {
        return false;
      }
      if (kind !== "all" && item.kind !== kind) return false;
      if (!query) return true;
      return [
        item.title,
        item.summary,
        item.provider,
        item.kind,
        ...item.topics.map((topic) => topic.name),
        ...item.roles.map((role) => role.name),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [items, kind, roleId, search]);

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row">
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">Search training library</span>
          <Search className="pointer-events-none absolute left-3 top-3 size-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search guides, courses, SOPs, and resources..."
            className="pl-9"
          />
        </label>
        <select
          aria-label="Filter by role"
          value={roleId}
          onChange={(event) => setRoleId(event.target.value)}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm sm:w-52"
        >
          <option value="all">All roles</option>
          {roles.map((role) => (
            <option key={role.id} value={role.id}>{role.name}</option>
          ))}
        </select>
        <select
          aria-label="Filter by content type"
          value={kind}
          onChange={(event) => setKind(event.target.value)}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm sm:w-48"
        >
          <option value="all">All content types</option>
          {kinds.map((value) => (
            <option key={value} value={value}>{label(value)}</option>
          ))}
        </select>
      </div>

      {filtered.length > 0 ? (
        <div role="list" className="grid gap-x-10 md:grid-cols-2">
          {filtered.map((item) => {
            const Icon =
              item.kind === "internal_course" ? GraduationCap : BookOpen;
            const content = (
              <>
                <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-muted">
                  <Icon className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="font-medium leading-6">{item.title}</h2>
                    {item.external ? <ArrowRight className="mt-1 size-3.5 shrink-0 text-muted-foreground" /> : null}
                  </div>
                  {item.summary ? (
                    <p className="mt-1 line-clamp-2 text-sm leading-5 text-muted-foreground">
                      {item.summary}
                    </p>
                  ) : null}
                  <p className="mt-2 text-xs text-muted-foreground">
                    {label(item.kind)}
                    {item.estimatedMinutes ? ` · ${item.estimatedMinutes} min` : ""}
                    {item.provider ? ` · ${item.provider}` : ""}
                  </p>
                </div>
              </>
            );
            return (
              <div key={item.id} role="listitem" className="border-b py-5">
                {item.external ? (
                  <a
                    href={item.href}
                    target="_blank"
                    rel="noreferrer"
                    className="flex gap-4 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {content}
                  </a>
                ) : (
                  <Link
                    href={item.href}
                    className="flex gap-4 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {content}
                  </Link>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyState
          title="No training matches"
          description="Try a different search, role, or content type."
        />
      )}
    </div>
  );
}
