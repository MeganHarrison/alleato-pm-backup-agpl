const nullableString = { type: ["string", "null"] };
const sourceIds = { type: "array", items: { type: "string" } };
const slug = { type: "string", pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$" };
const requiredString = { type: "string", minLength: 1 };

const claimSchema = {
  type: "object",
  properties: {
    id: slug,
    statement: requiredString,
    confidence: { type: "string", enum: ["high", "medium", "low"] },
    sourceIds,
  },
  required: ["id", "statement", "confidence", "sourceIds"],
  additionalProperties: false,
};

const recommendationSchema = {
  type: "object",
  properties: {
    id: slug,
    statement: requiredString,
    owner: requiredString,
    rationale: requiredString,
    confidence: { type: "string", enum: ["high", "medium", "low"] },
    sourceIds,
  },
  required: ["id", "statement", "owner", "rationale", "confidence", "sourceIds"],
  additionalProperties: false,
};

const actionItemSchema = {
  type: "object",
  properties: {
    ownerIsBrandon: { type: "boolean" },
    owner: nullableString,
    text: { type: "string" },
    due: nullableString,
    dueIso: nullableString,
    urgency: nullableString,
    optional: { type: "boolean" },
    sourceIds,
  },
  required: ["ownerIsBrandon", "owner", "text", "due", "dueIso", "urgency", "optional", "sourceIds"],
  additionalProperties: false,
};

export const BRIEF_V3_RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    executiveSignal: {
      type: "object",
      properties: {
        headline: { type: "string" },
        whyNow: { type: "string" },
        focus: { type: "string" },
        watchouts: { type: "array", items: { type: "string" }, maxItems: 3 },
      },
      required: ["headline", "whyNow", "focus", "watchouts"],
      additionalProperties: false,
    },
    callsToday: {
      type: "array",
      items: {
        type: "object",
        properties: {
          project: { type: "string" },
          question: { type: "string" },
          optional: { type: "boolean" },
          sourceIds,
        },
        required: ["project", "question", "optional", "sourceIds"],
        additionalProperties: false,
      },
    },
    projects: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          urgencyRank: { type: "integer" },
          hasOwnerDecision: { type: "boolean" },
          resolvedToday: { type: "boolean" },
          actionItems: { type: "array", items: actionItemSchema },
          context: { type: "string" },
        },
        required: ["name", "urgencyRank", "hasOwnerDecision", "resolvedToday", "actionItems", "context"],
        additionalProperties: false,
      },
    },
    looseEnds: {
      type: "array",
      items: {
        type: "object",
        properties: {
          text: { type: "string" },
          sourceIds,
        },
        required: ["text", "sourceIds"],
        additionalProperties: false,
      },
    },
    preventionFindings: {
      type: "array",
      items: {
        type: "object",
        properties: {
          issueKey: slug,
          title: requiredString,
          category: {
            type: "string",
            enum: ["change_management", "financial_controls", "procurement", "reporting", "accountability", "scheduling", "owner_relations", "safety", "other"],
          },
          severity: { type: "string" },
          observedCondition: { type: "string" },
          preventability: { type: "string", enum: ["preventable", "partially_preventable", "cannot_determine"] },
          preventabilityBasis: { type: "string" },
          missingControl: { type: "string" },
          recommendedSystem: { type: "string" },
          accountableRole: { type: "string" },
          leadingIndicator: { type: "string" },
          confidence: { type: "string", enum: ["high", "medium", "low"] },
          sourceIds,
        },
        required: ["issueKey", "title", "category", "severity", "observedCondition", "preventability", "preventabilityBasis", "missingControl", "recommendedSystem", "accountableRole", "leadingIndicator", "confidence", "sourceIds"],
        additionalProperties: false,
      },
    },
    executiveSynthesis: {
      type: "object",
      properties: {
        patterns: { type: "array", items: claimSchema },
        rootCauses: { type: "array", items: claimSchema },
        facts: { type: "array", items: claimSchema },
        inferences: { type: "array", items: claimSchema },
        recommendations: { type: "array", items: recommendationSchema },
        risks: { type: "array", items: claimSchema },
        opportunities: { type: "array", items: claimSchema },
        financial: { type: "array", items: claimSchema },
        schedule: { type: "array", items: claimSchema },
        decisions: { type: "array", items: claimSchema },
        evidenceCoverage: {
          type: "object",
          properties: {
            eligibleSourceCount: { type: "integer" },
            citedSourceCount: { type: "integer" },
            uncoveredSourceIds: sourceIds,
          },
          required: ["eligibleSourceCount", "citedSourceCount", "uncoveredSourceIds"],
          additionalProperties: false,
        },
      },
      required: ["patterns", "rootCauses", "facts", "inferences", "recommendations", "risks", "opportunities", "financial", "schedule", "decisions", "evidenceCoverage"],
      additionalProperties: false,
    },
    sourceCoverage: {
      type: "object",
      properties: {
        meetings: { type: "integer" },
        emails: { type: "integer" },
        teams: { type: "integer" },
        documents: { type: "integer" },
        thinLanes: { type: "array", items: { type: "string" } },
        note: nullableString,
      },
      required: ["meetings", "emails", "teams", "documents", "thinLanes", "note"],
      additionalProperties: false,
    },
  },
  required: ["executiveSignal", "callsToday", "projects", "looseEnds", "preventionFindings", "executiveSynthesis", "sourceCoverage"],
  additionalProperties: false,
};

export const BRIEF_V3_RESPONSE_FORMAT = {
  type: "json_schema",
  json_schema: {
    name: "daily_executive_brief_v3",
    description: "Source-linked executive Project Intelligence brief for one completed business day.",
    strict: true,
    schema: BRIEF_V3_RESPONSE_SCHEMA,
  },
};
