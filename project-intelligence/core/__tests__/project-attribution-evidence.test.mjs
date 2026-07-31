import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  applySharePointAttributionEvidence,
  buildSharePointAttributionIndex,
  extractProjectEntities,
  parseSharePointJobPath,
} from "../project-attribution-evidence.mjs";
import { chunkSourcesForModel } from "../../ingestion/daily-source-corpus.mjs";

const projects = [
  { id: 34, name: "Port Collective", projectNumber: "25-107" },
  { id: 1009, name: "Union Collective", projectNumber: "26-119" },
];

const rows = [
  {
    id: "port-proposal",
    project_id: 34,
    project: "Port Collective",
    title: "2025.07.22 Precon & Design Estimate Port Collective R2.pdf",
    source_path: "/2025 Jobs/25- 107 Port Collective (Savannah, GA)/05 - Proposal/2025.07.22 Precon & Design Estimate Port Collective R2.pdf",
    source_web_url: "https://alleato.sharepoint.com/port-proposal",
  },
  {
    id: "union-proposal",
    project_id: 1009,
    project: "Union Collective",
    title: "Union Collective Proposal.pdf",
    source_path: "/2026 Jobs/26-119 - Union Collective (Union, KY)/05 - Proposal/Union Collective Proposal/Union Collective Proposal.pdf",
    source_web_url: "https://alleato.sharepoint.com/union-proposal",
  },
  {
    id: "union-estimate",
    project_id: 1009,
    project: "Union Collective",
    title: "Estimate Union Collective (Design).pdf",
    source_path: "/2026 Jobs/26-119 - Union Collective (Union, KY)/04 - Estimate/Estimate Union Collective (Design).pdf",
    source_web_url: "https://alleato.sharepoint.com/union-estimate",
  },
];

describe("SharePoint job-folder evidence", () => {
  it("parses proposal and estimate job identity despite real folder-spacing variants", () => {
    assert.deepEqual(
      parseSharePointJobPath(rows[0].source_path),
      {
        sourcePath: rows[0].source_path,
        evidenceKind: "proposal",
        jobNumber: "25-107",
        projectName: "Port Collective",
        city: "Savannah",
        state: "GA",
      },
    );
    assert.equal(parseSharePointJobPath(rows[2].source_path).evidenceKind, "estimate");
    assert.equal(parseSharePointJobPath("/2026 Jobs/26-119 - Union Collective (Union, KY)/03 - Documents/a.pdf"), null);
  });

  it("builds canonical Port and Union profiles with source links", () => {
    const index = buildSharePointAttributionIndex(rows, projects);
    assert.equal(index.receipt.status, "complete");
    assert.equal(index.receipt.acceptedRows, 3);
    assert.equal(index.receipt.projectProfiles, 2);
    assert.equal(index.byProjectId.get(34).projectNumber, "25-107");
    assert.deepEqual(index.byProjectId.get(34).locations[0], { city: "Savannah", state: "GA", stateName: "georgia" });
    assert.equal(index.byProjectId.get(1009).documents.length, 2);
  });

  it("does not let a poisoned project_id attach an unrelated SharePoint folder to Port", () => {
    const poisoned = {
      id: "space-coast-poisoned",
      project_id: 34,
      project: "Port Collective",
      title: "Space Coast Proposal.pdf",
      source_path: "/2026 Jobs/26-999 - Space Coast Town Center (West Melbourne, FL)/05 - Proposal/Space Coast Proposal.pdf",
      source_web_url: "https://alleato.sharepoint.com/space-coast-proposal",
    };
    const index = buildSharePointAttributionIndex([...rows.filter((row) => row.project_id === 1009), poisoned], projects);
    assert.equal(index.byProjectId.has(34), false);
    assert.equal(index.receipt.rejectedRows, 1);
    assert.match(index.receipt.rejected[0].reason, /does not match one registered project/);
  });

  it("fails loudly when proposal/estimate metadata cannot produce any project identity", () => {
    assert.throws(
      () => buildSharePointAttributionIndex([{
        id: "orphan",
        source_path: "/2026 Jobs/26-999 - Unknown Opportunity (Nowhere, ZZ)/05 - Proposal/Proposal.pdf",
        project_id: null,
      }], projects),
      /SharePoint attribution evidence unavailable/,
    );
  });
});

describe("pre-synthesis attribution gate", () => {
  it("detects Space Coast Town Center as the source entity", () => {
    const entities = extractProjectEntities({
      title: "FW: Space Coast OTP Review",
      text: "The Space Coast Town Center opportunity is in the City of West Melbourne, Florida. The LOI and PSA remain under review.",
    });
    assert.equal(entities[0].label, "Space Coast Town Center");
  });

  it("de-attributes Space Coast from Port and preserves the correct unresolved label", () => {
    const index = buildSharePointAttributionIndex(rows, projects);
    const sources = [{
      alias: "S12",
      title: "FW: Space Coast OTP Review",
      text: "The Space Coast Town Center opportunity is in the City of West Melbourne, Florida. Discuss the hotel, food hall, LOI, and PSA.",
      projectId: 34,
      projectName: "Port Collective",
    }];
    const result = applySharePointAttributionEvidence(sources, index);
    assert.equal(sources[0].projectId, null);
    assert.equal(sources[0].projectName, "Space Coast Town Center");
    assert.equal(sources[0].attributionLabel, "Space Coast Town Center");
    assert.equal(sources[0].attributionStatus, "unresolved_conflict");
    assert.equal(result.unresolvedConflicts.length, 1);
    assert.equal(result.unresolvedConflicts[0].evidence[0].sourceUrl, "https://alleato.sharepoint.com/port-proposal");
    assert.equal(chunkSourcesForModel(sources).chunks[0].project, "Space Coast Town Center");
  });

  it("still blocks the wrong assignment when the assigned project has not been indexed from SharePoint yet", () => {
    const index = buildSharePointAttributionIndex(rows.filter((row) => row.project_id === 1009), projects);
    const sources = [{
      alias: "S12",
      title: "FW: Space Coast OTP Review",
      text: "The Space Coast Town Center opportunity is in West Melbourne, Florida.",
      projectId: 34,
      projectName: "Port Collective",
    }];
    const result = applySharePointAttributionEvidence(sources, index);
    assert.equal(sources[0].projectId, null);
    assert.equal(sources[0].attributionLabel, "Space Coast Town Center");
    assert.equal(result.unresolvedConflicts[0].evidence.length, 0);
    assert.match(result.unresolvedConflicts[0].reason, /no SharePoint proposal\/estimate profile supports/);
  });

  it("fails closed when an assigned project has no SharePoint profile and the source contains no confirming identity", () => {
    const index = buildSharePointAttributionIndex(rows.filter((row) => row.project_id === 1009), projects);
    const sources = [{
      alias: "S13",
      title: "Weekly commercial review",
      text: "Reviewed current pricing and next steps.",
      projectId: 34,
      projectName: "Port Collective",
    }];
    const result = applySharePointAttributionEvidence(sources, index);
    assert.equal(sources[0].projectId, null);
    assert.equal(sources[0].projectName, null);
    assert.equal(sources[0].attributionStatus, "unverified_no_sharepoint_profile");
    assert.equal(result.unverifiedSources.length, 1);
    assert.equal(chunkSourcesForModel(sources).chunks[0].project, "Unassigned");
  });

  it("keeps an assignment without a SharePoint profile only when the source title names it exactly", () => {
    const index = buildSharePointAttributionIndex(rows.filter((row) => row.project_id === 1009), projects);
    const sources = [{
      alias: "S14",
      title: "Port Collective weekly review",
      text: "Reviewed current pricing and next steps.",
      projectId: 34,
      projectName: "Port Collective",
    }];
    applySharePointAttributionEvidence(sources, index);
    assert.equal(sources[0].projectId, 34);
    assert.equal(sources[0].attributionStatus, "source_title_confirmed_no_sharepoint_profile");
  });

  it("detects a body-only named-development conflict", () => {
    const index = buildSharePointAttributionIndex(rows, projects);
    const sources = [{
      alias: "S15",
      title: "OTP Review",
      text: "The Space Coast Town Center opportunity is in West Melbourne, Florida.",
      projectId: 34,
      projectName: "Port Collective",
    }];
    applySharePointAttributionEvidence(sources, index);
    assert.equal(sources[0].projectId, null);
    assert.equal(sources[0].attributionLabel, "Space Coast Town Center");
    assert.equal(sources[0].attributionStatus, "unresolved_conflict");
  });

  it("preserves the sole named development label on an already-unassigned source", () => {
    const index = buildSharePointAttributionIndex(rows, projects);
    const sources = [{
      alias: "S16",
      title: "OTP Review",
      text: "The Space Coast Town Center opportunity is in West Melbourne, Florida.",
      projectId: null,
      projectName: null,
    }];
    applySharePointAttributionEvidence(sources, index);
    assert.equal(sources[0].projectId, null);
    assert.equal(sources[0].projectName, "Space Coast Town Center");
    assert.equal(sources[0].attributionStatus, "unregistered_entity");
    assert.equal(chunkSourcesForModel(sources).chunks[0].project, "Space Coast Town Center");
  });

  it("keeps correct Port and Union sources assigned", () => {
    const index = buildSharePointAttributionIndex(rows, projects);
    const sources = [
      { alias: "S1", title: "Port Collective preconstruction review", text: "Savannah, Georgia", projectId: 34, projectName: "Port Collective" },
      { alias: "S2", title: "Union Collective estimate review", text: "Old Union Road, Union, Kentucky", projectId: 1009, projectName: "Union Collective" },
    ];
    const result = applySharePointAttributionEvidence(sources, index);
    assert.equal(result.corrections.length, 0);
    assert.deepEqual(sources.map((source) => source.projectId), [34, 1009]);
    assert.ok(sources.every((source) => source.attributionStatus === "confirmed_by_sharepoint"));
  });

  it("does not keep a SharePoint-backed assignment when the source never names that identity", () => {
    const index = buildSharePointAttributionIndex(rows, projects);
    const sources = [{
      alias: "S103",
      title: "Email: SPTC LOI Redlines",
      text: "Please review competitive use exclusivity and the no-shop language.",
      projectId: 34,
      projectName: "Port Collective",
    }];
    const result = applySharePointAttributionEvidence(sources, index);
    assert.equal(sources[0].projectId, null);
    assert.equal(sources[0].projectName, null);
    assert.equal(sources[0].attributionStatus, "unverified_against_sharepoint_profile");
    assert.equal(result.unverifiedSources.length, 1);
  });

  it("reassigns a source when its title names exactly one SharePoint-backed project", () => {
    const index = buildSharePointAttributionIndex(rows, projects);
    const sources = [{ alias: "S4", title: "Union Collective proposal update", text: "Proposal review", projectId: 34, projectName: "Port Collective" }];
    const result = applySharePointAttributionEvidence(sources, index);
    assert.equal(sources[0].projectId, 1009);
    assert.equal(sources[0].projectName, "Union Collective");
    assert.equal(result.corrections[0].reason, "SharePoint proposal/estimate identity matches the source title");
  });
});
