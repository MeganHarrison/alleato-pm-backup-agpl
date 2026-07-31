import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  assertDetailedExecutiveReport,
  assertDetailedReportProjectAttribution,
  assertStructuredProjectAttribution,
  annotateSourceProjectMentions,
  buildSourceProjectIndex,
  buildSourcesMap,
  collectCitedAliases,
  groupSourcesByLane,
  modelRepairTurn,
  parseModelJson,
} from "../executive-synthesis.mjs";

describe("Project Intelligence executive synthesis boundary", () => {
  it("parses fenced JSON and rejects malformed output", () => {
    assert.deepEqual(parseModelJson('```json\n{"ok":true}\n```'), { ok: true });
    assert.equal(parseModelJson("not-json"), null);
  });

  it("gives a failed draft back to the model before the repair instruction", () => {
    assert.deepEqual(modelRepairTurn("previous draft", "repair S149"), [
      { role: "assistant", content: "previous draft" },
      { role: "system", content: "repair S149" },
    ]);
  });

  it("keeps only cited sources in the public source map", () => {
    const cited = collectCitedAliases({ projects: [{ context: "Evidence [S1]", actionItems: [{ sourceIds: ["S2"] }] }] });
    const mapped = buildSourcesMap([
      { id: "a", alias: "S1", title: "Meeting", lane: "meetings", canonicalSourceUrl: "https://source/1" },
      { id: "b", alias: "S2", title: "Email", lane: "emails", url: "https://source/2" },
      { id: "c", alias: "S3", title: "Uncited", lane: "documents" },
    ], cited);
    assert.deepEqual(Object.keys(mapped), ["S1", "S2"]);
    assert.equal(mapped.S1.type, "meeting");
  });

  it("keeps all four source lanes explicit, including valid empty lanes", () => {
    assert.deepEqual(groupSourcesByLane([{ lane: "emails", id: 1 }]), {
      meetings: [], emails: [{ lane: "emails", id: 1 }], teams: [], documents: [],
    });
  });

  it("fails a superficially complete report without the required depth and citations", () => {
    assert.throws(() => assertDetailedExecutiveReport("## Executive assessment\nShort.", [{ alias: "S1" }]), /quality gate failed/);
  });

  it("exposes the evidence-resolved source project contract to synthesis", () => {
    assert.deepEqual(buildSourceProjectIndex([{
      alias: "S12",
      title: "Space Coast OTP Review",
      projectName: "Space Coast Town Center",
      attributionStatus: "unregistered_entity",
    }]), {
      S12: {
        project: "Space Coast Town Center",
        mentionedProjects: [],
        attributionStatus: "unregistered_entity",
        title: "Space Coast OTP Review",
      },
    });
  });

  it("rejects a structured Port claim backed by a Space Coast source", () => {
    const sources = [{ alias: "S12", projectName: "Space Coast Town Center" }];
    assert.throws(
      () => assertStructuredProjectAttribution({
        projects: [{ name: "Port Collective", context: "Space Coast terms [S12]", actionItems: [] }],
        callsToday: [{ project: "Port Collective", sourceIds: ["S12"] }],
      }, sources),
      /Project attribution synthesis gate failed.*Port Collective.*S12.*Space Coast Town Center/,
    );
  });

  it("rejects merged report headings and accepts one-project source alignment", () => {
    const sources = [
      { alias: "S12", projectName: "Space Coast Town Center" },
      { alias: "S20", projectName: "Port Collective" },
    ];
    assert.throws(
      () => assertDetailedReportProjectAttribution(
        "## Project-by-project analysis\n### Space Coast Town Center / Port Collective\nContract issue [S12]\n## Decisions and commitments",
        sources,
      ),
      /resolves to 0 project labels/,
    );
    assert.throws(
      () => assertDetailedReportProjectAttribution(
        "## Project-by-project analysis\n### Port Collective \/ Space Coast\nProposal issue [S20]\n### Space Coast Town Center\nContract issue [S12]\n## Decisions and commitments",
        sources,
      ),
      /heading 'Port Collective \/ Space Coast' resolves to 0 project labels and contains a merge separator/,
    );
    assert.doesNotThrow(() => assertDetailedReportProjectAttribution(
      "## Project-by-project analysis\n### Space Coast Town Center\nContract issue [S12]\n### Port Collective\nProposal issue [S20]\n## Decisions and commitments",
      sources,
    ));
  });

  it("allows an unassigned source only for a project it explicitly names", () => {
    const sources = annotateSourceProjectMentions([
      { alias: "S137", title: "Playmakers preconstruction", text: "", projectName: "Playmakers" },
      { alias: "S188", title: "Email: Play Makers", text: "Proposal attached.", projectName: null },
      { alias: "S28", title: "Union Collective permit review", text: "", projectName: "Union Collective" },
      { alias: "S57", title: "Weekly OPS (Estimators)", text: "Union Collective permit pricing remains open.", projectName: null },
    ]);
    assert.deepEqual(sources.find((source) => source.alias === "S188").mentionedProjectLabels, ["Playmakers"]);
    assert.deepEqual(sources.find((source) => source.alias === "S57").mentionedProjectLabels, ["Union Collective"]);
    assert.doesNotThrow(() => assertStructuredProjectAttribution({
      projects: [
        { name: "Playmakers", context: "Proposal [S188]", actionItems: [] },
        { name: "Union Collective", context: "Estimate [S57]", actionItems: [] },
      ],
    }, sources));
  });

  it("never lets a source labeled to another project cross over merely because it mentions the asserted project", () => {
    const sources = annotateSourceProjectMentions([
      {
        alias: "S12",
        title: "Space Coast Town Center review",
        text: "This is not Port Collective.",
        projectName: "Space Coast Town Center",
      },
      { alias: "S20", title: "Port Collective proposal", text: "", projectName: "Port Collective" },
    ]);
    assert.throws(() => assertStructuredProjectAttribution({
      projects: [{ name: "Port Collective", context: "Incorrect crossover [S12]", actionItems: [] }],
    }, sources), /Project attribution synthesis gate failed/);
  });

  it("does not treat a longer unrelated compact title token as a project mention", () => {
    const sources = annotateSourceProjectMentions([
      { alias: "S6", title: "Display Play Makership update", text: "No project mention.", projectName: null },
      { alias: "S7", title: "Playmakers preconstruction", text: "", projectName: "Playmakers" },
    ]);
    assert.deepEqual(sources[0].mentionedProjectLabels, []);
    assert.throws(() => assertStructuredProjectAttribution({
      projects: [{ name: "Playmakers", context: "False positive [S6]", actionItems: [] }],
    }, sources), /Project attribution synthesis gate failed/);
  });

  it("does not infer project identity from related-looking email threads", () => {
    const sources = annotateSourceProjectMentions([
      {
        alias: "S108",
        title: "Ulta Dallas warranty",
        text: "Subject: Ulta Dallas warranty\n\nEarlier message\nSubject: Dallas Fire Alarm System\nDetails.",
        projectName: "Ulta Dallas",
      },
      {
        alias: "S149",
        title: "Email: Re: Dallas Fire Alarm System",
        text: "Subject: Dallas Fire Alarm System\nFrom: coordinator@example.com\nTo: facilities@example.com\n\nThe site test is scheduled.",
        projectName: null,
      },
    ]);
    assert.deepEqual(sources[1].mentionedProjectLabels, []);
    assert.throws(() => assertStructuredProjectAttribution({
      projects: [{ name: "Ulta Dallas", context: "Alarm issue [S149]", actionItems: [] }],
    }, sources), /Project attribution synthesis gate failed/);
  });

  it("rejects loose project-token co-occurrence in unrelated source prose", () => {
    const sources = annotateSourceProjectMentions([
      { alias: "S108", title: "Ulta Dallas warranty", text: "", projectName: "Ulta Dallas" },
      { alias: "S200", title: "North Dallas kickoff", text: "Ulta standards were reviewed.", projectName: null },
      {
        alias: "S201",
        title: "Space Coast Town Center review",
        text: "The business development strategy was discussed.",
        projectName: "Space Coast Town Center",
      },
      { alias: "S202", title: "Business Development", text: "", projectName: "Business Development" },
    ]);
    assert.deepEqual(sources.find((source) => source.alias === "S200").mentionedProjectLabels, []);
    assert.deepEqual(sources.find((source) => source.alias === "S201").mentionedProjectLabels, ["Space Coast Town Center"]);
    assert.throws(() => assertStructuredProjectAttribution({
      projects: [{ name: "Ulta Dallas", context: "False positive [S200]", actionItems: [] }],
    }, sources), /Project attribution synthesis gate failed/);
  });

  it("does not infer a project by splitting its tokens across a title and email address", () => {
    const sources = annotateSourceProjectMentions([
      { alias: "S108", title: "Ulta Dallas warranty", text: "", projectName: "Ulta Dallas" },
      {
        alias: "S300",
        title: "North Dallas kickoff",
        text: "Subject: kickoff\nFrom: ulta-team@example.com\nTo: ops@example.com\n\nStatus update.",
        projectName: null,
      },
    ]);
    assert.deepEqual(sources[1].mentionedProjectLabels, []);
    assert.throws(() => assertStructuredProjectAttribution({
      projects: [{ name: "Ulta Dallas", context: "False metadata match [S300]", actionItems: [] }],
    }, sources), /Project attribution synthesis gate failed/);
  });

  it("allows a single unregistered report heading only when every cited unassigned source names it", () => {
    const sources = [{
      alias: "S122",
      title: "Superior Beverage permit update",
      text: "Superior Beverage remains pending.",
      projectName: null,
      mentionedProjectLabels: [],
    }];
    assert.doesNotThrow(() => assertDetailedReportProjectAttribution(
      "## Project-by-project analysis\n### Superior Beverage\nPermit issue [S122]\n## Decisions and commitments",
      sources,
    ));
    assert.deepEqual(sources[0].mentionedProjectLabels, ["Superior Beverage"]);
  });
});
