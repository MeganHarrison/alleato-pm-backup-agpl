import { defineSchedule } from "eve/schedules";

// Fires 12:30 UTC on weekdays — after the morning ingestion/compile crons, so a
// drift caused by overnight code merges or data syncs is caught the same day.
// Delivery is intentionally report-only in v1: the run inspects and logs. Wire a
// Slack/Teams/Linear channel handoff (see eve docs: Schedules → handler form)
// before enabling notifications, and keep mutation human-approved.
export default defineSchedule({
  cron: "30 12 * * 1-5",
  async run({ waitUntil }) {
    waitUntil(
      Promise.resolve().then(() => {
        console.info(
          "Docs freshness maintainer schedule fired. v1 is report-only: run summarize_doc_findings to detect PROJECT-MAP / TABLE-LIST drift and AI-RAG-ARCHITECTURE staleness. Regeneration stays approval-gated; wire a channel before enabling delivery.",
        );
      }),
    );
  },
});
