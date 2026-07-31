"use client";

import type { CSSProperties } from "react";

import type { SkillDefinition } from "../skill-growth";
import { levelForScore, RUBRIC_LEVELS } from "./rubric";
import styles from "./assessment.module.css";

export interface StepScoreProps {
  skills: SkillDefinition[];
  scores: Record<string, number | null>;
  evidence: Record<string, string>;
  onScore: (skillId: string, score: number) => void;
  onEvidence: (skillId: string, note: string) => void;
}

/**
 * Step 3 — one slider per skill. The number and the rubric level update as you
 * drag, so the rubric stops being something you look up. Evidence is a single
 * line here; the full situation/behavior/outcome is asked only for the focus
 * skills, in the plan step.
 */
export function StepScore({
  skills,
  scores,
  evidence,
  onScore,
  onEvidence,
}: StepScoreProps) {
  return (
    <>
      <div className={styles.rubric}>
        {RUBRIC_LEVELS.map((level) => (
          <div key={level.label}>
            <b>{level.from}+</b>
            <small>{level.label}</small>
          </div>
        ))}
      </div>

      {skills.map((skill) => {
        const raw = scores[skill.id];
        const isSet = raw !== null && raw !== undefined;
        const value = isSet ? raw : 50;
        const level = levelForScore(value);

        return (
          <div key={skill.id} className={styles.scoreCard}>
            <div className={styles.scoreTop}>
              <span className={styles.scoreName}>
                {skill.name}
                <small>{skill.description}</small>
              </span>
              <span className={styles.scoreValue}>
                {isSet ? <span className={styles.scoreNum}>{value}</span> : null}
                <span
                  className={isSet ? styles.scoreLevel : styles.scoreUnset}
                >
                  {isSet ? level.label : "Not scored"}
                </span>
              </span>
            </div>

            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={value}
              className={styles.slider}
              /* An unscored slider shows an empty track so its parked
                 mid-point can never be mistaken for a score of 50. */
              style={{ "--pct": isSet ? `${value}%` : "0%" } as CSSProperties}
              aria-label={`${skill.name} current score`}
              aria-valuetext={`${value}, ${level.label}`}
              onChange={(event) => onScore(skill.id, Number(event.target.value))}
            />

            <input
              type="text"
              className={styles.evidenceLine}
              value={evidence[skill.id] ?? ""}
              maxLength={500}
              placeholder="One example that proves this score…"
              aria-label={`${skill.name} evidence`}
              onChange={(event) => onEvidence(skill.id, event.target.value)}
            />
          </div>
        );
      })}
    </>
  );
}
