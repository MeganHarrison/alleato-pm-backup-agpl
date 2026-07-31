"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { GitBranch, LayoutList, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import {
  UnifiedTablePage,
  useUnifiedTableState,
  type FilterValue,
} from "@/components/tables/unified";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api-client";

import {
  buildAiAgentColumns,
  aiAgentDefaultVisibleColumns,
  aiAgentFilters,
  type AiAgent,
} from "@/features/ai-agents/ai-agents-table-config";
import { AiAgentDetailPanel } from "@/features/ai-agents/ai-agent-detail-panel";

// Lazy-load the dependency-graph view so the heavy `@xyflow/react` bundle only
// loads when the user switches to the graph (the table view is the default).
// ssr:false because the flow renderer is browser-only.
const AiAgentDag = dynamic(
  () => import("@/features/ai-agents/ai-agent-dag").then((mod) => mod.AiAgentDag),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-foreground/40 border-t-foreground" />
      </div>
    ),
  },
);

// ─── Data fetching ───────────────────────────────────────────────────

function useAiAgents(filters: Record<string, FilterValue>) {
  const [agents, setAgents] = React.useState<AiAgent[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isFetching, setIsFetching] = React.useState(false);
  const [error, setError] = React.useState<Error | null>(null);

  const fetchAgents = React.useCallback(async () => {
    setIsFetching(true);
    try {
      const params = new URLSearchParams();
      if (filters.status) params.set("status", String(filters.status));
      if (filters.domain) params.set("domain", String(filters.domain));
      if (filters.impact) params.set("impact", String(filters.impact));
      const res = await apiFetch<{ agents: AiAgent[] }>(
        `/api/admin/ai-agents${params.size ? `?${params}` : ""}`,
      );
      setAgents(res.agents ?? []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsLoading(false);
      setIsFetching(false);
    }
  }, [filters.status, filters.domain, filters.impact]);

  React.useEffect(() => {
    void fetchAgents();
  }, [fetchAgents]);

  return { data: agents, isLoading, isFetching, error, refetch: fetchAgents };
}

// ─── Page ────────────────────────────────────────────────────────────

const EMPTY_FILTERS: Record<string, FilterValue> = {
  status: undefined,
  domain: undefined,
  impact: undefined,
};

type ViewMode = "table" | "graph";

// Inner component: uses useSearchParams() so must be inside its own Suspense
function AiAgentsPageInner() {
  const pathname = usePathname()!;
  const router = useRouter();
  const searchParams = useSearchParams();

  const [selectedAgent, setSelectedAgent] = React.useState<AiAgent | null>(null);
  const [viewMode, setViewMode] = React.useState<ViewMode>("table");

  const tableState = useUnifiedTableState({
    entityKey: "ai-agents-admin",
    searchParams,
    pathname,
    router,
    defaults: {
      view: "table",
      allowedViews: ["table"],
      page: 1,
      perPage: 25,
      search: "",
      sortBy: "priority",
      sortDirection: "desc",
      visibleColumns: aiAgentDefaultVisibleColumns,
      filters: EMPTY_FILTERS,
    },
  });

  const activeFilters = React.useMemo<Record<string, FilterValue>>(
    () => ({
      status: searchParams?.get("status") ?? undefined,
      domain: searchParams?.get("domain") ?? undefined,
      impact: searchParams?.get("impact") ?? undefined,
    }),
    [searchParams],
  );

  const hasActiveFilters = Object.values(activeFilters).some(Boolean);

  const { data: agents, isLoading, isFetching, error, refetch } = useAiAgents(activeFilters);

  // Silent inline-cell persistence: PATCH then refetch, no toast.
  const handleInlineUpdate = React.useCallback(
    async (id: string, data: Record<string, unknown>) => {
      await apiFetch("/api/admin/ai-agents", {
        method: "PATCH",
        body: JSON.stringify({ id, ...data }),
      });
      await refetch();
    },
    [refetch],
  );

  const filteredAgents = React.useMemo(() => {
    if (!tableState.debouncedSearch) return agents;
    const q = tableState.debouncedSearch.toLowerCase();
    return agents.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        a.slug.toLowerCase().includes(q) ||
        a.purpose?.toLowerCase().includes(q) ||
        a.domain?.toLowerCase().includes(q),
    );
  }, [agents, tableState.debouncedSearch]);

  React.useEffect(() => {
    if (!selectedAgent) return;
    const refreshed = agents.find((agent) => agent.id === selectedAgent.id);
    if (refreshed && refreshed !== selectedAgent) {
      setSelectedAgent(refreshed);
    }
  }, [agents, selectedAgent]);

  const columns = React.useMemo(
    () => buildAiAgentColumns({ onUpdate: handleInlineUpdate }),
    [handleInlineUpdate],
  );

  function handleFilterChange(filters: Record<string, FilterValue>) {
    tableState.setSearchParams({
      ...filters,
      page: "1",
    });
  }

  async function handleRefresh() {
    await refetch();
    toast.success("Agent registry refreshed");
  }

  async function handleAgentUpdated(agent: AiAgent) {
    setSelectedAgent(agent);
    await refetch();
  }

  const resolvedError =
    error instanceof Error ? error : error ? new Error(String(error)) : null;

  const headerActions = (
    <div className="flex items-center gap-1.5">
      <Button
        size="sm"
        variant={viewMode === "table" ? "secondary" : "outline"}
        onClick={() => setViewMode("table")}
      >
        <LayoutList className="h-4 w-4 mr-2" />
        Table
      </Button>
      <Button
        size="sm"
        variant={viewMode === "graph" ? "secondary" : "outline"}
        onClick={() => setViewMode("graph")}
      >
        <GitBranch className="h-4 w-4 mr-2" />
        Graph
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={handleRefresh}
        disabled={isFetching}
      >
        <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
      </Button>
    </div>
  );

  return (
    <>
      {viewMode === "graph" ? (
        <div className="flex flex-col h-screen">
          <div className="flex items-center justify-between px-6 py-4 border-b border-border">
            <div>
              <span className="text-sm font-semibold text-foreground">AI Agent Registry</span>
              <p className="text-xs text-muted-foreground mt-0.5">
                {agents.length} agents — dependency graph
              </p>
            </div>
            {headerActions}
          </div>
          <div className="flex-1 min-h-0">
            <AiAgentDag
              agents={filteredAgents}
              onNodeClick={setSelectedAgent}
              selectedAgentId={selectedAgent?.slug ?? null}
            />
          </div>
        </div>
      ) : (
        <UnifiedTablePage
          header={{
            title: "AI Agent Registry",
            description: `${agents.length} agents — pipeline, chat, and write tools`,
            actions: headerActions,
          }}
          toolbar={{
            totalItems: agents.length,
            filteredItems: filteredAgents.length,
            searchValue: tableState.searchInput,
            onSearchChange: tableState.setSearchInput,
            searchPlaceholder: "Search agents...",
            currentView: tableState.currentView,
            onViewChange: tableState.setCurrentView,
            filters: aiAgentFilters,
            activeFilters,
            onFilterChange: handleFilterChange,
            onClearFilters: () => handleFilterChange(EMPTY_FILTERS),
          }}
          data={{
            items: filteredAgents,
            isLoading,
            isFetching,
            error: resolvedError,
          }}
          table={{
            columns,
            getRowId: (a) => a.id,
            onRowClick: (a) => setSelectedAgent(a),
            activeRowId: selectedAgent?.id ?? null,
            stickyHeader: true,
          }}
          emptyState={{
            title: "No agents found",
            description: "The AI agent registry is empty.",
            filteredDescription: "No agents match your current filters.",
            isFiltered: Boolean(tableState.debouncedSearch) || hasActiveFilters,
          }}
          layout={{ fullBleedTable: true }}
        />
      )}

      <AiAgentDetailPanel
        agent={selectedAgent}
        onClose={() => setSelectedAgent(null)}
        onAgentUpdated={handleAgentUpdated}
      />
    </>
  );
}

// Outer wrapper provides its own Suspense so useSearchParams() resolves correctly
export default function AiAgentsPage() {
  return (
    <React.Suspense fallback={null}>
      <AiAgentsPageInner />
    </React.Suspense>
  );
}
