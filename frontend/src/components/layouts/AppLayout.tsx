/**
 * ============================================================================
 * APP LAYOUT - Base Layout Wrapper
 * ============================================================================
 *
 * PURPOSE:
 * Provides layout structure and injects spacing CSS variables based on profile.
 * This is the foundation for all specialized layout components.
 *
 * USAGE:
 * ```tsx
 * <AppLayout variant="table" density="standard">
 *   <YourContent />
 * </AppLayout>
 * ```
 *
 * ARCHITECTURE:
 * - Applies data attributes for CSS variable scoping
 * - Injects spacing and density tokens via CSS variables
 * - Components inside automatically inherit spacing rules
 */

'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import {
  type SpacingProfile,
  type DensityProfile,
  spacingToCSSVars,
  densityToCSSVars,
} from '@/design-system/spacing'

export interface AppLayoutProps {
  /**
   * Layout variant determines spacing profile
   * - dashboard: Executive views, widgets, KPIs (spacious)
   * - table: Data-heavy lists, logs, grids (compact)
   * - form: Inputs, wizards, settings (balanced)
   * - docs: Long-form reading, onboarding (generous)
   * - executive: Full-width executive dashboards (minimal page padding)
   */
  variant: SpacingProfile

  /**
   * Density profile (mainly affects tables)
   * - standard: Balanced (default)
   * - compact: More rows visible
   * - comfortable: More breathing room
   */
  density?: DensityProfile

  /**
   * Maximum width constraint
   * - full: No constraint (default)
   * - wide: 1536px (2xl)
   * - standard: 1280px (xl)
   * - narrow: 768px (md)
   */
  maxWidth?: 'full' | 'wide' | 'standard' | 'narrow'

  /**
   * Children to render inside layout
   */
  children: React.ReactNode

  /**
   * Additional CSS classes
   */
  className?: string
}

const maxWidthClasses = {
  full: '',
  wide: 'max-w-[1536px] mx-auto',
  standard: 'max-w-[1280px] mx-auto',
  narrow: 'max-w-[768px] mx-auto',
} as const

export function AppLayout({
  variant,
  density = 'standard',
  maxWidth = 'full',
  children,
  className,
}: AppLayoutProps) {
  // Convert tokens to CSS variables
  const spacingVars = spacingToCSSVars(variant)
  const densityVars = densityToCSSVars(density)

  return (
    <div
      data-layout={variant}
      data-density={density}
      style={
        {
          ...spacingVars,
          ...densityVars,
        } as React.CSSProperties
      }
      className={cn(
        'layout-root',
        'p-[var(--page-padding)]',
        maxWidthClasses[maxWidth],
        className
      )}
    >
      {children}
    </div>
  )
}
