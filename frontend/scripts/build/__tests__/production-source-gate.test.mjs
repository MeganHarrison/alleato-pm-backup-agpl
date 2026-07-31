import assert from "node:assert/strict";
import test from "node:test";

import {
  assertProductionDeploymentSource,
  validateProductionDeploymentSource,
} from "../production-source-gate.mjs";

const canonicalProductionEnv = {
  VERCEL: "1",
  VERCEL_ENV: "production",
  VERCEL_GIT_PROVIDER: "github",
  VERCEL_GIT_REPO_OWNER: "The-Alleato-Group",
  VERCEL_GIT_REPO_SLUG: "project-management",
  VERCEL_GIT_COMMIT_REF: "main",
  VERCEL_GIT_COMMIT_SHA: "7a4bd8b6e632e3d7dc1e0deaed22b697f6020e46",
};

test("allows the canonical GitHub main production source", () => {
  const result = validateProductionDeploymentSource(canonicalProductionEnv);

  assert.equal(result.checked, true);
  assert.equal(result.ok, true);
  assert.equal(result.actual.repository, "project-management");
});
test("does not constrain local or preview builds", () => {
  assert.deepEqual(validateProductionDeploymentSource({ NODE_ENV: "production" }), {
    checked: false,
    reason: "not a Vercel production build",
  });
  assert.deepEqual(validateProductionDeploymentSource({ VERCEL_ENV: "preview" }), {
    checked: false,
    reason: "not a Vercel production build",
  });
});

test("rejects the backup repository before the production build starts", () => {
  assert.throws(
    () =>
      assertProductionDeploymentSource({
        ...canonicalProductionEnv,
        VERCEL_GIT_REPO_OWNER: "MeganHarrison",
        VERCEL_GIT_REPO_SLUG: "alleato-pm-backup",
      }),
    /Refusing Vercel production build[\s\S]*owner="MeganHarrison"[\s\S]*repository="alleato-pm-backup"/,
  );
});

test("rejects local CLI production deploys with missing GitHub source identity", () => {
  assert.throws(
    () =>
      assertProductionDeploymentSource({
        VERCEL: "1",
        VERCEL_ENV: "production",
        VERCEL_GIT_COMMIT_REF: "codex/s019f94ef-ai-capabilities-detail-941cea",
        VERCEL_GIT_COMMIT_SHA: "09223ce2428c15ec1c7fc07295d7ed0b12166e11",
      }),
    /provider=missing[\s\S]*owner=missing[\s\S]*repository=missing[\s\S]*branch="codex\/s019f94ef/,
  );
});

test("rejects a feature branch even when the repository is canonical", () => {
  assert.throws(
    () =>
      assertProductionDeploymentSource({
        ...canonicalProductionEnv,
        VERCEL_GIT_COMMIT_REF: "feat/login-dark-bg",
      }),
    /branch="feat\/login-dark-bg"/,
  );
});
