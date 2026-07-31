/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See LICENSES/NOTICE-PLANE.md for source and modification details.
 */

export const PLANE_MODULES_REVISION =
  "39856932cd6b9bd17eab0920506d628190b47af2";

export const PLANE_MODULES_SOURCE_PATHS = [
  "apps/api/plane/db/models/module.py",
  "apps/api/plane/api/serializers/module.py",
  "apps/api/plane/api/views/module.py",
  "packages/types/src/module/modules.ts",
  "packages/services/src/module/module.service.ts",
] as const;

export const PLANE_MODULES_SOURCE_OFFER_PATH = "/auth/source";
