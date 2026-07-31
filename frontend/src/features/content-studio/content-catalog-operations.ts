import type {
  ContentManagerOption,
  LearningLibraryItem,
} from "@/lib/learning/types";

function calendarDateKey(value: string): string {
  const match = /^(\d{4}-\d{2}-\d{2})/u.exec(value);
  if (!match) {
    throw new Error(`Invalid review date: ${value}.`);
  }
  return match[1];
}

export function localCalendarDateKey(value = new Date()): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function isReviewDateDue(
  reviewDate: string,
  today = localCalendarDateKey(),
): boolean {
  return calendarDateKey(reviewDate) <= today;
}

export function formatReviewDate(reviewDate: string): string {
  const dateKey = calendarDateKey(reviewDate);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${dateKey}T00:00:00.000Z`));
}

export function contentNeedsAttention(
  item: LearningLibraryItem,
  today = localCalendarDateKey(),
): boolean {
  if (item.lifecycle === "archived" || item.lifecycle === "draft") {
    return false;
  }
  if (!item.ownerUserId || !item.reviewerUserId) return true;
  if (item.lifecycle === "published" && !item.lastReviewedAt) return true;
  if (!item.nextReviewAt) return true;
  return isReviewDateDue(item.nextReviewAt, today);
}

export function reviewLabel(
  item: LearningLibraryItem,
  today = localCalendarDateKey(),
): string {
  if (item.lifecycle === "archived") return "Archived";
  if (item.lifecycle === "draft") return "Draft";
  if (!item.ownerUserId) return "Assign owner";
  if (!item.reviewerUserId) return "Assign reviewer";
  if (item.lifecycle === "published" && !item.lastReviewedAt) {
    return "Never reviewed";
  }
  if (!item.nextReviewAt) return "Set review date";
  if (isReviewDateDue(item.nextReviewAt, today)) return "Review due";
  return `Due ${formatReviewDate(item.nextReviewAt)}`;
}

export function engagementLabel(item: LearningLibraryItem): string {
  if (!item.engagementTrackingSupported) return "Not tracked";
  if (item.uniqueViewers === 0) return "No activity";

  const parts = [
    `${item.uniqueViewers} ${item.uniqueViewers === 1 ? "viewer" : "viewers"}`,
  ];
  if (item.completedCount > 0) {
    parts.push(`${item.completedCount} completed`);
  }
  if (item.watchSeconds > 0) {
    parts.push(`${Math.max(1, Math.round(item.watchSeconds / 60))}m watched`);
  }
  return parts.join(" | ");
}

export function buildManagerOptions(managers: ContentManagerOption[]) {
  return [
    { value: "__none__", label: "Unassigned" },
    ...managers.map((manager) => ({
      value: manager.id,
      label:
        manager.name === manager.email
          ? manager.name
          : `${manager.name} (${manager.email})`,
    })),
  ];
}
