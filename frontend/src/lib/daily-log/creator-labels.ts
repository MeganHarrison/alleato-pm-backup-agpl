export type DailyLogCreatorProfile = {
  full_name: string | null;
  email: string | null;
};

function initialsFrom(value: string): string | null {
  const parts = value
    .trim()
    .split(/[^a-zA-Z0-9]+/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length === 0) return null;
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();

  return parts
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

export function getDailyLogCreatorLabel(
  profile: DailyLogCreatorProfile | null | undefined,
): string | null {
  const fullName = profile?.full_name?.trim();
  if (fullName) return fullName;

  const emailLocalPart = profile?.email?.split("@")[0]?.trim();
  return emailLocalPart ? initialsFrom(emailLocalPart) : null;
}

export function formatDailyLogDate(value: string | null | undefined): string {
  if (!value) return "No date";

  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const date = dateOnlyMatch
    ? new Date(
        Number(dateOnlyMatch[1]),
        Number(dateOnlyMatch[2]) - 1,
        Number(dateOnlyMatch[3]),
      )
    : new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
