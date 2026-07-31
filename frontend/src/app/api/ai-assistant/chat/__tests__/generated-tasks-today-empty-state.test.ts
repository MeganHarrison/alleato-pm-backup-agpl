import fs from "node:fs";
import path from "node:path";

// Regression guard for the "no tasks for today" bug: the assistant reported a
// confident void ("No task rows were created today in the Tasks table.") when in
// reality task extraction just hadn't caught up yet — meetings were ingested but
// not yet processed into task rows. The fix distinguishes VOID from LAG. These
// assertions read the handler source (matching the sibling seam tests, which
// avoid importing the heavy handler module) and would fail if the confident-void
// copy or the lag framing regressed.
describe("generated-tasks-today empty state (void vs lag)", () => {
  const handler = fs.readFileSync(
    path.resolve(__dirname, "..", "handler-v2.ts"),
    "utf8",
  );

  test("the flat confident-void copy is gone", () => {
    expect(handler).not.toContain(
      "No task rows were created today in the Tasks table.",
    );
  });

  test("empty state frames an unprocessed day as processing lag, not a void", () => {
    expect(handler).toContain("No tasks have been generated for today");
    expect(handler).toContain("point-in-time count, not a final tally");
  });

  test("loader probes meetings ingested today when the task lookup is empty", () => {
    // The lag/void decision must be data-driven: when zero task rows come back,
    // count today's meetings so the message can say "still processing".
    expect(handler).toContain("meetingsIngestedToday");
    expect(handler).toContain(
      "type.eq.meeting,category.eq.meeting,type.eq.meeting_transcript",
    );
  });
});
