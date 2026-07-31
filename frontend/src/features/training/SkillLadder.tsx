"use client";

import { useState, type CSSProperties } from "react";

import styles from "@/app/(main)/training/hub-theme.module.css";

import { DEFAULT_LADDER_INDEX, LADDER } from "./ladder-content";

/**
 * The shared definition of growth: five rungs, widening left to right, with the
 * selected rung explained in full beside them. Opens on Solo because that is the
 * bar the Skill Wheel counts against — the two sections are describing the same
 * scale, and this is where a reader finds out what the scale means.
 */
export function SkillLadder() {
  const [activeIndex, setActiveIndex] = useState(DEFAULT_LADDER_INDEX);
  const active = LADDER[activeIndex];

  return (
    <div className={styles.ladder}>
      <div
        className={styles.ladderSteps}
        role="group"
        aria-label="Proficiency levels"
      >
        {LADDER.map((level, index) => (
          <button
            key={level.name}
            type="button"
            className={styles.ladderStep}
            style={{ "--step": index } as CSSProperties}
            aria-pressed={index === activeIndex}
            aria-controls="ladder-detail"
            onClick={() => setActiveIndex(index)}
          >
            <span className={styles.ladderStepValue}>{level.value}</span>
            <span className={styles.ladderStepText}>
              <b>{level.name}</b>
              <small>{level.short}</small>
            </span>
          </button>
        ))}
      </div>

      <aside
        className={styles.ladderDetail}
        id="ladder-detail"
        aria-live="polite"
      >
        <span className={styles.ladderDetailEyebrow}>
          {active.value} &middot; {active.name}
        </span>
        <h3 className={styles.ladderDetailTitle}>{active.claim}</h3>
        <p className={styles.ladderDetailBody}>{active.detail}</p>
        <p className={styles.ladderReady}>
          <span className={styles.ladderReadyMark} aria-hidden="true">
            ✓
          </span>
          <span>
            <b>Ready looks like:</b> {active.readyLooksLike}
          </span>
        </p>
      </aside>
    </div>
  );
}
