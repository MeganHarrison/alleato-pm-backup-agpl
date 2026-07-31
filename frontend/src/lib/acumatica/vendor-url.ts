const ACUMATICA_BASE = "https://alleatogroup.acumatica.com";

/**
 * Deep link to a vendor's record on the Acumatica Vendors screen (AP303000).
 * Matches the ScreenId deep-link convention already used in
 * `frontend/src/app/(admin)/accounting/reconciliation/page.tsx`.
 */
export function acumaticaVendorUrl(vendorId: string): string {
  return `${ACUMATICA_BASE}/Main?ScreenId=AP303000&VendorID=${encodeURIComponent(vendorId)}`;
}
