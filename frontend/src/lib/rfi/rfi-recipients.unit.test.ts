import {
  classifyRfiRecipientEntries,
  personFullNameKey,
} from "./rfi-recipients";

const UUID = "11111111-1111-4111-8111-111111111111";
const UUID_2 = "22222222-2222-4222-9222-222222222222";

describe("classifyRfiRecipientEntries", () => {
  it("keeps name-shaped distribution entries as resolvable names (regression: they used to be silently dropped)", () => {
    const { personIds, emails, names } = classifyRfiRecipientEntries([
      "Brandon Clymer",
    ]);

    expect(personIds.size).toBe(0);
    expect(emails.size).toBe(0);
    expect([...names]).toEqual(["brandon clymer"]);
  });

  it("routes each entry shape to its own bucket", () => {
    const { personIds, emails, names } = classifyRfiRecipientEntries([
      UUID,
      "person@example.com",
      "Brandon Clymer",
    ]);

    expect([...personIds]).toEqual([UUID]);
    expect([...emails]).toEqual(["person@example.com"]);
    expect([...names]).toEqual(["brandon clymer"]);
  });

  it("handles a mixed distribution list so no recipient shape is lost", () => {
    const { personIds, emails, names } = classifyRfiRecipientEntries([
      UUID,
      UUID_2,
      "Jane Doe",
      "Brandon Clymer",
      "manager@example.com",
    ]);

    expect(personIds.size).toBe(2);
    expect(emails.size).toBe(1);
    expect(names.size).toBe(2);
  });

  it("skips null, undefined, and blank entries", () => {
    const { personIds, emails, names } = classifyRfiRecipientEntries([
      null,
      undefined,
      "",
      "   ",
    ]);

    expect(personIds.size).toBe(0);
    expect(emails.size).toBe(0);
    expect(names.size).toBe(0);
  });

  it("normalizes name whitespace and casing for stable matching", () => {
    const { names } = classifyRfiRecipientEntries(["  Brandon   Clymer  "]);
    expect([...names]).toEqual(["brandon clymer"]);
  });

  it("deduplicates equivalent name entries", () => {
    const { names } = classifyRfiRecipientEntries([
      "Brandon Clymer",
      "brandon clymer",
    ]);
    expect(names.size).toBe(1);
  });
});

describe("personFullNameKey", () => {
  it("matches the normalized key produced for name-shaped entries", () => {
    const { names } = classifyRfiRecipientEntries(["Brandon Clymer"]);
    expect(names.has(personFullNameKey("Brandon", "Clymer"))).toBe(true);
  });

  it("tolerates null name parts", () => {
    expect(personFullNameKey(null, "Clymer")).toBe("clymer");
    expect(personFullNameKey("Brandon", null)).toBe("brandon");
    expect(personFullNameKey(null, null)).toBe("");
  });
});
