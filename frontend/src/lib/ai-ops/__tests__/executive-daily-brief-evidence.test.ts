import {
  assertExecutiveBriefingDraftEvidence,
  evidenceRefsFromDraft,
  type ExecutiveBriefingDraftEvidenceLike,
} from "../executive-daily-brief-evidence";

function draftWithItem(
  overrides: Partial<
    ExecutiveBriefingDraftEvidenceLike["packet"]["sections"]["needsBrandon"][number]
  > = {},
): ExecutiveBriefingDraftEvidenceLike {
  const item = {
    title: "Approve pending CO exposure",
    summary: "A pending CO needs Brandon approval before billing can move.",
    bullets: ["Pending CO needs approval."],
    source: "Document" as const,
    sourceDetail: "Acumatica ERP - Change Order Report",
    sourceId: "co-report-1",
    evidence: "9 projects with on-hold COs - $400K total pending revenue.",
    date: "2026-06-19T00:00:00.000Z",
    citations: [
      {
        source: "Document" as const,
        sourceDetail: "Acumatica ERP - Change Order Report",
        sourceId: "co-report-1",
        evidence: "9 projects with on-hold COs - $400K total pending revenue.",
        date: "2026-06-19T00:00:00.000Z",
      },
    ],
    project: "Portfolio",
    projectInternalId: 760,
    ...overrides,
  };

  return {
    id: "33333333-3333-4333-8333-333333333333",
    recapDate: "2026-06-19",
    workflowStatus: "draft",
    approvedAt: null,
    approvedBy: null,
    createdAt: "2026-06-19T12:00:00.000Z",
    updatedSummary: "Generated for test.",
    packet: {
      generatedAt: "2026-06-19T12:00:00.000Z",
      windowDays: 3,
      retrievalOrder: [],
      sections: {
        needsBrandon: [item],
        waitingOnOthers: [],
        importantUpdates: [],
      },
      sourceCoverage: [],
      retrievalNotes: [],
    },
  };
}

describe("Executive Daily Brief evidence policy", () => {
  it("accepts surfaced claims with structured citation evidence in every section", () => {
    const base = draftWithItem();
    const item = base.packet.sections.needsBrandon[0];
    const draft: ExecutiveBriefingDraftEvidenceLike = {
      ...base,
      packet: {
        ...base.packet,
        sections: {
          needsBrandon: [item],
          waitingOnOthers: [
            {
              ...item,
              title: "Waiting on project manager task closeout",
              source: "Meeting",
              citations: [
                {
                  source: "Meeting",
                  sourceDetail: "Fireflies Transcript - Ops Check-in",
                  sourceId: "meeting-1",
                  evidence: "PM owns task closeout before Friday.",
                  date: "2026-06-18T18:00:00.000Z",
                },
              ],
            },
          ],
          importantUpdates: [
            {
              ...item,
              title: "Teams escalation on closeout timing",
              source: "Teams",
              citations: [
                {
                  source: "Teams",
                  sourceDetail: "Teams Thread - Closeout",
                  sourceId: "teams-thread-1",
                  evidence: "Closeout timing was escalated in Teams.",
                  date: "2026-06-18T20:00:00.000Z",
                },
              ],
            },
          ],
        },
      },
    };

    expect(() => assertExecutiveBriefingDraftEvidence(draft)).not.toThrow();
    expect(evidenceRefsFromDraft(draft)).toMatchObject([
      {
        sourceFamily: "acumatica",
        sourceId: "co-report-1",
        sourceTitle: "Acumatica ERP - Change Order Report",
        internalHref: "/financial-insights",
        excerpt: "9 projects with on-hold COs - $400K total pending revenue.",
      },
      {
        sourceFamily: "meeting",
        sourceId: "meeting-1",
        sourceTitle: "Fireflies Transcript - Ops Check-in",
        internalHref: "/760/meetings/meeting-1",
        excerpt: "PM owns task closeout before Friday.",
      },
      {
        sourceFamily: "teams",
        sourceId: "teams-thread-1",
        sourceTitle: "Teams Thread - Closeout",
        internalHref: "/760/intelligence/sources/teams-thread-1",
        excerpt: "Closeout timing was escalated in Teams.",
      },
    ]);
  });

  it("prefers packet-owned sourceRefs when present", () => {
    const draft = draftWithItem({
      sourceRefs: [
        {
          sourceFamily: "email",
          sourceId: "packet-ref-1",
          sourceTitle: "Packet-owned source ref",
          internalHref: "/760/intelligence/sources/packet-ref-1",
          occurredAt: "2026-06-19T00:00:00.000Z",
          excerpt: "Packet already carries structured evidence.",
          confidence: "high",
          projectId: 760,
          projectLabel: "Portfolio",
          metadata: { recapDate: "2026-06-19" },
        },
      ],
    });

    expect(evidenceRefsFromDraft(draft)).toEqual(
      draft.packet.sections.needsBrandon[0].sourceRefs,
    );
    expect(() => assertExecutiveBriefingDraftEvidence(draft)).not.toThrow();
  });

  it("routes portfolio Acumatica evidence to the financial source surface", () => {
    const draft = draftWithItem({
      source: "Document",
      sourceDetail: "Acumatica ERP - Change Order Report",
      sourceId: "financial-co-Jun 19, 2026",
      project: "Multiple (9 projects)",
      projectInternalId: null,
      citations: [
        {
          source: "Document",
          sourceDetail: "Acumatica ERP - Change Order Report",
          sourceId: "financial-co-Jun 19, 2026",
          evidence: "9 projects with on-hold COs - $400K total pending revenue.",
          date: "2026-06-19T00:00:00.000Z",
        },
      ],
    });

    expect(evidenceRefsFromDraft(draft)[0]).toMatchObject({
      sourceFamily: "acumatica",
      sourceId: "financial-co-Jun 19, 2026",
      internalHref: "/financial-insights",
      projectId: null,
      projectLabel: "Multiple (9 projects)",
    });
  });

  it("fails when a surfaced claim has no citation", () => {
    const draft = draftWithItem({ citations: [] });

    expect(() => assertExecutiveBriefingDraftEvidence(draft)).toThrow(
      /has no citations/,
    );
  });

  it("fails when a citation lacks source identity or evidence excerpt", () => {
    const draft = draftWithItem({
      citations: [
        {
          source: "Document",
          sourceDetail: "",
          evidence: "",
          date: "Unknown date",
        },
      ],
    });

    expect(() => assertExecutiveBriefingDraftEvidence(draft)).toThrow(
      /missing source detail/,
    );
  });
});
