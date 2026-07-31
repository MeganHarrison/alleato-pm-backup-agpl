"use client";

import { useState } from "react";
import { ChevronRight, FlaskConical } from "lucide-react";
import { EmptyState } from "@/components/ds";
import { cn } from "@/lib/utils";
import type { TestCase } from "./types";

export function CaseList({
  cases,
  emptyTitle = "No test cases",
  emptyDescription = "Cases will appear here once added to this suite.",
}: {
  cases: TestCase[];
  toolName: string;
  emptyTitle?: string;
  emptyDescription?: string;
}) {
  const [openId, setOpenId] = useState<string | null>(null);

  if (cases.length === 0) {
    return (
      <EmptyState
        icon={<FlaskConical />}
        title={emptyTitle}
        description={emptyDescription}
      />
    );
  }

  return (
    <ul className="space-y-0">
      {cases.map((c) => {
        const isOpen = openId === c.id;
        return (
          <li key={c.id} className={cn("rounded-md transition-colors", isOpen && "bg-muted/40")}>
            <button
              type="button"
              onClick={() => setOpenId(isOpen ? null : c.id)}
              className="group w-full flex items-center gap-2 px-3 py-4 text-left"
            >
              <span className="w-10 shrink-0 font-mono text-xs text-muted-foreground">
                {c.test_number}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground group-hover:text-primary">
                {c.test_name}
              </span>
              <ChevronRight
                className={cn(
                  "h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-150",
                  isOpen && "rotate-90",
                )}
              />
            </button>

            {isOpen && (
              <div className="px-3 pb-5 pl-19 space-y-4">
                {c.context_note && (
                  <DetailSection label="Context">
                    <p className="text-sm text-muted-foreground">{c.context_note}</p>
                  </DetailSection>
                )}
                {c.setup_steps && (
                  <DetailSection label="Setup">
                    <StepList text={c.setup_steps} />
                  </DetailSection>
                )}
                {c.steps && (
                  <DetailSection label="Steps">
                    <StepList text={c.steps} />
                  </DetailSection>
                )}
                {c.expected_result && (
                  <DetailSection label="Expected result">
                    <p className="text-sm text-muted-foreground">{c.expected_result}</p>
                  </DetailSection>
                )}
                {c.start_url && (
                  <DetailSection label="Start URL">
                    <a
                      href={c.start_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-primary underline underline-offset-4 hover:text-primary/80"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {c.start_url}
                    </a>
                  </DetailSection>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function DetailSection({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-foreground/80">
        {label}
      </p>
      {children}
    </div>
  );
}

/** Renders a newline- or numbered-list-style steps string as a clean <ol>/<ul>. */
function StepList({ text }: { text: string }) {
  const lines = text
    .split("\n")
    .map((l) => l.replace(/^\d+[.)]\s*/, "").trim())
    .filter(Boolean);

  if (lines.length === 1) {
    return <p className="text-sm text-muted-foreground">{lines[0]}</p>;
  }

  return (
    <ol className="list-decimal list-inside space-y-1">
      {lines.map((line) => (
        <li key={line} className="text-sm text-muted-foreground">
          {line}
        </li>
      ))}
    </ol>
  );
}
