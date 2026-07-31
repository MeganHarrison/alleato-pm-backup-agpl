import type { Database } from "@/types/database.types";

export type KnowledgeContentKind =
  Database["public"]["Enums"]["knowledge_content_kind"];
export type KnowledgeDisplayArea =
  Database["public"]["Enums"]["knowledge_display_area"];
export type KnowledgeLifecycleStatus =
  Database["public"]["Enums"]["knowledge_lifecycle_status"];
export type KnowledgeSourceType =
  Database["public"]["Enums"]["knowledge_source_type"];
export type KnowledgeVisibility =
  Database["public"]["Enums"]["knowledge_visibility"];
export type LearningEnrollmentStatus =
  Database["public"]["Enums"]["learning_enrollment_status"];
export type LearningRequirement =
  Database["public"]["Enums"]["learning_requirement"];

export interface KnowledgeTaxonomyValue {
  id: string | number;
  slug?: string;
  key?: string;
  name: string;
}

export interface ContentManagerOption {
  id: string;
  name: string;
  email: string;
}

export interface LearningLibraryItem {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  kind: KnowledgeContentKind;
  displayArea: KnowledgeDisplayArea;
  lifecycle: KnowledgeLifecycleStatus;
  visibility: KnowledgeVisibility;
  sourceType: KnowledgeSourceType;
  sourceId: string;
  sourceUrl: string | null;
  href: string;
  external: boolean;
  ownerUserId: string | null;
  ownerName: string | null;
  reviewerUserId: string | null;
  reviewerName: string | null;
  lastReviewedAt: string | null;
  nextReviewAt: string | null;
  updatedAt: string;
  publishedAt: string | null;
  engagementTrackingSupported: boolean;
  uniqueViewers: number;
  completedCount: number;
  completionRate: number;
  watchSeconds: number;
  lastEngagedAt: string | null;
  topics: KnowledgeTaxonomyValue[];
  roles: KnowledgeTaxonomyValue[];
  skills: KnowledgeTaxonomyValue[];
  businessAreas: KnowledgeTaxonomyValue[];
  courseId: string | null;
  courseOutcome: string | null;
  courseDifficulty: string | null;
  estimatedMinutes: number | null;
  isInternalCourse: boolean;
  provider: string | null;
}

export interface LearnerAssignment {
  enrollmentId: string;
  assignmentId: string | null;
  courseId: string;
  courseSlug: string;
  title: string;
  summary: string | null;
  outcome: string;
  estimatedMinutes: number | null;
  status: LearningEnrollmentStatus;
  requirement: LearningRequirement;
  dueAt: string | null;
  progressPercent: number;
  startedAt: string | null;
  completedAt: string | null;
  reason: string | null;
  assignedAt: string;
}

export interface LearningCourseItem {
  id: string;
  sectionId: string;
  contentItemId: string;
  title: string;
  summary: string | null;
  instructions: string | null;
  required: boolean;
  estimatedMinutes: number | null;
  sortOrder: number;
  kind: KnowledgeContentKind;
  sourceType: KnowledgeSourceType;
  sourceId: string;
  sourceUrl: string | null;
  href: string;
  nativeBody: string | null;
  progressStatus: "not_started" | "in_progress" | "completed";
  completedAt: string | null;
}

export interface LearningCourseSection {
  id: string;
  title: string;
  description: string | null;
  sortOrder: number;
  items: LearningCourseItem[];
}

export interface LearningCourseDetail {
  id: string;
  contentItemId: string;
  slug: string;
  title: string;
  summary: string | null;
  outcome: string;
  difficulty: string | null;
  estimatedMinutes: number | null;
  prerequisites: string | null;
  lifecycle: KnowledgeLifecycleStatus;
  visibility: KnowledgeVisibility;
  ownerUserId: string | null;
  reviewerUserId: string | null;
  completionRule: Database["public"]["Enums"]["learning_completion_rule"];
  publicationBlockers: string[];
  sections: LearningCourseSection[];
}

export interface LearnerCourseDetail extends LearningCourseDetail {
  enrollment: LearnerAssignment;
}

export interface ContentGovernanceException {
  contentItemId: string;
  title: string;
  kind: KnowledgeContentKind;
  lifecycle: KnowledgeLifecycleStatus;
  ownerUserId: string | null;
  reviewerUserId: string | null;
  nextReviewAt: string | null;
  exceptions: string[];
  href: string;
}

export interface TrainingRoleOption {
  id: string;
  slug: string;
  name: string;
}

export interface TrainingTopicOption {
  id: string;
  slug: string;
  name: string;
}
