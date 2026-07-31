'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

// ─── PropertyList ─────────────────────────────────────────────────────────────

export interface PropertyListProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function PropertyList({ children, className, ...props }: PropertyListProps) {
  return (
    <div
      className={cn('divide-y divide-border', className)}
      {...props}
    >
      {children}
    </div>
  );
}

// ─── PropertyLabel ────────────────────────────────────────────────────────────

export interface PropertyLabelProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  /** Override the default label column width (default: 30%, min 100px) */
  width?: string;
}

export function PropertyLabel({ children, className, width, style, ...props }: PropertyLabelProps) {
  return (
    <div
      className={cn(
        'shrink-0 truncate text-xs font-medium uppercase tracking-wide text-muted-foreground',
        !width && 'w-[30%] min-w-[100px]',
        className,
      )}
      style={width ? { width, ...style } : style}
      {...props}
    >
      {children}
    </div>
  );
}

// ─── PropertyValue ────────────────────────────────────────────────────────────

export interface PropertyValueProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function PropertyValue({ children, className, ...props }: PropertyValueProps) {
  return (
    <div
      className={cn('min-w-0 flex-1 text-sm text-foreground', className)}
      {...props}
    >
      {children}
    </div>
  );
}

// ─── Property ─────────────────────────────────────────────────────────────────

export interface PropertyProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Shorthand label text — use instead of <PropertyLabel> */
  label?: React.ReactNode;
  /** Shorthand value — use instead of <PropertyValue> */
  value?: React.ReactNode;
  /** Width passed through to PropertyLabel when using shorthand */
  labelWidth?: string;
  children?: React.ReactNode;
}

export function Property({
  label,
  value,
  labelWidth,
  children,
  className,
  ...props
}: PropertyProps) {
  return (
    <div
      className={cn('flex min-h-10 items-center gap-4 py-2', className)}
      {...props}
    >
      {label !== undefined || value !== undefined ? (
        <>
          <PropertyLabel width={labelWidth}>{label}</PropertyLabel>
          <PropertyValue>{value}</PropertyValue>
        </>
      ) : (
        children
      )}
    </div>
  );
}
