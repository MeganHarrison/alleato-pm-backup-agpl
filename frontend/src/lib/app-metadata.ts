export const DEFAULT_APP_METADATA_TITLE = "Alleato Project Management";

/**
 * Product name as it should read in outward-facing documents (contracts, exhibits,
 * subcontractor instructions). Keep this in sync with the metadata title.
 */
export const APP_PRODUCT_NAME = DEFAULT_APP_METADATA_TITLE;

/**
 * Canonical production URL for outward-facing documents.
 *
 * Deliberately NOT derived from `NEXT_PUBLIC_APP_URL`: a contract exhibit generated
 * from a preview or local environment must still direct subcontractors to production.
 * For in-app email links use `APP_BASE_URL` from `@/lib/email/client` instead.
 */
export const APP_CANONICAL_URL = "https://projects.alleatogroup.com";
