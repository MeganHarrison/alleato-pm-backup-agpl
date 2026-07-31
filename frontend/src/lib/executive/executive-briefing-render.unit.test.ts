import { linkedClaimSources } from "./executive-briefing-render";
import type { BrandonBriefItem, BriefCitation } from "./brandon-daily-update";

// Build a minimal brief item carrying a single citation. Only the fields
// citationHref/resolveProjectId read (source, sourceId, sourceUrl, project,
// projectInternalId) matter here.
function itemWith(
  citation: BriefCitation,
  opts: { project?: string | null; projectInternalId?: number | null } = {},
): BrandonBriefItem {
  return {
    title: "t",
    summary: "s",
    bullets: [],
    source: citation.source,
    sourceDetail: citation.sourceDetail,
    sourceUrl: citation.sourceUrl,
    sourceId: citation.sourceId,
    date: citation.date,
    project: opts.project ?? null,
    projectInternalId: opts.projectInternalId ?? null,
    citations: [citation],
  } as unknown as BrandonBriefItem;
}

const OUTLOOK_URL =
  "https://outlook.office365.com/owa/?ItemID=AAMkAD-abc123&exvsurl=1";
const TRANSCRIPT_URL =
  "https://lgveqfnpkxvzbnnwuled.supabase.co/storage/v1/object/public/transcripts/meeting.md";

describe("citationHref (via linkedClaimSources) — always prefer the in-app source page", () => {
  it("links a meeting to the global /meetings/{id} page when there is no project — never the raw transcript file", () => {
    const [link] = linkedClaimSources(
      itemWith({
        source: "Meeting",
        sourceDetail: "Weekly coordination",
        sourceId: "01KWYW9F66ADP5JQW8FKV9RTS1",
        sourceUrl: TRANSCRIPT_URL,
        date: "2026-07-08",
      }),
    );
    expect(link.href).toBe(
      "https://projects.alleatogroup.com/meetings/01KWYW9F66ADP5JQW8FKV9RTS1",
    );
    expect(link.href).not.toContain("supabase.co");
  });

  it("links a meeting to the project-scoped detail page when the project is known", () => {
    const [link] = linkedClaimSources(
      itemWith(
        {
          source: "Meeting",
          sourceDetail: "Weekly coordination",
          sourceId: "01KWYW",
          sourceUrl: TRANSCRIPT_URL,
          date: "2026-07-08",
        },
        { projectInternalId: 67 },
      ),
    );
    expect(link.href).toBe(
      "https://projects.alleatogroup.com/67/meetings/01KWYW",
    );
  });

  it("links an unassigned email to the global in-app source page — never Outlook", () => {
    const [link] = linkedClaimSources(
      itemWith({
        source: "Email",
        sourceDetail: "RE: McLane Follow Up",
        sourceId: "outlook_AAMkAD",
        sourceUrl: OUTLOOK_URL,
        date: "2026-07-09",
      }),
    );
    expect(link.href).toBe(
      "https://projects.alleatogroup.com/intelligence/sources/outlook_AAMkAD",
    );
    expect(link.href).not.toContain("outlook.office365.com");
  });

  it("links an email with a known project to the project-scoped source page", () => {
    const [link] = linkedClaimSources(
      itemWith(
        {
          source: "Email",
          sourceDetail: "RE: McLane",
          sourceId: "outlook_x",
          sourceUrl: OUTLOOK_URL,
          date: "2026-07-09",
        },
        { projectInternalId: 31 },
      ),
    );
    expect(link.href).toBe(
      "https://projects.alleatogroup.com/31/intelligence/sources/outlook_x",
    );
  });

  it("falls back to the external URL only when there is no source id to build an in-app link", () => {
    const [link] = linkedClaimSources(
      itemWith({
        source: "Email",
        sourceDetail: "no id",
        sourceUrl: OUTLOOK_URL,
        date: "2026-07-09",
      }),
    );
    expect(link.href).toBe(OUTLOOK_URL);
  });
});
