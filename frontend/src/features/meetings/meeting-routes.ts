export function getMeetingDetailHref({
  meetingId,
  projectId,
}: {
  meetingId: string;
  projectId?: string | number | null;
}): string {
  const normalizedMeetingId = String(meetingId).trim();
  if (!normalizedMeetingId) {
    throw new Error("Cannot build meeting detail href without a meeting id.");
  }

  const normalizedProjectId =
    projectId === null || projectId === undefined ? "" : String(projectId).trim();

  if (!normalizedProjectId) {
    return `/meetings/${encodeURIComponent(normalizedMeetingId)}`;
  }

  return `/${encodeURIComponent(normalizedProjectId)}/meetings/${encodeURIComponent(normalizedMeetingId)}`;
}
