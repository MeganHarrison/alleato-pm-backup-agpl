import styles from "@/app/(main)/training/training-theme.module.css";

import { CAPABILITY_LADDER, rungForScore } from "./coaching-session";

export interface CapabilityLadderProps {
  /** Current score (0–100); marks the "Now" rung. */
  current?: number | null;
  /** Target score (0–100); marks the "Target" rung. */
  target?: number | null;
}

/**
 * The 0–100 rubric rendered as five named rungs — the human-readable
 * translation of the score. Current and target scores mark their rungs.
 */
export function CapabilityLadder({ current, target }: CapabilityLadderProps) {
  const currentSlug = current != null ? rungForScore(current).slug : null;
  const targetSlug = target != null ? rungForScore(target).slug : null;

  return (
    <div className={styles.ladder}>
      <div className={styles.ladderTrack}>
        {CAPABILITY_LADDER.map((rung) => {
          const isCurrent = currentSlug === rung.slug;
          const isTarget = targetSlug === rung.slug && !isCurrent;
          const cls = [
            styles.rung,
            isCurrent ? styles.rungCurrent : "",
            isTarget ? styles.rungTarget : "",
          ]
            .filter(Boolean)
            .join(" ");
          return (
            <div key={rung.slug} className={cls}>
              {isCurrent && (
                <span className={`${styles.rungTag} ${styles.rungTagCurrent}`}>
                  Now
                </span>
              )}
              {isTarget && (
                <span className={`${styles.rungTag} ${styles.rungTagTarget}`}>
                  Target
                </span>
              )}
              <div className={styles.rungNum}>Rung {rung.index}</div>
              <div className={styles.rungLabel}>{rung.label}</div>
              <div className={styles.rungRange}>{rung.rangeLabel}</div>
              <div className={styles.rungDesc}>{rung.description}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
