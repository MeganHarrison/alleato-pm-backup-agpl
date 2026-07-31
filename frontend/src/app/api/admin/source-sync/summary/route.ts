import { NextResponse } from "next/server";

import { validateResponseContract, withApiGuardrails } from "@/lib/guardrails/api";
import {
  listSourceSyncAiBriefSnapshots,
  saveSourceSyncAiBriefSnapshot,
  summarizeSourceSyncHealth,
} from "@/lib/ai/services/source-sync-summary";

import { SourceSyncStatusSchema } from "../_contracts";
import { fetchBackendSourceSync, requireAdmin } from "../_shared";

export const GET = withApiGuardrails(
  "api.admin.source-sync.summary.GET",
  async () => {
    await requireAdmin("api.admin.source-sync.summary.GET");
    const snapshots = await listSourceSyncAiBriefSnapshots();
    return NextResponse.json({ snapshots });
  },
);

export const POST = withApiGuardrails(
  "api.admin.source-sync.summary.POST",
  async ({ requestId }) => {
    const admin = await requireAdmin("api.admin.source-sync.summary.POST");
    const backendResponse = await fetchBackendSourceSync(
      requestId,
      "api.admin.source-sync.summary.POST",
      "status",
      { method: "GET" },
    );
    const payload = await backendResponse.json();
    const status = validateResponseContract(
      SourceSyncStatusSchema,
      payload,
      "api.admin.source-sync.summary.POST",
    );

    const summary = await summarizeSourceSyncHealth(status);
    const snapshot = await saveSourceSyncAiBriefSnapshot({
      status,
      summary,
      generatedByUserId: admin.userId,
    });

    return NextResponse.json({ summary, snapshot });
  },
);
