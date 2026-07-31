import {
  loadCuratedMeetingRisks,
  loadMeetingDetail,
  loadPreviousMinutes,
  resolveMeetingDocumentId,
} from "../server";

type TableRows = Record<string, unknown[]>;

type LoaderClient = Parameters<typeof loadMeetingDetail>[0];

/**
 * Typed adapter from the fake `.from` mock to the loaders' client parameter.
 * The loaders' entire client surface is `.from(...)`, so a from-only stub is
 * the complete contract under test; widening happens once here instead of a
 * double-cast at every call site.
 */
function asLoaderClient(from: jest.Mock): LoaderClient {
  const stub: Pick<LoaderClient, "from"> = { from: from as LoaderClient["from"] };
  return stub as LoaderClient;
}

/**
 * Builds a fake Supabase client whose `.from(table)` returns a chainable
 * query builder that resolves with the rows registered for that table.
 * Terminal methods (`maybeSingle`, or the chain itself when awaited via
 * `.then`) resolve `{ data, error }`. Mirrors the per-table chain mock
 * pattern used in `src/lib/ai/retrieval/__tests__/source-specific-rag.test.ts`.
 */
function createMockSupabase(rows: TableRows) {
  const fromCalls: string[] = [];

  const from = jest.fn((table: string) => {
    fromCalls.push(table);
    const data = rows[table] ?? [];

    const chain: Record<string, unknown> = {};
    const chainable = ["select", "eq", "in", "order", "is"];
    for (const method of chainable) {
      chain[method] = jest.fn(() => chain);
    }
    chain.maybeSingle = jest.fn(async () => {
      const row = Array.isArray(data) ? data[0] : data;
      return { data: row ?? null, error: null };
    });
    // Support `await query` directly (thenable) for list queries.
    chain.then = (
      resolve: (value: { data: unknown[]; error: null }) => unknown,
    ) => resolve({ data, error: null });

    return chain;
  });

  return { from, fromCalls };
}

describe("loadMeetingDetail", () => {
  const meetingId = "11111111-1111-4111-8111-111111111111";
  const projectId = 67;
  const personId = "22222222-2222-4222-8222-222222222222";
  const category1 = "33333333-3333-4333-8333-333333333333";
  const category2 = "44444444-4444-4444-8444-444444444444";
  const item1 = "55555555-5555-4555-8555-555555555555";
  const item2 = "66666666-6666-4666-8666-666666666666";
  const item3 = "77777777-7777-4777-8777-777777777777";

  function baseRows(overrides: Partial<TableRows> = {}): TableRows {
    return {
      meetings: [
        {
          id: meetingId,
          project_id: projectId,
          series_id: "series-1",
          number: 1,
          name: "Weekly Sync",
          meeting_link: null,
          location: null,
          meeting_date: "2026-07-01",
          timezone: "America/Indiana/Indianapolis",
          start_time: null,
          end_time: null,
          is_private: false,
          is_draft: false,
          mode: "agenda",
          overview: null,
          template_id: null,
          transcript_document_id: null,
          created_by: null,
          deleted_at: null,
          created_at: "2026-07-01T00:00:00.000Z",
          updated_at: "2026-07-01T00:00:00.000Z",
        },
      ],
      meeting_attendees: [
        {
          id: "attendee-1",
          meeting_id: meetingId,
          person_id: personId,
          is_required: true,
          attended: null,
          people: {
            id: personId,
            first_name: "Jane",
            last_name: "Doe",
            email: "jane@example.com",
            company: "Acme Co",
          },
        },
      ],
      meeting_categories: [
        { id: category1, meeting_id: meetingId, name: "Uncategorized Items", position: 0 },
        { id: category2, meeting_id: meetingId, name: "Follow-ups", position: 1 },
      ],
      meeting_items: [
        {
          id: item1,
          meeting_id: meetingId,
          category_id: category1,
          position: 0,
          title: "First item",
          description: null,
          official_minutes: null,
          assignee_person_id: null,
          due_date: null,
          status: "open",
          priority: null,
          origin_meeting_id: meetingId,
          carried_from_item_id: null,
          created_at: "2026-07-01T00:00:00.000Z",
          updated_at: "2026-07-01T00:00:00.000Z",
        },
        {
          id: item2,
          meeting_id: meetingId,
          category_id: category2,
          position: 0,
          title: "Second item",
          description: null,
          official_minutes: null,
          assignee_person_id: null,
          due_date: null,
          status: "open",
          priority: null,
          origin_meeting_id: meetingId,
          carried_from_item_id: null,
          created_at: "2026-07-01T00:00:00.000Z",
          updated_at: "2026-07-01T00:00:00.000Z",
        },
        {
          id: item3,
          meeting_id: meetingId,
          category_id: category2,
          position: 1,
          title: "Third item",
          description: null,
          official_minutes: null,
          assignee_person_id: null,
          due_date: null,
          status: "closed",
          priority: null,
          origin_meeting_id: meetingId,
          carried_from_item_id: null,
          created_at: "2026-07-01T00:00:00.000Z",
          updated_at: "2026-07-01T00:00:00.000Z",
        },
      ],
      tasks: [
        { id: "task-1", meeting_item_id: item1 },
        { id: "task-2", meeting_item_id: item1 },
        { id: "task-3", meeting_item_id: item2 },
      ],
      meeting_series: [{ id: "series-1", name: "Weekly Sync Series", project_id: projectId }],
      ...overrides,
    };
  }

  it("composes agenda numbering, derived status, attendee people, and task counts", async () => {
    const { from } = createMockSupabase(baseRows());
    const supabase = asLoaderClient(from);

    const detail = await loadMeetingDetail(supabase, projectId, meetingId);

    expect(detail).not.toBeNull();
    expect(detail!.meeting.id).toBe(meetingId);
    // is_draft=false, mode='agenda' -> awaiting_minutes
    expect(detail!.meeting.status).toBe("awaiting_minutes");
    expect(detail!.meeting.series_name).toBe("Weekly Sync Series");

    expect(detail!.attendees).toHaveLength(1);
    expect(detail!.attendees[0].person_id).toBe(personId);
    expect(detail!.attendees[0].person.first_name).toBe("Jane");
    expect(detail!.attendees[0].person.last_name).toBe("Doe");

    expect(detail!.categories).toHaveLength(2);
    const cat1 = detail!.categories.find((c) => c.id === category1)!;
    const cat2 = detail!.categories.find((c) => c.id === category2)!;

    // Category 1 -> item1 = "1.1"
    expect(cat1.items).toHaveLength(1);
    expect(cat1.items[0].agenda_number).toBe("1.1");
    expect(cat1.items[0].task_count).toBe(2);

    // Category 2 -> item2 = "2.1", item3 = "2.2"
    expect(cat2.items).toHaveLength(2);
    const secondItem = cat2.items.find((i) => i.id === item2)!;
    const thirdItem = cat2.items.find((i) => i.id === item3)!;
    expect(secondItem.agenda_number).toBe("2.1");
    expect(secondItem.task_count).toBe(1);
    expect(thirdItem.agenda_number).toBe("2.2");
    expect(thirdItem.task_count).toBe(0);
  });

  it("returns null when the meeting does not exist", async () => {
    const { from } = createMockSupabase({ meetings: [] });
    const supabase = asLoaderClient(from);

    const detail = await loadMeetingDetail(supabase, projectId, meetingId);
    expect(detail).toBeNull();
  });

  it("returns null when the meeting belongs to a different project", async () => {
    const rows = baseRows();
    rows.meetings = [{ ...(rows.meetings[0] as Record<string, unknown>), project_id: 999 }];
    const { from } = createMockSupabase(rows);
    const supabase = asLoaderClient(from);

    const detail = await loadMeetingDetail(supabase, projectId, meetingId);
    expect(detail).toBeNull();
  });

  it("returns null when the meeting is soft-deleted", async () => {
    const rows = baseRows();
    rows.meetings = [{ ...(rows.meetings[0] as Record<string, unknown>), deleted_at: "2026-07-01T00:00:00.000Z" }];
    const { from } = createMockSupabase(rows);
    const supabase = asLoaderClient(from);

    const detail = await loadMeetingDetail(supabase, projectId, meetingId);
    expect(detail).toBeNull();
  });

  it("derives status 'draft' when is_draft is true regardless of mode", async () => {
    const rows = baseRows();
    rows.meetings = [{ ...(rows.meetings[0] as Record<string, unknown>), is_draft: true, mode: "minutes" }];
    const { from } = createMockSupabase(rows);
    const supabase = asLoaderClient(from);

    const detail = await loadMeetingDetail(supabase, projectId, meetingId);
    expect(detail!.meeting.status).toBe("draft");
  });

  it("returns an empty series_name when the meeting's series no longer exists", async () => {
    const rows = baseRows({ meeting_series: [] });
    const { from } = createMockSupabase(rows);
    const supabase = asLoaderClient(from);

    const detail = await loadMeetingDetail(supabase, projectId, meetingId);
    expect(detail!.meeting.series_name).toBe("");
  });
});

describe("loadCuratedMeetingRisks", () => {
  it("collapses near-duplicate curated risk cards before rendering", async () => {
    const documentId = "doc-1";
    const duplicateRiskA = "risk-a";
    const duplicateRiskB = "risk-b";
    const distinctRisk = "risk-c";

    const { from } = createMockSupabase({
      insight_card_evidence: [
        { insight_card_id: duplicateRiskA, source_document_id: documentId },
        { insight_card_id: duplicateRiskB, source_document_id: documentId },
        { insight_card_id: distinctRisk, source_document_id: documentId },
      ],
      insight_cards: [
        {
          id: duplicateRiskA,
          title: "Severe storms and related power disruptions may delay worker arrival",
          summary: "high",
          why_it_matters:
            "Severe storms and related power disruptions may continue to delay worker arrival and reduce productivity at the site.",
          confidence: "high",
          card_type: "schedule_risk",
          current_status: "open",
          attribution_status: "auto_assigned",
          severity: 5,
          last_seen_at: "2026-07-06T12:30:00+00:00",
          updated_at: "2026-07-06T12:31:00+00:00",
        },
        {
          id: duplicateRiskB,
          title: "Severe weather and power disruptions can delay worker arrival",
          summary: "high",
          why_it_matters:
            "Severe weather and power disruptions can delay worker arrival and reduce productivity at the site.",
          confidence: "high",
          card_type: "schedule_risk",
          current_status: "open",
          attribution_status: "auto_assigned",
          severity: 5,
          last_seen_at: "2026-07-06T12:30:00+00:00",
          updated_at: "2026-07-06T12:30:00+00:00",
        },
        {
          id: distinctRisk,
          title: "Hazmat bracket sourcing remains unresolved",
          summary: "high",
          why_it_matters:
            "Hazmat bracket sourcing remains unresolved, and delays in finding a stronger bracket design could block safe installation progress.",
          confidence: "high",
          card_type: "risk",
          current_status: "open",
          attribution_status: "auto_assigned",
          severity: 5,
          last_seen_at: "2026-07-06T12:30:00+00:00",
          updated_at: "2026-07-06T12:29:00+00:00",
        },
      ],
    });

    const supabase = asLoaderClient(from);
    const risks = await loadCuratedMeetingRisks(supabase, documentId);

    expect(risks).toHaveLength(2);
    expect(risks.map((risk) => risk.id)).toEqual([duplicateRiskA, distinctRisk]);
  });
});

describe("loadPreviousMinutes", () => {
  const itemD = "d0000000-0000-4000-8000-000000000000"; // current item, no history
  const itemC = "c0000000-0000-4000-8000-000000000000"; // carried from B
  const itemB = "b0000000-0000-4000-8000-000000000000"; // carried from A
  const itemA = "a0000000-0000-4000-8000-000000000000"; // oldest, no carried_from

  function itemRow(
    id: string,
    carriedFrom: string | null,
    meetingId: string,
    officialMinutes: string | null,
  ) {
    return {
      id,
      carried_from_item_id: carriedFrom,
      meeting_id: meetingId,
      official_minutes: officialMinutes,
    };
  }

  function meetingRow(id: string, number: number, date: string, isDraft: boolean, mode: string) {
    return {
      id,
      number,
      meeting_date: date,
      is_draft: isDraft,
      mode,
    };
  }

  it("walks a 3-link chain and returns entries oldest-first, stopping when carried_from_item_id is null", async () => {
    const itemsById: Record<string, ReturnType<typeof itemRow>> = {
      [itemC]: itemRow(itemC, itemB, "meeting-3", "Discussed C"),
      [itemB]: itemRow(itemB, itemA, "meeting-2", "Discussed B"),
      [itemA]: itemRow(itemA, null, "meeting-1", "Discussed A"),
    };

    const from = jest.fn((table: string) => {
      const chain: Record<string, unknown> = {};
      const chainable = ["select", "eq", "in", "order"];
      for (const method of chainable) {
        chain[method] = jest.fn(() => chain);
      }
      if (table === "meeting_items") {
        chain.maybeSingle = jest.fn(async () => {
          const idArg = (chain.eq as jest.Mock).mock.calls.at(-1)?.[1] as string;
          return { data: itemsById[idArg] ?? null, error: null };
        });
      } else if (table === "meetings") {
        chain.maybeSingle = jest.fn(async () => {
          const idArg = (chain.eq as jest.Mock).mock.calls.at(-1)?.[1];
          const meetingsById: Record<string, ReturnType<typeof meetingRow>> = {
            "meeting-1": meetingRow("meeting-1", 1, "2026-06-01", false, "minutes"),
            "meeting-2": meetingRow("meeting-2", 2, "2026-06-08", false, "minutes"),
            "meeting-3": meetingRow("meeting-3", 3, "2026-06-15", false, "minutes"),
          };
          return { data: meetingsById[idArg as string] ?? null, error: null };
        });
      }
      return chain;
    });

    const supabase = asLoaderClient(from);

    const history = await loadPreviousMinutes(supabase, itemC);

    expect(history).toHaveLength(2);
    expect(history[0].meeting_number).toBe(1);
    expect(history[0].official_minutes).toBe("Discussed A");
    expect(history[1].meeting_number).toBe(2);
    expect(history[1].official_minutes).toBe("Discussed B");
  });

  it("returns an empty array when the item has no carried_from_item_id", async () => {
    const from = jest.fn((table: string) => {
      const chain: Record<string, unknown> = {};
      const chainable = ["select", "eq", "in", "order"];
      for (const method of chainable) {
        chain[method] = jest.fn(() => chain);
      }
      if (table === "meeting_items") {
        chain.maybeSingle = jest.fn(async () => ({
          data: itemRow(itemD, null, "meeting-4", null),
          error: null,
        }));
      }
      return chain;
    });

    const supabase = asLoaderClient(from);
    const history = await loadPreviousMinutes(supabase, itemD);
    expect(history).toEqual([]);
  });

  it("stops after 20 hops to guard against a cyclical chain", async () => {
    // Build a chain of 25 items, each carried from the previous one, forming
    // item-0 <- item-1 <- ... <- item-24. Requesting history for item-24
    // must stop at 20 hops even though the chain is longer.
    const chainLength = 25;
    const ids = Array.from({ length: chainLength }, (_, i) => `item-${i}`);

    const from = jest.fn((table: string) => {
      const chain: Record<string, unknown> = {};
      const chainable = ["select", "eq", "in", "order"];
      for (const method of chainable) {
        chain[method] = jest.fn(() => chain);
      }
      if (table === "meeting_items") {
        chain.maybeSingle = jest.fn(async () => {
          const idArg = (chain.eq as jest.Mock).mock.calls.at(-1)?.[1] as string;
          const index = ids.indexOf(idArg);
          const carriedFrom = index > 0 ? ids[index - 1] : null;
          return {
            data: itemRow(idArg, carriedFrom, `meeting-${index}`, `minutes ${index}`),
            error: null,
          };
        });
      } else if (table === "meetings") {
        chain.maybeSingle = jest.fn(async () => {
          const idArg = (chain.eq as jest.Mock).mock.calls.at(-1)?.[1] as string;
          const index = Number(idArg.replace("meeting-", ""));
          return { data: meetingRow(idArg, index, `2026-01-${index + 1}`, false, "minutes"), error: null };
        });
      }
      return chain;
    });

    const supabase = asLoaderClient(from);
    const history = await loadPreviousMinutes(supabase, ids[chainLength - 1]);

    expect(history.length).toBeLessThanOrEqual(20);
  });
});

describe("resolveMeetingDocumentId", () => {
  const meetingsRowId = "88888888-8888-4888-8888-888888888888";
  const transcriptDocId = "99999999-9999-4999-8999-999999999999";
  const legacyDocId = "aaaaaaa1-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

  it("resolves to transcript_document_id when meetingId matches a meetings row with a linked transcript", async () => {
    const { from } = createMockSupabase({
      meetings: [{ id: meetingsRowId, transcript_document_id: transcriptDocId }],
    });
    const supabase = asLoaderClient(from);

    const result = await resolveMeetingDocumentId(supabase, meetingsRowId);

    expect(result).toEqual({ kind: "meetings_row", documentMetadataId: transcriptDocId });
  });

  it("returns meetings_row_no_transcript when the meetings row has no transcript linked yet", async () => {
    const { from } = createMockSupabase({
      meetings: [{ id: meetingsRowId, transcript_document_id: null }],
    });
    const supabase = asLoaderClient(from);

    const result = await resolveMeetingDocumentId(supabase, meetingsRowId);

    expect(result).toEqual({ kind: "meetings_row_no_transcript" });
  });

  it("falls back to legacy_document_id when meetingId does not match any meetings row", async () => {
    const { from } = createMockSupabase({ meetings: [] });
    const supabase = asLoaderClient(from);

    const result = await resolveMeetingDocumentId(supabase, legacyDocId);

    expect(result).toEqual({ kind: "legacy_document_id", documentMetadataId: legacyDocId });
  });
});
