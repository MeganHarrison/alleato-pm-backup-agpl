import Link from "next/link";
import type { Metadata } from "next";
import {
  AlertTriangle,
  Banknote,
  BriefcaseBusiness,
} from "lucide-react";
import { AppCapabilityAccessDenied } from "@/components/guards/app-capability-access-denied";
import { PageShell, SectionRuleHeading } from "@/components/layout";
import {
  hasAppCapability,
  loadAppCapabilityAccessForUser,
} from "@/lib/app-capabilities";
import { getCurrentUser } from "@/lib/auth/current-user";
import {
  deriveBrandonDraftLearning,
  BRANDON_LEARNING_SUPPRESSION_PREFIX,
  type BrandonAssistantReviewLearningRow,
} from "@/lib/email-assistant/brandon-learning";
import {
  deriveBrandonEmailAssistantDecision,
  type BrandonEmailAssistantDecision,
} from "@/lib/email-assistant/brandon-triage";
import { OWNER_BRIEFING_RECIPIENTS } from "@/lib/executive/owner-briefing-recipients";
import { listAllProgressReports } from "@/lib/progress-reports/server";
import type { ProgressReportAllListItem } from "@/lib/progress-reports/types";
import {
  createOutlookIntakeServiceClient,
  createServiceClient,
} from "@/lib/supabase/service";
import { serviceDb } from "@/lib/supabase/service-db";

export const metadata: Metadata = {
  title: "Brandon Dashboard | Alleato",
  description:
    "Private Brandon and Megan operating dashboard for email, tasks, progress reports, accounting, and alerts.",
};

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const BRANDON_EMAIL = "bclymer@alleatogroup.com";
const CLOSED_ACCOUNTING_STATUSES = new Set(["Closed", "Voided"]);
const DONE_TASK_STATUSES = new Set(["done", "complete", "completed", "cancelled"]);

type ProjectSummary = {
  id: number;
  name: string | null;
  project_number: string | null;
};

type BrandonEmailRow = {
  id: number;
  project_id: number;
  subject: string;
  from_name: string | null;
  from_email: string | null;
  body: string | null;
  body_text: string | null;
  received_at: string | null;
  sent_at: string | null;
  created_at: string | null;
  has_attachments: boolean | null;
  is_starred: boolean | null;
  status: string;
};

type BrandonIntakeEmailRow = {
  id: number;
  project_id: number | null;
  subject: string;
  from_name: string | null;
  from_email: string | null;
  body: string | null;
  body_text: string | null;
  to_list: string[] | null;
  cc_list: string[] | null;
  mailbox_user_id: string;
  received_at: string | null;
  created_at: string | null;
  has_attachments: boolean | null;
  web_link: string | null;
};

type BrandonAssistantReviewRow = BrandonAssistantReviewLearningRow & {
  intake_email_id: number;
  reviewer_email: string | null;
};

type BrandonAssistantQueueItem = {
  email: BrandonIntakeEmailRow;
  decision: BrandonEmailAssistantDecision;
};

type BrandonTaskRow = {
  id: string;
  title: string | null;
  description: string;
  status: string;
  priority: string | null;
  due_date: string | null;
  assignee_name: string | null;
  assignee_email: string | null;
  project_id: number | null;
  project_ids: number[] | null;
  source_system: string;
  created_at: string;
  updated_at: string;
};

type AccountingInvoiceRow = {
  balance: number | null;
  due_date: string | null;
  project: string | null;
  project_id: number | null;
  customer_name: string | null;
  status: string | null;
};

type AccountingBillRow = {
  balance: number | null;
  due_date: string | null;
  approved_for_payment: boolean | null;
  status: string | null;
};

type PaymentRow = {
  payment_amount: number | null;
  application_date: string | null;
  customer_name: string | null;
  reference_nbr: string;
};

type CheckRow = {
  payment_amount: number | null;
  application_date: string | null;
  vendor_name: string | null;
  reference_nbr: string;
};

type AlertItem = {
  id: string;
  severity: "high" | "medium" | "low";
  title: string;
  detail: string;
};

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDate(value: string | null | undefined) {
  const date = parseDate(value);
  if (!date) return "No date";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(date);
}

function formatDateTime(value: string | null | undefined) {
  const date = parseDate(value);
  if (!date) return "No date";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function daysBetween(date: Date, compareTo = new Date()) {
  const ms = startOfDay(compareTo).getTime() - startOfDay(date).getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

function startOfDay(value: Date) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function isDoneStatus(status: string | null | undefined) {
  return DONE_TASK_STATUSES.has((status ?? "").trim().toLowerCase());
}

function isAccountingClosed(status: string | null | undefined) {
  return CLOSED_ACCOUNTING_STATUSES.has((status ?? "").trim());
}

function projectLabel(project: ProjectSummary | null | undefined, fallback?: string | null) {
  if (project?.project_number && project?.name) {
    return `${project.project_number} ${project.name}`;
  }
  if (project?.name) return project.name;
  if (project?.project_number) return project.project_number;
  return fallback?.trim() || "No project linked";
}

function projectHref(projectId: number | null | undefined) {
  return projectId ? `/${projectId}/home` : "/projects";
}

function emailHref(projectId: number | null | undefined) {
  return projectId ? `/${projectId}/emails` : "/emails";
}

function assistantEmailHref(email: BrandonIntakeEmailRow) {
  if (email.project_id) return `/${email.project_id}/emails`;
  return "/emails?tab=brandon-queue";
}

function taskHref(projectId: number | null | undefined) {
  return projectId ? `/${projectId}/home` : "/tasks?scope=all";
}

function reportHref(projectId: number | null | undefined) {
  return projectId ? `/${projectId}/progress-reports` : "/progress-reports";
}

function percentage(value: number, total: number) {
  if (total <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((value / total) * 100)));
}

function truncate(value: string | null | undefined, length = 180) {
  const normalized = (value ?? "").replace(/\s+/g, " ").trim();
  if (!normalized) return null;
  return normalized.length > length
    ? `${normalized.slice(0, Math.max(0, length - 1)).trimEnd()}…`
    : normalized;
}

function emailPreview(email: BrandonEmailRow) {
  return truncate(email.body_text ?? email.body, 180) ?? "No preview available.";
}

function intakeEmailPreview(email: BrandonIntakeEmailRow) {
  return truncate(email.body_text ?? email.body, 150) ?? "No preview available.";
}

function taskSummary(task: BrandonTaskRow) {
  return truncate(task.description, 180) ?? "No task detail available.";
}

function reportSummary(report: ProgressReportAllListItem) {
  return (
    truncate(report.open_items, 140) ??
    truncate(report.upcoming_week_activities, 140) ??
    truncate(report.past_week_highlights, 140) ??
    "No report summary available."
  );
}

function alertToneClasses(severity: AlertItem["severity"]) {
  if (severity === "high") return "text-destructive";
  if (severity === "medium") return "text-foreground";
  return "text-muted-foreground";
}

function countSuppressedLearning(rows: BrandonAssistantReviewRow[]) {
  return rows.filter((row) =>
    (row.reviewer_note ?? "").trim().startsWith(BRANDON_LEARNING_SUPPRESSION_PREFIX),
  ).length;
}

function SectionHeader({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="space-y-1">
      <SectionRuleHeading label={title} />
      <p className="max-w-3xl text-sm text-muted-foreground">{description}</p>
    </div>
  )
}

export default async function BrandonDashboardPage() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <AppCapabilityAccessDenied
        title="Brandon Dashboard"
        description="Authentication required."
      />
    );
  }

  const access = await loadAppCapabilityAccessForUser(user.id);
  const canViewExecutive = access
    ? hasAppCapability(access, "view_executive_briefing")
    : false;
  const canViewAccounting = access
    ? hasAppCapability(access, "view_accounting")
    : false;

  if (!canViewExecutive) {
    return (
      <AppCapabilityAccessDenied
        title="Brandon Dashboard"
        description="Executive dashboard access required."
      />
    );
  }

  const allowedRecipient = OWNER_BRIEFING_RECIPIENTS.find((recipient) => {
    const currentEmail = (user.email ?? "").trim().toLowerCase();
    return (
      recipient.supabaseUserId === user.id ||
      recipient.email.trim().toLowerCase() === currentEmail
    );
  });

  if (!allowedRecipient) {
    return (
      <AppCapabilityAccessDenied
        title="Private Executive Dashboard"
        description="This dashboard is restricted to Brandon Clymer and Megan Harrison."
      />
    );
  }

  const db = createServiceClient();
  const intakeDb = createOutlookIntakeServiceClient();
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const monthStartIso = monthStart.toISOString().slice(0, 10);
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const seventyTwoHoursAgo = new Date();
  seventyTwoHoursAgo.setHours(seventyTwoHoursAgo.getHours() - 72);
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [emailsResult, assistantEmailsResult, assistantReviewsResult, tasksResult, reports] =
    await Promise.all([
    serviceDb.from("project_emails")
      .select(
        "id, project_id, subject, from_name, from_email, body, body_text, received_at, sent_at, created_at, has_attachments, is_starred, status",
      )
      .eq("mailbox_user_id", BRANDON_EMAIL)
      .is("deleted_at", null)
      .order("received_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(36),
    intakeDb
      .from("outlook_email_intake")
      .select(
        "id, project_id, subject, from_name, from_email, body, body_text, to_list, cc_list, mailbox_user_id, received_at, created_at, has_attachments, web_link",
      )
      .eq("mailbox_user_id", BRANDON_EMAIL)
      .is("deleted_at", null)
      .order("received_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(80),
    serviceDb.from("outlook_email_assistant_reviews")
      .select(
        "review_outcome, draft_body, assistant_action, assistant_priority, reviewer_note, created_at, intake_email_id, reviewer_email",
      )
      .eq("mailbox_user_id", BRANDON_EMAIL)
      .order("created_at", { ascending: false })
      .limit(60),
    serviceDb.from("tasks")
      .select(
        "id, title, description, status, priority, due_date, assignee_name, assignee_email, project_id, project_ids, source_system, created_at, updated_at",
      )
      .or(
        [
          `assignee_email.ilike.${BRANDON_EMAIL}`,
          "assignee_name.ilike.%Brandon Clymer%",
          "assignee_name.ilike.%Brandon%",
        ].join(","),
      )
      .order("due_date", { ascending: true, nullsFirst: false })
      .order("updated_at", { ascending: false })
      .limit(48),
    listAllProgressReports(),
  ]);

  if (emailsResult.error) {
    throw new Error(
      `Failed to load Brandon mailbox dashboard data: ${emailsResult.error.message}`,
    );
  }

  if (assistantEmailsResult.error) {
    throw new Error(
      `Failed to load Brandon assistant inbox data: ${assistantEmailsResult.error.message}`,
    );
  }

  if (assistantReviewsResult.error) {
    throw new Error(
      `Failed to load Brandon assistant review data: ${assistantReviewsResult.error.message}`,
    );
  }

  if (tasksResult.error) {
    throw new Error(
      `Failed to load Brandon task dashboard data: ${tasksResult.error.message}`,
    );
  }

  const emails = (emailsResult.data ?? []) as BrandonEmailRow[];
  const assistantEmails = (assistantEmailsResult.data ?? []) as BrandonIntakeEmailRow[];
  const assistantReviews = (assistantReviewsResult.data ?? []) as BrandonAssistantReviewRow[];
  const tasks = (tasksResult.data ?? []) as BrandonTaskRow[];
  const reportRows = reports.slice(0, 40);

  const projectIds = new Set<number>();
  for (const email of emails) {
    if (typeof email.project_id === "number") projectIds.add(email.project_id);
  }
  for (const email of assistantEmails) {
    if (typeof email.project_id === "number") projectIds.add(email.project_id);
  }
  for (const task of tasks) {
    if (typeof task.project_id === "number") projectIds.add(task.project_id);
    for (const id of task.project_ids ?? []) projectIds.add(id);
  }
  for (const report of reportRows) {
    if (typeof report.project?.id === "number") projectIds.add(report.project.id);
  }

  const projectsById = new Map<number, ProjectSummary>();
  if (projectIds.size > 0) {
    const { data: projectRows, error: projectsError } = await serviceDb.from("projects")
      .select("id, name, project_number")
      .in("id", Array.from(projectIds));

    if (projectsError) {
      throw new Error(
        `Failed to load project labels for Brandon dashboard: ${projectsError.message}`,
      );
    }

    for (const project of (projectRows ?? []) as ProjectSummary[]) {
      projectsById.set(project.id, project);
    }
  }

  const openTasks = tasks.filter((task) => !isDoneStatus(task.status));
  const overdueTasks = openTasks.filter((task) => {
    const dueDate = parseDate(task.due_date);
    return dueDate ? dueDate < startOfToday() : false;
  });
  const highPriorityOpenTasks = openTasks.filter((task) =>
    ["high", "critical", "urgent"].includes((task.priority ?? "").toLowerCase()),
  );

  const recentEmails = emails.filter((email) => {
    const activityAt = parseDate(email.received_at ?? email.sent_at ?? email.created_at);
    return activityAt ? activityAt >= sevenDaysAgo : false;
  });
  const hotEmails = emails.filter((email) => {
    const activityAt = parseDate(email.received_at ?? email.sent_at ?? email.created_at);
    return activityAt ? activityAt >= seventyTwoHoursAgo : false;
  });
  const starredEmails = emails.filter((email) => email.is_starred);
  const attachmentEmails = emails.filter((email) => email.has_attachments);
  const reviewedAssistantEmailIds = new Set(
    assistantReviews.map((review) => review.intake_email_id),
  );
  const assistantQueue: BrandonAssistantQueueItem[] = assistantEmails
    .map((email) => ({
      email,
      decision: deriveBrandonEmailAssistantDecision({
        subject: email.subject,
        bodyText: email.body_text ?? email.body,
        fromEmail: email.from_email,
        fromName: email.from_name,
        toList: email.to_list,
        ccList: email.cc_list,
        mailboxUserId: email.mailbox_user_id,
        hasAttachments: email.has_attachments,
        receivedAt: email.received_at,
      }),
    }))
    .filter((item) => item.decision.action !== "ignore")
    .sort((a, b) => {
      if (a.decision.score !== b.decision.score) {
        return b.decision.score - a.decision.score;
      }
      return (
        new Date(b.email.received_at ?? b.email.created_at ?? 0).getTime() -
        new Date(a.email.received_at ?? a.email.created_at ?? 0).getTime()
      );
    });
  const unreviewedAssistantQueue = assistantQueue.filter(
    (item) => !reviewedAssistantEmailIds.has(item.email.id),
  );
  const urgentAssistantQueue = unreviewedAssistantQueue.filter(
    (item) => item.decision.priority === "urgent" || item.decision.priority === "high",
  );
  const assistantReviewsLast30Days = assistantReviews.filter((review) => {
    const reviewedAt = parseDate(review.created_at);
    return reviewedAt ? reviewedAt >= thirtyDaysAgo : false;
  });
  const assistantDraftReviews = assistantReviewsLast30Days.filter(
    (review) =>
      review.review_outcome === "draft_copied" ||
      review.review_outcome === "draft_edited",
  );
  const assistantCorrections = countSuppressedLearning(assistantReviews);
  const assistantLearning = deriveBrandonDraftLearning(assistantReviews);

  const pendingReports = reportRows.filter((report) => report.status !== "sent");
  const recentSentReports = reportRows.filter((report) => {
    const sentAt = parseDate(report.sent_at);
    return sentAt ? sentAt >= sevenDaysAgo : false;
  });
  const staleDraftReports = pendingReports.filter((report) => {
    const updatedAt = parseDate(report.updated_at);
    return updatedAt ? daysBetween(updatedAt) >= 7 : false;
  });

  let accountingSummary:
    | {
        arOutstanding: number;
        apOutstanding: number;
        netPosition: number;
        paymentsThisMonth: number;
        checksThisMonth: number;
        ar90PlusCount: number;
        ar90PlusTotal: number;
        apOverdueCount: number;
        apOverdueTotal: number;
        topArProjects: Array<{
          label: string;
          projectId: number | null;
          total: number;
        }>;
        recentPayments: PaymentRow[];
        recentChecks: CheckRow[];
      }
    | null = null;

  if (canViewAccounting) {
    const [
      arResult,
      apResult,
      paymentsResult,
      checksResult,
      recentPaymentsResult,
      recentChecksResult,
    ] = await Promise.all([
      serviceDb.from("acumatica_ar_invoices")
        .select("balance, due_date, project, project_id, customer_name, status")
        .not("balance", "is", null),
      serviceDb.from("acumatica_ap_bills")
        .select("balance, due_date, approved_for_payment, status")
        .not("balance", "is", null),
      serviceDb.from("acumatica_payments")
        .select("payment_amount")
        .gte("application_date", monthStartIso),
      serviceDb.from("acumatica_checks")
        .select("payment_amount")
        .gte("application_date", monthStartIso),
      serviceDb.from("acumatica_payments")
        .select("payment_amount, application_date, customer_name, reference_nbr")
        .order("application_date", { ascending: false })
        .limit(5),
      serviceDb.from("acumatica_checks")
        .select("payment_amount, application_date, vendor_name, reference_nbr")
        .order("application_date", { ascending: false })
        .limit(5),
    ]);

    if (arResult.error) {
      throw new Error(`Failed to load AR dashboard data: ${arResult.error.message}`);
    }
    if (apResult.error) {
      throw new Error(`Failed to load AP dashboard data: ${apResult.error.message}`);
    }
    if (paymentsResult.error) {
      throw new Error(
        `Failed to load monthly payment totals: ${paymentsResult.error.message}`,
      );
    }
    if (checksResult.error) {
      throw new Error(
        `Failed to load monthly check totals: ${checksResult.error.message}`,
      );
    }
    if (recentPaymentsResult.error) {
      throw new Error(
        `Failed to load recent payments: ${recentPaymentsResult.error.message}`,
      );
    }
    if (recentChecksResult.error) {
      throw new Error(
        `Failed to load recent checks: ${recentChecksResult.error.message}`,
      );
    }

    const arRows = ((arResult.data ?? []) as AccountingInvoiceRow[]).filter(
      (row) => !isAccountingClosed(row.status),
    );
    const apRows = ((apResult.data ?? []) as AccountingBillRow[]).filter(
      (row) => !isAccountingClosed(row.status),
    );

    const arOutstanding = arRows.reduce(
      (sum, row) => sum + Number(row.balance ?? 0),
      0,
    );
    const apOutstanding = apRows.reduce(
      (sum, row) => sum + Number(row.balance ?? 0),
      0,
    );

    const ar90PlusRows = arRows.filter((row) => {
      const dueDate = parseDate(row.due_date);
      return dueDate ? daysBetween(dueDate) > 90 : false;
    });
    const apOverdueRows = apRows.filter((row) => {
      const dueDate = parseDate(row.due_date);
      return dueDate ? dueDate < startOfToday() : false;
    });

    const topArProjectTotals = new Map<
      string,
      { label: string; projectId: number | null; total: number }
    >();
    for (const row of arRows) {
      const key =
        row.project_id !== null && row.project_id !== undefined
          ? `project:${row.project_id}`
          : `label:${row.project ?? row.customer_name ?? "Unlinked"}`;
      const existing = topArProjectTotals.get(key);
      const label =
        row.project_id && projectsById.has(row.project_id)
          ? projectLabel(projectsById.get(row.project_id))
          : row.project?.trim() || row.customer_name?.trim() || "Unlinked receivable";
      topArProjectTotals.set(key, {
        label,
        projectId: row.project_id ?? null,
        total: (existing?.total ?? 0) + Number(row.balance ?? 0),
      });
    }

    accountingSummary = {
      arOutstanding,
      apOutstanding,
      netPosition: arOutstanding - apOutstanding,
      paymentsThisMonth: ((paymentsResult.data ?? []) as Array<{ payment_amount: number | null }>)
        .reduce((sum, row) => sum + Number(row.payment_amount ?? 0), 0),
      checksThisMonth: ((checksResult.data ?? []) as Array<{ payment_amount: number | null }>)
        .reduce((sum, row) => sum + Number(row.payment_amount ?? 0), 0),
      ar90PlusCount: ar90PlusRows.length,
      ar90PlusTotal: ar90PlusRows.reduce(
        (sum, row) => sum + Number(row.balance ?? 0),
        0,
      ),
      apOverdueCount: apOverdueRows.length,
      apOverdueTotal: apOverdueRows.reduce(
        (sum, row) => sum + Number(row.balance ?? 0),
        0,
      ),
      topArProjects: Array.from(topArProjectTotals.values())
        .sort((a, b) => b.total - a.total)
        .slice(0, 5),
      recentPayments: (recentPaymentsResult.data ?? []) as PaymentRow[],
      recentChecks: (recentChecksResult.data ?? []) as CheckRow[],
    };
  }

  const alerts: AlertItem[] = [];

  if (overdueTasks.length > 0) {
    alerts.push({
      id: "overdue-tasks",
      severity: "high",
      title: `${overdueTasks.length} overdue Brandon task${overdueTasks.length === 1 ? "" : "s"}`,
      detail: overdueTasks
        .slice(0, 2)
        .map((task) => task.title?.trim() || taskSummary(task))
        .join(" • "),
    });
  }

  if (starredEmails.length > 0) {
    alerts.push({
      id: "starred-emails",
      severity: "medium",
      title: `${starredEmails.length} starred email${starredEmails.length === 1 ? "" : "s"} in Brandon's mailbox`,
      detail: starredEmails
        .slice(0, 2)
        .map((email) => email.subject)
        .join(" • "),
    });
  }

  if (urgentAssistantQueue.length > 0) {
    alerts.push({
      id: "assistant-email-queue",
      severity: "high",
      title: `${urgentAssistantQueue.length} high-priority assistant email${urgentAssistantQueue.length === 1 ? "" : "s"} need review`,
      detail: urgentAssistantQueue
        .slice(0, 2)
        .map((item) => item.email.subject)
        .join(" • "),
    });
  }

  if (staleDraftReports.length > 0) {
    alerts.push({
      id: "stale-progress-reports",
      severity: "medium",
      title: `${staleDraftReports.length} progress report draft${staleDraftReports.length === 1 ? "" : "s"} are stale`,
      detail: staleDraftReports
        .slice(0, 2)
        .map((report) => projectLabel(report.project))
        .join(" • "),
    });
  }

  if (accountingSummary?.ar90PlusCount) {
    alerts.push({
      id: "aging-ar",
      severity: "high",
      title: `${accountingSummary.ar90PlusCount} receivable${accountingSummary.ar90PlusCount === 1 ? "" : "s"} are 90+ days past due`,
      detail: `${formatCurrency(accountingSummary.ar90PlusTotal)} is stuck in aging AR.`,
    });
  }

  if (accountingSummary?.apOverdueCount) {
    alerts.push({
      id: "overdue-ap",
      severity: "medium",
      title: `${accountingSummary.apOverdueCount} AP bill${accountingSummary.apOverdueCount === 1 ? "" : "s"} are overdue`,
      detail: `${formatCurrency(accountingSummary.apOverdueTotal)} needs payment planning.`,
    });
  }

  const topArMax = Math.max(
    ...(accountingSummary?.topArProjects.map((project) => project.total) ?? [0]),
  );

  return (
    <PageShell
      variant="dashboard"
      title="Brandon Dashboard"
    >
      <section className="space-y-4">
        <SectionHeader
          title="Alerts"
          description="Only the items that need Brandon attention or operator intervention."
        />
        {alerts.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
            No critical alerts right now.
          </div>
        ) : (
          <div className="divide-y divide-border rounded-lg border border-border/70">
            {alerts.map((alert) => (
              <div
                key={alert.id}
                className="flex items-start gap-3 px-4 py-4"
              >
                <AlertTriangle className={`mt-0.5 size-4 ${alertToneClasses(alert.severity)}`} />
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">{alert.title}</p>
                  <p className="text-sm text-muted-foreground">{alert.detail}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <SectionHeader
          title="Email Assistant"
          description="What the assistant is actively triaging for Brandon, what humans reviewed, and what changed its future drafts."
        />
        <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="space-y-4">
            <div className="grid grid-cols-2 divide-x divide-y divide-border overflow-hidden rounded-lg border border-border/70 sm:grid-cols-4 sm:divide-y-0">
              <Link
                href="/emails?tab=brandon-queue"
                className="space-y-1 px-4 py-4 transition-colors hover:bg-muted/30"
              >
                <p className="text-2xl font-semibold text-foreground">
                  {unreviewedAssistantQueue.length}
                </p>
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  Needs review
                </p>
              </Link>
              <Link
                href="/emails?tab=brandon-queue"
                className="space-y-1 px-4 py-4 transition-colors hover:bg-muted/30"
              >
                <p className="text-2xl font-semibold text-foreground">
                  {urgentAssistantQueue.length}
                </p>
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  High priority
                </p>
              </Link>
              <div className="space-y-1 px-4 py-4">
                <p className="text-2xl font-semibold text-foreground">
                  {assistantDraftReviews.length}
                </p>
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  Drafts reviewed
                </p>
              </div>
              <div className="space-y-1 px-4 py-4">
                <p className="text-2xl font-semibold text-foreground">
                  {assistantCorrections}
                </p>
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  Corrections saved
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-sm font-medium text-foreground">
                Guardrail status
              </p>
              <div className="divide-y divide-border rounded-lg border border-border/70">
                <div className="flex items-start justify-between gap-4 px-4 py-3 text-sm">
                  <span className="text-foreground">Outbound handling</span>
                  <span className="text-right text-muted-foreground">
                    Draft only; Brandon still reviews before Outlook send
                  </span>
                </div>
                <div className="flex items-start justify-between gap-4 px-4 py-3 text-sm">
                  <span className="text-foreground">Learning source</span>
                  <span className="text-right text-muted-foreground">
                    Human review ledger, not inbound email instructions
                  </span>
                </div>
                <div className="flex items-start justify-between gap-4 px-4 py-3 text-sm">
                  <span className="text-foreground">Correction loop</span>
                  <span className="text-right text-muted-foreground">
                    Not right suppresses the specific learning by stable ID
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-4">
                <p className="text-sm font-medium text-foreground">
                  Top review queue
                </p>
                <Link
                  href="/emails?tab=brandon-queue"
                  className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  Open queue
                </Link>
              </div>
              {unreviewedAssistantQueue.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border px-4 py-5 text-sm text-muted-foreground">
                  No assistant-prioritized Brandon emails need review.
                </div>
              ) : (
                <div className="divide-y divide-border rounded-lg border border-border/70">
                  {unreviewedAssistantQueue.slice(0, 5).map((item) => {
                    const project = item.email.project_id
                      ? projectsById.get(item.email.project_id)
                      : null;
                    return (
                      <Link
                        key={item.email.id}
                        href={assistantEmailHref(item.email)}
                        className="block px-4 py-4 transition-colors hover:bg-muted/30"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="space-y-1">
                            <p className="text-sm font-medium text-foreground">
                              {item.email.subject}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {item.email.from_name || item.email.from_email || "Unknown sender"} • {projectLabel(project)}
                            </p>
                            <p className="max-w-2xl text-sm text-foreground/85">
                              {item.decision.reason}
                            </p>
                            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                              {item.decision.action} • {item.decision.priority} • score {item.decision.score}
                            </p>
                          </div>
                          <p className="shrink-0 text-xs text-muted-foreground">
                            {formatDateTime(item.email.received_at ?? item.email.created_at)}
                          </p>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="space-y-3">
              <p className="text-sm font-medium text-foreground">
                Active draft learning
              </p>
              {assistantLearning.guidance.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border px-4 py-5 text-sm text-muted-foreground">
                  No reviewed Brandon drafts have produced a reusable drafting preference yet.
                </div>
              ) : (
                <div className="divide-y divide-border rounded-lg border border-border/70">
                  {(assistantLearning.guidanceItems ?? []).slice(0, 4).map((item) => (
                    <div key={item.id} className="px-4 py-3">
                      <p className="text-sm text-foreground">{item.text}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-10 xl:grid-cols-2">
        <div className="space-y-4">
          <SectionHeader
            title="Brandon Inbox"
            description="The most recent messages, with enough context to decide what matters without leaving the page."
          />
          <div className="divide-y divide-border rounded-lg border border-border/70">
            {emails.slice(0, 10).map((email) => {
              const project = projectsById.get(email.project_id);
              const activityAt = email.received_at ?? email.sent_at ?? email.created_at;
              return (
                <Link
                  key={email.id}
                  href={emailHref(email.project_id)}
                  className="block px-4 py-4 transition-colors hover:bg-muted/30"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-foreground">
                        {email.subject}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {email.from_name || email.from_email || "Unknown sender"}
                      </p>
                      <p className="max-w-2xl text-sm text-foreground/85">
                        {emailPreview(email)}
                      </p>
                      <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                        {projectLabel(project)} {email.is_starred ? "• starred" : ""}{" "}
                        {email.has_attachments ? "• attachments" : ""}
                      </p>
                    </div>
                    <p className="shrink-0 text-xs text-muted-foreground">
                      {formatDateTime(activityAt)}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        <div className="space-y-4">
          <SectionHeader
            title="Task Pressure"
            description="The task list itself, with why each item exists and what is already overdue."
          />
          <div className="divide-y divide-border rounded-lg border border-border/70">
            {(overdueTasks.length > 0 ? overdueTasks : openTasks).slice(0, 10).map((task) => {
              const primaryProjectId = task.project_id ?? task.project_ids?.[0] ?? null;
              const project = primaryProjectId ? projectsById.get(primaryProjectId) : null;
              const dueDate = parseDate(task.due_date);
              const ageText = dueDate
                ? dueDate < startOfToday()
                  ? `${daysBetween(dueDate)}d overdue`
                  : `Due ${formatDate(task.due_date)}`
                : "No due date";
              return (
                <Link
                  key={task.id}
                  href={taskHref(primaryProjectId)}
                  className="block px-4 py-4 transition-colors hover:bg-muted/30"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-foreground">
                        {task.title?.trim() || task.description.trim()}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {projectLabel(project)}
                      </p>
                      <p className="max-w-2xl text-sm text-foreground/85">
                        {taskSummary(task)}
                      </p>
                      <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                        {task.status} {task.priority ? `• ${task.priority}` : ""} • {task.source_system}
                      </p>
                    </div>
                    <p className="shrink-0 text-xs text-muted-foreground">{ageText}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      <section className="grid gap-10 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="space-y-4">
          <SectionHeader
            title="Progress Reports"
            description="Live report content, so Brandon can see what is being said to clients instead of just seeing report counts."
          />
          <div className="divide-y divide-border rounded-lg border border-border/70">
            {reportRows.slice(0, 8).map((report) => (
              <Link
                key={report.id}
                href={reportHref(report.project.id)}
                className="block px-4 py-4 transition-colors hover:bg-muted/30"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-foreground">
                      {projectLabel(report.project)}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {report.title || `${formatDate(report.week_start)} - ${formatDate(report.week_end)}`}
                    </p>
                    <p className="max-w-2xl text-sm text-foreground/85">
                      {reportSummary(report)}
                    </p>
                    <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                      {report.status} • week ending {formatDate(report.week_end)} • {report.selected_photo_count} photos
                    </p>
                  </div>
                  <p className="shrink-0 text-xs text-muted-foreground">
                    {report.sent_at ? `Sent ${formatDate(report.sent_at)}` : `Updated ${formatDate(report.updated_at)}`}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <SectionHeader
            title="Accounting"
            description={
              accountingSummary
                ? "Current cash position, biggest receivable exposure, and recent movement."
                : "Cash position, collections pressure, and recent money movement worth putting in front of Brandon."
            }
          />
          {!accountingSummary ? (
            <div className="rounded-lg border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
              Accounting visibility is disabled for this account. The dashboard fails
              loudly here instead of pretending that money is fine.
            </div>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                {accountingSummary.ar90PlusCount} receivable
                {accountingSummary.ar90PlusCount === 1 ? "" : "s"} are 90+ days
                late totaling {formatCurrency(accountingSummary.ar90PlusTotal)}.{" "}
                {accountingSummary.apOverdueCount} AP bill
                {accountingSummary.apOverdueCount === 1 ? "" : "s"} are overdue
                totaling {formatCurrency(accountingSummary.apOverdueTotal)}. This
                month has brought in {formatCurrency(accountingSummary.paymentsThisMonth)}
                {" "}and paid out {formatCurrency(accountingSummary.checksThisMonth)}.
              </p>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      Top AR exposure by project
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Largest receivable balances driving collections risk
                    </p>
                  </div>
                  <Banknote className="size-4 text-muted-foreground" />
                </div>
                <div className="space-y-3">
                  {accountingSummary.topArProjects.map((project) => (
                    <Link
                      key={`${project.projectId ?? "none"}-${project.label}`}
                      href={project.projectId ? projectHref(project.projectId) : "/financial-insights"}
                      className="block space-y-1"
                    >
                      <div className="flex items-center justify-between gap-4 text-sm">
                        <span className="truncate text-foreground">{project.label}</span>
                        <span className="shrink-0 text-muted-foreground">
                          {formatCurrency(project.total)}
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-muted">
                        <div
                          className="h-2 rounded-full bg-primary"
                          style={{ width: `${percentage(project.total, topArMax)}%` }}
                        />
                      </div>
                    </Link>
                  ))}
                </div>
              </div>

              <div className="grid gap-8 lg:grid-cols-2">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-foreground">Recent payments</p>
                    <BriefcaseBusiness className="size-4 text-muted-foreground" />
                  </div>
                  <div className="space-y-3">
                    {accountingSummary.recentPayments.map((payment) => (
                      <div key={payment.reference_nbr} className="flex items-start justify-between gap-4 border-b border-border pb-3 text-sm last:border-b-0 last:pb-0">
                        <div>
                          <p className="font-medium text-foreground">{payment.reference_nbr}</p>
                          <p className="text-muted-foreground">
                            {payment.customer_name || "Unknown customer"} • {formatDate(payment.application_date)}
                          </p>
                        </div>
                        <p className="shrink-0 text-muted-foreground">
                          {formatCurrency(Number(payment.payment_amount ?? 0))}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-foreground">Recent checks</p>
                    <Banknote className="size-4 text-muted-foreground" />
                  </div>
                  <div className="space-y-3">
                    {accountingSummary.recentChecks.map((check) => (
                      <div key={check.reference_nbr} className="flex items-start justify-between gap-4 border-b border-border pb-3 text-sm last:border-b-0 last:pb-0">
                        <div>
                          <p className="font-medium text-foreground">{check.reference_nbr}</p>
                          <p className="text-muted-foreground">
                            {check.vendor_name || "Unknown vendor"} • {formatDate(check.application_date)}
                          </p>
                        </div>
                        <p className="shrink-0 text-muted-foreground">
                          {formatCurrency(Number(check.payment_amount ?? 0))}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </section>
    </PageShell>
  );
}
