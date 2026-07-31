/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { NextResponse } from "next/server";

import { getPlaneSourceInfo } from "@/features/plane-license/source-info";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(getPlaneSourceInfo(), {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
