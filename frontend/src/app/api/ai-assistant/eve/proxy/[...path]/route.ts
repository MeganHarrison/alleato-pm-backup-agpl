import { randomUUID } from "node:crypto";
import { after } from "next/server";

import {
  createSupabaseAssistantTurnRepository,
} from "@/lib/ai/assistant-turn";
import { conversationBelongsToSurface } from "@/lib/ai/chat-surface.server";
import { withApiGuardrails } from "@/lib/guardrails/api";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { createServiceClient } from "@/lib/supabase/service";
import {
  createClientWithToken,
  getApiRouteUserFromRequest,
} from "@/lib/supabase/server";

import {
  handleEveProxyRequest,
  requiredEveBaseUrl,
  resolveCanonicalProjectName,
  type EveProxyDependencies,
} from "./eve-proxy";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

type RouteParams = { path: string[] };

function requiredEveProxySecret(): string {
  const secret = process.env.ALLEATO_EVE_PROXY_SECRET?.trim();
  if (!secret || secret.length < 32) {
    throw new Error(
      "Eve proxy configuration requires ALLEATO_EVE_PROXY_SECRET with at least 32 characters.",
    );
  }
  return secret;
}

function productionDependencies(): EveProxyDependencies {
  const supabase = getSupabaseConfig();
  return {
    authenticate: getApiRouteUserFromRequest,
    authorizeConversation: (userId, conversation) =>
      conversationBelongsToSurface({
        sessionId: conversation.id,
        userId,
        surface: conversation.surface,
      }),
    async resolveProjectByCanonicalName(request, message) {
      const authorization = request.headers.get("authorization");
      const token = authorization?.startsWith("Bearer ")
        ? authorization.slice("Bearer ".length).trim()
        : "";
      if (!token) return { status: "not_found" };
      const { data, error } = await createClientWithToken(token)
        .from("projects")
        .select("id,name")
        .eq("archived", false);
      if (error) {
        throw new Error(
          `RLS-scoped Eve project resolution failed: ${error.message}`,
        );
      }
      return resolveCanonicalProjectName(
        message,
        (data ?? []).flatMap((project) =>
          typeof project.name === "string"
            ? [{ id: project.id, name: project.name }]
            : [],
        ),
      );
    },
    createRepository: () =>
      createSupabaseAssistantTurnRepository(createServiceClient()),
    eveBaseUrl: requiredEveBaseUrl(process.env.ALLEATO_EVE_URL, {
      allowLocalHttp: process.env.NODE_ENV === "development",
    }),
    eveProxySecret: requiredEveProxySecret(),
    supabaseUrl: supabase.url,
    supabaseAnonKey: supabase.anonKey,
    fetchUpstream: (input, init) => fetch(input, init),
    createTurnId: randomUUID,
    defer: (task) => after(() => task),
  };
}

function handler(method: "GET" | "POST") {
  return withApiGuardrails<RouteParams>(
    `ai-assistant/eve/proxy#${method}`,
    async ({ request, params }) =>
      handleEveProxyRequest({
        dependencies: productionDependencies(),
        path: params.path,
        request,
      }),
  );
}

export const GET = handler("GET");
export const POST = handler("POST");
