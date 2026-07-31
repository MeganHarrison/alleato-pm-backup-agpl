import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  createLinearIssueForProductGap,
  deriveAuditFindings,
  mergeAuditMetadata,
  parseFindingsFile,
  renderAuditReport,
  selectAuditStatus,
  validateAuditCapture,
} from "../audit-training-doc.ts";

function makeManifest(overrides = {}) {
  return {
    id: "commitments.create-commitment",
    title: "Create a Commitment",
    module: "commitments",
    slug: "create-a-commitment",
    generatedAt: "2026-07-01T12:00:00.000Z",
    steps: [
      {
        title: "Open Commitments",
        instruction: "Open the commitments tool.",
        expected: "The page loads.",
        screenshot: "screenshots/01-open-commitments.png",
        sourceUrl: "http://localhost:3001/1034/commitments",
      },
    ],
    ...overrides,
  };
}

function createAuditFixture() {
  const dir = mkdtempSync(path.join(os.tmpdir(), "training-doc-audit-"));
  mkdirSync(path.join(dir, "screenshots"), { recursive: true });
  writeFileSync(path.join(dir, "manifest.json"), "{}");
  writeFileSync(
    path.join(dir, "screenshots", "01-open-commitments.png"),
    "png",
  );
  writeFileSync(path.join(dir, "session.webm"), "video");
  writeFileSync(path.join(dir, "documentation-draft.md"), "# Draft");
  writeFileSync(path.join(dir, "documentation-input.json"), "{}");
  writeFileSync(path.join(dir, "source-brief.md"), "# Source Brief");
  return dir;
}

test("validateAuditCapture rejects blocked auth routes", () => {
  const dir = createAuditFixture();
  const manifest = makeManifest({
    steps: [
      {
        title: "Login redirect",
        instruction: "Unexpected redirect",
        screenshot: "screenshots/01-open-commitments.png",
        sourceUrl: "http://localhost:3001/auth/login?callbackUrl=%2F1034%2Fcommitments",
      },
    ],
  });

  assert.throws(
    () => validateAuditCapture(manifest, dir),
    /captured a blocked route/i,
  );
});

test("deriveAuditFindings marks doc stale when no existing row exists", () => {
  const dir = createAuditFixture();
  const manifest = makeManifest();
  const artifacts = validateAuditCapture(manifest, dir);

  const result = deriveAuditFindings({
    manifest,
    artifacts,
    existingDoc: null,
    query: "create a commitment workflow",
    manualFindings: [],
    productGapIssueId: null,
  });

  assert.equal(result.status, "doc_stale");
  assert.match(result.findings[0].summary, /No training_docs row exists/i);
});

test("deriveAuditFindings prioritizes product gaps over stale-doc findings", () => {
  const dir = createAuditFixture();
  const manifest = makeManifest();
  const artifacts = validateAuditCapture(manifest, dir);

  const result = deriveAuditFindings({
    manifest,
    artifacts,
    existingDoc: {
      id: "doc-1",
      slug: "create-a-commitment",
      title: "Create a Commitment",
      status: "published",
      source_route: "/1034/commitments",
      published_doc_path:
        "project-management-tools/training-docs/create-a-commitment.mdx",
      last_published_at: "2026-07-01T13:00:00.000Z",
      updated_at: "2026-07-01T13:00:00.000Z",
      audit_status: "not_audited",
      qa_status: "passing",
      product_gap_issue_id: null,
      metadata: {},
    },
    query: "create a commitment workflow",
    manualFindings: [
      {
        classification: "product_gap",
        summary: "A required field from the reference flow is missing in Alleato.",
        evidence: ["missing field"],
        owner: "Engineering",
        nextAction: "Create the parity implementation issue.",
        source: "manual",
      },
    ],
    productGapIssueId: "AAI-999",
  });

  assert.equal(result.status, "product_gap");
  assert.equal(selectAuditStatus(result.findings), "product_gap");
  assert.equal(result.productGapIssueId, "AAI-999");
});

test("parseFindingsFile accepts object-wrapped findings arrays", () => {
  const findings = parseFindingsFile(
    JSON.stringify({
      findings: [
        {
          classification: "capture_blocked",
          summary: "Seed data is missing.",
          evidence: ["missing fixture"],
          owner: "QA",
          nextAction: "Seed the required record.",
        },
      ],
    }),
  );

  assert.equal(findings.length, 1);
  assert.equal(findings[0].classification, "capture_blocked");
});

test("renderAuditReport includes status and findings", () => {
  const dir = createAuditFixture();
  const manifest = makeManifest();
  const artifacts = validateAuditCapture(manifest, dir);
  const result = deriveAuditFindings({
    manifest,
    artifacts,
    existingDoc: null,
    query: "create a commitment workflow",
    manualFindings: [],
    productGapIssueId: null,
  });

  const report = renderAuditReport(result);
  assert.match(report, /# Audit Report/);
  assert.match(report, /Status: doc_stale/);
  assert.match(report, /No training_docs row exists/);
});

test("mergeAuditMetadata writes normalized audit control-plane fields", () => {
  const dir = createAuditFixture();
  const manifest = makeManifest();
  const artifacts = validateAuditCapture(manifest, dir);
  const result = deriveAuditFindings({
    manifest,
    artifacts,
    existingDoc: null,
    query: "create a commitment workflow",
    manualFindings: [
      {
        classification: "product_gap",
        summary: "Missing approval field",
        evidence: ["approval field absent"],
        owner: "Engineering",
        nextAction: "Create the parity issue.",
      },
    ],
    productGapIssueId: "AAI-1000",
  });

  const metadata = mergeAuditMetadata({ existing: true }, result);
  assert.equal(metadata.lastParityStatus, "product_gap");
  assert.equal(metadata.productGapIssueId, "AAI-1000");
  assert.equal(metadata.blockerType, "product_gap");
  assert.equal(metadata.blockerOwner, "Engineering");
  assert.match(String(metadata.auditNotes), /Missing approval field/);
});

test("createLinearIssueForProductGap fails loudly without configured auth", async () => {
  const previous = process.env.LINEAR_API_KEY;
  delete process.env.LINEAR_API_KEY;

  await assert.rejects(
    () =>
      createLinearIssueForProductGap({
        manifest: {
          id: "workflow.id",
          slug: "workflow-slug",
          title: "Workflow",
          module: "commitments",
          generatedAt: "2026-07-01T12:00:00.000Z",
          stepCount: 1,
          sourceRoutes: ["/1034/commitments"],
        },
        findings: [
          {
            classification: "product_gap",
            summary: "Field missing",
            evidence: ["field missing"],
            owner: "Engineering",
            nextAction: "Create issue",
          },
        ],
        linearTeamId: "team-id",
      }),
    /(LINEAR_API_KEY is not configured|HTTP 401|Linear issue creation failed)/i,
  );

  if (previous) {
    process.env.LINEAR_API_KEY = previous;
  }
});
