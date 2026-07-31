// Node built-in test runner: `node --test project-intelligence/**/__tests__/`
// Covers the v3 brief renderer/validator and the learning-loop consumer's
// structured extractors — no DB, pure functions only.
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { renderBriefMarkdownV3, validateBriefV3, nextMovesFromBriefV3 } from "../brief-v3.mjs";
import {
  candidatesFromPacket,
  projectCurrentStateFromPacket,
  projectCurrentStateProjectionEnvelope,
  assertProjectIntelligenceCoverage,
} from "../../projections/daily-deep-read-consumers.mjs";

function sampleBrief() {
  return {
    version: "v3",
    businessDate: "2026-07-08",
    executiveSignal: {
      headline: "Union is the clearest near-term margin risk.",
      whyNow: "A decision is still open while the cost exposure is moving.",
      focus: "Resolve the battery-storage decision before it blocks the next commitment.",
      watchouts: ["Teams has no deep link for direct source review."],
    },
    callsToday: [
      { project: "Union Collective", question: "decide on battery storage.", optional: false, sourceIds: ["S247"] },
      { project: "Goodwill Brookville", question: "escalate the signature?", optional: true, sourceIds: ["S126"] },
    ],
    projects: [
      {
        name: "Union Collective",
        urgencyRank: 1,
        hasOwnerDecision: true,
        resolvedToday: false,
        actionItems: [
          { ownerIsBrandon: true, owner: "You", text: "decide on battery storage", due: null, dueIso: null, urgency: null, optional: false, sourceIds: ["S247"] },
          { ownerIsBrandon: false, owner: "Andrew Cannon", text: "email Viox", due: "July 14", dueIso: "2026-07-14", urgency: null, optional: false, sourceIds: ["S247"] },
        ],
        context: "Union is losing money this week. [S247]",
      },
      {
        name: "Goodwill Brookville",
        urgencyRank: 2,
        hasOwnerDecision: true,
        resolvedToday: false,
        actionItems: [
          { ownerIsBrandon: false, owner: "Tony Courtney", text: "get the signed subcontract", due: null, dueIso: null, urgency: "Blocking; ASAP", optional: false, sourceIds: ["S126"] },
        ],
        context: "Blocked on a signature. [S126]",
      },
      {
        name: "McLane Jazz, Utah",
        urgencyRank: 9,
        hasOwnerDecision: false,
        resolvedToday: true,
        actionItems: [],
        context: "Resolved today. [S259]",
      },
    ],
    looseEnds: [{ text: "Confirm the $160,000 wire cleared.", sourceIds: [] }],
    preventionFindings: [],
    sourceCoverage: { meetings: 1, emails: 2, teams: 1, documents: 0, thinLanes: [], note: "S260 and S307 are the same email." },
    sources: {
      S247: { title: "Teams", type: "teams", url: null, project: "Union Collective" },
      S126: { title: "Koontz email", type: "email", url: "https://x/126", project: "Goodwill Brookville Road" },
      S259: { title: "McLane email", type: "email", url: "https://x/259", project: "McLane Jazz - UT" },
    },
  };
}

function samplePacket() {
  return {
    id: "pkt-1",
    generated_at: "2026-07-08T20:00:00Z",
    covered_end_at: "2026-07-09T04:00:00Z",
    covered_start_at: { toISOString: () => "2026-07-08T04:00:00.000Z" },
    packet_json: {
      businessDate: "2026-07-08",
      sourceSet: { sources: [
        { id: "teamsdm_abc", alias: "S247", projectId: 1 },
        { id: "outlook_x", alias: "S126", projectId: 2 },
      ] },
      brief: sampleBrief(),
    },
  };
}

const PROJECT_ROWS = [
  { id: 1, name: "Union Collective", projectNumber: null, normalizedName: "union collective", tokens: ["union", "collective"], distinctiveTokens: ["collective"] },
  { id: 2, name: "Goodwill Brookville", projectNumber: null, normalizedName: "goodwill brookville", tokens: ["goodwill", "brookville"], distinctiveTokens: ["brookville"] },
];

describe("renderBriefMarkdownV3", () => {
  const md = renderBriefMarkdownV3(sampleBrief());

  it("opens at the title with no format-explainer line, straight into the calls index", () => {
    assert.ok(md.startsWith("# Daily Executive Brief — 2026-07-08\n"));
    assert.match(md, /## Executive signal/);
    assert.match(md, /\*\*Headline\.\*\* Union is the clearest/);
    assert.doesNotMatch(md, /Projects are ordered most urgent first/i);
    const firstContent = md.split("\n").slice(1).find((l) => l.trim() && l.trim() !== "---");
    assert.equal(firstContent, "## Executive signal");
  });

  it("renders action-first blocks, You/owner, real due dates, and the collapsed group", () => {
    assert.match(md, /- \*\*Union Collective\*\* — decide on battery storage\./);
    assert.match(md, /- \*\*Goodwill Brookville\*\* \*\(optional\)\* — escalate/);
    assert.match(md, /- \*\*You — decide on battery storage\*\* \[S247\]/);
    assert.match(md, /- \*\*Andrew Cannon — email Viox\*\* Due July 14\. \[S247\]/);
    assert.match(md, /## Also moving — nothing needed from you/);
    assert.match(md, /<summary><strong>Show 1 project on track<\/strong><\/summary>/);
    assert.match(md, /### McLane Jazz, Utah/);
    assert.doesNotMatch(md, /^## McLane Jazz, Utah$/m);
    assert.match(md, /\[S126\]: https:\/\/x\/126/);
    assert.ok(!md.includes("[S247]: "));
  });

  it("validates a good brief and throws on a malformed one", () => {
    assert.doesNotThrow(() => validateBriefV3(sampleBrief()));
    assert.throws(() => validateBriefV3({ version: "v2", projects: [] }));
    assert.equal(nextMovesFromBriefV3(sampleBrief())[0], "You: decide on battery storage");
  });
});

describe("consumer extractors (structured brief → candidates + project_current_state)", () => {
  const cands = candidatesFromPacket(samplePacket(), PROJECT_ROWS);
  const decisions = cands.filter((c) => c.signal_type === "decision");
  const tasks = cands.filter((c) => c.signal_type === "task");

  it("derives decision candidates from callsToday and task candidates from action items", () => {
    assert.equal(decisions.length, 2);
    assert.equal(tasks.length, 2); // battery item deduped into the decision
    assert.ok(decisions.some((c) => c.title.includes("battery")));
    assert.ok(!tasks.some((c) => c.title.includes("battery")));
  });

  it("canonicalizes source aliases, assigns projects, and carries owner + due", () => {
    assert.equal(decisions.find((c) => c.title.startsWith("Union")).source_document_id, "teamsdm_abc");
    assert.equal(decisions.find((c) => c.title.startsWith("Union")).project_id, 1);
    const viox = tasks.find((c) => c.title.includes("Viox"));
    assert.equal(viox.suggested_owner_label, "Andrew Cannon");
    assert.equal(viox.extraction_json.due, "July 14");
    assert.equal(viox.project_id, 1);
  });

  it("never stores placeholder prose in why_it_matters / next_action", () => {
    assert.ok(cands.every((c) => c.why_it_matters === null && c.next_action === null));
  });

  it("rolls each project's context into project_current_state, stripping citations", () => {
    const pcs = projectCurrentStateFromPacket(samplePacket(), PROJECT_ROWS);
    assert.equal(pcs.length, 2);
    assert.ok(pcs.every((r) => !/\[S\d+\]/.test(r.current_summary)));
    assert.ok(pcs.find((r) => r.project_id === 1).current_summary.startsWith("Union Collective: Union is losing money"));
  });

  it("builds a packet-lineage projection patch without any direct-write fields", () => {
    const record = projectCurrentStateFromPacket(samplePacket(), PROJECT_ROWS).find((row) => row.project_id === 1);
    const envelope = projectCurrentStateProjectionEnvelope(record, samplePacket());
    assert.equal(envelope.projectId, 1);
    assert.equal(envelope.writer, "daily_deep_read");
    assert.equal(envelope.provenance.source_kind, "daily_deep_read_packet");
    assert.equal(envelope.provenance.packet_id, "pkt-1");
    assert.equal(envelope.provenance.generated_at, "2026-07-08T20:00:00Z");
    assert.equal(envelope.provenance.covered_start_at, "2026-07-08T04:00:00.000Z");
    assert.equal(envelope.provenance.covered_end_at, "2026-07-09T04:00:00Z");
    assert.equal(envelope.provenance.compiler_version, "daily_deep_read_consumers_v1");
    assert.equal(envelope.projection.current_summary, "Union Collective: Union is losing money this week.");
    assert.equal("project_id" in envelope.projection, false);
    assert.equal("updated_at" in envelope.projection, false);
    assert.equal("source_confidence" in envelope.projection, false);
  });

  it("fails loudly when an active source project has no intelligence record", () => {
    const rows = [
      { id: 1, name: "Union Collective" },
      { id: 2, name: "Goodwill Brookville" },
    ];
    assert.deepEqual(
      assertProjectIntelligenceCoverage(samplePacket(), rows, [
        { project_id: 1, current_summary: "Union" },
        { project_id: 2, current_summary: "Goodwill" },
      ]),
      { activeProjects: 2, currentStateRecords: 2 },
    );
    assert.throws(
      () => assertProjectIntelligenceCoverage(samplePacket(), rows, [{ project_id: 1 }]),
      /missing records.*2/,
    );
  });
});

// Guardrail: import the generator's pure helpers. If a used helper is ever
// deleted (as parseModelJson was, only caught by a live run), these fail to
// import / resolve — catching it in unit tests, not in production.
import {
  parseModelJson,
  buildSourcesMap,
  collectCitedAliases,
  assertBriefProjectCoverage,
} from "../compile-daily-executive-brief.mjs";

describe("generator pure helpers", () => {
  it("parseModelJson parses fenced and prose-wrapped JSON, null on garbage", () => {
    assert.deepEqual(parseModelJson('```json\n{"a":1}\n```'), { a: 1 });
    assert.deepEqual(parseModelJson('here you go: {"b":2} thanks'), { b: 2 });
    assert.equal(parseModelJson("not json at all"), null);
  });

  it("collectCitedAliases gathers aliases from calls, items, and context", () => {
    const cited = collectCitedAliases({
      callsToday: [{ sourceIds: ["S1"] }],
      looseEnds: [{ sourceIds: ["S2"] }],
      projects: [{ actionItems: [{ sourceIds: ["S3"] }], context: "text with [S4] and [S5]" }],
    });
    assert.deepEqual([...cited].sort(), ["S1", "S2", "S3", "S4", "S5"]);
  });

  it("buildSourcesMap keeps only cited sources and maps lane -> type", () => {
    const sources = [
      { alias: "S1", title: "Mtg", lane: "meetings", url: "https://m", projectName: "P" },
      { alias: "S2", title: "Doc", lane: "documents", url: null, projectName: null },
      { alias: "S9", title: "Uncited", lane: "emails", url: "https://x", projectName: null },
    ];
    const map = buildSourcesMap(sources, new Set(["S1", "S2"]));
    assert.deepEqual(Object.keys(map).sort(), ["S1", "S2"]);
    assert.equal(map.S1.type, "meeting");
    assert.equal(map.S2.type, "document");
    assert.equal(map.S2.url, null);
  });

  it("fails before project-record generation when the brief drops an active project", () => {
    const sources = [
      { projectId: 1, projectName: "Union Collective" },
      { projectId: 2, projectName: "Goodwill Brookville" },
    ];
    assert.throws(
      () => assertBriefProjectCoverage(sources, { projects: [{ name: "Union Collective" }] }),
      /missing brief project blocks.*Goodwill Brookville/,
    );
  });
});

// --- input hygiene: dedup (#806) + attribution backstop (#807) ---------------
import {
  contentSignature,
  projectIdFromTitle,
  correctAttribution,
} from "../compile-daily-executive-brief.mjs";

describe("dedup content signature (#806)", () => {
  it("same title + same body → same signature; different body → different", () => {
    const a = contentSignature("Re: UQ scope", "Please see the FA panel breakdown.");
    const b = contentSignature("Re: UQ scope", "please   see the FA panel breakdown."); // whitespace/case
    const c = contentSignature("Re: UQ scope", "Different reply entirely.");
    assert.equal(a, b); // normalized duplicate collapses
    assert.notEqual(a, c);
  });
});

describe("attribution backstop (#807)", () => {
  const projects = [
    { id: 1, name: "Shawnee Collective", normalizedName: "shawnee collective", tokens: ["shawnee", "collective"], distinctiveTokens: ["shawnee"] },
    { id: 2, name: "Westfield Collective", normalizedName: "westfield collective", tokens: ["westfield", "collective"], distinctiveTokens: ["westfield"] },
    { id: 3, name: "Vermillion Rise Warehouse", normalizedName: "vermillion rise warehouse", tokens: ["vermillion", "rise"], distinctiveTokens: ["vermillion"] },
  ];

  it("matches a title only when it contains a project's full name", () => {
    assert.equal(projectIdFromTitle("FW: Shawnee Collective Reconnect", projects), 1);
    assert.equal(projectIdFromTitle("Vermillion Rise Warehouse weekly coordination", projects), 3);
    assert.equal(projectIdFromTitle("Generic status update", projects), null);
    // Generic construction terms and partial names must NOT match — the over-correction case.
    assert.equal(projectIdFromTitle("RFQ - Sprinkler Pipe Fabrication - Pensacola FL", projects), null);
    assert.equal(projectIdFromTitle("Vermillion weekly sync", projects), null);
  });

  it("re-attributes a mislabeled source (Shawnee thread tagged Westfield)", () => {
    const sources = [
      { alias: "S1", title: "FW: Shawnee Collective Reconnect", projectId: 2, projectName: "Westfield Collective" },
    ];
    const corrections = correctAttribution(sources, projects);
    assert.equal(corrections.length, 1);
    assert.equal(sources[0].projectId, 1);
    assert.equal(sources[0].projectName, "Shawnee Collective");
    assert.equal(sources[0].attributionCorrected, true);
    assert.equal(corrections[0].from.projectName, "Westfield Collective");
    assert.equal(corrections[0].to.projectName, "Shawnee Collective");
  });

  it("de-attributes when the title names a same-category sibling that isn't a real project", () => {
    // Reality: no "Shawnee Collective" project exists; the email was mis-stamped
    // onto the real Westfield Collective. "Collective" is a category (2+ projects:
    // Westfield + Union), so the Shawnee sibling is recognized → de-attribute.
    const realProjects = [
      { id: 2, name: "Westfield Collective", normalizedName: "westfield collective" },
      { id: 4, name: "Union Collective", normalizedName: "union collective" },
      { id: 5, name: "Exol Morrisville", normalizedName: "exol morrisville" },
    ];
    const sources = [{ alias: "S1", title: "FW: Shawnee Collective Reconnect", projectId: 2, projectName: "Westfield Collective" }];
    const corrections = correctAttribution(sources, realProjects);
    assert.equal(corrections.length, 1);
    assert.equal(sources[0].projectId, null);
    assert.equal(sources[0].projectName, null);
  });

  it("does NOT de-attribute a correct source whose place-name suffix is a one-off (Exol Morrisville)", () => {
    // "morrisville" is the suffix of only one project → not a category, so a
    // code-prefixed variant in the title must not trigger de-attribution.
    const realProjects = [
      { id: 2, name: "Westfield Collective", normalizedName: "westfield collective" },
      { id: 4, name: "Union Collective", normalizedName: "union collective" },
      { id: 5, name: "Exol Morrisville", normalizedName: "exol morrisville" },
    ];
    const sources = [{ alias: "S1", title: "RE: Exol ERW01 Morrisville PA - Weekly Milestone Review", projectId: 5, projectName: "Exol Morrisville" }];
    assert.equal(correctAttribution(sources, realProjects).length, 0);
    assert.equal(sources[0].projectId, 5); // unchanged
  });

  it("leaves correct assignments alone, and won't override when title names the assigned project", () => {
    const ok = [{ alias: "S1", title: "Vermillion Rise slab pour", projectId: 3, projectName: "Vermillion Rise Warehouse" }];
    assert.equal(correctAttribution(ok, projects).length, 0);
    // Title names both the assigned and another → ambiguous, do not override.
    const ambiguous = [{ alias: "S2", title: "Westfield vs Shawnee comparison", projectId: 2, projectName: "Westfield Collective" }];
    assert.equal(correctAttribution(ambiguous, projects).length, 0);
  });
});
