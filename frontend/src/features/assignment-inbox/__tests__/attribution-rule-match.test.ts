import {
  buildRuleSuggestion,
  extractEmailDomain,
  matchAttributionRule,
  type ActiveAttributionRule,
} from "../attribution-rule-match";

const rules: ActiveAttributionRule[] = [
  {
    projectId: 5,
    ruleType: "domain",
    patternNormalized: "acme.com",
    confidence: 0.9,
    priority: 22,
  },
  {
    projectId: 9,
    ruleType: "email",
    patternNormalized: "pm@acme.com",
    confidence: 0.97,
    priority: 12,
  },
  {
    projectId: 7,
    ruleType: "title_keyword",
    patternNormalized: "danville",
    confidence: 0.75,
    priority: 42,
  },
];

describe("extractEmailDomain", () => {
  it("returns the lowercased domain", () => {
    expect(extractEmailDomain("Alice@Acme.com")).toBe("acme.com");
  });
  it("returns null for malformed addresses", () => {
    expect(extractEmailDomain("not-an-email")).toBeNull();
    expect(extractEmailDomain(null)).toBeNull();
  });
});

describe("matchAttributionRule", () => {
  it("prefers a specific email rule over a domain rule for the same sender", () => {
    const match = matchAttributionRule(
      { fromEmail: "pm@acme.com", title: "Anything" },
      rules,
    );
    expect(match?.projectId).toBe(9);
    expect(match?.ruleType).toBe("email");
  });

  it("falls back to a domain rule when no email rule matches", () => {
    const match = matchAttributionRule(
      { fromEmail: "bob@acme.com", title: "Anything" },
      rules,
    );
    expect(match?.projectId).toBe(5);
    expect(match?.ruleType).toBe("domain");
  });

  it("matches a title keyword on word boundaries", () => {
    const match = matchAttributionRule(
      { fromEmail: "someone@elsewhere.com", title: "Weekly Danville Theatre sync" },
      rules,
    );
    expect(match?.projectId).toBe(7);
    expect(match?.ruleType).toBe("title_keyword");
  });

  it("does not match a keyword embedded inside a larger word", () => {
    const match = matchAttributionRule(
      { fromEmail: "someone@elsewhere.com", title: "Danvilleshire update" },
      rules,
    );
    expect(match).toBeNull();
  });

  it("returns null when nothing matches", () => {
    expect(
      matchAttributionRule(
        { fromEmail: "x@other.com", title: "Unrelated" },
        rules,
      ),
    ).toBeNull();
  });

  it("returns null with no rules", () => {
    expect(
      matchAttributionRule({ fromEmail: "pm@acme.com", title: "x" }, []),
    ).toBeNull();
  });
});

describe("buildRuleSuggestion", () => {
  it("uses subject history across a chain to recover the project on a generic reply", () => {
    const suggestion = buildRuleSuggestion(
      {
        fromEmail: "superintendent@elsewhere.com",
        title: "RE: thanks",
        relatedTitles: ["25-127 Ulta Beauty Fresno RFI follow-up", "thanks"],
        bodyText: "Attaching the latest response.",
        participants: ["pm@alleato.com", "superintendent@elsewhere.com"],
      },
      [
        ...rules,
        {
          projectId: 25,
          ruleType: "title_keyword",
          patternNormalized: "25 127",
          confidence: 0.97,
          priority: 10,
        },
      ],
    );

    expect(suggestion.status).toBe("suggested");
    expect(suggestion.suggestedProjectId).toBe(25);
    expect(suggestion.evidence[0]).toContain("Subject history");
  });

  it("forces manual review when a shared subcontractor domain matches multiple projects", () => {
    const suggestion = buildRuleSuggestion(
      {
        fromEmail: "billing@sharedvendor.com",
        title: "Invoice follow-up",
        bodyText: "Can you confirm this pay app?",
        participants: ["billing@sharedvendor.com", "pm@alleato.com"],
      },
      [
        {
          projectId: 11,
          ruleType: "domain",
          patternNormalized: "sharedvendor.com",
          confidence: 0.95,
          priority: 20,
        },
        {
          projectId: 12,
          ruleType: "domain",
          patternNormalized: "sharedvendor.com",
          confidence: 0.95,
          priority: 21,
        },
      ],
    );

    expect(suggestion.status).toBe("manual_review");
    expect(suggestion.suggestedProjectId).toBeNull();
    expect(suggestion.confidenceReasons.join(" ")).toContain("Shared subcontractor/domain");
    expect(suggestion.topMatches).toHaveLength(2);
  });

  it("marks the item undefined when nothing matches anywhere in the chain", () => {
    const suggestion = buildRuleSuggestion(
      {
        fromEmail: "unknown@example.com",
        title: "Weekly update",
        bodyText: "No project-specific terms here.",
        participants: ["unknown@example.com"],
      },
      rules,
    );

    expect(suggestion.status).toBe("undefined");
    expect(suggestion.suggestedProjectId).toBeNull();
  });
});
