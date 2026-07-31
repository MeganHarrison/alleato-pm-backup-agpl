import type { Json } from "@/types/database.types";

/**
 * Minimal checked-in type boundary for the dedicated ASRS project.
 *
 * Supabase type generation for `vqnnvpnoitqhijkztyhq` is currently rejected by
 * the configured account. Keep this surface intentionally narrow and update it
 * from live schema readback whenever the ASRS submission contract changes.
 */
export type AsrsDatabase = {
  public: {
    Tables: {
      fmds_visual_review_candidates: {
        Row: {
          id: string;
          source_id: string;
          source_type: string;
          status: string;
          output: Json;
        };
        Insert: {
          id?: string;
          source_id: string;
          source_type: string;
          status?: string;
          output: Json;
        };
        Update: {
          id?: string;
          source_id?: string;
          source_type?: string;
          status?: string;
          output?: Json;
        };
        Relationships: [];
      };
      fmds_table_cells: {
        Row: {
          id: string;
          table_id: string;
        };
        Insert: {
          id?: string;
          table_id: string;
        };
        Update: {
          id?: string;
          table_id?: string;
        };
        Relationships: [];
      };
      fmds_tables: {
        Row: {
          id: string;
          revision_id: string;
          evidence_image_path: string | null;
          extracted_structure: Json | null;
        };
        Insert: {
          id?: string;
          revision_id: string;
          evidence_image_path?: string | null;
          extracted_structure?: Json | null;
        };
        Update: {
          id?: string;
          revision_id?: string;
          evidence_image_path?: string | null;
          extracted_structure?: Json | null;
        };
        Relationships: [];
      };
      fm_form_submissions: {
        Row: {
          contact_info: Json | null;
          corpus_revision_id: string | null;
          cost_analysis: Json | null;
          created_at: string | null;
          evaluation_result: Json | null;
          evaluation_status: "verified" | "pending_review" | null;
          evaluator_inputs: Json | null;
          evaluator_key: string | null;
          id: string;
          lead_score: number | null;
          lead_status: string | null;
          matched_table_ids: string[] | null;
          parsed_requirements: Json | null;
          project_details: Json | null;
          recommendations: Json | null;
          selected_configuration: Json | null;
          session_id: string | null;
          similarity_scores: number[] | null;
          updated_at: string | null;
          user_input: Json;
        };
        Insert: {
          contact_info?: Json | null;
          corpus_revision_id?: string | null;
          cost_analysis?: Json | null;
          created_at?: string | null;
          evaluation_result?: Json | null;
          evaluation_status?: "verified" | "pending_review" | null;
          evaluator_inputs?: Json | null;
          evaluator_key?: string | null;
          id?: string;
          lead_score?: number | null;
          lead_status?: string | null;
          matched_table_ids?: string[] | null;
          parsed_requirements?: Json | null;
          project_details?: Json | null;
          recommendations?: Json | null;
          selected_configuration?: Json | null;
          session_id?: string | null;
          similarity_scores?: number[] | null;
          updated_at?: string | null;
          user_input: Json;
        };
        Update: {
          contact_info?: Json | null;
          corpus_revision_id?: string | null;
          cost_analysis?: Json | null;
          created_at?: string | null;
          evaluation_result?: Json | null;
          evaluation_status?: "verified" | "pending_review" | null;
          evaluator_inputs?: Json | null;
          evaluator_key?: string | null;
          id?: string;
          lead_score?: number | null;
          lead_status?: string | null;
          matched_table_ids?: string[] | null;
          parsed_requirements?: Json | null;
          project_details?: Json | null;
          recommendations?: Json | null;
          selected_configuration?: Json | null;
          session_id?: string | null;
          similarity_scores?: number[] | null;
          updated_at?: string | null;
          user_input?: Json;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      record_fmds_visual_review: {
        Args: {
          requested_candidate_ids: string[];
          requested_decision: string;
          requested_evidence_paths: string[];
          requested_notes: string;
          requested_reviewer_id: string;
          requested_reviewer_role: string;
          requested_source_id: string;
          requested_source_type: string;
        };
        Returns: string;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
