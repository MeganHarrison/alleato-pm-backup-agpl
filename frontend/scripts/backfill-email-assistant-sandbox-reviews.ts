#!/usr/bin/env tsx

import { resolve } from "node:path";
import process from "node:process";
import { generateText } from "ai";
import * as dotenv from "dotenv";

import {
  createOutlookIntakeServiceClient,
  createServiceClient,
} from "../src/lib/supabase/service";
import { getLanguageModel } from "../src/lib/ai/providers";
import {
  deriveBrandonEmailAssistantDecision,
  type BrandonAssistantAction,
  type BrandonAssistantPriority,
} from "../src/lib/email-assistant/brandon-triage";
import {
  deriveBrandonDraftLearning,
  formatBrandonDraftLearningGuidance,
  type BrandonAssistantReviewLearningRow,
} from "../src/lib/email-assistant/brandon-learning";

const SCRIPT_NAME = "backfill-email-assistant-sandbox-reviews";
const SCRIPT_VERSION = "2026-06-30.1";
const DEFAULT_MAILBOX = "bclymer@alleatogroup.com";
const DEFAULT_TIME_ZONE = "America/New_York";
const DEFAULT_MODEL = "gpt-5.5";

for (const envPath of [
  resolve(process.cwd(), "../.env"),
  resolve(process.cwd(), ".env"),
  resolve(process.cwd(), ".env.local"),
]) {
  dotenv.config({ path: envPath, override: false });
}

type ReviewOutcome =
  | "draft_copied"
  | "draft_edited"
  | "skipped"
  | "delegated"
  | "watched"
  | "marked_no_action";

type DraftKind = "email_reply" | "delegation_note" | "none";

type JsonRecord = Record<string, unknown>;

interface Options {
  date: string;
  mailbox: string;
  timeZone: string;
  limit: number | null;
  write: boolean;
  includeReviewed: boolean;
  model: string;
  json: boolean;
}

interface IntakeRow {
  id: number;
  graph_message_id: string;
  mailbox_user_id: string;
  project_id: number | null;
  subject: string;
  body: string | null;
  body_text: string | null;
  from_name: string | null;
  from_email: string | null;
  to_list: string[] | null;
  cc_list: string[] | null;
  received_at: string | null;
  has_attachments: boolean | null;
  conversation_id: string | null;
  web_link: string | null;
}

interface ReviewRow {
  id: string;
  intake_email_id: number;
  assistant_action: BrandonAssistantAction;
  assistant_priority: BrandonAssistantPriority;
  review_outcome: ReviewOutcome;
  draft_body: string | null;
  source_metadata: unknown;
  created_at: string;
}

interface ProjectRow {
  id: number;
  name: string | null;
  project_number: string | null;
}

interface BackfillMetadata {
  script: string;
  version: string;
  runId: string;
  sourceDate: string;
  generatedAt: string;
  model: string;
  draftKind: DraftKind;
  mailboxMutationEnabled: false;
}

function parseArgs(argv: string[]): Options {
  const args = new Map<string, string | boolean>();
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) continue;
    const [key, inlineValue] = arg.split("=");
    if (inlineValue !== undefined) {
      args.set(key, inlineValue);
      continue;
    }
    const next = argv[index + 1];
    if (next && !next.startsWith("--")) {
      args.set(key, next);
      index += 1;
    } else {
      args.set(key, true);
    }
  }

  const date = String(args.get("--date") ?? currentDateInTimeZone(DEFAULT_TIME_ZONE));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error(`Invalid --date "${date}". Expected YYYY-MM-DD.`);
  }

  const rawLimit = args.get("--limit");
  const limit =
    rawLimit === undefined ? null : Number.parseInt(String(rawLimit), 10);
  if (limit !== null && (!Number.isFinite(limit) || limit < 1)) {
    throw new Error(`Invalid --limit "${String(rawLimit)}". Expected a positive integer.`);
  }

  return {
    date,
    mailbox: String(args.get("--mailbox") ?? DEFAULT_MAILBOX).trim().toLowerCase(),
    timeZone: String(args.get("--time-zone") ?? DEFAULT_TIME_ZONE),
    limit,
    write: args.get("--write") === true || args.get("--write") === "true",
    includeReviewed:
      args.get("--include-reviewed") === true ||
      args.get("--include-reviewed") === "true",
    model: String(args.get("--model") ?? DEFAULT_MODEL).trim(),
    json: args.get("--json") === true || args.get("--json") === "true",
  };
}

function currentDateInTimeZone(timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function dayBounds(date: string, timeZone: string): { startIso: string; endIso: string } {
  const previousTimeZone = process.env.TZ;
  process.env.TZ = timeZone;
  try {
    const start = new Date(`${date}T00:00:00`);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return { startIso: start.toISOString(), endIso: end.toISOString() };
  } finally {
    if (previousTimeZone === undefined) {
      delete process.env.TZ;
    } else {
      process.env.TZ = previousTimeZone;
    }
  }
}

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};
}

function sandboxBackfillMetadata(value: unknown): JsonRecord {
  return asRecord(asRecord(value).sandboxBackfill);
}

function isSameSandboxBackfill(value: unknown, date: string): boolean {
  const metadata = sandboxBackfillMetadata(value);
  return metadata.script === SCRIPT_NAME && metadata.sourceDate === date;
}

function defaultAssistantCategory(action: BrandonAssistantAction): string {
  switch (action) {
    case "reply":
      return "Reply Needed";
    case "delegate":
      return "To Delegate";
    case "watch":
      return "Watching";
    case "ignore":
      return "No Action";
  }
}

function reviewOutcomeForAction(action: BrandonAssistantAction): ReviewOutcome {
  switch (action) {
    case "reply":
      return "draft_edited";
    case "delegate":
      return "delegated";
    case "watch":
      return "watched";
    case "ignore":
      return "marked_no_action";
  }
}

function draftKindForAction(action: BrandonAssistantAction): DraftKind {
  if (action === "reply") return "email_reply";
  if (action === "delegate") return "delegation_note";
  return "none";
}

function compactText(value: string | null | undefined, maxLength: number): string {
  return (value ?? "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function buildSystemPrompt({
  action,
  projectName,
  learningGuidance,
}: {
  action: BrandonAssistantAction;
  projectName: string | null;
  learningGuidance: string;
}): string {
  const projectContext = projectName
    ? `\nThis email is related to project: ${projectName}.`
    : "";
  const actionInstruction =
    action === "reply"
      ? "Write only the outbound email reply body Brandon could review. No subject line, no headers, no markdown."
      : "Write a concise internal delegation note that explains who should own the follow-up and what needs to happen. No subject line, no headers, no markdown.";

  return `You are a construction project management assistant drafting sandbox output for Brandon Clymer at Alleato Group.${projectContext}

This is a testing backfill. Do not claim that anything has been sent, categorized, archived, or changed in Outlook.
${actionInstruction}
Be short, direct, grounded in the email text, and ask for confirmation instead of inventing missing cost, scope, schedule, owner, or attachment facts.
${learningGuidance ? `\n${learningGuidance}` : ""}`;
}

async function generateSandboxDraft({
  email,
  action,
  projectName,
  learningGuidance,
  model,
}: {
  email: IntakeRow;
  action: BrandonAssistantAction;
  projectName: string | null;
  learningGuidance: string;
  model: string;
}): Promise<string | null> {
  const draftKind = draftKindForAction(action);
  if (draftKind === "none") return null;

  const { text } = await generateText({
    model: getLanguageModel(model),
    system: buildSystemPrompt({ action, projectName, learningGuidance }),
    prompt: `From: ${email.from_name ?? email.from_email ?? "Unknown sender"}
Subject: ${email.subject || "(no subject)"}
Received: ${email.received_at ?? "unknown"}
Assistant action: ${action}

Email body:
---
${compactText(email.body_text ?? email.body, 3500) || "(no body)"}
---`,
    maxOutputTokens: action === "reply" ? 500 : 300,
  });

  return text.trim() || null;
}

async function loadTodayEmails(options: Options): Promise<IntakeRow[]> {
  const { startIso, endIso } = dayBounds(options.date, options.timeZone);
  let query = createOutlookIntakeServiceClient()
    .from("outlook_email_intake")
    .select(
      "id,graph_message_id,mailbox_user_id,project_id,subject,body,body_text,from_name,from_email,to_list,cc_list,received_at,has_attachments,conversation_id,web_link",
    )
    .eq("mailbox_user_id", options.mailbox)
    .gte("received_at", startIso)
    .lt("received_at", endIso)
    .is("deleted_at", null)
    .order("received_at", { ascending: true });

  if (options.limit !== null) query = query.limit(options.limit);

  const { data, error } = await query;
  if (error) {
    throw new Error(`Failed to load Outlook intake rows: ${error.message}`);
  }
  return (data ?? []) as IntakeRow[];
}

async function loadProjects(projectIds: number[]): Promise<Map<number, ProjectRow>> {
  if (projectIds.length === 0) return new Map();
  const { data, error } = await createServiceClient()
    .from("projects")
    .select("id,name,project_number")
    .in("id", projectIds);

  if (error) throw new Error(`Failed to load projects: ${error.message}`);
  return new Map((data ?? []).map((project) => [project.id, project as ProjectRow]));
}

async function loadReviews(emailIds: number[]): Promise<Map<number, ReviewRow[]>> {
  if (emailIds.length === 0) return new Map();
  const { data, error } = await createServiceClient()
    .from("outlook_email_assistant_reviews")
    .select(
      "id,intake_email_id,assistant_action,assistant_priority,review_outcome,draft_body,source_metadata,created_at",
    )
    .in("intake_email_id", emailIds)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Failed to load existing assistant reviews: ${error.message}`);

  const byEmail = new Map<number, ReviewRow[]>();
  for (const row of (data ?? []) as ReviewRow[]) {
    byEmail.set(row.intake_email_id, [...(byEmail.get(row.intake_email_id) ?? []), row]);
  }
  return byEmail;
}

async function loadLearningRows(): Promise<BrandonAssistantReviewLearningRow[]> {
  const { data, error } = await createServiceClient()
    .from("outlook_email_assistant_reviews")
    .select(
      "review_outcome,draft_body,assistant_action,assistant_priority,reviewer_note,created_at",
    )
    .eq("mailbox_user_id", DEFAULT_MAILBOX)
    .order("created_at", { ascending: false })
    .limit(25);

  if (error) throw new Error(`Failed to load Brandon draft learning rows: ${error.message}`);
  return (data ?? []) as BrandonAssistantReviewLearningRow[];
}

function mergeSourceMetadata({
  existing,
  category,
  backfill,
}: {
  existing: unknown;
  category: string;
  backfill: BackfillMetadata;
}): JsonRecord {
  return {
    ...asRecord(existing),
    sandboxCategory: category,
    feedbackProvidedAt: backfill.generatedAt,
    feedbackProvidedBy: "codex-email-assistant-sandbox-backfill",
    sandboxBackfill: backfill,
  };
}

async function writeReview({
  email,
  existingSandboxReview,
  payload,
}: {
  email: IntakeRow;
  existingSandboxReview: ReviewRow | null;
  payload: JsonRecord;
}): Promise<"inserted" | "updated"> {
  const client = createServiceClient();
  if (existingSandboxReview) {
    const { error } = await client
      .from("outlook_email_assistant_reviews")
      .update(payload)
      .eq("id", existingSandboxReview.id);
    if (error) {
      throw new Error(
        `Failed to update sandbox review for intake_email_id=${email.id}: ${error.message}`,
      );
    }
    return "updated";
  }

  const { error } = await client.from("outlook_email_assistant_reviews").insert(payload);
  if (error) {
    throw new Error(
      `Failed to insert sandbox review for intake_email_id=${email.id}: ${error.message}`,
    );
  }
  return "inserted";
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const runId = `${SCRIPT_NAME}-${options.date}-${new Date()
    .toISOString()
    .replace(/[-:.TZ]/g, "")
    .slice(0, 14)}`;
  const emails = await loadTodayEmails(options);
  const emailIds = emails.map((email) => email.id);
  const reviewsByEmail = await loadReviews(emailIds);
  const projectIds = Array.from(
    new Set(emails.map((email) => email.project_id).filter((id): id is number => id !== null)),
  );
  const projects = await loadProjects(projectIds);
  const learningRows = options.write ? await loadLearningRows() : [];
  const learningGuidance = options.write
    ? formatBrandonDraftLearningGuidance(deriveBrandonDraftLearning(learningRows))
    : "";

  const summary = {
    runId,
    date: options.date,
    mailbox: options.mailbox,
    mode: options.write ? "write" : "dry-run",
    model: options.model,
    targetEmails: emails.length,
    skippedExistingHumanReview: 0,
    plannedInserts: 0,
    plannedUpdates: 0,
    inserted: 0,
    updated: 0,
    generatedDrafts: 0,
    noDraftNeeded: 0,
    failures: [] as string[],
    samples: [] as Array<{
      intakeEmailId: number;
      subject: string;
      action: BrandonAssistantAction;
      priority: BrandonAssistantPriority;
      category: string;
      draftKind: DraftKind;
      writePlan: "insert" | "update" | "skip";
    }>,
  };

  for (const email of emails) {
    const reviews = reviewsByEmail.get(email.id) ?? [];
    const existingSandboxReview =
      reviews.find((review) => isSameSandboxBackfill(review.source_metadata, options.date)) ??
      null;
    const hasHumanOrOtherReview = reviews.some(
      (review) => !isSameSandboxBackfill(review.source_metadata, options.date),
    );

    const decision = deriveBrandonEmailAssistantDecision({
      subject: email.subject,
      bodyText: email.body_text ?? email.body,
      fromEmail: email.from_email,
      fromName: email.from_name,
      toList: email.to_list,
      ccList: email.cc_list,
      mailboxUserId: email.mailbox_user_id,
      hasAttachments: email.has_attachments,
      receivedAt: email.received_at,
    });
    const category = defaultAssistantCategory(decision.action);
    const draftKind = draftKindForAction(decision.action);
    const writePlan = existingSandboxReview ? "update" : "insert";

    if (hasHumanOrOtherReview && !existingSandboxReview && !options.includeReviewed) {
      summary.skippedExistingHumanReview += 1;
      summary.samples.push({
        intakeEmailId: email.id,
        subject: email.subject,
        action: decision.action,
        priority: decision.priority,
        category,
        draftKind,
        writePlan: "skip",
      });
      continue;
    }

    if (existingSandboxReview) summary.plannedUpdates += 1;
    else summary.plannedInserts += 1;

    summary.samples.push({
      intakeEmailId: email.id,
      subject: email.subject,
      action: decision.action,
      priority: decision.priority,
      category,
      draftKind,
      writePlan,
    });

    if (!options.write) continue;

    try {
      const project = email.project_id === null ? null : projects.get(email.project_id) ?? null;
      const draftBody = await generateSandboxDraft({
        email,
        action: decision.action,
        projectName: project?.name ?? null,
        learningGuidance,
        model: options.model,
      });
      if (draftBody) summary.generatedDrafts += 1;
      else summary.noDraftNeeded += 1;

      const generatedAt = new Date().toISOString();
      const backfill: BackfillMetadata = {
        script: SCRIPT_NAME,
        version: SCRIPT_VERSION,
        runId,
        sourceDate: options.date,
        generatedAt,
        model: options.model,
        draftKind,
        mailboxMutationEnabled: false,
      };
      const sourceMetadata = mergeSourceMetadata({
        existing: existingSandboxReview?.source_metadata,
        category,
        backfill,
      });
      const reviewerNote = [
        "Sandbox backfill generated this assistant review.",
        "No Outlook draft, category, send, archive, move, or mark-read operation was performed.",
        draftKind === "none"
          ? "No outbound draft was recommended for this action."
          : `Draft kind: ${draftKind}.`,
      ].join(" ");
      const payload: JsonRecord = {
        intake_email_id: email.id,
        graph_message_id: email.graph_message_id,
        mailbox_user_id: email.mailbox_user_id,
        reviewer_id: null,
        reviewer_email: "codex-email-assistant-sandbox-backfill",
        assistant_action: decision.action,
        assistant_priority: decision.priority,
        assistant_score: decision.score,
        review_outcome: reviewOutcomeForAction(decision.action),
        draft_body: draftBody,
        reviewer_note: reviewerNote,
        assistant_reason: decision.reason,
        assistant_owner: decision.owner,
        assistant_risk: decision.risk,
        assistant_evidence: decision.evidence,
        source_metadata: sourceMetadata,
      };

      const result = await writeReview({ email, existingSandboxReview, payload });
      if (result === "inserted") summary.inserted += 1;
      else summary.updated += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      summary.failures.push(`intake_email_id=${email.id}: ${message}`);
    }
  }

  if (options.json) {
    console.log(JSON.stringify(summary, null, 2));
  } else {
    console.log(`${SCRIPT_NAME} ${summary.mode}`);
    console.log(`runId=${summary.runId}`);
    console.log(`date=${summary.date} mailbox=${summary.mailbox}`);
    console.log(`targetEmails=${summary.targetEmails}`);
    console.log(
      `plannedInserts=${summary.plannedInserts} plannedUpdates=${summary.plannedUpdates} skippedExistingHumanReview=${summary.skippedExistingHumanReview}`,
    );
    console.log(
      `inserted=${summary.inserted} updated=${summary.updated} generatedDrafts=${summary.generatedDrafts} noDraftNeeded=${summary.noDraftNeeded}`,
    );
    if (summary.failures.length > 0) {
      console.log("failures:");
      for (const failure of summary.failures) console.log(`- ${failure}`);
    }
    console.log("samples:");
    for (const sample of summary.samples.slice(0, 10)) {
      console.log(
        `- #${sample.intakeEmailId} ${sample.action}/${sample.priority}/${sample.category}/${sample.draftKind}/${sample.writePlan}: ${sample.subject}`,
      );
    }
  }

  if (summary.failures.length > 0) process.exitCode = 1;
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`${SCRIPT_NAME} failed: ${message}`);
  process.exitCode = 1;
});
