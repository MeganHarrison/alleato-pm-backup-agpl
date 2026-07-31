/**
 * ESLint Plugin: Design System
 *
 * Custom ESLint rules to enforce design system compliance.
 * Prevents hardcoded colors, arbitrary spacing, and encourages semantic tokens.
 */

const noHardcodedColors = require('./rules/no-hardcoded-colors');
const noArbitrarySpacing = require('./rules/no-arbitrary-spacing');
const requireSemanticColors = require('./rules/require-semantic-colors');
const noDesignViolations = require('./rules/no-design-violations');
const requirePageShell = require('./rules/require-page-shell');
const noOversizedShadows = require('./rules/no-oversized-shadows');
const noRawButton = require('./rules/no-raw-button');
const noRawFormControls = require('./rules/no-raw-form-controls');
const requireApprovedFormComponents = require('./rules/require-approved-form-components');
const requireMoneyField = require('./rules/require-money-field');
const requireApiClient = require('./rules/require-api-client');
const requireEmptyState = require('./rules/require-empty-state');
const noHardcodedStatusColors = require('./rules/no-hardcoded-status-colors');
const noInlineSpinner = require('./rules/no-inline-spinner');
const noRawHeading = require('./rules/no-raw-heading');
const noInlineCurrency = require('./rules/no-inline-currency');
const requireErrorState = require('./rules/require-error-state');
const requireInfoAlert = require('./rules/require-info-alert');
const noRawTablePrimitives = require('./rules/no-raw-table-primitives');
const noExternalFetchInApiRoutes = require('./rules/no-external-fetch-in-api-routes');
const noRawErrorMessageToast = require('./rules/no-raw-error-message-toast');
const noRawSearchInput = require('./rules/no-raw-search-input');
const noHandRolledDropdownMenu = require('./rules/no-hand-rolled-dropdown-menu');
const requireEditableStatusColumn = require('./rules/require-editable-status-column');
const noEditableTitleColumn = require('./rules/no-editable-title-column');
const noRawDateInput = require('./rules/no-raw-date-input');
const noRawDetailField = require('./rules/no-raw-detail-field');
const noRawDetailGrid = require('./rules/no-raw-detail-grid');
const noRawPageGrid = require('./rules/no-raw-page-grid');
const noSupabaseAuthGetuserInApiRoutes = require('./rules/no-supabase-auth-getuser-in-api-routes');
const noExternalLinkIcon = require('./rules/no-external-link-icon');
const noSheetHeaderBorder = require('./rules/no-sheet-header-border');
const noStackedTableCell = require('./rules/no-stacked-table-cell');

module.exports = {
  rules: {
    'require-editable-status-column': requireEditableStatusColumn,
    'no-editable-title-column': noEditableTitleColumn,
    'no-raw-date-input': noRawDateInput,
    'require-info-alert': requireInfoAlert,
    'no-hardcoded-colors': noHardcodedColors,
    'no-arbitrary-spacing': noArbitrarySpacing,
    'require-semantic-colors': requireSemanticColors,
    'no-design-violations': noDesignViolations,
    'require-page-shell': requirePageShell,
    'no-oversized-shadows': noOversizedShadows,
    'no-raw-button': noRawButton,
    'no-raw-form-controls': noRawFormControls,
    'require-approved-form-components': requireApprovedFormComponents,
    'require-money-field': requireMoneyField,
    'require-api-client': requireApiClient,
    'require-empty-state': requireEmptyState,
    'no-hardcoded-status-colors': noHardcodedStatusColors,
    'no-inline-spinner': noInlineSpinner,
    'no-raw-heading': noRawHeading,
    'no-inline-currency': noInlineCurrency,
    'require-error-state': requireErrorState,
    'no-raw-table-primitives': noRawTablePrimitives,
    'no-external-fetch-in-api-routes': noExternalFetchInApiRoutes,
    'no-supabase-auth-getuser-in-api-routes': noSupabaseAuthGetuserInApiRoutes,
    'no-raw-error-message-toast': noRawErrorMessageToast,
    'no-raw-search-input': noRawSearchInput,
    'no-hand-rolled-dropdown-menu': noHandRolledDropdownMenu,
    'no-raw-detail-field': noRawDetailField,
    'no-raw-detail-grid': noRawDetailGrid,
    'no-raw-page-grid': noRawPageGrid,
    'no-external-link-icon': noExternalLinkIcon,
    'no-sheet-header-border': noSheetHeaderBorder,
    'no-stacked-table-cell': noStackedTableCell,
  },
  configs: {
    recommended: {
      plugins: ['design-system'],
      rules: {
        'design-system/no-hardcoded-colors': 'error',
        'design-system/no-arbitrary-spacing': 'error',
        'design-system/require-semantic-colors': 'warn',
        'design-system/no-design-violations': 'error',
        'design-system/require-page-shell': 'warn',
        'design-system/no-oversized-shadows': 'error',
        'design-system/no-raw-button': 'error',
        'design-system/no-raw-form-controls': 'error',
        'design-system/require-money-field': 'error',
        'design-system/require-api-client': 'warn',
      },
    },
    strict: {
      plugins: ['design-system'],
      rules: {
        'design-system/no-hardcoded-colors': 'error',
        'design-system/no-arbitrary-spacing': 'error',
        'design-system/require-semantic-colors': 'error',
        'design-system/require-page-shell': 'error',
        'design-system/no-oversized-shadows': 'error',
        'design-system/no-raw-button': 'error',
        'design-system/no-raw-form-controls': 'error',
        'design-system/require-money-field': 'error',
        'design-system/require-api-client': 'error',
      },
    },
  },
};
