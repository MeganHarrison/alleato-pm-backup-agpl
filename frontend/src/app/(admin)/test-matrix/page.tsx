"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { apiFetch } from "@/lib/api-client";
import { PageShell } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalTitle,
  ModalFooter,
} from "@/components/ui/unified-modal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  CheckCircle2,
  XCircle,
  MinusCircle,
  Circle,
  ChevronLeft,
  ChevronRight,
  Camera,
  Plus,
  RotateCcw,
  Download,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

type TestStatus = "pass" | "fail" | "skip" | "not_tested";

interface TestCase {
  id: string;
  test_number: string;
  category: string;
  subcategory: string | null;
  test_name: string;
  steps: string | null;
  expected_result: string | null;
  priority: "HIGH" | "MEDIUM" | "LOW";
}

interface TestResult {
  id: string;
  status: TestStatus;
  notes: string | null;
  updated_at: string;
  test_cases: TestCase;
  test_screenshots: { id: string; public_url: string | null; label: string | null }[];
}

interface Run {
  id: string;
  run_date: string;
  tester: string | null;
  environment: string;
  branch: string | null;
  total: number;
  pass: number;
  fail: number;
  skip: number;
  not_tested: number;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const DEFAULT_SUITE = "photos";

const STATUS_CONFIG: Record<TestStatus, { label: string; color: string; icon: React.ElementType }> = {
  pass:       { label: "Pass",       color: "text-green-600",  icon: CheckCircle2 },
  fail:       { label: "Fail",       color: "text-red-500",    icon: XCircle },
  skip:       { label: "Skip",       color: "text-zinc-400",   icon: MinusCircle },
  not_tested: { label: "Not tested", color: "text-zinc-300",   icon: Circle },
};

const PRIORITY_BADGE: Record<string, string> = {
  HIGH:   "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400",
  MEDIUM: "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400",
  LOW:    "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function groupByCategory(results: TestResult[]) {
  const groups: Record<string, TestResult[]> = {};
  for (const r of results) {
    const cat = r.test_cases?.category ?? "Other";
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(r);
  }
  return groups;
}

function calcStats(results: TestResult[]) {
  const counts = { pass: 0, fail: 0, skip: 0, not_tested: 0 };
  for (const r of results) counts[r.status]++;
  const tested = counts.pass + counts.fail + counts.skip;
  const pct = results.length > 0 ? Math.round((tested / results.length) * 100) : 0;
  return { ...counts, total: results.length, tested, pct };
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function TestingPage() {
  // Suite (from ?suite=... URL param, defaults to photos for back-compat)
  const searchParams = useSearchParams()!;
  const SUITE = searchParams.get("suite") ?? DEFAULT_SUITE;

  // Run management
  const [runs, setRuns] = useState<Run[]>([]);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [results, setResults] = useState<TestResult[]>([]);
  const [cursor, setCursor] = useState(0);
  const [loading, setLoading] = useState(false);
  const [newRunOpen, setNewRunOpen] = useState(false);
  const [newRunForm, setNewRunForm] = useState({ tester: "", environment: "localhost:3000", branch: "", notes: "" });

  // Quick-mark state
  const [savingId, setSavingId] = useState<string | null>(null);
  const [notesDraft, setNotesDraft] = useState("");
  const [showNotes, setShowNotes] = useState(false);
  const [filterStatus, setFilterStatus] = useState<TestStatus | "all">("all");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Load runs list ──
  const loadRuns = useCallback(async () => {
    try {
      const data = await apiFetch<{ runs?: Run[] }>(`/api/testing/runs?suite=${SUITE}`);
      setRuns(data.runs ?? []);
      // Auto-select most recent run
      if (!activeRunId && data.runs && data.runs.length > 0) {
        setActiveRunId(data.runs[0].id);
      }
    } catch {
      // Keep previous state on error
    }
  }, [activeRunId, SUITE]);

  // Reset selection when suite changes via URL
  useEffect(() => {
    setActiveRunId(null);
    setResults([]);
    setCursor(0);
  }, [SUITE]);

  useEffect(() => { loadRuns(); }, [loadRuns]);

  // ── Load results for active run ──
  useEffect(() => {
    if (!activeRunId) return;
    setLoading(true);
    apiFetch<{ results?: TestResult[] }>(`/api/testing/runs/${activeRunId}/results`)
      .then((data) => {
        setResults(data.results ?? []);
        setCursor(0);
        setNotesDraft("");
      })
      .catch(() => {
        // Keep previous state on error
      })
      .finally(() => setLoading(false));
  }, [activeRunId]);

  // ── Sync notes draft when cursor changes ──
  useEffect(() => {
    const cur = filteredResults[cursor];
    setNotesDraft(cur?.notes ?? "");
    setShowNotes(false);
   
  }, [cursor, activeRunId]);

  // ── Filtered view ──
  const filteredResults = filterStatus === "all"
    ? results
    : results.filter((r) => r.status === filterStatus);

  const current = filteredResults[cursor] ?? null;
  const stats = calcStats(results);

  // ── Mark result ──
  const markResult = useCallback(async (status: TestStatus) => {
    if (!current) return;
    setSavingId(current.id);
    try {
      const { result } = await apiFetch<{ result: TestResult }>(
        `/api/testing/runs/${activeRunId}/results/${current.id}`,
        {
          method: "PATCH",
          body: JSON.stringify({ status, notes: notesDraft || null }),
        },
      );
      setResults((prev) =>
        prev.map((r) => r.id === current.id ? { ...r, status: result.status, notes: result.notes } : r)
      );
      // Auto-advance to next not_tested
      const next = filteredResults.findIndex((r, i) => i > cursor && r.status === "not_tested");
      if (next !== -1) setCursor(next);
      else if (cursor < filteredResults.length - 1) setCursor(cursor + 1);
    } catch {
      // Keep current result on error
    }
    setSavingId(null);
  }, [current, activeRunId, notesDraft, cursor, filteredResults]);

  // ── Save notes only ──
  const saveNotes = useCallback(async () => {
    if (!current || notesDraft === (current.notes ?? "")) return;
    await apiFetch(
      `/api/testing/runs/${activeRunId}/results/${current.id}`,
      {
        method: "PATCH",
        body: JSON.stringify({ notes: notesDraft || null }),
      },
    );
    setResults((prev) =>
      prev.map((r) => r.id === current.id ? { ...r, notes: notesDraft || null } : r)
    );
  }, [current, activeRunId, notesDraft]);

  // ── Keyboard shortcuts ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (!current || !activeRunId) return;
      switch (e.key.toLowerCase()) {
        case "p": markResult("pass"); break;
        case "f": markResult("fail"); break;
        case "s": markResult("skip"); break;
        case "arrowright":
        case "n": setCursor((c) => Math.min(c + 1, filteredResults.length - 1)); break;
        case "arrowleft":
        case "b": setCursor((c) => Math.max(c - 1, 0)); break;
        case "c": setShowNotes((v) => !v); break;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [current, activeRunId, markResult, filteredResults.length]);

  // ── Screenshot upload ──
  const handleScreenshot = useCallback(async (file: File) => {
    if (!current || !activeRunId) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      try {
        const { screenshot } = await apiFetch<{ screenshot: TestResult["test_screenshots"][number] }>(
          `/api/testing/runs/${activeRunId}/results/${current.id}/screenshots`,
          {
            method: "POST",
            body: JSON.stringify({ dataUrl, label: file.name }),
          },
        );
        setResults((prev) =>
          prev.map((r) =>
            r.id === current.id
              ? { ...r, test_screenshots: [...r.test_screenshots, screenshot] }
              : r
          )
        );
      } catch {
        // Screenshot upload failed; preserve state
      }
    };
    reader.readAsDataURL(file);
  }, [current, activeRunId]);

  // ── Create new run ──
  const createRun = async () => {
    try {
      const { run_id } = await apiFetch<{ run_id: string }>("/api/testing/runs", {
        method: "POST",
        body: JSON.stringify({ suite: SUITE, ...newRunForm }),
      });
      setNewRunOpen(false);
      setNewRunForm({ tester: "", environment: "localhost:3000", branch: "", notes: "" });
      await loadRuns();
      setActiveRunId(run_id);
    } catch {
      // Failed to create run; keep dialog open
    }
  };

  // ── Export CSV ──
  const exportCsv = () => {
    const rows = [
      ["#", "Category", "Subcategory", "Test", "Priority", "Status", "Notes"],
      ...results.map((r) => [
        r.test_cases?.test_number,
        r.test_cases?.category,
        r.test_cases?.subcategory ?? "",
        r.test_cases?.test_name,
        r.test_cases?.priority,
        r.status,
        (r.notes ?? "").replace(/,/g, ";"),
      ]),
    ];
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `photos-test-results-${activeRunId?.slice(0, 8)}.csv`;
    a.click();
  };

  const grouped = groupByCategory(filteredResults);

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <PageShell variant="content" title="Test Runner — Photos">
      <div className="flex h-[calc(100vh-8rem)] gap-0 overflow-hidden">

        {/* ── LEFT SIDEBAR: run list + case navigator ── */}
        <aside className="w-72 shrink-0 border-r border-border flex flex-col overflow-hidden bg-card">
          {/* Run selector */}
          <div className="p-3 border-b border-border space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Test Runs</span>
              <Button size="sm" variant="ghost" className="h-6 px-2 gap-1" onClick={() => setNewRunOpen(true)}>
                <Plus className="h-3 w-3" /> New
              </Button>
            </div>
            <div className="space-y-1 max-h-36 overflow-y-auto">
              {runs.map((run) => (
                <Button
                  key={run.id}
                  variant="ghost"
                  onClick={() => setActiveRunId(run.id)}
                  className={cn(
                    "w-full justify-start px-2 py-1.5 h-auto text-xs",
                    activeRunId === run.id
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground"
                  )}
                >
                  <div className="text-left w-full">
                    <div className="font-medium truncate">
                      {new Date(run.run_date).toLocaleDateString()} · {run.environment}
                    </div>
                    <div className="flex gap-2 mt-0.5 opacity-80">
                      <span className="text-status-success">✓{run.pass}</span>
                      <span className="text-destructive">✗{run.fail}</span>
                      <span className="text-muted-foreground">–{run.skip}</span>
                      <span>○{run.not_tested}</span>
                    </div>
                  </div>
                </Button>
              ))}
              {runs.length === 0 && (
                <p className="text-xs text-muted-foreground px-2 py-2">No runs yet. Create one →</p>
              )}
            </div>
          </div>

          {/* Filter tabs */}
          <div className="flex border-b border-border">
            {(["all", "not_tested", "fail", "pass", "skip"] as const).map((f) => (
              <Button
                key={f}
                variant="ghost"
                onClick={() => { setFilterStatus(f); setCursor(0); }}
                className={cn(
                  "flex-1 py-1.5 h-auto text-[10px] font-medium transition-colors rounded-none",
                  filterStatus === f
                    ? "border-b-2 border-primary text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {f === "not_tested" ? "TODO" : f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}
              </Button>
            ))}
          </div>

          {/* Case list grouped by category */}
          <div className="flex-1 overflow-y-auto text-xs">
            {Object.entries(grouped).map(([cat, catResults]) => (
              <div key={cat}>
                <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground bg-muted/50 sticky top-0">
                  {cat}
                </div>
                {catResults.map((r, idx) => {
                  const globalIdx = filteredResults.indexOf(r);
                  const Icon = STATUS_CONFIG[r.status].icon;
                  return (
                    <Button
                      key={r.id}
                      variant="ghost"
                      onClick={() => setCursor(globalIdx)}
                      className={cn(
                        "w-full justify-start text-left items-start gap-2 px-3 py-1.5 h-auto transition-colors rounded-none",
                        globalIdx === cursor
                          ? "bg-primary/10 text-foreground"
                          : "text-muted-foreground"
                      )}
                    >
                      <Icon className={cn("h-3 w-3 mt-0.5 shrink-0", STATUS_CONFIG[r.status].color)} />
                      <span className="truncate leading-snug">
                        <span className="text-[10px] opacity-60 mr-1">{r.test_cases?.test_number}</span>
                        {r.test_cases?.test_name}
                      </span>
                    </Button>
                  );
                })}
              </div>
            ))}
          </div>

          {/* Bottom: export */}
          {activeRunId && results.length > 0 && (
            <div className="p-2 border-t border-border">
              <Button size="sm" variant="ghost" className="w-full gap-1.5 text-xs" onClick={exportCsv}>
                <Download className="h-3 w-3" /> Export CSV
              </Button>
            </div>
          )}
        </aside>

        {/* ── MAIN PANEL ── */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {!activeRunId ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center space-y-3">
                <p className="text-muted-foreground">No run selected</p>
                <Button onClick={() => setNewRunOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" /> Start New Run
                </Button>
              </div>
            </div>
          ) : loading ? (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-muted-foreground text-sm">Loading…</p>
            </div>
          ) : !current ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center space-y-2">
                <CheckCircle2 className="h-10 w-10 text-status-success mx-auto" />
                <p className="font-medium">All done!</p>
                <p className="text-sm text-muted-foreground">
                  {stats.pass} passed · {stats.fail} failed · {stats.skip} skipped
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Progress bar */}
              <div className="h-1 bg-muted">
                <div
                  className="h-full bg-primary transition-all duration-300"
                  style={{ width: `${stats.pct}%` }}
                />
              </div>

              {/* Header bar */}
              <div className="flex items-center justify-between px-6 py-3 border-b border-border">
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-muted-foreground">{cursor + 1} / {filteredResults.length}</span>
                  <span className="flex gap-3">
                    <span className="text-status-success font-medium">✓ {stats.pass}</span>
                    <span className="text-destructive font-medium">✗ {stats.fail}</span>
                    <span className="text-muted-foreground">– {stats.skip}</span>
                    <span className="text-muted-foreground/60">○ {stats.not_tested}</span>
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setCursor((c) => Math.max(c - 1, 0))} disabled={cursor === 0}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setCursor((c) => Math.min(c + 1, filteredResults.length - 1))} disabled={cursor === filteredResults.length - 1}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Test case detail */}
              <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
                {/* Title row */}
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs text-muted-foreground font-mono">{current.test_cases?.test_number}</span>
                      <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded", PRIORITY_BADGE[current.test_cases?.priority])}>
                        {current.test_cases?.priority}
                      </span>
                      <span className="text-xs text-muted-foreground">{current.test_cases?.category}{current.test_cases?.subcategory ? ` / ${current.test_cases.subcategory}` : ""}</span>
                    </div>
                    <h2 className="text-lg font-semibold leading-snug">{current.test_cases?.test_name}</h2>
                  </div>
                  {/* Current status indicator */}
                  <div className={cn("flex items-center gap-1.5 text-sm font-medium shrink-0", STATUS_CONFIG[current.status].color)}>
                    {(() => { const Icon = STATUS_CONFIG[current.status].icon; return <Icon className="h-4 w-4" />; })()}
                    {STATUS_CONFIG[current.status].label}
                  </div>
                </div>

                {/* Steps */}
                {current.test_cases?.steps && (
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Steps</h3>
                    <ol className="space-y-1.5">
                      {current.test_cases.steps.split("\n").filter(Boolean).map((step, i) => (
                        <li key={i} className="flex gap-3 text-sm">
                          <span className="shrink-0 w-5 h-5 rounded-full bg-muted text-muted-foreground text-[11px] flex items-center justify-center font-medium">
                            {i + 1}
                          </span>
                          <span className="leading-snug pt-0.5">{step.replace(/^\d+\.\s*/, "")}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}

                {/* Expected result */}
                {current.test_cases?.expected_result && (
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Expected Result</h3>
                    <p className="text-sm text-foreground leading-relaxed bg-muted/40 rounded px-3 py-2">
                      {current.test_cases.expected_result}
                    </p>
                  </div>
                )}

                {/* Notes */}
                <div>
                  <Button
                    type="button"
                    variant="ghost"
                    className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1 hover:text-foreground transition-colors h-auto p-0"
                    onClick={() => setShowNotes((v) => !v)}
                  >
                    Notes {notesDraft ? "●" : ""} <span className="text-[10px] opacity-60">(C)</span>
                  </Button>
                  {showNotes && (
                    <Textarea
                      value={notesDraft}
                      onChange={(e) => setNotesDraft(e.target.value)}
                      onBlur={saveNotes}
                      placeholder="Add notes, bug description, or ticket link…"
                      className="text-sm resize-none h-20"
                      autoFocus
                    />
                  )}
                </div>

                {/* Screenshots */}
                {current.test_screenshots.length > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Screenshots</h3>
                    <div className="flex flex-wrap gap-2">
                      {current.test_screenshots.map((s) => (
                        <a key={s.id} href={s.public_url ?? "#"} target="_blank" rel="noopener noreferrer">
                          <img
                            src={s.public_url ?? ""}
                            alt={s.label ?? "screenshot"}
                            className="h-20 w-auto rounded border border-border object-cover hover:opacity-80 transition-opacity"
                          />
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* ── Action bar ── */}
              <div className="border-t border-border px-6 py-4">
                <div className="flex items-center justify-between">
                  {/* Mark buttons */}
                  <div className="flex items-center gap-2">
                    <Button
                      onClick={() => markResult("pass")}
                      disabled={!!savingId}
                      className="gap-2 bg-status-success hover:bg-status-success/90 text-primary-foreground"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      Pass
                      <kbd className="ml-1 text-[10px] opacity-70 bg-foreground/20 rounded px-1">P</kbd>
                    </Button>
                    <Button
                      onClick={() => markResult("fail")}
                      disabled={!!savingId}
                      variant="destructive"
                      className="gap-2"
                    >
                      <XCircle className="h-4 w-4" />
                      Fail
                      <kbd className="ml-1 text-[10px] opacity-70 bg-foreground/20 rounded px-1">F</kbd>
                    </Button>
                    <Button
                      onClick={() => markResult("skip")}
                      disabled={!!savingId}
                      variant="outline"
                      className="gap-2"
                    >
                      <MinusCircle className="h-4 w-4" />
                      Skip
                      <kbd className="ml-1 text-[10px] opacity-70 bg-muted rounded px-1">S</kbd>
                    </Button>
                  </div>

                  {/* Utility buttons */}
                  <div className="flex items-center gap-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) handleScreenshot(f); e.target.value = ""; }}
                    />
                    <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => fileInputRef.current?.click()}>
                      <Camera className="h-4 w-4" />
                      Screenshot
                    </Button>
                    <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => markResult("not_tested")}>
                      <RotateCcw className="h-3.5 w-3.5" />
                      Reset
                    </Button>
                  </div>
                </div>

                {/* Keyboard hint */}
                <p className="text-[10px] text-muted-foreground mt-2 text-center">
                  ← → navigate · P pass · F fail · S skip · C notes
                </p>
              </div>
            </>
          )}
        </main>
      </div>

      {/* ── New Run Dialog ── */}
      <Modal open={newRunOpen} onOpenChange={setNewRunOpen}>
        <ModalContent className="sm:max-w-md">
          <ModalHeader>
            <ModalTitle>Start New Test Run — Photos</ModalTitle>
          </ModalHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Tester</Label>
              <Input
                value={newRunForm.tester}
                onChange={(e) => setNewRunForm((f) => ({ ...f, tester: e.target.value }))}
                placeholder="Your name"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Environment</Label>
              <Input
                value={newRunForm.environment}
                onChange={(e) => setNewRunForm((f) => ({ ...f, environment: e.target.value }))}
                placeholder="localhost:3000"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Branch</Label>
              <Input
                value={newRunForm.branch}
                onChange={(e) => setNewRunForm((f) => ({ ...f, branch: e.target.value }))}
                placeholder="main"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea
                value={newRunForm.notes}
                onChange={(e) => setNewRunForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="Optional notes about this run…"
                className="resize-none h-20"
              />
            </div>
          </div>
          <ModalFooter>
            <Button variant="outline" onClick={() => setNewRunOpen(false)}>Cancel</Button>
            <Button onClick={createRun}>Start Run</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </PageShell>
  );
}
