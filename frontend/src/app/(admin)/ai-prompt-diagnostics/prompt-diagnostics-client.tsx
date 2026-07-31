"use client";

import { useState } from "react";
import { CheckCircle2, Copy, Eye, EyeOff, RefreshCw, XCircle } from "lucide-react";

import { apiFetch } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { SectionRuleHeading } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type PromptSection = {
  id: string;
  label: string;
  present: boolean;
};

type PromptDiagnosticsResponse = {
  success: true;
  generatedAt: string;
  promptHash: string;
  charCount: number;
  approxTokenCount: number;
  sections: PromptSection[];
  additionalContextBlockIds: string[];
  redactedPrompt: string;
  fullPrompt?: string;
};

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

export function AiPromptDiagnosticsClient() {
  const [messageText, setMessageText] = useState("What's the latest on the pinned project?");
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [includeSourceHealth, setIncludeSourceHealth] = useState(true);
  const [includeFullPrompt, setIncludeFullPrompt] = useState(false);
  const [result, setResult] = useState<PromptDiagnosticsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const promptText = includeFullPrompt && result?.fullPrompt
    ? result.fullPrompt
    : result?.redactedPrompt;

  async function runDiagnostics() {
    setLoading(true);
    setError(null);
    try {
      const projectId = selectedProjectId.trim() ? Number(selectedProjectId.trim()) : undefined;
      if (typeof projectId === "number" && (!Number.isInteger(projectId) || projectId <= 0)) {
        throw new Error("Project ID must be a positive integer.");
      }

      const response = await apiFetch<PromptDiagnosticsResponse>(
        "/api/admin/ai-assistant/prompt-diagnostics",
        {
          method: "POST",
          body: JSON.stringify({
            messageText,
            selectedProjectId: projectId,
            sessionId: sessionId.trim() || undefined,
            isFirstTurn: !sessionId.trim(),
            includeSourceHealth,
            includeFullPrompt,
          }),
        },
      );
      setResult(response);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Prompt diagnostics failed.");
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  async function copyPrompt() {
    if (!promptText) return;
    await navigator.clipboard.writeText(promptText);
  }

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <SectionRuleHeading label="Request" />
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_240px]">
          <div className="space-y-2">
            <Label htmlFor="prompt-message">Representative user message</Label>
            <Textarea
              id="prompt-message"
              value={messageText}
              onChange={(event) => setMessageText(event.target.value)}
              rows={5}
              className="font-mono text-xs"
            />
          </div>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="prompt-project-id">Pinned project ID</Label>
              <Input
                id="prompt-project-id"
                inputMode="numeric"
                value={selectedProjectId}
                onChange={(event) => setSelectedProjectId(event.target.value)}
                placeholder="Optional"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="prompt-session-id">Session ID</Label>
              <Input
                id="prompt-session-id"
                value={sessionId}
                onChange={(event) => setSessionId(event.target.value)}
                placeholder="Optional"
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <Checkbox
                checked={includeSourceHealth}
                onCheckedChange={(value) => setIncludeSourceHealth(value === true)}
              />
              Include source health
            </label>
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <Checkbox
                checked={includeFullPrompt}
                onCheckedChange={(value) => setIncludeFullPrompt(value === true)}
              />
              Return full prompt
            </label>
            <Button onClick={runDiagnostics} disabled={loading || !messageText.trim()}>
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
              Run Diagnostics
            </Button>
          </div>
        </div>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </section>

      {result ? (
        <>
          <section className="space-y-4">
            <SectionRuleHeading label="Prompt Summary" />
            <div className="grid gap-3 sm:grid-cols-4">
              <div className="space-y-1 rounded-lg bg-muted/50 p-4">
                <p className="text-xs text-muted-foreground">Characters</p>
                <p className="text-xl font-semibold tabular-nums">{formatNumber(result.charCount)}</p>
              </div>
              <div className="space-y-1 rounded-lg bg-muted/50 p-4">
                <p className="text-xs text-muted-foreground">Approx. tokens</p>
                <p className="text-xl font-semibold tabular-nums">{formatNumber(result.approxTokenCount)}</p>
              </div>
              <div className="space-y-1 rounded-lg bg-muted/50 p-4 sm:col-span-2">
                <p className="text-xs text-muted-foreground">Prompt hash</p>
                <p className="truncate font-mono text-xs text-foreground">{result.promptHash}</p>
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <SectionRuleHeading label="Context Blocks" />
            <div className="divide-y divide-border/60">
              {result.sections.map((section) => {
                const Icon = section.present ? CheckCircle2 : XCircle;
                return (
                  <div key={section.id} className="flex items-center gap-3 py-2 text-sm">
                    <Icon
                      className={cn(
                        "h-4 w-4",
                        section.present ? "text-emerald-600" : "text-muted-foreground",
                      )}
                    />
                    <span className="flex-1 text-foreground">{section.label}</span>
                    <span className="text-xs text-muted-foreground">
                      {section.present ? "present" : "not present"}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="space-y-4">
            <SectionRuleHeading
              label={includeFullPrompt && result.fullPrompt ? "Full Prompt" : "Redacted Prompt"}
              actions={
                <div className="flex items-center gap-2">
                  {includeFullPrompt && result.fullPrompt ? (
                    <span className="inline-flex items-center gap-1 text-xs text-warning">
                      <Eye className="h-3.5 w-3.5" />
                      Full
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <EyeOff className="h-3.5 w-3.5" />
                      Redacted
                    </span>
                  )}
                  <Button variant="outline" size="sm" onClick={copyPrompt}>
                    <Copy className="h-3.5 w-3.5" />
                    Copy
                  </Button>
                </div>
              }
            />
            <pre className="max-h-96 overflow-auto rounded-lg bg-muted/60 p-4 text-xs leading-5 text-foreground">
              {promptText}
            </pre>
          </section>
        </>
      ) : null}
    </div>
  );
}
