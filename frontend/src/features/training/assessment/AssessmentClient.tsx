"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState } from "react";

import { toast } from "sonner";

import { apiFetchWithTimeout } from "@/lib/api-client";

import {
  FOCUS_SKILL_MAX,
  FOCUS_SKILL_MIN,
  formatSkillDate,
  latestCheckinForRole,
  rankFocusAreas,
  rescoreDates,
  type SkillDefinition,
  type SkillGrowthData,
  type SkillRole,
  type SkillScoreSnapshot,
} from "../skill-growth";
import { SkillWheel } from "../SkillWheel";
import { StepPlan, type FocusPlanDraft } from "./StepPlan";
import { StepScore } from "./StepScore";
import styles from "./assessment.module.css";

function quarterForDate(isoDate: string): string {
  const [, month] = isoDate.split("-").map(Number);
  return `Q${Math.ceil(month / 3)} ${isoDate.slice(0, 4)}`;
}

/**
 * Starting target for every skill. Confirmed (and adjusted) on the focus step —
 * a believable 70 beats an aspirational 100.
 */
export const DEFAULT_TARGET = 70;

export const ASSESSMENT_STEPS = [
  "Your role",
  "Your skills",
  "Score",
  "Your wheel",
  "Focus",
  "Plan",
  "Cadence",
] as const;

export interface AssessmentClientProps {
  initialData: SkillGrowthData;
  today: string;
  suggestedRoleSlug?: string | null;
}

function roleByContext(roles: SkillRole[], contextKey: string): SkillRole {
  return roles.find((role) => role.contextKey === contextKey) ?? roles[0];
}

export function AssessmentClient({
  initialData,
  today,
  suggestedRoleSlug,
}: AssessmentClientProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const requestedStep = Number(searchParams?.get("step") ?? "1");
  const step =
    Number.isFinite(requestedStep) &&
    requestedStep >= 1 &&
    requestedStep <= ASSESSMENT_STEPS.length
      ? Math.trunc(requestedStep)
      : 1;

  const newestCheckin = initialData.checkins[0];
  const initialRole =
    (newestCheckin
      ? initialData.roles.find((role) => role.id === newestCheckin.roleId)
      : null) ??
    initialData.roles.find((role) => role.slug === suggestedRoleSlug) ??
    initialData.roles[0];

  const [contextKey, setContextKey] = useState(initialRole.contextKey);
  /**
   * A check-in is always dated today — there is no reason to make someone
   * confirm the date they are sitting in front of, and back-dating one would
   * only fight the (user, role, date) upsert key. Kept as a named value because
   * the quarter label and the next-check-in date are both derived from it.
   */
  const checkinDate = today;
  const [removedSkillIds, setRemovedSkillIds] = useState<string[]>([]);
  const [addedSkills, setAddedSkills] = useState<SkillDefinition[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [pendingSkillId, setPendingSkillId] = useState("");
  const [scores, setScores] = useState<Record<string, number | null>>({});
  const [evidence, setEvidence] = useState<Record<string, string>>({});
  const [targets, setTargets] = useState<Record<string, number>>({});
  const [manualFocusIds, setManualFocusIds] = useState<string[] | null>(null);
  const [focusPlans, setFocusPlans] = useState<Record<string, FocusPlanDraft>>(
    {},
  );
  const [makeTimeBy, setMakeTimeBy] = useState("");
  const [feedbackPerson, setFeedbackPerson] = useState("");
  const [feedbackFrequency, setFeedbackFrequency] = useState("");
  const [rescoreDays, setRescoreDays] = useState<30 | 60 | 90>(60);
  const [isSaving, setIsSaving] = useState(false);

  const role = roleByContext(initialData.roles, contextKey);

  const skills = useMemo(() => {
    const removed = new Set(removedSkillIds);
    return [
      ...role.skills.filter((skill) => !removed.has(skill.id)),
      ...addedSkills.filter((skill) => !removed.has(skill.id)),
    ];
  }, [role, removedSkillIds, addedSkills]);

  /**
   * Skills from THIS role's library that are not currently on the wheel — i.e. ones
   * that were cut and can be put back. Offering another role's library looks generous
   * but cannot be saved: the check-in is stored against one role, and both
   * ensureSkillSetIsCurrent() and validate_training_growth_plan() reject any skill that
   * is not canonical for it. Same-named skills across roles are distinct rows, so they
   * would also render as indistinguishable duplicate wedges.
   */
  const catalog = useMemo(() => {
    const chosen = new Set(skills.map((skill) => skill.id));
    const putBack = role.skills.filter((skill) => !chosen.has(skill.id));
    return putBack.length > 0
      ? [{ roleName: role.name, skills: putBack }]
      : [];
  }, [role, skills]);

  /**
   * Every answer lives in client state, so moving between steps must not cost a
   * server round-trip — router.replace() on this force-dynamic page re-renders
   * it on the server and makes each Next click wait seconds. The native History
   * API updates the URL (so deep links, Back and Forward all still work) and
   * Next syncs it into useSearchParams without refetching.
   */
  const goToStep = useCallback(
    (nextStep: number) => {
      const params = new URLSearchParams(searchParams?.toString() ?? "");
      params.set("step", String(nextStep));
      window.history.pushState(null, "", `${pathname}?${params.toString()}`);
      window.scrollTo({ top: 0 });
    },
    [pathname, searchParams],
  );

  function selectRole(nextContextKey: string) {
    setContextKey(nextContextKey);
    setRemovedSkillIds([]);
    setAddedSkills([]);
  }

  const scoredCount = skills.filter(
    (skill) => scores[skill.id] !== null && scores[skill.id] !== undefined,
  ).length;
  const allScored = skills.length > 0 && scoredCount === skills.length;

  /**
   * Every skill scored so far, shaped for the shared SkillWheel. Targets
   * default to DEFAULT_TARGET here and are confirmed on the focus step.
   */
  const snapshots: SkillScoreSnapshot[] = useMemo(
    () =>
      skills
        .filter(
          (skill) => scores[skill.id] !== null && scores[skill.id] !== undefined,
        )
        .map((skill) => ({
          skillId: skill.id,
          name: skill.name,
          score: scores[skill.id] as number,
          target: targets[skill.id] ?? DEFAULT_TARGET,
          importance: skill.importance,
          isCore: skill.isCore,
        })),
    [skills, scores, targets],
  );

  /**
   * Focus candidates, ranked by role importance x positive gap. Until the
   * person changes the selection, the widest gaps are pre-selected for them —
   * confirming a ranking is faster than building one from nothing.
   */
  const focusCandidates = useMemo(
    () => rankFocusAreas(snapshots),
    [snapshots],
  );
  const focusIds =
    manualFocusIds ??
    focusCandidates.slice(0, FOCUS_SKILL_MAX).map((area) => area.skillId);
  const focusSet = useMemo(() => new Set(focusIds), [focusIds]);

  function toggleFocus(skillId: string) {
    setManualFocusIds(() => {
      if (focusSet.has(skillId)) {
        return focusIds.filter((id) => id !== skillId);
      }
      if (focusIds.length >= FOCUS_SKILL_MAX) return focusIds;
      return [...focusIds, skillId];
    });
  }

  const gaps = useMemo(
    () =>
      [...snapshots]
        .map((snapshot) => ({
          ...snapshot,
          gap: snapshot.target - snapshot.score,
        }))
        .sort((left, right) => right.gap - left.gap),
    [snapshots],
  );

  function addSkill() {
    const found = role.skills.find((skill) => skill.id === pendingSkillId);
    if (!found) return;
    setRemovedSkillIds((current) =>
      current.filter((skillId) => skillId !== found.id),
    );
    setAddedSkills((current) =>
      current.some((skill) => skill.id === found.id)
        ? current
        : [...current, found],
    );
    setPendingSkillId("");
    setIsAdding(false);
  }

  const priorCheckin = latestCheckinForRole(initialData.checkins, role.id);
  const focusAreas = focusCandidates.filter((area) =>
    focusSet.has(area.skillId),
  );
  const nextCheckinDate =
    rescoreDates(checkinDate).find((entry) => entry.days === rescoreDays)
      ?.date ?? "";

  /** Everything still standing between this draft and a saved check-in. */
  const blockers: string[] = [];
  /**
   * A check-in is stored as a complete snapshot of the role library: both
   * validate_training_skill_checkin() and validate_training_growth_plan() require every
   * canonical skill exactly once, so a trimmed wheel cannot be saved at all. Step 2 still
   * offers the cut, so say so here — before, this surfaced only as a 412 on Finish that
   * blamed the library for changing and cost the whole draft.
   */
  const cutSkills = role.skills.filter(
    (candidate) => !skills.some((skill) => skill.id === candidate.id),
  );
  if (cutSkills.length > 0) {
    blockers.push(
      `Put ${cutSkills
        .map((skill) => skill.name)
        .join(", ")} back on step 2 — a check-in has to score every skill in your role library.`,
    );
  }
  if (!allScored) {
    blockers.push(
      `Score the remaining ${skills.length - scoredCount} skills on step 3.`,
    );
  }
  if (focusIds.length < FOCUS_SKILL_MIN) {
    blockers.push(`Choose at least ${FOCUS_SKILL_MIN} focus skills on step 5.`);
  }
  const focusMissingEvidence = focusAreas.filter(
    (area) => !(evidence[area.skillId] ?? "").trim(),
  );
  if (focusMissingEvidence.length > 0) {
    blockers.push(
      `Add the example behind ${focusMissingEvidence
        .map((area) => area.name)
        .join(", ")} on step 3.`,
    );
  }
  const focusMissingRep = focusAreas.filter(
    (area) => !(focusPlans[area.skillId]?.rep ?? "").trim(),
  );
  if (focusMissingRep.length > 0) {
    blockers.push(
      `Name the rep for ${focusMissingRep
        .map((area) => area.name)
        .join(", ")} on step 6.`,
    );
  }
  /**
   * The save also insists on a cadence and the measure that proves the rep — both
   * the server (training.growth.save.focusPlan) and the trigger reject a focus plan
   * without them. Naming them here keeps Finish honest instead of letting someone
   * spend seven steps on a draft the API will refuse.
   */
  const focusMissingFrequency = focusAreas.filter(
    (area) => !(focusPlans[area.skillId]?.frequency ?? "").trim(),
  );
  if (focusMissingFrequency.length > 0) {
    blockers.push(
      `Say how often you will practice ${focusMissingFrequency
        .map((area) => area.name)
        .join(", ")} on step 6.`,
    );
  }
  const focusMissingProof = focusAreas.filter(
    (area) => !(focusPlans[area.skillId]?.proof ?? "").trim(),
  );
  if (focusMissingProof.length > 0) {
    blockers.push(
      `Add the proof it worked for ${focusMissingProof
        .map((area) => area.name)
        .join(", ")} on step 6.`,
    );
  }
  /**
   * A focus skill whose target drops to or below its score stops being a gap, so it
   * leaves the ranked list — but it stays selected. The save rejects that, so surface
   * it rather than letting Finish look ready.
   */
  const ineligibleFocusIds = focusIds.filter(
    (skillId) => !focusCandidates.some((area) => area.skillId === skillId),
  );
  if (allScored && ineligibleFocusIds.length > 0) {
    const names = ineligibleFocusIds.map(
      (skillId) =>
        skills.find((skill) => skill.id === skillId)?.name ?? "a chosen skill",
    );
    blockers.push(
      `Raise the target above your score for ${names.join(", ")} on step 5, or unpick it.`,
    );
  }
  const canFinish = blockers.length === 0 && !isSaving;

  async function finish() {
    setIsSaving(true);
    try {
      const payload = await apiFetchWithTimeout<{ checkin: unknown }>(
        "/api/training/growth",
        {
          method: "POST",
          body: JSON.stringify({
            roleId: role.id,
            checkinDate,
            quarterLabel: quarterForDate(checkinDate),
            feedbackPerson,
            feedbackFrequency,
            rescoreDays,
            nextCheckinDate,
            makeTimeBy,
            focusSkillIds: focusIds,
            scores: snapshots.map(({ skillId, score, target }) => ({
              skillId,
              score,
              target,
            })),
            plans: snapshots.map((snapshot) => {
              const skill = skills.find(
                (candidate) => candidate.id === snapshot.skillId,
              );
              const plan = focusPlans[snapshot.skillId];
              const isFocus = focusSet.has(snapshot.skillId);
              return {
                skillId: snapshot.skillId,
                description: skill?.description ?? "",
                evidence: {
                  situation: "",
                  behavior: evidence[snapshot.skillId] ?? "",
                  outcome: "",
                },
                frequency: isFocus ? (plan?.frequency ?? "") : "",
                resource: "",
                feedback: isFocus ? feedbackPerson : "",
                phases:
                  isFocus && plan
                    ? [
                        {
                          days: 30 as const,
                          action: plan.rep,
                          measure: plan.proof,
                        },
                      ]
                    : [],
              };
            }),
          }),
        },
      );

      if (!payload?.checkin) {
        throw new Error(
          "The server did not return the saved check-in. Try again.",
        );
      }
      toast.success("Assessment saved.");
      window.location.href = "/training/growth";
    } catch (error) {
      toast.error("Your assessment was not saved.", {
        description:
          error instanceof Error
            ? error.message
            : "Something went wrong. Try again.",
      });
      setIsSaving(false);
    }
  }

  return (
    <>
      <div className={styles.rail}>
        <div className={styles.railInner}>
          <Link className={styles.exit} href="/training/growth">
            ← Save &amp; exit
          </Link>
          <ol className={styles.steps}>
            {ASSESSMENT_STEPS.map((label, index) => {
              const number = index + 1;
              return (
                <li
                  key={label}
                  className={
                    number === step
                      ? styles.stepNow
                      : number < step
                        ? styles.stepDone
                        : undefined
                  }
                >
                  <button
                    type="button"
                    className={styles.stepButton}
                    onClick={() => goToStep(number)}
                  >
                    <span>
                      {number}. {label}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
          <span className={styles.count}>
            Step {step} of {ASSESSMENT_STEPS.length}
          </span>
        </div>
      </div>

      <div className={styles.stage}>
        {step === 1 ? (
          <>
            <div className={styles.kicker}>Step 1 · Who you are</div>
            <h1 className={styles.title}>Confirm your role.</h1>
            <p className={styles.lede}>
              Pick the role you actually do the work of. It loads a starting
              skill list so you never face a blank page — you fine-tune it next.
            </p>
            <div className={styles.roleGrid}>
              {initialData.roles.map((candidate) => (
                <button
                  key={candidate.contextKey}
                  type="button"
                  className={styles.roleCard}
                  aria-pressed={candidate.contextKey === contextKey}
                  onClick={() => selectRole(candidate.contextKey)}
                >
                  <b>{candidate.name}</b>
                  <small>
                    {candidate.description ??
                      `${candidate.skills.length} skills in this library`}
                  </small>
                </button>
              ))}
            </div>
            {priorCheckin ? (
              <p className={styles.help} style={{ marginTop: 26 }}>
                Your last {role.name} check-in was {priorCheckin.checkinDate}.
                Scoring again creates a new check-in you can compare against.
              </p>
            ) : null}
          </>
        ) : null}

        {step === 2 ? (
          <>
            <div className={styles.kicker}>Step 2 · Your skills</div>
            <h1 className={styles.title}>Make the list the real work you do.</h1>
            <p className={styles.lede}>
              These become the wedges on your wheel. Cut what you never touch,
              add what is missing. Eight is the sweet spot.
            </p>
            <div className={styles.skillsCard}>
              {skills.map((skill) => (
                <div key={skill.id} className={styles.skillRow}>
                  <span className={styles.skillName}>
                    {skill.name}
                    <small>{skill.description}</small>
                  </span>
                  {skill.isCore ? (
                    <span className={styles.coreTag}>Core</span>
                  ) : null}
                  <button
                    type="button"
                    className={styles.remove}
                    aria-label={`Remove ${skill.name}`}
                    onClick={() =>
                      setRemovedSkillIds((current) => [...current, skill.id])
                    }
                  >
                    ×
                  </button>
                </div>
              ))}

              {isAdding ? (
                <div className={styles.addPanel}>
                  <div className={styles.field} style={{ maxWidth: "none" }}>
                    <label htmlFor="add-skill">
                      Put a skill back on your wheel
                    </label>
                    <select
                      id="add-skill"
                      className={styles.control}
                      value={pendingSkillId}
                      onChange={(event) => setPendingSkillId(event.target.value)}
                    >
                      <option value="">Choose a skill…</option>
                      {catalog.map((group) => (
                        <optgroup key={group.roleName} label={group.roleName}>
                          {group.skills.map((skill) => (
                            <option key={skill.id} value={skill.id}>
                              {skill.name}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </div>
                  <div className={styles.addActions}>
                    <button
                      type="button"
                      className={styles.primary}
                      disabled={!pendingSkillId}
                      onClick={addSkill}
                    >
                      Add skill
                    </button>
                    <button
                      type="button"
                      className={styles.quiet}
                      onClick={() => {
                        setIsAdding(false);
                        setPendingSkillId("");
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                  <p className={styles.help} style={{ marginTop: 14 }}>
                    This is your {role.name} library. Borrowing another role&apos;s
                    skill, or writing a brand-new one, needs a new entry in the
                    shared library first.
                  </p>
                </div>
              ) : catalog.length > 0 ? (
                <button
                  type="button"
                  className={styles.addOpen}
                  onClick={() => setIsAdding(true)}
                >
                  ＋ Add a skill
                </button>
              ) : null}
            </div>
            <p className={styles.help} style={{ marginTop: 14 }}>
              {skills.length} skills · the wheel reads best between 6 and 10.
            </p>
          </>
        ) : null}

        {step === 3 ? (
          <>
            <div className={styles.kicker}>Step 3 · Score yourself</div>
            <h1 className={styles.title}>
              Be brutally honest. Any number that is true.
            </h1>
            <p className={styles.lede}>
              Score where you are today, not where you want to be. Then name one
              recent example that proves the number — the example is what makes
              the score real.
            </p>
            <StepScore
              skills={skills}
              scores={scores}
              evidence={evidence}
              onScore={(skillId, score) =>
                setScores((current) => ({ ...current, [skillId]: score }))
              }
              onEvidence={(skillId, note) =>
                setEvidence((current) => ({ ...current, [skillId]: note }))
              }
            />
            <p className={styles.help}>
              {scoredCount} of {skills.length} scored. Drag a slider to score a
              skill.
            </p>
          </>
        ) : null}

        {step === 4 ? (
          <>
            <div className={styles.kicker}>Step 4 · Read your wheel</div>
            <h1 className={styles.title}>Here is the shape of your job.</h1>
            <p className={styles.lede}>
              Short wedges are your gaps. The dashed ring is the level the work
              actually requires. You are not trying to fill every wedge — you
              are trying to close the widest ones.
            </p>
            {snapshots.length > 0 ? (
              <>
                <div className={styles.wheelLayout}>
                  <SkillWheel roleName={role.name} scores={snapshots} />
                  <ol className={styles.gapList}>
                    {gaps.map((entry, index) => (
                      <li key={entry.skillId}>
                        <span className={styles.gapIndex}>
                          {snapshots.findIndex(
                            (snapshot) => snapshot.skillId === entry.skillId,
                          ) + 1}
                        </span>
                        <b>{entry.name}</b>
                        <span className={styles.gapNums}>
                          {entry.score} → {entry.target}
                          <em
                            className={
                              entry.gap > 0 ? styles.gapWide : styles.gapMet
                            }
                          >
                            {entry.gap > 0 ? `−${entry.gap}` : "met"}
                          </em>
                        </span>
                      </li>
                    ))}
                  </ol>
                </div>
                {allScored ? null : (
                  <p className={styles.help}>
                    Showing the {scoredCount} of {skills.length} skills you have
                    scored so far. Go back to step 3 to score the rest.
                  </p>
                )}
              </>
            ) : (
              <p className={styles.help}>
                Score at least one skill on step 3 and your wheel appears here.
              </p>
            )}
          </>
        ) : null}

        {step === 5 ? (
          <>
            <div className={styles.kicker}>Step 5 · Confirm your focus</div>
            <h1 className={styles.title}>
              A few skills. Everything else waits.
            </h1>
            <p className={styles.lede}>
              Ranked by how much the role needs the skill times how far you are
              from your target. Confirm {FOCUS_SKILL_MIN} to {FOCUS_SKILL_MAX},
              and set a target you can actually reach this quarter — a
              believable 70 beats an aspirational 100.
            </p>
            {focusCandidates.length > 0 ? (
              <>
                {focusCandidates.map((area, index) => {
                  const checked = focusSet.has(area.skillId);
                  const widest = focusCandidates[0].gap || 1;
                  return (
                    <label key={area.skillId} className={styles.focusRow}>
                      <input
                        type="checkbox"
                        className={styles.focusCheck}
                        checked={checked}
                        aria-label={`Choose ${area.name} as a focus skill`}
                        onChange={() => toggleFocus(area.skillId)}
                      />
                      <span className={styles.rank}>{index + 1}</span>
                      <span className={styles.focusName}>
                        <b>{area.name}</b>
                        <small>
                          now {area.score} · gap {area.gap}
                        </small>
                      </span>
                      <span className={styles.gapBar} aria-hidden="true">
                        <i
                          style={{
                            width: `${Math.round((area.gap / widest) * 100)}%`,
                          }}
                        />
                      </span>
                      <span className={styles.targetBox}>
                        <span>Target</span>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          className={styles.control}
                          value={targets[area.skillId] ?? DEFAULT_TARGET}
                          aria-label={`${area.name} target`}
                          onChange={(event) => {
                            const next = Math.max(
                              0,
                              Math.min(100, Number(event.target.value) || 0),
                            );
                            setTargets((current) => ({
                              ...current,
                              [area.skillId]: next,
                            }));
                          }}
                        />
                      </span>
                    </label>
                  );
                })}
                <p className={styles.help}>
                  {focusIds.length} of {FOCUS_SKILL_MAX} chosen.
                  {focusIds.length < FOCUS_SKILL_MIN
                    ? ` Choose at least ${FOCUS_SKILL_MIN}.`
                    : ""}
                </p>
              </>
            ) : snapshots.length === 0 ? (
              /* No scores yet (a deep link straight to this step) is not the same
                 thing as every gap being closed — say which one it is. */
              <p className={styles.help}>
                Score your skills on step 3 and your ranked focus options appear
                here.
              </p>
            ) : (
              <p className={styles.help}>
                Every skill is already at or above its target. Raise a target on
                this step, or lower a score on step 3, to pick something to work
                on.
              </p>
            )}
          </>
        ) : null}

        {step === 6 ? (
          <>
            <div className={styles.kicker}>Step 6 · Build your plan</div>
            <h1 className={styles.title}>
              Turn each gap into a rep you can actually do.
            </h1>
            <p className={styles.lede}>
              “Get better at drawings” is a wish. “30 minutes on civil sheets
              every Tuesday, one RFI per job” is a plan. Concrete action, how
              often, and how you will know it worked.
            </p>
            {focusAreas.length > 0 ? (
              <StepPlan
                focusAreas={focusAreas}
                plans={focusPlans}
                makeTimeBy={makeTimeBy}
                onPlan={(skillId, patch) =>
                  setFocusPlans((current) => {
                    const existing =
                      current[skillId] ?? { rep: "", frequency: "", proof: "" };
                    return { ...current, [skillId]: { ...existing, ...patch } };
                  })
                }
                onMakeTimeBy={setMakeTimeBy}
              />
            ) : (
              <p className={styles.help}>
                Choose your focus skills on step 5 and their plans appear here.
              </p>
            )}
          </>
        ) : null}

        {step === 7 ? (
          <>
            <div className={styles.kicker}>Step 7 · Cadence</div>
            <h1 className={styles.title}>Lock in the loop.</h1>
            <p className={styles.lede}>
              Reps without feedback drift. Name who checks your work, how often
              you will ask, and when you come back and re-score.
            </p>
            <div className={styles.cadenceRow}>
              <div className={styles.field}>
                <label htmlFor="feedback-person">
                  Who gives you feedback
                </label>
                <input
                  id="feedback-person"
                  className={styles.control}
                  value={feedbackPerson}
                  maxLength={100}
                  placeholder="Their name"
                  onChange={(event) => setFeedbackPerson(event.target.value)}
                />
              </div>
              <div className={styles.field}>
                <label htmlFor="feedback-frequency">How often</label>
                <input
                  id="feedback-frequency"
                  className={styles.control}
                  value={feedbackFrequency}
                  maxLength={160}
                  placeholder="Every other Friday"
                  onChange={(event) =>
                    setFeedbackFrequency(event.target.value)
                  }
                />
              </div>
            </div>
            <div className={styles.field}>
              <label htmlFor="rescore-days">Re-score in</label>
              <select
                id="rescore-days"
                className={styles.control}
                value={String(rescoreDays)}
                onChange={(event) =>
                  setRescoreDays(Number(event.target.value) as 30 | 60 | 90)
                }
              >
                <option value="30">30 days</option>
                <option value="60">60 days</option>
                <option value="90">90 days</option>
              </select>
            </div>
            <p className={styles.help} style={{ marginBottom: 20 }}>
              Next check-in:{" "}
              <b>
                {nextCheckinDate
                  ? formatSkillDate(nextCheckinDate)
                  : "Choose a date on step 1"}
              </b>
            </p>
            {focusAreas.length > 0 ? (
              <div className={styles.prompt}>
                <span className={styles.kicker}>Ask a sharper question</span>
                <p>
                  “On <b>{focusAreas[0].name}</b>, you saw me do X. What would
                  move me from {focusAreas[0].score} toward{" "}
                  {focusAreas[0].target}?”
                </p>
              </div>
            ) : null}
            {blockers.length > 0 ? (
              <>
                <p className={styles.help} style={{ marginTop: 24 }}>
                  Before this can be saved:
                </p>
                <ul className={styles.blockers}>
                  {blockers.map((blocker) => (
                    <li key={blocker}>{blocker}</li>
                  ))}
                </ul>
              </>
            ) : (
              <p className={styles.help} style={{ marginTop: 24 }}>
                Finishing saves this check-in to your growth history. You can
                re-score and edit it any time.
              </p>
            )}
          </>
        ) : null}
      </div>

      <div className={styles.actionBar}>
        <div className={styles.actionBarInner}>
          <button
            type="button"
            className={`${styles.quiet} ${step === 1 ? styles.quietHidden : ""}`}
            onClick={() => goToStep(step - 1)}
          >
            ← Back
          </button>
          <span className={styles.draftNote}>
            <span className={styles.dot} aria-hidden="true" />
            Draft held on this page
          </span>
          {step < ASSESSMENT_STEPS.length ? (
            <button
              type="button"
              className={styles.primary}
              disabled={step === 2 && skills.length === 0}
              onClick={() => goToStep(step + 1)}
            >
              Next →
            </button>
          ) : (
            <button
              type="button"
              className={styles.primary}
              disabled={!canFinish}
              onClick={finish}
            >
              {isSaving ? "Saving…" : "Finish & save ✓"}
            </button>
          )}
        </div>
      </div>
    </>
  );
}
