export type PlaneCycleStatus =
  | "draft"
  | "upcoming"
  | "current"
  | "completed"
  | "archived";

export interface PlaneCycle {
  id: string;
  project_id: number;
  name: string;
  description: string;
  start_date: string | null;
  end_date: string | null;
  owned_by: string | null;
  timezone: string;
  sort_order: number;
  view_props: Json;
  progress_snapshot: Json;
  external_source: string | null;
  external_id: string | null;
  archived_at: string | null;
  version: number;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  status: PlaneCycleStatus;
}

export interface PlaneCycleTaskMembership {
  id: string;
  project_id: number;
  cycle_id: string;
  task_id: string;
  created_by: string | null;
  created_at: string;
}

export interface PlaneCycleTask {
  id: string;
  title: string | null;
  description: string;
  status: string;
  priority: string | null;
  due_date: string | null;
  project_id: number | null;
  project_ids: number[] | null;
}

export interface PlaneCycleMembershipWithTask
  extends PlaneCycleTaskMembership {
  task: PlaneCycleTask | null;
}

export interface CreatePlaneCycleInput {
  project_id: number;
  name: string;
  description?: string;
  start_date?: string | null;
  end_date?: string | null;
  owned_by?: string | null;
  timezone?: string;
  external_source?: string | null;
  external_id?: string | null;
}

export interface UpdatePlaneCycleInput {
  project_id: number;
  cycle_id: string;
  name?: string;
  description?: string;
  start_date?: string | null;
  end_date?: string | null;
  owned_by?: string | null;
  timezone?: string;
  archived_at?: string | null;
  sort_order?: number;
}

export interface PlaneCycleMembershipInput {
  project_id: number;
  cycle_id: string;
  task_ids: string[];
}
import type { Json } from "@/types/database.types";
