import type { DeliveryAttempt } from "./contracts";

export const DELIVERY_ROUTER_VERSION = "delivery-router.v1";

export type LedgerDeliveryChannel = DeliveryAttempt["channel"];

export type DeliveryPlatformEntry = {
  id: string;
  label: string;
  channel: LedgerDeliveryChannel | null;
  enabled: boolean;
  supportsDryRun: boolean;
  supportsLedgerAttempt: boolean;
  sourceUsage: "REFERENCE" | "ADAPT" | "COPY" | "ALLEATO_NATIVE";
  notes: string;
};

export type DeliveryTarget = {
  platform: string;
  recipientId?: string | null;
  recipientAddress?: string | null;
  displayName?: string | null;
  dryRun?: boolean;
  enabled?: boolean;
  metadata?: Record<string, unknown>;
};

export type DeliveryPayload = {
  summary: string;
  artifactId?: string | null;
  contentType?: string | null;
  metadata?: Record<string, unknown>;
};

export type DeliveryAdapterInput = {
  entry: DeliveryPlatformEntry;
  target: DeliveryTarget;
  payload: DeliveryPayload;
};

export type DeliveryAdapterSuccess = {
  ok: true;
  status: "sent" | "dry_run" | "skipped";
  providerMessageId?: string | null;
  message?: string | null;
  metadata?: Record<string, unknown>;
};

export type DeliveryAdapterFailure = {
  ok: false;
  status: "blocked" | "failed" | "disabled";
  failureCode: string;
  failureMessage: string;
  retryable?: boolean;
  metadata?: Record<string, unknown>;
};

export type DeliveryAdapterResult =
  | DeliveryAdapterSuccess
  | DeliveryAdapterFailure;

export type DeliveryAdapter = {
  deliver(input: DeliveryAdapterInput): Promise<DeliveryAdapterResult>;
};

export type DeliveryRouteResult = {
  ok: boolean;
  platform: string;
  status: DeliveryAttempt["status"];
  target: DeliveryTarget;
  providerMessageId: string | null;
  failureCode: string | null;
  failureMessage: string | null;
  retryable: boolean;
  attemptedAt: string;
  ledgerChannel: LedgerDeliveryChannel | null;
  metadata: Record<string, unknown>;
};

export type DeliveryRouterResult = {
  ok: boolean;
  status: "succeeded" | "partial_success" | "failed" | "skipped";
  results: DeliveryRouteResult[];
  sentCount: number;
  failedCount: number;
  blockedCount: number;
  disabledCount: number;
};

export type DeliveryRouter = {
  route(input: {
    payload: DeliveryPayload;
    targets: DeliveryTarget[];
  }): Promise<DeliveryRouterResult>;
};

export const DEFAULT_DELIVERY_PLATFORM_ENTRIES: DeliveryPlatformEntry[] = [
  {
    id: "teams",
    label: "Microsoft Teams",
    channel: "teams",
    enabled: true,
    supportsDryRun: true,
    supportsLedgerAttempt: true,
    sourceUsage: "ALLEATO_NATIVE",
    notes:
      "Existing Teams provider sends remain owned by current delivery routes; router normalizes target/result shape.",
  },
  {
    id: "email",
    label: "Email",
    channel: "email",
    enabled: true,
    supportsDryRun: true,
    supportsLedgerAttempt: true,
    sourceUsage: "ALLEATO_NATIVE",
    notes:
      "Existing Resend/Outlook send helpers remain provider owners; router normalizes target/result shape.",
  },
  {
    id: "digest",
    label: "Digest",
    channel: null,
    enabled: true,
    supportsDryRun: true,
    supportsLedgerAttempt: false,
    sourceUsage: "ALLEATO_NATIVE",
    notes:
      "Digest is a platform entry for workflow routing, not a provider delivery-attempt channel in the current schema.",
  },
];

function normalizePlatform(value: string): string {
  return value.trim().toLowerCase();
}

export function resolveDeliveryPlatformEntry(
  platform: string,
  entries: DeliveryPlatformEntry[] = DEFAULT_DELIVERY_PLATFORM_ENTRIES,
): DeliveryPlatformEntry | null {
  const normalized = normalizePlatform(platform);
  return entries.find((entry) => normalizePlatform(entry.id) === normalized) ?? null;
}

export function ledgerChannelForDeliveryPlatform(
  platform: string,
  entries: DeliveryPlatformEntry[] = DEFAULT_DELIVERY_PLATFORM_ENTRIES,
): LedgerDeliveryChannel | null {
  const entry = resolveDeliveryPlatformEntry(platform, entries);
  if (!entry?.enabled || !entry.supportsLedgerAttempt) return null;
  return entry.channel;
}

function nowIso(now?: () => Date): string {
  return (now ? now() : new Date()).toISOString();
}

function routeFailure(input: {
  platform: string;
  status: "blocked" | "failed" | "disabled";
  target: DeliveryTarget;
  failureCode: string;
  failureMessage: string;
  retryable?: boolean;
  attemptedAt: string;
  ledgerChannel?: LedgerDeliveryChannel | null;
  metadata?: Record<string, unknown>;
}): DeliveryRouteResult {
  return {
    ok: false,
    platform: input.platform,
    status: input.status,
    target: input.target,
    providerMessageId: null,
    failureCode: input.failureCode,
    failureMessage: input.failureMessage,
    retryable: input.retryable ?? false,
    attemptedAt: input.attemptedAt,
    ledgerChannel: input.ledgerChannel ?? null,
    metadata: input.metadata ?? {},
  };
}

function normalizeAdapterResult(input: {
  platform: string;
  target: DeliveryTarget;
  result: DeliveryAdapterResult;
  attemptedAt: string;
  ledgerChannel: LedgerDeliveryChannel | null;
}): DeliveryRouteResult {
  if (input.result.ok) {
    return {
      ok: input.result.status === "sent" || input.result.status === "dry_run",
      platform: input.platform,
      status: input.result.status,
      target: input.target,
      providerMessageId: input.result.providerMessageId ?? null,
      failureCode: null,
      failureMessage: null,
      retryable: false,
      attemptedAt: input.attemptedAt,
      ledgerChannel: input.ledgerChannel,
      metadata: {
        message: input.result.message ?? null,
        ...(input.result.metadata ?? {}),
      },
    };
  }

  return routeFailure({
    platform: input.platform,
    status: input.result.status,
    target: input.target,
    failureCode: input.result.failureCode,
    failureMessage: input.result.failureMessage,
    retryable: input.result.retryable,
    attemptedAt: input.attemptedAt,
    ledgerChannel: input.ledgerChannel,
    metadata: input.result.metadata,
  });
}

export function createDeliveryRouter(input: {
  entries?: DeliveryPlatformEntry[];
  adapters?: Record<string, DeliveryAdapter>;
  now?: () => Date;
} = {}): DeliveryRouter {
  const configuredEntries = input.entries ?? DEFAULT_DELIVERY_PLATFORM_ENTRIES;
  const adapters = input.adapters ?? {};

  async function routeOne(
    payload: DeliveryPayload,
    target: DeliveryTarget,
  ): Promise<DeliveryRouteResult> {
    const platform = normalizePlatform(target.platform);
    const attemptedAt = nowIso(input.now);
    const entry = resolveDeliveryPlatformEntry(platform, configuredEntries);

    if (!entry) {
      return routeFailure({
        platform,
        status: "blocked",
        target,
        failureCode: "UNSUPPORTED_DELIVERY_PLATFORM",
        failureMessage: `Delivery platform '${platform}' is not registered.`,
        attemptedAt,
      });
    }

    if (!entry.enabled || target.enabled === false) {
      return routeFailure({
        platform,
        status: "disabled",
        target,
        failureCode: "DELIVERY_PLATFORM_DISABLED",
        failureMessage: `Delivery platform '${platform}' is disabled.`,
        attemptedAt,
        ledgerChannel: entry.channel,
      });
    }

    if (target.dryRun === true && !entry.supportsDryRun) {
      return routeFailure({
        platform,
        status: "blocked",
        target,
        failureCode: "DELIVERY_DRY_RUN_UNSUPPORTED",
        failureMessage: `Delivery platform '${platform}' does not support dry runs.`,
        attemptedAt,
        ledgerChannel: entry.channel,
      });
    }

    const adapter = adapters[platform];
    if (!adapter) {
      return routeFailure({
        platform,
        status: "blocked",
        target,
        failureCode: "DELIVERY_ADAPTER_MISSING",
        failureMessage: `No delivery adapter is registered for '${platform}'.`,
        attemptedAt,
        ledgerChannel: entry.channel,
      });
    }

    try {
      const result = await adapter.deliver({ entry, target, payload });
      return normalizeAdapterResult({
        platform,
        target,
        result,
        attemptedAt,
        ledgerChannel: entry.channel,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return routeFailure({
        platform,
        status: "failed",
        target,
        failureCode: "DELIVERY_ADAPTER_THROWN",
        failureMessage: message,
        retryable: true,
        attemptedAt,
        ledgerChannel: entry.channel,
      });
    }
  }

  return {
    async route({ payload, targets }) {
      const results = await Promise.all(
        targets.map((target) => routeOne(payload, target)),
      );
      const sentCount = results.filter((result) => result.status === "sent").length;
      const failedCount = results.filter((result) => result.status === "failed").length;
      const blockedCount = results.filter((result) => result.status === "blocked").length;
      const disabledCount = results.filter((result) => result.status === "disabled").length;
      const successfulCount = results.filter((result) => result.ok).length;

      return {
        ok: results.length > 0 && successfulCount === results.length,
        status:
          results.length === 0
            ? "skipped"
            : successfulCount === results.length
              ? "succeeded"
              : successfulCount > 0
                ? "partial_success"
                : "failed",
        results,
        sentCount,
        failedCount,
        blockedCount,
        disabledCount,
      };
    },
  };
}

export function deliveryAttemptFromRouteResult(input: {
  runId: string;
  payload: DeliveryPayload;
  result: DeliveryRouteResult;
}): DeliveryAttempt {
  const { result } = input;
  if (!result.ledgerChannel) {
    throw new Error(
      `Delivery platform '${result.platform}' cannot be recorded as an AI Ops delivery attempt with the current schema.`,
    );
  }

  return {
    runId: input.runId,
    artifactId: input.payload.artifactId ?? null,
    channel: result.ledgerChannel,
    recipientId: result.target.recipientId ?? null,
    recipientAddress: result.target.recipientAddress ?? null,
    status: result.status,
    providerMessageId: result.providerMessageId,
    failureCode: result.failureCode,
    failureMessage: result.failureMessage,
    retryable: result.retryable,
    attemptedAt: result.attemptedAt,
    metadata: {
      routerVersion: DELIVERY_ROUTER_VERSION,
      platform: result.platform,
      displayName: result.target.displayName ?? null,
      payloadSummary: input.payload.summary,
      payloadContentType: input.payload.contentType ?? null,
      target: result.target.metadata ?? {},
      result: result.metadata,
      payload: input.payload.metadata ?? {},
    },
  };
}
