export type ProgressReportStatus = "draft" | "ready" | "sent";
export type ProgressReportReviewStatus = "needs_review" | "approved" | "sent";

export interface ProgressReportContact {
  role: string;
  name: string;
  email: string;
  phone: string;
}

export interface ProgressReportSourceMeeting {
  id: string;
  title: string;
  date: string | null;
  summary: string;
}

export interface ProgressReportSourceEmail {
  id: number;
  subject: string;
  date: string | null;
  preview: string;
}

export interface ProgressReportSourcePhoto {
  id: number;
  title: string;
  date: string | null;
  file_url: string;
}

export interface ProgressReportSourceSnapshot {
  generatedAt: string;
  strategy: string;
  meetings: ProgressReportSourceMeeting[];
  emails: ProgressReportSourceEmail[];
  photos: ProgressReportSourcePhoto[];
}

export interface ProgressReportPhotoRecord {
  id: number;
  title: string;
  description: string | null;
  file_url: string;
  date_taken: string | null;
  created_at: string | null;
  location: string | null;
  tags: string[] | null;
}

export interface ProgressReportPhotoSelection {
  id: string;
  progress_report_id: string;
  project_id: number;
  project_photo_id: number;
  sort_order: number;
  caption: string | null;
  created_at: string | null;
  photo: ProgressReportPhotoRecord;
}

export interface ProgressReportRecord {
  id: string;
  project_id: number;
  version: number;
  review_status: ProgressReportReviewStatus;
  refined_at: string | null;
  refined_by: string | null;
  title: string;
  report_type: "weekly";
  status: ProgressReportStatus;
  week_start: string;
  week_end: string;
  construction_start_date: string | null;
  scheduled_completion_date: string | null;
  past_week_highlights: string;
  upcoming_week_activities: string;
  open_items: string;
  /** Internal-only notes (risks/contract strategy). Rendered only in the internal audience view. */
  internal_notes: string | null;
  weather_days_lost: number;
  contacts: ProgressReportContact[];
  client_recipients: string[];
  source_snapshot: ProgressReportSourceSnapshot;
  sent_at: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProgressReportVersion {
  id: string;
  progress_report_id: string;
  project_id: number;
  version: number;
  action: "created" | "refined" | "edited" | "approved" | "sent";
  audience: "internal" | "client";
  content: Record<string, unknown>;
  source_snapshot: ProgressReportSourceSnapshot;
  created_by: string | null;
  created_at: string;
}

export interface ProgressReportListItem extends ProgressReportRecord {
  selected_photo_count: number;
}

export interface ProgressReportProjectSummary {
  id: number;
  name: string | null;
  project_number: string | null;
  job_number: string | null;
  client: string | null;
}

export interface ProgressReportAllListItem extends ProgressReportListItem {
  project: ProgressReportProjectSummary;
}

export interface ProgressReportDetailResponse {
  report: ProgressReportRecord;
  selectedPhotos: ProgressReportPhotoSelection[];
  availablePhotos: ProgressReportPhotoRecord[];
}

export interface ProgressReportListResponse {
  reports: ProgressReportListItem[];
}

export interface ProgressReportAllListResponse {
  reports: ProgressReportAllListItem[];
}
