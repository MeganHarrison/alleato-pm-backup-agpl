import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/types/database.types";

type ProjectCycleRow = {
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
};

type ProjectCycleInsert = Omit<
  ProjectCycleRow,
  "id" | "version" | "created_at" | "updated_at"
> & {
  id?: string;
  version?: number;
  created_at?: string;
  updated_at?: string;
};

type ProjectCycleUpdate = Partial<
  Omit<ProjectCycleRow, "id" | "project_id" | "created_at">
>;

type CycleTaskMembershipRow = {
  id: string;
  project_id: number;
  cycle_id: string;
  task_id: string;
  created_by: string | null;
  created_at: string;
};

type CycleTaskMembershipInsert = Omit<
  CycleTaskMembershipRow,
  "id" | "created_at"
> & {
  id?: string;
  created_at?: string;
};

type PublicSchema = Database["public"];

type PlaneCyclesDatabase = Omit<Database, "public"> & {
  public: Omit<PublicSchema, "Tables" | "Functions"> & {
    Tables: PublicSchema["Tables"] & {
      project_cycles: {
        Row: ProjectCycleRow;
        Insert: ProjectCycleInsert;
        Update: ProjectCycleUpdate;
        Relationships: [
          {
            foreignKeyName: "project_cycles_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      cycle_task_memberships: {
        Row: CycleTaskMembershipRow;
        Insert: CycleTaskMembershipInsert;
        Update: Partial<CycleTaskMembershipInsert>;
        Relationships: [
          {
            foreignKeyName: "cycle_task_memberships_cycle_id_fkey";
            columns: ["cycle_id"];
            isOneToOne: false;
            referencedRelation: "project_cycles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "cycle_task_memberships_task_id_fkey";
            columns: ["task_id"];
            isOneToOne: false;
            referencedRelation: "tasks";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Functions: PublicSchema["Functions"] & {
      set_cycle_task_memberships: {
        Args: {
          p_project_id: number;
          p_cycle_id: string;
          p_task_ids: string[];
          p_created_by: string;
        };
        Returns: CycleTaskMembershipRow[];
      };
    };
  };
};

export type PlaneCyclesDbClient = SupabaseClient<PlaneCyclesDatabase>;

/**
 * Temporary compile-time extension for tables introduced by the deferred
 * migration. Remove this cast after the migration is applied and canonical
 * Supabase types are regenerated.
 */
export function asPlaneCyclesDb(
  client: SupabaseClient<Database>,
): PlaneCyclesDbClient {
  return client as unknown as PlaneCyclesDbClient;
}
