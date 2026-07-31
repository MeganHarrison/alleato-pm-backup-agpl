/**
 * Validates a callback URL to prevent open redirect attacks.
 * Only allows relative paths on the same origin.
 *
 * Rejects:
 * - Absolute URLs (https://evil.com)
 * - Protocol-relative URLs (//evil.com)
 * - URLs with backslash tricks (\/evil.com)
 * - Data/javascript URIs
 * - Empty or whitespace-only strings
 *
 * @param url - The callback URL to validate
 * @param fallback - The fallback path if validation fails (default: "/")
 * @returns A safe relative path
 */
export function validateCallbackUrl(url: string | null | undefined, fallback = "/"): string {
  if (!url || typeof url !== "string") {
    return fallback;
  }

  const trimmed = url.trim();

  // Must start with a single forward slash (relative path)
  if (!trimmed.startsWith("/")) {
    return fallback;
  }

  // Reject protocol-relative URLs (//example.com)
  if (trimmed.startsWith("//")) {
    return fallback;
  }

  // Reject backslash variants that browsers may interpret as protocol-relative
  if (trimmed.startsWith("/\\")) {
    return fallback;
  }

  // Reject data: or javascript: URIs that could be embedded
  const lower = trimmed.toLowerCase();
  if (lower.includes("javascript:") || lower.includes("data:")) {
    return fallback;
  }

  // Reject URLs with embedded credentials or authority (@)
  if (trimmed.includes("@")) {
    return fallback;
  }

  return trimmed;
}
