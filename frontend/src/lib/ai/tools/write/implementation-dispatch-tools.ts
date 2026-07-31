import { tool } from "ai";
import { z } from "zod";
import { createRepoIssueWithLabels } from "@/lib/admin-feedback/github";
import { type ActionToolInternals, withWriteTrace } from "./action-tool-internals";
import {
  DEFAULT_ALLOWED_EDIT_PATHS,
  IMPLEMENTATION_GUARDRAIL_OPTIONS,
  autofixIssueTitle,
  autofixTriggerLabel,
  buildAutofixIssueBody,
  invalidAllowedEditPaths,
} from "./implementation-dispatch-issue";

export function createImplementationDispatchTools(internals: ActionToolInternals) {
  const {
    options,
    resolveIdempotencyKey,
    getReplayResponse,
    recordWriteAudit,
  } = internals;

  return {
    dispatchImplementationRequest: tool({
      description:
        "Hand an approved solution to the automated implementation pipeline: files a " +
        "fully-specified GitHub issue that a coding agent (Claude Code or Codex) picks up, " +
        "implements on an isolated branch, and delivers as a pull request with automated " +
        "review — auto-merged when low-risk, human-reviewed otherwise. Use AFTER you have " +
        "presented a concrete recommendation (a missing control, guardrail, or fix this " +
        "platform should implement) and the user wants it built — e.g. 'build it', 'implement " +
        "that', 'make it happen', 'yes, set that up'. Frontend-only scope (frontend/src, " +
        "frontend/tests); backend, schema, or migration work cannot be dispatched. " +
        "Always show the preview and get explicit confirmation before dispatching.",
      inputSchema: z.object({
        title: z
          .string()
          .describe("Short imperative title for the change, e.g. 'Add overdue-submittal escalation banner to project dashboard'"),
        problemStatement: z
          .string()
          .describe("The observed problem or risk this change addresses, with concrete context (project, surface, behavior)"),
        expectedBehavior: z
          .string()
          .describe("What the app should do after the change ships"),
        reproduction: z
          .string()
          .describe("Exact steps or route to observe the current gap, e.g. '1. Open /876/submittals 2. Note overdue items show no escalation'"),
        acceptanceCriteria: z
          .array(z.string())
          .min(1)
          .describe("Observable pass conditions the implementation must meet, one per entry"),
        guardrail: z
          .enum(IMPLEMENTATION_GUARDRAIL_OPTIONS)
          .default("Test coverage")
          .describe("The recurrence guardrail the agent must add with the fix"),
        allowedEditPaths: z
          .array(z.string())
          .optional()
          .describe("Narrow path prefixes the agent may edit; must stay under frontend/src/ or frontend/tests/. Defaults to both."),
        engine: z
          .enum(["default", "claude", "codex"])
          .default("default")
          .describe("Which coding agent runs the implementation; 'default' uses the repo's configured engine"),
        sourceContext: z
          .string()
          .optional()
          .describe("Optional provenance: the meeting, brief finding, or conversation that motivated this change"),
        confirmed: z.boolean().default(false),
        idempotencyKey: z.string().optional(),
      }),
      execute: withWriteTrace("dispatchImplementationRequest", options, async (input) => {
        const {
          title,
          problemStatement,
          expectedBehavior,
          reproduction,
          acceptanceCriteria,
          guardrail,
          engine,
          sourceContext,
          confirmed,
        } = input;

        const allowedEditPaths =
          input.allowedEditPaths && input.allowedEditPaths.length > 0
            ? input.allowedEditPaths
            : DEFAULT_ALLOWED_EDIT_PATHS;

        const invalidPaths = invalidAllowedEditPaths(allowedEditPaths);
        if (invalidPaths.length > 0) {
          return {
            success: false,
            error:
              `These edit paths are outside the automatable scope (frontend/src/, frontend/tests/): ${invalidPaths.join(", ")}. ` +
              "Backend, schema, or migration work cannot be dispatched — file it as a tracked issue for a human instead.",
          };
        }

        const issueTitle = autofixIssueTitle(title);
        const issueBody = buildAutofixIssueBody({
          title,
          problemStatement,
          expectedBehavior,
          reproduction,
          acceptanceCriteria,
          allowedEditPaths,
          guardrail,
          sourceContext: sourceContext ?? null,
        });
        const triggerLabel = autofixTriggerLabel(engine);

        if (!confirmed) {
          return {
            action: "preview",
            message:
              "Here's the implementation request I'll dispatch to the automated build pipeline. " +
              "A coding agent will implement it on an isolated branch and open a pull request " +
              "(auto-merged only if the change stays small and low-risk; otherwise it waits for review). " +
              "Reply **confirm** to dispatch.",
            preview: {
              issueTitle,
              triggerLabel,
              engine,
              issueBody,
            },
          };
        }

        const idempotencyKey = resolveIdempotencyKey("dispatchImplementationRequest", input);
        const replay = await getReplayResponse("dispatchImplementationRequest", idempotencyKey);
        if (replay) return replay;

        let dispatched: Awaited<ReturnType<typeof createRepoIssueWithLabels>>;
        try {
          dispatched = await createRepoIssueWithLabels({
            title: issueTitle,
            body: issueBody,
            labels: [triggerLabel],
          });
        } catch (error) {
          const failure = {
            success: false,
            error: `GitHub issue creation failed: ${error instanceof Error ? error.message : String(error)}`,
          };
          await recordWriteAudit({
            toolName: "dispatchImplementationRequest",
            idempotencyKey,
            projectId: null,
            input,
            status: "error",
            response: failure,
          });
          return failure;
        }

        if (!dispatched) {
          const failure = {
            success: false,
            error:
              "GitHub dispatch is not configured (GITHUB_FEEDBACK_REPO_OWNER/NAME/TOKEN missing). " +
              "The implementation request was NOT filed.",
          };
          await recordWriteAudit({
            toolName: "dispatchImplementationRequest",
            idempotencyKey,
            projectId: null,
            input,
            status: "error",
            response: failure,
          });
          return failure;
        }

        const response = {
          success: true,
          message: dispatched.labelsApplied
            ? `Implementation request dispatched: GitHub issue [#${dispatched.issue.number}](${dispatched.issue.url}) filed with the \`${triggerLabel}\` label. ` +
              "A coding agent will implement it on an isolated branch and open a pull request; " +
              "low-risk changes auto-merge once checks pass, riskier ones wait for review. " +
              "If the request isn't safely automatable, the agent comments on the issue with the blocker instead."
            : `GitHub issue [#${dispatched.issue.number}](${dispatched.issue.url}) was created, but applying the \`${triggerLabel}\` label failed ` +
              `(${dispatched.labelError}). The pipeline will NOT start until that label is added to the issue.`,
          issueNumber: dispatched.issue.number,
          issueUrl: dispatched.issue.url,
          triggerLabel,
          pipelineStarted: dispatched.labelsApplied,
        };

        await recordWriteAudit({
          toolName: "dispatchImplementationRequest",
          idempotencyKey,
          projectId: null,
          input,
          status: dispatched.labelsApplied ? "success" : "error",
          response,
        });

        return response;
      }),
    }),
  };
}
