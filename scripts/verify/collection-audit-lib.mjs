import { createHash } from "node:crypto";

function isRecord(value) {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function numericField(record, key, failures) {
  const value = record?.[key];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    failures.push(`collection_coverage.${key} must be a finite number`);
    return null;
  }
  return value;
}

function sourceAudit(source) {
  const record = isRecord(source) ? source : {};
  const metadata = isRecord(record.metadata) ? record.metadata : {};
  const url =
    typeof metadata.url === "string"
      ? metadata.url
      : typeof record.url === "string"
        ? record.url
        : null;
  const documentId =
    typeof record.document_id === "string"
      ? record.document_id
      : typeof metadata.meeting_id === "string"
        ? metadata.meeting_id
        : null;

  return {
    canonical:
      typeof url === "string" && /^\/meetings\/[A-Za-z0-9-]+$/.test(url),
    documentId,
  };
}

export function evaluateCollectionAudit(requirements, persisted) {
  if (!isRecord(requirements)) return null;

  const failures = [];
  const observations = [];
  const metadata = isRecord(persisted?.metadata) ? persisted.metadata : {};
  const synthesis = isRecord(metadata.collection_synthesis)
    ? metadata.collection_synthesis
    : null;
  const advisorContract = isRecord(synthesis?.advisorContract)
    ? synthesis.advisorContract
    : null;
  const advisorSemanticScores = isRecord(advisorContract?.semanticScores)
    ? advisorContract.semanticScores
    : null;
  const coverage = isRecord(metadata.collection_coverage)
    ? metadata.collection_coverage
    : null;
  const selection = isRecord(metadata.collection_selection)
    ? metadata.collection_selection
    : null;
  const selectionBoundary = isRecord(selection?.boundary)
    ? selection.boundary
    : null;
  const sources = Array.isArray(persisted?.sources) ? persisted.sources : [];
  const sourceAudits = sources.map(sourceAudit);
  const canonicalSourceCount = sourceAudits.filter(
    (source) => source.canonical,
  ).length;
  const uniqueCanonicalSourceCount = new Set(
    sourceAudits
      .filter((source) => source.canonical && source.documentId)
      .map((source) => source.documentId),
  ).size;
  const canonicalSourceIds = [
    ...new Set(
      sourceAudits
        .filter((source) => source.canonical && source.documentId)
        .map((source) => source.documentId),
    ),
  ].sort();
  const sourceFingerprint =
    canonicalSourceIds.length > 0
      ? createHash("sha256").update(canonicalSourceIds.join("\n")).digest("hex")
      : null;
  const nonCanonicalSourceCount = sources.length - canonicalSourceCount;

  if (!coverage) {
    failures.push("collection_coverage metadata is missing");
  }
  if (
    typeof requirements.expectedSelectionContractVersion === "string" &&
    selection?.contractVersion !== requirements.expectedSelectionContractVersion
  ) {
    failures.push(
      `collection_selection.contractVersion must be ${requirements.expectedSelectionContractVersion}; received ${selection?.contractVersion ?? "missing"}`,
    );
  }
  if (
    typeof requirements.expectedSelectionModel === "string" &&
    selection?.model !== requirements.expectedSelectionModel
  ) {
    failures.push(
      `collection_selection.model must be ${requirements.expectedSelectionModel}; received ${selection?.model ?? "missing"}`,
    );
  }
  if (
    typeof requirements.expectedSelectionEscalationModel === "string" &&
    selection?.escalationModel !==
      requirements.expectedSelectionEscalationModel
  ) {
    failures.push(
      `collection_selection.escalationModel must be ${requirements.expectedSelectionEscalationModel}; received ${selection?.escalationModel ?? "missing"}`,
    );
  }
  if (
    typeof requirements.expectedSelectionVerificationModel === "string" &&
    selection?.verificationModel !==
      requirements.expectedSelectionVerificationModel
  ) {
    failures.push(
      `collection_selection.verificationModel must be ${requirements.expectedSelectionVerificationModel}; received ${selection?.verificationModel ?? "missing"}`,
    );
  }
  if (
    typeof requirements.expectedSelectionVerificationMode === "string" &&
    selection?.verificationMode !== requirements.expectedSelectionVerificationMode
  ) {
    failures.push(
      `collection_selection.verificationMode must be ${requirements.expectedSelectionVerificationMode}; received ${selection?.verificationMode ?? "missing"}`,
    );
  }
  if (
    typeof requirements.expectedSelectionBatching === "string" &&
    selection?.batching !== requirements.expectedSelectionBatching
  ) {
    failures.push(
      `collection_selection.batching must be ${requirements.expectedSelectionBatching}; received ${selection?.batching ?? "missing"}`,
    );
  }
  if (
    typeof requirements.expectedCollectionRecordClass === "string" &&
    selection?.recordClass !== requirements.expectedCollectionRecordClass
  ) {
    failures.push(
      `collection_selection.recordClass must be ${requirements.expectedCollectionRecordClass}; received ${selection?.recordClass ?? "missing"}`,
    );
  }
  if (
    typeof requirements.expectedBoundaryContractVersion === "string" &&
    selectionBoundary?.contractVersion !==
      requirements.expectedBoundaryContractVersion
  ) {
    failures.push(
      `collection_selection.boundary.contractVersion must be ${requirements.expectedBoundaryContractVersion}; received ${selectionBoundary?.contractVersion ?? "missing"}`,
    );
  }
  if (
    typeof requirements.expectedBoundaryModel === "string" &&
    selectionBoundary?.model !== requirements.expectedBoundaryModel
  ) {
    failures.push(
      `collection_selection.boundary.model must be ${requirements.expectedBoundaryModel}; received ${selectionBoundary?.model ?? "missing"}`,
    );
  }
  if (
    typeof requirements.expectedBoundaryMethod === "string" &&
    selectionBoundary?.method !== requirements.expectedBoundaryMethod
  ) {
    failures.push(
      `collection_selection.boundary.method must be ${requirements.expectedBoundaryMethod}; received ${selectionBoundary?.method ?? "missing"}`,
    );
  }

  const matched = coverage ? numericField(coverage, "matched", failures) : null;
  const candidateMatches = coverage
    ? numericField(coverage, "candidateMatches", failures)
    : null;
  const adjudicated = coverage
    ? numericField(coverage, "adjudicated", failures)
    : null;
  const retrieved = coverage
    ? numericField(coverage, "retrieved", failures)
    : null;
  const failed = coverage ? numericField(coverage, "failed", failures) : null;
  const enumerated = coverage
    ? numericField(coverage, "enumerated", failures)
    : null;

  if (
    requirements.requireExhaustive === true &&
    coverage?.exhaustive !== true
  ) {
    failures.push("collection_coverage.exhaustive must be true");
  }
  if (requirements.requireZeroFailures === true && failed !== 0) {
    failures.push(
      `collection_coverage.failed must be 0; received ${failed ?? "missing"}`,
    );
  }
  if (
    typeof requirements.minimumMatched === "number" &&
    (matched == null || matched < requirements.minimumMatched)
  ) {
    failures.push(
      `collection_coverage.matched must be >= ${requirements.minimumMatched}; received ${matched ?? "missing"}`,
    );
  }
  if (
    requirements.requireCandidateMatchesEqualsEnumerated === true &&
    (enumerated == null ||
      candidateMatches == null ||
      candidateMatches !== enumerated)
  ) {
    failures.push(
      `collection_coverage.candidateMatches must equal enumerated; received ${candidateMatches ?? "missing"}/${enumerated ?? "missing"}`,
    );
  }
  if (
    requirements.requireAdjudicatedEqualsCandidates === true &&
    (candidateMatches == null ||
      adjudicated == null ||
      adjudicated !== candidateMatches)
  ) {
    failures.push(
      `collection_coverage.adjudicated must equal candidateMatches; received ${adjudicated ?? "missing"}/${candidateMatches ?? "missing"}`,
    );
  }
  if (
    requirements.requireRetrievedEqualsMatched === true &&
    (retrieved == null || matched == null || retrieved !== matched)
  ) {
    failures.push(
      `collection_coverage.retrieved must equal matched; received ${retrieved ?? "missing"}/${matched ?? "missing"}`,
    );
  }
  if (
    requirements.requireCanonicalSourceCountEqualsRetrieved === true &&
    (retrieved == null || canonicalSourceCount !== retrieved)
  ) {
    failures.push(
      `canonical meeting source count must equal retrieved; received ${canonicalSourceCount}/${retrieved ?? "missing"}`,
    );
  }
  if (
    requirements.requireUniqueCanonicalSources === true &&
    (retrieved == null || uniqueCanonicalSourceCount !== retrieved)
  ) {
    failures.push(
      `unique canonical meeting source count must equal retrieved; received ${uniqueCanonicalSourceCount}/${retrieved ?? "missing"}`,
    );
  }
  if (
    requirements.requireAllSourcesCanonical === true &&
    nonCanonicalSourceCount !== 0
  ) {
    failures.push(
      `all persisted sources must use canonical /meetings/<meetingId> URLs; found ${nonCanonicalSourceCount} non-canonical source(s)`,
    );
  }
  if (
    requirements.requireEmptyFailureList === true &&
    (!Array.isArray(metadata.collection_failures) ||
      metadata.collection_failures.length !== 0)
  ) {
    failures.push("collection_failures must be a persisted empty array");
  }
  if (
    requirements.requireSuccessfulSynthesis === true &&
    synthesis?.status !== "complete"
  ) {
    failures.push(
      `collection_synthesis.status must be complete; received ${synthesis?.status ?? "missing"}`,
    );
  }
  if (
    typeof requirements.expectedSynthesisModel === "string" &&
    synthesis?.model !== requirements.expectedSynthesisModel
  ) {
    failures.push(
      `collection_synthesis.model must be ${requirements.expectedSynthesisModel}; received ${synthesis?.model ?? "missing"}`,
    );
  }
  if (
    typeof requirements.expectedSynthesisMode === "string" &&
    synthesis?.finalSynthesisMode !== requirements.expectedSynthesisMode
  ) {
    failures.push(
      `collection_synthesis.finalSynthesisMode must be ${requirements.expectedSynthesisMode}; received ${synthesis?.finalSynthesisMode ?? "missing"}`,
    );
  }
  if (
    typeof requirements.expectedSynthesisMaxOutputTokens === "number" &&
    synthesis?.finalSynthesisMaxOutputTokens !==
      requirements.expectedSynthesisMaxOutputTokens
  ) {
    failures.push(
      `collection_synthesis.finalSynthesisMaxOutputTokens must be ${requirements.expectedSynthesisMaxOutputTokens}; received ${synthesis?.finalSynthesisMaxOutputTokens ?? "missing"}`,
    );
  }
  if (
    typeof requirements.expectedSynthesisTimeoutMs === "number" &&
    synthesis?.finalSynthesisTimeoutMs !==
      requirements.expectedSynthesisTimeoutMs
  ) {
    failures.push(
      `collection_synthesis.finalSynthesisTimeoutMs must be ${requirements.expectedSynthesisTimeoutMs}; received ${synthesis?.finalSynthesisTimeoutMs ?? "missing"}`,
    );
  }
  if (
    typeof requirements.expectedAdvisorContractVersion === "string" &&
    advisorContract?.contractVersion !==
      requirements.expectedAdvisorContractVersion
  ) {
    failures.push(
      `collection_synthesis.advisorContract.contractVersion must be ${requirements.expectedAdvisorContractVersion}; received ${advisorContract?.contractVersion ?? "missing"}`,
    );
  }
  if (
    typeof requirements.expectedAdvisorJudgeModel === "string" &&
    advisorContract?.judgeModel !== requirements.expectedAdvisorJudgeModel
  ) {
    failures.push(
      `collection_synthesis.advisorContract.judgeModel must be ${requirements.expectedAdvisorJudgeModel}; received ${advisorContract?.judgeModel ?? "missing"}`,
    );
  }
  if (
    requirements.requireAdvisorContractPassed === true &&
    advisorContract?.passed !== true
  ) {
    failures.push(
      `collection_synthesis.advisorContract.passed must be true; received ${advisorContract?.passed ?? "missing"}`,
    );
  }
  if (
    typeof requirements.minimumAdvisorScore === "number" &&
    (typeof advisorContract?.score !== "number" ||
      advisorContract.score < requirements.minimumAdvisorScore)
  ) {
    failures.push(
      `collection_synthesis.advisorContract.score must be >= ${requirements.minimumAdvisorScore}; received ${advisorContract?.score ?? "missing"}`,
    );
  }
  if (
    typeof requirements.maximumAdvisorAttempts === "number" &&
    (typeof advisorContract?.attempts !== "number" ||
      advisorContract.attempts > requirements.maximumAdvisorAttempts)
  ) {
    failures.push(
      `collection_synthesis.advisorContract.attempts must be <= ${requirements.maximumAdvisorAttempts}; received ${advisorContract?.attempts ?? "missing"}`,
    );
  }
  if (typeof requirements.minimumAdvisorSemanticScore === "number") {
    for (const dimension of [
      "thesisSpecificity",
      "prioritization",
      "businessImplications",
      "actionability",
      "executiveVoice",
    ]) {
      const score = advisorSemanticScores?.[dimension];
      if (
        typeof score !== "number" ||
        score < requirements.minimumAdvisorSemanticScore
      ) {
        failures.push(
          `collection_synthesis.advisorContract.semanticScores.${dimension} must be >= ${requirements.minimumAdvisorSemanticScore}; received ${score ?? "missing"}`,
        );
      }
    }
  }
  if (
    typeof requirements.minimumAdvisorThesisSpecificity === "number" &&
    (typeof advisorSemanticScores?.thesisSpecificity !== "number" ||
      advisorSemanticScores.thesisSpecificity <
        requirements.minimumAdvisorThesisSpecificity)
  ) {
    failures.push(
      `collection_synthesis.advisorContract.semanticScores.thesisSpecificity must be >= ${requirements.minimumAdvisorThesisSpecificity}; received ${advisorSemanticScores?.thesisSpecificity ?? "missing"}`,
    );
  }
  if (
    typeof requirements.minimumAdvisorExecutiveVoice === "number" &&
    (typeof advisorSemanticScores?.executiveVoice !== "number" ||
      advisorSemanticScores.executiveVoice <
        requirements.minimumAdvisorExecutiveVoice)
  ) {
    failures.push(
      `collection_synthesis.advisorContract.semanticScores.executiveVoice must be >= ${requirements.minimumAdvisorExecutiveVoice}; received ${advisorSemanticScores?.executiveVoice ?? "missing"}`,
    );
  }
  if (
    typeof requirements.expectedArchitecture === "string" &&
    metadata.architecture !== requirements.expectedArchitecture
  ) {
    failures.push(
      `architecture must be ${requirements.expectedArchitecture}; received ${metadata.architecture ?? "missing"}`,
    );
  }
  if (
    typeof requirements.expectedProviderPath === "string" &&
    metadata.provider_path !== requirements.expectedProviderPath
  ) {
    failures.push(
      `provider_path must be ${requirements.expectedProviderPath}; received ${metadata.provider_path ?? "missing"}`,
    );
  }

  observations.push(
    `collection coverage enumerated=${enumerated ?? "missing"} candidates=${candidateMatches ?? "missing"} adjudicated=${adjudicated ?? "missing"} matched=${matched ?? "missing"} retrieved=${retrieved ?? "missing"} failed=${failed ?? "missing"} exhaustive=${coverage?.exhaustive === true}`,
  );
  observations.push(
    `collection sources total=${sources.length} canonical=${canonicalSourceCount} uniqueCanonical=${uniqueCanonicalSourceCount}`,
  );
  observations.push(
    `advisor contract version=${advisorContract?.contractVersion ?? "missing"} passed=${advisorContract?.passed === true} score=${advisorContract?.score ?? "missing"} attempts=${advisorContract?.attempts ?? "missing"}`,
  );
  observations.push(
    `collection selection contract=${selection?.contractVersion ?? "missing"} model=${selection?.model ?? "missing"} escalationModel=${selection?.escalationModel ?? "missing"} verificationModel=${selection?.verificationModel ?? "missing"} verificationMode=${selection?.verificationMode ?? "missing"} batching=${selection?.batching ?? "missing"} recordClass=${selection?.recordClass ?? "missing"}`,
  );
  observations.push(
    `collection boundary contract=${selectionBoundary?.contractVersion ?? "missing"} model=${selectionBoundary?.model ?? "missing"} method=${selectionBoundary?.method ?? "missing"}`,
  );

  return {
    status: failures.length === 0 ? "pass" : "fail",
    failures,
    observations,
    assistantRowId: typeof persisted?.id === "string" ? persisted.id : null,
    architecture:
      typeof metadata.architecture === "string" ? metadata.architecture : null,
    providerPath:
      typeof metadata.provider_path === "string"
        ? metadata.provider_path
        : null,
    selection: {
      contractVersion:
        typeof selection?.contractVersion === "string"
          ? selection.contractVersion
          : null,
      model: typeof selection?.model === "string" ? selection.model : null,
      escalationModel:
        typeof selection?.escalationModel === "string"
          ? selection.escalationModel
          : null,
      verificationModel:
        typeof selection?.verificationModel === "string"
          ? selection.verificationModel
          : null,
      verificationMode:
        typeof selection?.verificationMode === "string"
          ? selection.verificationMode
          : null,
      batching:
        typeof selection?.batching === "string" ? selection.batching : null,
      recordClass:
        typeof selection?.recordClass === "string"
          ? selection.recordClass
          : null,
      boundary: {
        contractVersion:
          typeof selectionBoundary?.contractVersion === "string"
            ? selectionBoundary.contractVersion
            : null,
        model:
          typeof selectionBoundary?.model === "string"
            ? selectionBoundary.model
            : null,
        method:
          typeof selectionBoundary?.method === "string"
            ? selectionBoundary.method
            : null,
      },
    },
    synthesis: {
      status: typeof synthesis?.status === "string" ? synthesis.status : null,
      model: typeof synthesis?.model === "string" ? synthesis.model : null,
      evidenceCharacters:
        typeof synthesis?.evidenceCharacters === "number"
          ? synthesis.evidenceCharacters
          : null,
      extractionDurationMs:
        typeof synthesis?.extractionDurationMs === "number"
          ? synthesis.extractionDurationMs
          : null,
      finalSynthesisDurationMs:
        typeof synthesis?.finalSynthesisDurationMs === "number"
          ? synthesis.finalSynthesisDurationMs
          : null,
      finalSynthesisMaxOutputTokens:
        typeof synthesis?.finalSynthesisMaxOutputTokens === "number"
          ? synthesis.finalSynthesisMaxOutputTokens
          : null,
      finalSynthesisMode:
        typeof synthesis?.finalSynthesisMode === "string"
          ? synthesis.finalSynthesisMode
          : null,
      finalSynthesisTimeoutMs:
        typeof synthesis?.finalSynthesisTimeoutMs === "number"
          ? synthesis.finalSynthesisTimeoutMs
          : null,
      advisorContract: {
        contractVersion:
          typeof advisorContract?.contractVersion === "string"
            ? advisorContract.contractVersion
            : null,
        passed: advisorContract?.passed === true,
        score:
          typeof advisorContract?.score === "number"
            ? advisorContract.score
            : null,
        attempts:
          typeof advisorContract?.attempts === "number"
            ? advisorContract.attempts
            : null,
        judgeModel:
          typeof advisorContract?.judgeModel === "string"
            ? advisorContract.judgeModel
            : null,
        semanticScores: advisorSemanticScores,
      },
    },
    coverage: {
      enumerated,
      candidateMatches,
      adjudicated,
      matched,
      retrieved,
      failed,
      exhaustive: coverage?.exhaustive === true,
      transcriptCharacters:
        typeof coverage?.transcriptCharacters === "number"
          ? coverage.transcriptCharacters
          : null,
    },
    sources: {
      total: sources.length,
      canonical: canonicalSourceCount,
      uniqueCanonical: uniqueCanonicalSourceCount,
      nonCanonical: nonCanonicalSourceCount,
      fingerprint: sourceFingerprint,
    },
  };
}

export function compareCollectionAuditParity(baseline, candidate) {
  const baselineFingerprint = baseline?.sources?.fingerprint;
  const candidateFingerprint = candidate?.sources?.fingerprint;
  const failures = [];
  const observations = [];

  if (typeof baselineFingerprint !== "string") {
    failures.push("baseline canonical source fingerprint is missing");
  }
  if (typeof candidateFingerprint !== "string") {
    failures.push("candidate canonical source fingerprint is missing");
  }
  if (
    typeof baselineFingerprint === "string" &&
    typeof candidateFingerprint === "string" &&
    baselineFingerprint !== candidateFingerprint
  ) {
    failures.push(
      `semantic variants resolved different canonical collections; baseline=${baseline?.sources?.uniqueCanonical ?? "missing"} candidate=${candidate?.sources?.uniqueCanonical ?? "missing"}`,
    );
  }
  if (failures.length === 0) {
    observations.push(
      "semantic variant canonical source fingerprint matched baseline",
    );
  }

  return {
    status: failures.length === 0 ? "pass" : "fail",
    failures,
    observations,
  };
}
