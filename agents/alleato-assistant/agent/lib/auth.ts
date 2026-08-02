import { timingSafeEqual } from "node:crypto";
import { ForbiddenError } from "eve/channels/auth";

export type AlleatoAssistantSurface = "ai_assistant" | "ask_alleato";

export type AuthenticatedAlleatoUser = {
  assistantTurnId: string;
  assistantSurface: AlleatoAssistantSurface;
  email?: string;
  id: string;
  selectedProjectId?: number;
};

function requiredEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Eve authentication is missing ${name}.`);
  return value;
}

export async function authenticateAlleatoRequest(
  request: Request,
): Promise<AuthenticatedAlleatoUser | null> {
  validateEveProxySecret(
    request.headers.get("x-alleato-eve-proxy-secret"),
  );

  const accessToken =
    request.headers.get("x-alleato-user-access-token")?.trim() ??
    bearerAccessToken(request.headers.get("authorization"));
  if (!accessToken) return null;

  const { anonKey, supabaseUrl } = trustedSupabaseConfig(request);

  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      apikey: anonKey,
      authorization: `Bearer ${accessToken}`,
    },
  });

  if (response.status === 401 || response.status === 403) return null;
  if (!response.ok) {
    throw new Error(
      `Supabase authentication check failed with HTTP ${response.status}.`,
    );
  }

  const user = (await response.json()) as {
    email?: unknown;
    id?: unknown;
  };
  if (typeof user.id !== "string" || !user.id) return null;

  const assistantSurface = validateAssistantSurface(
    request.headers.get("x-alleato-assistant-surface"),
  );
  const assistantTurnId = validateAssistantTurnId(
    request.headers.get("x-assistant-turn-id"),
  );
  await validateDurableTurnSurface({
    accessToken,
    anonKey,
    assistantSurface,
    assistantTurnId,
    supabaseUrl,
    userId: user.id,
  });
  const selectedProjectId = await validateRequestedProject(
    request.headers.get("x-alleato-project-id"),
    { accessToken, anonKey, supabaseUrl },
  );

  return {
    assistantTurnId,
    assistantSurface,
    email: typeof user.email === "string" ? user.email : undefined,
    id: user.id,
    ...(selectedProjectId === undefined ? {} : { selectedProjectId }),
  };
}

function bearerAccessToken(authorization: string | null): string | null {
  const normalized = authorization?.trim();
  if (!normalized?.toLowerCase().startsWith("bearer ")) return null;
  return normalized.slice("bearer ".length).trim() || null;
}

function trustedSupabaseConfig(request: Request): {
  anonKey: string;
  supabaseUrl: string;
} {
  const supabaseUrl = request.headers
    .get("x-alleato-supabase-url")
    ?.trim();
  const anonKey = request.headers
    .get("x-alleato-supabase-anon-key")
    ?.trim();
  if (!supabaseUrl || !anonKey) {
    throw new Error(
      "The trusted Eve proxy must bind the request to its Supabase runtime.",
    );
  }

  const parsedUrl = new URL(supabaseUrl);
  if (
    parsedUrl.protocol !== "https:" ||
    parsedUrl.username ||
    parsedUrl.password ||
    parsedUrl.search ||
    parsedUrl.hash ||
    parsedUrl.pathname !== "/"
  ) {
    throw new Error(
      "The trusted Eve proxy supplied an invalid Supabase origin.",
    );
  }
  return {
    anonKey,
    supabaseUrl: parsedUrl.origin,
  };
}

function validateEveProxySecret(rawSecret: string | null): void {
  const expectedSecret = Buffer.from(
    requiredEnvironment("ALLEATO_EVE_PROXY_SECRET"),
  );
  const receivedSecret = Buffer.from(rawSecret ?? "");
  const comparableSecret = Buffer.alloc(expectedSecret.length);
  receivedSecret.copy(comparableSecret, 0, 0, expectedSecret.length);

  const secretsEqual = timingSafeEqual(comparableSecret, expectedSecret);
  const matches =
    receivedSecret.length === expectedSecret.length &&
    secretsEqual;
  if (!matches) {
    throw new ForbiddenError({
      code: "eve_proxy_forbidden",
      message: "The Eve request did not originate from the trusted proxy.",
    });
  }
}

function validateAssistantTurnId(rawTurnId: string | null): string {
  const turnId = rawTurnId?.trim();
  if (
    !turnId ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      turnId,
    )
  ) {
    throw new ForbiddenError({
      code: "invalid_assistant_turn",
      message: "x-assistant-turn-id must identify the durable assistant turn.",
    });
  }
  return turnId;
}

function validateAssistantSurface(
  rawSurface: string | null,
): AlleatoAssistantSurface {
  const surface = rawSurface?.trim();
  if (surface === "ai_assistant" || surface === "ask_alleato") {
    return surface;
  }

  throw new ForbiddenError({
    code: "invalid_assistant_surface",
    message:
      "x-alleato-assistant-surface must be ai_assistant or ask_alleato.",
  });
}

async function validateDurableTurnSurface({
  accessToken,
  anonKey,
  assistantSurface,
  assistantTurnId,
  supabaseUrl,
  userId,
}: {
  accessToken: string;
  anonKey: string;
  assistantSurface: AlleatoAssistantSurface;
  assistantTurnId: string;
  supabaseUrl: string;
  userId: string;
}): Promise<void> {
  const query = new URLSearchParams({
    id: `eq.${assistantTurnId}`,
    select: "command_payload",
    user_id: `eq.${userId}`,
  });
  let response: Response;
  try {
    response = await fetch(
      `${supabaseUrl}/rest/v1/durable_ai_turns?${query.toString()}`,
      {
        headers: {
          accept: "application/json",
          apikey: anonKey,
          authorization: `Bearer ${accessToken}`,
        },
      },
    );
  } catch (cause) {
    throw new Error(
      "Supabase durable turn surface verification request failed.",
      { cause },
    );
  }

  if (response.status === 401 || response.status === 403) {
    throw new ForbiddenError({
      code: "durable_turn_forbidden",
      message:
        "The Eve request is not bound to an authenticated durable assistant turn.",
    });
  }
  if (!response.ok) {
    throw new Error(
      `Supabase durable turn surface verification failed with HTTP ${response.status}.`,
    );
  }

  let rows: unknown;
  try {
    rows = await response.json();
  } catch (cause) {
    throw new Error(
      "Supabase durable turn surface verification returned unreadable JSON.",
      { cause },
    );
  }
  if (!Array.isArray(rows)) {
    throw new Error(
      "Supabase durable turn surface verification returned an invalid response.",
    );
  }
  if (rows.length !== 1) {
    throw new ForbiddenError({
      code: "durable_turn_forbidden",
      message:
        "The Eve request is not bound to an authenticated durable assistant turn.",
    });
  }

  const row = rows[0];
  const payload =
    typeof row === "object" && row !== null
      ? (row as { command_payload?: unknown }).command_payload
      : undefined;
  const durableSurface =
    typeof payload === "object" && payload !== null && !Array.isArray(payload)
      ? (payload as { surface?: unknown }).surface
      : undefined;
  const mappedSurface =
    durableSurface === "alleato_ai"
      ? "ai_assistant"
      : durableSurface === "ask_alleato"
        ? "ask_alleato"
        : null;

  if (mappedSurface !== assistantSurface) {
    throw new ForbiddenError({
      code: "durable_turn_surface_forbidden",
      message:
        "The claimed assistant surface does not match the durable assistant turn.",
    });
  }
}

async function validateRequestedProject(
  rawProjectId: string | null,
  credentials: {
    accessToken: string;
    anonKey: string;
    supabaseUrl: string;
  },
): Promise<number | undefined> {
  if (rawProjectId === null) return undefined;

  const normalized = rawProjectId.trim();
  if (!/^[1-9]\d*$/.test(normalized)) {
    throw new ForbiddenError({
      code: "invalid_project_context",
      message:
        "x-alleato-project-id must be a positive integer for an accessible project.",
    });
  }

  const projectId = Number(normalized);
  if (!Number.isSafeInteger(projectId)) {
    throw new ForbiddenError({
      code: "invalid_project_context",
      message:
        "x-alleato-project-id must be a positive safe integer for an accessible project.",
    });
  }

  const query = new URLSearchParams({
    id: `eq.${projectId}`,
    limit: "1",
    select: "id",
  });
  const response = await fetch(
    `${credentials.supabaseUrl}/rest/v1/projects?${query.toString()}`,
    {
      headers: {
        accept: "application/json",
        apikey: credentials.anonKey,
        authorization: `Bearer ${credentials.accessToken}`,
      },
    },
  );

  if (response.status === 401 || response.status === 403) {
    throw new ForbiddenError({
      code: "project_context_forbidden",
      message: "The selected project is not accessible to this user.",
    });
  }
  if (!response.ok) {
    throw new Error(
      `Supabase project authorization check failed with HTTP ${response.status}.`,
    );
  }

  const rows = (await response.json()) as unknown;
  if (
    !Array.isArray(rows) ||
    rows.length !== 1 ||
    typeof rows[0] !== "object" ||
    rows[0] === null ||
    (rows[0] as { id?: unknown }).id !== projectId
  ) {
    throw new ForbiddenError({
      code: "project_context_forbidden",
      message: "The selected project is not accessible to this user.",
    });
  }

  return projectId;
}
