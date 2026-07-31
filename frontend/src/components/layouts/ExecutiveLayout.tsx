/**
 * ============================================================================
 * EXECUTIVE LAYOUT - Layout for Executive Dashboards
 * ============================================================================
 *
 * PURPOSE:
 * Specialized layout for executive dashboards with minimal side padding.
 * Uses the executive spacing profile for full-width displays.
 *
 * USAGE:
 * ```tsx
 * <ExecutiveLayout>
 *   <PageHeader title="Executive Intelligence" />
 *   <KPIWidgets />
 * </ExecutiveLayout>
 * ```
 *
 * CHARACTERISTICS:
 * - Minimal page padding (8px base)
 * - Full viewport width utilization
 * - Maintains section/card spacing
 * - Responsive padding scaling
 */

'use client'

import * as React from 'react'
import { AppLayout, type AppLayoutProps } from './AppLayout'
import { cn } from '@/lib/utils'

export interface ExecutiveLayoutProps {
  /**
   * Children to render
   */
  children: React.ReactNode

  /**
   * Additional CSS classes
   */
  className?: string

  /**
   * Enable responsive padding scaling
   * - 8px on mobile
   * - 16px on tablet (sm)
   * - 24px on desktop (lg)
   */
  responsivePadding?: boolean
}

export function ExecutiveLayout({
  children,
  className,
  responsivePadding = true,
}: ExecutiveLayoutProps) {
  return (
    <AppLayout
      variant="executive"
      maxWidth="full"
      className={cn(
        // Use negative margins to extend to full width, accounting for parent padding
        '-mx-4 sm:-mx-6 lg:-mx-8',
        // Add back minimal padding for the executive layout
        responsivePadding && 'px-2 sm:px-4 lg:px-6',
        className
      )}
    >
      <div className="space-y-[var(--section-gap)]">
        {children}
      </div>
    </AppLayout>
  )
}
