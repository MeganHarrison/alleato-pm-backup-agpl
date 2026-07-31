"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Play, Search, X } from "lucide-react";
import { toast } from "sonner";
import { PageShell } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { CaseList } from "../_components/CaseList";
import type { SuiteType, TestCase } from "../_components/types";

interface SuiteMeta {
  tool_name: string;
  display_name: string;
  suite_type: SuiteType;
}

// Tool detail page. Smoke | Feature is the primary first-class axis —
// rendered as tonal tabs (not a dropdown, not a filter). Starting a run
// uses the currently-selected suite_type.
export default function ToolPage() {
  const params = useParams<{ tool: string }>()!;
  const searchParams = useSearchParams()!;
  const router = useRouter();
  const toolName = params.tool;

  const initialType: SuiteType =
    searchParams.get("type") === "feature" ? "feature" : "smoke";
  const [suiteType, setSuiteType] = useState<SuiteType>(initialType);
  const [cases, setCases] = useState<TestCase[]>([]);
  const [suite, setSuite] = useState<SuiteMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [starting, setStarting] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const loadCases = useCallback(async () => {
    setLoading(true);
    setError(null);
    setCases([]);
    try {
      const d = await apiFetch<{
        suite: SuiteMeta;
        grouped: Record<string, TestCase[]>;
      }>(`/api/testing/suites/${toolName}/cases?suiteType=${suiteType}`);
      setSuite(d.suite);
      const flat = Object.values(d.grouped ?? {}).flat() as TestCase[];
      setCases(flat);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load cases.");
    } finally {
      setLoading(false);
    }
  }, [toolName, suiteType]);

  useEffect(() => {
    void loadCases();
  }, [loadCases]);

  const filtered = useMemo(() => {
    if (!search.trim()) return cases;
    const q = search.toLowerCase();
    return cases.filter(
      (c) =>
        c.test_name.toLowerCase().includes(q) ||
        c.test_number.toLowerCase().includes(q) ||
        c.category.toLowerCase().includes(q),
    );
  }, [cases, search]);

  const startRun = async () => {
    setStarting(true);
    try {
      const { run_id } = await apiFetch<{ run_id: string }>(
        "/api/testing/runs",
        {
          method: "POST",
          body: JSON.stringify({ suite: toolName, suiteType }),
        },
      );
      router.push(`/testing/runs/${run_id}`);
    } catch (e) {
      toast.error("Unable to start run", {
        description: e instanceof Error ? e.message : "Unknown error",
      });
    } finally {
      setStarting(false);
    }
  };

  const switchType = (next: SuiteType) => {
    setSuiteType(next);
    const url = new URL(window.location.href);
    url.searchParams.set("type", next);
    router.replace(url.pathname + "?" + url.searchParams.toString(), {
      scroll: false,
    });
  };

  return (
    <PageShell
      variant="content"
      title={suite?.display_name ?? toolName}
      description="Browse test cases or start a new run for this tool."
      onBack={() => router.push("/testing")}
      backLabel="All tools"
      actions={
        <Button onClick={startRun} disabled={starting || cases.length === 0}>
          <Play className="h-4 w-4" />
          {starting ? "Starting…" : `Run ${suiteType}`}
        </Button>
      }
    >
      {/* Single toolbar row: tabs + expandable search + count */}
      <div className="flex items-center gap-3">
        {/* Suite-type toggle */}
        <div className="flex items-center gap-1 rounded-full border border-border p-1">
          {(["smoke", "feature"] as const).map((t) => (
            <Button
              key={t}
              type="button"
              variant="ghost"
              onClick={() => switchType(t)}
              className={cn(
                "rounded-full px-4 py-1.5 h-auto text-xs font-medium transition-colors",
                suiteType === t
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t === "smoke" ? "Smoke tests" : "Feature tests"}
            </Button>
          ))}
        </div>

        <div className="flex flex-1 items-center justify-end gap-2">
          {/* Expandable search */}
          <div className="flex items-center gap-1">
            {searchOpen && (
              <Input
                ref={searchInputRef}
                autoFocus
                placeholder="Search cases…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 w-48 text-xs"
              />
            )}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => {
                if (searchOpen) {
                  setSearch("");
                  setSearchOpen(false);
                } else {
                  setSearchOpen(true);
                }
              }}
              className="h-8 w-8 rounded-full text-muted-foreground"
            >
              {searchOpen ? <X className="h-3.5 w-3.5" /> : <Search className="h-3.5 w-3.5" />}
            </Button>
          </div>

          <p className="text-xs text-muted-foreground whitespace-nowrap">
            {filtered.length} of {cases.length} cases
          </p>
        </div>
      </div>

      {error && (
        <p className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading cases…</p>
      ) : (
        <CaseList
          cases={filtered}
          toolName={toolName}
          emptyTitle={`No ${suiteType} cases`}
          emptyDescription={
            cases.length === 0
              ? `No cases seeded for the ${suiteType} suite yet.`
              : "No cases match your search."
          }
        />
      )}
    </PageShell>
  );
}
