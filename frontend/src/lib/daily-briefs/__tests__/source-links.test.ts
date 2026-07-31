import type { DailyBriefSourceRef } from "../canonical-packets";
import {
  buildSourceIndex,
  candidateSourceTokens,
  cleanSourceTitle,
  markKnownSourceCitations,
  resolveCandidateSources,
} from "../source-links";

function ref(overrides: Partial<DailyBriefSourceRef>): DailyBriefSourceRef {
  return {
    id: "id",
    alias: null,
    title: "Title",
    lane: "documents",
    projectId: null,
    projectName: null,
    sourceAt: null,
    url: null,
    ...overrides,
  };
}

const SOURCES: DailyBriefSourceRef[] = [
  ref({
    id: "01KWENX1J352C1R8E3VPVZ69A4",
    alias: "S1",
    lane: "meetings",
    title: "Meeting: Union Collective: Updated OAC",
    url: "https://storage.example/transcript.md",
  }),
  ref({
    id: "teamsdm_cd0dcb2f4f189d3c_2026-07-08",
    alias: "S2",
    lane: "teams",
    title: "Teams DM Conversation: 19:81e9018c",
    url: null,
  }),
  ref({
    id: "outlook_AAMkADk2_alpha",
    alias: "S3",
    lane: "emails",
    title: "Email: RE: McLane Follow Up",
    url: "https://outlook.office365.com/owa/?ItemID=alpha",
  }),
  ref({
    id: "outlook_AAMkADk2_beta",
    alias: "S4",
    lane: "emails",
    title: "Email: Re: Sprinkler RFQ",
    url: "https://outlook.office365.com/owa/?ItemID=beta",
  }),
];

describe("cleanSourceTitle", () => {
  it("strips the compiler's lane prefix", () => {
    expect(cleanSourceTitle(SOURCES[0])).toBe("Union Collective: Updated OAC");
    expect(cleanSourceTitle(SOURCES[2])).toBe("RE: McLane Follow Up");
  });

  it("uses a friendly lane label when the title is an opaque id or empty", () => {
    expect(
      cleanSourceTitle(
        ref({ lane: "teams", title: "Teams DM Conversation: 19:81e9018c" }),
      ),
    ).toBe("Teams message");
    expect(cleanSourceTitle(ref({ lane: "emails", title: "Email:" }))).toBe(
      "Email",
    );
  });
});

describe("buildSourceIndex.resolve", () => {
  const index = buildSourceIndex(SOURCES);

  it("resolves an exact source id", () => {
    expect(index.resolve("01KWENX1J352C1R8E3VPVZ69A4")?.lane).toBe("meetings");
  });

  it("resolves a short citation alias to its source", () => {
    // The current citation scheme: the model cites `S3`, which the resolver
    // maps to the full Outlook source — the whole reason aliases can't be
    // mangled the way a long id can.
    expect(index.resolve("S3")?.id).toBe("outlook_AAMkADk2_alpha");
    expect(index.resolve("S1")?.lane).toBe("meetings");
  });

  it("returns null for an alias that isn't in the manifest", () => {
    expect(index.resolve("S99")).toBeNull();
  });

  it("resolves a token truncated with a trailing ellipsis via unique prefix", () => {
    expect(index.resolve("01KWENX1J352C1R8E3VPVZ…")?.id).toBe(
      "01KWENX1J352C1R8E3VPVZ69A4",
    );
  });

  it("resolves a token shortened with an interior ellipsis via unique prefix+suffix", () => {
    // Prefix 'outlook_AAMkADk2_a' + suffix 'pha' matches only _alpha.
    expect(index.resolve("outlook_AAMkADk2_a...pha")?.id).toBe(
      "outlook_AAMkADk2_alpha",
    );
  });

  it("does NOT resolve an ambiguous prefix", () => {
    // Prefix matches both outlook_AAMkADk2_alpha and _beta.
    expect(index.resolve("outlook_AAMkADk2_...")).toBeNull();
  });

  it("resolves a teams source that has no url", () => {
    const teams = index.resolve("teamsdm_cd0dcb2f4f189d3c_2026-07-08");
    expect(teams?.lane).toBe("teams");
    expect(teams?.url).toBeNull();
  });

  it("returns null for text that is not a source id", () => {
    expect(index.resolve("some inline code")).toBeNull();
    expect(index.resolve("")).toBeNull();
  });
});

describe("markKnownSourceCitations", () => {
  const index = buildSourceIndex(SOURCES);

  it("normalizes known plain aliases without changing unknown or already-marked tokens", () => {
    const markdown = "Known [S1], unknown [S999], already `[S2]`.";

    expect(markKnownSourceCitations(markdown, index)).toBe(
      "Known `S1`, unknown [S999], already `[S2]`.",
    );
  });

  it("preserves Markdown reference definitions", () => {
    const markdown = "Evidence [S1]\n\n[S1]: https://example.com/source";

    expect(markKnownSourceCitations(markdown, index)).toBe(
      "Evidence `S1`\n\n[S1]: https://example.com/source",
    );
  });
});

describe("candidateSourceTokens", () => {
  it("collects extraction_json.source_ids then source_document_id, primary last", () => {
    expect(
      candidateSourceTokens({
        source_document_id: "01KWENX1J352C1R8E3VPVZ69A4",
        extraction_json: { source_ids: ["outlook_AAMkADk2_alpha", ""] },
      }),
    ).toEqual(["outlook_AAMkADk2_alpha", "01KWENX1J352C1R8E3VPVZ69A4"]);
  });

  it("tolerates a missing/malformed extraction_json", () => {
    expect(
      candidateSourceTokens({ source_document_id: "x", extraction_json: null }),
    ).toEqual(["x"]);
    expect(
      candidateSourceTokens({
        source_document_id: null,
        extraction_json: "not-an-object",
      }),
    ).toEqual([]);
  });
});

describe("resolveCandidateSources", () => {
  const index = buildSourceIndex(SOURCES);

  it("resolves a meeting candidate to its linkable source", () => {
    const sources = resolveCandidateSources(
      {
        source_document_id: "01KWENX1J352C1R8E3VPVZ69A4",
        extraction_json: { source_ids: ["01KWENX1J352C1R8E3VPVZ69A4"] },
      },
      index,
    );
    expect(sources).toHaveLength(1);
    expect(sources[0].lane).toBe("meetings");
    expect(sources[0].url).toBe("https://storage.example/transcript.md");
  });

  it("de-dupes when source_ids and source_document_id point at the same source", () => {
    const sources = resolveCandidateSources(
      {
        source_document_id: "outlook_AAMkADk2_alpha",
        extraction_json: { source_ids: ["outlook_AAMkADk2_alpha"] },
      },
      index,
    );
    expect(sources).toHaveLength(1);
  });

  it("drops ambiguous truncated ids rather than mislinking", () => {
    // A truncated Outlook prefix that matches both _alpha and _beta must not
    // resolve to a wrong record — the candidate simply has no linked source.
    const sources = resolveCandidateSources(
      {
        source_document_id: "outlook_AAMkADk2_...",
        extraction_json: { source_ids: ["outlook_AAMkADk2_..."] },
      },
      index,
    );
    expect(sources).toEqual([]);
  });
});
