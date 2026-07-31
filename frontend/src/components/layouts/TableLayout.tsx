/**
 * ============================================================================
 * TABLE LAYOUT - Layout for Data-Heavy Pages
 * ============================================================================
 *
 * PURPOSE:
 * Specialized layout for pages with tables, lists, and grids.
 * Uses compact spacing profile optimized for information density.
 *
 * USAGE:
 * ```tsx
 * <TableLayout density="standard">
 *   <ProjectsTable />
 * </TableLayout>
 * ```
 *
 * CHARACTERISTICS:
 * - Compact padding for more screen real estate
 * - Optimized for horizontal scrolling if needed
 * - Density prop directly affects table row height
 */

'use client'

import * as React from 'react'
import { AppLayout, type AppLayoutProps } from './AppLayout'

export interface TableLayoutProps {
  /**
   * Table density level
   * - standard: Balanced (default)
   * - compact: More rows visible
   * - comfortable: More breathing room
   */
  density?: AppLayoutProps['density']

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

export function TableLayout({
  density = 'standard',
  maxWidth = 'full',
  children,
  className,
}: TableLayoutProps) {
  return (
    <AppLayout
      variant="table"
      density={density}
      maxWidth={maxWidth}
      className={className}
    >
      <div className="px-6 lg:px-8 space-y-[var(--section-gap)]">
        {children}
      </div>
    </AppLayout>
  )
}
