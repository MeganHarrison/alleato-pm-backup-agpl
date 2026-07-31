import { tool } from "ai";
import { z } from "zod";
import type { Json } from "@/types/database.types";
import {
  updateProjectStatusDescription,
  updateProjectStatusInputSchema,
  flagProjectRiskDescription,
  flagProjectRiskInputSchema,
  createMeetingNoteDescription,
  createMeetingNoteInputSchema,
  logDailyReportDescription,
  logDailyReportInputSchema,
  generateProjectSummaryDescription,
  generateProjectSummaryInputSchema,
} from "@/lib/ai/tool-descriptors";
import {
  RISK_CARD_TYPES,
  deriveSeverity,
  mapLegacyInsightTypeToCardType,
  severityToConfidence,
  resolveTargetIdsForProjects,
  insightCardBaseQuery,
} from "@/lib/ai/insight-cards";
import { buildAdminFeedbackTitle } from "@/lib/admin-feedback/title";
import { createGitHubIssue } from "@/lib/admin-feedback/github";
import { matchFeedbackToTool } from "@/lib/admin-feedback/tool-matcher";
import { resolveToolContext, contextToAgentPayload } from "@/lib/admin-feedback/context-resolver";
import { ingestAdminFeedbackLearning } from "@/lib/ai/services/agent-learning-service";
import { type ActionToolInternals, withWriteTrace } from "./action-tool-internals";

export function createMiscWriteTools(internals: ActionToolInternals) {
  const {
    userId,
    options,
    ctx,
    supabase,
    resolveIdempotencyKey,
    getReplayResponse,
    recordWriteAudit,
    enforceProjectWriteAccess,
  } = internals;

  return {
    updateProjectStatus: tool({
      description: updateProjectStatusDescription,
      inputSchema: updateProjectStatusInputSchema,
      execute: withWriteTrace("updateProjectStatus", options, async (input) => {
        const { projectId, healthStatus, phase, reason, confirmed } = input;
        const access = await enforceProjectWriteAccess(projectId);
        if (!access.ok) return { success: false, error: access.error };

        if (!healthStatus && !phase) {
          return { error: "Provide at least one of healthStatus or phase to update." };
        }

        // The tool's enum (on_track/at_risk/...) must be mapped to the values
        // projects.health_status actually allows (projects_health_status_check:
        // Healthy | At Risk | Needs Attention | Critical). Writing the raw enum
        // silently fails the check constraint on every call. Guarded by the AI
        // tool contract harness (write-tools.contract.test.ts).
        const HEALTH_STATUS_DB_VALUE: Record<string, string> = {
          on_track: "Healthy",
          at_risk: "At Risk",
          critical: "Critical",
          on_hold: "Needs Attention",
          complete: "Healthy",
        };

        const updates: Record<string, string> = {};
        if (healthStatus) {
          updates.health_status =
            HEALTH_STATUS_DB_VALUE[healthStatus] ?? healthStatus;
        }
        if (phase) updates.phase = phase;

        if (!confirmed) {
          return {
            action: "preview",
            message: `I'll update project ${projectId} with these changes. Reply **confirm** to proceed.`,
            preview: { table: "projects", id: projectId, updates, reason },
          };
        }

        const idempotencyKey = resolveIdempotencyKey("updateProjectStatus", input);
        const replay = await getReplayResponse("updateProjectStatus", idempotencyKey);
        if (replay) return replay;

        const { data, error } = await supabase
          .from("projects")
          .update(updates as never)
          .eq("id", projectId)
          .select("id, name, health_status, phase")
          .single();

        if (error) {
          const failure = { success: false, error: error.message };
          await recordWriteAudit({
            toolName: "updateProjectStatus",
            idempotencyKey,
            projectId: access.projectId,
            input,
            status: "error",
            response: failure,
          });
          return failure;
        }

        const response = {
          success: true,
          message: `Project **${data.name}** updated.`,
          changes: updates,
          reason: reason ?? null,
        };
        await recordWriteAudit({
          toolName: "updateProjectStatus",
          idempotencyKey,
          projectId: access.projectId,
          input,
          status: "success",
          response,
        });
        return response;
      }),
    }),

    flagProjectRisk: tool({
      description: flagProjectRiskDescription,
      inputSchema: flagProjectRiskInputSchema,
      execute: withWriteTrace("flagProjectRisk", options, async (input) => {
        const { projectId, title, description, severity, insightType, financialImpact, timelineImpactDays, confirmed } = input;
        const access = await enforceProjectWriteAccess(projectId);
        if (!access.ok) return { success: false, error: access.error };

        const cardType = mapLegacyInsightTypeToCardType(insightType);
        const confidence = severityToConfidence(severity);
        const nowIso = new Date().toISOString();
        const cardMetadata = {
          severity_input: severity,
          insight_type_input: insightType,
          financial_impact: financialImpact ?? null,
          timeline_impact_days: timelineImpactDays ?? null,
          flagged_by: "ai_assistant",
        };

        if (!confirmed) {
          return {
            action: "preview",
            message: "I'll log this risk. Reply **confirm** to proceed.",
            preview: {
              table: "insight_cards",
              fields: {
                project_id: projectId,
                title,
                summary: description,
                card_type: cardType,
                confidence,
                current_status: "open",
                attribution_status: "auto_assigned",
                metadata: cardMetadata,
              },
            },
          };
        }

        const idempotencyKey = resolveIdempotencyKey("flagProjectRisk", input);
        const replay = await getReplayResponse("flagProjectRisk", idempotencyKey);
        if (replay) return replay;

        // Resolve project_id → intelligence_targets.id (Pipeline B keys cards by target UUID).
        const targetMap = await resolveTargetIdsForProjects(supabase, [projectId]);
        const targetId = targetMap.get(projectId);
        if (!targetId) {
          const failure = {
            success: false,
            error: `No active intelligence target exists for project ${projectId}. Ask an admin to bootstrap the project's intelligence target before flagging risks.`,
          };
          await recordWriteAudit({
            toolName: "flagProjectRisk",
            idempotencyKey,
            projectId: access.projectId,
            input,
            status: "error",
            response: failure,
          });
          return failure;
        }

        const { data, error } = await supabase
          .from("insight_cards")
          .insert({
            primary_target_id: targetId,
            card_type: cardType,
            title,
            summary: description,
            why_it_matters: null,
            current_status: "open",
            confidence,
            attribution_status: "auto_assigned",
            next_action: null,
            suggested_owner_label: null,
            first_seen_at: nowIso,
            last_seen_at: nowIso,
            source_count: 1,
            compiler_version: "manual_user_flag_v1",
            metadata: cardMetadata as unknown as Json,
          })
          .select("id, title, card_type")
          .single();

        if (error) {
          const failure = { success: false, error: error.message };
          await recordWriteAudit({
            toolName: "flagProjectRisk",
            idempotencyKey,
            projectId: access.projectId,
            input,
            status: "error",
            response: failure,
          });
          return failure;
        }

        const response = {
          success: true,
          message: `Risk **"${title}"** flagged as ${severity}.`,
          record: { id: data.id, title: data.title, card_type: data.card_type, severity },
        };
        await recordWriteAudit({
          toolName: "flagProjectRisk",
          idempotencyKey,
          projectId: access.projectId,
          input,
          status: "success",
          response,
        });
        return response;
      }),
    }),

    createMeetingNote: tool({
      description: createMeetingNoteDescription,
      inputSchema: createMeetingNoteInputSchema,
      execute: withWriteTrace("createMeetingNote", options, async (input) => {
        const { projectId, title, date, summary, actionItems, participants, durationMinutes, confirmed } = input;
        const access = await enforceProjectWriteAccess(projectId);
        if (!access.ok) return { success: false, error: access.error };

        if (!confirmed) {
          return {
            action: "preview",
            message: "Here's the meeting note I'll create. Reply **confirm** to proceed.",
            preview: {
              table: "document_metadata",
              fields: { project_id: projectId, title, date, summary, action_items: actionItems ?? null },
            },
          };
        }

        const idempotencyKey = resolveIdempotencyKey("createMeetingNote", input);
        const replay = await getReplayResponse("createMeetingNote", idempotencyKey);
        if (replay) return replay;

        const { data, error } = await supabase
          .from("document_metadata")
          .insert({
            id: crypto.randomUUID(),
            project_id: projectId,
            title,
            date,
            summary,
            action_items: actionItems ?? null,
            participants: participants ?? null,
            duration_minutes: durationMinutes ?? null,
            type: "meeting",
            category: "meeting",
            source: "manual",
          })
          .select("id, title, date")
          .single();

        if (error) {
          const failure = { success: false, error: error.message };
          await recordWriteAudit({
            toolName: "createMeetingNote",
            idempotencyKey,
            projectId: access.projectId,
            input,
            status: "error",
            response: failure,
          });
          return failure;
        }

        const responseOut = {
          success: true,
          message: `Meeting notes for **"${title}"** saved.`,
          record: data,
          tip: "These notes are now searchable via the AI and will appear in project meeting history.",
        };
        await recordWriteAudit({
          toolName: "createMeetingNote",
          idempotencyKey,
          projectId: access.projectId,
          input,
          status: "success",
          response: responseOut,
        });
        return responseOut;
      }),
    }),

    logDailyReport: tool({
      description: logDailyReportDescription,
      inputSchema: logDailyReportInputSchema,
      execute: withWriteTrace("logDailyReport", options, async (input) => {
        const { projectId, logDate, weather, crewCount, workPerformed, notes, confirmed } = input;
        const access = await enforceProjectWriteAccess(projectId);
        if (!access.ok) return { success: false, error: access.error };

        if (!confirmed) {
          return {
            action: "preview",
            message: "Here's the daily log I'll create. Reply **confirm** to proceed.",
            preview: {
              table: "daily_logs",
              fields: { project_id: projectId, log_date: logDate, weather, crew_count: crewCount ?? null, work_performed: workPerformed ?? null },
            },
          };
        }

        const idempotencyKey = resolveIdempotencyKey("logDailyReport", input);
        const replay = await getReplayResponse("logDailyReport", idempotencyKey);
        if (replay) return replay;

        const weatherConditions = (weather || crewCount || workPerformed || notes)
          ? { weather, crew_count: crewCount ?? null, work_performed: workPerformed ?? null, notes: notes ?? null }
          : null;

        const { data, error } = await supabase
          .from("daily_logs")
          .insert({
            project_id: projectId,
            log_date: logDate,
            weather_conditions: weatherConditions,
            updated_at: new Date().toISOString(),
          })
          .select("id, log_date")
          .single();

        if (error) {
          const failure = { success: false, error: error.message };
          await recordWriteAudit({
            toolName: "logDailyReport",
            idempotencyKey,
            projectId: access.projectId,
            input,
            status: "error",
            response: failure,
          });
          return failure;
        }

        const responseOut = {
          success: true,
          message: `Daily log for **${logDate}** created.`,
          record: data,
          note: "Crew counts and equipment can be added via the Daily Log page in Alleato.",
        };
        await recordWriteAudit({
          toolName: "logDailyReport",
          idempotencyKey,
          projectId: access.projectId,
          input,
          status: "success",
          response: responseOut,
        });
        return responseOut;
      }),
    }),

    generateProjectSummary: tool({
      description: generateProjectSummaryDescription,
      inputSchema: generateProjectSummaryInputSchema,
      execute: withWriteTrace("generateProjectSummary", options, async (input) => {
        const { projectId, projectName, confirmed } = input;

        if (!confirmed) {
          return {
            action: "preview",
            message: "I'll generate and save this project summary. Reply **confirm** to proceed.",
            preview: {
              target: "document_metadata",
              fields: {
                project_id: projectId ?? null,
                project_name: projectName ?? null,
                type: "project_summary",
              },
            },
          };
        }

        // Resolve project
        let project: { id: number; name: string };
        if (projectId) {
          const { data, error } = await supabase
            .from("projects")
            .select("id, name, phase, health_status, health_score, completion_percentage")
            .eq("id", projectId)
            .single();
          if (error || !data) return { success: false, error: `Project ${projectId} not found` };
          project = { id: data.id, name: data.name ?? "" };
        } else if (projectName) {
          const { data, error } = await supabase
            .from("projects")
            .select("id, name, phase, health_status, health_score, completion_percentage")
            .ilike("name", `%${projectName}%`)
            .limit(1)
            .single();
          if (error || !data) return { success: false, error: `No project matching "${projectName}"` };
          project = { id: data.id, name: data.name ?? "" };
        } else {
          return { success: false, error: "Provide either projectId or projectName" };
        }

        const access = await enforceProjectWriteAccess(project.id);
        if (!access.ok) return { success: false, error: access.error };
        const idempotencyKey = resolveIdempotencyKey("generateProjectSummary", input);
        const replay = await getReplayResponse("generateProjectSummary", idempotencyKey);
        if (replay) return replay;

        // Pull data in separate awaits to avoid TS2589 (excessive type depth from large Promise.all)
        const now = new Date();

        const projectDetails = await supabase
          .from("projects")
          .select("id, name, phase, health_status, health_score, completion_percentage, budget, budget_used, summary")
          .eq("id", project.id)
          .single();

        const budgetData = await supabase
          .from("budget_lines")
          .select("id, description, original_amount, cost_code_id, cost_type_id")
          .eq("project_id", project.id)
          .limit(50);

        const financialData = await supabase
          .from("prime_contract_financial_summary")
          .select("original_contract_amount, revised_contract_amount, approved_change_orders, pending_change_orders, invoiced_amount, payments_received")
          .eq("project_id", project.id);

        const scheduleData = await supabase
          .from("schedule_tasks")
          .select("id, name, status, start_date, finish_date, percent_complete, is_milestone")
          .eq("project_id", project.id)
          .order("finish_date", { ascending: true, nullsFirst: false })
          .limit(100);

        const rfiData = await supabase
          .from("rfis")
          .select("id, number, subject, status, due_date, ball_in_court, cost_impact, schedule_impact")
          .eq("project_id", project.id)
          .order("number", { ascending: false })
          .limit(30);

        const changeOrderData = await supabase
          .from("prime_contract_change_orders")
          .select("id, title, status, total_amount, created_at")
          .eq("project_id", project.id)
          .order("created_at", { ascending: false })
          .limit(20);

        const changeEventData = await supabase
          .from("change_events")
          .select("id, number, title, status, type, scope, created_at")
          .eq("project_id", project.id)
          .is("deleted_at", null)
          .order("created_at", { ascending: false })
          .limit(20);

        const meetingData = await supabase
          .from("document_metadata")
          .select("id, title, date, summary, action_items, participants")
          .eq("project_id", project.id)
          .or("type.eq.meeting,category.eq.meeting")
          .order("date", { ascending: false })
          .limit(5);

        // Pipeline B: resolve project → target, then pull recent risk-bucket
        // insight cards for the LLM synthesis prompt.
        const summaryTargetMap = await resolveTargetIdsForProjects(supabase, [project.id]);
        const summaryTargetId = summaryTargetMap.get(project.id);
        const insightData = summaryTargetId
          ? await insightCardBaseQuery(supabase)
              .eq("primary_target_id", summaryTargetId)
              .in("card_type", [...RISK_CARD_TYPES, "change_management", "process_issue"])
              .order("created_at", { ascending: false })
              .limit(10)
          : { data: [], error: null };

        // Compute summary stats
        const tasks = scheduleData.data ?? [];
        const rfis = rfiData.data ?? [];
        const cos = changeOrderData.data ?? [];
        const ces = changeEventData.data ?? [];
        const meetings = meetingData.data ?? [];
        const insights = insightData.data ?? [];
        const budget = budgetData.data ?? [];
        const financial = financialData.data ?? [];
        const proj = projectDetails.data;

        const totalTasks = tasks.length;
        const completedTasks = tasks.filter(t => t.percent_complete === 100 || t.status === "Complete").length;
        const overdueTasks = tasks.filter(t => t.finish_date && new Date(t.finish_date) < now && (t.percent_complete ?? 0) < 100).length;
        const openRfis = rfis.filter(r => r.status !== "Closed" && r.status !== "Answered").length;
        const overdueRfis = rfis.filter(r => r.due_date && new Date(r.due_date) < now && r.status !== "Closed" && r.status !== "Answered").length;

        const totalOriginalBudget = budget.reduce((sum, b) => sum + (Number(b.original_amount) || 0), 0);
        const totalRevisedBudget = totalOriginalBudget; // revised = original + approved mods (simplified)

        const approvedCOs = cos.filter(c => c.status === "Approved" || c.status === "approved");
        const pendingCOs = cos.filter(c => c.status === "Draft" || c.status === "draft" || c.status === "Pending" || c.status === "pending");
        const totalApprovedCOAmount = approvedCOs.reduce((sum, c) => sum + (Number(c.total_amount) || 0), 0);
        const totalPendingCOAmount = pendingCOs.reduce((sum, c) => sum + (Number(c.total_amount) || 0), 0);

        const openChangeEvents = ces.filter(c => c.status !== "Approved" && c.status !== "Rejected" && c.status !== "Void" && c.status !== "Closed").length;

        const contractValue = financial.length > 0 ? Number(financial[0].original_contract_amount) || 0 : 0;
        const revisedContractValue = financial.length > 0 ? Number(financial[0].revised_contract_amount) || 0 : 0;
        const invoicedAmount = financial.length > 0 ? Number(financial[0].invoiced_amount) || 0 : 0;

        // Build structured data for LLM synthesis
        const summaryData = {
          project: {
            name: proj?.name,
            phase: proj?.phase,
            healthStatus: proj?.health_status,
            healthScore: proj?.health_score,
            completionPct: proj?.completion_percentage,
          },
          financial: {
            originalBudget: totalOriginalBudget,
            revisedBudget: totalRevisedBudget,
            contractValue,
            revisedContractValue,
            invoicedAmount,
            approvedCOCount: approvedCOs.length,
            approvedCOAmount: totalApprovedCOAmount,
            pendingCOCount: pendingCOs.length,
            pendingCOAmount: totalPendingCOAmount,
            openChangeEvents,
          },
          schedule: {
            totalTasks,
            completedTasks,
            overdueTasks,
            completionPct: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
            upcomingMilestones: tasks
              .filter(t => t.is_milestone && t.finish_date && new Date(t.finish_date) >= now && (t.percent_complete ?? 0) < 100)
              .slice(0, 5)
              .map(t => ({ name: t.name, date: t.finish_date, percentComplete: t.percent_complete })),
          },
          rfis: {
            total: rfis.length,
            open: openRfis,
            overdue: overdueRfis,
            recentOpen: rfis
              .filter(r => r.status !== "Closed" && r.status !== "Answered")
              .slice(0, 5)
              .map(r => ({ number: r.number, subject: r.subject, dueDate: r.due_date, ballInCourt: r.ball_in_court })),
          },
          recentMeetings: meetings.slice(0, 3).map(m => ({
            title: m.title,
            date: m.date,
            summary: m.summary?.substring(0, 200),
          })),
          activeRisks: insights.map((card) => ({
            title: card.title,
            severity: deriveSeverity({ card_type: card.card_type, confidence: card.confidence }),
            type: card.card_type,
          })),
        };

        // Synthesize with LLM
        const openai = ctx.openai;
        const completion = await openai.chat.completions.create({
          model: "gpt-5.4-mini",
          temperature: 0.3,
          max_tokens: 1500,
          messages: [
            {
              role: "system",
              content: `You are a construction project manager writing a concise executive status summary.
Write in professional, direct language. Use bullet points for lists. Include specific numbers.
Structure: Executive Summary (2-3 sentences) → Financial Status → Schedule Status → Open Items → Risks → Recent Activity.
Keep the total under 800 words. Do not use markdown headers larger than ###.`,
            },
            {
              role: "user",
              content: `Generate a project status summary for "${project.name}" using this data:\n\n${JSON.stringify(summaryData, null, 2)}`,
            },
          ],
        });

        const synthesizedSummary = completion.choices[0]?.message?.content ?? "Summary generation failed.";

        // Store in document_metadata
        const summaryId = crypto.randomUUID();
        const { data: savedDoc, error: saveError } = await supabase
          .from("document_metadata")
          .insert({
            id: summaryId,
            project_id: project.id,
            title: `Project Status Summary — ${project.name} — ${now.toISOString().split("T")[0]}`,
            summary: synthesizedSummary,
            type: "project_summary",
            category: "ai_generated",
            source: "ai_strategist",
            date: now.toISOString().split("T")[0],
          })
          .select("id, title")
          .single();

        if (saveError) {
          const partial = {
            success: true,
            message: `Summary generated but could not be saved: ${saveError.message}`,
            summary: synthesizedSummary,
            data: summaryData,
          };
          await recordWriteAudit({
            toolName: "generateProjectSummary",
            idempotencyKey,
            projectId: access.projectId,
            input,
            status: "error",
            response: partial,
          });
          return partial;
        }

        const responseOut = {
          success: true,
          message: `Project status summary for **${project.name}** generated and saved.`,
          summary: synthesizedSummary,
          documentId: savedDoc?.id,
          documentTitle: savedDoc?.title,
          data: summaryData,
          nextSteps: [
            "Share this summary with stakeholders",
            "Review flagged risks and assign owners",
            "Update any overdue items",
          ],
        };
        await recordWriteAudit({
          toolName: "generateProjectSummary",
          idempotencyKey,
          projectId: access.projectId,
          input,
          status: "success",
          response: responseOut,
        });
        return responseOut;
      }),
    }),

    createInitiativeCard: tool({
      description:
        "Create an initiative card on the Command Center board. Use when the user says " +
        "'add this to the board', 'create an initiative for [idea]', 'track this idea', " +
        "'remember this feature request', 'add a card for [thing]', or discusses any " +
        "idea, feature, bug, or task that should be tracked on the kanban board. " +
        "Does NOT require confirmation — cards are easy to edit/delete.",
      inputSchema: z.object({
        title: z.string().describe("Card title — concise, actionable"),
        description: z.string().optional().describe("Details, context, acceptance criteria"),
        status: z
          .enum(["idea", "planned", "in_progress", "done"])
          .default("idea")
          .describe("Board column — defaults to idea"),
        priority: z
          .enum(["urgent", "high", "medium", "low"])
          .default("medium")
          .describe("Priority level"),
        labels: z
          .array(z.string())
          .optional()
          .describe("Tags like AI, Frontend, Backend, Design, Bug Fix"),
        assignee: z.string().optional().describe("Person responsible"),
        dueDate: z.string().optional().describe("ISO due date"),
        githubIssueUrl: z.string().optional().describe("Link to GitHub issue if known"),
        linkedRecordType: z
          .string()
          .optional()
          .describe("Type of linked Alleato record: project, commitment, rfi, change_order, etc."),
        linkedRecordId: z
          .string()
          .optional()
          .describe("ID of the linked Alleato record"),
        confirmed: z.boolean().default(false),
        idempotencyKey: z.string().optional(),
      }),
      execute: withWriteTrace("createInitiativeCard", options, async (input) => {
        const {
          title,
          description,
          status,
          priority,
          labels,
          assignee,
          dueDate,
          githubIssueUrl,
          linkedRecordType,
          linkedRecordId,
          confirmed,
        } = input;

        if (!confirmed) {
          return {
            action: "preview",
            message: "Here's the initiative card I'll create. Reply **confirm** to proceed.",
            preview: {
              table: "initiative_cards",
              fields: {
                title,
                status,
                priority,
                labels: labels ?? [],
                assignee: assignee ?? null,
                due_date: dueDate ?? null,
              },
            },
          };
        }

        const idempotencyKey = resolveIdempotencyKey("createInitiativeCard", input);
        const replay = await getReplayResponse("createInitiativeCard", idempotencyKey);
        if (replay) return replay;

        // Get max sort_order for target column
        const { data: maxRow } = await supabase
          .from("initiative_cards")
          .select("sort_order")
          .eq("status", status)
          .order("sort_order", { ascending: false })
          .limit(1)
          .single();

        const nextOrder = (maxRow?.sort_order ?? -1) + 1;

        const { data, error } = await supabase
          .from("initiative_cards")
          .insert({
            title,
            description: description ?? null,
            status,
            priority,
            labels: labels ?? [],
            sort_order: nextOrder,
            source: "ai_chat",
            assignee: assignee ?? null,
            due_date: dueDate ?? null,
            github_issue_url: githubIssueUrl ?? null,
            linked_record_type: linkedRecordType ?? null,
            linked_record_id: linkedRecordId ?? null,
          })
          .select("id, title, status, priority")
          .single();

        if (error) {
          const failure = { success: false, error: error.message };
          await recordWriteAudit({
            toolName: "createInitiativeCard",
            idempotencyKey,
            projectId: null,
            input,
            status: "error",
            response: failure,
          });
          return failure;
        }

        const responseOut = {
          success: true,
          message: `Initiative **"${title}"** added to the ${status.replace("_", " ")} column.`,
          record: data,
          boardUrl: "/command-center",
          tip: "View and drag cards on the Command Center board.",
        };
        await recordWriteAudit({
          toolName: "createInitiativeCard",
          idempotencyKey,
          projectId: null,
          input,
          status: "success",
          response: responseOut,
        });
        return responseOut;
      }),
    }),

    submitFeedback: tool({
      description:
        "Submit a bug report or feature request on behalf of the user — identical to " +
        "submitting the feedback form in the app. Use when the user says 'report a bug', " +
        "'something is broken', 'submit a feature request', 'I have a suggestion', " +
        "'can you log this issue', or describes a problem or improvement idea they want tracked. " +
        "Always show a preview and ask for confirmation before submitting.",
      inputSchema: z.object({
        type: z
          .enum(["bug", "feature_request"])
          .describe("'bug' for broken behaviour, 'feature_request' for new functionality or improvements"),
        title: z
          .string()
          .optional()
          .describe("Short title — auto-generated from description if omitted"),
        description: z
          .string()
          .describe("Full description of the bug or feature request — be as specific as possible"),
        severity: z
          .enum(["low", "medium", "high"])
          .default("medium")
          .describe("Impact level: 'low' = minor inconvenience, 'medium' = workflow blocked, 'high' = data loss or major blocker"),
        projectId: z
          .number()
          .optional()
          .describe("Project ID if the issue is specific to one project"),
        pagePath: z
          .string()
          .optional()
          .describe("The page or section where the issue occurs, e.g. '/budget' or 'Commitments'"),
        confirmed: z.boolean().default(false),
        idempotencyKey: z.string().optional(),
      }),
      execute: withWriteTrace("submitFeedback", options, async (input) => {
        const { type, title, description, severity, projectId, pagePath, confirmed } = input;

        const requestType = type === "feature_request" ? "feature_request" : "bug";
        const resolvedPath = pagePath ?? "/ai-assistant";
        const resolvedTitle = buildAdminFeedbackTitle({
          providedTitle: title,
          requestType,
          comment: description,
        });

        if (!confirmed) {
          return {
            action: "preview",
            message: "Here's the feedback I'll submit on your behalf. Reply **confirm** to proceed.",
            preview: {
              type: type === "feature_request" ? "Feature Request" : "Bug Report",
              title: resolvedTitle,
              description,
              severity,
              pagePath: resolvedPath,
              projectId: projectId ?? null,
            },
          };
        }

        const idempotencyKey = resolveIdempotencyKey("submitFeedback", input);
        const replay = await getReplayResponse("submitFeedback", idempotencyKey);
        if (replay) return replay;

        const supabaseLocal = supabase;
        const feedbackId = crypto.randomUUID();

        const { error: insertError } = await supabaseLocal
          .from("admin_feedback_items")
          .insert({
            id: feedbackId,
            created_by: userId,
            title: resolvedTitle,
            comment: description,
            page_url: resolvedPath,
            page_path: resolvedPath,
            page_title: null,
            request_type: requestType,
            board_status: type === "feature_request" ? "submitted" : "submitted",
            severity,
            status: "open",
            target_selector: "ai-assistant-chat",
            target_id: null,
            target_tag: null,
            target_text: null,
            dom_path: null,
            target_rect: null,
            screenshot_path: null,
            screenshot_url: null,
            project_id: projectId ?? null,
            metadata: { source: "ai_assistant", submitted_by_ai: true },
          });

        if (insertError) {
          const failure = { success: false, error: insertError.message };
          await recordWriteAudit({
            toolName: "submitFeedback",
            idempotencyKey,
            projectId: projectId ?? null,
            input,
            status: "error",
            response: failure,
          });
          return failure;
        }

        // Run side effects: tool matching, GitHub issue, learning ingestion
        let githubIssueNumber: number | null = null;
        let githubIssueUrl: string | null = null;

        let feedbackSideEffectError: string | null = null;
        try {
          const matchedTool = await matchFeedbackToTool(
            resolvedTitle,
            description,
            resolvedPath,
            resolvedPath,
          );

          let toolContext = null;
          if (matchedTool) {
            const resolved = await resolveToolContext(matchedTool);
            toolContext = resolved;
            const agentPayload = resolved ? contextToAgentPayload(resolved) : null;
            await supabaseLocal
              .from("admin_feedback_items")
              .update({
                tool_id: matchedTool.id,
                agent_context: agentPayload as Json,
              })
              .eq("id", feedbackId);
          }

          const githubIssue = await createGitHubIssue({
            title: resolvedTitle,
            comment: description,
            pageUrl: resolvedPath,
            pagePath: resolvedPath,
            pageTitle: null,
            requestType,
            severity,
            targetId: null,
            targetSelector: "ai-assistant-chat",
            targetTag: null,
            targetText: null,
            domPath: null,
            screenshotUrl: null,
            projectId: projectId ?? null,
            metadata: { source: "ai_assistant", submitted_by_ai: true },
            toolContext,
          });

          if (githubIssue) {
            githubIssueNumber = githubIssue.number;
            githubIssueUrl = githubIssue.url;
            await supabaseLocal
              .from("admin_feedback_items")
              .update({
                github_issue_number: githubIssue.number,
                github_issue_url: githubIssue.url,
                github_issue_state: githubIssue.state,
                status: "submitted",
              })
              .eq("id", feedbackId);
          }

          await ingestAdminFeedbackLearning({
            feedbackItemId: feedbackId,
            title: resolvedTitle,
            comment: description,
            pagePath: resolvedPath,
            projectId: projectId ?? null,
            status: "candidate",
          });
        } catch (error) {
          feedbackSideEffectError = error instanceof Error ? error.message : String(error);
        }

        const response = {
          success: true,
          message: githubIssueUrl
            ? `${type === "feature_request" ? "Feature request" : "Bug report"} **"${resolvedTitle}"** submitted and GitHub issue [#${githubIssueNumber}](${githubIssueUrl}) created.`
            : `${type === "feature_request" ? "Feature request" : "Bug report"} **"${resolvedTitle}"** submitted successfully.`,
          feedbackId,
          githubIssueNumber,
          githubIssueUrl,
          sideEffectWarning: feedbackSideEffectError
            ? `Feedback was saved, but follow-up processing failed: ${feedbackSideEffectError}`
            : null,
          tip: type === "feature_request"
            ? "You can track this on the Roadmap at /product-board."
            : "You can track this in the Admin Feedback inbox.",
        };
        await recordWriteAudit({
          toolName: "submitFeedback",
          idempotencyKey,
          projectId: projectId ?? null,
          input,
          status: "success",
          response,
        });
        return response;
      }),
    }),

    addBoardItem: tool({
      description:
        "Add a feature idea, initiative, or product improvement directly to the Roadmap " +
        "kanban. Use when the user says 'add this to the board', 'put this on the roadmap', " +
        "'log this as a feature idea', 'add to planned', 'add to in progress', or wants to track " +
        "a product idea with a specific status column. " +
        "Always show a preview and ask for confirmation before writing.",
      inputSchema: z.object({
        title: z.string().describe("Short, clear title for the board card"),
        description: z.string().describe("Full description — context, goals, acceptance criteria"),
        // Values must match admin_feedback_items_board_status_check
        // (submitted | planned | in_progress | leadership_review | shipped). 'in_review' was in this
        // enum but the DB CHECK rejects it — picking it failed the write.
        board_status: z
          .enum(["submitted", "planned", "in_progress", "leadership_review", "shipped"])
          .default("submitted")
          .describe(
            "Which column to place the card in: " +
            "'submitted' = new idea, " +
            "'planned' = confirmed for roadmap, 'in_progress' = actively being built, " +
            "'leadership_review' = ready for leadership review, " +
            "'shipped' = done"
          ),
        severity: z
          .enum(["low", "medium", "high"])
          .default("medium")
          .describe("Priority: low / medium / high"),
        confirmed: z.boolean().default(false),
        idempotencyKey: z.string().optional(),
      }),
      execute: withWriteTrace("addBoardItem", options, async (input) => {
        const { title, description, board_status, severity, confirmed } = input;

        if (!confirmed) {
          return {
            action: "preview",
            message: "Here's the board card I'll create. Reply **confirm** to add it.",
            preview: {
              title,
              description,
              column: board_status,
              priority: severity,
              board: "/product-board",
            },
          };
        }

        const idempotencyKey = resolveIdempotencyKey("addBoardItem", input);
        const replay = await getReplayResponse("addBoardItem", idempotencyKey);
        if (replay) return replay;

        const supabaseLocal = supabase;
        const itemId = crypto.randomUUID();

        const { error } = await supabaseLocal.from("admin_feedback_items").insert({
          id: itemId,
          created_by: userId,
          title,
          comment: description,
          page_url: "/ai-assistant",
          page_path: "/ai-assistant",
          page_title: "AI Assistant",
          request_type: "feature_request",
          board_status,
          severity,
          status: "open",
          target_selector: "ai-assistant-chat",
          target_id: null,
          target_tag: null,
          target_text: null,
          dom_path: null,
          target_rect: null,
          screenshot_path: null,
          screenshot_url: null,
          project_id: null,
          metadata: { source: "ai_assistant", submitted_by_ai: true },
        });

        if (error) {
          const failure = { success: false, error: error.message };
          await recordWriteAudit({
            toolName: "addBoardItem",
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
          message: `**"${title}"** added to the **${board_status.replace(/_/g, " ")}** column on the [Roadmap](/product-board).`,
          itemId,
          board_status,
        };
        await recordWriteAudit({
          toolName: "addBoardItem",
          idempotencyKey,
          projectId: null,
          input,
          status: "success",
          response,
        });
        return response;
      }),
    }),
  };
}
