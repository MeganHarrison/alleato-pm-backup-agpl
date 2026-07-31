"use client";

import styles from "@/app/(main)/training/hub-theme.module.css";

import {
  countAtLevel,
  SOLO_THRESHOLD,
  thresholdRadius,
  wedgeFillD,
  wedgeLabelPos,
  wedgeTrackD,
  WHEEL,
  type RoleWheelExample,
} from "./role-wheel-data";

export interface RoleWheelProps {
  role: RoleWheelExample;
  /** Current 0-100 score per skill (index-aligned with role.skills). */
  values: number[];
  /** Skill indices to emphasize; everything else recedes. */
  highlight?: number[];
  /** Fade non-highlighted wedges. */
  dimOthers?: boolean;
  /** Unique prefix so multiple wheels on one page keep valid aria ids. */
  idPrefix: string;
  /** Skill hovered from an outside control (e.g. accordion list). */
  activeSkill?: number | null;
  onSkillHover?: (index: number | null) => void;
  className?: string;
}

const CENTER = WHEEL.center;

export function RoleWheel({
  role,
  values,
  highlight,
  dimOthers = false,
  idPrefix,
  activeSkill = null,
  onSkillHover,
  className,
}: RoleWheelProps) {
  const total = role.skills.length;
  const titleId = `${idPrefix}-title`;
  const descId = `${idPrefix}-desc`;
  const count = countAtLevel(values);
  const highlightSet = new Set(highlight ?? []);

  return (
    <svg
      viewBox={`0 0 ${WHEEL.size} ${WHEEL.size}`}
      role="img"
      aria-labelledby={titleId}
      aria-describedby={descId}
      className={className}
      data-testid="role-wheel"
    >
      <title id={titleId}>{`${role.name} skill wheel`}</title>
      <desc id={descId}>
        {role.skills
          .map((skill, index) => `${skill.name}: ${values[index]} out of 100`)
          .join("; ")}
      </desc>

      {[0.33, 0.66, 1].map((fraction) => (
        <circle
          key={fraction}
          cx={CENTER}
          cy={CENTER}
          r={
            WHEEL.innerRadius +
            (WHEEL.outerRadius - WHEEL.innerRadius) * fraction
          }
          fill="none"
          className={styles.demoWheelRing}
        />
      ))}

      {role.skills.map((skill, index) => {
        const [labelX, labelY] = wedgeLabelPos(index, total);
        const isHighlighted = highlightSet.has(index);
        const isActive = activeSkill === index;
        const recede = dimOthers && !isHighlighted && !isActive;
        return (
          <g
            key={skill.name}
            data-skill-index={index}
            style={{
              opacity: recede ? 0.32 : 1,
              // Only add a CSS transition in interactive (accordion) mode —
              // in the GSAP story the timeline owns opacity every tick.
              transition: onSkillHover
                ? "opacity 220ms cubic-bezier(0.16,1,0.3,1)"
                : undefined,
              cursor: onSkillHover ? "pointer" : undefined,
            }}
            onMouseEnter={onSkillHover ? () => onSkillHover(index) : undefined}
            onMouseLeave={onSkillHover ? () => onSkillHover(null) : undefined}
          >
            <path
              d={wedgeTrackD(index, total)}
              className={styles.demoWheelTrack}
            />
            <path
              data-wedge={index}
              d={wedgeFillD(index, total, values[index])}
              className={styles.demoWheelFill}
              style={
                isHighlighted || isActive
                  ? { filter: "saturate(1.15)" }
                  : undefined
              }
            />
            <text
              x={labelX}
              y={labelY}
              textAnchor="middle"
              dominantBaseline="middle"
              className={styles.demoWheelLabel}
            >
              {index + 1}
            </text>
          </g>
        );
      })}

      {/* The Solo bar the centre readout counts against. Drawn AFTER the
          wedges so a filled wedge never paints over the threshold — it has to
          stay readable as a line the wedges are trying to cross. */}
      <circle
        cx={CENTER}
        cy={CENTER}
        r={thresholdRadius()}
        fill="none"
        className={styles.demoWheelThreshold}
      />
      <text
        x={CENTER}
        y={CENTER - thresholdRadius() - 7}
        textAnchor="middle"
        className={styles.demoWheelThresholdLabel}
      >
        {`SOLO · ${SOLO_THRESHOLD}`}
      </text>

      <circle
        cx={CENTER}
        cy={CENTER}
        r={WHEEL.innerRadius - 5}
        className={styles.demoWheelCore}
      />
      <text
        data-wheel-count
        x={CENTER}
        y={CENTER - 8}
        textAnchor="middle"
        className={styles.demoWheelScore}
      >
        {count}
      </text>
      <text
        x={CENTER}
        y={CENTER + 20}
        textAnchor="middle"
        className={styles.demoWheelOf}
      >
        of {total}
      </text>
      <text
        x={CENTER}
        y={CENTER + 38}
        textAnchor="middle"
        className={styles.demoWheelCaption}
      >
        AT SOLO
      </text>
    </svg>
  );
}
