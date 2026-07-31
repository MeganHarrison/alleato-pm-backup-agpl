"use client";

import { Fragment, useState, useEffect, useRef, useCallback } from "react";
import {
  Play,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Terminal,
  TrendingUp,
  TrendingDown,
  Minus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageContainer } from "@/components/layout";
import { PageHeader } from "@/components/layout/page-header-unified";
import { InfoAlert } from "@/components/ds/InfoAlert";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api-client";

// ── Types ────────────────────────────────────────────────────────────────────

interface L1Summary {
  total: number;
  pass_rate: number;
  source_match_rate: number;
  keyword_match_rate: number;
  mrr: number;
  avg_top_similarity: number;
  avg_latency_ms: number;
}

interface L1Question {
  id: number;
  question: string;
  category: string;
  passed: boolean;
  num_results: number;
  top_similarity: number;
  mrr: number;
  source_types_found: string[];
  latency_ms: number;
}

interface L1Data {
  timestamp: string;
  summary: L1Summary;
  per_question: L1Question[];
}

interface L2Scores {
  specificity: number;
  accuracy: number;
  completeness: number;
  actionability: number;
  overall: number;
  explanation: string;
}

interface L2Question {
  id: number;
  question: string;
  category: string;
  good_answer_criteria: string;
  generated_answer: string;
  scores: L2Scores;
  chunk_sources: string[];
  top_similarity: number;
  error: string | null;
}

interface L2CategoryAvg {
  count: number;
  specificity: number;
  accuracy: number;
  completeness: number;
  actionability: number;
  overall: number;
}

interface L2Summary {
  specificity: number;
  accuracy: number;
  completeness: number;
  actionability: number;
  overall: number;
}

interface L2Data {
  timestamp: string;
  summary: L2Summary;
  category_averages: Record<string, L2CategoryAvg>;
  questions: L2Question[];
}

interface EvalResults {
  l1: { data: L1Data | null; file: string | null };
  l2: { data: L2Data | null; file: string | null };
  assistant?: { runs: AssistantEvalRun[] };
}

interface AssistantEvalCase {
  id: string;
  prompt: string;
  intent: string | null;
  status: string;
  durationMs: number | null;
  streamEventCount: number | null;
  toolNames: string[];
  failures: string[];
  warnings: string[];
  observations: string[];
  finalText: string;
  latencyBudget: {
    warnDurationMs: number | null;
    maxDurationMs: number | null;
    durationMs: number | null;
  } | null;
}

interface AssistantEvalRun {
  runId: string;
  generatedAt: string | null;
  baseUrl: string | null;
  bundle: string | null;
  filter: string | null;
  totalCases: number;
  passed: number;
  failed: number;
  warningCount: number;
  slowestCases: Array<{
    id: string;
    intent: string | null;
    durationMs: number | null;
    status: string;
    warnings: string[];
  }>;
  cases: AssistantEvalCase[];
}

type EvalType = "l1" | "l2" | "reranker" | "coverage" | "e2e";

type RunState = "idle" | "running" | "done" | "error";

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number, decimals = 3) {
  return n.toFixed(decimals);
}

function pct(n: number) {
  return `${(n * 100).toFixed(0)}%`;
}

function durationLabel(durationMs: number | null) {
  return durationMs == null ? "—" : `${(durationMs / 1000).toFixed(1)}s`;
}

function durationTone(testCase: AssistantEvalCase) {
  const durationMs = testCase.durationMs;
  if (durationMs == null) return "text-muted-foreground";
  const warnDurationMs = testCase.latencyBudget?.warnDurationMs;
  const maxDurationMs = testCase.latencyBudget?.maxDurationMs;
  if (maxDurationMs && durationMs > maxDurationMs) return "text-red-600";
  if (warnDurationMs && durationMs > warnDurationMs) return "text-yellow-700";
  return "text-muted-foreground";
}

function Delta({ value, invert = false }: { value: number; invert?: boolean }) {
  const positive = invert ? value < 0 : value > 0;
  const negative = invert ? value > 0 : value < 0;
  const abs = Math.abs(value);
  if (abs < 0.001) return <Minus className="inline h-3 w-3 text-muted-foreground" />;
  return (
    <span className={cn("inline-flex items-center gap-0.5 text-xs font-medium", positive ? "text-green-600" : "text-red-500")}>
      {positive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {positive ? "+" : ""}{value.toFixed(3)}
    </span>
  );
}

function ScoreBadge({ score, max = 5 }: { score: number; max?: number }) {
  const ratio = score / max;
  return (
    <span className={cn(
      "inline-flex items-center justify-center w-8 h-6 rounded text-xs font-semibold tabular-nums",
      ratio >= 0.8 ? "bg-green-50 text-green-700" :
      ratio >= 0.6 ? "bg-yellow-50 text-yellow-700" :
      "bg-red-50 text-red-600"
    )}>
      {score}
    </span>
  );
}

// ── Log panel ────────────────────────────────────────────────────────────────

function LogPanel({ lines, runState }: { lines: string[]; runState: RunState }) {
  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lines]);

  return (
    <div className="mt-3 bg-zinc-950 font-mono text-xs overflow-auto max-h-64">
      <div className="flex items-center gap-2 px-3 py-2 text-zinc-400">
        <Terminal className="h-3.5 w-3.5" />
        <span>Output</span>
        {runState === "running" && (
          <span className="ml-auto flex items-center gap-1 text-yellow-400">
            <span className="animate-pulse">●</span> running
          </span>
        )}
        {runState === "done" && <span className="ml-auto text-green-400">✓ done</span>}
        {runState === "error" && <span className="ml-auto text-red-400">✗ error</span>}
      </div>
      <div className="p-3 space-y-0.5">
        {lines.map((line, i) => (
          <div key={i} className="text-zinc-300 leading-5 whitespace-pre-wrap break-all">{line}</div>
        ))}
        {runState === "running" && (
          <div className="text-zinc-500 animate-pulse">▌</div>
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}

// ── Run card ─────────────────────────────────────────────────────────────────

const EVAL_META: Record<EvalType, { label: string; description: string; time: string }> = {
  l1:       { label: "L1 Retrieval",      description: "MRR, pass rate, source type match",             time: "~2 min" },
  l2:       { label: "L2 Answer Quality", description: "LLM judge on 5 dimensions — costs ~$0.50",      time: "~5 min" },
  reranker: { label: "Reranker A/B",      description: "With vs. without LLM reranker (MRR delta)",     time: "~4 min" },
  coverage: { label: "Source Coverage",   description: "Chunk counts by source type — no LLM calls",    time: "~15 sec" },
  e2e:      { label: "L3 End-to-End",     description: "SQL tools + vector — fixes financial score",    time: "~6 min" },
};

function RunCard({ type, onComplete }: { type: EvalType; onComplete: () => void }) {
  const [state, setState] = useState<RunState>("idle");
  const [lines, setLines] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const meta = EVAL_META[type];

  const run = useCallback(async () => {
    setState("running");
    setLines([]);
    setOpen(true);

    try {
      const res = await fetch("/api/admin/rag-eval/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type }),
      });

      if (!res.ok || !res.body) {
        setState("error");
        setLines(["Error: " + (await res.text())]);
        return;
      }

      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += dec.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";

        for (const part of parts) {
          const eventMatch = part.match(/^event: (\w+)/m);
          const dataMatch = part.match(/^data: (.+)$/m);
          if (!dataMatch) continue;

          const eventType = eventMatch?.[1] ?? "log";
          const payload = JSON.parse(dataMatch[1]);

          if (eventType === "log" && payload.line) {
            setLines((prev) => [...prev, payload.line]);
          } else if (eventType === "complete") {
            setState(payload.success ? "done" : "error");
            if (payload.success) onComplete();
          } else if (eventType === "error") {
            setState("error");
            setLines((prev) => [...prev, `ERROR: ${payload.message}`]);
          }
        }
      }
    } catch (err) {
      setState("error");
      setLines((prev) => [...prev, String(err)]);
    }
  }, [type, onComplete]);

  return (
    <div className="rounded-lg bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm">{meta.label}</span>
            <Badge variant="outline" className="text-xs">{meta.time}</Badge>
            {state === "done" && <CheckCircle2 className="h-4 w-4 text-green-500" />}
            {state === "error" && <XCircle className="h-4 w-4 text-red-500" />}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{meta.description}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {lines.length > 0 && (
            <Button variant="ghost" size="sm" onClick={() => setOpen((o) => !o)} className="h-7 px-2">
              {open ? <ChevronDown /> : <ChevronRight />}
            </Button>
          )}
          <Button
            size="sm"
            variant={state === "done" ? "outline" : "default"}
            disabled={state === "running"}
            onClick={run}
            className="h-7 gap-1.5"
          >
            {state === "running" ? (
              <RefreshCw className="animate-spin" />
            ) : (
              <Play />
            )}
            {state === "running" ? "Running…" : state === "done" ? "Re-run" : "Run"}
          </Button>
        </div>
      </div>
      {open && lines.length > 0 && <LogPanel lines={lines} runState={state} />}
    </div>
  );
}

// ── L1 results panel ──────────────────────────────────────────────────────────

function L1Panel({ data, file }: { data: L1Data; file: string | null }) {
  const [expanded, setExpanded] = useState<number | null>(null);
  const s = data.summary;

  const categories = [...new Set(data.per_question.map((q) => q.category))].sort();

  return (
    <div className="space-y-4">
      {/* Summary KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Pass rate", value: pct(s.pass_rate), good: s.pass_rate >= 0.8 },
          { label: "MRR",       value: fmt(s.mrr),       good: s.mrr >= 0.9 },
          { label: "Avg sim",   value: fmt(s.avg_top_similarity), good: s.avg_top_similarity >= 0.55 },
          { label: "Avg latency", value: `${s.avg_latency_ms.toFixed(0)}ms`, good: s.avg_latency_ms < 3000 },
        ].map((kpi) => (
          <div key={kpi.label} className="rounded-md bg-muted/40 p-3">
            <p className="text-xs text-muted-foreground">{kpi.label}</p>
            <p className={cn("text-xl font-semibold tabular-nums mt-0.5", kpi.good ? "text-foreground" : "text-yellow-600")}>{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Per-category */}
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">By category</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {categories.map((cat) => {
            const qs = data.per_question.filter((q) => q.category === cat);
            const passed = qs.filter((q) => q.passed).length;
            const mrr = qs.reduce((sum, q) => sum + q.mrr, 0) / qs.length;
            const allPass = passed === qs.length;
            const nonePass = passed === 0;
            return (
              <div key={cat} className="flex items-center justify-between rounded border border-border px-3 py-2 text-sm">
                <span className="text-muted-foreground capitalize">{cat.replace("_", " ")}</span>
                <div className="flex items-center gap-2">
                  <span className={cn("font-medium tabular-nums text-xs", allPass ? "text-green-600" : nonePass ? "text-red-500" : "text-yellow-600")}>
                    {passed}/{qs.length}
                  </span>
                  <span className="text-xs text-muted-foreground">MRR {fmt(mrr, 2)}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Per-question table */}
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">Per-question</p>
        <div className="rounded-md border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8">#</TableHead>
                <TableHead>Question</TableHead>
                <TableHead className="w-20">Category</TableHead>
                <TableHead className="w-16 text-right">Sim</TableHead>
                <TableHead className="w-14 text-right">MRR</TableHead>
                <TableHead className="w-14 text-center">Pass</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.per_question.map((q) => (
                <>
                  <TableRow
                    key={q.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => setExpanded(expanded === q.id ? null : q.id)}
                  >
                    <TableCell className="text-muted-foreground tabular-nums text-xs">{q.id}</TableCell>
                    <TableCell className="text-sm max-w-xs truncate">{q.question}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">{q.category}</Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-xs">{fmt(q.top_similarity)}</TableCell>
                    <TableCell className="text-right tabular-nums text-xs">{fmt(q.mrr)}</TableCell>
                    <TableCell className="text-center">
                      {q.passed
                        ? <CheckCircle2 className="h-4 w-4 text-green-500 mx-auto" />
                        : <XCircle className="h-4 w-4 text-red-400 mx-auto" />}
                    </TableCell>
                  </TableRow>
                  {expanded === q.id && (
                    <TableRow key={`${q.id}-detail`}>
                      <TableCell />
                      <TableCell colSpan={5} className="bg-muted/30 text-xs pb-3">
                        <p className="text-muted-foreground mb-1">Sources found:</p>
                        <div className="flex flex-wrap gap-1">
                          {q.source_types_found.map((s, i) => (
                            <Badge key={i} variant="secondary" className="text-xs">{s}</Badge>
                          ))}
                        </div>
                        <p className="text-muted-foreground mt-2">Latency: {q.latency_ms.toFixed(0)}ms</p>
                      </TableCell>
                    </TableRow>
                  )}
                </>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {file && <p className="text-xs text-muted-foreground">Source: {file}</p>}
    </div>
  );
}

// ── L2 results panel ──────────────────────────────────────────────────────────

const DIMS = ["overall", "specificity", "accuracy", "completeness", "actionability"] as const;

function L2Panel({ data, file }: { data: L2Data; file: string | null }) {
  const [expanded, setExpanded] = useState<number | null>(null);
  const s = data.summary;
  const cats = Object.entries(data.category_averages).sort((a, b) => b[1].overall - a[1].overall);

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
        {DIMS.map((d) => (
          <div key={d} className="rounded-md border border-border bg-muted/40 p-3">
            <p className="text-xs text-muted-foreground capitalize">{d}</p>
            <ScoreBadge score={s[d]} />
            <span className="text-xs text-muted-foreground ml-1">/ 5</span>
          </div>
        ))}
      </div>

      {/* Category table */}
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">By category</p>
        <div className="rounded-md border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Category</TableHead>
                <TableHead className="w-10 text-center">n</TableHead>
                {DIMS.map((d) => (
                  <TableHead key={d} className="w-16 text-center capitalize">{d === "actionability" ? "Action" : d === "completeness" ? "Compl" : d}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {cats.map(([cat, avg]) => (
                <TableRow key={cat} className={cat === "financial" ? "bg-amber-50/50" : ""}>
                  <TableCell className="capitalize font-medium text-sm">{cat.replace("_", " ")}</TableCell>
                  <TableCell className="text-center text-xs text-muted-foreground">{avg.count}</TableCell>
                  {DIMS.map((d) => (
                    <TableCell key={d} className="text-center">
                      <ScoreBadge score={avg[d]} />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {data.category_averages.financial && (
          <p className="text-xs text-amber-600 mt-1.5 flex items-center gap-1">
            <AlertTriangle className="h-3.5 w-3.5" />
            Financial score is artificially low — eval bypasses SQL tools. Run L3 End-to-End to see true score.
          </p>
        )}
      </div>

      {/* Per-question */}
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">Per-question</p>
        <div className="rounded-md border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8">#</TableHead>
                <TableHead>Question</TableHead>
                <TableHead className="w-20">Category</TableHead>
                {DIMS.map((d) => (
                  <TableHead key={d} className="w-12 text-center capitalize">{d === "actionability" ? "Act" : d === "completeness" ? "Cmp" : d === "specificity" ? "Spec" : d === "accuracy" ? "Acc" : "All"}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.questions.map((q) => (
                <>
                  <TableRow
                    key={q.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => setExpanded(expanded === q.id ? null : q.id)}
                  >
                    <TableCell className="text-muted-foreground tabular-nums text-xs">{q.id}</TableCell>
                    <TableCell className="text-sm max-w-xs truncate">{q.question}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">{q.category}</Badge>
                    </TableCell>
                    {DIMS.map((d) => (
                      <TableCell key={d} className="text-center">
                        <ScoreBadge score={q.scores[d]} />
                      </TableCell>
                    ))}
                  </TableRow>
                  {expanded === q.id && (
                    <TableRow key={`${q.id}-detail`}>
                      <TableCell />
                      <TableCell colSpan={6} className="bg-muted/30 text-xs pb-3 space-y-2">
                        <div>
                          <p className="font-medium text-foreground mb-0.5">Criteria</p>
                          <p className="text-muted-foreground">{q.good_answer_criteria}</p>
                        </div>
                        <div>
                          <p className="font-medium text-foreground mb-0.5">Generated answer</p>
                          <p className="text-muted-foreground leading-relaxed line-clamp-4">{q.generated_answer}</p>
                        </div>
                        <div>
                          <p className="font-medium text-foreground mb-0.5">Judge explanation</p>
                          <p className="text-muted-foreground">{q.scores.explanation}</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {file && <p className="text-xs text-muted-foreground">Source: {file}</p>}
    </div>
  );
}

// ── Assistant eval-suite panel ───────────────────────────────────────────────

function AssistantRunsPanel({ runs }: { runs: AssistantEvalRun[] }) {
  const [expandedRun, setExpandedRun] = useState<string | null>(runs[0]?.runId ?? null);
  const [expandedCase, setExpandedCase] = useState<string | null>(null);

  if (runs.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-8 text-center">
        <p className="text-muted-foreground text-sm">No AI assistant eval-suite runs found.</p>
        <p className="text-xs text-muted-foreground mt-1">
          Run <code className="bg-muted px-1 py-0.5 rounded">scripts/verify/verify_ai_assistant_eval_suite.mjs</code> to create results.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {runs.map((run) => {
        const isOpen = expandedRun === run.runId;
        const passRate = run.totalCases > 0 ? run.passed / run.totalCases : 0;
        return (
          <section key={run.runId} className="space-y-3 border-b border-border pb-4 last:border-0">
            <Button
              type="button"
              onClick={() => setExpandedRun(isOpen ? null : run.runId)}
              variant="ghost"
              className="h-auto w-full items-start justify-between gap-4 px-0 py-1 text-left hover:bg-transparent"
            >
              <div className="min-w-0 space-y-1">
                <div className="flex items-center gap-2">
                  {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  <span className="font-medium text-sm">{run.runId}</span>
                  <Badge variant={run.failed === 0 ? "default" : "destructive"} className="text-xs">
                    {run.passed}/{run.totalCases}
                  </Badge>
                  {run.warningCount > 0 && (
                    <Badge variant="secondary" className="gap-1 text-xs text-yellow-700">
                      <AlertTriangle className="h-3 w-3" />
                      {run.warningCount}
                    </Badge>
                  )}
                  <span className="text-xs text-muted-foreground">{pct(passRate)}</span>
                </div>
                <p className="text-xs text-muted-foreground truncate">
                  {run.baseUrl ?? "unknown endpoint"} · {run.bundle ?? run.filter ?? "full suite"}
                </p>
              </div>
              <p className="shrink-0 text-xs text-muted-foreground">
                {run.generatedAt ? new Date(run.generatedAt).toLocaleString() : "No generatedAt"}
              </p>
            </Button>

            {isOpen && (
              <div className="space-y-3 pl-6">
                {run.slowestCases.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-foreground">Slowest cases</p>
                    <div className="flex flex-wrap gap-2">
                      {run.slowestCases.slice(0, 5).map((slowCase) => (
                        <Badge
                          key={`${run.runId}:slow:${slowCase.id}`}
                          variant={slowCase.warnings.length > 0 ? "secondary" : "outline"}
                          className={cn(
                            "max-w-full gap-1 text-xs",
                            slowCase.warnings.length > 0 && "text-yellow-700",
                          )}
                        >
                          {slowCase.warnings.length > 0 && <AlertTriangle className="h-3 w-3" />}
                          <span className="truncate">{slowCase.id}</span>
                          <span className="tabular-nums">{durationLabel(slowCase.durationMs)}</span>
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                <div className="rounded-md border border-border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Case</TableHead>
                        <TableHead className="w-36">Intent</TableHead>
                        <TableHead className="w-24 text-right">Duration</TableHead>
                        <TableHead className="w-20 text-center">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {run.cases.map((testCase) => {
                        const caseKey = `${run.runId}:${testCase.id}`;
                        const caseOpen = expandedCase === caseKey;
                        const hasWarnings = testCase.warnings.length > 0;
                        return (
                          <Fragment key={caseKey}>
                            <TableRow
                              className="cursor-pointer hover:bg-muted/50"
                              onClick={() => setExpandedCase(caseOpen ? null : caseKey)}
                            >
                              <TableCell className="max-w-sm truncate text-sm">{testCase.id}</TableCell>
                              <TableCell>
                                {testCase.intent && <Badge variant="outline" className="text-xs">{testCase.intent}</Badge>}
                              </TableCell>
                              <TableCell className={cn("text-right text-xs tabular-nums", durationTone(testCase))}>
                                {durationLabel(testCase.durationMs)}
                              </TableCell>
                              <TableCell className="text-center">
                                {testCase.status === "pass" && hasWarnings ? (
                                  <AlertTriangle className="mx-auto h-4 w-4 text-yellow-500" />
                                ) : testCase.status === "pass" ? (
                                  <CheckCircle2 className="mx-auto h-4 w-4 text-green-500" />
                                ) : (
                                  <XCircle className="mx-auto h-4 w-4 text-red-400" />
                                )}
                              </TableCell>
                            </TableRow>
                            {caseOpen && (
                              <TableRow key={`${caseKey}:detail`}>
                                <TableCell colSpan={4} className="bg-muted/30 text-xs">
                                  <div className="space-y-3 py-2">
                                    <div>
                                      <p className="font-medium text-foreground mb-1">Prompt tested</p>
                                      <p className="whitespace-pre-wrap text-muted-foreground">
                                        {testCase.prompt || "No prompt captured."}
                                      </p>
                                    </div>
                                    <div className="grid gap-2 sm:grid-cols-3">
                                      <div>
                                        <p className="font-medium text-foreground mb-0.5">Duration</p>
                                        <p className={cn("tabular-nums", durationTone(testCase))}>
                                          {durationLabel(testCase.durationMs)}
                                        </p>
                                      </div>
                                      <div>
                                        <p className="font-medium text-foreground mb-0.5">Warning budget</p>
                                        <p className="text-muted-foreground tabular-nums">
                                          {durationLabel(testCase.latencyBudget?.warnDurationMs ?? null)}
                                        </p>
                                      </div>
                                      <div>
                                        <p className="font-medium text-foreground mb-0.5">Stream events</p>
                                        <p className="text-muted-foreground tabular-nums">
                                          {testCase.streamEventCount ?? "—"}
                                        </p>
                                      </div>
                                    </div>
                                    <div>
                                      <p className="font-medium text-foreground mb-1">Tools fired</p>
                                      <div className="flex flex-wrap gap-1">
                                        {testCase.toolNames.length > 0 ? (
                                          testCase.toolNames.map((tool) => (
                                            <Badge key={tool} variant="secondary" className="text-xs">{tool}</Badge>
                                          ))
                                        ) : (
                                          <span className="text-muted-foreground">None recorded</span>
                                        )}
                                      </div>
                                    </div>
                                    {testCase.failures.length > 0 && (
                                      <div>
                                        <p className="font-medium text-red-600 mb-1">Failures</p>
                                        <ul className="space-y-1 text-red-600">
                                          {testCase.failures.map((failure) => (
                                            <li key={failure}>{failure}</li>
                                          ))}
                                        </ul>
                                      </div>
                                    )}
                                    {testCase.warnings.length > 0 && (
                                      <div>
                                        <p className="font-medium text-yellow-700 mb-1">Warnings</p>
                                        <ul className="space-y-1 text-yellow-700">
                                          {testCase.warnings.map((warning) => (
                                            <li key={warning}>{warning}</li>
                                          ))}
                                        </ul>
                                      </div>
                                    )}
                                    {testCase.observations.length > 0 && (
                                      <div>
                                        <p className="font-medium text-foreground mb-1">Observations</p>
                                        <ul className="space-y-1 text-muted-foreground">
                                          {testCase.observations.map((observation) => (
                                            <li key={observation}>{observation}</li>
                                          ))}
                                        </ul>
                                      </div>
                                    )}
                                    <div>
                                      <p className="font-medium text-foreground mb-1">Response tested</p>
                                      <p className="max-h-48 overflow-auto whitespace-pre-wrap rounded bg-background p-3 text-muted-foreground">
                                        {testCase.finalText || "No final text captured."}
                                      </p>
                                    </div>
                                  </div>
                                </TableCell>
                              </TableRow>
                            )}
                          </Fragment>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function RagEvalPage() {
  const [results, setResults] = useState<EvalResults | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"assistant" | "l1" | "l2" | "run">("assistant");

  const fetchResults = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await apiFetch<EvalResults>("/api/admin/rag-eval/results");
      setResults(data);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load eval results.";
      setLoadError(message);
      console.warn("[rag-eval] Failed to load eval results.", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchResults(); }, [fetchResults]);

  const tabs = [
    { id: "assistant" as const, label: "AI Assistant", badge: results?.assistant?.runs[0] ? `${results.assistant.runs[0].passed}/${results.assistant.runs[0].totalCases}` : null },
    { id: "l1" as const,  label: "L1 Retrieval",      badge: results?.l1.data ? pct(results.l1.data.summary.pass_rate) : null },
    { id: "l2" as const,  label: "L2 Answer Quality",  badge: results?.l2.data ? String(results.l2.data.summary.overall) : null },
    { id: "run" as const, label: "Run Evals",           badge: null },
  ];

  return (
    <>
      <PageContainer>
        <PageHeader
        title="RAG Eval Dashboard"
        description="Retrieval quality metrics, answer quality scores, and eval runners"
        actions={
          <Button variant="outline" size="sm" onClick={fetchResults} disabled={loading} className="gap-1.5">
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
            Refresh
          </Button>
        }
      />
        {/* Tabs */}
        <div className="flex gap-1 border-b border-border mb-6">
          {tabs.map((tab) => (
            <Button
              key={tab.id}
              variant="ghost"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "rounded-none px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors flex items-center gap-2",
                activeTab === tab.id
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {tab.label}
              {tab.badge && (
                <Badge variant={activeTab === tab.id ? "default" : "secondary"} className="text-xs h-5">
                  {tab.badge}
                </Badge>
              )}
            </Button>
          ))}
        </div>

        {loadError && (
          <InfoAlert variant="error" className="mb-4">{loadError}</InfoAlert>
        )}

        {/* Assistant tab */}
        {activeTab === "assistant" && (
          loading ? (
            <p className="text-muted-foreground text-sm">Loading…</p>
          ) : (
            <AssistantRunsPanel runs={results?.assistant?.runs ?? []} />
          )
        )}

        {/* L1 tab */}
        {activeTab === "l1" && (
          loading ? (
            <p className="text-muted-foreground text-sm">Loading…</p>
          ) : results?.l1.data ? (
            <L1Panel data={results.l1.data} file={results.l1.file} />
          ) : (
            <div className="rounded-lg border border-dashed border-border p-8 text-center">
              <p className="text-muted-foreground text-sm">No L1 baseline found.</p>
              <p className="text-xs text-muted-foreground mt-1">Go to <strong>Run Evals</strong> and run the L1 Retrieval eval.</p>
            </div>
          )
        )}

        {/* L2 tab */}
        {activeTab === "l2" && (
          loading ? (
            <p className="text-muted-foreground text-sm">Loading…</p>
          ) : results?.l2.data ? (
            <L2Panel data={results.l2.data} file={results.l2.file} />
          ) : (
            <div className="rounded-lg border border-dashed border-border p-8 text-center">
              <p className="text-muted-foreground text-sm">No L2 baseline found.</p>
              <p className="text-xs text-muted-foreground mt-1">Go to <strong>Run Evals</strong> and run the L2 Answer Quality eval.</p>
            </div>
          )
        )}

        {/* Run tab */}
        {activeTab === "run" && (
          <div className="space-y-3 max-w-2xl">
            <p className="text-sm text-muted-foreground mb-4">
              Results are saved locally to <code className="text-xs bg-muted px-1 py-0.5 rounded">tmp/rag-evals/</code> and auto-loaded on the Results tabs after each run.
            </p>
            {(["coverage", "l1", "l2", "reranker", "e2e"] as EvalType[]).map((type) => (
              <RunCard key={type} type={type} onComplete={fetchResults} />
            ))}
          </div>
        )}
      </PageContainer>
    </>
  );
}
