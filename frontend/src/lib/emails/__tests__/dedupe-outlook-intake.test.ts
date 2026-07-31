import { dedupeOutlookIntakeByMessageId } from "../dedupe-outlook-intake";

describe("dedupeOutlookIntakeByMessageId", () => {
  it("collapses the same email fanned out across mailboxes into one representative", () => {
    // The exact production shape that caused "everything shows twice": one
    // message landed in three Alleato mailboxes, each a separate intake row
    // with its own graph_message_id but an identical internet_message_id.
    const rows = [
      { id: 4041, internet_message_id: "<abc@alleato>", project_email_id: null },
      { id: 4045, internet_message_id: "<abc@alleato>", project_email_id: null },
      { id: 4048, internet_message_id: "<abc@alleato>", project_email_id: null },
    ];

    const { representatives, memberIdsByRepresentativeId } =
      dedupeOutlookIntakeByMessageId(rows);

    expect(representatives).toHaveLength(1);
    expect(representatives[0].id).toBe(4041); // lowest id, deterministic
    expect(memberIdsByRepresentativeId.get(4041)).toEqual([4041, 4045, 4048]);
  });

  it("keeps distinct emails and preserves input order", () => {
    const rows = [
      { id: 10, internet_message_id: "<a@x>" },
      { id: 11, internet_message_id: "<b@x>" },
      { id: 12, internet_message_id: "<a@x>" },
    ];

    const { representatives } = dedupeOutlookIntakeByMessageId(rows);

    expect(representatives.map((r) => r.id)).toEqual([10, 11]);
  });

  it("never merges rows with a missing internet_message_id", () => {
    const rows = [
      { id: 1, internet_message_id: null },
      { id: 2, internet_message_id: "" },
      { id: 3, internet_message_id: "   " },
    ];

    const { representatives } = dedupeOutlookIntakeByMessageId(rows);

    expect(representatives.map((r) => r.id)).toEqual([1, 2, 3]);
  });

  it("prefers a copy already linked to an app project_emails row", () => {
    const rows = [
      { id: 100, internet_message_id: "<z@x>", project_email_id: null },
      { id: 101, internet_message_id: "<z@x>", project_email_id: 5001 },
    ];

    const { representatives, memberIdsByRepresentativeId } =
      dedupeOutlookIntakeByMessageId(rows);

    expect(representatives).toHaveLength(1);
    expect(representatives[0].id).toBe(101);
    // Union still tracks both copies so attachment state can be OR'd.
    expect(memberIdsByRepresentativeId.get(101)).toEqual([100, 101]);
  });

  it("treats internet_message_id case-insensitively", () => {
    const rows = [
      { id: 1, internet_message_id: "<ABC@Alleato>" },
      { id: 2, internet_message_id: "<abc@alleato>" },
    ];

    const { representatives } = dedupeOutlookIntakeByMessageId(rows);

    expect(representatives).toHaveLength(1);
  });

  it("returns an empty result for no rows", () => {
    const { representatives, memberIdsByRepresentativeId } =
      dedupeOutlookIntakeByMessageId([]);
    expect(representatives).toEqual([]);
    expect(memberIdsByRepresentativeId.size).toBe(0);
  });
});
