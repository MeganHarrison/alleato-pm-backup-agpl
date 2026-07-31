/** The only catalog sources that can create attributable video-progress events. */
export const TRACKABLE_VIDEO_SOURCE_TYPES = ["training_resource", "docs"] as const;

export function isTrackableVideoLesson(content: {
  content_kind: string;
  source_type: string;
} | null): boolean {
  return Boolean(
    content &&
      content.content_kind === "video" &&
      TRACKABLE_VIDEO_SOURCE_TYPES.includes(
        content.source_type as (typeof TRACKABLE_VIDEO_SOURCE_TYPES)[number],
      ),
  );
}
