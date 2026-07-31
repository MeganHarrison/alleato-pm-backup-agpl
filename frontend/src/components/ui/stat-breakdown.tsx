'use client';

import * as React from 'react';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface StatBreakdownItem {
  name: string;
  value: string;
  percentageValue: number;
}

export interface StatBreakdownProps {
  name: string;
  total: string;
  details?: StatBreakdownItem[];
  className?: string;
}

// ─── StatBreakdown ────────────────────────────────────────────────────────────
// Metric name + large total + optional breakdown rows with progress bars.
// No outer card wrapper — compose inside StatBreakdownCard or your own container.

export function StatBreakdown({ name, total, details = [], className }: StatBreakdownProps) {
  return (
    <div className={cn('space-y-4', className)}>
      <div>
        <p className="text-xs text-muted-foreground">{name}</p>
        <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{total}</p>
      </div>
      {details.length > 0 && (
        <div className="space-y-3">
          {details.map((item) => (
            <div key={item.name} className="space-y-1.5">
              <div className="flex items-center justify-between gap-4 text-xs">
                <span className="truncate text-muted-foreground">{item.name}</span>
                <span className="shrink-0 tabular-nums font-medium text-foreground">
                  {item.value}{' '}
                  <span className="font-normal text-muted-foreground">({item.percentageValue}%)</span>
                </span>
              </div>
              <Progress value={item.percentageValue} className="h-1.5" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── StatBreakdownCard ────────────────────────────────────────────────────────
// Bordered cell for use inside a grid. The border distinguishes individual
// metrics from each other — this is a data unit, not a section wrapper.

export function StatBreakdownCard({ className, ...props }: StatBreakdownProps) {
  return (
    <div className={cn('rounded-lg border border-border p-4', className)}>
      <StatBreakdown {...props} />
    </div>
  );
}

// ─── StatBreakdownGrid ────────────────────────────────────────────────────────

export interface StatBreakdownGridProps {
  children: React.ReactNode;
  cols?: 1 | 2 | 3 | 4;
  className?: string;
}

export function StatBreakdownGrid({ children, cols = 2, className }: StatBreakdownGridProps) {
  const colClass = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 md:grid-cols-2 xl:grid-cols-4',
  }[cols];

  return (
    <div className={cn('grid gap-4', colClass, className)}>
      {children}
    </div>
  );
}
