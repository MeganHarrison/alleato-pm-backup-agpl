import { deriveBrandonEmailAssistantDecision } from "../brandon-triage";

describe("deriveBrandonEmailAssistantDecision", () => {
  it("flags direct external asks as Brandon replies", () => {
    const decision = deriveBrandonEmailAssistantDecision({
      subject: "Can you confirm tomorrow?",
      bodyText: "Brandon, please confirm if 3pm tomorrow works for the meeting.",
      fromEmail: "lauren@example.com",
      fromName: "Lauren",
      toList: ["bclymer@alleatogroup.com"],
      ccList: [],
      mailboxUserId: "bclymer@alleatogroup.com",
      hasAttachments: false,
      receivedAt: "2026-06-17T10:00:00Z",
    });

    expect(decision.action).toBe("reply");
    expect(decision.owner).toBe("Brandon");
    expect(decision.priority).toBe("urgent");
    expect(decision.reason).toContain("time-sensitive");
  });

  it("routes internal approval or project risk to delegation", () => {
    const decision = deriveBrandonEmailAssistantDecision({
      subject: "Change order approval needed",
      bodyText: "Please approve the change order by EOD so the schedule does not slip.",
      fromEmail: "pm@alleatogroup.com",
      fromName: "Project Manager",
      toList: ["bclymer@alleatogroup.com"],
      ccList: [],
      mailboxUserId: "bclymer@alleatogroup.com",
      hasAttachments: true,
      receivedAt: "2026-06-17T11:00:00Z",
    });

    expect(decision.action).toBe("delegate");
    expect(decision.owner).toBe("Alleato team");
    expect(decision.priority).toBe("urgent");
    expect(decision.risk).toContain("Operational");
  });

  it("does not elevate automated low-signal mail", () => {
    const decision = deriveBrandonEmailAssistantDecision({
      subject: "Daily summary",
      bodyText: "This is your automated daily summary.",
      fromEmail: "noreply@service.example",
      fromName: "Service",
      toList: ["bclymer@alleatogroup.com"],
      ccList: [],
      mailboxUserId: "bclymer@alleatogroup.com",
      hasAttachments: false,
      receivedAt: "2026-06-17T12:00:00Z",
    });

    expect(decision.action).toBe("ignore");
    expect(decision.priority).toBe("low");
  });

  it("watches risky external context when there is no direct ask", () => {
    const decision = deriveBrandonEmailAssistantDecision({
      subject: "Appeal packet attached",
      bodyText: "Attached is the latest appeal packet and permit context for your records.",
      fromEmail: "county@example.gov",
      fromName: "County",
      toList: ["bclymer@alleatogroup.com"],
      ccList: [],
      mailboxUserId: "bclymer@alleatogroup.com",
      hasAttachments: true,
      receivedAt: "2026-06-17T13:00:00Z",
    });

    expect(decision.action).toBe("watch");
    expect(decision.reason).toContain("project, legal, schedule, or payment");
  });

  it("keeps decision evidence readable when synced body text contains email headers", () => {
    const decision = deriveBrandonEmailAssistantDecision({
      subject: "Re: Please see the attached",
      bodyText: [
        "Subject: Re: Please see the attached",
        "Date: 2026-06-30T11:28:50Z",
        "From: Michael McCoy <MMcCoy@example.com>",
        "To: Kebb...",
        "",
        "Please confirm Brandon can review the attached invoice by EOD. From: Older Sender <older@example.com> Sent: Monday",
      ].join("\n"),
      fromEmail: "mmccoy@example.com",
      fromName: "Michael McCoy",
      toList: ["bclymer@alleatogroup.com"],
      ccList: [],
      mailboxUserId: "bclymer@alleatogroup.com",
      hasAttachments: true,
      receivedAt: "2026-06-30T11:28:50Z",
    });

    expect(decision.action).toBe("reply");
    expect(decision.evidence).toBe(
      "Re: Please see the attached Please confirm Brandon can review the attached invoice by EOD.",
    );
    expect(decision.evidence).not.toContain("Date:");
    expect(decision.evidence).not.toContain("From:");
    expect(decision.evidence).not.toContain("To:");
  });
});
