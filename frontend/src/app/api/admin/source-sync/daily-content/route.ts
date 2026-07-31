import { NextResponse } from "next/server";

import { validateResponseContract, withApiGuardrails } from "@/lib/guardrails/api";

import { DailyContentResponseSchema, type DailyContentResponse } from "../_contracts";
import { loadCohort, loadEmbeddedSets, resolveDayWindow } from "../_daily";
import { newest, SOURCE_FAMILIES, type SourceFamilyKey } from "../_lifecycle";
import { requireAdmin } from "../_shared";

/**
 * Human-facing order and labels for the content-sync page. Kept here (not on the
 * SOURCE_FAMILIES config) so the operational lifecycle matrix can keep its own
 * wording while this page speaks plainly.
 */
const DISPLAY: Array<{ key: SourceFamilyKey; label: string }> = [
  { key: "emails", label: "Emails" },
  { key: "meetings", label: "Meeting transcripts" },
  { key: "sharepoint", label: "Documents" },
  { key: "teams", label: "Teams messages" },
];

export const GET = withApiGuardrails(
  "api.admin.source-sync.daily-content.GET",
  async ({ request }) => {
    await requireAdmin("api.admin.source-sync.daily-content.GET");

    const window = resolveDayWindow(new URL(request.url).searchParams.get("date"));
    const rows = await loadCohort(window);
    const { embeddedIds, embeddedMeetingTranscriptIds } = await loadEmbeddedSets(
      rows.map((row) => row.id),
    );

    const familyByKey = new Map(SOURCE_FAMILIES.map((family) => [family.key, family]));

    const sources = DISPLAY.map(({ key, label }) => {
      const family = familyByKey.get(key);
      const familyRows = family ? rows.filter(family.matches) : [];
      const vectorized = key === "meetings" ? embeddedMeetingTranscriptIds : embeddedIds;
      const embedded = familyRows.reduce(
        (total, row) => (vectorized.has(row.id) ? total + 1 : total),
        0,
      );
      const latestAt = newest(
        familyRows.map((row) => row.source_last_modified_at ?? row.date ?? row.created_at),
      );
      return { key, label, synced: familyRows.length, embedded, latestAt };
    });

    const payload: DailyContentResponse = {
      date: window.date,
      generatedAt: new Date().toISOString(),
      sources,
      totals: {
        synced: sources.reduce((total, source) => total + source.synced, 0),
        embedded: sources.reduce((total, source) => total + source.embedded, 0),
      },
    };

    return NextResponse.json(
      validateResponseContract(
        DailyContentResponseSchema,
        payload,
        "api.admin.source-sync.daily-content.GET",
      ),
    );
  },
);
