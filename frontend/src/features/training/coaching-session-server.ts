import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { GuardrailError } from "@/lib/guardrails/errors";
import type { Database, Json } from "@/types/database.types";

import {
  COACHING_CYCLES,
  COACHING_STATUSES,
  calibrationEntrySchema,
  coachingReviewDates,
  managerPrepSchema,
  practiceRepSchema,
  publishCoachingSessionSchema,
  saveCoachingDraftSchema,
  type CalibrationEntry,
  type CoachingCycle,
  type CoachingSession,
  type CoachingStatus,
  type EmployeeCoachingView,
  type ManagerCoachingView,
  type ManagerPrep,
  type PracticeRep,
  type PublishCoachingSessionInput,
  type SaveCoachingDraftInput,
} from "./coaching-session";
import {
  parseSkillPlanSnapshots,
  skillDateKey,
  skillScoreSnapshotsSchema,
  type SkillCheckin,
} from "./skill-growth";

type CheckinRow =
  Database["public"]["Tables"]["training_skill_checkin"]["Row"];
type SessionRow =
  Database["public"]["Tables"]["training_coaching_session"]["Row"];
type SessionInsert =
  Database["public"]["Tables"]["training_coaching_session"]["Insert"];
type SessionUpdate =
  Database["public"]["Tables"]["training_coaching_session"]["Update"];
type ManagerPrepRow =
  Database["public"]["Tables"]["training_coaching_manager_prep"]["Row"];

/** Role-tagged view returned by getView so the API can serialize either side. */
export type CoachingView =
  | ({ role: "manager" } & ManagerCoachingView)
  | ({ role: "employee" } & EmployeeCoachingView);

const SESSION_COLUMNS =
  "id,manager_user_id,employee_user_id,role_id,role_context_key,source_checkin_id,meeting_id,cycle,status,current_step,calibration,focus_skill_ids,practice_plan,stop_doing,manager_support,assessment_shared_at,published_at,employee_confirmed_at,review_30_date,review_60_date,review_90_date,created_at,updated_at" as const;
const CHECKIN_COLUMNS =
  "id,role_id,role_name,checkin_date,scores,quarter_label,feedback_person,feedback_frequency,rescore_days,next_checkin_date,make_time_by,skill_plans,created_at,updated_at" as const;

function databaseFailure(
  operation: string,
  cause: unknown,
): GuardrailError {
  return new GuardrailError({
    code: "INTERNAL_ERROR",
    where: `training.coaching.${operation}`,
    message:
      "The coaching session could not be loaded or saved. Refresh and try again.",
    cause,
  });
}

function coerceCycle(value: string): CoachingCycle {
  return (COACHING_CYCLES as readonly string[]).includes(value)
    ? (value as CoachingCycle)
    : "new";
}

function coerceStatus(value: string): CoachingStatus {
  return (COACHING_STATUSES as readonly string[]).includes(value)
    ? (value as CoachingStatus)
    : "draft";
}

function parseCalibration(value: Json): CalibrationEntry[] {
  const parsed = calibrationEntrySchema.array().safeParse(value);
  return parsed.success ? parsed.data : [];
}

function parsePracticePlan(value: Json): PracticeRep[] {
  const parsed = practiceRepSchema.array().safeParse(value);
  return parsed.success ? parsed.data : [];
}

function mapSession(row: SessionRow): CoachingSession {
  return {
    id: row.id,
    managerUserId: row.manager_user_id,
    employeeUserId: row.employee_user_id,
    roleId: row.role_id,
    roleContextKey: row.role_context_key,
    sourceCheckinId: row.source_checkin_id,
    meetingId: row.meeting_id,
    cycle: coerceCycle(row.cycle),
    status: coerceStatus(row.status),
    currentStep: row.current_step,
    calibration: parseCalibration(row.calibration),
    focusSkillIds: row.focus_skill_ids ?? [],
    practicePlan: parsePracticePlan(row.practice_plan),
    stopDoing: row.stop_doing,
    managerSupport: row.manager_support,
    assessmentSharedAt: row.assessment_shared_at,
    publishedAt: row.published_at,
    employeeConfirmedAt: row.employee_confirmed_at,
    review30Date: row.review_30_date,
    review60Date: row.review_60_date,
    review90Date: row.review_90_date,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapCheckin(row: CheckinRow): SkillCheckin {
  const scores = skillScoreSnapshotsSchema.safeParse(row.scores);
  let plans;
  try {
    plans = parseSkillPlanSnapshots(row.skill_plans);
  } catch {
    plans = null;
  }
  if (!scores.success || !plans) {
    throw new GuardrailError({
      code: "SCHEMA_MISMATCH",
      where: "training.coaching.mapCheckin",
      message: "The shared assessment snapshot is invalid.",
      details: { checkinId: row.id },
    });
  }
  return {
    id: row.id,
    roleId: row.role_id,
    roleName: row.role_name,
    checkinDate: row.checkin_date,
    scores: scores.data,
    quarterLabel: row.quarter_label,
    feedbackPerson: row.feedback_person,
    feedbackFrequency: row.feedback_frequency,
    rescoreDays: row.rescore_days as 30 | 60 | 90,
    nextCheckinDate: row.next_checkin_date,
    makeTimeBy: row.make_time_by,
    plans,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createCoachingDataAccess(
  baseClient: SupabaseClient<Database>,
  userId: string,
) {
  const client = baseClient;

  async function listForManager(): Promise<CoachingSession[]> {
    const result = await client
      .from("training_coaching_session")
      .select(SESSION_COLUMNS)
      .eq("manager_user_id", userId)
      .order("updated_at", { ascending: false });
    if (result.error) throw databaseFailure("listForManager", result.error);
    return (result.data ?? []).map((row) =>
      mapSession(row as SessionRow),
    );
  }

  async function listForEmployee(): Promise<CoachingSession[]> {
    const result = await client
      .from("training_coaching_session")
      .select(SESSION_COLUMNS)
      .eq("employee_user_id", userId)
      .order("updated_at", { ascending: false });
    if (result.error) throw databaseFailure("listForEmployee", result.error);
    return (result.data ?? []).map((row) =>
      mapSession(row as SessionRow),
    );
  }

  async function readSession(sessionId: string): Promise<CoachingSession> {
    const result = await client
      .from("training_coaching_session")
      .select(SESSION_COLUMNS)
      .eq("id", sessionId)
      .maybeSingle();
    if (result.error) throw databaseFailure("readSession", result.error);
    if (!result.data) {
      throw new GuardrailError({
        code: "NOT_FOUND",
        where: "training.coaching.readSession",
        message: "That coaching session does not exist or is not visible to you.",
      });
    }
    return mapSession(result.data as SessionRow);
  }

  async function readManagerPrep(sessionId: string): Promise<ManagerPrep> {
    const result = await client
      .from("training_coaching_manager_prep")
      .select("content")
      .eq("session_id", sessionId)
      .maybeSingle();
    if (result.error) throw databaseFailure("readManagerPrep", result.error);
    const content = (result.data as Pick<
      ManagerPrepRow,
      "content"
    > | null)?.content;
    const parsed = managerPrepSchema.safeParse(content ?? {});
    return parsed.success ? parsed.data : managerPrepSchema.parse({});
  }

  async function readSharedAssessment(
    session: CoachingSession,
  ): Promise<SkillCheckin | null> {
    if (!session.sourceCheckinId || !session.assessmentSharedAt) return null;
    const result = await client
      .from("training_skill_checkin")
      .select(CHECKIN_COLUMNS)
      .eq("id", session.sourceCheckinId)
      .maybeSingle();
    if (result.error) throw databaseFailure("readSharedAssessment", result.error);
    if (!result.data) return null;
    return mapCheckin(result.data as CheckinRow);
  }

  async function getManagerView(
    sessionId: string,
  ): Promise<ManagerCoachingView> {
    const session = await readSession(sessionId);
    if (session.managerUserId !== userId) {
      throw new GuardrailError({
        code: "FORBIDDEN",
        where: "training.coaching.getManagerView",
        message: "Only the coaching manager can open this workspace.",
      });
    }
    const [managerPrep, assessment] = await Promise.all([
      readManagerPrep(sessionId),
      readSharedAssessment(session),
    ]);
    return { session, managerPrep, assessment };
  }

  async function getEmployeeView(
    sessionId: string,
  ): Promise<EmployeeCoachingView> {
    const session = await readSession(sessionId);
    if (session.employeeUserId !== userId) {
      throw new GuardrailError({
        code: "FORBIDDEN",
        where: "training.coaching.getEmployeeView",
        message: "This coaching session is not addressed to you.",
      });
    }
    return { session };
  }

  async function getView(sessionId: string): Promise<CoachingView> {
    const session = await readSession(sessionId);
    if (session.managerUserId === userId) {
      const [managerPrep, assessment] = await Promise.all([
        readManagerPrep(sessionId),
        readSharedAssessment(session),
      ]);
      return { role: "manager", session, managerPrep, assessment };
    }
    if (session.employeeUserId === userId) {
      return { role: "employee", session };
    }
    throw new GuardrailError({
      code: "FORBIDDEN",
      where: "training.coaching.getView",
      message: "This coaching session is not visible to you.",
    });
  }

  async function createSession(input: {
    employeeUserId: string;
    roleId: string | null;
    roleContextKey: string;
    cycle: CoachingCycle;
    meetingId: string | null;
  }): Promise<CoachingSession> {
    if (input.employeeUserId === userId) {
      throw new GuardrailError({
        code: "INVALID_PAYLOAD",
        where: "training.coaching.createSession",
        message: "You cannot open a coaching session for yourself.",
      });
    }
    const payload: SessionInsert = {
      manager_user_id: userId,
      employee_user_id: input.employeeUserId,
      role_id: input.roleId,
      role_context_key: input.roleContextKey,
      cycle: input.cycle,
      meeting_id: input.meetingId,
    };
    const result = await client
      .from("training_coaching_session")
      .insert(payload)
      .select(SESSION_COLUMNS)
      .single();
    if (result.error) throw databaseFailure("createSession", result.error);
    return mapSession(result.data as SessionRow);
  }

  async function saveDraft(
    sessionId: string,
    input: SaveCoachingDraftInput,
  ): Promise<ManagerCoachingView> {
    const parsed = saveCoachingDraftSchema.parse(input);
    const update: SessionUpdate = {};
    if (parsed.cycle !== undefined) update.cycle = parsed.cycle;
    if (parsed.meetingId !== undefined) update.meeting_id = parsed.meetingId;
    if (parsed.currentStep !== undefined) update.current_step = parsed.currentStep;
    if (parsed.calibration !== undefined) {
      update.calibration = parsed.calibration as unknown as Json;
    }
    if (parsed.focusSkillIds !== undefined) {
      update.focus_skill_ids = parsed.focusSkillIds;
    }
    if (parsed.practicePlan !== undefined) {
      update.practice_plan = parsed.practicePlan as unknown as Json;
    }
    if (parsed.stopDoing !== undefined) update.stop_doing = parsed.stopDoing;
    if (parsed.managerSupport !== undefined) {
      update.manager_support = parsed.managerSupport;
    }

    if (Object.keys(update).length > 0) {
      const result = await client
        .from("training_coaching_session")
        .update(update)
        .eq("id", sessionId)
        .eq("manager_user_id", userId)
        .select("id")
        .maybeSingle();
      if (result.error) throw databaseFailure("saveDraft", result.error);
    }

    if (parsed.managerPrep !== undefined) {
      const existing = await readManagerPrep(sessionId);
      const merged = managerPrepSchema.parse({
        ...existing,
        ...parsed.managerPrep,
      });
      const prepResult = await client
        .from("training_coaching_manager_prep")
        .upsert(
          {
            session_id: sessionId,
            content: merged as unknown as Json,
          },
          { onConflict: "session_id" },
        );
      if (prepResult.error) throw databaseFailure("saveDraft.prep", prepResult.error);
    }

    return getManagerView(sessionId);
  }

  async function publish(
    sessionId: string,
    input: PublishCoachingSessionInput,
  ): Promise<CoachingSession> {
    const parsed = publishCoachingSessionSchema.parse(input);
    const today = skillDateKey();
    const reviews = coachingReviewDates(today);
    const update: SessionUpdate = {
      calibration: parsed.calibration as unknown as Json,
      focus_skill_ids: parsed.focusSkillIds,
      practice_plan: parsed.practicePlan as unknown as Json,
      stop_doing: parsed.stopDoing || null,
      manager_support: parsed.managerSupport || null,
      status: "awaiting_employee",
      published_at: new Date().toISOString(),
      review_30_date: reviews.review30Date,
      review_60_date: reviews.review60Date,
      review_90_date: reviews.review90Date,
    };
    const result = await client
      .from("training_coaching_session")
      .update(update)
      .eq("id", sessionId)
      .eq("manager_user_id", userId)
      .select(SESSION_COLUMNS)
      .maybeSingle();
    if (result.error) throw databaseFailure("publish", result.error);
    if (!result.data) {
      throw new GuardrailError({
        code: "FORBIDDEN",
        where: "training.coaching.publish",
        message: "Only the coaching manager can publish this plan.",
      });
    }
    return mapSession(result.data as SessionRow);
  }

  async function shareAssessment(
    sessionId: string,
    checkinId: string,
  ): Promise<EmployeeCoachingView> {
    const result = await client.rpc("share_coaching_assessment", {
      p_session_id: sessionId,
      p_checkin_id: checkinId,
    });
    if (result.error) throw databaseFailure("shareAssessment", result.error);
    return getEmployeeView(sessionId);
  }

  async function confirmPlan(
    sessionId: string,
  ): Promise<EmployeeCoachingView> {
    const result = await client.rpc("confirm_coaching_plan", {
      p_session_id: sessionId,
    });
    if (result.error) throw databaseFailure("confirmPlan", result.error);
    return getEmployeeView(sessionId);
  }

  return {
    listForManager,
    listForEmployee,
    getManagerView,
    getEmployeeView,
    getView,
    createSession,
    saveDraft,
    publish,
    shareAssessment,
    confirmPlan,
  };
}
