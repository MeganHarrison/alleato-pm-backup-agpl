/**
 * Photos Grid Configuration
 * ─────────────────────────
 * Configuration for the photo grid display and album filter options.
 */

export const ALBUM_OPTIONS = [
  { label: "All Albums", value: "__all__" },
  { label: "Default", value: "Default" },
  { label: "Progress", value: "Progress" },
  { label: "Safety", value: "Safety" },
  { label: "Inspections", value: "Inspections" },
  { label: "Deliveries", value: "Deliveries" },
  { label: "Deficiencies", value: "Deficiencies" },
  { label: "Closeout", value: "Closeout" },
] as const;

export type AlbumOption = (typeof ALBUM_OPTIONS)[number]["value"];

/** Format bytes into human-readable size */
export function formatFileSize(bytes: number | null | undefined): string {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const exponent = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );
  const value = bytes / Math.pow(1024, exponent);
  return `${value.toFixed(value >= 10 || exponent === 0 ? 0 : 1)} ${units[exponent]}`;
}

/** Format a date string for display */
export function formatPhotoDate(timestamp: string | null | undefined): string {
  if (!timestamp) return "";
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(timestamp));
}
