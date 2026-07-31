import test from "node:test";
import assert from "node:assert/strict";

import {
  compareCollectionAuditParity,
  evaluateCollectionAudit,
} from "../collection-audit-lib.mjs";

const requirements = {
  requireExhaustive: true,
  requireZeroFailures: true,
  minimumMatched: 1,
  requireCandidateMatchesEqualsEnumerated: true,
  requireAdjudicatedEqualsCandidates: true,
  requireRetrievedEqualsMatched: true,
  requireCanonicalSourceCountEqualsRetrieved: true,
  requireUniqueCanonicalSources: true,
  requireAllSourcesCanonical: true,
  requireEmptyFailureList: true,
  requireSuccessfulSynthesis: true,
  expectedSynthesisModel: "openai/gpt-5.4",
  expectedSynthesisMode: "non_reasoning",
  expectedSynthesisMaxOutputTokens: 4096,
  expectedSynthesisTimeoutMs: 90000,
  expectedSelectionContractVersion: "taxonomy-cohort-v5",
  expectedSelectionModel: "openai/gpt-4.1-mini",
  expectedSelectionEscalationModel: "openai/gpt-5.4-mini",
  expectedSelectionVerificationModel: "openai/gpt-5.4-mini",
  expectedSelectionVerificationMode: "individual-semantic",
  expectedSelectionBatching: "taxonomy-cohort",
  expectedCollectionRecordClass: "employee_performance_evaluation",
  expectedBoundaryContractVersion: "semantic-boundary-v3",
  expectedBoundaryModel: "openai/gpt-5.4-mini",
  expectedBoundaryMethod: "semantic-canonicalization",
  expectedAdvisorContractVersion: "executive-advisor-v12",
  expectedAdvisorJudgeModel: "openai/gpt-5.4-mini",
  requireAdvisorContractPassed: true,
  minimumAdvisorScore: 80,
  maximumAdvisorAttempts: 4,
  minimumAdvisorSemanticScore: 4,
  minimumAdvisorThesisSpecificity: 5,
  minimumAdvisorExecutiveVoice: 5,
  expectedArchitecture: "retrieval-planner-v2",
  expectedProviderPath: "semantic-collection-analysis",
};

function persistedFixture(overrides = {}) {
  return {
    id: "assistant-row-1",
    metadata: {
      architecture: "retrieval-planner-v2",
      provider_path: "semantic-collection-analysis",
      collection_coverage: {
        enumerated: 20,
        candidateMatches: 20,
        adjudicated: 20,
        matched: 2,
        retrieved: 2,
        failed: 0,
        exhaustive: true,
        transcriptCharacters: 1200,
      },
      collection_failures: [],
      collection_selection: {
        contractVersion: "taxonomy-cohort-v5",
        model: "openai/gpt-4.1-mini",
        escalationModel: "openai/gpt-5.4-mini",
        verificationModel: "openai/gpt-5.4-mini",
        verificationMode: "individual-semantic",
        batching: "taxonomy-cohort",
        recordClass: "employee_performance_evaluation",
        boundary: {
          contractVersion: "semantic-boundary-v3",
          model: "openai/gpt-5.4-mini",
          method: "semantic-canonicalization",
        },
      },
      collection_synthesis: {
        status: "complete",
        model: "openai/gpt-5.4",
        evidenceCharacters: 6400,
        extractionDurationMs: 1200,
        finalSynthesisDurationMs: 800,
        finalSynthesisMaxOutputTokens: 4096,
        finalSynthesisMode: "non_reasoning",
        finalSynthesisTimeoutMs: 90000,
        advisorContract: {
          contractVersion: "executive-advisor-v12",
          passed: true,
          score: 92,
          attempts: 1,
          judgeModel: "openai/gpt-5.4-mini",
          semanticScores: {
            thesisSpecificity: 5,
            prioritization: 4,
            businessImplications: 5,
            actionability: 4,
            executiveVoice: 5,
          },
        },
      },
    },
    sources: [
      {
        document_id: "meeting-a",
        metadata: { url: "/meetings/meeting-a" },
      },
      {
        document_id: "meeting-b",
        metadata: { url: "/meetings/meeting-b" },
      },
    ],
    ...overrides,
  };
}

test("passes complete persisted collection evidence without reading answer prose", () => {
  const result = evaluateCollectionAudit(requirements, persistedFixture());

  assert.equal(result.status, "pass");
  assert.deepEqual(result.failures, []);
  assert.equal(result.assistantRowId, "assistant-row-1");
  assert.deepEqual(result.coverage, {
    enumerated: 20,
    candidateMatches: 20,
    adjudicated: 20,
    matched: 2,
    retrieved: 2,
    failed: 0,
    exhaustive: true,
    transcriptCharacters: 1200,
  });
  assert.equal(result.sources.total, 2);
  assert.equal(result.sources.canonical, 2);
  assert.equal(result.sources.uniqueCanonical, 2);
  assert.equal(result.sources.nonCanonical, 0);
  assert.match(result.sources.fingerprint, /^[a-f0-9]{64}$/);
  assert.deepEqual(result.selection, {
    contractVersion: "taxonomy-cohort-v5",
    model: "openai/gpt-4.1-mini",
    escalationModel: "openai/gpt-5.4-mini",
    verificationModel: "openai/gpt-5.4-mini",
    verificationMode: "individual-semantic",
    batching: "taxonomy-cohort",
    recordClass: "employee_performance_evaluation",
    boundary: {
      contractVersion: "semantic-boundary-v3",
      model: "openai/gpt-5.4-mini",
      method: "semantic-canonicalization",
    },
  });
  assert.deepEqual(result.synthesis, {
    status: "complete",
    model: "openai/gpt-5.4",
    evidenceCharacters: 6400,
    extractionDurationMs: 1200,
    finalSynthesisDurationMs: 800,
    finalSynthesisMaxOutputTokens: 4096,
    finalSynthesisMode: "non_reasoning",
    finalSynthesisTimeoutMs: 90000,
    advisorContract: {
      contractVersion: "executive-advisor-v12",
      passed: true,
      score: 92,
      attempts: 1,
      judgeModel: "openai/gpt-5.4-mini",
      semanticScores: {
        thesisSpecificity: 5,
        prioritization: 4,
        businessImplications: 5,
        actionability: 4,
        executiveVoice: 5,
      },
    },
  });
});

test("fails when synthesis and advisor review collapse back to the same lightweight model", () => {
  const fixture = persistedFixture();
  fixture.metadata.collection_synthesis.model = "openai/gpt-4.1-mini";
  fixture.metadata.collection_synthesis.advisorContract.judgeModel =
    "openai/gpt-4.1-mini";

  const result = evaluateCollectionAudit(requirements, fixture);

  assert.equal(result.status, "fail");
  assert.match(
    result.failures.join("\n"),
    /collection_synthesis\.model must be openai\/gpt-5\.4/,
  );
  assert.match(
    result.failures.join("\n"),
    /advisorContract\.judgeModel must be openai\/gpt-5\.4-mini/,
  );
});

test("fails when production runs an unversioned or stale collection selector", () => {
  const missing = persistedFixture();
  delete missing.metadata.collection_selection;
  const missingResult = evaluateCollectionAudit(requirements, missing);

  assert.equal(missingResult.status, "fail");
  assert.match(
    missingResult.failures.join("\n"),
    /collection_selection\.contractVersion/,
  );
  assert.match(
    missingResult.failures.join("\n"),
    /collection_selection\.model/,
  );
  assert.match(
    missingResult.failures.join("\n"),
    /collection_selection\.batching/,
  );
  assert.match(
    missingResult.failures.join("\n"),
    /collection_selection\.boundary\.contractVersion/,
  );
  assert.match(
    missingResult.failures.join("\n"),
    /collection_selection\.boundary\.model/,
  );
  assert.match(
    missingResult.failures.join("\n"),
    /collection_selection\.boundary\.method/,
  );

  const stale = persistedFixture();
  stale.metadata.collection_selection = {
    contractVersion: "legacy-selector",
    model: "openai/gpt-5.4-mini",
    batching: "mixed-records",
    boundary: {
      contractVersion: "legacy-boundary",
      model: "openai/gpt-5.4-mini",
      method: "raw-request",
    },
  };
  const staleResult = evaluateCollectionAudit(requirements, stale);

  assert.equal(staleResult.status, "fail");
  assert.match(staleResult.failures.join("\n"), /taxonomy-cohort-v5/);
  assert.match(staleResult.failures.join("\n"), /openai\/gpt-4\.1-mini/);
  assert.match(staleResult.failures.join("\n"), /taxonomy-cohort/);
  assert.match(staleResult.failures.join("\n"), /semantic-boundary-v3/);
  assert.match(staleResult.failures.join("\n"), /semantic-canonicalization/);
});

test("fails when the persisted advisor contract is absent or semantically weak", () => {
  const missing = persistedFixture();
  delete missing.metadata.collection_synthesis.advisorContract;
  const missingResult = evaluateCollectionAudit(requirements, missing);

  assert.equal(missingResult.status, "fail");
  assert.match(
    missingResult.failures.join("\n"),
    /advisorContract\.contractVersion/,
  );
  assert.match(missingResult.failures.join("\n"), /advisorContract\.passed/);
  assert.match(missingResult.failures.join("\n"), /advisorContract\.score/);

  const weak = persistedFixture();
  weak.metadata.collection_synthesis.advisorContract = {
    ...weak.metadata.collection_synthesis.advisorContract,
    score: 76,
    attempts: 5,
    semanticScores: {
      ...weak.metadata.collection_synthesis.advisorContract.semanticScores,
      executiveVoice: 2,
    },
  };
  const weakResult = evaluateCollectionAudit(requirements, weak);

  assert.equal(weakResult.status, "fail");
  assert.match(weakResult.failures.join("\n"), /score must be >= 80/);
  assert.match(weakResult.failures.join("\n"), /attempts must be <= 4/);
  assert.match(weakResult.failures.join("\n"), /executiveVoice must be >= 4/);
});

test("fails a corporate opening that misses the strict voice threshold", () => {
  const fixture = persistedFixture();
  fixture.metadata.collection_synthesis.advisorContract.semanticScores = {
    ...fixture.metadata.collection_synthesis.advisorContract.semanticScores,
    executiveVoice: 4,
  };

  const result = evaluateCollectionAudit(requirements, fixture);

  assert.equal(result.status, "fail");
  assert.match(result.failures.join("\n"), /executiveVoice must be >= 5/);
});

test("fails when synthesis silently inherits unbounded provider defaults", () => {
  const fixture = persistedFixture();
  delete fixture.metadata.collection_synthesis.finalSynthesisMaxOutputTokens;
  delete fixture.metadata.collection_synthesis.finalSynthesisMode;
  delete fixture.metadata.collection_synthesis.finalSynthesisTimeoutMs;

  const result = evaluateCollectionAudit(requirements, fixture);

  assert.equal(result.status, "fail");
  assert.match(result.failures.join("\n"), /finalSynthesisMaxOutputTokens/);
  assert.match(result.failures.join("\n"), /finalSynthesisMode/);
  assert.match(result.failures.join("\n"), /finalSynthesisTimeoutMs/);
});

test("fails partial retrieval, duplicate evidence, and non-canonical sources loudly", () => {
  const fixture = persistedFixture();
  fixture.metadata.collection_coverage = {
    ...fixture.metadata.collection_coverage,
    matched: 3,
    adjudicated: 3,
    retrieved: 2,
    failed: 1,
    exhaustive: false,
  };
  fixture.metadata.collection_failures = [{ id: "meeting-c" }];
  fixture.sources = [
    fixture.sources[0],
    {
      document_id: "meeting-a",
      metadata: { url: "/documents/meeting-a" },
    },
  ];

  const result = evaluateCollectionAudit(requirements, fixture);

  assert.equal(result.status, "fail");
  assert.match(result.failures.join("\n"), /exhaustive must be true/);
  assert.match(
    result.failures.join("\n"),
    /adjudicated must equal candidateMatches/,
  );
  assert.match(result.failures.join("\n"), /failed must be 0/);
  assert.match(result.failures.join("\n"), /retrieved must equal matched/);
  assert.match(result.failures.join("\n"), /canonical meeting source count/);
  assert.match(result.failures.join("\n"), /non-canonical source/);
  assert.match(result.failures.join("\n"), /collection_failures/);
});

test("fails when coverage metadata is absent", () => {
  const result = evaluateCollectionAudit(requirements, {
    id: "assistant-row-2",
    metadata: {},
    sources: [],
  });

  assert.equal(result.status, "fail");
  assert.match(
    result.failures.join("\n"),
    /collection_coverage metadata is missing/,
  );
  assert.match(result.failures.join("\n"), /architecture must be/);
  assert.match(result.failures.join("\n"), /provider_path must be/);
  assert.match(result.failures.join("\n"), /collection_synthesis.status/);
});

test("fails when retrieval succeeds but final synthesis does not", () => {
  const fixture = persistedFixture();
  fixture.metadata.collection_synthesis = {
    status: "failed",
    error: "No output generated.",
  };

  const result = evaluateCollectionAudit(requirements, fixture);

  assert.equal(result.status, "fail");
  assert.match(
    result.failures.join("\n"),
    /collection_synthesis.status must be complete; received failed/,
  );
});

test("source fingerprints are order-independent and enforce semantic parity", () => {
  const baseline = evaluateCollectionAudit(requirements, persistedFixture());
  const reorderedFixture = persistedFixture({
    sources: [...persistedFixture().sources].reverse(),
  });
  const reordered = evaluateCollectionAudit(requirements, reorderedFixture);
  const changedFixture = persistedFixture();
  changedFixture.sources[1] = {
    document_id: "meeting-c",
    metadata: { url: "/meetings/meeting-c" },
  };
  const changed = evaluateCollectionAudit(requirements, changedFixture);

  assert.equal(baseline.sources.fingerprint, reordered.sources.fingerprint);
  assert.equal(
    compareCollectionAuditParity(baseline, reordered).status,
    "pass",
  );
  const mismatch = compareCollectionAuditParity(baseline, changed);
  assert.equal(mismatch.status, "fail");
  assert.match(mismatch.failures.join("\n"), /different canonical collections/);
});
