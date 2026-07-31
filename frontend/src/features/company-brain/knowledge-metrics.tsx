"use client";

import { useEffect, useRef, useState } from "react";

import styles from "./company-brain.module.css";

export interface Metric { key: string; value: number; label: string; tone?: "accent" | "good"; }

const easeOut = (p: number) => 1 - Math.pow(1 - p, 3);

/** Compact, integrated metrics strip with a count-up on mount and live bumps. */
export function KnowledgeMetrics({ metrics }: { metrics: Metric[] }) {
  const [display, setDisplay] = useState<Record<string, number>>(() =>
    Object.fromEntries(metrics.map((m) => [m.key, 0])),
  );
  const rafRef = useRef(0);
  // capture the mount-time targets so the count-up effect can run once without
  // depending on the (live-updating) metrics array.
  const targetsRef = useRef(metrics);
  useEffect(() => { targetsRef.current = metrics; }, [metrics]);

  useEffect(() => {
    const start = performance.now();
    const dur = 1200;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / dur);
      const e = easeOut(p);
      setDisplay(Object.fromEntries(targetsRef.current.map((m) => [m.key, Math.round(m.value * e)])));
      if (p < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  // keep live values in sync after the count-up finishes (parent bumps `metrics`)
  useEffect(() => {
    setDisplay((prev) => {
      const next = { ...prev };
      let settled = true;
      metrics.forEach((m) => { if (prev[m.key] !== undefined && prev[m.key] >= m.value - 6) next[m.key] = m.value; else settled = false; });
      return settled ? next : prev;
    });
  }, [metrics]);

  return (
    <div className={styles.metrics} role="group" aria-label="Knowledge metrics">
      {metrics.map((m) => (
        <div key={m.key} className={styles.metric}>
          <div className={`${styles.metricV} ${m.tone ? styles[m.tone] : ""}`}>
            {(display[m.key] ?? 0).toLocaleString()}
          </div>
          <div className={styles.metricL}>{m.label}</div>
        </div>
      ))}
    </div>
  );
}
