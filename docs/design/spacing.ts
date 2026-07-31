/**
 * ============================================================================
 * SPACING TOKEN SYSTEM
 * ============================================================================
 *
 * PURPOSE:
 * This file defines semantic spacing profiles for different page types.
 * Pages choose a layout variant, and spacing is resolved by the system.
 *
 * PHILOSOPHY:
 * - Pages should never decide spacing directly
 * - Pages choose a layout + density profile
 * - Spacing is resolved by the system
 * - Think in layers: Page → Layout → Density → Tokens → Components
 *
 * PROFILES:
 * - dashboard: Executive views, widgets, KPIs (spacious)
 * - table: Data-heavy lists, logs, grids (compact)
 * - form: Inputs, wizards, settings (balanced)
 * - docs: Long-form reading, onboarding (generous)
 */

// ============================================================================
// SPACING PROFILES
// ============================================================================

export const spacingProfiles = {
  /**
   * Dashboard Profile
   * Used for: Executive views, widgets, KPIs
   * Characteristics: Spacious, breathable, visual hierarchy
   */
  dashboard: {
    page: 24, // Page container padding
    section: 24, // Gap between major sections
    card: 16, // Card/widget internal padding
    group: 16, // Related item groups
    field: 12, // Individual form fields
  },

  /**
   * Table Profile
   * Used for: Data-heavy lists, logs, grids
   * Characteristics: Compact, dense, efficient
   */
  table: {
    page: 16, // Page container padding
    section: 16, // Gap between major sections
    card: 12, // Card/widget internal padding
    group: 12, // Related item groups
    field: 8, // Individual form fields
  },

  /**
   * Form Profile
   * Used for: Inputs, wizards, settings
   * Characteristics: Balanced, clear structure, scannable
   */
  form: {
    page: 24, // Page container padding
    section: 24, // Gap between major sections (form steps)
    card: 20, // Card/section internal padding
    group: 16, // Related field groups
    field: 8, // Individual form fields
  },

  /**
   * Docs Profile
   * Used for: Long-form reading, onboarding, documentation
   * Characteristics: Generous, readable, comfortable
   */
  docs: {
    page: 48, // Page container padding
    section: 32, // Gap between major sections
    card: 24, // Card/callout internal padding
    group: 20, // Related content groups
    field: 12, // Individual form fields (if any)
  },

  /**
   * Executive Profile
   * Used for: Executive dashboards, full-width KPI displays
   * Characteristics: Minimal page padding, full viewport usage
   */
  executive: {
    page: 8, // Minimal page container padding (8px on mobile, scales up)
    section: 24, // Gap between major sections (same as dashboard)
    card: 16, // Card/widget internal padding
    group: 16, // Related item groups
    field: 12, // Individual form fields
  },
} as const;

// ============================================================================
// DENSITY PROFILES (for tables)
// ============================================================================

export const densityProfiles = {
  /**
   * Standard Density
   * Default for most tables
   * Balanced between information density and readability
   */
  standard: {
    rowHeight: 53, // Table row height in pixels
    cellPadding: 12, // Cell horizontal padding
    cellPaddingY: 16, // Cell vertical padding
  },

  /**
   * Compact Density
   * For data-heavy tables where screen space is critical
   * More rows visible at once
   */
  compact: {
    rowHeight: 40, // Table row height in pixels
    cellPadding: 8, // Cell horizontal padding
    cellPaddingY: 8, // Cell vertical padding
  },

  /**
   * Comfortable Density
   * For tables with complex content or when accessibility is priority
   * More breathing room
   */
  comfortable: {
    rowHeight: 64, // Table row height in pixels
    cellPadding: 16, // Cell horizontal padding
    cellPaddingY: 20, // Cell vertical padding
  },
} as const;

// ============================================================================
// VERTICAL RHYTHM (for forms)
// ============================================================================

export const verticalRhythm = {
  /**
   * Form-specific vertical spacing
   * Creates visual hierarchy and flow
   */
  form: {
    fieldGap: 8, // Gap between label and input
    groupGap: 16, // Gap between field groups (e.g., address fields)
    sectionGap: 24, // Gap between form sections
  },

  /**
   * Content-specific vertical spacing
   * For text-heavy pages
   */
  content: {
    paragraphGap: 16, // Gap between paragraphs
    headingGap: 24, // Gap before headings
    listGap: 8, // Gap between list items
  },
} as const;

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type SpacingProfile = keyof typeof spacingProfiles;
export type DensityProfile = keyof typeof densityProfiles;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get spacing tokens for a specific profile
 */
export function getSpacingTokens(profile: SpacingProfile) {
  return spacingProfiles[profile];
}

/**
 * Get density tokens for a specific density level
 */
export function getDensityTokens(density: DensityProfile) {
  return densityProfiles[density];
}

/**
 * Convert spacing profile to CSS variables object
 */
export function spacingToCSSVars(profile: SpacingProfile) {
  const tokens = spacingProfiles[profile];
  return {
    '--page-padding': `${tokens.page}px`,
    '--section-gap': `${tokens.section}px`,
    '--card-padding': `${tokens.card}px`,
    '--group-gap': `${tokens.group}px`,
    '--field-gap': `${tokens.field}px`,
  };
}

/**
 * Convert density profile to CSS variables object
 */
export function densityToCSSVars(density: DensityProfile) {
  const tokens = densityProfiles[density];
  return {
    '--row-height': `${tokens.rowHeight}px`,
    '--cell-padding': `${tokens.cellPadding}px`,
    '--cell-padding-y': `${tokens.cellPaddingY}px`,
  };
}
