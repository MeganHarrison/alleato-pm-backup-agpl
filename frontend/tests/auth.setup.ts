import fs from "node:fs";
import path from "node:path";

import { test as setup } from "@playwright/test";
import dotenv from "dotenv";

import { createSupabaseAdminClient, createSupabaseClient } from "./helpers/supabase";

const authFile = path.resolve(
  process.env.AUTH_STORAGE_STATE_PATH ?? path.join(__dirname, ".auth/user.json"),
);
const preserveExistingUser = process.env.AUTH_SETUP_PRESERVE_EXISTING_USER === "true";
const requireExistingUser = process.env.AUTH_SETUP_REQUIRE_EXISTING_USER === "true";

for (const envPath of [
  path.join(__dirname, "../../.env"),
  path.join(__dirname, "../.env.local"),
  path.join(__dirname, "../.env"),
]) {
  dotenv.config({ path: envPath, override: false });
}

// Use env vars with fallback to hardcoded test creds
const TEST_EMAIL = process.env.TEST_USER_1 ?? "test1@mail.com";
const TEST_PASSWORD = process.env.TEST_PASSWORD_1 ?? "test12026!!!";
const AUTH_SETUP_TIMEOUT_MS = 30_000;
// The first protected route can compile a large Next.js entrypoint in a cold
// dev server. Keep this separate from the Supabase operation timeout so a
// slow local compile is not misreported as an auth failure.
const AUTH_VERIFY_TIMEOUT_MS = 60_000;

/**
 * Extract Supabase project ref from the URL.
 * e.g. "https://lgveqfnpkxvzbnnwuled.supabase.co" → "lgveqfnpkxvzbnnwuled"
 */
function getProjectRef(): string {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const match = supabaseUrl.match(/https?:\/\/([^.]+)\.supabase\.co/);
  return match?.[1] ?? "lgveqfnpkxvzbnnwuled";
}

function authCookieOptions(baseUrl: string) {
  const parsed = new URL(baseUrl);
  const isHttps = parsed.protocol === "https:";

  return {
    domain: parsed.hostname,
    secure: isHttps,
    sameSite: "Lax" as const,
  };
}

type StoredSession = {
  accessToken: string;
  userId: string | null;
};

/**
 * Read a locally plausible session from user.json.
 *
 * This is only the local half of validation. A signed-looking, unexpired JWT
 * may still have been revoked by Supabase, so callers must also verify it
 * against Supabase Auth before reusing the storage state.
 */
function readValidExistingSession(baseUrl: string): StoredSession | null {
  try {
    if (!fs.existsSync(authFile)) return null;
    const state = JSON.parse(fs.readFileSync(authFile, "utf-8"));
    const authCookie = (state.cookies ?? []).find((c: { name: string }) =>
      /^sb-.*-auth-token/.test(c.name),
    );
    if (!authCookie) return null;
    const expectedCookie = authCookieOptions(baseUrl);
    if (authCookie.domain !== expectedCookie.domain) return null;
    if (Boolean(authCookie.secure) !== expectedCookie.secure) return null;
    if (
      typeof authCookie.expires === "number" &&
      authCookie.expires > 0 &&
      authCookie.expires * 1000 <= Date.now() + 5 * 60 * 1000
    ) {
      return null;
    }

    let sessionJson = authCookie.value as string;
    if (sessionJson.startsWith("base64-")) {
      sessionJson = Buffer.from(sessionJson.slice(7), "base64").toString();
    }
    const sessionData = JSON.parse(sessionJson);
    const jwt = sessionData?.access_token;
    if (!jwt) return null;

    const parts = jwt.split(".");
    if (parts.length !== 3) return null;
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString());

    if (!payload?.exp || payload.exp * 1000 <= Date.now() + 5 * 60 * 1000) {
      return null;
    }

    return {
      accessToken: jwt,
      userId: typeof payload.sub === "string" ? payload.sub : null,
    };
  } catch {
    return null;
  }
}

async function hasValidExistingSession(baseUrl: string): Promise<boolean> {
  const storedSession = readValidExistingSession(baseUrl);
  if (!storedSession) return false;

  const supabaseClient = createSupabaseClient();
  const { data, error } = await withAuthSetupTimeout(
    "Supabase stored-session verification",
    supabaseClient.auth.getUser(storedSession.accessToken),
  );

  if (error || !data.user || data.user.id !== storedSession.userId) {
    console.warn(
      "Existing auth storage state is locally unexpired but no longer valid in Supabase; signing in again.",
    );
    return false;
  }

  return true;
}

async function loadExistingSessionIntoContext(
  page: Parameters<typeof setup>[1]["page"],
) {
  const state = JSON.parse(fs.readFileSync(authFile, "utf-8"));
  const cookies = state.cookies ?? [];
  if (!Array.isArray(cookies) || cookies.length === 0) {
    throw new Error(
      [
        "Existing auth session file did not contain any cookies.",
        "Cause: frontend/tests/.auth/user.json is present but incomplete.",
        "Detection gap: auth setup previously checked token validity without ensuring the browser context received the saved cookies.",
        "Prevention: auth setup now loads saved cookies into the setup context before protected route verification.",
      ].join(" "),
    );
  }

  await page.context().addCookies(cookies);
}

async function withAuthSetupTimeout<T>(
  label: string,
  operation: Promise<T>,
): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_, reject) => {
        timeout = setTimeout(
          () =>
            reject(
              new Error(
                [
                  `Auth setup timed out during ${label} after ${AUTH_SETUP_TIMEOUT_MS}ms.`,
                  "Cause: Supabase Auth did not answer the setup request in time.",
                  "Detection gap: the Playwright auth setup previously awaited Supabase Auth without a local timeout, which could freeze verification runs.",
                  "Prevention: auth setup now fails loudly with the blocked operation name so verification can report the real dependency issue.",
                ].join(" "),
              ),
            ),
          AUTH_SETUP_TIMEOUT_MS,
        );
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

async function verifySavedAuthState(
  page: Parameters<typeof setup>[1]["page"],
  baseUrl: string,
) {
  await page.goto(`${baseUrl}/tasks`, {
    waitUntil: "domcontentloaded",
    timeout: AUTH_VERIFY_TIMEOUT_MS,
  });

  const currentUrl = new URL(page.url());
  if (currentUrl.pathname.startsWith("/auth/login")) {
    throw new Error(
      [
        "Auth setup saved a session, but protected route verification still redirected to login.",
        `Route: ${currentUrl.pathname}${currentUrl.search}`,
        "Cause: the generated Supabase auth cookie was not accepted by the local app.",
        "Detection gap: prior auth setup trusted the storage-state file without opening a protected route.",
        "Prevention: auth setup now verifies /tasks immediately after writing frontend/tests/.auth/user.json.",
      ].join(" "),
    );
  }
}

setup("authenticate", async ({ page, baseURL }) => {
  // The Playwright fixture is the canonical target for an explicit
  // PLAYWRIGHT_BASE_URL run. Environment BASE_URL may still point at local
  // development and must not mint a localhost cookie for production proof.
  const url = baseURL ?? process.env.AUTH_BASE_URL ?? process.env.BASE_URL ?? "http://localhost:3000";

  // Fast path: reuse existing valid session without any API calls
  if (await hasValidExistingSession(url)) {
    console.log("Existing auth session is still valid; verifying protected route access");
    await loadExistingSessionIntoContext(page);
    await verifySavedAuthState(page, url);
    return;
  }

  // Ensure test user exists in Supabase Auth
  const supabaseAdmin = createSupabaseAdminClient();
  const { data: userList } = await withAuthSetupTimeout(
    "Supabase admin listUsers",
    supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    }),
  );
  const existingUser = userList?.users?.find((u) => u.email === TEST_EMAIL);

  if (!existingUser) {
    if (requireExistingUser) {
      throw new Error(
        [
          `Auth setup requires an existing user for ${TEST_EMAIL}, but it was not found.`,
          "Cause: admin verification must never create a privileged account.",
          "Detection gap: shared auth setup previously created or reset every configured test identity.",
          "Prevention: configure a pre-existing allowlisted ADMIN_E2E_EMAIL and its secure ADMIN_E2E_PASSWORD.",
        ].join(" "),
      );
    }
    const { error } = await supabaseAdmin.auth.admin.createUser({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      email_confirm: true,
    });
    if (error) {
      throw new Error(`Auth setup failed creating test user: ${error.message}`);
    }
  } else if (!preserveExistingUser) {
    const { error } = await supabaseAdmin.auth.admin.updateUserById(
      existingUser.id,
      {
        password: TEST_PASSWORD,
        email_confirm: true,
      },
    );

    if (error) {
      throw new Error(`Auth setup failed updating test user password: ${error.message}`);
    }
  }

  // Sign in via Supabase API (no UI login — avoids rate limiting)
  const supabaseClient = createSupabaseClient();
  const { data: signInData, error: signInError } = await withAuthSetupTimeout(
    "Supabase password sign-in",
    supabaseClient.auth.signInWithPassword({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    }),
  );

  if (signInError || !signInData.session) {
    // Last resort: try UI login if API fails
    console.warn(
      `API sign-in failed (${signInError?.message}), falling back to UI login`,
    );
    await uiLogin(page, url);
    await page.context().storageState({ path: authFile });
    return;
  }

  // Build cookie value in the format @supabase/ssr expects:
  // "base64-<base64 encoded session JSON>"
  const session = signInData.session;
  const sessionJson = JSON.stringify({
    access_token: session.access_token,
    token_type: session.token_type,
    expires_in: session.expires_in,
    expires_at: session.expires_at,
    refresh_token: session.refresh_token,
    user: session.user,
    weak_password: null,
  });
  const cookieValue = `base64-${Buffer.from(sessionJson).toString("base64")}`;
  const projectRef = getProjectRef();
  const cookieOptions = authCookieOptions(url);

  // Set the auth cookie directly in the Playwright browser context
  await page.context().addCookies([
    {
      name: `sb-${projectRef}-auth-token`,
      value: cookieValue,
      domain: cookieOptions.domain,
      path: "/",
      // Cookie expires 1 year from now; the JWT access token expires sooner
      // but the browser will use the refresh token to get a new one.
      expires: Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60,
      httpOnly: false,
      secure: cookieOptions.secure,
      sameSite: cookieOptions.sameSite,
    },
  ]);

  // Save the auth state for subsequent test runs.
  // Cookies set via addCookies are captured by storageState without needing a navigation.
  await page.context().storageState({ path: authFile });
  await verifySavedAuthState(page, url);
  console.log(`Auth setup complete — session saved for ${TEST_EMAIL}`);
});

async function uiLogin(page: Parameters<typeof setup>[1]["page"], url: string) {
  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const navigated = await page
      .goto(`${url}/auth/login`, { waitUntil: "networkidle", timeout: 60000 })
      .then(() => true)
      .catch(() => false);

    if (!navigated) {
      await page.waitForTimeout(2000);
      continue;
    }

    const formMounted = await page
      .waitForSelector("form", { state: "attached", timeout: 30000 })
      .then(() => true)
      .catch(() => false);

    if (!formMounted) {
      const pathname = new URL(page.url()).pathname;
      if (!pathname.includes("/auth/login")) return; // already redirected = success
      continue;
    }

    await page.waitForTimeout(3000); // wait for React 19 hydration

    await page.locator("#email").fill(TEST_EMAIL);
    await page.locator("#password").fill(TEST_PASSWORD);
    await page.getByRole("button", { name: /login/i, exact: false }).click();

    const redirected = await page
      .waitForURL((u) => !u.pathname.includes("/auth/login"), { timeout: 15000 })
      .then(() => true)
      .catch(() => false);

    if (redirected) return;
    if (attempt < maxAttempts) await page.waitForTimeout(2000);
  }

  throw new Error(
    `UI login failed after ${maxAttempts} attempts for ${TEST_EMAIL}`,
  );
}
