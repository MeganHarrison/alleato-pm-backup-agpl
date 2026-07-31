import type {
  TrainingResource as TrainingResourceDomain,
  TrainingResourceLevel,
  TrainingResourceStatus,
  TrainingResourceType,
  TrainingRole,
  TrainingTopic,
} from "@/lib/training/types";

export type {
  TrainingResourceLevel,
  TrainingResourceStatus,
  TrainingResourceType,
} from "@/lib/training/types";

// Presentation models derive their stable fields from the canonical training
// domain. The route adapter adds display fallbacks and the validated embed
// decision without duplicating database-backed enum contracts.
export type TrainingRoleOption = Pick<TrainingRole, "id" | "name">;
export type TrainingTopicOption = Pick<TrainingTopic, "id" | "name">;

export interface TrainingResourceEmbed {
  canEmbed: boolean;
  provider?: string;
  embedUrl?: string;
}

export interface TrainingResource extends Pick<
  TrainingResourceDomain,
  "id" | "title" | "url" | "type" | "level" | "track" | "status" | "createdAt"
> {
  description: string | null;
  provider: string | null;
  topicId: string;
  roleIds: string[];
  embed?: TrainingResourceEmbed;
}

export interface TrainingGuide {
  slug: string;
  title: string;
  description: string;
  roleIds: string[];
}

export interface TrainingLibraryFilters {
  roleId: string | null;
  search: string;
  type: TrainingResourceType | null;
  level: TrainingResourceLevel | null;
  track: string | null;
}

export const EMPTY_TRAINING_LIBRARY_FILTERS: TrainingLibraryFilters = {
  roleId: null,
  search: "",
  type: null,
  level: null,
  track: null,
};
