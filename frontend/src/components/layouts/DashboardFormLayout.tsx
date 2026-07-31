/**
 * DashboardFormLayout - Wider, dashboard-like layout with comfortable gutters.
 * Keeps existing FormLayout untouched while providing a wider canvas.
 */
'use client'

import * as React from 'react'
import { AppLayout, type AppLayoutProps } from './AppLayout'

export interface DashboardFormLayoutProps {
  maxWidth?: AppLayoutProps['maxWidth']
  children: React.ReactNode
  className?: string
}

export function DashboardFormLayout({
  maxWidth = 'wide',
  children,
  className,
}: DashboardFormLayoutProps) {
  return (
    <AppLayout variant="dashboard" maxWidth={maxWidth} className={className}>
      <div className="space-y-[var(--section-gap)]">{children}</div>
    </AppLayout>
  )
}

