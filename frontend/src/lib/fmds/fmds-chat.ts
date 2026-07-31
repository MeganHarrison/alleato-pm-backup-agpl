import { z } from "zod";

export const fmdsEvidenceSearchRequestSchema = z.object({
  query: z.string().trim().min(3).max(2000),
  matchCount: z.number().int().min(1).max(12).default(8),
});

export type FmdsEvidenceSearchRequest = z.input<
  typeof fmdsEvidenceSearchRequestSchema
>;

export type FmdsDomainRequest = {
  query: string;
  corpus: "FMDS0834";
  revisionMode: "latest_eligible";
};

export type FmdsReviewStatus = "needs_review" | "reviewed" | "rejected";

export type FmdsEvidenceChunk = {
  id: string;
  pageNumber: number;
  citationLabel: string;
  sectionPath: string | null;
  clauseReference: string | null;
  content: string;
  similarity: number;
  sourceType: "native_text" | "table" | "figure";
  sourceId: string | null;
  sourceIdentifier: string | null;
  reviewEventId: string | null;
  candidateId: string | null;
};

export type FmdsEvidenceTable = {
  id: string;
  identifier: string;
  title: string | null;
  pageStart: number;
  pageEnd: number;
  caption: string | null;
  reviewStatus: FmdsReviewStatus;
  reviewReason: string;
  matchSource: "structured_reviewed" | "page_context";
};

export type FmdsEvidenceFigure = {
  id: string;
  identifier: string;
  title: string | null;
  pageNumber: number;
  caption: string | null;
  reviewStatus: FmdsReviewStatus;
  reviewReason: string;
  matchSource: "structured_reviewed" | "page_context";
};

export type FmdsEvidenceSearchResult = {
  corpus: {
    documentCode: "FMDS0834";
    revisionId: string;
    revisionLabel: string;
    revisionStatus: "staging" | "active";
  };
  coverage: {
    matchedChunks: number;
    structuredMatches: number;
    tables: number;
    figures: number;
  };
  chunks: FmdsEvidenceChunk[];
  tables: FmdsEvidenceTable[];
  figures: FmdsEvidenceFigure[];
  answerPolicy: {
    calculationAuthority: "reviewed_evaluator_only";
    unreviewedEvidenceStatus: "pending_review";
  };
};

const CANONICAL_DOCUMENT_SIGNAL =
  /\b(?:FMDS\s*0?8[-\s]?34|FMDS0834|FM\s+Global\s+(?:Data\s+Sheet\s+)?0?8[-\s]?34)\b/i;
const ASRS_SYSTEM_SIGNAL =
  /\b(?:AS\/RS|ASRS|automated\s+(?:storage|retrieval|storage\s+and\s+retrieval)\s+system)\b/i;
const FIRE_PROTECTION_SIGNAL =
  /\b(?:sprinklers?|transverse\s+flue|longitudinal\s+flue|flue\s+spaces?|hose\s+demand|water\s+supply\s+duration|vertical\s+barriers?|in[-\s]?rack|k[-\s]?factor)\b/i;
const STORAGE_DESIGN_SIGNAL =
  /\b(?:rack\s+storage|storage\s+(?:height|arrangement|configuration)|ceiling\s+(?:height|sprinklers?)|design\s+sprinklers?|sprinkler\s+heads?|open[-\s]?top|closed[-\s]?top|top[-\s]?loading|horizontal[-\s]?loading|containers?|commodit(?:y|ies)|vertical\s+spacing|net\s+width|gross\s+width|tables?|figures?|requirements?)\b/i;
const PROJECT_STATUS_SIGNAL =
  /\b(?:project|client|meeting|email|teams|schedule|budget|status|progress|relationship)\b/i;

/**
 * Classify the FMDS engineering domain using stable document/system concepts,
 * not prompt-specific phrases. ASRS alone is intentionally insufficient so a
 * project-status request named "ASRS Estimator" stays on the project path.
 */
export function detectFmdsDomainRequest(
  message: string,
): FmdsDomainRequest | null {
  const query = message.trim();
  if (!query) return null;

  const canonicalDocument = CANONICAL_DOCUMENT_SIGNAL.test(query);
  const asrsSystem = ASRS_SYSTEM_SIGNAL.test(query);
  const fireProtection = FIRE_PROTECTION_SIGNAL.test(query);
  const storageDesign = STORAGE_DESIGN_SIGNAL.test(query);

  const isEngineeringDomain =
    canonicalDocument ||
    (asrsSystem && fireProtection) ||
    (fireProtection && storageDesign);

  if (!isEngineeringDomain) return null;
  if (
    asrsSystem &&
    !canonicalDocument &&
    !fireProtection &&
    PROJECT_STATUS_SIGNAL.test(query)
  ) {
    return null;
  }

  return {
    query,
    corpus: "FMDS0834",
    revisionMode: "latest_eligible",
  };
}
