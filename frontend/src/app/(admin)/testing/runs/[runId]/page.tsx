"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { PageShell } from "@/components/layout";
import { SectionRuleHeading } from "@/components/layout/spacing";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiFetch } from "@/lib/api-client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Github,
  Upload,
  Video,
} from "lucide-react";
import { RunnerStepList } from "../../_components/RunnerStepList";
import { RunnerActionBar } from "../../_components/RunnerActionBar";
import { ProgressBar } from "../../_components/ProgressBar";
import type { RunMeta, TestResult, TestStatus } from "../../_components/types";

type FilterTab = "all" | "failed" | "passed" | "fixed";
type Severity = "critical" | "major" | "minor" | "cosmetic";

const SEVERITY_STYLES: Record<Severity, string> = {
  critical: "bg-destructive text-destructive-foreground",
  major: "bg-orange-500 text-white",
  minor: "bg-yellow-500 text-foreground",
  cosmetic: "bg-muted text-muted-foreground",
};

// ── Helpers ─────────────────────────────────────────────────────────────────

function StatusDot({ status }: { status: TestStatus }) {
  return (
    <span
      className={cn(
        "h-2 w-2 shrink-0 rounded-full",
        status === "pass" && "bg-success",
        status === "fail" && "bg-destructive",
        status === "fixed" && "bg-status-info",
        (status === "skip" || status === "not_tested") && "bg-muted-foreground/40",
      )}
      aria-hidden
    />
  );
}

function SeverityBadge({ severity }: { severity: Severity }) {
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-[11px] font-medium capitalize",
        SEVERITY_STYLES[severity],
      )}
    >
      {severity}
    </span>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
      {children}
    </p>
  );
}

function parseSteps(raw: string | null): string[] {
  if (!raw) return [];
  return raw
    .split("\n")
    .filter(Boolean)
    .map((s) => s.replace(/^\d+[.)]\s*/, "").trim());
}

/** Convert a Loom share URL to an embed src, pass other URLs through as-is. */
function toLoomEmbed(url: string): string | null {
  const loomShare = /loom\.com\/share\/([a-zA-Z0-9]+)/;
  const m = url.match(loomShare);
  if (m) return `https://www.loom.com/embed/${m[1]}`;
  return null;
}

// ── Video section ────────────────────────────────────────────────────────────

function VideoSection({ url }: { url: string }) {
  const embedSrc = toLoomEmbed(url);
  return (
    <div className="space-y-2">
      <SectionLabel>Recording</SectionLabel>
      {embedSrc ? (
        <div className="overflow-hidden rounded-lg border border-border" style={{ paddingTop: "56.25%", position: "relative" }}>
          <iframe
            src={embedSrc}
            allowFullScreen
            className="absolute inset-0 h-full w-full"
            title="Test recording"
          />
        </div>
      ) : (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-muted/50 transition-colors"
        >
          <Video className="h-4 w-4 text-muted-foreground" />
          <span className="truncate max-w-sm">{url}</span>
          <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
        </a>
      )}
    </div>
  );
}

// ── Case detail (right panel) ────────────────────────────────────────────────

const STATUS_OPTIONS: { value: TestStatus; label: string }[] = [
  { value: "fail", label: "Failed" },
  { value: "pass", label: "Passed" },
  { value: "fixed", label: "Fixed" },
  { value: "skip", label: "Skipped" },
  { value: "not_tested", label: "Not tested" },
];

function CaseDetail({
  result,
  runId,
  onStatusChange,
  onIssueCreated,
}: {
  result: TestResult;
  runId: string;
  onStatusChange: (resultId: string, status: TestStatus) => void;
  onIssueCreated: (resultId: string, issueNumber: number, issueUrl: string, issueState: string) => void;
}) {
  const tc = result.test_cases;
  const screenshots = result.test_screenshots ?? [];
  const steps = parseSteps(tc.steps);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [filingIssue, setFilingIssue] = useState(false);

  const handleStatusChange = async (newStatus: TestStatus) => {
    if (newStatus === result.status) return;
    setUpdatingStatus(true);
    try {
      const { result: updated } = await apiFetch<{ result: TestResult }>(
        `/api/testing/runs/${runId}/results/${result.id}`,
        { method: "PATCH", body: JSON.stringify({ status: newStatus }) },
      );
      onStatusChange(result.id, updated.status);
    } catch (e) {
      toast.error("Could not update status", {
        description: e instanceof Error ? e.message : "Unknown error",
      });
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleFileIssue = async () => {
    setFilingIssue(true);
    try {
      const { result: updated, already_existed } = await apiFetch<{
        result: TestResult;
        already_existed: boolean;
      }>(
        `/api/testing/runs/${runId}/results/${result.id}/github-issue`,
        { method: "POST" },
      );
      if (updated.github_issue_number && updated.github_issue_url && updated.github_issue_state) {
        onIssueCreated(result.id, updated.github_issue_number, updated.github_issue_url, updated.github_issue_state);
        toast.success(already_existed ? "Issue already exists" : `Issue #${updated.github_issue_number} created`);
      }
    } catch (e) {
      toast.error("Could not create GitHub issue", {
        description: e instanceof Error ? e.message : "Unknown error",
      });
    } finally {
      setFilingIssue(false);
    }
  };

  return (
    <div className="px-8 py-8 max-w-3xl space-y-7">
      {/* Title block */}
      <div>
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <StatusDot status={result.status} />
          <span className="font-mono text-xs text-muted-foreground">
            {tc.test_number}
          </span>
          {tc.category && (
            <span className="text-xs text-muted-foreground">
              · {tc.category}
              {tc.subcategory ? ` · ${tc.subcategory}` : ""}
            </span>
          )}
          {result.severity && <SeverityBadge severity={result.severity} />}

          {/* GitHub issue link */}
          {result.github_issue_url && (
            <a
              href={result.github_issue_url}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-auto inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <Github className="h-3.5 w-3.5" />
              #{result.github_issue_number}
            </a>
          )}
        </div>
        <div className="flex items-start justify-between gap-4">
          <h2 className="text-lg font-semibold leading-snug">{tc.test_name}</h2>

          {/* Status dropdown */}
          <Select
            value={result.status}
            disabled={updatingStatus}
            onValueChange={(v) => void handleStatusChange(v as TestStatus)}
          >
            <SelectTrigger className="shrink-0 w-36 h-7 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value} className="text-xs">
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="pt-4">
        <SectionRuleHeading label={result.status === "fixed" ? "Fix Details" : "Details"} />
        <div className="space-y-3">
          <div className="flex items-start gap-2 text-xs">
            <span className="w-20 shrink-0 text-muted-foreground">
              {result.status === "fixed" ? "What was fixed" : "Error"}
            </span>
            <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
              {result.notes?.trim() || (result.status === "fixed" ? "No fix details captured." : "No error details captured for this case.")}
            </p>
          </div>

          <div className="flex items-start gap-2 text-xs">
            <span className="w-20 shrink-0 text-muted-foreground">Video URL</span>
            {result.video_url ? (
              <a
                href={result.video_url}
                target="_blank"
                rel="noopener noreferrer"
                className="truncate text-sm text-primary hover:underline"
              >
                {result.video_url}
              </a>
            ) : (
              <span className="text-sm text-muted-foreground">No recording URL</span>
            )}
          </div>
        </div>

        {result.video_url && (
          <div className="mt-4">
            <VideoSection url={result.video_url} />
          </div>
        )}

        <div className="mt-4 space-y-2">
          <SectionLabel>{screenshots.length === 1 ? "Screenshot" : "Screenshots"}</SectionLabel>
          {screenshots.length > 0 ? (
            <div className="flex flex-wrap gap-3">
              {screenshots.map((s) => (
                <a
                  key={s.id}
                  href={s.public_url ?? undefined}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block overflow-hidden rounded-md border border-border hover:opacity-80 transition-opacity"
                >
                  {s.public_url && (
                    <Image
                      src={s.public_url}
                      alt={s.label ?? "Test screenshot"}
                      width={320}
                      height={200}
                      className="h-40 w-80 object-cover"
                    />
                  )}
                  {s.label && (
                    <p className="px-2 py-1 text-xs text-muted-foreground">{s.label}</p>
                  )}
                </a>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">No screenshots attached.</p>
          )}
        </div>
      </div>

      <div className="pt-4">
        <SectionRuleHeading label="Page Context" />
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-xs">
            <span className="w-20 shrink-0 text-muted-foreground">Page</span>
            {tc.start_url ? (
              <Link
                href={tc.start_url}
                target="_blank"
                className="truncate font-mono text-[11px] text-foreground hover:underline"
              >
                {tc.start_url}
              </Link>
            ) : (
              <span className="text-foreground">No start URL</span>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="w-20 shrink-0 text-muted-foreground">Case</span>
            <span className="text-foreground">{tc.test_number}</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="w-20 shrink-0 text-muted-foreground">Title</span>
            <span className="truncate text-foreground">{tc.test_name}</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="w-20 shrink-0 text-muted-foreground">Category</span>
            <span className="text-foreground">
              {tc.category}
              {tc.subcategory ? ` · ${tc.subcategory}` : ""}
            </span>
          </div>
        </div>
      </div>

      <div className="pt-4">
        <SectionRuleHeading label="Tool Context" />
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-xs">
            <span className="w-20 shrink-0 text-muted-foreground">Type</span>
            <span className="text-foreground">{tc.test_type ?? "N/A"}</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="w-20 shrink-0 text-muted-foreground">Priority</span>
            <span className="text-foreground">{tc.priority}</span>
          </div>
          <div className="flex items-start gap-2 text-xs">
            <span className="w-20 shrink-0 text-muted-foreground">Context</span>
            <span className="text-foreground">{tc.context_note ?? "No tool context provided."}</span>
          </div>
        </div>
      </div>

      <div className="pt-4">
        <SectionRuleHeading label="GitHub Activity" />
        {result.github_issue_url ? (
          <a
            href={result.github_issue_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm text-foreground hover:bg-muted/50 transition-colors"
          >
            <Github className="h-4 w-4 text-muted-foreground" />
            <span>Issue #{result.github_issue_number}</span>
            <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
          </a>
        ) : (
          <div className="py-2 space-y-2">
            <p className="text-xs text-muted-foreground">No GitHub issue linked to this failure.</p>
            {result.status === "fail" && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => void handleFileIssue()}
                disabled={filingIssue}
                className="gap-2"
              >
                <Github className="h-3.5 w-3.5" />
                {filingIssue ? "Creating issue…" : "File GitHub Issue"}
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Expected result */}
      {tc.expected_result && (
        <div className="pt-4 space-y-1.5">
          <SectionLabel>Expected result</SectionLabel>
          <p className="text-sm leading-relaxed whitespace-pre-line text-muted-foreground">
            {tc.expected_result}
          </p>
        </div>
      )}

      {/* Steps */}
      {steps.length > 0 && (
        <div className="pt-4 space-y-1.5">
          <SectionLabel>Steps</SectionLabel>
          <ol className="space-y-1 list-decimal list-inside">
            {steps.map((step, i) => (
              <li key={i} className="text-sm text-muted-foreground">
                {step}
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function RunPage() {
  const params = useParams<{ runId: string }>()!;
  const router = useRouter();
  const runId = params.runId;

  const [meta, setMeta] = useState<RunMeta | null>(null);
  const [results, setResults] = useState<TestResult[]>([]);
  const [cursor, setCursor] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Runner state
  const [notes, setNotes] = useState("");
  const [failMode, setFailMode] = useState(false);
  const [severity, setSeverity] = useState<Severity | null>(null);
  const [videoUrl, setVideoUrl] = useState("");
  const [uploadingScreenshot, setUploadingScreenshot] = useState(false);
  const [localScreenshots, setLocalScreenshots] = useState<{ url: string; label: string }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Split-pane state
  const [tab, setTab] = useState<FilterTab>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      apiFetch<{ run: RunMeta }>(`/api/testing/runs/${runId}`),
      apiFetch<{ results?: TestResult[] }>(`/api/testing/runs/${runId}/results`),
    ])
      .then(([metaRes, resultsRes]) => {
        setMeta(metaRes.run);
        const loaded = resultsRes.results ?? [];
        setResults(loaded);
        const firstUntested = loaded.findIndex((r) => r.status === "not_tested");
        setCursor(firstUntested >= 0 ? firstUntested : 0);
        const firstFail = loaded.find((r) => r.status === "fail");
        setSelectedId(firstFail?.id ?? loaded[0]?.id ?? null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Unable to load run."))
      .finally(() => setLoading(false));
  }, [runId]);

  const current = results[cursor] ?? null;

  useEffect(() => {
    setNotes(current?.notes ?? "");
    setFailMode(false);
    setSeverity(null);
    setVideoUrl("");
    setLocalScreenshots([]);
  }, [current?.id]);  

  const counts = useMemo(() => {
    const c = { pass: 0, fail: 0, skip: 0, notTested: 0, fixed: 0 };
    for (const r of results) {
      if (r.status === "pass") c.pass++;
      else if (r.status === "fail") c.fail++;
      else if (r.status === "skip") c.skip++;
      else if (r.status === "fixed") c.fixed++;
      else c.notTested++;
    }
    return c;
  }, [results]);

  const allGraded = results.length > 0 && counts.notTested === 0;

  const record = useCallback(
    async (status: TestStatus, opts?: { severity?: Severity | null; videoUrl?: string }) => {
      if (!current) return;
      setSaving(true);
      setError(null);
      try {
        const { result } = await apiFetch<{ result: TestResult }>(
          `/api/testing/runs/${runId}/results/${current.id}`,
          {
            method: "PATCH",
            body: JSON.stringify({
              status,
              notes: notes.trim() || null,
              severity: opts?.severity ?? null,
              video_url: opts?.videoUrl?.trim() || null,
            }),
          },
        );
        setResults((prev) =>
          prev.map((r) =>
            r.id === current.id
              ? {
                  ...r,
                  status: result.status,
                  notes: result.notes,
                  severity: result.severity,
                  video_url: result.video_url,
                  github_issue_number: result.github_issue_number ?? r.github_issue_number,
                  github_issue_url: result.github_issue_url ?? r.github_issue_url,
                  github_issue_state: result.github_issue_state ?? r.github_issue_state,
                }
              : r,
          ),
        );
        setFailMode(false);
        if (cursor < results.length - 1) {
          setCursor((c) => c + 1);
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Unable to save.";
        setError(msg);
        toast.error(msg);
      } finally {
        setSaving(false);
      }
    },
    [current, runId, notes, cursor, results.length],
  );

  // Upload a File as a screenshot attached to the current result.
  const uploadScreenshotFile = useCallback(
    async (file: File) => {
      if (!current) return;
      setUploadingScreenshot(true);
      try {
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        await apiFetch(
          `/api/testing/runs/${runId}/results/${current.id}/screenshots`,
          {
            method: "POST",
            body: JSON.stringify({ dataUrl, label: file.name }),
          },
        );
        setLocalScreenshots((prev) => [...prev, { url: dataUrl, label: file.name }]);
      } catch (e) {
        toast.error("Screenshot upload failed.");
      } finally {
        setUploadingScreenshot(false);
      }
    },
    [current, runId],
  );

  // Clipboard paste → screenshot upload when in fail mode.
  useEffect(() => {
    if (!failMode) return;
    const handler = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of Array.from(items)) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) void uploadScreenshotFile(file);
        }
      }
    };
    document.addEventListener("paste", handler);
    return () => document.removeEventListener("paste", handler);
  }, [failMode, uploadScreenshotFile]);

  // Keyboard shortcuts.
  useEffect(() => {
    if (allGraded || !current) return;
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName.toLowerCase();
      if (tag === "input" || tag === "textarea") return;
      if (failMode) {
        if (e.key === "Escape") { e.preventDefault(); setFailMode(false); }
        return;
      }
      if (e.key === "p" || e.key === "P") { e.preventDefault(); void record("pass"); }
      else if (e.key === "s" || e.key === "S") { e.preventDefault(); void record("skip"); }
      else if (e.key === "i" || e.key === "I") { e.preventDefault(); setFailMode(true); }
      else if (e.key === "ArrowLeft") setCursor((c) => Math.max(0, c - 1));
      else if (e.key === "ArrowRight") setCursor((c) => Math.min(results.length - 1, c + 1));
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [record, allGraded, current, results.length, failMode]);

  // ── Loading / error ──────────────────────────────────────────────────────
  if (loading) {
    return (
      <PageShell variant="content" title="Run" showHeader={false}>
        <p className="text-sm text-muted-foreground">Loading run…</p>
      </PageShell>
    );
  }

  if (error && results.length === 0) {
    return (
      <PageShell variant="content" title="Run">
        <p className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</p>
      </PageShell>
    );
  }

  // ── Complete state — Linear-style split pane ─────────────────────────────
  if (allGraded) {
    const suiteName = meta?.suite?.display_name ?? runId;
    const suiteType = meta?.suite?.suite_type;
    const runDate = meta?.run_date
      ? new Date(meta.run_date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
      : null;

    const filtered = results.filter((r) => {
      if (tab === "failed") return r.status === "fail";
      if (tab === "passed") return r.status === "pass";
      if (tab === "fixed") return r.status === "fixed";
      return true;
    });

    const selectedResult = results.find((r) => r.id === selectedId) ?? null;

    const tabs: { key: FilterTab; label: string; count: number }[] = [
      { key: "failed", label: "Failed", count: counts.fail },
      { key: "fixed", label: "Fixed", count: counts.fixed },
      { key: "passed", label: "Passed", count: counts.pass },
      { key: "all", label: "All", count: results.length },
    ];

    return (
      <div
        className="flex overflow-hidden -mr-4 sm:-mr-6 lg:-mr-8 -mt-1"
        style={{ height: "calc(100svh - 48px)" }}
      >
        {/* ── Left panel: case list ────────────────────────────────────── */}
        <div className="w-96 shrink-0 flex flex-col border-r border-border/60 bg-muted/10">
          {/* Run header */}
          <div className="px-4 py-4 space-y-3">
            <Button
              type="button"
              variant="ghost"
              onClick={() => router.push("/testing/runs")}
              className="flex items-center gap-1.5 h-auto text-xs text-muted-foreground hover:text-foreground transition-colors p-0"
            >
              <ArrowLeft className="h-3 w-3" />
              All runs
            </Button>
            <div>
              <p className="text-sm font-semibold leading-tight">{suiteName}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {suiteType === "smoke" ? "Smoke" : suiteType === "feature" ? "Feature" : ""}
                {runDate ? ` · ${runDate}` : ""}
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span>
                <span className="font-semibold text-success">{counts.pass}</span>
                <span className="text-muted-foreground"> passed</span>
              </span>
              {counts.fixed > 0 && (
                <span>
                  <span className="font-semibold text-status-info">{counts.fixed}</span>
                  <span className="text-muted-foreground"> fixed</span>
                </span>
              )}
              {counts.fail > 0 && (
                <span>
                  <span className="font-semibold text-destructive">{counts.fail}</span>
                  <span className="text-muted-foreground"> failed</span>
                </span>
              )}
              {counts.skip > 0 && (
                <span className="text-muted-foreground">{counts.skip} skipped</span>
              )}
            </div>
          </div>

          {/* Filter tabs */}
          <div className="flex border-b border-border/40 shrink-0">
            {tabs.map((t) => (
              <Button
                key={t.key}
                type="button"
                variant="ghost"
                onClick={() => setTab(t.key)}
                className={cn(
                  "flex-1 py-2.5 h-auto text-xs font-medium text-center transition-colors rounded-none",
                  tab === t.key
                    ? "text-foreground border-b-2 border-primary -mb-px"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t.label}
                <span
                  className={cn(
                    "ml-1.5 rounded-full px-1.5 tabular-nums text-[10px]",
                    tab === t.key && t.key === "failed"
                      ? "bg-destructive/10 text-destructive"
                      : tab === t.key && t.key === "fixed"
                        ? "bg-status-success/10 text-status-success"
                        : "text-muted-foreground",
                  )}
                >
                  {t.count}
                </span>
              </Button>
            ))}
          </div>

          {/* Case list */}
          <div className="flex-1 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="px-4 py-6 text-xs text-muted-foreground">
                {tab === "failed" ? "No failures." : tab === "passed" ? "No passes." : "No results."}
              </p>
            ) : (
              filtered.map((r) => (
                <Button
                  key={r.id}
                  type="button"
                  variant="ghost"
                  onClick={() => setSelectedId(r.id)}
                  className={cn(
                    "w-full justify-start text-left h-auto px-4 py-3 border-b border-border/30 transition-colors rounded-none",
                    selectedId === r.id && "bg-muted/60",
                  )}
                >
                  <div className="flex items-center gap-2.5">
                    <StatusDot status={r.status} />
                    <span className="font-mono text-[11px] text-muted-foreground shrink-0">
                      {r.test_cases.test_number}
                    </span>
                    <span className="text-xs font-medium truncate">{r.test_cases.test_name}</span>
                  </div>
                  <div className="mt-0.5 pl-6 flex items-center gap-2">
                    {r.severity && (
                      <SeverityBadge severity={r.severity} />
                    )}
                    {r.video_url && (
                      <Video className="h-3 w-3 text-muted-foreground shrink-0" aria-label="Has recording" />
                    )}
                    {r.github_issue_number && (
                      <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground">
                        <Github className="h-2.5 w-2.5" />
                        #{r.github_issue_number}
                      </span>
                    )}
                    {(r.test_screenshots?.length ?? 0) > 0 && (
                      <span className="text-[10px] text-muted-foreground">
                        {r.test_screenshots.length} screenshot{r.test_screenshots.length !== 1 ? "s" : ""}
                      </span>
                    )}
                    {r.notes && r.status === "fail" && !r.severity && !r.github_issue_number && (
                      <p className="text-[11px] text-muted-foreground truncate">{r.notes}</p>
                    )}
                  </div>
                </Button>
              ))
            )}
          </div>
        </div>

        {/* ── Right panel: case detail ─────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto bg-background">
          {selectedResult ? (
            <CaseDetail
              result={selectedResult}
              runId={runId}
              onStatusChange={(resultId, status) =>
                setResults((prev) =>
                  prev.map((r) => (r.id === resultId ? { ...r, status } : r)),
                )
              }
              onIssueCreated={(resultId, issueNumber, issueUrl, issueState) =>
                setResults((prev) =>
                  prev.map((r) =>
                    r.id === resultId
                      ? { ...r, github_issue_number: issueNumber, github_issue_url: issueUrl, github_issue_state: issueState }
                      : r,
                  ),
                )
              }
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <p className="text-sm text-muted-foreground">Select a test case</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Runner state (in-progress) ───────────────────────────────────────────
  if (!current) return null;
  const tc = current.test_cases;

  const confirmFail = () => void record("fail", { severity, videoUrl });
  const cancelFail = () => {
    setFailMode(false);
    setSeverity(null);
    setVideoUrl("");
  };

  return (
    <PageShell
      variant="content"
      title={tc.test_name}
      description={`${tc.test_number} · ${tc.category}${tc.subcategory ? ` · ${tc.subcategory}` : ""}`}
      onBack={() => router.push("/testing/runs")}
      backLabel="All runs"
    >
      <ProgressBar
        pass={counts.pass + counts.fixed}
        fail={counts.fail}
        skip={counts.skip}
        notTested={counts.notTested}
      />

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setCursor((c) => Math.max(0, c - 1))}
          disabled={cursor === 0}
        >
          <ChevronLeft className="h-4 w-4" />
          Prev
        </Button>
        <span>Case {cursor + 1} of {results.length}</span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setCursor((c) => Math.min(results.length - 1, c + 1))}
          disabled={cursor === results.length - 1}
        >
          Next
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {tc.context_note && (
        <p className="rounded-md bg-muted/60 px-4 py-3 text-sm leading-relaxed text-muted-foreground">
          {tc.context_note}
        </p>
      )}

      {tc.setup_steps && (
        <section className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Setup</h2>
          <p className="whitespace-pre-line text-sm leading-relaxed">{tc.setup_steps}</p>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Steps</h2>
        <RunnerStepList steps={tc.steps} />
      </section>

      {tc.expected_result && (
        <section className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Expected</h2>
          <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{tc.expected_result}</p>
        </section>
      )}

      {tc.start_url && (
        <p className="text-xs text-muted-foreground">
          Start at:{" "}
          <Link href={tc.start_url} target="_blank" className="text-primary hover:underline">
            {tc.start_url}
          </Link>
        </p>
      )}

      <section className="space-y-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {failMode ? "What went wrong" : "Notes"}
        </h2>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={failMode ? "Describe what actually happened…" : "Optional notes about this case…"}
          rows={3}
        />
      </section>

      {/* ── Failure details panel (shown only in fail mode) ── */}
      {failMode && (
        <section className="space-y-5 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-destructive/70">Failure details</p>

          {/* Severity */}
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Severity</p>
            <div className="flex flex-wrap gap-2">
              {(["critical", "major", "minor", "cosmetic"] as Severity[]).map((s) => (
                <Button
                  key={s}
                  type="button"
                  variant="ghost"
                  onClick={() => setSeverity(s === severity ? null : s)}
                  className={cn(
                    "rounded-full px-3 py-1 h-auto text-xs font-medium capitalize transition-colors",
                    severity === s
                      ? SEVERITY_STYLES[s]
                      : "bg-muted/60 text-muted-foreground hover:bg-muted",
                  )}
                >
                  {s}
                </Button>
              ))}
            </div>
          </div>

          {/* Video recording URL */}
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Recording URL</p>
            <Input
              type="url"
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              placeholder="https://www.loom.com/share/…"
              className="bg-background"
            />
          </div>

          {/* Screenshot upload */}
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              Screenshots{" "}
              <span className="font-normal text-muted-foreground/60">(paste from clipboard or choose file)</span>
            </p>
            <Button
              type="button"
              variant="ghost"
              disabled={uploadingScreenshot}
              onClick={() => fileInputRef.current?.click()}
              className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-md border-2 border-dashed border-border/60 px-4 py-4 h-auto text-xs text-muted-foreground transition-colors hover:border-border hover:bg-muted/30 disabled:opacity-50"
            >
              <Upload className="h-4 w-4" />
              {uploadingScreenshot ? "Uploading…" : "Click to upload or Ctrl+V to paste"}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                const files = Array.from(e.target.files ?? []);
                files.forEach((f) => void uploadScreenshotFile(f));
                e.target.value = "";
              }}
            />
            {localScreenshots.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {localScreenshots.map((s, i) => (
                  <div key={i} className="overflow-hidden rounded border border-border">
                    { }
                    <img src={s.url} alt={s.label} className="h-20 w-32 object-cover" />
                    <p className="truncate px-1.5 py-0.5 text-[10px] text-muted-foreground">{s.label}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* ── Action bar ── */}
      {failMode ? (
        <div className="sticky bottom-0 -mx-4 mt-12 border-t border-border bg-background/95 px-4 py-4 backdrop-blur sm:-mx-6 lg:-mx-8">
          <div className="mx-auto flex max-w-3xl items-center gap-2">
            <Button
              type="button"
              onClick={confirmFail}
              disabled={saving}
              variant="destructive"
              className="flex-1 gap-2"
            >
              Confirm failure
              {severity && <SeverityBadge severity={severity} />}
            </Button>
            <Button
              type="button"
              onClick={cancelFail}
              variant="outline"
            >
              Cancel
              <kbd className="ml-1 rounded bg-muted px-1 text-[10px]">Esc</kbd>
            </Button>
          </div>
        </div>
      ) : (
        <RunnerActionBar
          onPass={() => void record("pass")}
          onFail={() => setFailMode(true)}
          onSkip={() => void record("skip")}
          disabled={saving}
        />
      )}
    </PageShell>
  );
}
