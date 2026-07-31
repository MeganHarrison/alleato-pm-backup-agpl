"use client";

import { useState } from "react";
import Link from "next/link";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import {
  INGESTION_DATA,
  INGESTION_SERIES,
  type IngestionDay,
} from "./ai-os-data";
import styles from "./ai-os.module.css";
import { sourceError, useRagPipeline, type RagPipelineRange } from "../live-data";
import { Button } from "@/components/ui/button";
import { SectionRuleHeading } from "@/components/layout/spacing";

const pipelineRanges: Array<{ value: RagPipelineRange; label: string }> = [
  { value: "24h", label: "24h" },
  { value: "3d", label: "3d" },
  { value: "7d", label: "7d" },
  { value: "30d", label: "30d" },
];

function RagPipelineTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: { label: string; vectorized: number; received: number } }>;
}) {
  const row = payload?.[0]?.payload;
  if (!active || !row) return null;
  return (
    <div className="rounded-md border border-border bg-popover px-3 py-2 shadow-sm">
      <p className="text-sm font-medium text-foreground">{row.label}</p>
      <p className="mt-1 text-xs text-muted-foreground">{row.vectorized.toLocaleString()} vectorized of {row.received.toLocaleString()} received</p>
      <p className="mt-1 text-xs text-muted-foreground">Select to open source records.</p>
    </div>
  );
}

export function RagPipelineChart() {
  const [range, setRange] = useState<RagPipelineRange>("7d");
  const pipeline = useRagPipeline(range);

  return (
    <section className={styles.section} aria-label="RAG pipeline">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs text-muted-foreground">RAG pipeline</p>
          <SectionRuleHeading label="Sources vectorized" className="mt-1" />
          <p className="mt-1 text-sm text-muted-foreground">Choose a source to inspect the records behind the count.</p>
        </div>
        <div className="grid grid-cols-4 rounded-md bg-muted p-1" aria-label="RAG pipeline range">
          {pipelineRanges.map((option) => (
            <Button
              key={option.value}
              type="button"
              onClick={() => setRange(option.value)}
              variant="ghost"
              size="sm"
              className={option.value === range ? "min-h-9 rounded-sm bg-card px-3 text-xs font-medium text-foreground shadow-xs" : "min-h-9 rounded-sm px-3 text-xs text-muted-foreground hover:text-foreground"}
              aria-pressed={option.value === range}
            >
              {option.label}
            </Button>
          ))}
        </div>
      </div>

      {pipeline.isLoading ? <p className="py-12 text-sm text-muted-foreground">Loading vectorization read-back.</p> : null}
      {pipeline.isError ? <div className="py-8 text-sm"><p className="font-medium text-destructive">RAG pipeline data could not load.</p><p className="mt-1 text-muted-foreground">{sourceError(pipeline.error, "RAG pipeline")}</p><Link href="/rag?tab=lifecycle" className="mt-3 inline-block font-medium text-primary hover:underline">Open RAG Health</Link></div> : null}
      {pipeline.data ? (
        <div className="h-72 w-full" role="group" aria-label={`Vectorized source records for ${range}`}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={pipeline.data.sources} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 3" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
              <Tooltip content={<RagPipelineTooltip />} cursor={{ fill: "hsl(var(--muted))" }} />
              <Bar
                dataKey="vectorized"
                name="Vectorized"
                fill="hsl(var(--primary))"
                radius={[3, 3, 0, 0]}
                cursor="pointer"
                onClick={(row) => { window.location.assign(row.sourceTableHref); }}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : null}
    </section>
  );
}

const CW = 560;
const CH = 320;
const PAD = { t: 12, r: 40, b: 30, l: 34 };
const PLOT_W = CW - PAD.l - PAD.r;
const PLOT_H = CH - PAD.t - PAD.b;

function niceMax(v: number): number {
  if (v <= 0) return 10;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / p;
  const s = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return s * p;
}

interface ChipProps {
  active: boolean;
  color: string;
  label: string;
  line?: boolean;
  onToggle: () => void;
}

function LegendChip({ active, color, label, line, onToggle }: ChipProps) {
  return (
    <span
      role="button"
      tabIndex={0}
      onClick={onToggle}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onToggle();
        }
      }}
      className={`${styles.legendBtn} ${active ? "" : styles.legendOff}`}
    >
      <i
        className={`${styles.legendSw} ${line ? styles.legendSwLine : ""}`}
        style={{ background: color }}
      />
      <span className={styles.legendName}>{label}</span>
    </span>
  );
}

export function IngestionChart() {
  const [hidden, setHidden] = useState<Record<string, boolean>>({});
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const activeSeries = INGESTION_SERIES.filter((s) => !hidden[s.key]);
  const tasksVisible = !hidden.tasks;

  let maxStack = 0;
  for (const d of INGESTION_DATA) {
    let t = 0;
    for (const s of activeSeries) t += d[s.key as keyof IngestionDay] as number;
    if (t > maxStack) maxStack = t;
  }
  const yMax = niceMax(maxStack || 10);
  const tMax = niceMax(Math.max(...INGESTION_DATA.map((d) => d.tasks)) || 10);

  const n = INGESTION_DATA.length;
  const slot = PLOT_W / n;
  const barW = Math.min(22, slot * 0.56);
  const x = (i: number) => PAD.l + slot * i + slot / 2;
  const yL = (v: number) => PAD.t + PLOT_H - (v / yMax) * PLOT_H;
  const yR = (v: number) => PAD.t + PLOT_H - (v / tMax) * PLOT_H;
  const ticks = 4;

  const toggle = (key: string) => setHidden((h) => ({ ...h, [key]: !h[key] }));
  const hovered = hoverIdx != null ? INGESTION_DATA[hoverIdx] : null;

  let taskPath = "";
  INGESTION_DATA.forEach((d, i) => {
    taskPath += `${i ? " L" : "M"}${x(i)} ${yR(d.tasks)}`;
  });

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-x-3.5 gap-y-2">
        {INGESTION_SERIES.map((s) => (
          <LegendChip
            key={s.key}
            active={!hidden[s.key]}
            color={`var(${s.varName})`}
            label={s.name}
            onToggle={() => toggle(s.key)}
          />
        ))}
        <LegendChip active={tasksVisible} color="var(--aios-line)" label="Tasks" line onToggle={() => toggle("tasks")} />
      </div>

      <div className={styles.chartHolder}>
        <svg className={styles.chartSvg} viewBox={`0 0 ${CW} ${CH}`} role="img" aria-label="Records vectorized per day by source with tasks generated overlaid">
          {Array.from({ length: ticks + 1 }).map((_, g) => {
            const gy = yL((yMax / ticks) * g);
            return (
              <g key={g}>
                <line className={styles.gridLine} x1={PAD.l} y1={gy} x2={PAD.l + PLOT_W} y2={gy} />
                <text className={styles.axisNum} x={PAD.l - 7} y={gy + 3} textAnchor="end">{Math.round((yMax / ticks) * g)}</text>
                <text className={`${styles.axisNum} ${styles.axisNumRight}`} x={PAD.l + PLOT_W + 7} y={gy + 3} textAnchor="start">{Math.round((tMax / ticks) * g)}</text>
              </g>
            );
          })}

          {INGESTION_DATA.map((d, i) => {
            const cx = x(i);
            let yc = PAD.t + PLOT_H;
            return (
              <g key={d.date}>
                {activeSeries.map((s, si) => {
                  const v = d[s.key as keyof IngestionDay] as number;
                  if (v <= 0) return null;
                  const h = (v / yMax) * PLOT_H;
                  yc -= h;
                  let top = true;
                  for (let j = si + 1; j < activeSeries.length; j++) {
                    if ((d[activeSeries[j].key as keyof IngestionDay] as number) > 0) { top = false; break; }
                  }
                  return <rect key={s.key} x={cx - barW / 2} y={yc} width={barW} height={h} fill={`var(${s.varName})`} rx={top ? 2.5 : 0} />;
                })}
              </g>
            );
          })}

          {INGESTION_DATA.map((d, i) => (
            <text key={d.date} className={`${styles.xLbl} ${d.weekend ? styles.xLblWeekend : ""}`} x={x(i)} y={CH - 12} textAnchor="middle">
              {d.date.replace("Jul ", "")}
            </text>
          ))}

          {tasksVisible && (
            <>
              <path className={styles.taskLine} d={taskPath} />
              {INGESTION_DATA.map((d, i) => (
                <circle key={d.date} className={styles.taskDot} cx={x(i)} cy={yR(d.tasks)} r={2.6} />
              ))}
            </>
          )}

          {INGESTION_DATA.map((d, i) => (
            <g key={d.date}>
              <rect className={`${styles.colGuide} ${hoverIdx === i ? styles.colGuideOn : ""}`} x={x(i) - 0.5} y={PAD.t} width={1} height={PLOT_H} />
              <rect
                className={styles.colHit}
                x={PAD.l + slot * i}
                y={PAD.t}
                width={slot}
                height={PLOT_H}
                onMouseEnter={() => setHoverIdx(i)}
                onMouseLeave={() => setHoverIdx((cur) => (cur === i ? null : cur))}
              />
            </g>
          ))}
        </svg>

        {hovered && (
          <div
            className={`${styles.tip} ${styles.tipShow}`}
            style={{
              left: `${Math.min(Math.max(((hoverIdx! + 0.5) / n) * 100, 8), 78)}%`,
              top: 6,
            }}
          >
            <div className={styles.tipDate}>{hovered.date}</div>
            {INGESTION_SERIES.filter((s) => (hovered[s.key as keyof IngestionDay] as number) > 0).map((s) => (
              <div key={s.key} className={styles.tipRow}>
                <span className={styles.tipSw} style={{ background: `var(${s.varName})` }} />
                <span className={styles.tipName}>{s.name}</span>
                <span className={styles.tipVal}>{hovered[s.key as keyof IngestionDay] as number}</span>
              </div>
            ))}
            <div className={styles.tipSep} />
            <div className={styles.tipRow}>
              <span className={styles.tipName}>Total</span>
              <span className={styles.tipVal}>
                {INGESTION_SERIES.reduce((a, s) => a + (hovered[s.key as keyof IngestionDay] as number), 0)}
              </span>
            </div>
            <div className={styles.tipRow}>
              <span className={styles.tipSw} style={{ height: 3, background: "var(--aios-line)" }} />
              <span className={styles.tipName}>Tasks</span>
              <span className={styles.tipVal}>{hovered.tasks}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
