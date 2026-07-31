import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { GuardrailError } from "@/lib/guardrails/errors";
import type { Database, Json } from "@/types/database.types";

import {
  ALLEATO_CORE_CONTEXT,
  type SaveSkillCheckinInput,
  type SkillCheckin,
  type SkillDefinition,
  type SkillGrowthData,
  type SkillRole,
  DEVELOPMENT_PHASES,
  FOCUS_SKILL_MAX,
  FOCUS_SKILL_MIN,
  parseSkillPlanSnapshots,
  rankFocusAreas,
  rescoreDates,
  skillDateKey,
  skillScoreSnapshotsSchema,
} from "./skill-growth";

type TrainingClient = SupabaseClient<Database>;
type RoleRow = Database["public"]["Tables"]["training_role"]["Row"];
type SkillRow = Database["public"]["Tables"]["training_role_skill"]["Row"];
type CheckinRow = Database["public"]["Tables"]["training_skill_checkin"]["Row"];

const ROLE_COLUMNS = "id,slug,name,description,sort_order,active" as const;
const SKILL_COLUMNS =
  "id,role_id,is_core,name,description,importance,sort_order,active" as const;
const CHECKIN_COLUMNS =
  "id,role_id,role_name,checkin_date,scores,quarter_label,feedback_person,feedback_frequency,rescore_days,next_checkin_date,make_time_by,skill_plans,created_at,updated_at" as const;

function databaseFailure(
  operation: "load" | "save",
  cause: unknown,
): GuardrailError {
  // The user-facing message below is deliberately generic, which means the
  // actual Postgres error (constraint name, errcode, message) is the only thing
  // that makes a failure diagnosable. Log it — a bare "could not be saved" cost
  // a debugging session against a 23514 from validate_training_growth_plan().
  console.error(`[skill-growth] ${operation} failed`, cause);
  return new GuardrailError({
    code: "INTERNAL_ERROR",
    where: `training.growth.${operation}`,
    message:
      operation === "load"
        ? "Your Skill Wheel could not be loaded. Refresh the page and try again."
        : "Your Skill Wheel check-in could not be saved. Refresh the page and try again.",
    cause,
  });
}

function mapSkill(row: SkillRow): SkillDefinition {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    importance: row.importance,
    isCore: row.is_core,
    sortOrder: row.sort_order,
  };
}

function normalizedSkillName(name: string) {
  return name.trim().toLocaleLowerCase("en-US");
}

function canonicalSkillsForRole(
  skillRows: SkillRow[],
  roleId: string | null,
): SkillRow[] {
  const coreNames = new Set(
    skillRows
      .filter((skill) => skill.is_core && skill.role_id === null)
      .map((skill) => normalizedSkillName(skill.name)),
  );
  return skillRows.filter(
    (skill) =>
      (skill.is_core && skill.role_id === null) ||
      (roleId !== null &&
        !skill.is_core &&
        skill.role_id === roleId &&
        !coreNames.has(normalizedSkillName(skill.name))),
  );
}

function mapCheckin(row: CheckinRow): SkillCheckin {
  const parsedScores = skillScoreSnapshotsSchema.safeParse(row.scores);
  let parsedPlans;
  try {
    parsedPlans = parseSkillPlanSnapshots(row.skill_plans);
  } catch {
    parsedPlans = null;
  }
  if (
    !parsedScores.success ||
    !parsedPlans ||
    ![30, 60, 90].includes(row.rescore_days)
  ) {
    throw new GuardrailError({
      code: "SCHEMA_MISMATCH",
      where: "training.growth.mapCheckin",
      message:
        "A saved Skill Wheel check-in has an invalid score snapshot. Contact support with the check-in date.",
      details: {
        checkinId: row.id,
        checkinDate: row.checkin_date,
      },
    });
  }

  return {
    id: row.id,
    roleId: row.role_id,
    roleName: row.role_name,
    checkinDate: row.checkin_date,
    scores: parsedScores.data,
    quarterLabel: row.quarter_label,
    feedbackPerson: row.feedback_person,
    feedbackFrequency: row.feedback_frequency,
    rescoreDays: row.rescore_days as 30 | 60 | 90,
    nextCheckinDate: row.next_checkin_date,
    makeTimeBy: row.make_time_by,
    plans: parsedPlans,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function buildRoles(roleRows: RoleRow[], skillRows: SkillRow[]): SkillRole[] {
  const activeSkills = skillRows
    .filter((skill) => skill.active)
    .sort(
      (left, right) =>
        Number(right.is_core) - Number(left.is_core) ||
        left.sort_order - right.sort_order ||
        left.name.localeCompare(right.name),
    );
  const coreSkills = activeSkills
    .filter((skill) => skill.is_core && skill.role_id === null)
    .map(mapSkill);

  const roles: SkillRole[] = roleRows
    .filter((role) => role.active)
    .sort(
      (left, right) =>
        left.sort_order - right.sort_order ||
        left.name.localeCompare(right.name),
    )
    .map((role) => ({
      id: role.id,
      contextKey: role.id,
      slug: role.slug,
      name: role.name,
      description: role.description,
      skills: canonicalSkillsForRole(activeSkills, role.id).map(mapSkill),
    }))
    .filter((role) => role.skills.length > 0);

  if (coreSkills.length > 0) {
    roles.push({
      id: null,
      contextKey: ALLEATO_CORE_CONTEXT,
      slug: ALLEATO_CORE_CONTEXT,
      name: "Alleato Core",
      description:
        "Universal skills for every role and a starting point when your role is not listed.",
      skills: coreSkills,
    });
  }

  return roles;
}

function ensureSkillSetIsCurrent(
  submittedSkillIds: string[],
  currentSkills: SkillDefinition[],
) {
  const submitted = new Set(submittedSkillIds);
  const current = new Set(currentSkills.map((skill) => skill.id));
  const missing = [...current].filter((skillId) => !submitted.has(skillId));
  const unexpected = [...submitted].filter((skillId) => !current.has(skillId));

  if (
    submitted.size !== submittedSkillIds.length ||
    missing.length > 0 ||
    unexpected.length > 0
  ) {
    throw new GuardrailError({
      code: "PRECONDITION_FAILED",
      where: "training.growth.save.skillLibrary",
      message:
        "The skill library changed while you were scoring it. Refresh the page, review the current skills, and save again.",
      details: {
        missingSkillCount: missing.length,
        unexpectedSkillCount: unexpected.length,
        duplicateSkillCount: submittedSkillIds.length - submitted.size,
      },
    });
  }
}

export function createSkillGrowthDataAccess(
  client: TrainingClient,
  userId: string,
) {
  async function load(): Promise<SkillGrowthData> {
    const [rolesResult, skillsResult, recentCheckinsResult] = await Promise.all(
      [
        client
          .from("training_role")
          .select(ROLE_COLUMNS)
          .eq("active", true)
          .order("sort_order", { ascending: true })
          .order("name", { ascending: true }),
        client
          .from("training_role_skill")
          .select(SKILL_COLUMNS)
          .eq("active", true)
          .order("sort_order", { ascending: true })
          .order("name", { ascending: true }),
        client
          .from("training_skill_checkin")
          .select(CHECKIN_COLUMNS)
          .eq("user_id", userId)
          .order("checkin_date", { ascending: false })
          .order("updated_at", { ascending: false })
          .limit(201),
      ],
    );

    if (rolesResult.error) throw databaseFailure("load", rolesResult.error);
    if (skillsResult.error) throw databaseFailure("load", skillsResult.error);
    if (recentCheckinsResult.error) {
      throw databaseFailure("load", recentCheckinsResult.error);
    }

    const roles = buildRoles(
      (rolesResult.data ?? []) as RoleRow[],
      (skillsResult.data ?? []) as SkillRow[],
    );
    if (roles.length === 0) {
      throw new GuardrailError({
        code: "SCHEMA_MISMATCH",
        where: "training.growth.load.roles",
        message:
          "No active Skill Wheel libraries are available. Contact an administrator before starting a check-in.",
      });
    }

    const checkinRows = (recentCheckinsResult.data ?? []) as CheckinRow[];
    return {
      roles,
      historyTruncated: checkinRows.length > 200,
      checkins: checkinRows
        .slice(0, 200)
        .sort(
          (left, right) =>
            right.checkin_date.localeCompare(left.checkin_date) ||
            right.updated_at.localeCompare(left.updated_at),
        )
        .map(mapCheckin),
    };
  }

  async function save(input: SaveSkillCheckinInput): Promise<SkillCheckin> {
    const today = skillDateKey();
    if (input.checkinDate > today) {
      throw new GuardrailError({
        code: "INVALID_PAYLOAD",
        where: "training.growth.save.checkinDate",
        message:
          "The check-in date cannot be in the future. Choose today or an earlier date.",
      });
    }
    const expectedNextCheckin = rescoreDates(input.checkinDate).find(
      (item) => item.days === input.rescoreDays,
    )?.date;
    if (input.nextCheckinDate !== expectedNextCheckin) {
      throw new GuardrailError({
        code: "INVALID_PAYLOAD",
        where: "training.growth.save.nextCheckinDate",
        message:
          "The next check-in date must match the selected 30, 60, or 90 day cadence.",
      });
    }

    let role: RoleRow | null = null;
    if (input.roleId) {
      const roleResult = await client
        .from("training_role")
        .select(ROLE_COLUMNS)
        .eq("id", input.roleId)
        .eq("active", true)
        .maybeSingle();

      if (roleResult.error) throw databaseFailure("save", roleResult.error);
      if (!roleResult.data) {
        throw new GuardrailError({
          code: "PRECONDITION_FAILED",
          where: "training.growth.save.role",
          message:
            "That role is no longer active. Refresh the page and choose a current role.",
        });
      }
      role = roleResult.data as RoleRow;
    }

    let skillQuery = client
      .from("training_role_skill")
      .select(SKILL_COLUMNS)
      .eq("active", true);

    skillQuery = input.roleId
      ? skillQuery.or(
          `and(role_id.eq.${input.roleId},is_core.eq.false),and(role_id.is.null,is_core.eq.true)`,
        )
      : skillQuery.is("role_id", null).eq("is_core", true);

    const skillResult = await skillQuery
      .order("is_core", { ascending: false })
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });

    if (skillResult.error) throw databaseFailure("save", skillResult.error);

    const currentSkills = canonicalSkillsForRole(
      (skillResult.data ?? []) as SkillRow[],
      input.roleId,
    ).map(mapSkill);
    ensureSkillSetIsCurrent(
      input.scores.map((score) => score.skillId),
      currentSkills,
    );
    ensureSkillSetIsCurrent(
      input.plans.map((plan) => plan.skillId),
      currentSkills,
    );

    const submittedById = new Map(
      input.scores.map((score) => [score.skillId, score]),
    );
    const snapshots = currentSkills.map((skill) => {
      const submitted = submittedById.get(skill.id);
      if (!submitted) {
        throw new GuardrailError({
          code: "PRECONDITION_FAILED",
          where: "training.growth.save.snapshot",
          message:
            "A current skill is missing from the check-in. Refresh the page and save again.",
        });
      }
      return {
        skillId: skill.id,
        name: skill.name,
        score: submitted.score,
        target: submitted.target,
        importance: skill.importance,
        isCore: skill.isCore,
      };
    });
    const focusSkillIds = new Set(input.focusSkillIds);
    const eligibleFocusIds = new Set(
      rankFocusAreas(snapshots).map((skill) => skill.skillId),
    );
    if (
      focusSkillIds.size !== input.focusSkillIds.length ||
      focusSkillIds.size < FOCUS_SKILL_MIN ||
      focusSkillIds.size > FOCUS_SKILL_MAX ||
      [...focusSkillIds].some((skillId) => !eligibleFocusIds.has(skillId))
    ) {
      throw new GuardrailError({
        code: "INVALID_PAYLOAD",
        where: "training.growth.save.focusSelection",
        message:
          "Choose 2–4 unique focus skills whose target is above the current score.",
      });
    }
    const submittedPlansById = new Map(
      input.plans.map((plan) => [plan.skillId, plan]),
    );
    const plans = currentSkills.map((skill, index) => {
      const submitted = submittedPlansById.get(skill.id);
      if (!submitted) {
        throw new GuardrailError({
          code: "PRECONDITION_FAILED",
          where: "training.growth.save.plan",
          message:
            "A current skill is missing from the growth plan. Refresh the page and save again.",
        });
      }

      const isFocus = focusSkillIds.has(skill.id);
      /**
       * A focus skill must carry a real plan: a cadence, and at least one
       * horizon with both a concrete action and the measure that proves it.
       *
       * It is deliberately not all three of 30/60/90. The guided assessment
       * asks for one rep you will actually do and sets the later horizons when
       * you re-score; demanding three horizons up front produced vague filler
       * for 60 and 90, or an unfinished check-in. Surfaces that do collect all
       * three (the long-form My Growth planner) still validate here — every
       * phase they send is checked below.
       */
      const phasesAreWellFormed = submitted.phases.every(
        (phase) =>
          DEVELOPMENT_PHASES.includes(phase.days) &&
          phase.action.trim() &&
          phase.measure.trim(),
      );
      const phaseDaysAreUnique =
        new Set(submitted.phases.map((phase) => phase.days)).size ===
        submitted.phases.length;
      if (
        isFocus &&
        (!submitted.frequency.trim() ||
          submitted.phases.length === 0 ||
          !phaseDaysAreUnique ||
          !phasesAreWellFormed)
      ) {
        throw new GuardrailError({
          code: "INVALID_PAYLOAD",
          where: "training.growth.save.focusPlan",
          message:
            "Every focus skill needs how often you will practice it, plus at least one 30, 60 or 90-day action with the measure that proves it.",
        });
      }

      return {
        skillId: skill.id,
        description: skill.description,
        evidence: submitted.evidence,
        frequency: submitted.frequency,
        resource: submitted.resource,
        feedback: submitted.feedback,
        phases: isFocus ? submitted.phases : [],
        isFocus,
        sortOrder: index,
      };
    });

    const payload: Database["public"]["Tables"]["training_skill_checkin"]["Insert"] =
      {
        user_id: userId,
        role_id: input.roleId,
        role_name: role?.name ?? "Alleato Core",
        checkin_date: input.checkinDate,
        scores: snapshots as unknown as Json,
        quarter_label: input.quarterLabel || null,
        feedback_person: input.feedbackPerson || null,
        feedback_frequency: input.feedbackFrequency || null,
        rescore_days: input.rescoreDays,
        next_checkin_date: input.nextCheckinDate,
        make_time_by: input.makeTimeBy || null,
        skill_plans: plans as unknown as Json,
      };

    const result = await client
      .from("training_skill_checkin")
      .upsert(payload, {
        onConflict: "user_id,role_context_key,checkin_date",
      })
      .select(CHECKIN_COLUMNS)
      .single();

    if (result.error) throw databaseFailure("save", result.error);
    return mapCheckin(result.data as CheckinRow);
  }

  return { load, save };
}
