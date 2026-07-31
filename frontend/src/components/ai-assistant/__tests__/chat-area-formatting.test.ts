import { formatStructuredMeetingList } from "../chat-formatting";

describe("formatStructuredMeetingList", () => {
  it("preserves sections after numbered action lists", () => {
    const text = [
      "**Hard Facts**",
      "Budget status is unknown.",
      "",
      "**Recommended Actions**",
      "1. **Escalate for Owner Direction** - Confirm scope this week.",
      "2. **Resolve Pending Change Order** - Approve or reject CO-003.",
      "",
      "**Next Step**",
      "Schedule the owner decision meeting by Friday.",
    ].join("\n");

    const formatted = formatStructuredMeetingList(text);

    expect(formatted).toContain("**Hard Facts**");
    expect(formatted).toContain("### 1. Escalate for Owner Direction");
    expect(formatted).toContain("### 2. Resolve Pending Change Order");
    expect(formatted).toContain("**Next Step**");
    expect(formatted).toContain("Schedule the owner decision meeting by Friday.");
  });

  it("prevents retrieved meeting snippets from rendering as markdown headings", () => {
    const text = [
      "**Recent Meetings**",
      "",
      "1. **Uniqlo+Alleato Group** — 2026-04-29",
      "   # Uniqlo+Alleato Group Date: 2026-04-29T21:30:00+00:00 Duration: 6 minutes Organizer Email: mcalcetero@alleatogroup.com",
      "2. **Ulta Dallas Sprinkler Analysis** — 2026-04-29",
      "   ## Ulta Dallas Sprinkler Analysis Date: 2026-04-29T19:30:00+00:00 Duration: 11 minutes",
    ].join("\n");

    const formatted = formatStructuredMeetingList(text);

    expect(formatted).toContain("Uniqlo+Alleato Group Date: 2026-04-29T21:30:00+00:00");
    expect(formatted).toContain("Ulta Dallas Sprinkler Analysis Date: 2026-04-29T19:30:00+00:00");
    expect(formatted).not.toContain("   # Uniqlo+Alleato Group Date");
    expect(formatted).not.toContain("   ## Ulta Dallas Sprinkler Analysis Date");
  });

  it("repairs inline assistant markdown so headings and bullets render", () => {
    const text =
      "I can help in four ways that actually move work. ### 1. Tell you what's going on I can pull real status around it: - latest meetings - emails and Teams chatter - budget / forecast / margin ### 2. Answer money questions I can dig into: - budgets - cost overruns - vendor spend";

    const formatted = formatStructuredMeetingList(text);

    expect(formatted).toContain(
      "I can help in four ways that actually move work.\n\n### 1. Tell you what's going on\n\nI can pull real status around it:",
    );
    expect(formatted).toContain("- latest meetings\n- emails and Teams chatter\n- budget / forecast / margin");
    expect(formatted).toContain("### 2. Answer money questions\n\nI can dig into:");
    expect(formatted).toContain("- budgets\n- cost overruns\n- vendor spend");
  });
});
