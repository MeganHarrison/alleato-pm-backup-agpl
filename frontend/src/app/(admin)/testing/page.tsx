"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PageShell } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api-client";
import { EmptyState } from "@/components/ds";
import { FlaskConical, Play, ChevronRight } from "lucide-react";
import { SuiteBadge } from "./_components/SuiteBadge";
import type { Suite } from "./_components/types";

// Testing index. Premium grid of tools: one row per tool, showing smoke +
// feature suite counts side-by-side. No card-trap — hairline dividers and
// whitespace do the work.
export default function TestingIndexPage() {
  const [suites, setSuites] = useState<Suite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<{ suites?: Suite[] }>("/api/testing/suites")
      .then((d) => setSuites(d.suites ?? []))
      .catch((e) =>
        setError(e instanceof Error ? e.message : "Unable to load suites."),
      )
      .finally(() => setLoading(false));
  }, []);

  // Group suites by tool_name so smoke + feature appear on the same row.
  const byTool = useMemo(() => {
    const map = new Map<
      string,
      { display_name: string; smoke?: Suite; feature?: Suite }
    >();
    for (const s of suites) {
      const existing = map.get(s.tool_name) ?? {
        display_name: s.display_name,
      };
      existing[s.suite_type] = s;
      existing.display_name = s.display_name;
      map.set(s.tool_name, existing);
    }
    return Array.from(map.entries()).sort((a, b) =>
      a[1].display_name.localeCompare(b[1].display_name),
    );
  }, [suites]);

  return (
    <PageShell
      variant="content"
      title="Testing"
      description="Smoke and feature test suites for every tool."
      actions={
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/testing/runs">Runs</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/testing/parity">Parity</Link>
          </Button>
        </div>
      }
    >
      {error && (
        <p className="mb-4 rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading suites…</p>
      ) : byTool.length === 0 ? (
        <EmptyState
          icon={<FlaskConical />}
          title="No test suites yet"
          description="Seed smoke and feature suites to get started."
        />
      ) : (
        <ul className="divide-y divide-border">
          {byTool.map(([toolName, { display_name, smoke, feature }]) => (
            <li
              key={toolName}
              className="flex items-center gap-4 px-1 py-5"
            >
              <div className="min-w-0 flex-1">
                <Link
                  href={`/testing/${toolName}`}
                  className="group flex items-center gap-2"
                >
                  <p className="truncate text-base font-medium text-foreground group-hover:text-primary">
                    {display_name.replace(/\s*[—–-]\s*(smoke|feature)$/i, "")}
                  </p>
                  <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                </Link>
                <div className="mt-1 flex items-center gap-4 text-xs text-muted-foreground">
                  <SuiteCount label="smoke" suite={smoke} />
                  <SuiteCount label="feature" suite={feature} />
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {smoke && (
                  <Button asChild size="sm" variant="outline">
                    <Link
                      href={`/testing/${toolName}?type=smoke`}
                    >
                      <Play className="h-3.5 w-3.5" />
                      Smoke
                    </Link>
                  </Button>
                )}
                {feature && (
                  <Button asChild size="sm">
                    <Link
                      href={`/testing/${toolName}?type=feature`}
                    >
                      <Play className="h-3.5 w-3.5" />
                      Feature
                    </Link>
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </PageShell>
  );
}

function SuiteCount({
  label,
  suite,
}: {
  label: "smoke" | "feature";
  suite: Suite | undefined;
}) {
  if (!suite) {
    return (
      <span className="inline-flex items-center gap-1.5 text-muted-foreground/60">
        <SuiteBadge type={label} className="opacity-50" />
        <span>—</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5">
      <SuiteBadge type={label} />
      <span>{suite.case_count} cases</span>
    </span>
  );
}
