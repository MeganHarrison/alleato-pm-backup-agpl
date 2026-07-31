import { expect, test, type APIRequestContext } from "@playwright/test";
import { join } from "node:path";

import { createAuthenticatedRequestContext } from "../../helpers/api-auth";

const storageStatePath = join(__dirname, "../..", ".auth/user.json");
const appUrl =
  process.env.BASE_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

test.describe("Documents API", () => {
  let apiContext: APIRequestContext;

  test.beforeAll(async ({ playwright }) => {
    apiContext = await createAuthenticatedRequestContext(
      playwright,
      storageStatePath,
      appUrl,
    );
  });

  test.afterAll(async () => {
    await apiContext.dispose();
  });

  test("GET /api/documents/status returns document list payload", async () => {
    const response = await apiContext.get("/api/documents/status");
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(Array.isArray(body.documents ?? [])).toBe(true);
  });

  test("GET /api/documents/trigger-pipeline returns phase counts payload", async () => {
    const response = await apiContext.get("/api/documents/trigger-pipeline");
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(Array.isArray(body.phaseCounts ?? [])).toBe(true);
  });
});
