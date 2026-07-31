"use client";

import dynamic from "next/dynamic";

// Client boundary that lazy-loads the analytics panel (and its recharts
// dependency) so `recharts` is not pulled into the /analytics route's First
// Load JS until the panel renders. ssr:false because recharts is browser-only.
// Kept in its own client module so the /analytics page can stay a server
// component.
const PlatformAnalyticsPanelDynamic = dynamic(
  () =>
    import("./platform-analytics-panel").then(
      (mod) => mod.PlatformAnalyticsPanel,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center py-24">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-foreground/40 border-t-foreground" />
      </div>
    ),
  },
);

export default PlatformAnalyticsPanelDynamic;
