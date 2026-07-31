"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ErrorState } from "@/components/ds/error-state";
import { apiFetch } from "@/lib/api-client";
import { PsrSummaryCard } from "@/components/domain/psr/PsrSummaryCard";
import { PsrBudgetTable } from "@/components/domain/psr/PsrBudgetTable";
import { PsrSubmittalsSection } from "@/components/domain/psr/PsrSubmittalsSection";
import { PsrRfisSection } from "@/components/domain/psr/PsrRfisSection";
import { PsrChangeRequestsSection } from "@/components/domain/psr/PsrChangeRequestsSection";
import { PsrChangeOrdersSection } from "@/components/domain/psr/PsrChangeOrdersSection";
import { PsrScheduleSection } from "@/components/domain/psr/PsrScheduleSection";
import { PsrCommentEditor } from "@/components/domain/psr/PsrCommentEditor";
import type { PsrApiResponse } from "@/types/psr.types";
import { Download, ChevronDown, ChevronUp } from "lucide-react";
import { SectionRuleHeading } from "@/components/layout/spacing";

interface PsrClientProps {
  projectId: string;
  initialData: PsrApiResponse;
  initialMonth: string;
}

/** Generates the list of the last 12 YYYY-MM month strings for the picker. */
function getRecentMonths(count = 12): { value: string; label: string }[] {
  const months = [];
  const now = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleString("en-US", { month: "long", year: "numeric" });
    months.push({ value, label });
  }
  return months;
}

interface SectionProps {
  title: string;
  children: React.ReactNode;
  defaultExpanded?: boolean;
}

function Section({ title, children, defaultExpanded = true }: SectionProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  return (
    <div className="space-y-4">
      <Button
        variant="ghost"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-0 text-left hover:bg-transparent"
      >
        <SectionRuleHeading label={title} className="mb-0" />
        {expanded ? (
          <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        )}
      </Button>
      {expanded && <div>{children}</div>}
    </div>
  );
}

export function PsrClient({ projectId, initialData, initialMonth }: PsrClientProps) {
  const [month, setMonth] = useState(initialMonth);
  const [data, setData] = useState<PsrApiResponse>(initialData);
  const [isPending, startTransition] = useTransition();
  const [fetchError, setFetchError] = useState<string | null>(null);

  const months = getRecentMonths(12);

  function handleMonthChange(newMonth: string) {
    setMonth(newMonth);
    setFetchError(null);
    startTransition(async () => {
      try {
        const fresh = await apiFetch<PsrApiResponse>(
          `/api/projects/${projectId}/psr?month=${newMonth}`,
        );
        if (fresh) setData(fresh);
      } catch (err) {
        setFetchError(
          err instanceof Error ? err.message : "Failed to load PSR data.",
        );
      }
    });
  }

  // Find saved comments for a section
  function getComment(section: string): string {
    return data.comments.find((c) => c.section === section)?.body ?? "";
  }

  return (
    <div className="space-y-8">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">
            Month:
          </span>
          <Select
            value={month}
            onValueChange={handleMonthChange}
            disabled={isPending}
          >
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {months.map((m) => (
                <SelectItem key={m.value} value={m.value}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {isPending && (
            <span className="text-xs text-muted-foreground">Loading…</span>
          )}
        </div>

        <a
          href={`/api/projects/${projectId}/psr/export?month=${month}`}
          download={`PSR-${projectId}-${month}.pdf`}
          className="inline-flex items-center gap-2"
        >
          <Button variant="outline" size="sm">
            <Download className="h-3.5 w-3.5" />
            Export PDF
          </Button>
        </a>
      </div>

      {fetchError && (
        <ErrorState error={fetchError} />
      )}

      {/* ── Section 1: Project Summary ── */}
      <Section title="1 · Project Information">
        <PsrSummaryCard
          projectInfo={data.projectInfo}
          openItems={data.openItems}
          monthlyBilling={data.monthlyBilling}
          month={month}
        />
        <div className="mt-4">
          <p className="mb-1 text-xs font-medium text-muted-foreground uppercase tracking-widest">
            Comments
          </p>
          <PsrCommentEditor
            projectId={projectId}
            month={month}
            section="general"
            initialBody={getComment("general")}
          />
        </div>
      </Section>

      <hr className="border-border" />

      {/* ── Section 2: Budget Detail ── */}
      <Section title="2 · Budget Detail">
        <PsrBudgetTable
          budgetLines={data.budgetLines}
          grandTotals={data.budgetGrandTotals}
        />
      </Section>

      <hr className="border-border" />

      {/* ── Section 3: Submittals ── */}
      <Section title="3 · Submittals">
        <PsrSubmittalsSection submittals={data.submittals} />
        <div className="mt-4">
          <PsrCommentEditor
            projectId={projectId}
            month={month}
            section="submittals"
            initialBody={getComment("submittals")}
          />
        </div>
      </Section>

      <hr className="border-border" />

      {/* ── Section 4: RFIs ── */}
      <Section title="4 · RFIs">
        <PsrRfisSection rfis={data.rfis} />
        <div className="mt-4">
          <PsrCommentEditor
            projectId={projectId}
            month={month}
            section="rfis"
            initialBody={getComment("rfis")}
          />
        </div>
      </Section>

      <hr className="border-border" />

      {/* ── Section 5: Change Requests ── */}
      <Section title="5 · Change Requests">
        <PsrChangeRequestsSection changeRequests={data.changeRequests} />
        <div className="mt-4">
          <PsrCommentEditor
            projectId={projectId}
            month={month}
            section="change_requests"
            initialBody={getComment("change_requests")}
          />
        </div>
      </Section>

      <hr className="border-border" />

      {/* ── Section 6: Contract Change Orders (PCCOs) ── */}
      <Section title="6 · Contract Change Orders (PCCOs)">
        <PsrChangeOrdersSection changeOrders={data.changeOrders} />
        <div className="mt-4">
          <PsrCommentEditor
            projectId={projectId}
            month={month}
            section="change_orders"
            initialBody={getComment("change_orders")}
          />
        </div>
      </Section>

      <hr className="border-border" />

      {/* ── Section 7: Schedule ── */}
      <Section title="7 · Schedule">
        <PsrScheduleSection scheduleTasks={data.scheduleTasks} />
        <div className="mt-4">
          <PsrCommentEditor
            projectId={projectId}
            month={month}
            section="schedule"
            initialBody={getComment("schedule")}
          />
        </div>
      </Section>
    </div>
  );
}
