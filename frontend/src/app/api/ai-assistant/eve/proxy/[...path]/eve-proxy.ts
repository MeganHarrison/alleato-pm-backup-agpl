import { createHash, randomUUID } from "node:crypto";

import {
  AssistantTurnConflictError,
  AssistantTurnNotFoundError,
  createAssistantTurn,
  type AssistantTurn,
  type AssistantTurnActor,
  type AssistantTurnObservation,
  type AssistantTurnRepository,
  type AssistantTurnRuntimeEvent,
  type AssistantTurnTransition,
} from "@/lib/ai/assistant-turn";
import { GuardrailError } from "@/lib/guardrails/errors";

const EVE_PREFIX = ["eve", "v1", "session"] as const;
const MAX_SESSION_ID_LENGTH = 256;
const MAX_DURABLE_EVENT_BATCH_SIZE = 256;
const TERMINAL_DRAIN_TIMEOUT_MS = 1_000;
const DURABILITY_WAIT_TIMEOUT_MS = 10_000;
const FORWARDED_REQUEST_HEADERS = [
  "accept",
  "content-type",
  "x-alleato-project-id",
] as const;
const FORWARDED_RESPONSE_HEADERS = [
  "cache-control",
  "content-type",
  "retry-after",
  "x-eve-session-id",
  "x-eve-stream-format",
  "x-eve-stream-version",
] as const;

export interface EveProxyUser {
  id: string;
}

export interface EveProxyConversation {
  id: string;
  surface: "alleato_ai" | "ask_alleato";
}

export type EveProxyProjectResolution =
  | { status: "resolved"; projectId: number; projectName: string }
  | { status: "ambiguous"; matches: readonly { id: number; name: string }[] }
  | { status: "not_found" };

export interface EveProxyDependencies {
  authenticate(request: Request): Promise<EveProxyUser | null>;
  authorizeConversation(
    userId: string,
    conversation: EveProxyConversation,
  ): Promise<boolean>;
  resolveProjectByCanonicalName(
    request: Request,
    message: string,
  ): Promise<EveProxyProjectResolution>;
  createRepository(): AssistantTurnRepository;
  eveBaseUrl: string;
  eveProxySecret: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  fetchUpstream(input: RequestInfo | URL, init: RequestInit): Promise<Response>;
  createTurnId?: () => string;
  defer(task: Promise<void>): void;
  now?: () => string;
}

function requiredUserAccessToken(request: Request): string {
  const authorization = request.headers.get("authorization")?.trim();
  if (!authorization?.toLowerCase().startsWith("bearer ")) {
    throw new GuardrailError({
      code: "AUTH_REQUIRED",
      where: "ai-assistant/eve/proxy",
      message: "A valid authenticated user access token is required.",
      status: 401,
    });
  }

  const accessToken = authorization.slice("bearer ".length).trim();
  if (!accessToken) {
    throw new GuardrailError({
      code: "AUTH_REQUIRED",
      where: "ai-assistant/eve/proxy",
      message: "A valid authenticated user access token is required.",
      status: 401,
    });
  }
  return accessToken;
}

export function requiredEveBaseUrl(
  configuredValue?: string,
  options: { allowLocalHttp?: boolean } = {},
): string {
  const configured = configuredValue?.trim();
  if (!configured) {
    throw new Error(
      "Eve proxy configuration is missing the server-only ALLEATO_EVE_URL.",
    );
  }
  const url = new URL(configured);
  const isAllowedLocalHttp =
    options.allowLocalHttp === true &&
    url.protocol === "http:" &&
    (url.hostname === "localhost" || url.hostname === "127.0.0.1");
  if (url.protocol !== "https:" && !isAllowedLocalHttp) {
    throw new Error("ALLEATO_EVE_URL must use https.");
  }
  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== "/"
  ) {
    throw new Error(
      "ALLEATO_EVE_URL must be an HTTPS origin without credentials, path, query, or fragment.",
    );
  }
  return url.toString();
}

type CanonicalEveRoute =
  | { kind: "start"; upstreamPath: "/eve/v1/session" }
  | {
      kind: "continue";
      sessionId: string;
      upstreamPath: string;
    }
  | {
      kind: "stream";
      sessionId: string;
      startIndex: number;
      upstreamPath: string;
    };

interface EvePostBody {
  clientContext?: unknown;
  continuationToken?: unknown;
  inputResponses?: unknown;
  message?: unknown;
}

function internalAssistantSurface(
  surface: EveProxyConversation["surface"],
): "ai_assistant" | "ask_alleato" {
  return surface === "alleato_ai" ? "ai_assistant" : surface;
}

function durableAssistantSurface(
  observation: AssistantTurnObservation,
): "ai_assistant" | "ask_alleato" {
  const payload = observation.receipt.commandPayload;
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new GuardrailError({
      code: "CONFIGURATION_ERROR",
      where: "ai-assistant/eve/proxy",
      message: "The durable Eve turn is missing its server-owned surface.",
      status: 500,
      severity: "high",
    });
  }
  const surface = (payload as Record<string, unknown>).surface;
  if (surface !== "alleato_ai" && surface !== "ask_alleato") {
    throw new GuardrailError({
      code: "CONFIGURATION_ERROR",
      where: "ai-assistant/eve/proxy",
      message: "The durable Eve turn has an invalid server-owned surface.",
      status: 500,
      severity: "high",
    });
  }
  return internalAssistantSurface(surface);
}

function isSafeSessionId(value: string): boolean {
  return (
    value.length > 0 &&
    value.length <= MAX_SESSION_ID_LENGTH &&
    /^[A-Za-z0-9_.:-]+$/.test(value)
  );
}

function appSessionToken(turnId: string): string {
  return `aat.${Buffer.from(turnId, "utf8").toString("base64url")}`;
}

function turnIdFromAppSessionToken(token: string): string | null {
  if (!token.startsWith("aat.")) return null;
  try {
    const turnId = Buffer.from(token.slice(4), "base64url").toString("utf8");
    if (
      !turnId ||
      turnId.length > 128 ||
      appSessionToken(turnId) !== token
    ) {
      return null;
    }
    return turnId;
  } catch {
    return null;
  }
}

function canonicalRoute(
  method: string,
  path: readonly string[],
  requestUrl: string,
): CanonicalEveRoute {
  const matchesPrefix = EVE_PREFIX.every(
    (segment, index) => path[index] === segment,
  );
  if (!matchesPrefix) {
    throw new GuardrailError({
      code: "NOT_FOUND",
      where: "ai-assistant/eve/proxy",
      message: "Only canonical Eve session routes are available.",
      status: 404,
    });
  }

  const url = new URL(requestUrl);
  if (method === "POST" && path.length === 3) {
    if (url.search) {
      throw new GuardrailError({
        code: "INVALID_PAYLOAD",
        where: "ai-assistant/eve/proxy#POST",
        message: "Eve session POST routes do not accept query parameters.",
        status: 400,
      });
    }
    return { kind: "start", upstreamPath: "/eve/v1/session" };
  }

  const sessionId = path[3];
  if (!sessionId || !isSafeSessionId(sessionId)) {
    throw new GuardrailError({
      code: "INVALID_PAYLOAD",
      where: "ai-assistant/eve/proxy",
      message: "The Eve session ID is invalid.",
      status: 400,
    });
  }

  if (method === "POST" && path.length === 4) {
    if (url.search) {
      throw new GuardrailError({
        code: "INVALID_PAYLOAD",
        where: "ai-assistant/eve/proxy#POST",
        message: "Eve continuation POST routes do not accept query parameters.",
        status: 400,
      });
    }
    return {
      kind: "continue",
      sessionId,
      upstreamPath: `/eve/v1/session/${encodeURIComponent(sessionId)}`,
    };
  }

  if (
    method === "GET" &&
    path.length === 5 &&
    path[4] === "stream"
  ) {
    for (const key of url.searchParams.keys()) {
      if (key !== "startIndex") {
        throw new GuardrailError({
          code: "INVALID_PAYLOAD",
          where: "ai-assistant/eve/proxy#GET",
          message: `Unsupported Eve stream query parameter "${key}".`,
          status: 400,
        });
      }
    }
    const rawStartIndex = url.searchParams.get("startIndex");
    const startIndex = rawStartIndex === null ? 0 : Number(rawStartIndex);
    if (!Number.isSafeInteger(startIndex) || startIndex < 0) {
      throw new GuardrailError({
        code: "INVALID_PAYLOAD",
        where: "ai-assistant/eve/proxy#GET",
        message: "startIndex must be a non-negative safe integer.",
        status: 400,
      });
    }
    return {
      kind: "stream",
      sessionId,
      startIndex,
      upstreamPath: `/eve/v1/session/${encodeURIComponent(sessionId)}/stream?startIndex=${startIndex}`,
    };
  }

  throw new GuardrailError({
    code: "NOT_FOUND",
    where: "ai-assistant/eve/proxy",
    message: "Only canonical Eve session routes are available.",
    status: 404,
  });
}

function requireBearer(request: Request): void {
  const authorization = request.headers.get("authorization");
  if (
    !authorization?.startsWith("Bearer ") ||
    authorization.slice("Bearer ".length).trim().length === 0
  ) {
    throw new GuardrailError({
      code: "AUTH_EXPIRED",
      where: "ai-assistant/eve/proxy",
      message: "A valid bearer token is required for the Eve proxy.",
      status: 401,
    });
  }
}

function actorFor(user: EveProxyUser): AssistantTurnActor {
  return {
    id: user.id,
    organizationId: null,
    permissions: ["assistant:execute", "assistant:observe"],
  };
}

function forwardedHeaders(
  source: Headers,
  allowed: readonly string[],
): Headers {
  const forwarded = new Headers();
  for (const name of allowed) {
    const value = source.get(name);
    if (value !== null) forwarded.set(name, value);
  }
  return forwarded;
}

function safeUpstreamResponse(response: Response): Response {
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: forwardedHeaders(
      response.headers,
      FORWARDED_RESPONSE_HEADERS,
    ),
  });
}

function upstreamUrl(baseUrl: string, path: string): URL {
  const url = new URL(baseUrl);
  url.pathname = path;
  url.search = path.includes("?") ? path.slice(path.indexOf("?")) : "";
  if (path.includes("?")) {
    url.pathname = path.slice(0, path.indexOf("?"));
  }
  url.hash = "";
  return url;
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => `${JSON.stringify(key)}:${stableJson(child)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

function digest(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function parsePostBody(rawBody: string): {
  body: EvePostBody;
  conversation: EveProxyConversation;
} {
  let body: EvePostBody;
  try {
    body = JSON.parse(rawBody) as EvePostBody;
  } catch {
    throw new GuardrailError({
      code: "INVALID_PAYLOAD",
      where: "ai-assistant/eve/proxy#POST",
      message: "The Eve request body must be valid JSON.",
      status: 400,
    });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new GuardrailError({
      code: "INVALID_PAYLOAD",
      where: "ai-assistant/eve/proxy#POST",
      message: "The Eve request body must be a JSON object.",
      status: 400,
    });
  }
  const context =
    body.clientContext &&
    typeof body.clientContext === "object" &&
    !Array.isArray(body.clientContext)
      ? (body.clientContext as Record<string, unknown>)
      : null;
  const conversationId =
    typeof context?.conversationId === "string"
      ? context.conversationId.trim()
      : "";
  const assistantSurface = context?.assistantSurface;
  if (
    !conversationId ||
    (assistantSurface !== "alleato_ai" &&
      assistantSurface !== "ask_alleato")
  ) {
    throw new GuardrailError({
      code: "INVALID_PAYLOAD",
      where: "ai-assistant/eve/proxy#POST",
      message:
        "Verified conversationId and assistantSurface client context are required.",
      status: 400,
    });
  }
  return {
    body,
    conversation: {
      id: conversationId,
      surface: assistantSurface,
    },
  };
}

function messageText(body: EvePostBody): string {
  if (typeof body.message === "string") return body.message.trim();
  if (!Array.isArray(body.message)) return "";
  return body.message
    .flatMap((part) =>
      part &&
      typeof part === "object" &&
      (part as Record<string, unknown>).type === "text" &&
      typeof (part as Record<string, unknown>).text === "string"
        ? [String((part as Record<string, unknown>).text)]
        : [],
    )
    .join(" ")
    .trim();
}

function normalizedCanonicalText(value: string): string {
  return value.normalize("NFKC").toLocaleLowerCase("en-US").replace(/\s+/g, " ").trim();
}

function hasCanonicalPhrase(message: string, projectName: string): boolean {
  const start = message.indexOf(projectName);
  if (start < 0) return false;
  const before = start === 0 ? "" : message[start - 1];
  const after =
    start + projectName.length >= message.length
      ? ""
      : message[start + projectName.length];
  const isWord = (value: string) => /[\p{L}\p{N}]/u.test(value);
  return !isWord(before) && !isWord(after);
}

export function resolveCanonicalProjectName(
  message: string,
  projects: readonly { id: number; name: string }[],
): EveProxyProjectResolution {
  const normalizedMessage = normalizedCanonicalText(message);
  const matches = projects
    .filter(
      (project) =>
        Number.isSafeInteger(project.id) &&
        project.id > 0 &&
        project.name.trim().length > 0 &&
        hasCanonicalPhrase(
          normalizedMessage,
          normalizedCanonicalText(project.name),
        ),
    )
    .map((project) => ({ id: project.id, name: project.name }));
  if (matches.length === 0) return { status: "not_found" };
  if (matches.length > 1) return { status: "ambiguous", matches };
  return {
    status: "resolved",
    projectId: matches[0].id,
    projectName: matches[0].name,
  };
}

function delegatedLocator(response: Response): Promise<string> {
  const headerSessionId = response.headers.get("x-eve-session-id")?.trim();
  return response
    .json()
    .then((body: unknown) => {
      const bodySessionId =
        body &&
        typeof body === "object" &&
        typeof (body as Record<string, unknown>).sessionId === "string"
          ? String((body as Record<string, unknown>).sessionId).trim()
          : "";
      const sessionId = bodySessionId || headerSessionId || "";
      if (!isSafeSessionId(sessionId)) {
        throw new Error(
          "The Eve session response did not contain a valid session locator.",
        );
      }
      if (
        headerSessionId &&
        bodySessionId &&
        headerSessionId !== bodySessionId
      ) {
        throw new Error(
          "The Eve session response returned conflicting session locators.",
        );
      }
      return sessionId;
    });
}

function assistantTurnFor(
  repository: AssistantTurnRepository,
  dependencies: EveProxyDependencies,
  runtime: Parameters<typeof createAssistantTurn>[0]["runtime"],
): AssistantTurn {
  return createAssistantTurn({
    repository,
    runtime,
    createTurnId: dependencies.createTurnId ?? randomUUID,
    defer: dependencies.defer,
    now: dependencies.now,
  });
}

async function observationForAppSession(
  route: Extract<CanonicalEveRoute, { sessionId: string }>,
  actor: AssistantTurnActor,
  repository: AssistantTurnRepository,
  dependencies: EveProxyDependencies,
): Promise<AssistantTurnObservation> {
  const turnId = turnIdFromAppSessionToken(route.sessionId);
  if (!turnId) {
    throw new GuardrailError({
      code: "NOT_FOUND",
      where: "ai-assistant/eve/proxy",
      message: "This Eve session is not owned by the authenticated user.",
      status: 404,
    });
  }
  const observer = assistantTurnFor(repository, dependencies, {
    async generate() {
      throw new Error("Observation must not start Eve generation.");
    },
  });
  try {
    return await observer.observe({ turnId, afterSequence: 0 }, actor);
  } catch (error) {
    if (error instanceof AssistantTurnNotFoundError) {
      throw new GuardrailError({
        code: "NOT_FOUND",
        where: "ai-assistant/eve/proxy",
        message: "This Eve session is not owned by the authenticated user.",
        status: 404,
      });
    }
    throw error;
  }
}

function durableEveCursor(observation: AssistantTurnObservation): {
  startIndex: number;
  nextIndex: number;
} {
  const bindings = observation.events.flatMap((event) => {
    const value =
      event.type === "runtime.event" &&
      event.data?.runtimeType === "eve.turn.bound"
        ? event.data.eveStartIndex
        : undefined;
    return typeof value === "number" && Number.isSafeInteger(value)
      ? [value]
      : [];
  });
  if (bindings.length !== 1 || bindings[0] < 0) {
    throw new GuardrailError({
      code: "CONFIGURATION_ERROR",
      where: "ai-assistant/eve/proxy#cursor",
      message: "The delegated Eve turn has no unique durable cursor binding.",
      status: 500,
      severity: "high",
    });
  }
  const startIndex = bindings[0];
  const indexes = [...knownEveIndexes(observation)].sort(
    (left, right) => left - right,
  );
  for (const [offset, index] of indexes.entries()) {
    const expected = startIndex + offset;
    if (index !== expected) {
      throw new GuardrailError({
        code: "CONFIGURATION_ERROR",
        where: "ai-assistant/eve/proxy#cursor",
        message: `Durable Eve receipt order is non-contiguous at index ${expected}.`,
        status: 500,
        severity: "high",
      });
    }
  }
  return {
    startIndex,
    nextIndex: startIndex + indexes.length,
  };
}

function reconcileRequestedCursor(
  observation: AssistantTurnObservation,
  requestedStartIndex: number,
): { upstreamStartIndex: number; atTurnEnd: boolean } {
  const durable = durableEveCursor(observation);
  const localNextIndex = durable.nextIndex - durable.startIndex;
  if (requestedStartIndex > localNextIndex) {
    throw new GuardrailError({
      code: "PRECONDITION_FAILED",
      where: "ai-assistant/eve/proxy#GET",
      message:
        `startIndex ${requestedStartIndex} is outside this turn's local Eve range ` +
        `0-${localNextIndex}.`,
      status: 409,
    });
  }
  return {
    upstreamStartIndex: durable.startIndex + requestedStartIndex,
    atTurnEnd: requestedStartIndex === localNextIndex,
  };
}

function transition(
  terminal: "completed" | "failed",
  now: string,
  errorMessage: string | null,
): AssistantTurnTransition {
  return {
    terminal,
    stage: terminal === "completed" ? "eve_turn_completed" : "eve_turn_failed",
    errorMessage,
    completedAt: now,
  };
}

function eventData(event: unknown): Record<string, unknown> {
  return event && typeof event === "object" && !Array.isArray(event)
    ? (event as Record<string, unknown>)
    : {};
}

function eventType(event: unknown): string {
  const type = eventData(event).type;
  return typeof type === "string" ? type : "";
}

function failureMessage(event: unknown): string {
  const data = eventData(eventData(event).data);
  return typeof data.message === "string" && data.message.trim()
    ? data.message
    : "The delegated Eve turn failed.";
}

function isTerminalEveEvent(event: unknown): boolean {
  const type = eventType(event);
  return type === "turn.completed" || type === "turn.failed";
}

function isSessionBoundaryEveEvent(event: unknown): boolean {
  const type = eventType(event);
  return (
    type === "session.waiting" ||
    type === "session.completed" ||
    type === "session.failed"
  );
}

async function readWithTerminalTimeout(
  reader: ReadableStreamDefaultReader<Uint8Array>,
): Promise<ReadableStreamReadResult<Uint8Array> | null> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      reader.read(),
      new Promise<null>((resolve) => {
        timeout = setTimeout(() => resolve(null), TERMINAL_DRAIN_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

async function awaitDurability(durability: Promise<void>): Promise<void> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      durability,
      new Promise<never>((_, reject) => {
        timeout = setTimeout(
          () =>
            reject(
              new Error(
                "Durable Eve terminalization did not finish before the response deadline.",
              ),
            ),
          DURABILITY_WAIT_TIMEOUT_MS,
        );
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

function boundedNdjsonStream(
  body: ReadableStream<Uint8Array>,
  durability: Promise<void>,
): ReadableStream<Uint8Array> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      let buffer = "";
      let terminalSeen = false;
      try {
        for (;;) {
          const chunk = terminalSeen
            ? await readWithTerminalTimeout(reader)
            : await reader.read();
          if (chunk === null) {
            await awaitDurability(durability);
            controller.close();
            void reader.cancel("Eve terminal drain timed out.");
            return;
          }
          if (chunk.done) {
            buffer += decoder.decode();
            if (buffer) controller.enqueue(encoder.encode(buffer));
            await awaitDurability(durability);
            controller.close();
            return;
          }

          buffer += decoder.decode(chunk.value, { stream: true });
          for (;;) {
            const lineEnd = buffer.indexOf("\n");
            if (lineEnd < 0) break;
            const rawLine = buffer.slice(0, lineEnd + 1);
            const line = rawLine.trim();
            buffer = buffer.slice(lineEnd + 1);
            controller.enqueue(encoder.encode(rawLine));
            if (!line) continue;

            let event: unknown;
            try {
              event = JSON.parse(line);
            } catch (cause) {
              controller.error(
                new Error(
                  "Eve returned invalid NDJSON before the terminal boundary.",
                  { cause },
                ),
              );
              void reader.cancel("Eve returned invalid NDJSON.");
              return;
            }
            terminalSeen ||= isTerminalEveEvent(event);
            if (terminalSeen && isSessionBoundaryEveEvent(event)) {
              await awaitDurability(durability);
              controller.close();
              void reader.cancel("Eve session reached a turn boundary.");
              return;
            }
          }
        }
      } catch (error) {
        controller.error(error);
      } finally {
        reader.releaseLock();
      }
    },
    cancel(reason) {
      return reader.cancel(reason);
    },
  });
}

function knownEveIndexes(
  observation: AssistantTurnObservation,
): Set<number> {
  return new Set(
    observation.events.flatMap((event) => {
      const index = event.data?.eveStreamIndex;
      return typeof index === "number" && Number.isSafeInteger(index)
        ? [index]
        : [];
    }),
  );
}

interface IndexedEveEvent {
  event: unknown;
  eveStreamIndex: number;
}

function runtimeEventsFor(
  indexedEvents: readonly IndexedEveEvent[],
  knownIndexes: Set<number>,
): AssistantTurnRuntimeEvent[] {
  return indexedEvents
    .filter(({ eveStreamIndex }) => !knownIndexes.has(eveStreamIndex))
    .map(({ event, eveStreamIndex }) => {
      const type = eventType(event);
      if (!type) {
        throw new Error(
          `Eve stream event ${eveStreamIndex} does not contain a type.`,
        );
      }
      return {
        type,
        data: { eveStreamIndex, event: eventData(event) },
      };
    });
}

async function persistEveEvents({
  actor,
  indexedEvents,
  knownIndexes,
  observation,
  repository,
  dependencies,
}: {
  actor: AssistantTurnActor;
  indexedEvents: readonly IndexedEveEvent[];
  knownIndexes: Set<number>;
  observation: AssistantTurnObservation;
  repository: AssistantTurnRepository;
  dependencies: EveProxyDependencies;
}): Promise<AssistantTurnObservation> {
  if (observation.receipt.lifecycle === "terminal") return observation;
  const unseenEvents = indexedEvents.filter(
    ({ eveStreamIndex }) => !knownIndexes.has(eveStreamIndex),
  );
  if (unseenEvents.length === 0) return observation;
  const runtimeEvents = runtimeEventsFor(unseenEvents, knownIndexes);
  const now = dependencies.now?.() ?? new Date().toISOString();
  const result = {
    status: "delegated" as const,
    runtimeKind: "eve" as const,
    runtimeLocator: observation.receipt.runtimeLocator!,
    events: runtimeEvents,
  };

  try {
    const receipt = await repository.persistRuntimeResult({
      turnId: observation.receipt.turnId,
      actor,
      result,
      transition: null,
      now,
    });
    for (const { eveStreamIndex } of unseenEvents) {
      knownIndexes.add(eveStreamIndex);
    }
    return { ...observation, receipt };
  } catch (error) {
    if (!(error instanceof AssistantTurnConflictError)) throw error;
  }

  const observer = assistantTurnFor(repository, dependencies, {
    async generate() {
      throw new Error("Observation must not start Eve generation.");
    },
  });
  const refreshed = await observer.observe(
    { turnId: observation.receipt.turnId, afterSequence: 0 },
    actor,
  );
  const refreshedIndexes = knownEveIndexes(refreshed);
  if (
    refreshed.receipt.lifecycle !== "terminal" &&
    unseenEvents.some(
      ({ eveStreamIndex }) => !refreshedIndexes.has(eveStreamIndex),
    )
  ) {
    throw new Error(
      "A durable Eve event batch conflicted before all indexes were persisted.",
    );
  }
  for (const eveStreamIndex of refreshedIndexes) {
    knownIndexes.add(eveStreamIndex);
  }
  return refreshed;
}

async function terminalizeEveTurn(
  observation: AssistantTurnObservation,
  actor: AssistantTurnActor,
  repository: AssistantTurnRepository,
  terminalEvent: unknown,
  indexedEvents: readonly IndexedEveEvent[],
  knownIndexes: Set<number>,
  dependencies: EveProxyDependencies,
): Promise<void> {
  if (observation.receipt.lifecycle === "terminal") return;
  const type = eventType(terminalEvent);
  const now = dependencies.now?.() ?? new Date().toISOString();
  const failed = type === "turn.failed";
  const message = failed ? failureMessage(terminalEvent) : null;
  const runtimeEvents = runtimeEventsFor(indexedEvents, knownIndexes);
  try {
    await repository.persistRuntimeResult({
      turnId: observation.receipt.turnId,
      actor,
      result: failed
        ? {
            status: "failed",
            message: message ?? "The delegated Eve turn failed.",
            events: runtimeEvents,
          }
        : { status: "completed", events: runtimeEvents },
      transition: transition(
        failed ? "failed" : "completed",
        now,
        message,
      ),
      now,
    });
  } catch (error) {
    if (
      error instanceof AssistantTurnConflictError &&
      error.receipt?.lifecycle === "terminal"
    ) {
      return;
    }
    throw error;
  }
}

async function failRunningTurn(
  observation: AssistantTurnObservation,
  actor: AssistantTurnActor,
  repository: AssistantTurnRepository,
  message: string,
  dependencies: EveProxyDependencies,
): Promise<void> {
  if (observation.receipt.lifecycle === "terminal") return;
  const now = dependencies.now?.() ?? new Date().toISOString();
  try {
    await repository.fail(
      observation.receipt.turnId,
      actor,
      transition("failed", now, message),
    );
  } catch (error) {
    if (
      error instanceof AssistantTurnConflictError &&
      error.receipt?.lifecycle === "terminal"
    ) {
      return;
    }
    throw error;
  }
}

async function cancelRunningTurn(
  observation: AssistantTurnObservation,
  actor: AssistantTurnActor,
  repository: AssistantTurnRepository,
  dependencies: EveProxyDependencies,
): Promise<void> {
  if (observation.receipt.lifecycle === "terminal") return;
  const now = dependencies.now?.() ?? new Date().toISOString();
  try {
    await repository.cancel(
      observation.receipt.turnId,
      actor,
      "The authenticated user aborted the Eve stream.",
      now,
    );
  } catch (error) {
    if (
      error instanceof AssistantTurnConflictError &&
      error.receipt?.lifecycle === "terminal"
    ) {
      return;
    }
    throw error;
  }
}

async function monitorNdjsonStream({
  actor,
  body,
  observation,
  repository,
  startIndex,
  dependencies,
  signal,
}: {
  actor: AssistantTurnActor;
  body: ReadableStream<Uint8Array>;
  observation: AssistantTurnObservation;
  repository: AssistantTurnRepository;
  startIndex: number;
  dependencies: EveProxyDependencies;
  signal: AbortSignal;
}): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let eveStreamIndex = startIndex;
  let current = observation;
  let terminalEvent: unknown = null;
  let pendingEvents: IndexedEveEvent[] = [];
  const knownIndexes = knownEveIndexes(observation);
  let cancellation: Promise<void> | null = null;
  const cancelForAbort = () => {
    cancellation ??= cancelRunningTurn(
      observation,
      actor,
      repository,
      dependencies,
    );
    return cancellation;
  };
  signal.addEventListener("abort", cancelForAbort, { once: true });
  if (signal.aborted) void cancelForAbort();

  try {
    for (;;) {
      const chunk =
        terminalEvent === null
          ? await reader.read()
          : await readWithTerminalTimeout(reader);
      if (chunk === null) {
        await terminalizeEveTurn(
          current,
          actor,
          repository,
          terminalEvent,
          pendingEvents,
          knownIndexes,
          dependencies,
        );
        void reader.cancel("Eve terminal drain timed out.");
        return;
      }
      if (chunk.done) break;
      buffer += decoder.decode(chunk.value, { stream: true });
      for (;;) {
        const lineEnd = buffer.indexOf("\n");
        if (lineEnd < 0) break;
        const line = buffer.slice(0, lineEnd).trim();
        buffer = buffer.slice(lineEnd + 1);
        if (!line) continue;
        if (signal.aborted) {
          await cancelForAbort();
          return;
        }
        let event: unknown;
        try {
          event = JSON.parse(line);
        } catch {
          throw new Error(
            `Eve returned invalid NDJSON at stream index ${eveStreamIndex}.`,
          );
        }
        pendingEvents.push({
          event,
          eveStreamIndex,
        });
        if (terminalEvent === null && isTerminalEveEvent(event)) {
          terminalEvent = event;
        }
        if (
          terminalEvent === null &&
          pendingEvents.length >= MAX_DURABLE_EVENT_BATCH_SIZE
        ) {
          current = await persistEveEvents({
            actor,
            indexedEvents: pendingEvents,
            knownIndexes,
            observation: current,
            repository,
            dependencies,
          });
          pendingEvents = [];
        }
        if (
          terminalEvent !== null &&
          isSessionBoundaryEveEvent(event)
        ) {
          await terminalizeEveTurn(
            current,
            actor,
            repository,
            terminalEvent,
            pendingEvents,
            knownIndexes,
            dependencies,
          );
          void reader.cancel("Eve session reached a turn boundary.");
          return;
        }
        eveStreamIndex += 1;
      }
    }
    buffer += decoder.decode();
    const finalLine = buffer.trim();
    if (finalLine) {
      if (signal.aborted) {
        await cancelForAbort();
        return;
      }
      let event: unknown;
      try {
        event = JSON.parse(finalLine);
      } catch {
        throw new Error(
          `Eve returned invalid NDJSON at stream index ${eveStreamIndex}.`,
        );
      }
      pendingEvents.push({
        event,
        eveStreamIndex,
      });
      if (terminalEvent === null && isTerminalEveEvent(event)) {
        terminalEvent = event;
      }
    }
    if (terminalEvent !== null && !signal.aborted) {
      await terminalizeEveTurn(
        current,
        actor,
        repository,
        terminalEvent,
        pendingEvents,
        knownIndexes,
        dependencies,
      );
    } else if (pendingEvents.length > 0 && !signal.aborted) {
      await persistEveEvents({
        actor,
        indexedEvents: pendingEvents,
        knownIndexes,
        observation: current,
        repository,
        dependencies,
      });
    }
  } catch (error) {
    if (signal.aborted) {
      await cancelForAbort();
      return;
    }
    await failRunningTurn(
      current,
      actor,
      repository,
      error instanceof Error ? error.message : String(error),
      dependencies,
    );
    throw error;
  } finally {
    signal.removeEventListener("abort", cancelForAbort);
    if (cancellation) await cancellation;
    reader.releaseLock();
  }
}

async function handlePost(
  request: Request,
  route: Extract<CanonicalEveRoute, { kind: "start" | "continue" }>,
  user: EveProxyUser,
  dependencies: EveProxyDependencies,
): Promise<Response> {
  const actor = actorFor(user);
  const rawBody = await request.text();
  const parsed = parsePostBody(rawBody);
  let realEveSessionId: string | null = null;
  let eveStartIndex = 0;
  if (
    !(await dependencies.authorizeConversation(user.id, parsed.conversation))
  ) {
    throw new GuardrailError({
      code: "NOT_FOUND",
      where: "ai-assistant/eve/proxy#POST",
      message: "This conversation is not available on the requested surface.",
      status: 404,
    });
  }

  if (route.kind === "continue") {
    const previous = await observationForAppSession(
      route,
      actor,
      dependencies.createRepository(),
      dependencies,
    );
    if (previous.receipt.sessionId !== parsed.conversation.id) {
      throw new GuardrailError({
        code: "AUTH_FORBIDDEN",
        where: "ai-assistant/eve/proxy#POST",
        message: "The Eve session does not belong to this conversation.",
        status: 403,
      });
    }
    if (
      previous.receipt.lifecycle !== "terminal" ||
      previous.receipt.terminal !== "completed" ||
      !previous.receipt.runtimeLocator
    ) {
      throw new GuardrailError({
        code: "PRECONDITION_FAILED",
        where: "ai-assistant/eve/proxy#POST",
        message:
          "The previous Eve turn must complete before sending a continuation.",
        status: 409,
      });
    }
    realEveSessionId = previous.receipt.runtimeLocator;
    eveStartIndex = durableEveCursor(previous).nextIndex;
  }

  const normalizedBody = stableJson(parsed.body);
  const payloadIdentity = `sha256:${digest(normalizedBody)}`;
  const idempotencyKey = `eve:${digest(
    `${route.upstreamPath}:${normalizedBody}`,
  )}`;
  const repository = dependencies.createRepository();
  const upstreamRequestHeaders = forwardedHeaders(
    request.headers,
    FORWARDED_REQUEST_HEADERS,
  );
  upstreamRequestHeaders.set(
    "x-alleato-user-access-token",
    requiredUserAccessToken(request),
  );
  if (!upstreamRequestHeaders.has("x-alleato-project-id")) {
    const text = messageText(parsed.body);
    if (text) {
      const project = await dependencies.resolveProjectByCanonicalName(
        request,
        text,
      );
      if (project.status === "ambiguous") {
        throw new GuardrailError({
          code: "PRECONDITION_FAILED",
          where: "ai-assistant/eve/proxy#POST",
          message:
            "The message names multiple accessible projects. Select one project before continuing.",
          status: 409,
          details: {
            needsUserInput: true,
            matches: project.matches,
          },
        });
      }
      if (project.status === "resolved") {
        upstreamRequestHeaders.set(
          "x-alleato-project-id",
          String(project.projectId),
        );
      }
    }
  }
  // Surface is derived from the verified conversation context, never from a
  // caller-supplied permission header.
  upstreamRequestHeaders.set(
    "x-alleato-assistant-surface",
    internalAssistantSurface(parsed.conversation.surface),
  );
  upstreamRequestHeaders.set(
    "x-alleato-eve-proxy-secret",
    dependencies.eveProxySecret,
  );
  upstreamRequestHeaders.set("x-alleato-supabase-url", dependencies.supabaseUrl);
  upstreamRequestHeaders.set(
    "x-alleato-supabase-anon-key",
    dependencies.supabaseAnonKey,
  );
  const assistantTurn = assistantTurnFor(repository, dependencies, {
    async generate(invocation) {
      const realUpstreamPath =
        route.kind === "continue"
          ? `/eve/v1/session/${encodeURIComponent(realEveSessionId!)}`
          : route.upstreamPath;
      const turnHeaders = new Headers(upstreamRequestHeaders);
      turnHeaders.set("x-assistant-turn-id", invocation.turnId);
      const upstream = await dependencies.fetchUpstream(
        upstreamUrl(dependencies.eveBaseUrl, realUpstreamPath),
        {
          method: "POST",
          headers: turnHeaders,
          body: rawBody,
          redirect: "manual",
          signal: request.signal,
        },
      );
      const locator = upstream.ok
        ? delegatedLocator(upstream.clone())
        : Promise.reject(
            new Error(`Eve session POST failed with HTTP ${upstream.status}.`),
          );
      return {
        response: safeUpstreamResponse(upstream),
        result: locator.then((runtimeLocator) => {
          if (
            route.kind === "continue" &&
            runtimeLocator !== realEveSessionId
          ) {
            throw new Error(
              "The Eve continuation response changed the session locator.",
            );
          }
          return {
            status: "delegated" as const,
            runtimeKind: "eve" as const,
            runtimeLocator,
            events: [
              {
                type: "eve.turn.bound",
                data: { eveStartIndex },
              },
            ],
          };
        }),
      };
    },
  });

  const execution = await assistantTurn.execute(
    {
      type: "start",
      idempotencyKey,
      sessionId: parsed.conversation.id,
      payloadIdentity,
      payload: {
        kind: route.kind,
        payloadIdentity,
        surface: parsed.conversation.surface,
        upstreamPath: route.upstreamPath,
      },
    },
    actor,
  );
  if (execution.response) {
    const responseBody = (await execution.response.json()) as Record<
      string,
      unknown
    >;
    const headers = new Headers(execution.response.headers);
    const sessionToken = appSessionToken(execution.receipt.turnId);
    headers.set("content-type", "application/json");
    headers.set("x-eve-session-id", sessionToken);
    return Response.json(
      { ...responseBody, sessionId: sessionToken },
      {
        status: execution.response.status,
        headers,
      },
    );
  }

  return Response.json(
    {
      duplicate: true,
      ok: true,
      sessionId: appSessionToken(execution.receipt.turnId),
      turnId: execution.receipt.turnId,
    },
    {
      status: 202,
      headers: {
        "cache-control": "no-store",
        "retry-after": "1",
        "x-assistant-turn-id": execution.receipt.turnId,
        "x-assistant-turn-status": execution.receipt.status,
      },
    },
  );
}

async function handleStream(
  request: Request,
  route: Extract<CanonicalEveRoute, { kind: "stream" }>,
  user: EveProxyUser,
  dependencies: EveProxyDependencies,
): Promise<Response> {
  const actor = actorFor(user);
  const repository = dependencies.createRepository();
  const observation = await observationForAppSession(
    route,
    actor,
    repository,
    dependencies,
  );
  if (!observation.receipt.runtimeLocator) {
    throw new GuardrailError({
      code: "PRECONDITION_FAILED",
      where: "ai-assistant/eve/proxy#GET",
      message: "The delegated Eve session locator is not durable yet.",
      status: 425,
    });
  }
  const reconciledCursor = reconcileRequestedCursor(
    observation,
    route.startIndex,
  );
  if (
    observation.receipt.lifecycle === "terminal" &&
    reconciledCursor.atTurnEnd
  ) {
    return new Response("", {
      status: 200,
      headers: {
        "cache-control": "no-store",
        "content-type": "application/x-ndjson",
        "x-assistant-turn-id": observation.receipt.turnId,
        "x-assistant-turn-observe":
          `/api/ai-assistant/turns?turnId=${encodeURIComponent(observation.receipt.turnId)}`,
      },
    });
  }
  const reconciledStartIndex = reconciledCursor.upstreamStartIndex;
  const realStreamPath =
    `/eve/v1/session/${encodeURIComponent(observation.receipt.runtimeLocator)}` +
    `/stream?startIndex=${reconciledStartIndex}`;
  const streamHeaders = forwardedHeaders(
    request.headers,
    FORWARDED_REQUEST_HEADERS,
  );
  streamHeaders.set(
    "x-alleato-user-access-token",
    requiredUserAccessToken(request),
  );
  streamHeaders.set(
    "x-assistant-turn-id",
    observation.receipt.turnId,
  );
  streamHeaders.set(
    "x-alleato-assistant-surface",
    durableAssistantSurface(observation),
  );
  streamHeaders.set(
    "x-alleato-eve-proxy-secret",
    dependencies.eveProxySecret,
  );
  streamHeaders.set("x-alleato-supabase-url", dependencies.supabaseUrl);
  streamHeaders.set(
    "x-alleato-supabase-anon-key",
    dependencies.supabaseAnonKey,
  );
  const upstream = await dependencies.fetchUpstream(
    upstreamUrl(dependencies.eveBaseUrl, realStreamPath),
    {
      method: "GET",
      headers: streamHeaders,
      redirect: "manual",
      signal: request.signal,
    },
  );

  if (!upstream.ok || !upstream.body) {
    await failRunningTurn(
      observation,
      actor,
      repository,
      `Eve stream failed with HTTP ${upstream.status}.`,
      dependencies,
    );
    return safeUpstreamResponse(upstream);
  }

  const [rawClientBody, monitorBody] = upstream.body.tee();
  const monitor = monitorNdjsonStream({
    actor,
    body: monitorBody,
    observation,
    repository,
    startIndex: reconciledStartIndex,
    dependencies,
    signal: request.signal,
  });
  const clientBody = boundedNdjsonStream(rawClientBody, monitor);
  dependencies.defer(monitor.catch(() => {
    // The durable receipt records protocol failures. Never leak stream content
    // or bearer material through background logging.
  }));

  const response = safeUpstreamResponse(
    new Response(clientBody, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: upstream.headers,
    }),
  );
  response.headers.set("x-assistant-turn-id", observation.receipt.turnId);
  response.headers.set(
    "x-assistant-turn-observe",
    `/api/ai-assistant/turns?turnId=${encodeURIComponent(observation.receipt.turnId)}`,
  );
  return response;
}

export async function handleEveProxyRequest({
  dependencies,
  path,
  request,
}: {
  dependencies: EveProxyDependencies;
  path: readonly string[];
  request: Request;
}): Promise<Response> {
  const route = canonicalRoute(request.method, path, request.url);
  requireBearer(request);
  const user = await dependencies.authenticate(request);
  if (!user) {
    throw new GuardrailError({
      code: "AUTH_EXPIRED",
      where: "ai-assistant/eve/proxy",
      message: "The Eve proxy bearer token is invalid or expired.",
      status: 401,
    });
  }

  if (route.kind === "stream") {
    return handleStream(request, route, user, dependencies);
  }
  return handlePost(request, route, user, dependencies);
}
