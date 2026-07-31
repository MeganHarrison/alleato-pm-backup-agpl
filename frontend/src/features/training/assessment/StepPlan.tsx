"use client";

import type { RankedFocusArea } from "../skill-growth";
import styles from "./assessment.module.css";

export interface FocusPlanDraft {
  /** The concrete, repeatable action. Stored as the 30-day phase action. */
  rep: string;
  /** How often the rep happens. Stored as the plan frequency. */
  frequency: string;
  /** What will prove it worked. Stored as the 30-day phase measure. */
  proof: string;
}

export interface StepPlanProps {
  focusAreas: RankedFocusArea[];
  plans: Record<string, FocusPlanDraft>;
  makeTimeBy: string;
  onPlan: (skillId: string, patch: Partial<FocusPlanDraft>) => void;
  onMakeTimeBy: (value: string) => void;
}

/**
 * Step 6 — one plan per focus skill. Three fields, not a 30/60/90 grid: a
 * vague plan for three horizons is worth less than one rep you will actually
 * do, and the later horizons get set when you re-score.
 */
export function StepPlan({
  focusAreas,
  plans,
  makeTimeBy,
  onPlan,
  onMakeTimeBy,
}: StepPlanProps) {
  return (
    <>
      {focusAreas.map((area) => {
        const plan = plans[area.skillId] ?? { rep: "", frequency: "", proof: "" };
        return (
          <div key={area.skillId} className={styles.planCard}>
            <h2 className={styles.planTitle}>{area.name}</h2>
            <span className={styles.planGap}>
              {area.score} → {area.target}
            </span>
            <div className={styles.planFields}>
              <div className={`${styles.field} ${styles.planFull}`}>
                <label htmlFor={`rep-${area.skillId}`}>The rep</label>
                <input
                  id={`rep-${area.skillId}`}
                  className={styles.control}
                  value={plan.rep}
                  maxLength={500}
                  placeholder="What exactly will you do?"
                  onChange={(event) =>
                    onPlan(area.skillId, { rep: event.target.value })
                  }
                />
              </div>
              <div className={styles.field}>
                <label htmlFor={`freq-${area.skillId}`}>How often</label>
                <input
                  id={`freq-${area.skillId}`}
                  className={styles.control}
                  value={plan.frequency}
                  maxLength={160}
                  placeholder="Every Tuesday, 30 minutes"
                  onChange={(event) =>
                    onPlan(area.skillId, { frequency: event.target.value })
                  }
                />
              </div>
              <div className={styles.field}>
                <label htmlFor={`proof-${area.skillId}`}>Proof it worked</label>
                <input
                  id={`proof-${area.skillId}`}
                  className={styles.control}
                  value={plan.proof}
                  maxLength={300}
                  placeholder="What evidence will exist?"
                  onChange={(event) =>
                    onPlan(area.skillId, { proof: event.target.value })
                  }
                />
              </div>
            </div>
          </div>
        );
      })}

      <div className={styles.field} style={{ maxWidth: "none", marginTop: 24 }}>
        <label htmlFor="make-time">
          What you will drop to make the time
        </label>
        <textarea
          id="make-time"
          className={styles.control}
          rows={3}
          maxLength={300}
          value={makeTimeBy}
          placeholder="Time has to come from somewhere. Name it."
          onChange={(event) => onMakeTimeBy(event.target.value)}
        />
      </div>
    </>
  );
}
