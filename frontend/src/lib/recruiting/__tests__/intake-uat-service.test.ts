jest.mock("server-only", () => ({}));

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  deleteRecruitingUatSubmission,
  purgeExpiredRecruitingUatSubmissions,
} from "@/lib/recruiting/intake-uat-service";
import type { Database } from "@/types/database.types";

function serviceMock({
  storageError = null,
  deleteError = null,
  deleted = true,
  expired = [],
}: {
  storageError?: { message: string } | null;
  deleteError?: { message: string } | null;
  deleted?: boolean;
  expired?: {
    candidate_id: string;
    storage_path: string;
    submitted_by_person_id: string;
  }[];
} = {}) {
  const remove = jest.fn().mockResolvedValue({ error: storageError });
  const rpc = jest.fn(
    async (name: string): Promise<{ data: unknown; error: unknown }> => {
      if (name === "recruiting_list_expired_uat_submissions") {
        return { data: expired, error: null };
      }
      return { data: deleted, error: deleteError };
    },
  );
  return {
    remove,
    rpc,
    service: {
      storage: {
        from: jest.fn(() => ({ remove })),
      },
      rpc,
    } as SupabaseClient<Database>,
  };
}

describe("recruiting UAT cleanup", () => {
  it("does not delete database metadata when storage deletion fails", async () => {
    const mock = serviceMock({ storageError: { message: "storage down" } });
    await expect(
      deleteRecruitingUatSubmission({
        service: mock.service,
        actorPersonId: "actor-id",
        candidateId: "candidate-id",
        storagePath: "uat/candidate/resume.pdf",
        reason: "manual",
      }),
    ).resolves.toEqual({ deleted: false });
    expect(mock.rpc).not.toHaveBeenCalled();
  });

  it("reports success only after storage and transactional deletion succeed", async () => {
    const mock = serviceMock();
    await expect(
      deleteRecruitingUatSubmission({
        service: mock.service,
        actorPersonId: "actor-id",
        candidateId: "candidate-id",
        storagePath: "uat/candidate/resume.pdf",
        reason: "manual",
      }),
    ).resolves.toEqual({ deleted: true });
    expect(mock.remove).toHaveBeenCalledWith(["uat/candidate/resume.pdf"]);
    expect(mock.rpc).toHaveBeenCalledWith(
      "recruiting_delete_uat_submission",
      expect.objectContaining({ p_candidate_id: "candidate-id" }),
    );
  });

  it("fails closed when an expired record cannot be fully purged", async () => {
    const mock = serviceMock({
      storageError: { message: "storage down" },
      expired: [
        {
          candidate_id: "candidate-id",
          storage_path: "uat/candidate/resume.pdf",
          submitted_by_person_id: "actor-id",
        },
      ],
    });
    await expect(
      purgeExpiredRecruitingUatSubmissions({
        service: mock.service,
        actorPersonId: "actor-id",
      }),
    ).rejects.toThrow("could not be fully deleted");
  });
});
