import {
  EMAIL_OPERATOR_RESPONSE_POLICY,
  triageEmailForOperator,
} from "../email-operator-policy";
import { strategistSystemPrompt } from "../agents/strategist";

describe("email operator policy", () => {
  it.each([
    {
      subject: "Microsoft 365 security: You have messages in quarantine",
      fromEmail: "quarantinemessaging.microsoft.com",
      rule: "microsoft-quarantine-alert",
    },
    {
      subject: "Action Required: Welcome to Innovative Private Wealth",
      fromName: "Info & Compliance",
      fromEmail: "info@innovativepwm.com",
      rule: "wealth-marketing-compliance",
    },
    {
      subject: "FYI--approaching spend limit",
      fromEmail: "capitalonenotification@capitalone.com",
      rule: "generic-card-bank-alert",
    },
  ])("suppresses known inbox noise: $subject", (message) => {
    const triage = triageEmailForOperator(message);

    expect(triage.action).toBe("suppress");
    expect(triage.suppressed).toBe(true);
    expect(triage.matchedRules).toContain(message.rule);
  });

  it("elevates project coordination with a direct confirmation ask", () => {
    const triage = triageEmailForOperator({
      subject: "RE: ULTA update needed.",
      fromName: "Alec Wehner",
      bodyText: "Can you confirm by Thursday afternoon on the roof penetration?",
    });

    expect(triage.action).toBe("reply");
    expect(triage.suppressed).toBe(false);
  });

  it("routes proposal attachments to delegate instead of suppressing them", () => {
    const triage = triageEmailForOperator({
      subject: "Re: Exol Morrisville PA",
      fromName: "Bob Wright",
      bodyText: "Proposal attached for review.",
      hasAttachments: true,
    });

    expect(triage.action).toBe("delegate");
    expect(triage.suppressed).toBe(false);
  });

  it("keeps the strategist prompt tied to the shared email operator contract", () => {
    expect(strategistSystemPrompt).toContain(EMAIL_OPERATOR_RESPONSE_POLICY);
    expect(strategistSystemPrompt).toContain('operatorTriage.action: "suppress"');
    expect(strategistSystemPrompt).toContain("Do not elevate Microsoft quarantine/security notices");
    expect(strategistSystemPrompt).toContain("Use clean spacing and short action lines");
  });
});
