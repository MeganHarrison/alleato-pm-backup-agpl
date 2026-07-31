/**
 * Shared formatting utilities for display values.
 *
 * This is the canonical import path for all display-side currency, percent,
 * date, and number formatting in the app. Add new helpers here; re-export
 * from lib/table-config/formatters.ts if they belong there too.
 *
 * Usage:
 *   import { formatCurrency, formatPercent } from "@/lib/format";
 */

export {
  formatCurrency,
  formatPercent,
  formatPhoneNumber,
  formatDate,
  formatNumber,
  formatArray,
  truncateText,
} from "@/lib/table-config/formatters";
