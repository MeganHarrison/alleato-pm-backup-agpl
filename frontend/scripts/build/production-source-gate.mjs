const CANONICAL_PRODUCTION_SOURCE = Object.freeze({
  provider: "github",
  owner: "The-Alleato-Group",
  repository: "project-management",
  branch: "main",
});

function normalized(value) {
  return typeof value === "string" ? value.trim() : "";
}
function sameIdentity(actual, expected) {
  return normalized(actual).toLowerCase() === expected.toLowerCase();
}

export function validateProductionDeploymentSource(env = process.env) {
  if (normalized(env.VERCEL_ENV) !== "production") {
    return {
      checked: false,
      reason: "not a Vercel production build",
    };
  }

  const actual = {
    provider: normalized(env.VERCEL_GIT_PROVIDER),
    owner: normalized(env.VERCEL_GIT_REPO_OWNER),
    repository: normalized(env.VERCEL_GIT_REPO_SLUG),
    branch: normalized(env.VERCEL_GIT_COMMIT_REF),
    commit: normalized(env.VERCEL_GIT_COMMIT_SHA),
  };
  const failures = [];

  for (const key of ["provider", "owner", "repository", "branch"]) {
    if (!actual[key]) {
      failures.push(`${key}=missing`);
      continue;
    }
    if (!sameIdentity(actual[key], CANONICAL_PRODUCTION_SOURCE[key])) {
      failures.push(`${key}=${JSON.stringify(actual[key])}`);
    }
  }

  if (!actual.commit) {
    failures.push("commit=missing");
  }

  if (failures.length > 0) {
    return {
      checked: true,
      ok: false,
      failures,
      actual,
      expected: CANONICAL_PRODUCTION_SOURCE,
    };
  }

  return {
    checked: true,
    ok: true,
    actual,
    expected: CANONICAL_PRODUCTION_SOURCE,
  };
}

export function assertProductionDeploymentSource(env = process.env) {
  const result = validateProductionDeploymentSource(env);
  if (!result.checked) {
    console.log(`[production-source] Skipped: ${result.reason}.`);
    return result;
  }

  if (!result.ok) {
    throw new Error(
      "[production-source] Refusing Vercel production build. " +
        `Expected ${CANONICAL_PRODUCTION_SOURCE.provider}:` +
        `${CANONICAL_PRODUCTION_SOURCE.owner}/${CANONICAL_PRODUCTION_SOURCE.repository}` +
        `@${CANONICAL_PRODUCTION_SOURCE.branch}; observed ${result.failures.join(", ")}. ` +
        "Production must be built by the canonical GitHub main integration; " +
        "do not link a backup, fork, feature worktree, or local CLI checkout to the production project.",
    );
  }

  console.log(
    `[production-source] Verified ${result.actual.owner}/${result.actual.repository}` +
      `@${result.actual.branch} (${result.actual.commit.slice(0, 12)}).`,
  );
  return result;
}
