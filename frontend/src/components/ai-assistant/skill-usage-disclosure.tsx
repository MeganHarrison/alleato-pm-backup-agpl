"use client";

import { useState } from "react";
import Link from "next/link";
import { SparklesIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api-client";
import { appToast as toast } from "@/lib/toast/app-toast";

export interface SkillUsage {
  totalSelected: number;
  selectionReason: string;
  skills: Array<{
    id: string;
    title: string;
    slug: string;
    category: string;
    scope: string;
    projectId: number | null;
    version: number;
    riskLevel: string;
    score: number;
    reasons: string[];
  }>;
}

interface AssistantSkillTraceProps {
  usage?: SkillUsage;
  messageId: string;
  sessionId?: string;
}

export function AssistantSkillTrace({
  usage,
  messageId,
  sessionId,
}: AssistantSkillTraceProps) {
  if (!usage || usage.skills.length === 0) return null;

  return (
    <SkillUsageDisclosure
      usage={usage}
      messageId={messageId}
      sessionId={sessionId}
    />
  );
}

function SkillUsageDisclosure({
  usage,
  messageId,
  sessionId,
}: AssistantSkillTraceProps & { usage: SkillUsage }) {
  const [flaggingSkillId, setFlaggingSkillId] = useState<string | null>(null);
  const [flaggedSkillIds, setFlaggedSkillIds] = useState<Set<string>>(
    () => new Set(),
  );

  const handleMarkWrong = async (skillId: string) => {
    if (flaggingSkillId || flaggedSkillIds.has(skillId)) return;
    setFlaggingSkillId(skillId);
    try {
      await apiFetch(`/api/ai-assistant/skills/${skillId}/feedback`, {
        method: "POST",
        body: JSON.stringify({
          reason:
            "This skill looked wrong or unhelpful in an assistant answer.",
          reasonCategory: "wrong",
          source: {
            surface: "assistant_answer_skill_trace",
            route:
              typeof window === "undefined" ? "/ai" : window.location.pathname,
            messageId,
            sessionId,
          },
        }),
      });
      setFlaggedSkillIds((current) => {
        const next = new Set(current);
        next.add(skillId);
        return next;
      });
      toast.success("Skill sent for review");
    } catch (error) {
      toast.error(
        error instanceof Error && error.message
          ? error.message
          : "Skill feedback could not be sent. Refresh and try again.",
      );
    } finally {
      setFlaggingSkillId(null);
    }
  };

  return (
    <details className="group mt-3 text-xs text-muted-foreground">
      <summary className="flex cursor-pointer list-none items-center gap-2 transition-colors hover:text-foreground">
        <SparklesIcon className="h-3.5 w-3.5 shrink-0" />
        <span>
          Used {usage.totalSelected} skill
          {usage.totalSelected === 1 ? "" : "s"}
        </span>
      </summary>
      <div className="mt-2 space-y-2 border-l border-border/60 pl-3">
        {usage.skills.slice(0, 4).map((skill) => (
          <div key={skill.id} className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1 space-y-1">
              <Link
                href={`/ai/skills?skill=${encodeURIComponent(skill.slug)}`}
                className="line-clamp-1 text-xs font-medium text-foreground underline-offset-4 hover:underline"
              >
                {skill.title}
              </Link>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
                <span>v{skill.version}</span>
                <span className="capitalize">{skill.category.replaceAll("_", " ")}</span>
                <span className="capitalize">{skill.scope}</span>
                {skill.projectId ? <span>Project #{skill.projectId}</span> : null}
                <span className="capitalize">{skill.riskLevel} risk</span>
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 shrink-0 px-2 text-xs text-muted-foreground hover:text-destructive"
              onClick={() => handleMarkWrong(skill.id)}
              disabled={flaggingSkillId !== null || flaggedSkillIds.has(skill.id)}
            >
              {flaggedSkillIds.has(skill.id) ? "Queued" : "Wrong"}
            </Button>
          </div>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2 pl-5">
        <Link
          href="/ai/skills"
          className="text-xs font-medium text-foreground underline-offset-4 hover:underline"
        >
          Review skills
        </Link>
      </div>
    </details>
  );
}
