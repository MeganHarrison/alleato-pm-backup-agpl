"use client";

import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

import styles from "@/app/(main)/training/training-theme.module.css";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/hooks/use-confirm";
import { useUnsavedChangesGuard } from "@/hooks/use-unsaved-changes-guard";
import { apiFetchWithTimeout } from "@/lib/api-client";

import { SkillWheel } from "./SkillWheel";
import {
  averageCurrentScore,
  clampSkillScore,
  createUnscoredDrafts,
  DEVELOPMENT_PHASES,
  FOCUS_SKILL_MAX,
  FOCUS_SKILL_MIN,
  formatSkillDate,
  latestCheckinForRole,
  rankFocusAreas,
  rescoreDates,
  roleContextKey,
  type DevelopmentPhase,
  type SkillCheckin,
  type SkillGrowthData,
  type SkillPlanInput,
  type SkillRole,
  type SkillScoreDraft,
  type SkillScoreSnapshot,
} from "./skill-growth";

export interface SkillGrowthClientProps {
  initialData: SkillGrowthData;
  today: string;
  suggestedRoleSlug?: string | null;
}

type EditableField = "score" | "target";

function emptyEvidence() {
  return { situation: "", behavior: "", outcome: "" };
}

function emptyPhases(): DevelopmentPhase[] {
  return DEVELOPMENT_PHASES.map((days) => ({
    days,
    action: "",
    measure: "",
  }));
}

function scoresForRole(
  role: SkillRole,
  checkins: SkillCheckin[],
): SkillScoreDraft[] {
  const latest = latestCheckinForRole(checkins, role.id);
  if (!latest) return createUnscoredDrafts(role.skills);

  const savedBySkillId = new Map(
    latest.scores.map((score) => [score.skillId, score]),
  );
  return role.skills.map((skill) => {
    const saved = savedBySkillId.get(skill.id);
    return {
      skillId: skill.id,
      name: skill.name,
      score: saved?.score ?? null,
      target: saved?.target ?? null,
      importance: skill.importance,
      isCore: skill.isCore,
    };
  });
}

function plansForRole(
  role: SkillRole,
  checkins: SkillCheckin[],
): SkillPlanInput[] {
  const latest = latestCheckinForRole(checkins, role.id);
  const savedBySkillId = new Map(
    (latest?.plans ?? []).map((plan) => [plan.skillId, plan]),
  );
  return role.skills.map((skill) => {
    const saved = savedBySkillId.get(skill.id);
    return {
      skillId: skill.id,
      description: skill.description,
      evidence: saved?.evidence ?? emptyEvidence(),
      frequency: saved?.frequency ?? "",
      resource: saved?.resource ?? "",
      feedback: saved?.feedback ?? "",
      phases: saved?.phases ?? emptyPhases(),
    };
  });
}

function focusIdsForRole(role: SkillRole, checkins: SkillCheckin[]): string[] {
  return (
    latestCheckinForRole(checkins, role.id)
      ?.plans.filter((plan) => plan.isFocus)
      .map((plan) => plan.skillId) ?? []
  );
}

function roleFromContext(roles: SkillRole[], contextKey: string): SkillRole {
  return roles.find((role) => role.contextKey === contextKey) ?? roles[0];
}

function sortCheckins(checkins: SkillCheckin[]) {
  return [...checkins].sort(
    (left, right) =>
      right.checkinDate.localeCompare(left.checkinDate) ||
      right.updatedAt.localeCompare(left.updatedAt),
  );
}

function quarterForDate(isoDate: string): string {
  const [, month] = isoDate.split("-").map(Number);
  return `Q${Math.ceil(month / 3)} ${isoDate.slice(0, 4)}`;
}

function nextDateFor(checkinDate: string, days: 30 | 60 | 90) {
  return (
    rescoreDates(checkinDate).find((item) => item.days === days)?.date ?? ""
  );
}

function completeEvidence(plan: SkillPlanInput) {
  return (
    plan.evidence.situation.trim() &&
    plan.evidence.behavior.trim() &&
    plan.evidence.outcome.trim()
  );
}

function completeFocusPlan(plan: SkillPlanInput) {
  return (
    plan.frequency.trim() &&
    plan.resource.trim() &&
    plan.feedback.trim() &&
    plan.phases.length === DEVELOPMENT_PHASES.length &&
    DEVELOPMENT_PHASES.every(
      (days, index) =>
        plan.phases[index]?.days === days &&
        plan.phases[index]?.action.trim() &&
        plan.phases[index]?.measure.trim(),
    )
  );
}

export function SkillGrowthClient({
  initialData,
  today,
  suggestedRoleSlug,
}: SkillGrowthClientProps) {
  const newestCheckin = initialData.checkins[0];
  const latestRole = newestCheckin
    ? initialData.roles.find(
        (role) =>
          roleContextKey(role.id) === roleContextKey(newestCheckin.roleId),
      )
    : null;
  const initialRole =
    latestRole ??
    initialData.roles.find((role) => role.slug === suggestedRoleSlug) ??
    initialData.roles[0];
  const initialRoleCheckin = latestCheckinForRole(
    initialData.checkins,
    initialRole.id,
  );
  const initialRescoreDays = initialRoleCheckin?.rescoreDays ?? 60;

  const [checkins, setCheckins] = useState(() =>
    sortCheckins(initialData.checkins),
  );
  const [selectedContext, setSelectedContext] = useState(
    initialRole.contextKey,
  );
  const [scores, setScores] = useState(() =>
    scoresForRole(initialRole, initialData.checkins),
  );
  const [plans, setPlans] = useState(() =>
    plansForRole(initialRole, initialData.checkins),
  );
  const [focusSkillIds, setFocusSkillIds] = useState(() =>
    focusIdsForRole(initialRole, initialData.checkins),
  );
  const [checkinDate, setCheckinDate] = useState(today);
  const [feedbackPerson, setFeedbackPerson] = useState(
    () => initialRoleCheckin?.feedbackPerson ?? "",
  );
  const [feedbackFrequency, setFeedbackFrequency] = useState(
    () => initialRoleCheckin?.feedbackFrequency ?? "",
  );
  const [rescoreDays, setRescoreDays] = useState<30 | 60 | 90>(
    initialRescoreDays,
  );
  const [nextCheckinDate, setNextCheckinDate] = useState(() =>
    nextDateFor(today, initialRescoreDays),
  );
  const [makeTimeBy, setMakeTimeBy] = useState(
    () => initialRoleCheckin?.makeTimeBy ?? "",
  );
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState("");
  const [isDirty, setIsDirty] = useState(false);
  const [uncertainSaveKey, setUncertainSaveKey] = useState<string | null>(null);
  const { confirm, ConfirmDialog } = useConfirm();

  const selectedRole = roleFromContext(initialData.roles, selectedContext);
  const latestCheckin = latestCheckinForRole(checkins, selectedRole.id);
  const ratedScores = useMemo(
    () =>
      scores.every((score) => score.score !== null && score.target !== null)
        ? (scores as SkillScoreSnapshot[])
        : [],
    [scores],
  );
  const focusCandidates = useMemo(
    () => rankFocusAreas(ratedScores),
    [ratedScores],
  );
  const focusSet = useMemo(() => new Set(focusSkillIds), [focusSkillIds]);
  const eligibleFocusSet = useMemo(
    () => new Set(focusCandidates.map((area) => area.skillId)),
    [focusCandidates],
  );
  const selectedFocusAreas = focusCandidates.filter((area) =>
    focusSet.has(area.skillId),
  );
  const checkinDateError =
    checkinDate && checkinDate > today
      ? "Choose today or an earlier check-in date."
      : undefined;
  const existingCheckinForDate = checkins.find(
    (checkin) =>
      roleContextKey(checkin.roleId) === roleContextKey(selectedRole.id) &&
      checkin.checkinDate === checkinDate,
  );
  const saveKey = `${selectedRole.contextKey}:${checkinDate}`;
  const saveOutcomeIsUncertain = uncertainSaveKey === saveKey;

  const confirmDiscardDraft = useCallback(
    () =>
      confirm({
        title: "Discard unsaved assessment changes?",
        description:
          "Leaving this assessment will discard the scores, evidence, focus choices, and 30/60/90 plan changes that have not been saved.",
        confirmLabel: "Discard and leave",
        variant: "destructive",
      }),
    [confirm],
  );

  useUnsavedChangesGuard({
    active: isDirty,
    confirmLeave: confirmDiscardDraft,
  });

  function markDirty() {
    setIsDirty(true);
    setSaveStatus("");
  }

  async function selectRole(contextKey: string) {
    if (contextKey === selectedContext) return;
    if (
      isDirty &&
      !(await confirm({
        title: "Discard unsaved assessment changes?",
        description:
          "Switching skill libraries will discard the scores, evidence, focus choices, and plan changes that have not been saved.",
        confirmLabel: "Discard and switch",
        variant: "destructive",
      }))
    ) {
      return;
    }

    const role = roleFromContext(initialData.roles, contextKey);
    const latestForRole = latestCheckinForRole(checkins, role.id);
    setSelectedContext(role.contextKey);
    setScores(scoresForRole(role, checkins));
    setPlans(plansForRole(role, checkins));
    setFocusSkillIds(focusIdsForRole(role, checkins));
    setFeedbackPerson(latestForRole?.feedbackPerson ?? "");
    setFeedbackFrequency(latestForRole?.feedbackFrequency ?? "");
    const cadence = latestForRole?.rescoreDays ?? 60;
    setRescoreDays(cadence);
    setNextCheckinDate(nextDateFor(checkinDate, cadence));
    setMakeTimeBy(latestForRole?.makeTimeBy ?? "");
    setSaveStatus("");
    setIsDirty(false);
  }

  function updateScore(
    skillId: string,
    field: EditableField,
    rawValue: string,
  ) {
    const value =
      rawValue.trim() === "" ? null : clampSkillScore(Number(rawValue));
    setScores((current) =>
      current.map((score) =>
        score.skillId === skillId ? { ...score, [field]: value } : score,
      ),
    );
    markDirty();
  }

  function updatePlan(skillId: string, patch: Partial<SkillPlanInput>) {
    setPlans((current) =>
      current.map((plan) =>
        plan.skillId === skillId ? { ...plan, ...patch } : plan,
      ),
    );
    markDirty();
  }

  function updatePhase(
    skillId: string,
    days: 30 | 60 | 90,
    field: "action" | "measure",
    value: string,
  ) {
    setPlans((current) =>
      current.map((plan) =>
        plan.skillId === skillId
          ? {
              ...plan,
              phases: plan.phases.map((phase) =>
                phase.days === days ? { ...phase, [field]: value } : phase,
              ),
            }
          : plan,
      ),
    );
    markDirty();
  }

  function toggleFocus(skillId: string) {
    setFocusSkillIds((current) => {
      if (current.includes(skillId)) {
        return current.filter((id) => id !== skillId);
      }
      if (current.length >= FOCUS_SKILL_MAX) {
        toast.error("Choose no more than four focus skills.");
        return current;
      }
      return [...current, skillId];
    });
    markDirty();
  }

  const focusSelectionIsValid =
    focusSkillIds.length >= FOCUS_SKILL_MIN &&
    focusSkillIds.length <= FOCUS_SKILL_MAX &&
    focusSkillIds.every((skillId) => eligibleFocusSet.has(skillId));
  const canSave =
    ratedScores.length === selectedRole.skills.length &&
    plans.every(completeEvidence) &&
    focusSelectionIsValid &&
    plans.every(
      (plan) => !focusSet.has(plan.skillId) || completeFocusPlan(plan),
    );

  async function saveCheckin() {
    if (
      (existingCheckinForDate || saveOutcomeIsUncertain) &&
      !(await confirm({
        title: saveOutcomeIsUncertain
          ? "Retry this check-in?"
          : "Update this saved check-in?",
        description: saveOutcomeIsUncertain
          ? "The earlier request timed out and may have finished on the server. Retrying can replace that saved check-in for this role and date."
          : `A ${selectedRole.name} check-in already exists for ${formatSkillDate(checkinDate)}. Updating it will replace the saved scores, evidence, focus choices, and plan for that date.`,
        confirmLabel: saveOutcomeIsUncertain
          ? "Retry check-in"
          : "Update check-in",
      }))
    ) {
      return;
    }

    setIsSaving(true);
    setSaveStatus("Saving check-in.");

    try {
      const payload = await apiFetchWithTimeout<{ checkin: SkillCheckin }>(
        "/api/training/growth",
        {
          method: "POST",
          body: JSON.stringify({
            roleId: selectedRole.id,
            checkinDate,
            quarterLabel: quarterForDate(checkinDate),
            feedbackPerson,
            feedbackFrequency,
            rescoreDays,
            nextCheckinDate,
            makeTimeBy,
            focusSkillIds,
            scores: ratedScores.map(({ skillId, score, target }) => ({
              skillId,
              score,
              target,
            })),
            plans,
          }),
        },
      );

      if (!payload?.checkin) {
        throw new Error(
          "The server did not return the saved check-in. Refresh the page and try again.",
        );
      }

      const saved = payload.checkin;
      setCheckins((current) =>
        sortCheckins([
          saved,
          ...current.filter(
            (checkin) =>
              !(
                roleContextKey(checkin.roleId) ===
                  roleContextKey(saved.roleId) &&
                checkin.checkinDate === saved.checkinDate
              ),
          ),
        ]).slice(0, 200),
      );
      setScores(saved.scores);
      setPlans(
        saved.plans.map(
          ({
            skillId,
            description,
            evidence,
            frequency,
            resource,
            feedback,
            phases,
          }) => ({
            skillId,
            description,
            evidence,
            frequency,
            resource,
            feedback,
            phases,
          }),
        ),
      );
      setFocusSkillIds(
        saved.plans.filter((plan) => plan.isFocus).map((plan) => plan.skillId),
      );
      setFeedbackPerson(saved.feedbackPerson ?? "");
      setFeedbackFrequency(saved.feedbackFrequency ?? "");
      setRescoreDays(saved.rescoreDays);
      setNextCheckinDate(nextDateFor(checkinDate, saved.rescoreDays));
      setMakeTimeBy(saved.makeTimeBy ?? "");
      setSaveStatus(
        `Check-in saved for ${formatSkillDate(saved.checkinDate)}.`,
      );
      setIsDirty(false);
      setUncertainSaveKey(null);
      toast.success("Skill Wheel check-in saved.");
    } catch (error) {
      const message = (() => {
        if (
          error instanceof Error &&
          error.message.startsWith("Request timed out")
        ) {
          setUncertainSaveKey(saveKey);
          return "Saving took longer than 20 seconds. Your check-in may not have been saved. Keep this page open and try again.";
        }
        return error instanceof Error
          ? error.message
          : "Your check-in could not be saved. Refresh the page and try again.";
      })();
      setSaveStatus(message);
      toast.error("Skill Wheel check-in was not saved.", {
        description: message,
      });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className={styles.dash}>
      <div className={styles.dashTop}>
        <div className={styles.who}>
          Scoring as <b>{selectedRole.name}</b>
        </div>
        <span className={styles.dashActions}>
          <select
            className={styles.select}
            aria-label="Skill library"
            value={selectedContext}
            onChange={(event) => void selectRole(event.target.value)}
          >
            {initialData.roles.map((role) => (
              <option key={role.contextKey} value={role.contextKey}>
                {role.name}
              </option>
            ))}
          </select>
        </span>
      </div>

      <div className={styles.dashGrid}>
        <div>
          <h2 className={styles.hd}>Score each skill</h2>
          <p className={styles.hint}>
            Score current independence, then set the level the work requires.
            Leave neither field blank.
          </p>
          <details>
            <summary className={styles.hint}>Scoring rubric</summary>
            <p className={styles.hint}>
              0–20 aware · 30–50 completes parts with guidance · 60–70 handles
              normal work independently · 80 documents decisions and recommends
              escalations · 100 teaches and improves the Alleato way
            </p>
          </details>
          <div className={styles.scoretable}>
            {selectedRole.skills.map((skill, skillIndex) => {
              const value = scores.find((score) => score.skillId === skill.id);
              const plan = plans.find((item) => item.skillId === skill.id);
              if (!value || !plan) return null;

              return (
                <div key={skill.id} className={styles.srow}>
                  <div className={styles.sk}>
                    <b>
                      {skillIndex + 1}. {skill.name}
                      {skill.isCore ? " (Core)" : ""}
                    </b>
                    <div className={styles.hint}>{skill.description}</div>
                  </div>
                  <div className={styles.sctrl}>
                    <span
                      aria-hidden="true"
                      className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
                      style={{ gridColumn: "1 / 3" }}
                    >
                      Current
                    </span>
                    <input
                      id={`skill-score-${skill.id}`}
                      aria-label={`${skill.name} current score`}
                      type="number"
                      min={0}
                      max={100}
                      className={styles.num}
                      value={value.score ?? ""}
                      onChange={(event) =>
                        updateScore(skill.id, "score", event.target.value)
                      }
                    />
                    <span className={styles.arrow} aria-hidden="true">
                      →
                    </span>
                    <input
                      id={`skill-target-${skill.id}`}
                      aria-label={`${skill.name} target score`}
                      type="number"
                      min={0}
                      max={100}
                      className={`${styles.num} ${styles.numTarget}`}
                      value={value.target ?? ""}
                      onChange={(event) =>
                        updateScore(skill.id, "target", event.target.value)
                      }
                    />
                  </div>
                  <div>
                    <label
                      htmlFor={`skill-situation-${skill.id}`}
                      className={styles.hint}
                    >
                      Situation
                    </label>
                    <textarea
                      id={`skill-situation-${skill.id}`}
                      aria-label={`${skill.name} evidence situation`}
                      className={styles.evidence}
                      value={plan.evidence.situation}
                      placeholder="Where and when did this happen?"
                      onChange={(event) =>
                        updatePlan(skill.id, {
                          evidence: {
                            ...plan.evidence,
                            situation: event.target.value,
                          },
                        })
                      }
                    />
                    <label
                      htmlFor={`skill-behavior-${skill.id}`}
                      className={styles.hint}
                    >
                      Behavior
                    </label>
                    <textarea
                      id={`skill-behavior-${skill.id}`}
                      aria-label={`${skill.name} evidence behavior`}
                      className={styles.evidence}
                      value={plan.evidence.behavior}
                      placeholder="What did you do without guessing intent?"
                      onChange={(event) =>
                        updatePlan(skill.id, {
                          evidence: {
                            ...plan.evidence,
                            behavior: event.target.value,
                          },
                        })
                      }
                    />
                    <label
                      htmlFor={`skill-outcome-${skill.id}`}
                      className={styles.hint}
                    >
                      Outcome
                    </label>
                    <textarea
                      id={`skill-outcome-${skill.id}`}
                      aria-label={`${skill.name} evidence outcome`}
                      className={styles.evidence}
                      value={plan.evidence.outcome}
                      placeholder="What changed for the work or team?"
                      onChange={(event) =>
                        updatePlan(skill.id, {
                          evidence: {
                            ...plan.evidence,
                            outcome: event.target.value,
                          },
                        })
                      }
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div>
          <h2 className={styles.hd}>Your wheel</h2>
          {ratedScores.length === selectedRole.skills.length ? (
            <SkillWheel roleName={selectedRole.name} scores={ratedScores} />
          ) : (
            <p className={styles.hint}>
              Complete every current and target score to draw the wheel.
            </p>
          )}

          <h2 className={styles.hd} style={{ marginTop: 24 }}>
            Choose 2–4 focus skills
          </h2>
          <p className={styles.hint}>
            Candidates are ordered by role importance × positive score gap. You
            own the final choice.
          </p>
          {focusCandidates.length > 0 ? (
            <div>
              {focusCandidates.map((area, index) => (
                <label key={area.skillId} className={styles.fcard}>
                  <span className={styles.frow}>
                    <input
                      type="checkbox"
                      aria-label={`Select ${area.name} as a focus skill`}
                      checked={focusSet.has(area.skillId)}
                      onChange={() => toggleFocus(area.skillId)}
                    />
                    <span className={styles.frank}>{index + 1}</span>
                    <span className={styles.fname}>{area.name}</span>
                    <span className={styles.fnum}>
                      {area.score} → {area.target}
                    </span>
                    <span className={styles.gaptag}>Gap {area.gap}</span>
                  </span>
                </label>
              ))}
            </div>
          ) : (
            <p className={styles.allset}>
              Complete the scores and set at least two targets above current
              capability to choose focus skills.
            </p>
          )}

          {latestCheckin ? (
            <p className={styles.hint} style={{ marginTop: 16 }}>
              Re-scoring every {latestCheckin.rescoreDays} days · next planned
              for {formatSkillDate(latestCheckin.nextCheckinDate)}
            </p>
          ) : null}
        </div>
      </div>

      <div className={styles.tracker}>
        <h2 className={styles.trkH}>Build the 30/60/90 plan</h2>
        <p className={styles.hint}>
          For each chosen skill, name the repeatable cadence, support, feedback
          path, and what will be done and measured at all three reviews.
        </p>
        {selectedFocusAreas.length > 0 ? (
          selectedFocusAreas.map((area, index) => {
            const plan = plans.find((item) => item.skillId === area.skillId);
            if (!plan) return null;

            return (
              <div key={area.skillId} className={styles.planfld}>
                <div className={styles.planfldH}>
                  <b>
                    {index + 1}. {area.name}
                  </b>
                  <span className={styles.gaptag}>
                    {area.score} → {area.target}
                  </span>
                </div>
                <div className={styles.planfldRow}>
                  <div>
                    <label
                      htmlFor={`skill-frequency-${area.skillId}`}
                      className={styles.hint}
                    >
                      Practice frequency
                    </label>
                    <input
                      id={`skill-frequency-${area.skillId}`}
                      value={plan.frequency}
                      placeholder="Example: every Thursday"
                      onChange={(event) =>
                        updatePlan(area.skillId, {
                          frequency: event.target.value,
                        })
                      }
                    />
                  </div>
                  <div>
                    <label
                      htmlFor={`skill-resource-${area.skillId}`}
                      className={styles.hint}
                    >
                      Resource or support
                    </label>
                    <input
                      id={`skill-resource-${area.skillId}`}
                      value={plan.resource}
                      placeholder="SOP, example, mentor, or project"
                      onChange={(event) =>
                        updatePlan(area.skillId, {
                          resource: event.target.value,
                        })
                      }
                    />
                  </div>
                  <div>
                    <label
                      htmlFor={`skill-feedback-${area.skillId}`}
                      className={styles.hint}
                    >
                      Feedback path
                    </label>
                    <input
                      id={`skill-feedback-${area.skillId}`}
                      value={plan.feedback}
                      placeholder="Who reviews it, and how quickly?"
                      onChange={(event) =>
                        updatePlan(area.skillId, {
                          feedback: event.target.value,
                        })
                      }
                    />
                  </div>
                </div>
                {plan.phases.map((phase) => (
                  <div key={phase.days} className={styles.planfldRow}>
                    <div>
                      <label
                        htmlFor={`skill-${phase.days}-action-${area.skillId}`}
                        className={styles.hint}
                      >
                        {phase.days}-day action
                      </label>
                      <input
                        id={`skill-${phase.days}-action-${area.skillId}`}
                        value={phase.action}
                        placeholder="What exact work will be completed?"
                        onChange={(event) =>
                          updatePhase(
                            area.skillId,
                            phase.days,
                            "action",
                            event.target.value,
                          )
                        }
                      />
                    </div>
                    <div>
                      <label
                        htmlFor={`skill-${phase.days}-measure-${area.skillId}`}
                        className={styles.hint}
                      >
                        {phase.days}-day measure
                      </label>
                      <input
                        id={`skill-${phase.days}-measure-${area.skillId}`}
                        value={phase.measure}
                        placeholder="What evidence proves progress?"
                        onChange={(event) =>
                          updatePhase(
                            area.skillId,
                            phase.days,
                            "measure",
                            event.target.value,
                          )
                        }
                      />
                    </div>
                  </div>
                ))}
              </div>
            );
          })
        ) : (
          <p className={styles.hint}>
            Choose 2–4 positive-gap skills to create the development plan.
          </p>
        )}
      </div>

      <div className={styles.controls} style={{ marginTop: 28 }}>
        <div className={styles.ctl}>
          <label htmlFor="growth-make-time">
            What will you drop, delegate, or make time for?
          </label>
          <textarea
            id="growth-make-time"
            className={styles.evidence}
            value={makeTimeBy}
            onChange={(event) => {
              setMakeTimeBy(event.target.value);
              markDirty();
            }}
          />
        </div>
        <div className={styles.ctl}>
          <label htmlFor="growth-feedback-person">
            Who will give you feedback?
          </label>
          <input
            id="growth-feedback-person"
            value={feedbackPerson}
            onChange={(event) => {
              setFeedbackPerson(event.target.value);
              markDirty();
            }}
          />
        </div>
        <div className={styles.ctl}>
          <label htmlFor="growth-feedback-frequency">How often?</label>
          <input
            id="growth-feedback-frequency"
            value={feedbackFrequency}
            placeholder="Every other Friday"
            onChange={(event) => {
              setFeedbackFrequency(event.target.value);
              markDirty();
            }}
          />
        </div>
        <div className={styles.ctl}>
          <label htmlFor="growth-rescore-days">Re-score cadence</label>
          <select
            id="growth-rescore-days"
            className={styles.select}
            value={String(rescoreDays)}
            onChange={(event) => {
              const days = Number(event.target.value) as 30 | 60 | 90;
              setRescoreDays(days);
              setNextCheckinDate(nextDateFor(checkinDate, days));
              markDirty();
            }}
          >
            <option value="30">30 days</option>
            <option value="60">60 days</option>
            <option value="90">90 days</option>
          </select>
        </div>
        <p className={styles.savenote}>
          Next check-in:{" "}
          <b>
            {nextCheckinDate
              ? formatSkillDate(nextCheckinDate)
              : "Choose a date"}
          </b>
        </p>
      </div>

      <div className={styles.controls}>
        <div className={styles.ctl}>
          <label htmlFor="growth-checkin-date">Check-in date</label>
          <input
            id="growth-checkin-date"
            type="date"
            value={checkinDate}
            max={today}
            onChange={(event) => {
              const value = event.target.value;
              setCheckinDate(value);
              setNextCheckinDate(nextDateFor(value, rescoreDays));
              markDirty();
            }}
          />
          {checkinDateError ? (
            <span className={styles.hint} style={{ color: "#b23b2e" }}>
              {checkinDateError}
            </span>
          ) : null}
        </div>
        <div className={styles.ctlActions}>
          <Button
            type="button"
            className={`${styles.btn} ${styles.btnPrimary}`}
            disabled={
              isSaving || !checkinDate || Boolean(checkinDateError) || !canSave
            }
            onClick={saveCheckin}
          >
            {isSaving
              ? "Saving…"
              : saveOutcomeIsUncertain
                ? "Retry check-in"
                : existingCheckinForDate
                  ? "Update check-in"
                  : "Save check-in"}
          </Button>
        </div>
      </div>
      {existingCheckinForDate || saveOutcomeIsUncertain ? (
        <p className={styles.savenote}>
          {saveOutcomeIsUncertain
            ? "The previous request may have saved. Retrying requires confirmation."
            : "Updating will replace the saved check-in for this role and date."}
        </p>
      ) : null}
      {!canSave ? (
        <p className={styles.hint}>
          Complete every score and situation/behavior/outcome example, choose
          2–4 positive-gap focus skills, and finish every selected 30/60/90 plan
          before saving.
        </p>
      ) : null}
      <p className="sr-only" aria-live="polite">
        {saveStatus}
      </p>

      <div
        className={styles.tracker}
        role="region"
        aria-labelledby="growth-history-heading"
      >
        <h2 id="growth-history-heading" className={styles.trkH}>
          Recent check-ins
        </h2>
        {initialData.historyTruncated ? (
          <p className={styles.hint}>
            Showing the 200 most recent check-ins. Older history remains saved.
          </p>
        ) : null}
        {checkins.length > 0 ? (
          <div className={styles.alist}>
            {checkins.map((checkin, checkinIndex) => {
              const previous = checkins
                .slice(checkinIndex + 1)
                .find(
                  (candidate) =>
                    roleContextKey(candidate.roleId) ===
                    roleContextKey(checkin.roleId),
                );
              const average = averageCurrentScore(checkin.scores);
              const previousAverage = previous
                ? averageCurrentScore(previous.scores)
                : null;
              const delta =
                previousAverage === null ? null : average - previousAverage;
              const previousBySkill = new Map(
                previous?.scores.map((score) => [score.skillId, score.score]) ??
                  [],
              );
              const changedSkills = previous
                ? checkin.scores.filter(
                    (score) =>
                      previousBySkill.get(score.skillId) !== score.score,
                  ).length
                : 0;

              return (
                <details key={checkin.id}>
                  <summary className={styles.arow}>
                    <span className={styles.adate}>
                      {formatSkillDate(checkin.checkinDate)}
                    </span>
                    <span className={styles.arole}>{checkin.roleName}</span>
                    <span className={styles.aavg}>
                      Average {average}
                      {delta === null
                        ? ""
                        : ` · ${delta >= 0 ? "+" : ""}${delta} · ${changedSkills} skills changed`}
                    </span>
                  </summary>
                  <div className={styles.scoretable}>
                    {checkin.scores.map((score) => {
                      const plan = checkin.plans.find(
                        (candidate) => candidate.skillId === score.skillId,
                      );
                      return (
                        <div key={score.skillId} className={styles.srow}>
                          <div className={styles.sk}>
                            <b>{score.name}</b>
                            <div className={styles.hint}>
                              Current {score.score} → target {score.target}
                            </div>
                          </div>
                          <div className={styles.evidence}>
                            <b>Evidence</b>
                            <p>
                              <b>Situation:</b>{" "}
                              {plan?.evidence.situation ??
                                "No saved situation."}
                            </p>
                            <p>
                              <b>Behavior:</b>{" "}
                              {plan?.evidence.behavior ?? "No saved behavior."}
                            </p>
                            <p>
                              <b>Outcome:</b>{" "}
                              {plan?.evidence.outcome ?? "No saved outcome."}
                            </p>
                            {plan?.isFocus ? (
                              <>
                                <p>
                                  <b>Frequency:</b> {plan.frequency}
                                </p>
                                <p>
                                  <b>Resource:</b> {plan.resource}
                                </p>
                                <p>
                                  <b>Feedback:</b> {plan.feedback}
                                </p>
                                {plan.phases.map((phase) => (
                                  <p key={phase.days}>
                                    <b>{phase.days} days:</b> {phase.action} ·{" "}
                                    {phase.measure}
                                  </p>
                                ))}
                              </>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </details>
              );
            })}
          </div>
        ) : (
          <p className={styles.hint}>
            No check-ins yet. Score your skills and save the first one.
          </p>
        )}
      </div>
      {ConfirmDialog}
    </div>
  );
}
