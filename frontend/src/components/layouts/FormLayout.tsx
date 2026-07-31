/**
 * ============================================================================
 * FORM LAYOUT - Layout for Forms and Settings
 * ============================================================================
 *
 * PURPOSE:
 * Specialized layout for forms, wizards, and settings pages.
 * Uses balanced spacing with clear vertical rhythm.
 *
 * USAGE:
 * ```tsx
 * <FormLayout>
 *   <UserSettingsForm />
 * </FormLayout>
 * ```
 *
 * CHARACTERISTICS:
 * - Balanced spacing for scanability
 * - Clear vertical rhythm for form flow
 * - Narrower max-width for better readability
 */

'use client'

import * as React from 'react'
import { AppLayout, type AppLayoutProps } from './AppLayout'

export interface FormLayoutProps {
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

export function FormLayout({
  maxWidth = 'standard',
  children,
  className,
}: FormLayoutProps) {
  return (
    <AppLayout variant="form" maxWidth={maxWidth} className={className}>
      <div className="space-y-[var(--section-gap)]">{children}</div>
    </AppLayout>
  )
}
