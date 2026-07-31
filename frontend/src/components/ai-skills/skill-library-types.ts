export type SkillLibraryScope = "personal" | "project" | "team" | "company" | string;

export interface SkillLibraryExample {
  title?: string | null;
  input?: string | null;
  output?: string | null;
}

export interface SkillLibrarySkill {
  id: string;
  title: string;
  summary: string;
  category: string;
  scope: SkillLibraryScope;
  projectId?: number | null;
  projectName?: string | null;
  ownerName?: string | null;
  reviewerName?: string | null;
  version?: string | null;
  examples?: SkillLibraryExample[];
  usageCount?: number | null;
  lastUsedAt?: string | null;
  status?: string | null;
  isActive?: boolean | null;
  isVisible?: boolean | null;
}

export interface SkillLibraryFilters {
  category?: string;
  scope?: string;
  projectId?: string;
  status?: string;
}
