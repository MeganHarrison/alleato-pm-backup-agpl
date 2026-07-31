"use client";

import * as React from "react";
import { ArrowRight, RefreshCw } from "lucide-react";

import { EmptyState, ErrorState } from "@/components/ds";
import { ExpandableSearch } from "@/components/tables/unified/table-toolbar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiFetch } from "@/lib/api-client";
import { cn } from "@/lib/utils";

import type {
  AiAssistantDebugItemView,
  AiAssistantDebugResponse,
  AiAssistantDebugToolDiscoveryView,
  AiAssistantDebugToolView,
} from "@/app/api/admin/ai-assistant-debug/route";

function formatDateTime(value: string | null): string {
  if (!value) return "-";
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatNumber(value: number | null): string {
  if (value === null) return "-";
  return new Intl.NumberFormat("en-US").format(value);
}

function stringify(value: unknown): string {
  if (value === null || value === undefined) return "-";
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function hasValue(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value).length > 0;
  if (typeof value === "string") return value.trim().length > 0;
  return true;
}

function tokenTotal(item: AiAssistantDebugItemView): string {
  const total = item.tokenUsage.totalTokens;
  if (total !== null) return formatNumber(total);
  const input = item.tokenUsage.inputTokens ?? 0;
  const output = item.tokenUsage.outputTokens ?? 0;
  return input || output ? formatNumber(input + output) : "-";
}

function toolSummary(tools: AiAssistantDebugToolView[]): string {
  if (tools.length === 0) return "No model tools";
  const names = Array.from(new Set(tools.map((tool) => tool.name)));
  return names.length <= 2
    ? names.join(", ")
    : `${names.slice(0, 2).join(", ")} +${names.length - 2}`;
}

function signalState(value: unknown): "recorded" | "missing" {
  return hasValue(value) ? "recorded" : "missing";
}

function SignalRow({
  label,
  state,
  value,
}: {
  label: string;
  state: "recorded" | "missing";
  value?: React.ReactNode;
}) {
  return (
    <div className="grid gap-2 py-3 text-sm sm:grid-cols-[160px_96px_1fr]">
      <div className="font-medium text-foreground">{label}</div>
      <div
        className={cn(
          "font-mono text-xs uppercase tracking-wide",
          state === "recorded" ? "text-emerald-700" : "text-destructive",
        )}
      >
        {state}
      </div>
      <div className="min-w-0 text-muted-foreground">{value ?? "-"}</div>
    </div>
  );
}

function JsonBlock({ value }: { value: unknown }) {
  return (
    <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-words rounded-md bg-muted/40 p-3 font-mono text-[11px] leading-5 text-muted-foreground">
      {stringify(value)}
    </pre>
  );
}

function ToolsTable({ tools }: { tools: AiAssistantDebugToolView[] }) {
  if (tools.length === 0) {
    return (
      <div className="py-4 text-sm text-destructive">
        No model-selected tool calls were recorded for this answer.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead className="text-left text-muted-foreground">
          <tr className="border-b">
            <th className="py-2 pr-3 font-medium">Tool</th>
            <th className="py-2 pr-3 font-medium">Status</th>
            <th className="py-2 pr-3 font-medium">Kind</th>
            <th className="py-2 pr-3 font-medium">Input</th>
            <th className="py-2 pr-3 font-medium">Output</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {tools.map((tool, index) => (
            <tr key={`${tool.name}-${index}`}>
              <td className="py-2 pr-3 align-top font-medium text-foreground">
                {tool.name}
              </td>
              <td className="py-2 pr-3 align-top text-muted-foreground">
                {tool.status}
              </td>
              <td className="py-2 pr-3 align-top text-muted-foreground">
                {tool.writeKind}
              </td>
              <td className="max-w-xs py-2 pr-3 align-top">
                <pre className="whitespace-pre-wrap break-words font-mono text-[11px] text-muted-foreground">
                  {stringify(tool.input)}
                </pre>
              </td>
              <td className="max-w-sm py-2 pr-3 align-top">
                <pre className="whitespace-pre-wrap break-words font-mono text-[11px] text-muted-foreground">
                  {tool.error ?? stringify(tool.output)}
                </pre>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DiscoveryTable({
  discoveries,
}: {
  discoveries: AiAssistantDebugToolDiscoveryView[];
}) {
  if (discoveries.length === 0) {
    return (
      <div className="py-4 text-sm text-muted-foreground">
        No MCP/tool discovery bookkeeping was recorded.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead className="text-left text-muted-foreground">
          <tr className="border-b">
            <th className="py-2 pr-3 font-medium">Server</th>
            <th className="py-2 pr-3 font-medium">Status</th>
            <th className="py-2 pr-3 font-medium">Discovered</th>
            <th className="py-2 pr-3 font-medium">Exposed</th>
            <th className="py-2 pr-3 font-medium">Denied</th>
            <th className="py-2 pr-3 font-medium">Enabled tools</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {discoveries.map((discovery) => (
            <tr key={discovery.server}>
              <td className="py-2 pr-3 align-top font-medium text-foreground">
                {discovery.server}
              </td>
              <td className="py-2 pr-3 align-top text-muted-foreground">
                {discovery.status}
                {discovery.error ? `: ${discovery.error}` : ""}
              </td>
              <td className="py-2 pr-3 align-top text-muted-foreground">
                {formatNumber(discovery.discoveredToolCount)}
              </td>
              <td className="py-2 pr-3 align-top text-muted-foreground">
                {formatNumber(discovery.enabledToolCount)}
              </td>
              <td className="py-2 pr-3 align-top text-muted-foreground">
                {formatNumber(discovery.deniedToolCount)}
              </td>
              <td className="max-w-md py-2 pr-3 align-top text-muted-foreground">
                {discovery.enabledTools.length > 0
                  ? discovery.enabledTools.join(", ")
                  : "-"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DetailHeader({ item }: { item: AiAssistantDebugItemView }) {
  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 space-y-1">
          <h2 className="truncate text-lg font-semibold text-foreground">
            {item.conversationTitle}
          </h2>
          <div className="text-sm text-muted-foreground">
            {formatDateTime(item.createdAt)} · {item.providerPath ?? "Missing provider"} ·{" "}
            {item.model ?? "Missing model"}
          </div>
          <div className="text-xs text-muted-foreground">
            Model-selected tools: {item.tools.length} · Discovery records:{" "}
            {item.toolDiscovery.length} · Quality score:{" "}
            {item.responseQuality?.score ?? "-"}
          </div>
        </div>
        {item.traceUrl ? (
          <Button asChild variant="outline" size="sm">
            <a href={item.traceUrl} target="_blank" rel="noreferrer">
              <ArrowRight className="mr-2 h-4 w-4" />
              Trace
            </a>
          </Button>
        ) : (
          <div className="text-sm font-medium text-destructive">Missing trace id</div>
        )}
      </div>

      {item.missingInstrumentation.length > 0 && (
        <div className="text-sm text-destructive">
          Missing instrumentation: {item.missingInstrumentation.join(", ")}
        </div>
      )}
    </div>
  );
}

function FlowTab({ item }: { item: AiAssistantDebugItemView }) {
  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-foreground">Run Path</h3>
        <div className="divide-y">
          <SignalRow
            label="Provider path"
            state={signalState(item.providerPath)}
            value={item.providerPath}
          />
          <SignalRow label="Model" state={signalState(item.model)} value={item.model} />
          <SignalRow
            label="Finish reason"
            state={signalState(item.finishReason)}
            value={item.finishReason}
          />
          <SignalRow
            label="Backend deep agent"
            state={signalState(item.backendDeepAgent)}
            value={<JsonBlock value={item.backendDeepAgent} />}
          />
          <SignalRow
            label="Retrieval plan"
            state={signalState(item.retrievalPlan)}
            value={<JsonBlock value={item.retrievalPlan} />}
          />
          <SignalRow
            label="Memory usage"
            state={signalState(item.memoryUsage)}
            value={<JsonBlock value={item.memoryUsage} />}
          />
          <SignalRow
            label="Expected native tool"
            state={signalState(item.expectedNativeTool)}
            value={item.expectedNativeTool}
          />
          <SignalRow
            label="Change event workflow"
            state={signalState(item.changeEventWorkflow)}
            value={<JsonBlock value={item.changeEventWorkflow} />}
          />
          <SignalRow
            label="Model-selected calls"
            state="recorded"
            value={formatNumber(item.tools.length)}
          />
          <SignalRow
            label="Discovery records"
            state="recorded"
            value={formatNumber(item.toolDiscovery.length)}
          />
          <SignalRow
            label="Raw trace entries"
            state="recorded"
            value={`${formatNumber(item.rawToolTraceCount)} total before filtering discovery`}
          />
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground">
          Model-Selected Tool Calls
        </h3>
        <ToolsTable tools={item.tools} />
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground">
          Tool Availability Discovery
        </h3>
        <p className="text-sm text-muted-foreground">
          These records show which MCP tools were available to the assistant.
          They are setup/discovery bookkeeping, not proof that the model used
          those tools to answer.
        </p>
        <DiscoveryTable discoveries={item.toolDiscovery} />
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-foreground">Quality</h3>
        <div className="divide-y">
          <SignalRow
            label="Quality score"
            state={signalState(item.responseQuality)}
            value={
              item.responseQuality
                ? `${item.responseQuality.score ?? "-"}${
                    item.responseQuality.reasons.length
                      ? ` · Reasons: ${item.responseQuality.reasons.join("; ")}`
                      : ""
                  }`
                : "-"
            }
          />
          <SignalRow label="Tokens" state="recorded" value={tokenTotal(item)} />
        </div>
      </section>
    </div>
  );
}

function SourcesTab({ item }: { item: AiAssistantDebugItemView }) {
  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground">Source Debug</h3>
        <JsonBlock value={item.sourceDebug} />
      </section>
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground">
          Persisted Sources ({item.sources.length})
        </h3>
        <JsonBlock value={item.sources} />
      </section>
    </div>
  );
}

function AnswerTab({ item }: { item: AiAssistantDebugItemView }) {
  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground">User Prompt</h3>
        <p className="whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
          {item.userPromptPreview || "-"}
        </p>
      </section>
      <Separator />
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground">Assistant Answer</h3>
        <p className="whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
          {item.assistantContent || "-"}
        </p>
      </section>
    </div>
  );
}

function RawTab({ item }: { item: AiAssistantDebugItemView }) {
  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground">Metadata</h3>
        <JsonBlock value={item.rawMetadata} />
      </section>
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground">Message</h3>
        <JsonBlock value={item} />
      </section>
    </div>
  );
}

export function AiAssistantDebugConsoleClient() {
  const [items, setItems] = React.useState<AiAssistantDebugItemView[]>([]);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState("");
  const [showMissingOnly, setShowMissingOnly] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const loadItems = React.useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await apiFetch<AiAssistantDebugResponse>(
        "/api/admin/ai-assistant-debug?limit=75",
      );
      setItems(response.items);
      setSelectedId((current) => current ?? response.items[0]?.id ?? null);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "AI assistant debug data failed to load.",
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadItems();
  }, [loadItems]);

  const filteredItems = React.useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return items.filter((item) => {
      if (showMissingOnly && item.missingInstrumentation.length === 0) {
        return false;
      }
      if (!normalizedQuery) return true;
      return [
        item.conversationTitle,
        item.userPromptPreview,
        item.assistantPreview,
        item.providerPath,
        item.model,
        item.traceId,
        item.sessionId,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalizedQuery));
    });
  }, [items, query, showMissingOnly]);

  const selectedItem =
    filteredItems.find((item) => item.id === selectedId) ??
    filteredItems[0] ??
    items.find((item) => item.id === selectedId) ??
    null;

  React.useEffect(() => {
    if (selectedItem && selectedItem.id !== selectedId) {
      setSelectedId(selectedItem.id);
    }
  }, [selectedId, selectedItem]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="max-w-xl flex-1">
          <ExpandableSearch
            value={query}
            onChange={setQuery}
            placeholder="Search conversations, prompts, trace ids, providers"
            ariaLabel="Search assistant debug runs"
            collapsible={false}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant={showMissingOnly ? "default" : "outline"}
            size="sm"
            onClick={() => setShowMissingOnly((value) => !value)}
          >
            Missing only
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void loadItems()}
            disabled={isLoading}
          >
            <RefreshCw className={cn("mr-2 h-4 w-4", isLoading && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>

      {error && (
        <ErrorState
          title="AI assistant debug data failed to load"
          error={error}
          onRetry={() => void loadItems()}
          className="py-8"
        />
      )}

      <div className="grid min-h-screen gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <aside className="min-h-0 overflow-hidden rounded-md border bg-background">
          <div className="border-b px-4 py-3 text-sm text-muted-foreground">
            {isLoading ? "Loading..." : `${filteredItems.length} assistant turns`}
          </div>
          <div className="max-h-screen overflow-auto divide-y">
            {filteredItems.map((item) => (
              <Button
                key={item.id}
                type="button"
                variant="ghost"
                className={cn(
                  "h-auto w-full justify-start rounded-none px-4 py-3 text-left whitespace-normal",
                  selectedItem?.id === item.id && "bg-muted",
                )}
                onClick={() => setSelectedId(item.id)}
              >
                <div className="space-y-1">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 truncate text-sm font-medium text-foreground">
                      {item.conversationTitle}
                    </div>
                    {item.missingInstrumentation.length > 0 && (
                      <div className="shrink-0 text-xs font-medium text-destructive">
                        Missing
                      </div>
                    )}
                  </div>
                  <div className="line-clamp-2 text-xs leading-5 text-muted-foreground">
                    {item.userPromptPreview || item.assistantPreview || "-"}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                    <span>{formatDateTime(item.createdAt)}</span>
                    <span>{item.providerPath ?? "No provider"}</span>
                    <span>{toolSummary(item.tools)}</span>
                    {item.toolDiscovery.length > 0 && (
                      <span>{item.toolDiscovery.length} discovery records</span>
                    )}
                  </div>
                </div>
              </Button>
            ))}
            {!isLoading && filteredItems.length === 0 && (
              <EmptyState
                title="No assistant turns found"
                description="No persisted assistant runs match the current filters."
                className="py-10"
              />
            )}
          </div>
        </aside>

        <main className="min-w-0 rounded-md border bg-background p-4 sm:p-6">
          {selectedItem ? (
            <div className="space-y-6">
              <DetailHeader item={selectedItem} />
              <Tabs defaultValue="flow" className="min-w-0">
                <TabsList>
                  <TabsTrigger value="flow">Flow</TabsTrigger>
                  <TabsTrigger value="sources">Sources</TabsTrigger>
                  <TabsTrigger value="answer">Answer</TabsTrigger>
                  <TabsTrigger value="raw">Raw</TabsTrigger>
                </TabsList>
                <TabsContent value="flow" className="pt-4">
                  <FlowTab item={selectedItem} />
                </TabsContent>
                <TabsContent value="sources" className="pt-4">
                  <SourcesTab item={selectedItem} />
                </TabsContent>
                <TabsContent value="answer" className="pt-4">
                  <AnswerTab item={selectedItem} />
                </TabsContent>
                <TabsContent value="raw" className="pt-4">
                  <RawTab item={selectedItem} />
                </TabsContent>
              </Tabs>
            </div>
          ) : (
            <EmptyState
              title="No assistant turn selected"
              description="Select a persisted run to inspect its routing and metadata."
              className="py-12"
            />
          )}
        </main>
      </div>
    </div>
  );
}
