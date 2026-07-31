import styles from "@/app/(main)/training/training-theme.module.css";
import type { SkillScoreSnapshot } from "./skill-growth";

export interface SkillWheelProps {
  roleName: string;
  scores: SkillScoreSnapshot[];
}

const SIZE = 320;
const CENTER = SIZE / 2;
const RADIUS = 112;

function pointFor(
  index: number,
  total: number,
  value: number,
): [number, number] {
  const angle = -Math.PI / 2 + (index / total) * Math.PI * 2;
  const distance = RADIUS * (value / 100);
  const stableCoordinate = (coordinate: number) =>
    Number(coordinate.toFixed(3));
  return [
    stableCoordinate(CENTER + Math.cos(angle) * distance),
    stableCoordinate(CENTER + Math.sin(angle) * distance),
  ];
}

function formatCoordinate(value: number) {
  return value.toFixed(1);
}

function polygonPoints(
  scores: SkillScoreSnapshot[],
  field: "score" | "target",
) {
  return scores
    .map((score, index) =>
      pointFor(index, scores.length, score[field])
        .map((value) => value.toFixed(1))
        .join(","),
    )
    .join(" ");
}

function ringPoints(total: number, percentage: number) {
  return Array.from({ length: total }, (_, index) =>
    pointFor(index, total, percentage)
      .map((value) => value.toFixed(1))
      .join(","),
  ).join(" ");
}

export function SkillWheel({ roleName, scores }: SkillWheelProps) {
  const summary = scores
    .map((score) => `${score.name}: ${score.score}, target ${score.target}`)
    .join("; ");

  return (
    <figure className={styles.wheelwrap}>
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        role="img"
        aria-labelledby="skill-wheel-title"
        aria-describedby="skill-wheel-description"
        data-testid="skill-wheel"
      >
        {[25, 50, 75, 100].map((percentage) => (
          <polygon
            key={percentage}
            points={ringPoints(scores.length, percentage)}
            fill="none"
            stroke="var(--line)"
            strokeWidth={percentage === 100 ? 1.25 : 0.75}
          />
        ))}

        {scores.map((score, index) => {
          const [x, y] = pointFor(index, scores.length, 100);
          return (
            <line
              key={score.skillId}
              x1={CENTER}
              y1={CENTER}
              x2={formatCoordinate(x)}
              y2={formatCoordinate(y)}
              stroke="var(--line)"
              strokeWidth="0.75"
            />
          );
        })}
        {scores.map((score, index) => {
          const [x, y] = pointFor(index, scores.length, 116);
          return (
            <text
              key={`${score.skillId}-axis-label`}
              x={formatCoordinate(x)}
              y={formatCoordinate(y)}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="var(--lgrey)"
              fontSize="10"
              fontWeight={600}
              aria-hidden="true"
            >
              {index + 1}
            </text>
          );
        })}

        <polygon
          points={polygonPoints(scores, "target")}
          fill="none"
          stroke="var(--black)"
          strokeWidth="1.5"
          strokeDasharray="5 5"
          data-testid="skill-wheel-target"
        />
        <polygon
          points={polygonPoints(scores, "score")}
          fill="rgba(253, 86, 2, 0.18)"
          stroke="var(--orange)"
          strokeWidth="2"
          data-testid="skill-wheel-current"
        />
      </svg>

      <figcaption className={styles.wheelLegend}>
        <span id="skill-wheel-title" className="sr-only">
          {roleName} Skill Wheel
        </span>
        <span id="skill-wheel-description" className="sr-only">
          {summary}
        </span>
        <span className={`${styles.lg} ${styles.lgFill}`}>Current score</span>
        <span className={`${styles.lg} ${styles.lgRing}`}>
          Target (dashed)
        </span>
      </figcaption>
    </figure>
  );
}
