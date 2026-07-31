/**
 * LIVE parity test — proves `getProjectContent` (metadata/full path) selects the
 * SAME document set as the hand-rolled `loadRecentMeetingTranscriptItems` query
 * it replaces, against real production data.
 *
 * Skips automatically unless Supabase service creds are in the environment, so
 * it is a no-op in ordinary CI and a real gate when run with secrets:
 *   node --env-file=frontend/.env.local ./node_modules/.bin/jest content-source.live
 */

import { getProjectContent } from "@/lib/intelligence/content-source";
import {
  businessDaysAgoWindow,
  isWithinWindow,
} from "@/lib/intelligence/content-window";
import { serviceDb } from "@/lib/supabase/service-db";

const hasCreds =
  !!(process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL) &&
  !!process.env.SUPABASE_SERVICE_ROLE_KEY;

const describeLive = hasCreds ? describe : describe.skip;

describeLive("getProjectContent — live parity vs the old meeting query", () => {
  jest.setTimeout(30000);

  it("selects the same meeting document set for a 7-business-day window", async () => {
    const win = businessDaysAgoWindow(7);

    // NEW: through the module
    const items = await getProjectContent({
      window: win,
      granularity: "full",
      sourceTypes: ["meeting"],
      limit: 300,
    });
    const newIds = new Set(items.map((i) => i.documentId));

    // OLD: the exact selection loadRecentMeetingTranscriptItems performed
        const { data, error } = await serviceDb.from("document_metadata")
      .select("id,date,created_at,captured_at,category,type,project_id")
      .eq("type", "meeting")
      .or(
        `date.gte.${win.since},created_at.gte.${win.since},captured_at.gte.${win.since}`,
      )
      .order("date", { ascending: false })
      .limit(300);
    expect(error).toBeNull();
    const oldIds = new Set(
      (data ?? [])
        .filter((r) => isWithinWindow(r as never, win))
        .map((r) => (r as { id: string }).id),
    );

    // Identical selection — the migration is behaviour-preserving.
    expect([...newIds].filter((id) => !oldIds.has(id))).toEqual([]);
    expect([...oldIds].filter((id) => !newIds.has(id))).toEqual([]);

    // Every meeting with a project_id resolves to a real name (int8 coercion works live).
    const withProject = items.filter((i) => i.projectId != null);
    const unresolved = withProject.filter((i) => !i.projectName);
    // eslint-disable-next-line no-console
    console.log(
      `[live parity] meetings NEW=${newIds.size} OLD=${oldIds.size} named=${withProject.length - unresolved.length}/${withProject.length} unresolved=${unresolved.length}`,
    );
    if (unresolved.length > 0) {
      // eslint-disable-next-line no-console
      console.log(
        "[live parity] unresolved project_ids:",
        unresolved.map((i) => ({ id: i.documentId, projectId: i.projectId })),
      );
    }
    for (const item of withProject) {
      expect(item.projectName).toBeTruthy();
    }

    // The `raw` document row must be populated — the executive-brief item
    // builder (loadRecentMeetingTranscriptItems) maps from it after migration.
    for (const item of items) {
      expect(item.raw?.id).toBe(item.documentId);
    }
  });
});
