"use client";

/* eslint-disable design-system/no-raw-table-primitives -- Read-only rule matrix; UnifiedTablePage would add unnecessary toolbar and pagination chrome for this secondary inspection view. */

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

import { StatusBadge } from "@/components/ds";
import { PageHeader, SectionRuleHeading } from "@/components/layout";
import { PageTabs } from "@/components/layout/PageTabs";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { apiFetch } from "@/lib/api-client";
import { reportNonCriticalFailure } from "@/lib/report-non-critical-failure";
import { ExpandableSearch } from "@/components/tables/unified/table-toolbar";

import type {
  AssignmentInboxRule,
  AssignmentInboxRulesResponse,
  AttributionRuleStatus,
} from "./attribution-rules";

interface AssignmentInboxRulesPanelProps {
  active: boolean;
  tabs: Array<{
    label: string;
    href: string;
    count?: number;
    isActive?: boolean;
  }>;
}

const RULE_TYPE_LABELS: Record<AssignmentInboxRule["ruleType"], string> = {
  title_keyword: "Subject term",
  keyword: "Content keyword",
  phrase: "Content phrase",
  email: "Email address",
  domain: "Email domain",
};

function formatConfidence(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function formatUpdatedAt(value: string | null): string {
  if (!value) return "Unknown";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

export function AssignmentInboxRulesPanel({
  active,
  tabs,
}: AssignmentInboxRulesPanelProps) {
  const [payload, setPayload] = useState<AssignmentInboxRulesResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] =
    useState<AttributionRuleStatus | "all">("active");

  const loadRules = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response =
        await apiFetch<AssignmentInboxRulesResponse>("/api/assignment-inbox/rules", {
          cache: "no-store",
        });
      setPayload(response);
      setHasLoaded(true);
    } catch (loadError) {
      const message =
        loadError instanceof Error
          ? loadError.message
          : "Could not load project attribution rules.";
      setError(message);
      reportNonCriticalFailure({
        area: "assignment-inbox-rules",
        operation: "load",
        error: loadError,
        userVisibleFallback: message,
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!active || hasLoaded || loading) return;
    void loadRules();
  }, [active, hasLoaded, loading, loadRules]);

  const filteredRules = useMemo(() => {
    const rules = payload?.rules ?? [];
    const query = search.trim().toLowerCase();

    return rules.filter((rule) => {
      if (statusFilter !== "all" && rule.status !== statusFilter) return false;
      if (!query) return true;
      return [
        rule.projectName,
        rule.pattern,
        RULE_TYPE_LABELS[rule.ruleType],
        rule.source,
        rule.notes ?? "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [payload, search, statusFilter]);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Project Assignment"
        description="Keep unassigned work moving and inspect the rules that shape future project matching."
        className="mb-2 px-0 sm:px-0 lg:px-0"
      />
      <PageTabs tabs={tabs} variant="inline" className="-mr-1 mb-0 w-full min-w-0 sm:mr-0" />

      <section className="space-y-4">
        <div className="space-y-2">
          <SectionRuleHeading label="Assignment logic" className="mb-0 pb-0" />
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>
              Existing project rules match on email, domain, and subject or title terms.
              When a strong rule does not exist, the system falls back to AI suggestions
              and manual review.
            </p>
            <p>
              Every manual assignment in the inbox becomes training data. Admins can then
              review promoted rule candidates before those rules start influencing future
              project assignment.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          <span>
            {payload
              ? `${payload.counts.active.toLocaleString()} active rule${
                  payload.counts.active === 1 ? "" : "s"
                }`
              : "Rules load on demand"}
          </span>
          {payload ? (
            <span>
              {payload.counts.inactive.toLocaleString()} inactive rule
              {payload.counts.inactive === 1 ? "" : "s"}
            </span>
          ) : null}
          {payload?.isAdmin && payload.counts.pendingCandidates != null ? (
            <span>
              {payload.counts.pendingCandidates.toLocaleString()} pending candidate
              {payload.counts.pendingCandidates === 1 ? "" : "s"}
            </span>
          ) : null}
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <SectionRuleHeading label="Attribution rules" className="mb-0 pb-0" />
            <p className="text-sm text-muted-foreground">
              Review the explicit rules already steering project assignment before a human
              has to intervene again.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <ExpandableSearch
              value={search}
              onChange={setSearch}
              placeholder="Search project, pattern, or source"
              ariaLabel="Search attribution rules"
              defaultExpanded
            />
            <Select
              value={statusFilter}
              onValueChange={(value: AttributionRuleStatus | "all") =>
                setStatusFilter(value)
              }
            >
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="all">All</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={() => void loadRules()} disabled={loading}>
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
              Refresh
            </Button>
            {payload?.isAdmin ? (
              <>
                <Button variant="outline" size="sm" asChild>
                  <Link href="/project-attribution">Manage rules</Link>
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <Link href="/ai/learning-promotions">Review promotions</Link>
                </Button>
              </>
            ) : null}
          </div>
        </div>

        {error ? (
          <div className="flex items-start gap-3 rounded-md border border-danger/30 bg-danger/5 px-4 py-3 text-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
            <div className="space-y-1">
              <div className="font-medium text-foreground">
                Attribution rules could not be loaded
              </div>
              <div className="text-muted-foreground">{error}</div>
            </div>
          </div>
        ) : null}

        <div className="overflow-hidden rounded-md border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Project</TableHead>
                <TableHead>Pattern</TableHead>
                <TableHead>Logic</TableHead>
                <TableHead>Confidence</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && !payload ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-sm text-muted-foreground">
                    Loading attribution rules
                  </TableCell>
                </TableRow>
              ) : error ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-sm text-muted-foreground">
                    Attribution rules failed to load. Refresh to retry.
                  </TableCell>
                </TableRow>
              ) : filteredRules.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-sm text-muted-foreground">
                    No attribution rules match the current filters.
                  </TableCell>
                </TableRow>
              ) : (
                filteredRules.map((rule) => (
                  <TableRow key={rule.id}>
                    <TableCell className="align-top">
                      <div className="font-medium text-foreground">{rule.projectName}</div>
                      <div className="text-xs text-muted-foreground">
                        Updated {formatUpdatedAt(rule.updatedAt)}
                      </div>
                    </TableCell>
                    <TableCell className="max-w-sm align-top">
                      <div className="font-medium text-foreground">{rule.pattern}</div>
                      {rule.notes ? (
                        <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                          {rule.notes}
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell className="align-top">
                      <div className="text-sm text-foreground">
                        {RULE_TYPE_LABELS[rule.ruleType]}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Priority {rule.priority}
                      </div>
                    </TableCell>
                    <TableCell className="align-top text-sm text-foreground">
                      {formatConfidence(rule.confidence)}
                    </TableCell>
                    <TableCell className="align-top text-sm text-muted-foreground">
                      {rule.source}
                    </TableCell>
                    <TableCell className="align-top">
                      <StatusBadge
                        status={rule.status === "active" ? "Active" : "Inactive"}
                        variant={rule.status === "active" ? "success" : "neutral"}
                      />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  );
}
