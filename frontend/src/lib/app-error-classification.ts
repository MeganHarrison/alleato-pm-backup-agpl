export interface AppErrorGroupForClassification {
  id: string;
  source: string;
  severity: string;
  status: string;
  event_count: number;
  affected_user_count: number;
  affected_project_count: number;
  first_seen_at: string;
  last_seen_at: string;
  signature: string;
  latest_message: string;
  latest_route: string | null;
  latest_action: string | null;
  latest_error_code: string | null;
  latest_request_id: string | null;
  latest_project_id: number | null;
}

export interface AppErrorEventForPacket {
  id: string;
  created_at: string;
  source: string;
  severity: string;
  route: string | null;
  action: string | null;
  error_code: string | null;
  error_message: string;
  request_id: string | null;
  status_code: number | null;
  page_path: string | null;
  stack: string | null;
  component_stack: string | null;
}

export interface AppErrorClassification {
  category: string;
  likelyOwner: string;
  likelyCause: string;
  detectionGap: string;
  preventionStep: string;
  suggestedVerification: string;
}

function includesAny(value: string, needles: string[]): boolean {
  return needles.some((needle) => value.includes(needle));
}

export function classifyAppError(
  group: AppErrorGroupForClassification,
): AppErrorClassification {
  const haystack = [
    group.latest_message,
    group.latest_route,
    group.latest_action,
    group.latest_error_code,
    group.signature,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (
    includesAny(haystack, [
      "schema cache",
      "pgrst200",
      "pgrst201",
      "could not find a relationship",
      "foreign key",
      "db_migration_mismatch",
    ])
  ) {
    return {
      category: "Schema or migration mismatch",
      likelyOwner: "Database/API route owner",
      likelyCause: "The app expected a table, column, relation, or PostgREST cache entry that is not present on the linked database.",
      detectionGap: "The failing route was not covered by a migration-ledger or response-contract check before users hit it.",
      preventionStep: "Add or repair the migration, verify the exact version on remote, regenerate Supabase types, and add a route contract smoke.",
      suggestedVerification: "Run the exact failing route, `npm run db:migrations:verify-applied -- <migration>`, and a targeted API smoke for the route.",
    };
  }

  if (
    includesAny(haystack, [
      "auth_expired",
      "auth_forbidden",
      "forbidden",
      "permission",
      "unauthorized",
      "401",
      "403",
    ])
  ) {
    return {
      category: "Auth or permission failure",
      likelyOwner: "Permissions/API route owner",
      likelyCause: "The user was unauthenticated, missing a feature grant, or blocked by an overly broad permission check.",
      detectionGap: "The permission path did not expose a clear user-facing recovery or did not have role-specific coverage.",
      preventionStep: "Add explicit permission checks with actionable error codes and route tests for allowed and denied users.",
      suggestedVerification: "Replay the route as the affected user and as an allowed admin/user; verify both response envelopes and UI messaging.",
    };
  }

  if (
    includesAny(haystack, [
      "timeout",
      "aborterror",
      "upstream_timeout",
      "upstream_failure",
      "networkerror",
      "failed to fetch",
    ])
  ) {
    return {
      category: "Network or upstream failure",
      likelyOwner: "Integration/API route owner",
      likelyCause: "A request timed out, an upstream service failed, or the client could not reach the endpoint.",
      detectionGap: "The integration path did not capture dependency status, retryability, or a bounded timeout before surfacing failure.",
      preventionStep: "Use the shared fetch guardrail with timeout, dependency metadata, and clear retry/fallback behavior.",
      suggestedVerification: "Run the failing action with dependency logs enabled and verify retry, timeout, and error-envelope behavior.",
    };
  }

  if (
    includesAny(haystack, [
      "chunk",
      "_next/static",
      "failed to fetch dynamically imported module",
      "new version available",
    ])
  ) {
    return {
      category: "Frontend deployment asset mismatch",
      likelyOwner: "Frontend shell/deployment owner",
      likelyCause: "The browser had stale static assets after a deploy or failed to load a Next.js chunk.",
      detectionGap: "Chunk recovery was not confirmed across deploy transitions or the failure repeated after auto-refresh.",
      preventionStep: "Keep chunk recovery active and verify deploy cache headers/static asset retention on Vercel.",
      suggestedVerification: "Reproduce after a fresh deploy with an old tab open and confirm one reload recovers without looping.",
    };
  }

  if (group.source === "client") {
    return {
      category: "Client runtime failure",
      likelyOwner: "Frontend route/component owner",
      likelyCause: "A browser-side component, API call, or event handler threw during the user flow.",
      detectionGap: "The route did not have enough interaction coverage for the failing action.",
      preventionStep: "Add a focused browser or component regression that exercises the captured route/action.",
      suggestedVerification: "Open the captured route, repeat the action, and verify the UI no longer throws or logs this signature.",
    };
  }

  return {
    category: "Server/API runtime failure",
    likelyOwner: "API route owner",
    likelyCause: "An API route or server process threw an unhandled error.",
    detectionGap: "The shared guardrail caught the failure, but no route-specific regression blocked it earlier.",
    preventionStep: "Normalize the failure into a typed GuardrailError and add targeted route coverage for the failing branch.",
    suggestedVerification: "Run the exact API route/action and confirm the response envelope, logs, and grouped telemetry stop repeating.",
  };
}

export function buildAppErrorFixPacket(params: {
  group: AppErrorGroupForClassification;
  events: AppErrorEventForPacket[];
  appUrl?: string;
}): string {
  const { group, events, appUrl } = params;
  const classification = classifyAppError(group);
  const topEvents = events.slice(0, 5);
  const title = `[${group.severity.toUpperCase()}] ${classification.category}: ${group.latest_route ?? group.latest_action ?? "Application error"}`;

  return [
    `# ${title}`,
    "",
    "## What broke",
    group.latest_message,
    "",
    "## Where",
    `- Route: ${group.latest_route ?? "unknown"}`,
    `- Action: ${group.latest_action ?? "unknown"}`,
    `- Source: ${group.source}`,
    `- Error code: ${group.latest_error_code ?? "unknown"}`,
    `- Request id: ${group.latest_request_id ?? "unknown"}`,
    appUrl ? `- Error group: ${appUrl}/errors?errorGroup=${group.id}` : `- Error group id: ${group.id}`,
    "",
    "## Impact",
    `- Events: ${group.event_count}`,
    `- Affected users: ${group.affected_user_count}`,
    `- Affected projects: ${group.affected_project_count}`,
    `- First seen: ${group.first_seen_at}`,
    `- Last seen: ${group.last_seen_at}`,
    "",
    "## Diagnosis",
    `- Category: ${classification.category}`,
    `- Likely owner: ${classification.likelyOwner}`,
    `- Likely cause: ${classification.likelyCause}`,
    `- Detection gap: ${classification.detectionGap}`,
    `- Prevention step: ${classification.preventionStep}`,
    "",
    "## Recent events",
    ...topEvents.flatMap((event, index) => [
      `${index + 1}. ${event.created_at}`,
      `   - Route: ${event.route ?? event.page_path ?? "unknown"}`,
      `   - Action: ${event.action ?? "unknown"}`,
      `   - Status: ${event.status_code ?? "unknown"}`,
      `   - Request id: ${event.request_id ?? "unknown"}`,
    ]),
    "",
    "## Acceptance criteria",
    "- Reproduce the captured route/action or explain why it is no longer reproducible.",
    "- Fix the root cause without hiding the error or adding a silent fallback.",
    "- Add or update a targeted regression check for the failing branch.",
    "- Confirm this error signature stops increasing in `/errors` after the fix.",
    "",
    "## Suggested verification",
    classification.suggestedVerification,
  ].join("\n");
}
