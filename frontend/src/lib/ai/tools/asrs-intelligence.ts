import { tool } from "ai";
import {
  asrsEstimatorRequestSchema,
  getAsrsEvaluationStatus,
} from "@/lib/fmds/asrs-estimator";
import { evaluateAsrsConfiguration } from "@/lib/fmds/asrs-estimator.server";
import { fmdsEvidenceSearchRequestSchema } from "@/lib/fmds/fmds-chat";
import { searchFmdsEvidence } from "@/lib/fmds/fmds-chat.server";

export type AsrsIntelligenceToolOptions = {
  onTrace?: (trace: Record<string, unknown>) => void;
  revisionId?: string;
};

export function createAsrsIntelligenceTools(
  options: AsrsIntelligenceToolOptions = {},
) {
  return {
    searchFmds2026Evidence: tool({
      description:
        "Search the dedicated revision-scoped FMDS 8-34 April 2026 corpus for ASRS sprinkler requirements, clauses, tables, and figures. Use this only for FMDS/ASRS engineering questions. The result includes corpus identity, PDF citations, and table/figure review status. Never substitute generic project RAG or legacy FM Global tables.",
      inputSchema: fmdsEvidenceSearchRequestSchema,
      execute: async (input) => {
        try {
          const result = await searchFmdsEvidence(input, {
            revisionId: options.revisionId,
          });
          if (
            options.revisionId &&
            result.corpus.revisionId !== options.revisionId
          ) {
            throw new Error(
              "FMDS evidence retrieval returned a different corpus revision than the current ASRS turn.",
            );
          }
          options.onTrace?.({
            toolName: "searchFmds2026Evidence",
            status: "success",
            revisionId: result.corpus.revisionId,
            revisionLabel: result.corpus.revisionLabel,
            revisionStatus: result.corpus.revisionStatus,
            coverage: result.coverage,
          });
          return result;
        } catch (error) {
          options.onTrace?.({
            toolName: "searchFmds2026Evidence",
            status: "error",
            error: error instanceof Error ? error.message : String(error),
          });
          throw error;
        }
      },
    }),
    evaluateFmds2026Configuration: tool({
      description:
        "Evaluate typed ASRS sprinkler inputs with the reviewed FMDS 8-34 Batch 1 deterministic rules. Use for calculations or applicability decisions after collecting the required inputs. Preserve every Pending Review result and never infer unsupported head count, complete configuration, or full compliance.",
      inputSchema: asrsEstimatorRequestSchema,
      execute: async (input) => {
        try {
          const evaluation = await evaluateAsrsConfiguration(input, {
            revisionId: options.revisionId,
          });
          if (
            options.revisionId &&
            evaluation.corpus.revisionId !== options.revisionId
          ) {
            throw new Error(
              "FMDS evaluation returned a different corpus revision than the current ASRS turn.",
            );
          }
          const evaluationStatus = getAsrsEvaluationStatus(evaluation);
          options.onTrace?.({
            toolName: "evaluateFmds2026Configuration",
            status: "success",
            revisionId: evaluation.corpus.revisionId,
            revisionLabel: evaluation.corpus.revisionLabel,
            evaluationStatus,
            requirementCount: evaluation.requirements.length,
          });
          return {
            evaluationStatus,
            evaluation,
            answerPolicy: {
              verifiedOnlyFromReviewedRules: true,
              preservePendingReview: true,
            },
          };
        } catch (error) {
          options.onTrace?.({
            toolName: "evaluateFmds2026Configuration",
            status: "error",
            error: error instanceof Error ? error.message : String(error),
          });
          throw error;
        }
      },
    }),
  };
}