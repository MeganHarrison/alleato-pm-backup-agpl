export const SITE_HEADER_DESKTOP_MIN_WIDTH = 1180;

export function shouldUseCompactSiteHeader(width: number): boolean {
  return width < SITE_HEADER_DESKTOP_MIN_WIDTH;
}
