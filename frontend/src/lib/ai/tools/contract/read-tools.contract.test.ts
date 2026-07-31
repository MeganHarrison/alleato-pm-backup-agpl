/**
 * AI READ-tool contract harness.
 *
 * For every tool in READ_TOOL_SPECS: invoke it with valid args against a live
 * project and assert it executes, returns a well-shaped result, and does NOT
 * surface an error. Targeted specs additionally assert non-empty results where
 * data is known to exist (catches the swallowed-error-as-empty failure mode).
 *
 * Run all:        npm run ai:contract:read
 * Run one tool:   npm run ai:contract:read -- -t semanticSearch
 *
 * Excluded from `npm run test:unit` (different config + filename), so it never
 * runs in CI without a service-role key.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createOperationalTools } from "@/lib/ai/tools/operational";
import { createFinancialTools } from "@/lib/ai/tools/financial";
import { createDocumentIntelligenceTools } from "@/lib/ai/tools/document-intelligence";
import { createScheduleTools } from "@/lib/ai/tools/schedule-tools";
import { createStructuredQueryTools } from "@/lib/ai/tools/structured-queries";
import { createProjectTools } from "@/lib/ai/tools/project-tools";
import { createToolGuardrails } from "@/lib/ai/tools/guardrails";
import {
  READ_TOOL_SPECS,
  expectReadOk,
  type ReadFactoryKey,
  type ReadSpecContext,
} from "./read-tools.contract";

const RICH_PROJECT_ID = Number(process.env.CONTRACT_RICH_PROJECT_ID ?? "1009");
const STRUCT_PROJECT_ID = Number(process.env.CONTRACT_PROJECT_ID ?? "67");
const TEST_EMAIL = process.env.TEST_USER_1 ?? "test1@mail.com";
const FALLBACK_USER_ID = "6ae4299f-6c21-4e99-b6a1-ccb1fe5aa7f6";

type ToolEntry = {
  execute: (input: unknown) => Promise<unknown>;
  inputSchema?: { parse?: (input: unknown) => Record<string, unknown> };
};
type Factory = Record<string, ToolEntry>;

function serviceClient(): SupabaseClient {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing SUPABASE_URL / SERVICE_ROLE_KEY");
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function resolveUserId(sb: SupabaseClient): Promise<string> {
  try {
    const { data } = await sb.auth.admin.listUsers({ page: 1, perPage: 200 });
    return (
      data?.users.find((u) => u.email?.toLowerCase() === TEST_EMAIL.toLowerCase())
        ?.id ?? FALLBACK_USER_ID
    );
  } catch {
    return FALLBACK_USER_ID;
  }
}

describe("AI read-tool contracts (live DB)", () => {
  let factories: Partial<Record<ReadFactoryKey, Factory>>;
  /** Construction errors per factory, surfaced on the relevant tool tests. */
  let factoryErrors: Partial<Record<ReadFactoryKey, string>>;
  let ctx: ReadSpecContext;

  beforeAll(async () => {
    const sb = serviceClient();
    const userId = await resolveUserId(sb);
    ctx = { sb, richProjectId: RICH_PROJECT_ID, structuredProjectId: STRUCT_PROJECT_ID };
    factories = {};
    factoryErrors = {};

    const build = (key: ReadFactoryKey, fn: () => Factory) => {
      try {
        factories[key] = fn();
      } catch (err) {
        factoryErrors[key] = err instanceof Error ? err.message : String(err);
      }
    };

    build("operational", () => createOperationalTools(userId, {}) as unknown as Factory);
    build("financial", () => createFinancialTools(userId, {}) as unknown as Factory);
    build("documentIntelligence", () => createDocumentIntelligenceTools(userId, {}) as unknown as Factory);
    build("schedule", () => createScheduleTools(userId, {}) as unknown as Factory);
    build("structured", () => {
      const guardrails = createToolGuardrails(userId, {});
      return createStructuredQueryTools(
        sb as unknown as Parameters<typeof createStructuredQueryTools>[0],
        guardrails,
        {},
      ) as unknown as Factory;
    });
    build("project", () => createProjectTools(userId, {}) as unknown as Factory);
  });

  for (const spec of READ_TOOL_SPECS) {
    test(spec.tool, async () => {
      if (factoryErrors[spec.factory]) {
        throw new Error(
          `factory "${spec.factory}" failed to construct: ${factoryErrors[spec.factory]}`,
        );
      }
      const factory = factories[spec.factory];
      const entry = factory?.[spec.tool];
      if (!entry || typeof entry.execute !== "function") {
        throw new Error(
          `Tool "${spec.tool}" is not registered in factory "${spec.factory}" — ` +
            `renamed or removed. Update READ_TOOL_SPECS.`,
        );
      }

      const raw = spec.input(ctx);
      const input = entry.inputSchema?.parse ? entry.inputSchema.parse(raw) : raw;
      const result = await entry.execute(input);

      expectReadOk(result);

      if (spec.expectNonEmpty) {
        const arr = spec.expectNonEmpty(result);
        if (!Array.isArray(arr)) {
          throw new Error(
            `expected a non-empty array on the result, got ${typeof arr}: ${JSON.stringify(result).slice(0, 300)}`,
          );
        }
        if (arr.length === 0) {
          throw new Error(
            `SWALLOWED-EMPTY RISK: tool returned an empty array for a project ` +
              `with known data. Either the query is wrong or an error was ` +
              `swallowed and returned as empty.`,
          );
        }
      }
    }, 60000);
  }
});
