import { tool } from "ai";
import { z } from "zod";
import {
  asNumber,
  resolveProject,
  withTrace as _withTrace,
} from "../tool-utils";
import { isOpenRfiStatus } from "@/lib/ai/data/project-repo";
import {
  deriveSeverity,
  resolveTargetIdsForProjects,
  insightCardBaseQuery,
  type InsightCardWithTarget,
} from "@/lib/ai/insight-cards";
import type { OperationalToolInternals, CreateOperationalToolsOptions } from "./operational-internals";
import { type AnyRow } from "../types";

function withTrace<TInput extends Record<string, unknown>, TResult>(
  name: string,
  options: CreateOperationalToolsOptions,
  execute: (input: TInput) => Promise<TResult>,
) {
  return _withTrace(
    name,
    options,
    execute,
    "This operational knowledge source failed during retrieval. Explain the gap plainly and use other available sources before asking for more detail.",
  );
}

export function createProjectDataReadTools(internals: OperationalToolInternals) {
  const { options, supabase, guardrails, repo } = internals;

  return {
    // -----------------------------------------------------------------------
    // 2. People & Roles
    // -----------------------------------------------------------------------
    getPeopleAndRoles: tool({
      description:
        "Get the project directory: who is on a project, their roles, " +
        "companies, and contact information. Use when asked about team " +
        "members, contacts, who works on a project, or project personnel.",
      inputSchema: z.object({
        projectId: z.number().optional().describe("Project ID if known"),
        projectName: z
          .string()
          .optional()
          .describe("Project name to search for"),
        role: z
          .string()
          .optional()
          .describe("Filter by role (e.g. 'Project Manager')"),
      }),
      execute: withTrace(
        "getPeopleAndRoles",
        options,
        async ({ projectId, projectName, role }) => {
          const resolved = await resolveProject(
            supabase,
            guardrails,
            projectId,
            projectName,
          );
          if ("error" in resolved) return resolved;

          // Fetch memberships with people data
          let memberQuery = supabase
            .from("project_directory_memberships")
            .select(
              "person_id, role, user_type, status, " +
                "people(id, first_name, last_name, email, job_title, " +
                "phone_mobile, phone_business, person_type, " +
                // Disambiguate: people<->companies has FKs in both directions
                // (people.company_id and companies.primary_contact_id), so the
                // embed must name the FK or PostgREST errors "more than one
                // relationship". Guarded by the AI read-tool contract harness.
                "companies!people_company_id_fkey(id, name))",
            )
            .eq("project_id", resolved.id)
            .eq("status", "active");

          if (role) {
            memberQuery = memberQuery.ilike("role", `%${role}%`);
          }

          const { data: members, error } = await memberQuery.limit(100);
          if (error) return { error: error.message };

          const memberRows = (members ?? []) as unknown as AnyRow[];

          // Group by role
          const byRole = new Map<string, AnyRow[]>();
          memberRows.forEach((m) => {
            const r = (m.role as string) ?? "Unassigned";
            const arr = byRole.get(r) || [];
            arr.push(m);
            byRole.set(r, arr);
          });

          const roleBreakdown = Array.from(byRole.entries()).map(
            ([roleName, members]) => ({
              role: roleName,
              count: members.length,
              members: members.map((m) => {
                const person = m.people as AnyRow | null;
                const company = person?.companies as AnyRow | null;
                return {
                  name: person
                    ? `${person.first_name ?? ""} ${person.last_name ?? ""}`.trim()
                    : "Unknown",
                  email: person?.email,
                  jobTitle: person?.job_title,
                  phone: person?.phone_mobile ?? person?.phone_business,
                  company: company?.name ?? null,
                  userType: m.user_type,
                };
              }),
            }),
          );

          return {
            project: { id: resolved.id, name: resolved.name },
            totalMembers: memberRows.length,
            roleBreakdown,
          };
        },
      ),
    }),

    // -----------------------------------------------------------------------
    // 3. Vendor Performance
    // -----------------------------------------------------------------------
    getVendorPerformance: tool({
      description:
        "Analyze vendor/subcontractor performance across a project or portfolio. " +
        "Shows active vendors, their contract values, change order exposure, " +
        "and billing status. Use when asked about vendor performance, " +
        "subcontractor status, or trade partner metrics.",
      inputSchema: z.object({
        projectId: z.number().optional().describe("Project ID if known"),
        projectName: z
          .string()
          .optional()
          .describe("Project name to search for"),
        vendorName: z
          .string()
          .optional()
          .describe("Filter to a specific vendor by name"),
      }),
      execute: withTrace(
        "getVendorPerformance",
        options,
        async ({ projectId, projectName, vendorName }) => {
          // Optional project scoping
          let resolvedId: number | undefined;
          let resolvedName: string | undefined;
          if (projectId || projectName) {
            const resolved = await resolveProject(
              supabase,
              guardrails,
              projectId,
              projectName,
            );
            if ("error" in resolved) return resolved;
            resolvedId = resolved.id;
            resolvedName = resolved.name;
          }

          // Fetch subcontracts for commitment data first so we know which companies to look up
          let subQuery = supabase
            .from("subcontracts")
            .select(
              "id, title, status, contract_company_id, " +
                "project_id, created_at",
            )
            .is("deleted_at", null);

          if (resolvedId) {
            subQuery = subQuery.eq("project_id", resolvedId);
          }

          const { data: subRows } = await subQuery.limit(200);
          const subs = (subRows ?? []) as unknown as AnyRow[];

          // Collect unique company UUIDs from subcontracts
          // contract_company_id is a UUID referencing companies.id (not vendors.id)
          const companyIds = Array.from(
            new Set(
              subs.map((s) => s.contract_company_id as string).filter(Boolean),
            ),
          );

          // Fetch companies by UUID — parallel with SOV fetch
          const subIds = subs.map((s) => s.id as string).filter(Boolean);
          const [companiesRes, sovRes] = await Promise.all([
            companyIds.length > 0
              ? supabase
                  .from("companies")
                  .select("id, name")
                  .in("id", companyIds)
                  .then((r) => r)
              : Promise.resolve({ data: [] }),
            subIds.length > 0
              ? supabase
                  .from("schedule_of_values")
                  .select("id, commitment_id, total_amount, status")
                  .in("commitment_id", subIds)
              : Promise.resolve({ data: [] }),
          ]);

          // Optionally filter by vendor name
          let companies = (companiesRes.data ?? []) as AnyRow[];
          if (vendorName) {
            const lower = vendorName.toLowerCase();
            companies = companies.filter((c) =>
              String(c.name ?? "")
                .toLowerCase()
                .includes(lower),
            );
          }

          const sovData = (sovRes.data ?? []) as AnyRow[];

          // Index SOVs by commitment_id
          const sovByCommitment = new Map<string, AnyRow>();
          sovData.forEach((s) => {
            if (s.commitment_id)
              sovByCommitment.set(s.commitment_id as string, s);
          });

          // Build company lookup map (UUID → company row)
          const companyMap = new Map<string, AnyRow>();
          companies.forEach((c) => companyMap.set(c.id as string, c));

          const vendorPerformance = new Map<
            string,
            {
              vendor: AnyRow;
              contracts: number;
              totalContractValue: number;
            }
          >();

          subs.forEach((sub) => {
            const companyId = sub.contract_company_id as string;
            if (!companyId) return;

            const existing = vendorPerformance.get(companyId) ?? {
              vendor: companyMap.get(companyId) ?? {
                id: companyId,
                name: "Unknown",
              },
              contracts: 0,
              totalContractValue: 0,
            };

            existing.contracts += 1;
            const sov = sovByCommitment.get(sub.id as string);
            if (sov) {
              existing.totalContractValue += asNumber(sov.total_amount);
            }

            vendorPerformance.set(companyId, existing);
          });

          // Sort by total value descending
          const ranked = Array.from(vendorPerformance.values()).sort(
            (a, b) => b.totalContractValue - a.totalContractValue,
          );

          const totalCommittedValue = ranked.reduce(
            (sum, v) => sum + v.totalContractValue,
            0,
          );

          return {
            project: resolvedId ? { id: resolvedId, name: resolvedName } : null,
            portfolioSummary: {
              totalVendors: ranked.length,
              totalCommittedValue,
              totalContracts: subs.length,
            },
            vendors: ranked.slice(0, 25).map((v) => ({
              companyName: v.vendor.name,
              contactName: v.vendor.contact_name,
              contactEmail: v.vendor.contact_email,
              contractCount: v.contracts,
              totalContractValue: v.totalContractValue,
            })),
          };
        },
      ),
    }),

    // -----------------------------------------------------------------------
    // 4. RFI Status
    // -----------------------------------------------------------------------
    getRFIStatus: tool({
      description:
        "Analyze RFI (Request for Information) status for a project. " +
        "Shows overdue RFIs, response times, ball-in-court distribution, " +
        "cost/schedule impacts, and status breakdown. Use when asked about " +
        "RFIs, questions pending, or information requests.",
      inputSchema: z.object({
        projectId: z.number().optional().describe("Project ID if known"),
        projectName: z
          .string()
          .optional()
          .describe("Project name to search for"),
        status: z
          .string()
          .optional()
          .describe("Filter by status (e.g. 'open', 'closed')"),
      }),
      execute: withTrace(
        "getRFIStatus",
        options,
        async ({ projectId, projectName, status }) => {
          const resolved = await resolveProject(
            supabase,
            guardrails,
            projectId,
            projectName,
          );
          if ("error" in resolved) return resolved;

          let rfiRows: unknown[];
          try {
            rfiRows = await repo.rfisForProject(resolved.id, { status });
          } catch (rfiError) {
            return {
              error: rfiError instanceof Error ? rfiError.message : "RFI lookup failed",
            };
          }

          const rfis = rfiRows as AnyRow[];
          const now = new Date().toISOString().split("T")[0];

          // Status breakdown
          const statusCounts = new Map<string, number>();
          rfis.forEach((r) => {
            const s = (r.status as string) ?? "unknown";
            statusCounts.set(s, (statusCounts.get(s) ?? 0) + 1);
          });

          // Overdue (open + past due date). Open-status semantics centralized in
          // ProjectRepo's isOpenRfiStatus so every surface agrees on "open".
          const openRfis = rfis.filter((r) => isOpenRfiStatus(r.status));
          const overdueRfis = openRfis.filter(
            (r) => r.due_date && (r.due_date as string) < now,
          );

          // Ball-in-court distribution
          const bicCounts = new Map<string, number>();
          openRfis.forEach((r) => {
            const bic = (r.ball_in_court as string) ?? "Unassigned";
            bicCounts.set(bic, (bicCounts.get(bic) ?? 0) + 1);
          });

          // Cost and schedule impact flags
          const withCostImpact = rfis.filter(
            (r) =>
              r.cost_impact && r.cost_impact !== "No" && r.cost_impact !== "no",
          );
          const withScheduleImpact = rfis.filter(
            (r) =>
              r.schedule_impact &&
              r.schedule_impact !== "No" &&
              r.schedule_impact !== "no",
          );

          // Average days open for closed RFIs (uses canonical predicate so closed-draft
          // is counted as closed, matching what every other surface does).
          const closedRfis = rfis.filter(
            (r) => typeof r.status === "string" && !isOpenRfiStatus(r.status),
          );
          let avgDaysToClose = 0;
          if (closedRfis.length > 0) {
            const totalDays = closedRfis.reduce((sum, r) => {
              if (r.created_at && r.closed_at) {
                const created = new Date(r.created_at as string);
                const closed = new Date(r.closed_at as string);
                return (
                  sum +
                  Math.round(
                    (closed.getTime() - created.getTime()) /
                      (1000 * 60 * 60 * 24),
                  )
                );
              }
              return sum;
            }, 0);
            avgDaysToClose = Math.round(totalDays / closedRfis.length);
          }

          return {
            project: { id: resolved.id, name: resolved.name },
            summary: {
              totalRFIs: rfis.length,
              openRFIs: openRfis.length,
              closedRFIs: closedRfis.length,
              overdueRFIs: overdueRfis.length,
              withCostImpact: withCostImpact.length,
              withScheduleImpact: withScheduleImpact.length,
              avgDaysToClose,
            },
            statusBreakdown: Object.fromEntries(statusCounts),
            ballInCourtDistribution: Object.fromEntries(bicCounts),
            overdueRFIs: overdueRfis.slice(0, 15).map((r) => ({
              number: r.number,
              subject: r.subject,
              dueDate: r.due_date,
              ballInCourt: r.ball_in_court,
              costImpact: r.cost_impact,
              scheduleImpact: r.schedule_impact,
              responsibleContractor: r.responsible_contractor,
            })),
            recentRFIs: rfis.slice(0, 10).map((r) => ({
              number: r.number,
              subject: r.subject,
              status: r.status,
              dueDate: r.due_date,
              ballInCourt: r.ball_in_court,
              createdAt: r.created_at,
            })),
          };
        },
      ),
    }),

    // -----------------------------------------------------------------------
    // 5. Submittal Status
    // -----------------------------------------------------------------------
    getSubmittalStatus: tool({
      description:
        "Analyze submittal status for a project. Shows overdue submittals, " +
        "approval pipeline, ball-in-court distribution, lead times, and " +
        "status breakdown. Use when asked about submittals, approvals, " +
        "material submissions, or shop drawings.",
      inputSchema: z.object({
        projectId: z.number().optional().describe("Project ID if known"),
        projectName: z
          .string()
          .optional()
          .describe("Project name to search for"),
        status: z
          .string()
          .optional()
          .describe("Filter by status (e.g. 'pending', 'approved')"),
      }),
      execute: withTrace(
        "getSubmittalStatus",
        options,
        async ({ projectId, projectName, status }) => {
          const resolved = await resolveProject(
            supabase,
            guardrails,
            projectId,
            projectName,
          );
          if ("error" in resolved) return resolved;

          let subQuery = supabase
            .from("submittals")
            .select("*")
            .eq("project_id", resolved.id)
            .order("created_at", { ascending: false })
            .limit(200);

          if (status) {
            subQuery = subQuery.ilike("status", `%${status}%`);
          }

          const { data: subRows, error } = await subQuery;
          if (error) return { error: error.message };

          const submittals = (subRows ?? []) as AnyRow[];
          const now = new Date().toISOString().split("T")[0];

          // Status breakdown
          const statusCounts = new Map<string, number>();
          submittals.forEach((s) => {
            const st = (s.status as string) ?? "unknown";
            statusCounts.set(st, (statusCounts.get(st) ?? 0) + 1);
          });

          // Open submittals (not approved/closed)
          const openSubmittals = submittals.filter(
            (s) =>
              (s.status as string) !== "approved" &&
              (s.status as string) !== "Approved" &&
              (s.status as string) !== "closed" &&
              (s.status as string) !== "Closed",
          );

          // Overdue (required_approval_date or required_on_site_date past)
          const overdueSubmittals = openSubmittals.filter(
            (s) =>
              (s.required_approval_date &&
                (s.required_approval_date as string) < now) ||
              (s.required_on_site_date &&
                (s.required_on_site_date as string) < now),
          );

          // Ball-in-court distribution
          const bicCounts = new Map<string, number>();
          openSubmittals.forEach((s) => {
            const bic = (s.ball_in_court as string) ?? "Unassigned";
            bicCounts.set(bic, (bicCounts.get(bic) ?? 0) + 1);
          });

          // Priority distribution
          const priorityCounts = new Map<string, number>();
          submittals.forEach((s) => {
            const p = (s.priority as string) ?? "Normal";
            priorityCounts.set(p, (priorityCounts.get(p) ?? 0) + 1);
          });

          // Division/spec section distribution
          const divisionCounts = new Map<string, number>();
          submittals.forEach((s) => {
            const d =
              (s.division as string) ??
              (s.specification_section as string) ??
              "Unclassified";
            divisionCounts.set(d, (divisionCounts.get(d) ?? 0) + 1);
          });

          return {
            project: { id: resolved.id, name: resolved.name },
            summary: {
              totalSubmittals: submittals.length,
              openSubmittals: openSubmittals.length,
              overdueSubmittals: overdueSubmittals.length,
            },
            statusBreakdown: Object.fromEntries(statusCounts),
            ballInCourtDistribution: Object.fromEntries(bicCounts),
            priorityDistribution: Object.fromEntries(priorityCounts),
            divisionBreakdown: Object.fromEntries(
              Array.from(divisionCounts.entries())
                .sort((a, b) => b[1] - a[1])
                .slice(0, 15),
            ),
            overdueSubmittals: overdueSubmittals.slice(0, 15).map((s) => ({
              number: s.submittal_number,
              title: s.title,
              status: s.status,
              ballInCourt: s.ball_in_court,
              requiredApprovalDate: s.required_approval_date,
              requiredOnSiteDate: s.required_on_site_date,
              submitterCompany: s.submitter_company,
              priority: s.priority,
              division: s.division,
            })),
            recentSubmittals: submittals.slice(0, 10).map((s) => ({
              number: s.submittal_number,
              title: s.title,
              status: s.status,
              ballInCourt: s.ball_in_court,
              submissionDate: s.submission_date,
              leadTime: s.lead_time,
            })),
          };
        },
      ),
    }),

    // -----------------------------------------------------------------------
    // 6. Cross-Project Comparison
    // -----------------------------------------------------------------------
    getCrossProjectComparison: tool({
      description:
        "Compare key metrics across multiple projects side-by-side: " +
        "budget, schedule, RFI/submittal counts, change order exposure, " +
        "and health status. Use when asked to compare projects or see " +
        "which project has the most risk, biggest budget, etc.",
      inputSchema: z.object({
        projectIds: z
          .array(z.number())
          .optional()
          .describe("Specific project IDs to compare"),
        phase: z
          .string()
          .optional()
          .default("Current")
          .describe("Filter by phase if no projectIds given"),
      }),
      execute: withTrace(
        "getCrossProjectComparison",
        options,
        async ({ projectIds, phase }) => {
          // Get projects
          let projQuery = supabase
            .from("projects")
            .select(
              "id, name, phase, health_status, health_score, budget, budget_used, completion_percentage",
            )
            .eq("archived", false)
            .order("name", { ascending: true })
            .limit(30);

          if (projectIds && projectIds.length > 0) {
            projQuery = projQuery.in("id", projectIds);
          } else if (phase && phase !== "all") {
            projQuery = projQuery.eq("phase", phase);
          }

          const { data: projRows } = await projQuery;
          const projects = (projRows ?? []) as AnyRow[];
          const pIds = projects.map((p) => p.id as number);

          if (pIds.length === 0) {
            return { error: "No projects found matching criteria" };
          }

          // Parallel fetch across all projects
          const [financialRes, rfiRes, submittalRes, taskRes, ceRes] =
            await Promise.all([
              supabase
                .from("prime_contract_financial_summary")
                .select(
                  "project_id, original_contract_amount, revised_contract_amount, pending_change_orders, approved_change_orders",
                )
                .in("project_id", pIds),
              supabase
                .from("rfis")
                .select("project_id, status, due_date")
                .in("project_id", pIds),
              supabase
                .from("submittals")
                .select("project_id, status")
                .in("project_id", pIds),
              supabase
                .from("schedule_tasks")
                .select(
                  "project_id, status, finish_date, percent_complete, is_milestone",
                )
                .in("project_id", pIds),
              supabase
                .from("change_events_summary")
                .select("project_id, status")
                .in("project_id", pIds),
            ]);

          const now = new Date().toISOString().split("T")[0];

          // Index by project
          const rfisByProject = new Map<number, AnyRow[]>();
          (rfiRes.data ?? []).forEach((r: AnyRow) => {
            const pid = r.project_id as number;
            const arr = rfisByProject.get(pid) || [];
            arr.push(r);
            rfisByProject.set(pid, arr);
          });

          const submittalsByProject = new Map<number, AnyRow[]>();
          (submittalRes.data ?? []).forEach((s: AnyRow) => {
            const pid = s.project_id as number;
            const arr = submittalsByProject.get(pid) || [];
            arr.push(s);
            submittalsByProject.set(pid, arr);
          });

          const tasksByProject = new Map<number, AnyRow[]>();
          (taskRes.data ?? []).forEach((t: AnyRow) => {
            const pid = t.project_id as number;
            const arr = tasksByProject.get(pid) || [];
            arr.push(t);
            tasksByProject.set(pid, arr);
          });

          const finByProject = new Map<number, AnyRow[]>();
          (financialRes.data ?? []).forEach((f: AnyRow) => {
            const pid = f.project_id as number;
            const arr = finByProject.get(pid) || [];
            arr.push(f);
            finByProject.set(pid, arr);
          });

          const ceByProject = new Map<number, AnyRow[]>();
          (ceRes.data ?? []).forEach((c: AnyRow) => {
            const pid = c.project_id as number;
            const arr = ceByProject.get(pid) || [];
            arr.push(c);
            ceByProject.set(pid, arr);
          });

          // Build comparison rows
          const comparison = projects.map((p) => {
            const pid = p.id as number;
            const rfis = rfisByProject.get(pid) ?? [];
            const subs = submittalsByProject.get(pid) ?? [];
            const tasks = tasksByProject.get(pid) ?? [];
            const fins = finByProject.get(pid) ?? [];
            const ces = ceByProject.get(pid) ?? [];

            const openRfis = rfis.filter((r) => isOpenRfiStatus(r.status));
            const overdueRfis = openRfis.filter(
              (r) => r.due_date && (r.due_date as string) < now,
            );
            const overdueTasks = tasks.filter(
              (t) =>
                t.finish_date &&
                (t.finish_date as string) < now &&
                t.status !== "completed" &&
                asNumber(t.percent_complete) < 100,
            );
            const contractValue = fins.reduce(
              (sum, f) =>
                sum +
                asNumber(
                  f.revised_contract_amount ?? f.original_contract_amount,
                ),
              0,
            );
            const pendingCOs = fins.reduce(
              (sum, f) => sum + asNumber(f.pending_change_orders),
              0,
            );
            const openCEs = ces.filter(
              (c) =>
                (c.status as string) !== "closed" &&
                (c.status as string) !== "void",
            );

            return {
              projectId: pid,
              projectName: p.name,
              phase: p.phase,
              healthStatus: p.health_status,
              healthScore: p.health_score,
              completionPct: p.completion_percentage,
              contractValue,
              pendingChangeOrders: pendingCOs,
              openChangeEvents: openCEs.length,
              totalTasks: tasks.length,
              overdueTasks: overdueTasks.length,
              totalRFIs: rfis.length,
              openRFIs: openRfis.length,
              overdueRFIs: overdueRfis.length,
              totalSubmittals: subs.length,
            };
          });

          // Sort by risk (overdue items descending)
          comparison.sort(
            (a, b) =>
              b.overdueTasks + b.overdueRFIs - (a.overdueTasks + a.overdueRFIs),
          );

          return {
            projectCount: comparison.length,
            comparison,
          };
        },
      ),
    }),

    // -----------------------------------------------------------------------
    // 7. Historical Trends
    // -----------------------------------------------------------------------
    getHistoricalTrends: tool({
      description:
        "Analyze how a project's metrics have changed over time: " +
        "RFI creation trends, submittal pipeline velocity, change order " +
        "trends, and schedule progress. Use when asked about trends, " +
        "velocity, trajectory, or how things have changed.",
      inputSchema: z.object({
        projectId: z.number().optional().describe("Project ID if known"),
        projectName: z
          .string()
          .optional()
          .describe("Project name to search for"),
        months: z
          .number()
          .optional()
          .default(6)
          .describe("How many months of history to analyze"),
      }),
      execute: withTrace(
        "getHistoricalTrends",
        options,
        async ({ projectId, projectName, months }) => {
          const resolved = await resolveProject(
            supabase,
            guardrails,
            projectId,
            projectName,
          );
          if ("error" in resolved) return resolved;

          const lookbackDate = new Date();
          lookbackDate.setMonth(lookbackDate.getMonth() - (months ?? 6));
          const lookbackStr = lookbackDate.toISOString();

          // Fetch time-series data
          const [rfiRes, submittalRes, coRes, insightRes] = await Promise.all([
            supabase
              .from("rfis")
              .select("id, status, created_at, due_date")
              .eq("project_id", resolved.id)
              .gte("created_at", lookbackStr)
              .order("created_at", { ascending: true })
              .limit(500),
            supabase
              .from("submittals")
              .select("id, status, created_at, submission_date")
              .eq("project_id", resolved.id)
              .gte("created_at", lookbackStr)
              .order("created_at", { ascending: true })
              .limit(500),
            supabase
              .from("prime_contract_change_orders")
              .select("id, status, total_amount, created_at")
              .eq("project_id", resolved.id)
              .gte("created_at", lookbackStr)
              .order("created_at", { ascending: true })
              .limit(200),
            // Pipeline B: resolve project → target_id and read insight_cards (any card_type).
            (async () => {
              const tm = await resolveTargetIdsForProjects(supabase, [resolved.id]);
              const tid = tm.get(resolved.id);
              if (!tid) return { data: [], error: null };
              return await insightCardBaseQuery(supabase, { includeAnyStatus: true })
                .eq("primary_target_id", tid)
                .gte("created_at", lookbackStr)
                .order("created_at", { ascending: true })
                .limit(500);
            })(),
          ]);

          const rfis = (rfiRes.data ?? []) as AnyRow[];
          const submittals = (submittalRes.data ?? []) as AnyRow[];
          const cos = (coRes.data ?? []) as AnyRow[];
          const insights = ((insightRes as { data: unknown }).data ?? []) as unknown as InsightCardWithTarget[];

          // Monthly aggregation helper
          function monthKey(dateStr: string): string {
            const d = new Date(dateStr);
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
          }

          // RFI trends by month
          const rfiByMonth = new Map<string, number>();
          rfis.forEach((r) => {
            if (r.created_at) {
              const key = monthKey(r.created_at as string);
              rfiByMonth.set(key, (rfiByMonth.get(key) ?? 0) + 1);
            }
          });

          // Submittal trends by month
          const subByMonth = new Map<string, number>();
          submittals.forEach((s) => {
            if (s.created_at) {
              const key = monthKey(s.created_at as string);
              subByMonth.set(key, (subByMonth.get(key) ?? 0) + 1);
            }
          });

          // CO trends by month with cumulative value
          const coByMonth = new Map<string, { count: number; value: number }>();
          cos.forEach((co) => {
            if (co.created_at) {
              const key = monthKey(co.created_at as string);
              const existing = coByMonth.get(key) ?? { count: 0, value: 0 };
              existing.count += 1;
              existing.value += asNumber(co.total_amount);
              coByMonth.set(key, existing);
            }
          });

          // Insight trends by month
          const insightByMonth = new Map<
            string,
            { total: number; critical: number }
          >();
          insights.forEach((card) => {
            if (card.created_at) {
              const key = monthKey(card.created_at as string);
              const existing = insightByMonth.get(key) ?? {
                total: 0,
                critical: 0,
              };
              existing.total += 1;
              // Pipeline B: derive severity from card_type + confidence.
              const sev = deriveSeverity(card);
              if (sev === "critical" || sev === "high") {
                existing.critical += 1;
              }
              insightByMonth.set(key, existing);
            }
          });

          // Build sorted monthly timeline
          const allMonths = new Set([
            ...rfiByMonth.keys(),
            ...subByMonth.keys(),
            ...coByMonth.keys(),
            ...insightByMonth.keys(),
          ]);
          const sortedMonths = Array.from(allMonths).sort();

          const monthlyTimeline = sortedMonths.map((month) => ({
            month,
            newRFIs: rfiByMonth.get(month) ?? 0,
            newSubmittals: subByMonth.get(month) ?? 0,
            newChangeOrders: coByMonth.get(month)?.count ?? 0,
            changeOrderValue: coByMonth.get(month)?.value ?? 0,
            newInsights: insightByMonth.get(month)?.total ?? 0,
            criticalInsights: insightByMonth.get(month)?.critical ?? 0,
          }));

          return {
            project: { id: resolved.id, name: resolved.name },
            periodMonths: months ?? 6,
            totals: {
              rfisCreated: rfis.length,
              submittalsCreated: submittals.length,
              changeOrdersCreated: cos.length,
              changeOrderTotalValue: cos.reduce(
                (sum, co) => sum + asNumber(co.amount),
                0,
              ),
              insightsGenerated: insights.length,
            },
            monthlyTimeline,
          };
        },
      ),
    }),

    // -----------------------------------------------------------------------
    // findProject
    // -----------------------------------------------------------------------
    findProject: tool({
      description:
        "Look up a project by name (partial match) or list all active projects. " +
        "Use this when the user mentions a project by name and you need to " +
        "resolve it to an ID, or when you're unsure which project they mean. " +
        "Returns project ID, name, phase, and key stats.",
      inputSchema: z.object({
        projectName: z
          .string()
          .optional()
          .describe("Project name or partial name to search for"),
        listAll: z
          .boolean()
          .optional()
          .default(false)
          .describe("If true, list all active (non-archived) projects"),
      }),
      execute: withTrace(
        "findProject",
        options,
        async ({ projectName, listAll }) => {
          const scope = await guardrails.getScope();

          if (listAll) {
            if (!scope.isAdmin && scope.allowedProjectIds.length === 0) {
              return { error: "You do not have access to any projects." };
            }

            let query = supabase
              .from("projects")
              .select("id, name, phase")
              .eq("archived", false)
              .order("name", { ascending: true })
              .limit(50);

            if (!scope.isAdmin) {
              query = query.in("id", scope.allowedProjectIds);
            }

            const { data, error } = await query;
            if (error) return { error: error.message };
            return {
              projects: ((data ?? []) as unknown as AnyRow[]).map((p) => ({
                id: p.id,
                name: p.name,
                phase: p.phase,
              })),
            };
          }

          if (!projectName) {
            return {
              error:
                "Provide a projectName to search for, or set listAll: true",
            };
          }

          if (!scope.isAdmin && scope.allowedProjectIds.length === 0) {
            return { error: "You do not have access to any projects." };
          }

          // Step 1: Resolve the project name from the database first so that
          // the communication searches use the canonical project name (bestMatch.name)
          // rather than the raw user-supplied query — this scopes email/Teams/doc
          // results to the specific resolved project and avoids cross-project leakage.
          let dbQuery = supabase
            .from("projects")
            .select("id, name, phase")
            .eq("archived", false)
            .ilike("name", `%${projectName}%`)
            .order("name", { ascending: true })
            .limit(5);

          if (!scope.isAdmin) {
            dbQuery = dbQuery.in("id", scope.allowedProjectIds);
          }

          const dbResult = await dbQuery;

          const { data, error } = dbResult;
          if (error) return { error: error.message };
          const matches = (data ?? []) as unknown as AnyRow[];

          // Use the resolved project name for comms search when possible; fall back
          // to the original query when no DB match is found (project may exist only
          // in emails/Teams but not yet in the database).
          const resolvedQuery =
            matches.length > 0
              ? String(matches[0].name ?? projectName)
              : projectName;

          // Step 2: Run communication searches using the resolved name.
          // Emails + Teams are admin-only; documents are allowed for all.
          const commsAccess =
            await internals.requireAdminForCommunications("Email and Teams");

          const { searchDocumentChunksByCategory } = await import("./shared-search-helpers");

          const docsPromise = searchDocumentChunksByCategory({
            supabase: internals.ragSupabase,
            metadataSupabase: internals.supabase,
            query: resolvedQuery,
            category: "document",
            matchCount: 4,
            sourceLabel: "document",
            scope,
          });

          const emailPromise = commsAccess.ok
            ? searchDocumentChunksByCategory({
                supabase: internals.ragSupabase,
                metadataSupabase: internals.supabase,
                query: resolvedQuery,
                category: "email",
                matchCount: 6,
                sourceLabel: "email",
                scope,
              })
            : Promise.resolve({ error: commsAccess.error, results: [] });

          const teamsPromise = commsAccess.ok
            ? searchDocumentChunksByCategory({
                supabase: internals.ragSupabase,
                metadataSupabase: internals.supabase,
                query: resolvedQuery,
                category: "teams_message",
                matchCount: 6,
                sourceLabel: "Teams message",
                scope,
              })
            : Promise.resolve({ error: commsAccess.error, results: [] });

          const [emailResult, teamsResult, docsResult] = await Promise.all([
            emailPromise,
            teamsPromise,
            docsPromise,
          ]);

          const communicationsNote = commsAccess.ok
            ? "IMPORTANT: The following emails, Teams messages, and documents were retrieved automatically. " +
              "Use this communication intelligence to answer questions about recent activity, even if the project is not found in the database. " +
              "Lead with the most recent and actionable signals from emails and Teams before diving into project data."
            : `IMPORTANT: Email and Teams access is admin-only in Alleato. ${commsAccess.error}`;

          if (matches.length === 0) {
            return {
              matches: [],
              message: `No projects found matching "${projectName}" in the database. ${
                commsAccess.ok
                  ? "However, communications data was searched — use the emails, Teams messages, and documents below to answer questions about this project."
                  : "However, document search still ran; email and Teams were blocked by permissions."
              }`,
              communicationsNote,
              emails: emailResult,
              teamsMessages: teamsResult,
              documents: docsResult,
            };
          }

          return {
            matches: matches.map((p) => ({
              id: p.id,
              name: p.name,
              phase: p.phase,
            })),
            bestMatch: { id: matches[0].id, name: matches[0].name },
            communicationsNote,
            emails: emailResult,
            teamsMessages: teamsResult,
            documents: docsResult,
          };
        },
      ),
    }),
  };
}
