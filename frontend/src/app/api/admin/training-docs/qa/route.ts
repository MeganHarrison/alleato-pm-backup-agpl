export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

import { NextResponse } from "next/server";
import { z } from "zod";

import { parseJsonBody, withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { listTrainingDocs } from "@/lib/training-docs/server";
import type { TrainingDocWithAssets } from "@/lib/training-docs/types";
import {
  persistTrainingDocQa,
  runTrainingDocQa,
} from "@/lib/training-docs/qa";

import { requireTrainingDocsAdmin } from "../_shared";

const WHERE_POST = "admin/training-docs/qa#POST";

// Cap concurrent headless browsers so a batch run stays within memory.
const QA_CONCURRENCY = 3;

const batchQaSchema = z.object({
  scope: z.enum(["published", "all"]).default("published"),
  ids: z.array(z.string().uuid()).optional(),
  useLlm: z.boolean().optional(),
  limit: z.number().int().min(1).max(200).optional(),
});

export const POST = withApiGuardrails(WHERE_POST, async ({ request }) => {
  const { service } = await requireTrainingDocsAdmin(WHERE_POST);
  const body = await parseJsonBody(request, batchQaSchema, WHERE_POST);

  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) {
    throw new GuardrailError({
      code: "AUTH_EXPIRED",
      where: WHERE_POST,
      message:
        "A signed-in browser session is required before QA can open live workflows.",
      status: 401,
    });
  }

  const origin = new URL(request.url).origin;
  const allDocs = await listTrainingDocs(service);

  let targets: TrainingDocWithAssets[];
  if (body.ids && body.ids.length > 0) {
    const idSet = new Set(body.ids);
    targets = allDocs.filter((doc) => idSet.has(doc.id));
  } else if (body.scope === "all") {
    targets = allDocs;
  } else {
    targets = allDocs.filter((doc) => doc.status === "published");
  }

  if (body.limit) {
    targets = targets.slice(0, body.limit);
  }

  const results: Array<{
    id: string;
    slug: string;
    title: string;
    qa_status: string;
    checkedRoute: string | null;
  }> = [];

  let index = 0;
  async function worker() {
    while (index < targets.length) {
      const current = targets[index];
      index += 1;
      try {
        const result = await runTrainingDocQa({
          doc: current,
          origin,
          cookieHeader: cookieHeader!,
          useLlm: body.useLlm ?? true,
        });
        await persistTrainingDocQa(service, current.id, result);
        results.push({
          id: current.id,
          slug: current.slug,
          title: current.title,
          qa_status: result.qa_status,
          checkedRoute: result.checkedRoute,
        });
      } catch (error) {
        // Never let one doc abort the batch; record it as failing so the row
        // surfaces the problem rather than silently staying not_tested.
        const message = error instanceof Error ? error.message : String(error);
        await persistTrainingDocQa(service, current.id, {
          qa_status: "failing",
          qa_notes: `QA run errored: ${message}`,
          checkedRoute: current.source_route,
          signals: [message],
          usedLlm: false,
          pageContext: null,
        }).catch(() => undefined);
        results.push({
          id: current.id,
          slug: current.slug,
          title: current.title,
          qa_status: "failing",
          checkedRoute: current.source_route,
        });
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(QA_CONCURRENCY, targets.length) }, () =>
      worker(),
    ),
  );

  const summary = results.reduce<Record<string, number>>((acc, row) => {
    acc[row.qa_status] = (acc[row.qa_status] ?? 0) + 1;
    return acc;
  }, {});

  return NextResponse.json({
    checked: results.length,
    summary,
    results,
  });
});
