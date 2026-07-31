import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { GuardrailError } from "@/lib/guardrails/errors";
import type { Database } from "@/types/database.types";

type UatService = SupabaseClient<Database>;

export async function deleteRecruitingUatSubmission({
  service,
  actorPersonId,
  candidateId,
  storagePath,
  reason,
  storageAlreadyAbsent = false,
}: {
  service: UatService;
  actorPersonId: string;
  candidateId: string;
  storagePath: string;
  reason: "manual" | "expired" | "failed_upload" | "failed_verification";
  storageAlreadyAbsent?: boolean;
}): Promise<{ deleted: boolean }> {
  if (!storageAlreadyAbsent) {
    const storageResult = await service.storage
      .from("recruiting-uat-quarantine")
      .remove([storagePath]);
    if (storageResult.error) return { deleted: false };
  }

  const databaseResult = await service.rpc(
    "recruiting_delete_uat_submission",
    {
      p_actor_person_id: actorPersonId,
      p_candidate_id: candidateId,
      p_reason: reason,
    },
  );
  return {
    deleted: !databaseResult.error && databaseResult.data === true,
  };
}

export async function purgeExpiredRecruitingUatSubmissions({
  service,
  actorPersonId,
}: {
  service: UatService;
  actorPersonId?: string;
}): Promise<void> {
  const expiredResult = await service.rpc(
    "recruiting_list_expired_uat_submissions",
  );
  if (expiredResult.error) {
    throw new GuardrailError({
      code: "INTERNAL_ERROR",
      where: "recruiting/intake-uat/purge",
      message: "Expired recruiting UAT records could not be checked.",
    });
  }

  for (const item of expiredResult.data ?? []) {
    const result = await deleteRecruitingUatSubmission({
      service,
      actorPersonId: actorPersonId ?? item.submitted_by_person_id,
      candidateId: item.candidate_id,
      storagePath: item.storage_path,
      reason: "expired",
    });
    if (!result.deleted) {
      throw new GuardrailError({
        code: "INTERNAL_ERROR",
        where: "recruiting/intake-uat/purge",
        message:
          "An expired recruiting UAT record could not be fully deleted. Candidate intake UAT has been stopped until cleanup succeeds.",
      });
    }
  }
}
