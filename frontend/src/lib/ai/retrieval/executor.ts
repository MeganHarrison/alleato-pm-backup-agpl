// frontend/src/lib/ai/retrieval/executor.ts
import type {
  RetrievalPlan,
  RetrievalContext,
  ExternalSource,
  MeetingCollectionRequest,
  MeetingCollectionResult,
} from "./types";
import {
  classifyResearchResult,
  mergeResearchQueryResults,
  researchTimeoutMs,
  researchToolName,
  type ResearchReceipt,
} from "./research-contract";

export type ExecutorDeps = {
  loadIntelligencePacket: (projectId: number) => Promise<unknown>;
  loadIntelligenceEvidence?: (projectId: number) => Promise<unknown>;
  loadProjectSnapshot: (projectId: number) => Promise<unknown>;
  runSemanticSearch: (query: string) => Promise<unknown>;
  runExternalSourceSearch: (
    source: ExternalSource,
    query: string,
    projectId?: number,
  ) => Promise<unknown>;
  runRecentEmails: (input: { daysBack: number; limit: number; message: string }) => Promise<unknown>;
  loadReusableBriefing: (sessionId: string) => Promise<unknown>;
  runSourceSpecificRag: (kind: string, message: string) => Promise<unknown>;
  buildBrandonDaily: () => Promise<unknown>;
  runAppExpert: (input: {
    question: string;
    currentRoute?: string | null;
    projectId?: number | null;
  }) => Promise<unknown>;
  runMeetingCollection: (
    request: MeetingCollectionRequest,
  ) => Promise<MeetingCollectionResult>;
  // Used when the plan asks for project-scoped retrieval but no explicit
  // selectedProjectId was provided. Returns null if no project can be
  // matched from the user's message text.
  resolveProjectFromQuery?: (query: string) => Promise<{ projectId: number } | null>;
  researchTimeoutOverrideMs?: (
    source: ExternalSource,
    queryCount: number,
  ) => number;
};

type TimedResult<T> =
  | { kind: "complete"; value: T }
  | { kind: "timed_out"; error: string }
  | { kind: "failed"; error: string };

function withTimeout<T>(
  p: Promise<T>,
  ms: number,
  label: string,
): Promise<TimedResult<T>> {
  return new Promise((resolve) => {
    const timer = setTimeout(
      () =>
        resolve({
          kind: "timed_out",
          error: `${label} timed out after ${ms}ms`,
        }),
      ms,
    );
    p.then((v) => {
      clearTimeout(timer);
      resolve({ kind: "complete", value: v });
    }).catch((e) => {
      clearTimeout(timer);
      resolve({
        kind: "failed",
        error: e instanceof Error ? e.message : String(e),
      });
    });
  });
}

export async function executeRetrievalPlan(
  plan: RetrievalPlan,
  deps: ExecutorDeps,
  ctx?: { sessionId?: string; message?: string; currentRoute?: string },
): Promise<RetrievalContext> {
  const warnings: RetrievalContext["warnings"] = [];
  const durations: Record<string, number> = {};
  const result: RetrievalContext = { warnings, durationsMs: durations };

  const tasks: Array<Promise<void>> = [];
  const time = async <T>(label: string, fn: () => Promise<T>): Promise<T> => {
    const start = Date.now();
    try {
      return await fn();
    } finally {
      durations[label] = Date.now() - start;
    }
  };

  if (plan.sources.brandonDailyUpdate) {
    tasks.push(
      time("brandon_daily", async () => {
        result.brandonDailyUpdatePacket = await deps.buildBrandonDaily();
      }),
    );
  }

  if (plan.sources.appExpert) {
    const question = plan.sources.appExpert.question;
    tasks.push(
      time("app_expert", async () => {
        result.appExpertPacket = (await deps.runAppExpert({
          question,
          currentRoute: ctx?.currentRoute ?? null,
          projectId: plan.selectedProjectId ?? null,
        })) as never;
      }),
    );
  }

  if (plan.sources.meetingCollection) {
    const request = plan.sources.meetingCollection;
    tasks.push(
      time("meeting_collection", async () => {
        result.meetingCollection = await deps.runMeetingCollection(request);
        if (result.meetingCollection.status !== "complete") {
          warnings.push({
            source: "meeting_collection",
            message:
              result.meetingCollection.status === "no_matches"
                ? "The authorized meeting collection returned no semantic matches."
                : `Meeting collection retrieval was incomplete: ${result.meetingCollection.coverage.retrieved}/${result.meetingCollection.coverage.matched} matched transcripts retrieved with ${result.meetingCollection.coverage.failed} failure(s).`,
          });
        }
      }),
    );
  }

  // Resolve the projectId once for any project-scoped retrieval. If the plan
  // didn't include selectedProjectId, fall back to resolving the project from
  // the user's message text (e.g. "Vermillion Rise Warehouse"). Both
  // intelligencePacket and projectSnapshot share this resolved id.
  const needsProjectId =
    Boolean(plan.sources.intelligencePacket) || Boolean(plan.sources.projectSnapshot);

  let resolvedProjectId: number | undefined = plan.selectedProjectId;
  if (needsProjectId && resolvedProjectId === undefined && deps.resolveProjectFromQuery) {
    const start = Date.now();
    try {
      const resolved = await deps.resolveProjectFromQuery(ctx?.message ?? "");
      if (resolved) {
        resolvedProjectId = resolved.projectId;
      } else {
        warnings.push({
          source: "project_resolution",
          message: "could not resolve a project from the message text",
        });
      }
    } finally {
      durations.project_resolution = Date.now() - start;
    }
  }

  if (plan.sources.intelligencePacket && resolvedProjectId !== undefined) {
    const projectId = resolvedProjectId;
    tasks.push(
      time("intelligence_packet", async () => {
        result.intelligencePacket = (await deps.loadIntelligencePacket(projectId)) as never;
        if (!result.intelligencePacket) {
          warnings.push({
            source: "intelligence_packet",
            message: `requested project operating context packet was unavailable for project ${projectId}`,
          });
        }
      }),
    );
    if (deps.loadIntelligenceEvidence) {
      tasks.push(
        time("intelligence_evidence", async () => {
          result.intelligenceEvidence = (await deps.loadIntelligenceEvidence!(projectId)) as RetrievalContext["intelligenceEvidence"];
          if (!result.intelligenceEvidence || result.intelligenceEvidence.status !== "complete") {
            warnings.push({
              source: "intelligence_evidence",
              message: result.intelligenceEvidence && "reason" in result.intelligenceEvidence
                ? String(result.intelligenceEvidence.reason)
                : `completed Product Intelligence / Executive Report evidence was unavailable for project ${projectId}`,
            });
          }
        }),
      );
    }
  }

  if (plan.sources.projectSnapshot && resolvedProjectId !== undefined) {
    const projectId = resolvedProjectId;
    tasks.push(
      time("project_snapshot", async () => {
        result.projectSnapshot = (await deps.loadProjectSnapshot(projectId)) as never;
        if (!result.projectSnapshot) {
          warnings.push({
            source: "project_snapshot",
            message: `requested structured project briefing snapshot was unavailable for project ${projectId}`,
          });
        }
      }),
    );
  }

  if (plan.sources.semanticVectorSearch) {
    const query = plan.sources.semanticVectorSearch.query;
    tasks.push(
      time("semantic_search", async () => {
        result.semanticVectorResults = (await deps.runSemanticSearch(query)) as never;
      }),
    );
  }

  if (plan.sources.research) {
    const contract = plan.sources.research;
    tasks.push(
      time("research", async () => {
        const receipts = await Promise.all(
          contract.requests.map(async (request): Promise<ResearchReceipt> => {
            const startedAt = Date.now();
            const toolName = researchToolName(request.source);

            const queries = request.queries?.length
              ? request.queries
              : [request.query];
            const timed = await withTimeout(
              (async () => {
                const payloads: unknown[] = [];
                for (const query of queries) {
                  payloads.push(
                    await deps.runExternalSourceSearch(
                      request.source,
                      query,
                      resolvedProjectId,
                    ),
                  );
                }
                return mergeResearchQueryResults(queries, payloads);
              })(),
              deps.researchTimeoutOverrideMs?.(request.source, queries.length) ??
                researchTimeoutMs(request.source, queries.length),
              request.source,
            );
            const durationMs = Date.now() - startedAt;
            durations[`research_${request.source}`] = durationMs;
            if (timed.kind === "timed_out") {
              return {
                source: request.source,
                required: request.required,
                authority: request.authority,
                toolName,
                status: "timed_out",
                durationMs,
                error: timed.error,
              };
            }
            if (timed.kind === "failed") {
              const outcome = classifyResearchResult({ error: timed.error });
              return {
                source: request.source,
                required: request.required,
                authority: request.authority,
                toolName,
                status: outcome.status,
                durationMs,
                error: outcome.error ?? timed.error,
              };
            }

            const outcome = classifyResearchResult(timed.value);
            return {
              source: request.source,
              required: request.required,
              authority: request.authority,
              toolName,
              status: outcome.status,
              durationMs,
              payload: timed.value,
              ...(outcome.error ? { error: outcome.error } : {}),
            };
          }),
        );
        result.researchReceipts = receipts;
        result.executiveBriefingRetrieval = {
          sources: receipts
            .filter(
              (receipt) =>
                receipt.status === "complete" || receipt.status === "empty",
            )
            .map((receipt) => ({
              source: receipt.source,
              status: receipt.status,
              evidence: receipt.payload,
            })),
        } as never;
        for (const receipt of receipts) {
          if (receipt.status === "complete" || receipt.status === "empty") continue;
          warnings.push({
            source: receipt.source,
            message:
              receipt.error ??
              `${receipt.source} research ended with ${receipt.status}.`,
          });
        }
      }),
    );
  }

  if (plan.sources.recentEmails) {
    const recentEmails = plan.sources.recentEmails;
    const message = ctx?.message ?? "";
    tasks.push(
      time("recent_emails", async () => {
        result.recentEmailInbox = (await deps.runRecentEmails({
          daysBack: recentEmails.daysBack,
          limit: recentEmails.limit,
          message,
        })) as never;
      }),
    );
  }

  if (plan.sources.sourceSpecificRag) {
    const kind = plan.sources.sourceSpecificRag.kind;
    const message = ctx?.message ?? "";
    tasks.push(
      time("source_specific_rag", async () => {
        result.sourceSpecificRagAnswer = (await deps.runSourceSpecificRag(kind, message)) as never;
      }),
    );
  }

  if (plan.sources.reusePriorBriefing && ctx?.sessionId) {
    const sessionId = ctx.sessionId;
    tasks.push(
      time("reuse_prior_briefing", async () => {
        const reused = await deps.loadReusableBriefing(sessionId);
        if (reused) {
          result.reusedFromPriorBriefing = true;
          const r = reused as { snapshot?: unknown; executiveRetrieval?: unknown };
          result.projectSnapshot = (r.snapshot ?? null) as never;
          result.executiveBriefingRetrieval = (r.executiveRetrieval ?? null) as never;
        }
      }),
    );
  }

  const settled = await Promise.allSettled(tasks);
  const rejected = settled.filter(
    (entry): entry is PromiseRejectedResult => entry.status === "rejected",
  );
  for (const entry of rejected) {
    warnings.push({
      source: "retrieval_executor",
      message: entry.reason instanceof Error ? entry.reason.message : String(entry.reason),
    });
  }
  if (plan.sources.meetingCollection && !result.meetingCollection) {
    warnings.push({
      source: "meeting_collection",
      message: "Meeting collection execution failed before coverage could be established.",
    });
  }
  return result;
}
