"use client";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { TimeRange } from "./lib/graph-types";
import styles from "./company-brain.module.css";

const RANGES: Array<{ value: TimeRange; label: string }> = [
  { value: "live", label: "Live" },
  { value: "24h", label: "24h" },
  { value: "7d", label: "7d" },
  { value: "30d", label: "30d" },
  { value: "all", label: "All" },
];

export function TimeRangeFilter({ value, onChange }: { value: TimeRange; onChange: (v: TimeRange) => void }) {
  return (
    <ToggleGroup
      type="single"
      value={value}
      onValueChange={(v) => { if (v) onChange(v as TimeRange); }}
      className={styles.seg}
      aria-label="Time range"
    >
      {RANGES.map((r) => (
        <ToggleGroupItem key={r.value} value={r.value} size="sm" className="h-7 rounded-full px-3 text-xs">
          {r.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
