import fs from "node:fs";

import { expect, test, type Browser } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

test.use({ storageState: { cookies: [], origins: [] } });

const reviewerEmail = process.env.TEST_USER_1 ?? "test1@mail.com";
const projectId = Number(process.env.SUBCONTRACTOR_SOV_TEST_PROJECT_ID);
const commitmentId = process.env.SUBCONTRACTOR_SOV_TEST_COMMITMENT_ID;
const subcontractorEmail = process.env.SUBCONTRACTOR_SOV_TEST_EMAIL;
const subcontractorPassword = process.env.SUBCONTRACTOR_SOV_TEST_PASSWORD;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const reviewerStorageStatePath = "tests/.auth/user.json";

const shouldRun =
  Number.isFinite(projectId) &&
  !!commitmentId &&
  !!subcontractorEmail &&
  !!subcontractorPassword &&
  !!supabaseUrl &&
  !!serviceRoleKey;

type StorageStateCookie = {
  name: string;
  value: string;
};

type StorageState = {
  cookies?: StorageStateCookie[];
};

type StoredSupabaseSession = {
  user?: {
    id?: string;
    email?: string;
  };
};

function getReviewerAuthFromStorageState(expectedEmail: string) {
  const rawState = fs.readFileSync(reviewerStorageStatePath, "utf-8");
  const state = JSON.parse(rawState) as StorageState;
  const authCookie = state.cookies?.find((cookie) =>
    /^sb-.*-auth-token$/.test(cookie.name),
  );
  expect(authCookie, "Expected saved reviewer auth cookie").toBeTruthy();

  let sessionJson = authCookie!.value;
  if (sessionJson.startsWith("base64-")) {
    sessionJson = Buffer.from(sessionJson.slice(7), "base64").toString("utf-8");
  }

  const session = JSON.parse(sessionJson) as StoredSupabaseSession;
  expect(session.user?.id, "Expected reviewer auth user id in storage state").toBeTruthy();
  expect(session.user?.email?.toLowerCase()).toBe(expectedEmail.toLowerCase());

  return {
    id: session.user!.id!,
    email: session.user!.email!,
  };
}

async function ensureReviewerAccess(
  supabase: ReturnType<typeof createClient>,
  authUserId: string,
  email: string,
) {
  const { error: profileError } = await supabase
    .from("user_profiles")
    .upsert(
      {
        id: authUserId,
        email,
        full_name: "SOV Reviewer",
        is_active: true,
        is_admin: true,
        role: "admin",
      },
      { onConflict: "id" },
    );
  expect(profileError).toBeNull();

  const { data: existingAuthLink, error: authLinkLookupError } = await supabase
    .from("users_auth")
    .select("person_id")
    .eq("auth_user_id", authUserId)
    .maybeSingle();
  expect(authLinkLookupError).toBeNull();

  let personId = existingAuthLink?.person_id ?? null;
  if (!personId) {
    const { data: existingPerson, error: personLookupError } = await supabase
      .from("people")
      .select("id")
      .ilike("email", email)
      .maybeSingle();
    expect(personLookupError).toBeNull();

    personId = existingPerson?.id ?? null;
  }

  if (!personId) {
    const { data: createdPerson, error: personCreateError } = await supabase
      .from("people")
      .insert({
        first_name: "SOV",
        last_name: "Reviewer",
        email,
        person_type: "employee",
        auth_user_id: authUserId,
        status: "active",
      })
      .select("id")
      .single();
    expect(personCreateError).toBeNull();
    personId = createdPerson!.id;
  }

  const { error: usersAuthError } = await supabase
    .from("users_auth")
    .upsert(
      {
        auth_user_id: authUserId,
        person_id: personId,
      },
      { onConflict: "auth_user_id" },
    );
  expect(usersAuthError).toBeNull();

  const { error: membershipError } = await supabase
    .from("project_directory_memberships")
    .upsert(
      {
        person_id: personId,
        project_id: projectId,
        role: "Project Manager",
        user_type: "employee",
        status: "active",
      },
      { onConflict: "person_id,project_id" },
    );
  expect(membershipError).toBeNull();

  return personId;
}

async function approveAsReviewer(browser: Browser) {
  const reviewerContext = await browser.newContext({
    storageState: reviewerStorageStatePath,
  });
  await reviewerContext.addInitScript(() => {
    window.localStorage.setItem("alleato_onboarding_completed_v3", "e2e-skipped");
  });
  const reviewerPage = await reviewerContext.newPage();

  await reviewerPage.goto(`/${projectId}/commitments/${commitmentId}?tab=subcontractor-sov`);
  await expect(reviewerPage.getByText("Subcontractor Schedule of Values")).toBeVisible();
  await expect(reviewerPage.getByText("Under Review")).toBeVisible();
  await reviewerPage.getByRole("button", { name: /^approve$/i }).click();
  await expect(reviewerPage.getByText("Approved")).toBeVisible();

  await reviewerContext.close();
}

test.describe("subcontractor SOV submission", () => {
  test.skip(!shouldRun, "Set SUBCONTRACTOR_SOV_TEST_* env vars to run this external-user flow.");

  test("subcontractor can submit SOV and only sees invoice CTA after PM approval", async ({ page, browser }) => {
    const supabase = createClient(supabaseUrl!, serviceRoleKey!, {
      auth: { persistSession: false },
    });
    const reviewerAuthUser = getReviewerAuthFromStorageState(reviewerEmail);
    const reviewerPersonId = await ensureReviewerAccess(
      supabase,
      reviewerAuthUser.id,
      reviewerAuthUser.email,
    );

    const { data: submission, error: submissionError } = await supabase
      .from("subcontractor_sov_submissions")
      .select("id")
      .eq("project_id", projectId)
      .eq("commitment_id", commitmentId)
      .single();
    expect(submissionError).toBeNull();
    expect(submission?.id).toBeTruthy();

    await supabase
      .from("subcontractor_sov_items")
      .delete()
      .eq("submission_id", submission!.id);
    await supabase
      .from("subcontractor_sov_submissions")
      .update({
        status: "draft",
        submitted_at: null,
        submitted_by: null,
        reviewed_at: null,
        reviewed_by: null,
        review_notes: null,
      })
      .eq("id", submission!.id);

    await page.goto("/auth/login");
    await page.waitForSelector("form", { state: "attached" });
    await page.waitForTimeout(3000);
    await page.getByLabel("Email").fill(subcontractorEmail!);
    await page.getByRole("textbox", { name: "Password" }).fill(subcontractorPassword!);
    await page.getByRole("button", { name: /^login$/i }).click();

    await expect(page).toHaveURL(new RegExp(`/${projectId}/my-work`), {
      timeout: 60_000,
    });
    await expect(page.getByRole("heading", { name: "Schedule of Values" })).toBeVisible();
    await expect(page.getByRole("link", { name: /SC-1010-001/i })).toBeVisible();

    await page.getByRole("link", { name: /SC-1010-001/i }).click();
    await expect(page).toHaveURL(new RegExp(`/${projectId}/commitments/${commitmentId}`));
    await expect(page.getByText("Subcontractor Schedule of Values")).toBeVisible();

    await page.getByRole("button", { name: /add line item/i }).click();
    await page.getByPlaceholder("Line item description").fill("Automated SOV breakdown");
    await page.getByLabel("Amount").fill("200000");
    await page.getByRole("button", { name: /save changes/i }).click();
    await expect(page.getByRole("button", { name: /submit for review/i })).toBeEnabled();

    await page.getByRole("button", { name: /submit for review/i }).click();
    await expect(page.getByText("Under Review")).toBeVisible();
    await expect(page.getByPlaceholder("Line item description")).toBeDisabled();

    await page.goto(`/${projectId}/my-work`);
    await expect(page.getByRole("link", { name: /Under Review — Awaiting review/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /submit an invoice/i })).toHaveCount(0);
    await expect(
      page.getByText("Invoice submission opens after your Schedule of Values is approved."),
    ).toBeVisible();

    await approveAsReviewer(browser);

    const { data: reviewedSubmission, error: reviewedSubmissionError } = await supabase
      .from("subcontractor_sov_submissions")
      .select("status, reviewed_by, reviewed_at")
      .eq("id", submission!.id)
      .single();
    expect(reviewedSubmissionError).toBeNull();
    expect(reviewedSubmission?.status).toBe("approved");
    expect(reviewedSubmission?.reviewed_by).toBe(reviewerPersonId);
    expect(reviewedSubmission?.reviewed_at).toBeTruthy();

    await page.reload();
    await expect(page.getByText("Approved")).toBeVisible();
    await expect(page.getByRole("link", { name: /submit an invoice/i })).toBeVisible();
  });
});
