"use client";

import { useMemo, useState, useTransition } from "react";
import { PlusIcon } from "lucide-react";

import { ErrorState } from "@/components/ds";
import {
  InlineTable,
  InlineTableBody,
  InlineTableCell,
  InlineTableHeader,
  InlineTableHeaderCell,
  InlineTableHeaderRow,
  InlineTableRow,
} from "@/components/ds/inline-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch } from "@/lib/api-client";
import {
  IDEA_PRIORITIES,
  IDEA_ROUTE_TYPES,
  IDEA_SOURCES,
  IDEA_STATUSES,
  type CreateIdeaInput,
  type IdeaItem,
  type IdeaPriority,
  type IdeaRouteType,
  type IdeaStatus,
} from "@/lib/ideas/types";

type IdeaApiResponse = { idea: IdeaItem };

function label(value: string): string {
  return value.replaceAll("_", " ");
}

function updatedLabel(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "The idea change could not be saved.";
}

export function IdeaInboxTable({ initialIdeas }: { initialIdeas: IdeaItem[] }) {
  const [ideas, setIdeas] = useState(initialIdeas);
  const [draftBody, setDraftBody] = useState("");
  const [draftContext, setDraftContext] = useState("");
  const [draftSource, setDraftSource] = useState<(typeof IDEA_SOURCES)[number]>("manual");
  const [error, setError] = useState<string | null>(null);
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const [isPending, startTransition] = useTransition();

  const sortedIdeas = useMemo(
    () =>
      [...ideas].sort(
        (a, b) =>
          new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
      ),
    [ideas],
  );

  function replaceIdea(updated: IdeaItem) {
    setIdeas((current) =>
      current.map((idea) => (idea.id === updated.id ? updated : idea)),
    );
    setRowErrors((current) => {
      const next = { ...current };
      delete next[updated.id];
      return next;
    });
  }

  async function addIdea() {
    setError(null);
    const body = draftBody.trim();
    if (!body) {
      setError("Add the idea text before saving.");
      return;
    }

    const payload: CreateIdeaInput = {
      body,
      source: draftSource,
      sourceContext: draftContext.trim() || null,
      metadata: {
        capture_surface: "ideas_table",
      },
    };

    startTransition(async () => {
      try {
        const response = await apiFetch<IdeaApiResponse>("/api/ideas", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        setIdeas((current) => [response.idea, ...current]);
        setDraftBody("");
        setDraftContext("");
        setDraftSource("manual");
      } catch (saveError) {
        setError(getErrorMessage(saveError));
      }
    });
  }

  function updateLocal(id: string, patch: Partial<IdeaItem>) {
    setIdeas((current) =>
      current.map((idea) => (idea.id === id ? { ...idea, ...patch } : idea)),
    );
  }

  async function savePatch(id: string, patch: Record<string, unknown>) {
    try {
      const response = await apiFetch<IdeaApiResponse>("/api/ideas", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, patch }),
      });
      replaceIdea(response.idea);
    } catch (saveError) {
      setRowErrors((current) => ({
        ...current,
        [id]: getErrorMessage(saveError),
      }));
    }
  }

  return (
    <div className="space-y-4">
      <section className="space-y-3">
        <Textarea
          value={draftBody}
          onChange={(event) => setDraftBody(event.target.value)}
          placeholder="Dump an idea..."
          rows={3}
          className="min-h-24"
        />
        <div className="grid gap-3 md:grid-cols-[1fr_180px_auto] md:items-center">
          <Input
            value={draftContext}
            onChange={(event) => setDraftContext(event.target.value)}
            placeholder="Source or context"
          />
          <Select value={draftSource} onValueChange={(value) => setDraftSource(value as typeof draftSource)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {IDEA_SOURCES.map((source) => (
                <SelectItem key={source} value={source}>
                  {label(source)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button type="button" onClick={addIdea} disabled={isPending}>
            <PlusIcon className="h-4 w-4" />
            Add idea
          </Button>
        </div>
        {error ? (
          <ErrorState
            title="Idea not saved"
            error={error}
            className="items-start py-2 text-left"
          />
        ) : null}
      </section>

      <div className="overflow-hidden rounded-md border border-border">
        <InlineTable>
          <InlineTableHeader>
            <InlineTableHeaderRow>
              <InlineTableHeaderCell className="min-w-96">Idea</InlineTableHeaderCell>
              <InlineTableHeaderCell>Status</InlineTableHeaderCell>
              <InlineTableHeaderCell>Priority</InlineTableHeaderCell>
              <InlineTableHeaderCell>Route</InlineTableHeaderCell>
              <InlineTableHeaderCell className="min-w-56">Target / next action</InlineTableHeaderCell>
              <InlineTableHeaderCell>Source</InlineTableHeaderCell>
              <InlineTableHeaderCell align="right">Updated</InlineTableHeaderCell>
            </InlineTableHeaderRow>
          </InlineTableHeader>
          <InlineTableBody>
            {sortedIdeas.length === 0 ? (
              <InlineTableRow>
                <InlineTableCell colSpan={7} className="py-8 text-muted-foreground">
                  No ideas captured yet.
                </InlineTableCell>
              </InlineTableRow>
            ) : (
              sortedIdeas.map((idea) => (
                <InlineTableRow key={idea.id} className="align-top">
                  <InlineTableCell className="max-w-none whitespace-normal">
                    <Textarea
                      value={idea.body}
                      onChange={(event) => updateLocal(idea.id, { body: event.target.value })}
                      onBlur={(event) => {
                        const body = event.target.value.trim();
                        if (body) {
                          void savePatch(idea.id, { body });
                        }
                      }}
                      rows={2}
                      className="min-h-16 border-0 bg-transparent px-0 shadow-none focus-visible:ring-1"
                    />
                    {rowErrors[idea.id] ? (
                      <p className="mt-1 text-xs text-destructive">{rowErrors[idea.id]}</p>
                    ) : null}
                  </InlineTableCell>
                  <InlineTableCell>
                    <Select
                      value={idea.status}
                      onValueChange={(value) => {
                        const status = value as IdeaStatus;
                        updateLocal(idea.id, { status });
                        void savePatch(idea.id, { status });
                      }}
                    >
                      <SelectTrigger size="sm" variant="inline" className="min-w-36 px-2">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {IDEA_STATUSES.map((status) => (
                          <SelectItem key={status} value={status}>
                            {label(status)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </InlineTableCell>
                  <InlineTableCell>
                    <Select
                      value={idea.priority}
                      onValueChange={(value) => {
                        const priority = value as IdeaPriority;
                        updateLocal(idea.id, { priority });
                        void savePatch(idea.id, { priority });
                      }}
                    >
                      <SelectTrigger size="sm" variant="inline" className="min-w-28 px-2">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {IDEA_PRIORITIES.map((priority) => (
                          <SelectItem key={priority} value={priority}>
                            {label(priority)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </InlineTableCell>
                  <InlineTableCell>
                    <Select
                      value={idea.route_type}
                      onValueChange={(value) => {
                        const routeType = value as IdeaRouteType;
                        updateLocal(idea.id, { route_type: routeType });
                        void savePatch(idea.id, { routeType });
                      }}
                    >
                      <SelectTrigger size="sm" variant="inline" className="min-w-32 px-2">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {IDEA_ROUTE_TYPES.map((routeType) => (
                          <SelectItem key={routeType} value={routeType}>
                            {label(routeType)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </InlineTableCell>
                  <InlineTableCell className="max-w-none">
                    <Input
                      value={idea.ai_next_action ?? idea.route_target ?? ""}
                      onChange={(event) =>
                        updateLocal(idea.id, { ai_next_action: event.target.value })
                      }
                      onBlur={(event) =>
                        void savePatch(idea.id, {
                          aiNextAction: event.target.value.trim() || null,
                        })
                      }
                      variant="inline"
                      className="min-w-56 px-2"
                      placeholder="Next action"
                    />
                  </InlineTableCell>
                  <InlineTableCell className="capitalize">{label(idea.source)}</InlineTableCell>
                  <InlineTableCell align="right" className="text-xs text-muted-foreground">
                    {updatedLabel(idea.updated_at)}
                  </InlineTableCell>
                </InlineTableRow>
              ))
            )}
          </InlineTableBody>
        </InlineTable>
      </div>
    </div>
  );
}
