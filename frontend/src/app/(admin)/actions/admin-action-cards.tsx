"use client";

import * as React from "react";
import { apiFetch } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  CheckCircle,
  XCircle,
  Loader2,
  RefreshCw,
  FlaskConical,
  Bug,
  Zap,
  Brain,
  Flag,
  FileText,
  MessageSquare,
  Eye,
  Copy,
} from "lucide-react";

// ── Status badge ──────────────────────────────────────────────────────────────

type ActionStatus = "idle" | "running" | "success" | "error";

function StatusBadge({ status, message }: { status: ActionStatus; message?: string }) {
  if (status === "idle") return null;
  return (
    <div
      className={cn(
        "flex items-start gap-1.5 rounded-md px-2.5 py-2 text-xs",
        status === "running" && "bg-muted text-muted-foreground",
        status === "success" && "bg-status-success/10 text-status-success",
        status === "error" && "bg-destructive/10 text-destructive",
      )}
    >
      {status === "running" && <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin mt-0.5" />}
      {status === "success" && <CheckCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />}
      {status === "error" && <XCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />}
      <span className="leading-snug">{message ?? (status === "running" ? "Running…" : status === "success" ? "Done" : "Failed")}</span>
    </div>
  );
}

// ── Generic action card shell ─────────────────────────────────────────────────

function ActionCard({
  title,
  badge,
  description,
  icon: Icon,
  children,
}: {
  title: string;
  badge?: string;
  description: string;
  icon?: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-4 rounded-xl bg-muted/20 p-5">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          {Icon && <Icon className="h-4 w-4 text-muted-foreground shrink-0" />}
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          {badge && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              {badge}
            </span>
          )}
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">{description}</p>
      </div>
      {children}
    </div>
  );
}

// ── 1. RAG evaluation ─────────────────────────────────────────────────────────

type RagEvalType = "l1" | "l2" | "reranker" | "coverage" | "e2e";

const RAG_EVAL_LABELS: Record<RagEvalType, string> = {
  l1: "L1 — Retrieval precision",
  l2: "L2 — Answer faithfulness",
  reranker: "Reranker quality",
  coverage: "Coverage scan",
  e2e: "End-to-end",
};

function RagEvalCard() {
  const [status, setStatus] = React.useState<ActionStatus>("idle");
  const [message, setMessage] = React.useState("");
  const [evalType, setEvalType] = React.useState<RagEvalType>("l1");

  const run = async () => {
    setStatus("running");
    setMessage(`Running ${evalType} eval — this may take a minute…`);
    try {
      const data = await apiFetch<{ message?: string }>("/api/admin/rag-eval/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: evalType }),
      });
      setStatus("success");
      setMessage(data.message ?? "Eval complete. Check the results table.");
    } catch (e) {
      setStatus("error");
      setMessage(e instanceof Error ? e.message : "Eval failed.");
    }
  };

  return (
    <ActionCard
      title="RAG Evaluation"
      badge="AI"
      icon={FlaskConical}
      description="Run retrieval quality evals against the RAG pipeline. Local dev only — returns 503 on Vercel."
    >
      <div className="flex items-center gap-2">
        <Select
          value={evalType}
          onValueChange={(value: RagEvalType) => setEvalType(value)}
        >
          <SelectTrigger size="sm" className="flex-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(RAG_EVAL_LABELS).map(([k, label]) => (
              <SelectItem key={k} value={k}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button size="sm" onClick={run} disabled={status === "running"}>
          {status === "running" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
          Run
        </Button>
      </div>
      <StatusBadge status={status} message={message} />
    </ActionCard>
  );
}

// ── 3. Procore crawl ──────────────────────────────────────────────────────────

const PROCORE_TOOL_SLUGS = [
  "budget", "change-events", "change-orders", "commitments",
  "direct-costs", "drawings", "estimates", "invoicing",
  "prime-contracts", "rfis", "submittals",
];

function ProcoreCrawlCard() {
  const [status, setStatus] = React.useState<ActionStatus>("idle");
  const [message, setMessage] = React.useState("");
  const [slug, setSlug] = React.useState("rfis");
  const [customSlug, setCustomSlug] = React.useState("");

  const effectiveSlug = slug === "__custom__" ? customSlug.trim() : slug;

  const run = async () => {
    if (!effectiveSlug) return;
    setStatus("running");
    setMessage(`Crawling Procore "${effectiveSlug}"…`);
    try {
      const data = await apiFetch<{ message?: string }>("/api/admin/feedback/crawl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: effectiveSlug }),
      });
      setStatus("success");
      setMessage(data.message ?? `Crawl complete for "${effectiveSlug}".`);
    } catch (e) {
      setStatus("error");
      setMessage(e instanceof Error ? e.message : "Crawl failed.");
    }
  };

  return (
    <ActionCard
      title="Procore Crawl"
      badge="Scraper"
      icon={Bug}
      description="Run a deep Procore crawl for a tool to capture screenshots and a field manifest."
    >
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Select value={slug} onValueChange={setSlug}>
            <SelectTrigger size="sm" className="flex-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PROCORE_TOOL_SLUGS.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
              <SelectItem value="__custom__">Custom slug...</SelectItem>
            </SelectContent>
          </Select>
          <Button
            size="sm"
            onClick={run}
            disabled={status === "running" || !effectiveSlug}
          >
            {status === "running" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Bug className="h-3.5 w-3.5" />}
            Crawl
          </Button>
        </div>
        {slug === "__custom__" && (
          <Input
            placeholder="e.g. schedule"
            value={customSlug}
            onChange={(e) => setCustomSlug(e.target.value)}
            className="h-8 text-sm"
          />
        )}
      </div>
      <StatusBadge status={status} message={message} />
    </ActionCard>
  );
}

// ── 4. Daily Brief refresh ────────────────────────────────────────────────────

function RegenerateBriefCard() {
  const [status, setStatus] = React.useState<ActionStatus>("idle");
  const [message, setMessage] = React.useState("");
  const [days, setDays] = React.useState(3);

  const run = async () => {
    setStatus("running");
    setMessage(`Refreshing ${days}-day Daily Brief…`);
    try {
      const data = await apiFetch<{ message?: string }>(
        `/api/executive/daily-brief?fresh=true&mode=source-backed&days=${days}`,
        {
          method: "GET",
        },
      );
      setStatus("success");
      setMessage("Daily Brief refreshed. Open Daily Briefs to review it.");
      void data;
    } catch (e) {
      setStatus("error");
      setMessage(e instanceof Error ? e.message : "Daily Brief refresh failed.");
    }
  };

  return (
    <ActionCard
      title="Refresh Daily Brief"
      badge="AI"
      icon={RefreshCw}
      description="Refresh the canonical Daily Brief packet from current source records. Brandon delivery uses this same packet as a preset."
    >
      <div className="flex items-center gap-2">
        <Select
          value={String(days)}
          onValueChange={(value) => setDays(Number(value))}
        >
          <SelectTrigger size="sm" className="flex-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1">1 day</SelectItem>
            <SelectItem value="3">3 days (default)</SelectItem>
            <SelectItem value="7">7 days</SelectItem>
            <SelectItem value="14">14 days</SelectItem>
          </SelectContent>
        </Select>
        <Button size="sm" onClick={run} disabled={status === "running"}>
          {status === "running" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          Refresh
        </Button>
      </div>
      <StatusBadge status={status} message={message} />
    </ActionCard>
  );
}

// ── 5. Daily flags ────────────────────────────────────────────────────────────

function DailyFlagsCard() {
  const [status, setStatus] = React.useState<ActionStatus>("idle");
  const [message, setMessage] = React.useState("");

  const run = async () => {
    setStatus("running");
    setMessage("Scanning all projects for flags…");
    try {
      const data = await apiFetch<{ message?: string; stats?: Record<string, number> }>(
        "/api/admin/cron/daily-flags",
        { method: "POST" },
      );
      const stats = data.stats
        ? ` (${Object.entries(data.stats)
            .map(([k, v]) => `${v} ${k}`)
            .join(", ")})`
        : "";
      setStatus("success");
      setMessage(data.message ?? `Flags generated.${stats}`);
    } catch (e) {
      setStatus("error");
      setMessage(e instanceof Error ? e.message : "Failed.");
    }
  };

  return (
    <ActionCard
      title="Daily Flags"
      badge="Cron"
      icon={Flag}
      description="Scan all active projects for budget variances >10%, past-due RFIs, late tasks, and stale change events. Runs automatically at 6am UTC."
    >
      <Button size="sm" onClick={run} disabled={status === "running"} className="w-full">
        {status === "running" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Flag className="h-3.5 w-3.5" />}
        Run Now
      </Button>
      <StatusBadge status={status} message={message} />
    </ActionCard>
  );
}

// ── 7. Progress report drafts ─────────────────────────────────────────────────

function ProgressReportDraftsCard() {
  const [status, setStatus] = React.useState<ActionStatus>("idle");
  const [message, setMessage] = React.useState("");

  const run = async () => {
    setStatus("running");
    setMessage("Creating progress report drafts…");
    try {
      const data = await apiFetch<{ message?: string }>("/api/admin/cron/progress-reports", {
        method: "POST",
      });
      setStatus("success");
      setMessage(data.message ?? "Draft reports created for all active projects.");
    } catch (e) {
      setStatus("error");
      setMessage(e instanceof Error ? e.message : "Failed.");
    }
  };

  return (
    <ActionCard
      title="Progress Report Drafts"
      badge="Cron"
      icon={FileText}
      description="Auto-create a draft progress report for every active project missing one this week. Safe to re-run — idempotent. Runs automatically every Monday."
    >
      <Button size="sm" onClick={run} disabled={status === "running"} className="w-full">
        {status === "running" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
        Run Now
      </Button>
      <StatusBadge status={status} message={message} />
    </ActionCard>
  );
}

// ── Seed Teams conversation (admin-connect a user) ───────────────────────────

function SeedTeamsConversationCard() {
  const [status, setStatus] = React.useState<ActionStatus>("idle");
  const [message, setMessage] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [aadObjectId, setAadObjectId] = React.useState("");
  const [needsAadId, setNeedsAadId] = React.useState(false);

  const run = async () => {
    if (!email.trim()) return;
    setStatus("running");
    setNeedsAadId(false);
    setMessage("Creating Teams conversation…");

    try {
      const body: Record<string, string> = { email: email.trim() };
      if (aadObjectId.trim()) body.aadObjectId = aadObjectId.trim();

      const data = await apiFetch<{ displayName?: string; needsAadObjectId?: boolean; error?: string }>(
        "/api/admin/teams/seed-conversation",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );

      setStatus("success");
      setMessage(`Connected! Archon can now message ${data.displayName ?? email} proactively.`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed.";
      if (msg.includes("aadObjectId") || msg.includes("AAD")) {
        setNeedsAadId(true);
      }
      setStatus("error");
      setMessage(msg);
    }
  };

  return (
    <ActionCard
      title="Connect Teams Account"
      badge="Teams"
      icon={MessageSquare}
      description="Manually link a user's Teams account so the Archon bot can send them proactive messages — no action required from the user. Tries Graph API automatically; falls back to manual AAD Object ID."
    >
      <div className="space-y-2">
        <Input
          placeholder="Email (e.g. brandon@company.com)"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="h-8 text-sm"
        />
        {(needsAadId || aadObjectId) && (
          <Input
            placeholder="AAD Object ID (from Azure portal → Users)"
            value={aadObjectId}
            onChange={(e) => setAadObjectId(e.target.value)}
            className="h-8 font-mono text-xs"
          />
        )}
        <Button
          size="sm"
          onClick={run}
          disabled={status === "running" || !email.trim()}
          className="w-full"
        >
          {status === "running" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <MessageSquare className="h-3.5 w-3.5" />
          )}
          Connect
        </Button>
      </div>
      <StatusBadge status={status} message={message} />
    </ActionCard>
  );
}

// ── Send Daily Brief to Teams ─────────────────────────────────────────────────

function SendBriefToTeamsCard() {
  const [status, setStatus] = React.useState<ActionStatus>("idle");
  const [message, setMessage] = React.useState("");

  const run = async () => {
    setStatus("running");
    setMessage("Sending the current Daily Brief to Teams…");
    try {
      const data = await apiFetch<{ recipientName?: string; itemCount?: number }>(
        "/api/executive/daily-brief/send-teams",
        { method: "POST" },
      );
      setStatus("success");
      setMessage(
        `Sent to ${data.recipientName ?? "recipient"} — ${data.itemCount ?? 0} item${(data.itemCount ?? 0) === 1 ? "" : "s"} in the brief.`,
      );
    } catch (e) {
      setStatus("error");
      setMessage(e instanceof Error ? e.message : "Failed to send.");
    }
  };

  return (
    <ActionCard
      title="Send Daily Brief to Teams"
      badge="Teams"
      icon={MessageSquare}
      description="Deliver today's Daily Brief through the Brandon Teams preset. Uses the current canonical packet if already refreshed today."
    >
      <Button size="sm" onClick={run} disabled={status === "running"} className="w-full">
        {status === "running" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MessageSquare className="h-3.5 w-3.5" />}
        Send Now
      </Button>
      <StatusBadge status={status} message={message} />
    </ActionCard>
  );
}

// ── Preview Brandon's Teams Brief ─────────────────────────────────────────────

function PreviewBriefTeamsMessageCard() {
  const [status, setStatus] = React.useState<ActionStatus>("idle");
  const [message, setMessage] = React.useState("");
  const [preview, setPreview] = React.useState<string | null>(null);
  const [fresh, setFresh] = React.useState<"latest" | "fresh">("latest");

  const run = async () => {
    setStatus("running");
    setPreview(null);
    setMessage(
      fresh === "fresh"
        ? "Regenerating brief and rendering Teams message…"
        : "Rendering the current Teams message…",
    );
    try {
      const data = await apiFetch<{
        message: string;
        recipientName?: string;
        itemCount?: number;
        recapDate?: string;
        generatedFresh?: boolean;
      }>("/api/executive/daily-brief/preview-teams", {
        method: "POST",
        body: JSON.stringify({
          fresh: fresh === "fresh",
          firstName: "Brandon",
        }),
      });
      setStatus("success");
      setPreview(data.message);
      setMessage(
        `${data.generatedFresh ? "Regenerated" : "Loaded"} brief for ${data.recapDate ?? "today"} — ${data.itemCount ?? 0} item${(data.itemCount ?? 0) === 1 ? "" : "s"}. Not sent.`,
      );
    } catch (e) {
      setStatus("error");
      setMessage(e instanceof Error ? e.message : "Failed to render preview.");
    }
  };

  const copy = async () => {
    if (!preview) return;
    try {
      await navigator.clipboard.writeText(preview);
      setMessage("Copied to clipboard.");
    } catch {
      setMessage("Copy failed — select the text manually.");
    }
  };

  return (
    <ActionCard
      title="Preview Brandon's Teams Brief"
      badge="Teams"
      icon={Eye}
      description="Render the exact Teams message that would be sent to Brandon — without sending it. Use 'Regenerate' to rerun project intelligence first."
    >
      <div className="flex items-center gap-2">
        <Select
          value={fresh}
          onValueChange={(value: "latest" | "fresh") => setFresh(value)}
        >
          <SelectTrigger size="sm" className="flex-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="latest">Use latest brief</SelectItem>
            <SelectItem value="fresh">Regenerate first</SelectItem>
          </SelectContent>
        </Select>
        <Button size="sm" onClick={run} disabled={status === "running"}>
          {status === "running" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Eye className="h-3.5 w-3.5" />
          )}
          Preview
        </Button>
      </div>
      <StatusBadge status={status} message={message} />
      {preview && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">
              Teams message preview
            </span>
            <Button size="sm" variant="ghost" onClick={copy}>
              <Copy className="h-3.5 w-3.5" />
              Copy
            </Button>
          </div>
          <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-md bg-muted/40 p-3 text-xs leading-relaxed text-foreground">
            {preview}
          </pre>
        </div>
      )}
    </ActionCard>
  );
}

// ── CLI command (copy-only) ───────────────────────────────────────────────────
// Some actions are local developer commands that regenerate repo files from the
// filesystem + git. They cannot run on the production serverless host (read-only
// FS, no repo), so this card surfaces the command to copy and run in a dev
// terminal rather than a "Run" button that would fail in production.

function CliCommandCard({
  title,
  badge,
  description,
  command,
  icon: Icon,
}: {
  title: string;
  badge?: string;
  description: string;
  command: string;
  icon?: React.ElementType;
}) {
  const [copied, setCopied] = React.useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <ActionCard title={title} badge={badge} description={description} icon={Icon}>
      <div className="flex items-center gap-2">
        <code className="flex-1 overflow-auto rounded-md bg-muted/40 px-3 py-2 text-xs text-foreground">
          {command}
        </code>
        <Button size="sm" variant="ghost" onClick={copy}>
          {copied ? (
            <CheckCircle className="h-3.5 w-3.5 text-status-success" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
    </ActionCard>
  );
}

function RegenerateProjectMapCard() {
  return (
    <CliCommandCard
      title="Regenerate Project Map"
      badge="CLI"
      icon={FileText}
      description="Rebuild docs/architecture/PROJECT-MAP.md — the agent-readable inventory of every UI route, API endpoint, and AI tool. Run after adding or removing a route or tool. A pre-commit gate fails if it's stale. Runs in a dev terminal (local filesystem + git)."
      command="npm run map:project"
    />
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export function AdminActionCards() {
  return (
    <>
      <SeedTeamsConversationCard />
      <PreviewBriefTeamsMessageCard />
      <SendBriefToTeamsCard />
      <RegenerateBriefCard />
      <DailyFlagsCard />
      <ProgressReportDraftsCard />
      <RagEvalCard />
      <ProcoreCrawlCard />
      <RegenerateProjectMapCard />
    </>
  );
}
