"use client";

import * as React from "react";
import { ArrowRight, RefreshCw } from "lucide-react";

import {
  DetailField,
  InfoAlert,
  InlineTable,
  InlineTableBody,
  InlineTableCell,
  InlineTableHeader,
  InlineTableHeaderCell,
  InlineTableHeaderRow,
  InlineTableRow,
} from "@/components/ds";
import { Button } from "@/components/ui/button";
import {
  SidePanel,
  SidePanelBody,
  SidePanelContent,
  SidePanelHeader,
  SidePanelTitle,
} from "@/components/ui/side-panel";
import { apiFetch } from "@/lib/api-client";
import { cn } from "@/lib/utils";

import type {
  AiChatHistoryItemView,
  AiChatHistoryResponse,
  AiChatHistoryToolView,
  AiChatHistoryWriteStatus,
} from "@/app/api/admin/ai-chat-history/route";

const WRITE_STATUS_LABELS: Record<AiChatHistoryWriteStatus, string> = {
  no_write_tools: "No write",
  preview_only: "Preview",
  confirmed: "Confirmed",
  failed: "Failed",
  unknown: "Unknown",
};

const WRITE_STATUS_STYLES: Record<AiChatHistoryWriteStatus, string> = {
  no_write_tools: "text-muted-foreground",
  preview_only: "text-amber-700",
  confirmed: "text-emerald-700",
  failed: "text-destructive",
  unknown: "text-foreground",
};

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

function formatTokenUsage(item: AiChatHistoryItemView): string {
  const total = item.tokenUsage.totalTokens;
  if (total !== null) return formatNumber(total);
  const input = item.tokenUsage.inputTokens ?? 0;
  const output = item.tokenUsage.outputTokens ?? 0;
  return input || output ? formatNumber(input + output) : "-";
}

function toolSummary(tools: AiChatHistoryToolView[]): string {
  if (tools.length === 0) return "-";
  const names = tools.map((tool) => tool.name);
  const unique = Array.from(new Set(names));
  return unique.length <= 3
    ? unique.join(", ")
    : `${unique.slice(0, 3).join(", ")} +${unique.length - 3}`;
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

function DetailRows({
  rows,
}: {
  rows: Array<{ label: string; value: React.ReactNode }>;
}) {
  return (
    <div className="space-y-3">
      {rows.map((row) => (
        <DetailField key={row.label} label={row.label}>
          {row.value}
        </DetailField>
      ))}
    </div>
  );
}

function TraceLink({ item }: { item: AiChatHistoryItemView }) {
  if (!item.traceId) {
    return <span className="text-destructive">Missing trace id</span>;
  }

  if (!item.traceUrl) {
    return <span className="font-mono text-xs">{item.traceId}</span>;
  }

  return (
    <a
      className="inline-flex min-w-0 items-center gap-1 font-mono text-xs text-primary hover:underline"
      href={item.traceUrl}
      target="_blank"
      rel="noreferrer"
    >
      <span className="truncate">{item.traceId}</span>
      <ArrowRight className="h-3 w-3 shrink-0" />
    </a>
  );
}

function ToolRows({ tools }: { tools: AiChatHistoryToolView[] }) {
  if (tools.length === 0) {
    return <div className="text-sm text-muted-foreground">No tools recorded.</div>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead className="text-left text-muted-foreground">
          <tr className="border-b">
            <th className="py-2 pr-3 font-medium">Tool</th>
            <th className="py-2 pr-3 font-medium">Status</th>
            <th className="py-2 pr-3 font-medium">Write</th>
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

function ScoreRows({ item }: { item: AiChatHistoryItemView }) {
  if (item.scores.length === 0) {
    return (
      <div className="text-sm text-muted-foreground">
        No persisted scores recorded for this message.
      </div>
    );
  }

  return (
    <div className="divide-y divide-border/60 text-sm">
      {item.scores.map((score) => (
        <div key={score.name} className="grid gap-3 py-2 sm:grid-cols-[140px_96px_1fr]">
          <div className="font-medium text-foreground">{score.name}</div>
          <div className="font-mono text-xs text-muted-foreground">
            {String(score.value)}
          </div>
          <div className="text-muted-foreground">{score.comment ?? "-"}</div>
        </div>
      ))}
    </div>
  );
}

function TraceDrawer({
  item,
  onOpenChange,
}: {
  item: AiChatHistoryItemView | null;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <SidePanel open={Boolean(item)} onOpenChange={onOpenChange}>
      <SidePanelContent size="lg">
        {item && (
          <>
            <SidePanelHeader>
              <SidePanelTitle>Trace detail</SidePanelTitle>
            </SidePanelHeader>

            <SidePanelBody className="space-y-6">
            <section className="space-y-3">
              <DetailRows
                rows={[
                  { label: "Conversation", value: item.conversationTitle },
                  {
                    label: "Message",
                    value: <span className="font-mono text-xs">{item.id}</span>,
                  },
                  { label: "Trace", value: <TraceLink item={item} /> },
                  {
                    label: "Write status",
                    value: (
                      <span
                      className={cn(
                        "font-medium",
                        WRITE_STATUS_STYLES[item.writeStatus],
                      )}
                      >
                        {WRITE_STATUS_LABELS[item.writeStatus]}
                      </span>
                    ),
                  },
                  { label: "Reason", value: item.writeStatusReason },
                  { label: "Model", value: item.model ?? "-" },
                  { label: "Provider", value: item.providerPath ?? "-" },
                  { label: "Finish", value: item.finishReason ?? "-" },
                  { label: "Created", value: formatDateTime(item.createdAt) },
                ]}
              />
            </section>

            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-foreground">Token usage</h2>
              <DetailRows
                rows={[
                  {
                    label: "Input",
                    value: formatNumber(item.tokenUsage.inputTokens),
                  },
                  {
                    label: "Output",
                    value: formatNumber(item.tokenUsage.outputTokens),
                  },
                  {
                    label: "Total",
                    value: formatNumber(item.tokenUsage.totalTokens),
                  },
                ]}
              />
            </section>

            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-foreground">Scores</h2>
              <ScoreRows item={item} />
            </section>

            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-foreground">Tools</h2>
              <ToolRows tools={item.tools} />
            </section>

            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-foreground">Response preview</h2>
              <p className="text-sm leading-6 text-muted-foreground">
                {item.contentPreview || "-"}
              </p>
            </section>
            </SidePanelBody>
          </>
        )}
      </SidePanelContent>
    </SidePanel>
  );
}

export function AiChatHistoryClient() {
  const [items, setItems] = React.useState<AiChatHistoryItemView[]>([]);
  const [selectedItem, setSelectedItem] =
    React.useState<AiChatHistoryItemView | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const loadItems = React.useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await apiFetch<AiChatHistoryResponse>(
        "/api/admin/ai-chat-history?limit=75",
      );
      setItems(response.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "AI chat history failed to load.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadItems();
  }, [loadItems]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="text-sm text-muted-foreground">
          {isLoading ? "Loading..." : `${items.length} assistant turns`}
        </div>
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

      {error && (
        <InfoAlert variant="error" role="alert">
          <div className="space-y-1">
            <div className="font-medium">AI chat history failed to load</div>
            <div>{error}</div>
          </div>
        </InfoAlert>
      )}

      <InlineTable variant="read">
        <InlineTableHeader>
          <InlineTableHeaderRow>
            <InlineTableHeaderCell>Conversation</InlineTableHeaderCell>
            <InlineTableHeaderCell>Trace</InlineTableHeaderCell>
            <InlineTableHeaderCell>Write</InlineTableHeaderCell>
            <InlineTableHeaderCell>Tools</InlineTableHeaderCell>
            <InlineTableHeaderCell>Tokens</InlineTableHeaderCell>
            <InlineTableHeaderCell>Score</InlineTableHeaderCell>
            <InlineTableHeaderCell>Created</InlineTableHeaderCell>
            <InlineTableHeaderCell className="text-right">Open</InlineTableHeaderCell>
          </InlineTableHeaderRow>
        </InlineTableHeader>
        <InlineTableBody>
          {items.map((item) => {
            const responseQuality = item.scores.find(
              (score) => score.name === "response_quality",
            );
            return (
              <InlineTableRow key={item.id}>
                <InlineTableCell className="max-w-sm">
                  <div className="space-y-1">
                    <div className="truncate font-medium text-foreground">
                      {item.conversationTitle}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {item.contentPreview || "-"}
                    </div>
                  </div>
                </InlineTableCell>
                <InlineTableCell>
                  {item.traceId ? (
                    <span className="font-mono text-xs text-muted-foreground">
                      {item.traceId.slice(0, 8)}
                    </span>
                  ) : (
                    <span className="text-xs text-destructive">Missing</span>
                  )}
                </InlineTableCell>
                <InlineTableCell>
                  <span
                    className={cn(
                      "text-sm font-medium",
                      WRITE_STATUS_STYLES[item.writeStatus],
                    )}
                  >
                    {WRITE_STATUS_LABELS[item.writeStatus]}
                  </span>
                </InlineTableCell>
                <InlineTableCell className="max-w-xs truncate text-muted-foreground">
                  {toolSummary(item.tools)}
                </InlineTableCell>
                <InlineTableCell className="font-mono text-xs text-muted-foreground">
                  {formatTokenUsage(item)}
                </InlineTableCell>
                <InlineTableCell className="font-mono text-xs text-muted-foreground">
                  {responseQuality ? String(responseQuality.value) : "-"}
                </InlineTableCell>
                <InlineTableCell className="text-muted-foreground">
                  {formatDateTime(item.createdAt)}
                </InlineTableCell>
                <InlineTableCell className="text-right">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedItem(item)}
                  >
                    Inspect
                  </Button>
                </InlineTableCell>
              </InlineTableRow>
            );
          })}
          {!isLoading && items.length === 0 && (
            <InlineTableRow>
              <InlineTableCell
                colSpan={8}
                className="py-8 text-center text-muted-foreground"
              >
                No assistant turns found.
              </InlineTableCell>
            </InlineTableRow>
          )}
        </InlineTableBody>
      </InlineTable>

      <TraceDrawer
        item={selectedItem}
        onOpenChange={(open) => {
          if (!open) setSelectedItem(null);
        }}
      />
    </div>
  );
}
