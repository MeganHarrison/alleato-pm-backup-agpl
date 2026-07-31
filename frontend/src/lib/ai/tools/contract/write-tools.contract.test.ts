/**
 * AI WRITE-tool contract harness.
 *
 * For every tool in WRITE_TOOL_SPECS, prove it actually works against a live
 * DB — not just that it returns success text. "write" specs call the tool with
 * confirmed:true and read the row back; "preview" specs (external sends / LLM)
 * assert a sane preview without firing the side effect.
 *
 * Run all:        npm run ai:contract
 * Run one tool:   npm run ai:contract -- -t createTask
 * Machine output: npm run ai:contract -- --json --outputFile=<path>
 *
 * Excluded from `npm run test:unit` (different config + filename), so it never
 * runs in CI without a service-role key.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createActionTools } from "@/lib/ai/tools/action-tools";
import {
  WRITE_TOOL_SPECS,
  expectSuccess,
  extractId,
  type SpecContext,
  type ToolMap,
} from "./write-tools.contract";

const PROJECT_ID = Number(process.env.CONTRACT_PROJECT_ID ?? "67");
const TEST_EMAIL = process.env.TEST_USER_1 ?? "test1@mail.com";
const FALLBACK_USER_ID = "6ae4299f-6c21-4e99-b6a1-ccb1fe5aa7f6";

function serviceClient(): SupabaseClient {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY — load frontend/.env.local " +
        "(the contract jest config does this via setupFiles).",
    );
  }
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function resolveUserId(sb: SupabaseClient): Promise<string> {
  try {
    const { data } = await sb.auth.admin.listUsers({ page: 1, perPage: 200 });
    const match = data?.users.find(
      (u) => u.email?.toLowerCase() === TEST_EMAIL.toLowerCase(),
    );
    return match?.id ?? FALLBACK_USER_ID;
  } catch {
    return FALLBACK_USER_ID;
  }
}

describe("AI write-tool contracts (live DB)", () => {
  let sb: SupabaseClient;
  let tools: ToolMap;
  let userId: string;

  beforeAll(async () => {
    sb = serviceClient();
    userId = await resolveUserId(sb);
    tools = createActionTools(userId, {}) as unknown as ToolMap;
  });

  for (const spec of WRITE_TOOL_SPECS) {
    const title =
      spec.mode === "preview"
        ? `${spec.tool} [preview-only — ${spec.externalReason ?? "external"}]`
        : spec.tool;

    test(title, async () => {
      const stamp = `contract-${spec.tool}-${Date.now()}`;
      const ctx: SpecContext = {
        sb,
        tools,
        projectId: PROJECT_ID,
        userId,
        stamp,
        fixture: {},
      };

      const entry = tools[spec.tool];
      if (!entry || typeof entry.execute !== "function") {
        throw new Error(
          `Tool "${spec.tool}" is not registered in createActionTools — ` +
            `it was renamed or removed. Update WRITE_TOOL_SPECS.`,
        );
      }

      // Mirror the AI SDK: parse raw input through the tool's zod inputSchema so
      // .default()s are applied before execute() runs. Without this, calling
      // execute() directly leaves defaulted fields undefined.
      const parse = (raw: Record<string, unknown>) => {
        const schema = entry.inputSchema;
        return schema && typeof schema.parse === "function"
          ? schema.parse(raw)
          : raw;
      };

      // -------- preview mode: assert sane preview, never fire the effect ----
      if (spec.mode === "preview") {
        if (spec.prereq) await spec.prereq(ctx);
        const result = (await entry.execute(
          parse({ ...spec.input(ctx), confirmed: false }),
        )) as Record<string, unknown>;
        if (result?.error) {
          // A validation error the spec explicitly accepts proves the tool's
          // business rules ran — count it as a pass.
          if (spec.acceptError && spec.acceptError.test(String(result.error))) {
            return;
          }
          throw new Error(`preview returned an error: ${String(result.error)}`);
        }
        if (result?.action !== "preview") {
          throw new Error(
            `expected action:"preview" (confirmed:false), got ${JSON.stringify(result)}`,
          );
        }
        return;
      }

      // -------- write mode: run, read the row back, then clean up ----------
      let result: unknown;
      try {
        if (spec.prereq) await spec.prereq(ctx);

        result = await entry.execute(
          parse({ ...spec.input(ctx), confirmed: true, idempotencyKey: stamp }),
        );

        expectSuccess(result);

        if (spec.verify) {
          await spec.verify(result, ctx);
        } else {
          // Default: extract the new id and confirm the row exists.
          const id = extractId(result);
          if (!id) {
            throw new Error(
              `success reported but no row id found in result: ${JSON.stringify(result)}`,
            );
          }
          if (!spec.table) {
            throw new Error(`spec for ${spec.tool} has no table for read-back`);
          }
          const { data, error } = await sb
            .from(spec.table)
            .select("id")
            .eq("id", id)
            .maybeSingle();
          if (error) throw new Error(`read-back query failed: ${error.message}`);
          if (!data) {
            throw new Error(
              `SILENT NO-OP: tool reported success but no row exists in ` +
                `${spec.table} for id ${id}.`,
            );
          }
          ctx.fixture.createdId = id;
        }
      } finally {
        // Best-effort cleanup so the harness is re-runnable.
        try {
          if (spec.cleanup) {
            await spec.cleanup(result, ctx);
          } else if (spec.table) {
            const id = (ctx.fixture.createdId as string) ?? extractId(result);
            if (id) await sb.from(spec.table).delete().eq("id", id);
          }
        } catch {
          /* cleanup is best-effort; never mask the real assertion */
        }
      }
    }, 60000);
  }
});
