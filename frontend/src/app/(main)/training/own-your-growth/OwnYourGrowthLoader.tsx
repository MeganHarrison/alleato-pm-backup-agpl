"use client";

import dynamic from "next/dynamic";

// The skill wheel renders SVG paths from trigonometric functions on every
// score change. Math.cos/Math.sin can differ by a ULP between Node's SSR
// pass and the browser's JS engine, which showed up as a hydration mismatch
// on the wedge path `d` attributes. This view has no SEO value, so it's
// rendered client-only to sidestep server/client diffs entirely rather than
// chasing floating-point parity. `ssr: false` requires a Client Component,
// which is why this loader is split out from the server page.tsx.
const OwnYourGrowthClient = dynamic(
  () => import("./OwnYourGrowthClient").then((mod) => mod.OwnYourGrowthClient),
  { ssr: false },
);

export function OwnYourGrowthLoader() {
  return <OwnYourGrowthClient />;
}
