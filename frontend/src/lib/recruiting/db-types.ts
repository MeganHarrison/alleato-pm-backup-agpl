import type { Json } from "@/types/database.types";

type RecruitingTable<Row> = {
  Row: Row;
  Insert: Partial<Row>;
  Update: Partial<Row>;
  Relationships: [];
};

type Timestamped = {
  created_at: string;
  updated_at: string;
};

export type RecruitingDatabase = {
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      recruiting_settings: RecruitingTable<
        Timestamped & {
          key: string;
          value: Json;
          updated_by_person_id: string | null;
        }
      >;
      recruiting_uat_submissions: RecruitingTable<{
        id: string;
        idempotency_key: string;
        request_hash: string;
        candidate_id: string;
        application_id: string | null;
        document_id: string;
        submitted_by_person_id: string;
        consent_version: string;
        consented_at: string;
        expires_at: string;
        created_at: string;
        batch_id: string | null;
        batch_sequence: number | null;
        assigned_requisition_id: string | null;
        assigned_at: string | null;
        assigned_by_person_id: string | null;
        assignment_idempotency_key: string | null;
        assignment_request_hash: string | null;
        row_version: number;
      }>;
      recruiting_uat_rate_limit_attempts: RecruitingTable<{
        id: number;
        actor_person_id: string;
        attempted_at: string;
      }>;
      recruiting_uat_deletion_audit: RecruitingTable<{
        id: string;
        submission_id: string;
        submitted_at: string;
        deleted_at: string;
        delete_reason: string;
        deleted_by_person_id: string;
        deleted_by_system: boolean;
      }>;
      recruiting_uat_feature_runs: RecruitingTable<{
        id: string;
        submission_id: string;
        action:
          | "resume_evidence_extraction"
          | "sms_preview"
          | "offer_esignature_preview"
          | "workflow_automation_preview"
          | "ai_evidence_summary";
        status: "succeeded";
        idempotency_key: string;
        request_hash: string;
        result: Json;
        initiated_by_person_id: string;
        expires_at: string;
        created_at: string;
      }>;
      recruiting_user_roles: RecruitingTable<{
        person_id: string;
        role:
          | "recruiting_admin"
          | "recruiter"
          | "hiring_manager"
          | "interviewer"
          | "executive";
        is_active: boolean;
        granted_by_person_id: string | null;
        granted_at: string;
        updated_at: string;
      }>;
      recruiting_documents: RecruitingTable<
        Timestamped & {
          id: string;
          candidate_id: string;
          application_id: string | null;
          document_type: string;
          storage_bucket: string;
          storage_path: string;
          original_file_name: string;
          content_type: string;
          byte_size: number;
          sha256: string;
          scan_status: string;
          extraction_status: string;
          human_review_status: string;
          retention_status: string;
          uploaded_by_person_id: string | null;
        }
      >;
      recruiting_requisitions: RecruitingTable<
        Timestamped & {
          id: string;
          requisition_number: string;
          title: string;
          department: string | null;
          employment_type: string;
          workplace_type: string;
          location_name: string | null;
          jobsite_name: string | null;
          hiring_manager_person_id: string | null;
          recruiter_person_id: string | null;
          headcount: number;
          compensation_min: number | null;
          compensation_max: number | null;
          compensation_period: string | null;
          target_start_date: string | null;
          description: string | null;
          business_justification: string | null;
          status:
            | "draft"
            | "pending_approval"
            | "approved"
            | "open"
            | "paused"
            | "filled"
            | "closed"
            | "canceled";
          is_confidential: boolean;
          row_version: number;
          created_by_person_id: string;
          updated_by_person_id: string | null;
          opened_at: string | null;
          closed_at: string | null;
        }
      >;
      recruiting_stage_definitions: RecruitingTable<{
        id: string;
        requisition_id: string;
        stage_key:
          | "new"
          | "review"
          | "qualified"
          | "interview"
          | "offer"
          | "hired"
          | "closed";
        label: string;
        position: number;
        is_terminal: boolean;
        requires_disposition: boolean;
        created_at: string;
      }>;
      recruiting_candidates: RecruitingTable<
        Timestamped & {
          id: string;
          display_name: string;
          first_name: string | null;
          last_name: string | null;
          preferred_name: string | null;
          current_company: string | null;
          current_title: string | null;
          location_text: string | null;
          linkedin_url: string | null;
          candidate_status:
            | "active"
            | "prospect"
            | "hired"
            | "archived"
            | "merged";
          merged_into_candidate_id: string | null;
          row_version: number;
          created_by_person_id: string | null;
          updated_by_person_id: string | null;
        }
      >;
      recruiting_candidate_contacts: RecruitingTable<
        Timestamped & {
          id: string;
          candidate_id: string;
          contact_type: "email" | "phone";
          value_display: string;
          value_normalized: string;
          value_hash: string;
          is_primary: boolean;
          is_verified: boolean;
          consent_status: "unknown" | "allowed" | "opted_out";
        }
      >;
      recruiting_applications: RecruitingTable<
        Timestamped & {
          id: string;
          requisition_id: string;
          candidate_id: string;
          current_stage:
            | "new"
            | "review"
            | "qualified"
            | "interview"
            | "offer"
            | "hired"
            | "closed";
          status: "active" | "withdrawn" | "rejected" | "hired" | "closed";
          disposition_code: string | null;
          disposition_reason: string | null;
          applied_at: string;
          last_activity_at: string;
          row_version: number;
          created_by_person_id: string | null;
          updated_by_person_id: string | null;
        }
      >;
      recruiting_tasks: RecruitingTable<
        Timestamped & {
          id: string;
          requisition_id: string | null;
          candidate_id: string | null;
          application_id: string | null;
          title: string;
          task_type: string;
          status: "open" | "in_progress" | "completed" | "canceled";
          priority: "low" | "normal" | "high" | "urgent";
          assigned_to_person_id: string | null;
          due_at: string | null;
          completed_at: string | null;
          created_by_person_id: string | null;
        }
      >;
      recruiting_requisition_approvals: RecruitingTable<{
        id: string;
        requisition_id: string;
        sequence: number;
        approver_person_id: string;
        status: "pending" | "approved" | "rejected" | "canceled";
        decision_reason: string | null;
        decided_at: string | null;
        created_at: string;
      }>;
      recruiting_interviews: RecruitingTable<
        Timestamped & {
          id: string;
          application_id: string;
          interview_plan_id: string | null;
          title: string;
          interview_type: string;
          status:
            | "draft"
            | "scheduling"
            | "scheduled"
            | "completed"
            | "canceled"
            | "no_show";
          starts_at: string | null;
          ends_at: string | null;
          time_zone: string | null;
          location_text: string | null;
          organizer_person_id: string | null;
          graph_event_id: string | null;
          teams_join_url: string | null;
          row_version: number;
          created_by_person_id: string;
        }
      >;
      recruiting_scorecard_submissions: RecruitingTable<
        Timestamped & {
          id: string;
          interview_id: string;
          template_id: string;
          interviewer_person_id: string;
          status: "draft" | "submitted";
          responses: Json;
          overall_recommendation: string | null;
          submitted_at: string | null;
          row_version: number;
        }
      >;
      recruiting_offers: RecruitingTable<
        Timestamped & {
          id: string;
          application_id: string;
          template_id: string | null;
          version: number;
          status: string;
          compensation_amount: number;
          compensation_period: string;
          proposed_start_date: string | null;
          expires_at: string | null;
          content_snapshot: Json;
          esignature_external_id: string | null;
          row_version: number;
          created_by_person_id: string;
          approved_by_person_id: string | null;
          sent_by_person_id: string | null;
        }
      >;
      recruiting_talent_pools: RecruitingTable<
        Timestamped & {
          id: string;
          name: string;
          description: string | null;
          is_active: boolean;
          created_by_person_id: string;
        }
      >;
      recruiting_automation_rules: RecruitingTable<
        Timestamped & {
          id: string;
          name: string;
          trigger_event: string;
          conditions: Json;
          action_definition: Json;
          is_enabled: boolean;
          requires_human_approval: boolean;
          created_by_person_id: string;
          updated_by_person_id: string | null;
        }
      >;
      recruiting_ai_runs: RecruitingTable<{
        id: string;
        candidate_id: string | null;
        application_id: string | null;
        requisition_id: string | null;
        action: string;
        status: string;
        model_provider: string | null;
        model_name: string | null;
        prompt_version: string;
        input_hash: string;
        protected_data_redacted: boolean;
        output_payload: Json | null;
        safe_error_code: string | null;
        safe_error_message: string | null;
        requested_by_person_id: string;
        requested_at: string;
        completed_at: string | null;
      }>;
      recruiting_provider_attempts: RecruitingTable<
        Timestamped & {
          id: string;
          requisition_id: string;
          candidate_id: string | null;
          application_id: string | null;
          provider_kind: string;
          operation: string;
          idempotency_key: string;
          request_hash: string;
          status: string;
          attempt_count: number;
          provider_external_id: string | null;
          safe_error_code: string | null;
          safe_error_message: string | null;
          next_attempt_at: string | null;
          claimed_at: string | null;
          completed_at: string | null;
          created_by_person_id: string;
        }
      >;
      recruiting_dispositions: RecruitingTable<{
        id: string;
        application_id: string;
        disposition_code: string;
        reason: string | null;
        actor_person_id: string;
        occurred_at: string;
      }>;
      recruiting_activity_events: RecruitingTable<{
        id: string;
        candidate_id: string | null;
        application_id: string | null;
        requisition_id: string | null;
        event_type: string;
        summary: string;
        detail: Json;
        visibility: "standard" | "restricted" | "system";
        actor_person_id: string;
        occurred_at: string;
      }>;
      recruiting_microsoft_connections: RecruitingTable<{
        person_id: string;
        tenant_id: string;
        microsoft_user_id: string;
        email: string;
        display_name: string | null;
        granted_scopes: string[];
        access_token_ciphertext: string;
        refresh_token_ciphertext: string;
        access_token_expires_at: string;
        connected_at: string;
        last_verified_at: string;
        updated_at: string;
      }>;
    };
    Views: Record<string, never>;
    Functions: {
      current_recruiting_person_id: {
        Args: never;
        Returns: string | null;
      };
      current_recruiting_role: {
        Args: never;
        Returns:
          | "recruiting_admin"
          | "recruiter"
          | "hiring_manager"
          | "interviewer"
          | "executive"
          | null;
      };
      current_recruiting_is_admin: {
        Args: never;
        Returns: boolean;
      };
      recruiting_transition_application: {
        Args: {
          p_application_id: string;
          p_to_stage: string;
          p_expected_row_version: number;
          p_reason: string | null;
          p_idempotency_key: string;
          p_request_hash: string;
        };
        Returns: Json;
      };
      recruiting_set_application_disposition: {
        Args: {
          p_application_id: string;
          p_disposition_code: string;
          p_reason: string | null;
          p_expected_row_version: number;
          p_idempotency_key: string;
          p_request_hash: string;
        };
        Returns: Json;
      };
      recruiting_set_uat_application_disposition: {
        Args: {
          p_application_id: string;
          p_disposition_code: string;
          p_reason: string | null;
          p_expected_row_version: number;
          p_idempotency_key: string;
          p_request_hash: string;
        };
        Returns: Json;
      };
      recruiting_create_requisition: {
        Args: {
          p_requisition_number: string;
          p_title: string;
          p_department: string | null;
          p_location: string | null;
          p_jobsite: string | null;
          p_headcount: number;
          p_is_confidential: boolean;
          p_idempotency_key: string;
          p_request_hash: string;
        };
        Returns: Json;
      };
      recruiting_set_requisition_lifecycle: {
        Args: {
          p_requisition_id: string;
          p_next_status: "closed" | "canceled";
          p_expected_row_version: number;
          p_reason: string;
          p_idempotency_key: string;
          p_request_hash: string;
        };
        Returns: Json;
      };
      recruiting_delete_unused_draft_requisition: {
        Args: {
          p_requisition_id: string;
          p_expected_row_version: number;
          p_idempotency_key: string;
          p_request_hash: string;
        };
        Returns: Json;
      };
      recruiting_create_task: {
        Args: {
          p_requisition_id: string;
          p_candidate_id: string | null;
          p_application_id: string | null;
          p_title: string;
          p_task_type: string;
          p_priority: string;
          p_due_at: string | null;
          p_idempotency_key: string;
          p_request_hash: string;
        };
        Returns: Json;
      };
      recruiting_request_ai_assistance: {
        Args: {
          p_action: string;
          p_requisition_id: string | null;
          p_candidate_id: string | null;
          p_application_id: string | null;
          p_prompt_version: string;
          p_idempotency_key: string;
          p_request_hash: string;
        };
        Returns: Json;
      };
      recruiting_get_microsoft_connection_status: {
        Args: never;
        Returns: Json;
      };
      recruiting_admin_get_microsoft_connection_secret: {
        Args: {
          p_person_id: string;
        };
        Returns: Json | null;
      };
      recruiting_admin_upsert_microsoft_connection: {
        Args: {
          p_person_id: string;
          p_tenant_id: string;
          p_microsoft_user_id: string;
          p_email: string;
          p_display_name: string | null;
          p_granted_scopes: string[];
          p_access_token_ciphertext: string;
          p_refresh_token_ciphertext: string;
          p_access_token_expires_at: string;
          p_capability: "mail" | "calendar" | "all";
        };
        Returns: Json;
      };
      recruiting_disconnect_microsoft_connection: {
        Args: never;
        Returns: boolean;
      };
      recruiting_admin_refresh_microsoft_connection_tokens: {
        Args: {
          p_person_id: string;
          p_access_token_ciphertext: string;
          p_refresh_token_ciphertext: string;
          p_access_token_expires_at: string;
          p_granted_scopes: string[];
        };
        Returns: boolean;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
