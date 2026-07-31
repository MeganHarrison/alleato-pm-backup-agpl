import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  assertApprovedUatResumeFixture,
  deriveUatBatchFileIdempotencyKey,
  hashRecruitingContact,
  parseUatIntakeFields,
  validateUatResume,
} from "@/lib/recruiting/intake-uat";

describe("recruiting intake UAT controls", () => {
  it("accepts synthetic applicant fields and normalizes the email", () => {
    const parsed = parseUatIntakeFields({
      firstName: "Test",
      lastName: "Candidate",
      email: " Jazmin+UAT-101@AlleatoGroup.com ",
      phone: "(317) 555-0100",
      requisitionId: "8b6e0d1c-0569-4ce4-b815-332a024274d2",
      idempotencyKey: "28bc7c42-f400-4884-a198-a7581b69a4be",
      consent: "true",
      website: "",
    });

    expect(parsed.email).toBe("jazmin+uat-101@alleatogroup.com");
    expect(parsed.phone).toBe("+13175550100");
    expect(hashRecruitingContact(parsed.email)).toHaveLength(64);
  });

  it("rejects an address that is not explicitly marked for UAT", () => {
    expect(() =>
      parseUatIntakeFields({
        firstName: "Real",
        lastName: "Applicant",
        email: "applicant@example.com",
        requisitionId: "8b6e0d1c-0569-4ce4-b815-332a024274d2",
        idempotencyKey: "28bc7c42-f400-4884-a198-a7581b69a4be",
        consent: "true",
        website: "",
      }),
    ).toThrow("Use an @alleatogroup.com email alias");
  });

  it("rejects +uat lookalikes while allowing renamed fixture copies", async () => {
    expect(() =>
      parseUatIntakeFields({
        firstName: "Test",
        lastName: "Candidate",
        email: "candidate+uattacker@alleatogroup.com",
        requisitionId: "8b6e0d1c-0569-4ce4-b815-332a024274d2",
        idempotencyKey: "28bc7c42-f400-4884-a198-a7581b69a4be",
        consent: "true",
        website: "",
      }),
    ).toThrow("Use an @alleatogroup.com email alias");

    const bytes = new TextEncoder().encode("%PDF-1.7\nresume");
    await expect(
      validateUatResume({
        name: "latest-resume.pdf",
        type: "application/pdf",
        size: bytes.byteLength,
        bytes,
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        extension: "pdf",
        contentType: "application/pdf",
      }),
    );
  });

  it("accepts a structurally valid synthetic PDF", async () => {
    const bytes = new TextEncoder().encode("%PDF-1.7\nsynthetic test resume");
    await expect(
      validateUatResume({
        name: "synthetic-test-resume.pdf",
        type: "application/pdf",
        size: bytes.byteLength,
        bytes,
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        extension: "pdf",
        contentType: "application/pdf",
      }),
    );
  });

  it("rejects a resume above the Vercel-safe 4 MB boundary", async () => {
    const bytes = new Uint8Array(4 * 1024 * 1024 + 1);
    bytes.set(new TextEncoder().encode("%PDF-"));
    await expect(
      validateUatResume({
        name: "synthetic-test-resume.pdf",
        type: "application/pdf",
        size: bytes.byteLength,
        bytes,
      }),
    ).rejects.toThrow("between 1 byte and 4 MB");
  });

  it("rejects a file whose content does not match its PDF label", async () => {
    const bytes = new TextEncoder().encode("not a pdf");
    await expect(
      validateUatResume({
        name: "synthetic-test-resume.pdf",
        type: "application/pdf",
        size: bytes.byteLength,
        bytes,
      }),
    ).rejects.toThrow("does not contain a valid PDF signature");
  });

  it("only accepts the repository-owned fixture content", () => {
    const fixture = readFileSync(
      join(process.cwd(), "public", "recruiting", "synthetic-test-resume.pdf"),
    );
    expect(assertApprovedUatResumeFixture(fixture)).toHaveLength(64);
    expect(() =>
      assertApprovedUatResumeFixture(
        new TextEncoder().encode("%PDF-1.7 renamed real resume"),
      ),
    ).toThrow("Only the provided synthetic test resume");
  });

  it("derives the same per-file key when a lost batch response is retried", () => {
    const input = {
      batchId: "e09c3fa7-a41f-46e9-b56d-62ef09be9813",
      sequence: 2,
      sha256:
        "03bd80dc9f726f230d82b2c1f1052d16661711d191b32125f63d96ffa2db0062",
    };

    expect(deriveUatBatchFileIdempotencyKey(input)).toBe(
      deriveUatBatchFileIdempotencyKey(input),
    );
    expect(deriveUatBatchFileIdempotencyKey(input)).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-a[0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it("keeps a stage-tested UAT application purgeable", () => {
    const migration = readFileSync(
      join(
        process.cwd(),
        "..",
        "supabase",
        "migrations",
        "20260730190000_recruiting_uat_pipeline_cleanup.sql",
      ),
      "utf8",
    );

    expect(migration).toContain(
      "delete from public.recruiting_stage_events",
    );
    expect(migration).toContain(
      "delete from public.recruiting_dispositions",
    );
    expect(migration).toContain(
      "delete from public.recruiting_activity_events",
    );
    expect(migration).toContain(
      "where application_id = v_submission.application_id",
    );
    expect(migration).toContain(
      "recruiting_guard_uat_application_stage_trigger",
    );
    expect(migration).toContain("recruiting_guard_uat_ai_trigger");
    expect(migration).toContain(
      "recruiting_guard_uat_provider_attempt_trigger",
    );
  });
});
