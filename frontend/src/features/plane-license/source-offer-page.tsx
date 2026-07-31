/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import Link from "next/link";

import { getPlaneSourceInfo } from "./source-info";

export function PlaneSourceOfferPage() {
  const sourceInfo = getPlaneSourceInfo();

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-6 py-16 text-foreground">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Open-source notice
      </p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">
        Corresponding source code
      </h1>
      <p className="mt-5 leading-7 text-muted-foreground">
        This deployment includes software adapted from Plane. The Plane-derived
        portions and the combined corresponding source are offered under the GNU
        Affero General Public License, version 3 only.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href={sourceInfo.sourceUrl}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Obtain the exact source
        </Link>
        <Link
          href="https://github.com/makeplane/plane"
          className="rounded-md border border-border px-4 py-2 text-sm font-medium"
        >
          Plane upstream
        </Link>
      </div>
      <p className="mt-8 text-sm leading-6 text-muted-foreground">
        Plane copyright (c) 2023-present Plane Software, Inc. and contributors.
        License: AGPL-3.0-only. The source repository records the deployed
        revision and preserves the applicable notices and modification history.
      </p>
      {sourceInfo.revision && (
        <p className="mt-3 font-mono text-xs text-muted-foreground">
          Deployed source revision: {sourceInfo.revision}
        </p>
      )}
    </main>
  );
}
