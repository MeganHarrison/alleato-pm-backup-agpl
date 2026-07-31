import {
  buildMeetingSignalBuckets,
  meetingSignalText,
  meetingSnippet,
} from "../meeting-insight-signals";

describe("meeting insight signal extraction", () => {
  it("extracts signals from summary and structured meeting fields when content is missing", () => {
    const row = {
      content: null,
      summary:
        "The team confirmed the permit revision path. Missing sprinkler coordination is a schedule risk.",
      action_items: ["Project Manager needs to follow up by Friday."],
      decisions: ["Owner approved the revised drawing sequence."],
      overview: "Waiting on final subcontractor verification.",
    };

    const text = meetingSignalText(row);
    const buckets = buildMeetingSignalBuckets([row]);

    expect(text).toContain("Owner approved the revised drawing sequence.");
    expect(meetingSnippet(row)).toContain("The team confirmed the permit revision path.");
    expect(buckets.decisions).toEqual(
      expect.arrayContaining([
        expect.stringContaining("confirmed"),
        expect.stringContaining("approved"),
      ]),
    );
    expect(buckets.promises).toEqual([
      expect.stringContaining("needs to follow up by Friday"),
    ]);
    expect(buckets.risks).toEqual([
      expect.stringContaining("schedule risk"),
    ]);
    expect(buckets.unresolvedQuestions).toEqual([
      expect.stringContaining("Waiting on final subcontractor verification"),
    ]);
  });
});
