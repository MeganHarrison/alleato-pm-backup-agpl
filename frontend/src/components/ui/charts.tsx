'use client';

import * as React from 'react';
import {
  ResponsiveContainer,
  BarChart as ReBarChart,
  Bar,
  AreaChart as ReAreaChart,
  Area,
  LineChart as ReLineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

type ChartDataRecord = Record<string, string | number>;

interface BaseChartProps {
  /** Array of objects. Each must have a `date` key; remaining keys are series values. */
  data: ChartDataRecord[];
  /** Data keys to plot. Defaults to all non-date keys. */
  categories?: string[];
  /** CSS height string, e.g. "300px" */
  height?: string;
  /** Per-series colors. Accepts any CSS color string or `"primary"`. */
  colors?: string[];
  /** Format value labels in tooltip and y-axis. */
  valueFormatter?: (value: number) => string;
  /** Y-axis label column width in px. */
  yAxisWidth?: number;
  /** Stack series cumulatively. */
  stack?: boolean;
  className?: string;
}

// ─── Color resolution ─────────────────────────────────────────────────────────

const DEFAULT_COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
];

function resolveColor(color: string | undefined, index: number): string {
  if (!color) return DEFAULT_COLORS[index % DEFAULT_COLORS.length];
  if (color === 'primary') return 'hsl(var(--primary))';
  if (color === 'muted') return 'hsl(var(--muted-foreground))';
  return color;
}

function getCategories(data: ChartDataRecord[], cats?: string[]): string[] {
  if (cats?.length) return cats;
  if (!data.length) return [];
  return Object.keys(data[0]).filter((k) => k !== 'date');
}

// ─── Custom Tooltip ───────────────────────────────────────────────────────────

function ChartTooltip({
  active,
  payload,
  label,
  valueFormatter,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
  valueFormatter?: (v: number) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 shadow-sm">
      <p className="mb-1.5 text-xs font-medium text-foreground">{label}</p>
      {payload.map((entry, i) => (
        <div key={i} className="flex items-center gap-2 text-xs">
          <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: entry.color }} />
          <span className="text-muted-foreground">{entry.name}</span>
          <span className="ml-auto font-medium text-foreground tabular-nums">
            {valueFormatter ? valueFormatter(entry.value) : entry.value}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Shared axis/grid config ──────────────────────────────────────────────────

const xAxisProps = {
  dataKey: 'date',
  tick: { fontSize: 11, fill: 'hsl(var(--muted-foreground))' },
  tickLine: false,
  axisLine: false,
} as const;

function yAxisProps(width: number) {
  return {
    width,
    tick: { fontSize: 11, fill: 'hsl(var(--muted-foreground))' },
    tickLine: false,
    axisLine: false,
  };
}

const gridProps = {
  strokeDasharray: '3 3',
  stroke: 'hsl(var(--border))',
  vertical: false,
} as const;

const legendProps = {
  wrapperStyle: { fontSize: 11, color: 'hsl(var(--muted-foreground))' },
  iconType: 'circle' as const,
  iconSize: 8,
};

// ─── BarChart ─────────────────────────────────────────────────────────────────

export function BarChart({
  data,
  categories,
  height = '300px',
  colors,
  valueFormatter,
  yAxisWidth = 60,
  stack = false,
  className,
}: BaseChartProps) {
  const cats = getCategories(data, categories);

  return (
    <div className={cn('w-full', className)} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <ReBarChart data={data} barCategoryGap="30%">
          <CartesianGrid {...gridProps} />
          <XAxis {...xAxisProps} />
          <YAxis {...yAxisProps(yAxisWidth)} tickFormatter={valueFormatter} />
          <Tooltip
            content={<ChartTooltip valueFormatter={valueFormatter} />}
            cursor={{ fill: 'hsl(var(--muted))', radius: 4 }}
          />
          {cats.length > 1 && <Legend {...legendProps} />}
          {cats.map((cat, i) => (
            <Bar
              key={cat}
              dataKey={cat}
              fill={resolveColor(colors?.[i], i)}
              radius={[3, 3, 0, 0]}
              stackId={stack ? 'stack' : undefined}
            />
          ))}
        </ReBarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── AreaChart ────────────────────────────────────────────────────────────────

export function AreaChart({
  data,
  categories,
  height = '300px',
  colors,
  valueFormatter,
  yAxisWidth = 60,
  stack = false,
  className,
}: BaseChartProps) {
  const cats = getCategories(data, categories);

  return (
    <div className={cn('w-full', className)} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <ReAreaChart data={data}>
          <defs>
            {cats.map((cat, i) => {
              const color = resolveColor(colors?.[i], i);
              return (
                <linearGradient key={cat} id={`area-grad-${cat}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={color} stopOpacity={0.18} />
                  <stop offset="95%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              );
            })}
          </defs>
          <CartesianGrid {...gridProps} />
          <XAxis {...xAxisProps} />
          <YAxis {...yAxisProps(yAxisWidth)} tickFormatter={valueFormatter} />
          <Tooltip content={<ChartTooltip valueFormatter={valueFormatter} />} />
          {cats.length > 1 && <Legend {...legendProps} />}
          {cats.map((cat, i) => {
            const color = resolveColor(colors?.[i], i);
            return (
              <Area
                key={cat}
                type="monotone"
                dataKey={cat}
                stroke={color}
                strokeWidth={2}
                fill={`url(#area-grad-${cat})`}
                stackId={stack ? 'stack' : undefined}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0 }}
              />
            );
          })}
        </ReAreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── LineChart ────────────────────────────────────────────────────────────────

export function LineChart({
  data,
  categories,
  height = '300px',
  colors,
  valueFormatter,
  yAxisWidth = 60,
  className,
}: Omit<BaseChartProps, 'stack'>) {
  const cats = getCategories(data, categories);

  return (
    <div className={cn('w-full', className)} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <ReLineChart data={data}>
          <CartesianGrid {...gridProps} />
          <XAxis {...xAxisProps} />
          <YAxis {...yAxisProps(yAxisWidth)} tickFormatter={valueFormatter} />
          <Tooltip content={<ChartTooltip valueFormatter={valueFormatter} />} />
          {cats.length > 1 && <Legend {...legendProps} />}
          {cats.map((cat, i) => (
            <Line
              key={cat}
              type="monotone"
              dataKey={cat}
              stroke={resolveColor(colors?.[i], i)}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0 }}
            />
          ))}
        </ReLineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Sparkline ────────────────────────────────────────────────────────────────

export function Sparkline({
  data,
  categories,
  height = '60px',
  colors,
  stack = false,
  className,
}: Omit<BaseChartProps, 'valueFormatter' | 'yAxisWidth'>) {
  const cats = getCategories(data, categories);

  return (
    <div className={cn('w-full', className)} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <ReAreaChart data={data} margin={{ top: 2, right: 0, bottom: 2, left: 0 }}>
          <defs>
            {cats.map((cat, i) => {
              const color = resolveColor(colors?.[i], i);
              return (
                <linearGradient key={cat} id={`spark-grad-${cat}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={color} stopOpacity={0.2} />
                  <stop offset="95%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              );
            })}
          </defs>
          {cats.map((cat, i) => {
            const color = resolveColor(colors?.[i], i);
            return (
              <Area
                key={cat}
                type="monotone"
                dataKey={cat}
                stroke={color}
                strokeWidth={1.5}
                fill={`url(#spark-grad-${cat})`}
                stackId={stack ? 'stack' : undefined}
                dot={false}
                activeDot={false}
                isAnimationActive={false}
              />
            );
          })}
        </ReAreaChart>
      </ResponsiveContainer>
    </div>
  );
}
