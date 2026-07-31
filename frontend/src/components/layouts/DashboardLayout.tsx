/**
 * ============================================================================
 * DASHBOARD LAYOUT - Layout for Executive Views
 * ============================================================================
 *
 * PURPOSE:
 * Specialized layout for dashboards with widgets, KPIs, and visual hierarchy.
 * Uses spacious spacing profile for breathability.
 *
 * USAGE:
 * ```tsx
 * <DashboardLayout>
 *   <KPIWidgets />
 *   <RecentActivity />
 * </DashboardLayout>
 * ```
 *
 * CHARACTERISTICS:
 * - Generous spacing for visual hierarchy
 * - Optimized for card/widget layouts
 * - Breathable, executive-friendly
 */

'use client'

import * as React from 'react'
import { AppLayout, type AppLayoutProps } from './AppLayout'

export interface DashboardLayoutProps {
  /**
   * Maximum width constraint
   */
  maxWidth?: AppLayoutProps['maxWidth']

  /**
   * Children to render
   */
  children: React.ReactNode

  /**
   * Additional CSS classes
   */
  className?: string
}

export function DashboardLayout({
  maxWidth = 'wide',
  children,
  className,
}: DashboardLayoutProps) {
  return (
    <AppLayout
      variant="dashboard"
      maxWidth={maxWidth}
      className={className}
    >
      <div className="space-y-[var(--section-gap)]">
        {children}
      </div>
    </AppLayout>
  )
}
