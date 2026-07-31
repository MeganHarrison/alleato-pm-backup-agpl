"use client";
import { useCallback, useEffect, useState } from "react";

import Image from "next/image";

import { PageShell } from "@/components/layout";
import { EmptyState } from "@/components/ds";
import { CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { apiFetch } from "@/lib/api-client";

type Violation = {
  id: string;
  created_at: string;
  route: string;
  element_description: string | null;
  element_selector: string | null;
  violation_type: string;
  notes: string | null;
  screenshot_url: string | null;
  status: string;
  priority: string;
  fixed_in_file: string | null;
  fixed_at: string | null;
};

const TYPE_LABELS: Record<string, string> = {
  wrong_button: "Wrong button",
  bg_white: "bg-card",
  card_trap: "Card trap",
  wrong_text_hierarchy: "Text hierarchy",
  hardcoded_color: "Hardcoded color",
  arbitrary_spacing: "Arbitrary spacing",
  missing_token: "Missing token",
  wrong_component: "Wrong component",
  inconsistent_pattern: "Inconsistent pattern",
  other: "Other",
};

const STATUS_DOT: Record<string, string> = {
  open: "bg-red-500",
  in_progress: "bg-amber-500",
  fixed: "bg-green-500",
  wont_fix: "bg-zinc-400",
};

const FILTER_TABS = [
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In progress" },
  { value: "fixed", label: "Fixed" },
  { value: "wont_fix", label: "Won't fix" },
  { value: "all", label: "All" },
];

export default function DesignViolationsPage() {
  const [violations, setViolations] = useState<Violation[]>([]);
  const [filter, setFilter] = useState<string>("open");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Violation | null>(null);

  const fetchViolations = useCallback(async () => {
    setLoading(true);
    try {
      const status = filter === "all" ? "open,in_progress,fixed,wont_fix" : filter;
      const { violations: data } = await apiFetch<{ violations?: Violation[] }>(
        `/api/dev/violations?status=${status}`,
      );
      setViolations(data ?? []);
    } catch {
      // Keep previous state on error
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { fetchViolations(); }, [fetchViolations]);

  async function updateStatus(id: string, status: string) {
    await apiFetch("/api/dev/violations", {
      method: "PATCH",
      body: JSON.stringify({ id, status }),
    });
    setSelected(null);
    fetchViolations();
  }

  const stats = {
    open: violations.filter(v => v.status === "open").length,
    in_progress: violations.filter(v => v.status === "in_progress").length,
    fixed: violations.filter(v => v.status === "fixed").length,
  };

  return (
    <PageShell
      variant="table"
      title="Design Violations"
      description="Flagged design system violations — right-click any element in dev mode to flag"
      actions={
        <div className="flex items-center gap-3 text-sm">
          {stats.open > 0 && <span className="text-red-600 font-medium">{stats.open} open</span>}
          {stats.in_progress > 0 && <span className="text-amber-600 font-medium">{stats.in_progress} in progress</span>}
          {stats.fixed > 0 && <span className="text-green-600 font-medium">{stats.fixed} fixed</span>}
        </div>
      }
    >
      <Tabs value={filter} onValueChange={(v) => { setFilter(v); setSelected(null); }}>
        <TabsList>
          {FILTER_TABS.map(t => (
            <TabsTrigger key={t.value} value={t.value} className="text-xs">
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {loading && <p className="text-sm text-muted-foreground py-4">Loading...</p>}

      {!loading && violations.length === 0 && (
        <EmptyState
          icon={<CheckCircle />}
          title="No violations"
          description="Right-click any element in dev mode to flag a design violation."
        />
      )}

      {!loading && violations.length > 0 && (
        <div className="rounded-md border border-border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead className="w-4" />
                <TableHead>Type</TableHead>
                <TableHead>Route</TableHead>
                <TableHead className="max-w-80">Description</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="w-40">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {violations.map(v => (
                <>
                  <TableRow
                    key={v.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => setSelected(selected?.id === v.id ? null : v)}
                  >
                    <TableCell className="py-2">
                      <div className={`w-2 h-2 rounded-full ${STATUS_DOT[v.status] ?? "bg-zinc-400"}`} />
                    </TableCell>
                    <TableCell className="py-2 text-xs font-medium">
                      {TYPE_LABELS[v.violation_type] ?? v.violation_type}
                    </TableCell>
                    <TableCell className="py-2">
                      <span className="font-mono text-[11px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                        {v.route}
                      </span>
                    </TableCell>
                    <TableCell className="py-2 text-xs text-muted-foreground max-w-80 truncate">
                      {v.element_description ?? v.notes ?? "—"}
                    </TableCell>
                    <TableCell className="py-2">
                      {v.priority === "high" && (
                        <span className="text-[10px] text-red-600 font-semibold">HIGH</span>
                      )}
                    </TableCell>
                    <TableCell className="py-2 text-[11px] text-muted-foreground">
                      {new Date(v.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="py-2">
                      <div className="flex items-center gap-1.5">
                        {v.status === "open" && (
                          <>
                            <Button size="xs" variant="outline" onClick={(e) => { e.stopPropagation(); updateStatus(v.id, "in_progress"); }}>
                              Start
                            </Button>
                            <Button size="xs" variant="ghost" onClick={(e) => { e.stopPropagation(); updateStatus(v.id, "wont_fix"); }}>
                              Skip
                            </Button>
                          </>
                        )}
                        {v.status === "in_progress" && (
                          <Button size="xs" onClick={(e) => { e.stopPropagation(); updateStatus(v.id, "fixed"); }}>
                            Mark fixed
                          </Button>
                        )}
                        {(v.status === "fixed" || v.status === "wont_fix") && (
                          <Button size="xs" variant="outline" onClick={(e) => { e.stopPropagation(); updateStatus(v.id, "open"); }}>
                            Re-open
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                  {selected?.id === v.id && (
                    <TableRow key={`${v.id}-detail`}>
                      <TableCell colSpan={7} className="bg-muted/30 py-3 px-4">
                        <div className="space-y-2">
                          {v.element_selector && (
                            <div>
                              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Selector</p>
                              <code className="text-xs font-mono text-foreground bg-muted px-2 py-1 rounded block">
                                {v.element_selector}
                              </code>
                            </div>
                          )}
                          {v.notes && v.notes !== v.element_description && (
                            <p className="text-xs text-foreground italic">"{v.notes}"</p>
                          )}
                          {v.screenshot_url && (
                            <div className="relative h-40 rounded border border-border overflow-hidden">
                              <Image src={v.screenshot_url} alt="Screenshot" fill className="object-cover" />
                            </div>
                          )}
                          {v.fixed_in_file && (
                            <p className="text-xs font-mono text-muted-foreground">Fixed in: {v.fixed_in_file}</p>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </PageShell>
  );
}
