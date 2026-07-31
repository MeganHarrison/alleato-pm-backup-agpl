/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export const PLANE_SOURCE_REPOSITORY_URL =
  "https://github.com/MeganHarrison/alleato-pm-backup-agpl";

export const PLANE_LICENSE = "AGPL-3.0-only";

function deployedRevision() {
  const revision = process.env.AGPL_SOURCE_COMMIT_SHA?.trim();
  return revision && /^[a-f0-9]{7,64}$/i.test(revision) ? revision : null;
}

export function getPlaneSourceInfo() {
  const revision = deployedRevision();

  return {
    repositoryUrl: PLANE_SOURCE_REPOSITORY_URL,
    revision,
    sourceUrl: revision
      ? `${PLANE_SOURCE_REPOSITORY_URL}/tree/${revision}`
      : PLANE_SOURCE_REPOSITORY_URL,
    license: PLANE_LICENSE,
    noticeUrl: "/auth/source",
  } as const;
}
