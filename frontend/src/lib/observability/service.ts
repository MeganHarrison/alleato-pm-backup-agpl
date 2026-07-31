import { createClient } from "@supabase/supabase-js";
import type { Json } from "@/types/database.types";

export type AppRequestLogRow = {
  id: string;
  request_id: string;
  method: string;
  path: string;
  query_string: string | null;
  status_code: number | null;
  duration_ms: number | null;
  user_id: string | null;
  user_email: string | null;
  client_ip_hash: string | null;
  user_agent: string | null;
  referrer: string | null;
  source: string;
  metadata: Json;
  created_at: string;
};

export type DeveloperCommitLogRow = {
  id: string;
  repository_full_name: string;
  branch: string;
  commit_sha: string;
  commit_message: string | null;
  commit_url: string | null;
  compare_url: string | null;
  commit_author_name: string | null;
  commit_author_email: string | null;
  commit_committer_name: string | null;
  commit_committer_email: string | null;
  pushed_by_username: string | null;
  pushed_by_name: string | null;
  pushed_by_email: string | null;
  webhook_delivery_id: string | null;
  event_type: string;
  pushed_at: string;
  received_at: string;
  raw_payload: Json;
};

type OperationalDatabase = {
  public: {
    Tables: {
      app_request_log: {
        Row: AppRequestLogRow;
        Insert: Omit<AppRequestLogRow, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<AppRequestLogRow>;
        Relationships: [];
      };
      developer_commit_log: {
        Row: DeveloperCommitLogRow;
        Insert: Omit<DeveloperCommitLogRow, "id" | "received_at"> & {
          id?: string;
          received_at?: string;
        };
        Update: Partial<DeveloperCommitLogRow>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

/** Typed service-role client for tables applied ahead of the generated schema snapshot. */
export function createOperationalServiceClient() {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error(
      "Missing SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL for operational logging.",
    );
  }
  if (!serviceRoleKey) {
    throw new Error(
      "Missing SUPABASE_SERVICE_ROLE_KEY for operational logging.",
    );
  }

  return createClient<OperationalDatabase>(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
