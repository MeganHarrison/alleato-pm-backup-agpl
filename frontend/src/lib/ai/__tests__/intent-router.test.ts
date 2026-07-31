import {
  classifyAssistantIntent,
  shouldUsePacketFirstIntent,
} from "../intent-router";

describe("intent router", () => {
  it.each([
    "Yes please log it as a feature that is missed and have it fixed.",
    "Log this as a feature gap/bug: edit existing prime contract SOV rows from AI chat.",
    "Please submit feedback that the Prime Contract SOV cannot be edited from chat.",
  ])("routes explicit feedback writes to the action-tool loop: %s", (prompt) => {
    const intent = classifyAssistantIntent(prompt, { selectedProjectId: 1144 });

    expect(intent).toBe("feedback_write");
    expect(shouldUsePacketFirstIntent(intent)).toBe(false);
  });

  it.each([
    "Update cost code 01-3120 on this Prime Contract SOV to $5,000.",
    "Preview changing cost code 01-3120 on this Prime Contract SOV from $5,000 to $5,100. Do not apply it.",
    "Edit the prime contract schedule of values and add cost code 01-3127.",
    "Change the existing SOV row on this prime contract to $19,050.",
  ])("routes Prime Contract SOV mutations to the action-tool loop: %s", (prompt) => {
    const intent = classifyAssistantIntent(prompt, { selectedProjectId: 1144 });

    expect(intent).toBe("prime_contract_sov_write");
    expect(shouldUsePacketFirstIntent(intent)).toBe(false);
  });

  it.each([
    [
      "What is changing in the latest change order on this Prime Contract SOV?",
      "latest_status",
    ],
    [
      "Can you update me on how changing change orders impacts the Prime Contract SOV?",
      "latest_status",
    ],
  ] as const)("keeps read-only SOV gerund prompts out of the write path: %s", (prompt, expectedIntent) => {
    const intent = classifyAssistantIntent(prompt, { selectedProjectId: 1144 });

    expect(intent).toBe(expectedIntent);
    expect(intent).not.toBe("prime_contract_sov_write");
  });

  it.each([
    "Update me on this Prime Contract SOV.",
    "Can you update me on the prime contract schedule of values?",
    "Give me an update on the Prime Contract SOV.",
    "Update me on this SOV for the prime contract.",
    "Can you update me on the SOV in the prime contract?",
    "Give me an update on the schedule of values for the prime contract.",
    "What's the update on this Prime Contract SOV?",
    "Can I get an update on the prime contract schedule of values?",
    "Provide an update on the SOV for the prime contract.",
    "Please provide a status update for the Prime Contract SOV.",
    "What's the current update for this Prime Contract SOV?",
    "I need a progress update regarding the Prime Contract SOV.",
    "Update me on this Prime Contract SOV and the latest change order.",
    "Give me the latest update on the Prime Contract SOV and change history.",
  ])("keeps read-only Prime Contract SOV updates out of the write path: %s", (prompt) => {
    const intent = classifyAssistantIntent(prompt, { selectedProjectId: 1144 });

    expect(intent).toBe("latest_status");
    expect(shouldUsePacketFirstIntent(intent)).toBe(true);
  });

  it.each([
    // The exact trace wording (d9a9595f) — no "SOV" / "schedule of values".
    "Add these cost codes and amounts to this prime contract.",
    "Add cost code 01-3127 and $19,050 to this prime contract.",
    "Edit the line items on this prime contract.",
    "Update the amounts on the prime contract.",
    "Append a budget code and amount to the prime contract.",
    "Set the unit cost for cost code 01-3120 on the prime contract.",
  ])(
    "routes prime-contract line-item edits to the SOV write path without the word SOV: %s",
    (prompt) => {
      const intent = classifyAssistantIntent(prompt, { selectedProjectId: 1144 });

      expect(intent).toBe("prime_contract_sov_write");
      expect(shouldUsePacketFirstIntent(intent)).toBe(false);
    },
  );

  it.each([
    // Read-only line-item asks on a prime contract stay off the write path.
    "Update me on the prime contract cost codes.",
    "Give me an update on the line items in the prime contract.",
    // Commitments / subcontracts are also "contracts" but are NOT prime
    // contracts — their line-item edits must not reach editPrimeContractSov.
    "Add these cost codes and amounts to this commitment.",
    "Edit the line items on the subcontract.",
  ])(
    "keeps non-write and non-prime line-item prompts off the SOV write path: %s",
    (prompt) => {
      const intent = classifyAssistantIntent(prompt, { selectedProjectId: 1144 });

      expect(intent).not.toBe("prime_contract_sov_write");
    },
  );

  it("keeps an explicit row change in a mixed SOV update prompt on the write path", () => {
    const intent = classifyAssistantIntent(
      "Update me on this Prime Contract SOV, then change row 1 to $5,000.",
      { selectedProjectId: 1144 },
    );

    expect(intent).toBe("prime_contract_sov_write");
  });

  it("routes latest project status prompts to packet-first handling", () => {
    const intent = classifyAssistantIntent("What's the latest on Westfield Collective?");

    expect(intent).toBe("latest_status");
    expect(shouldUsePacketFirstIntent(intent)).toBe(true);
  });

  it("routes owner-style risk prompts to packet-first risk handling", () => {
    const prompts = [
      "What could bite us on Westfield right now?",
      "Rank the risks and tell me what I should do first.",
      "Anything on this job making you nervous?",
    ];

    for (const prompt of prompts) {
      const intent = classifyAssistantIntent(prompt);
      expect(intent).toBe("risk_review");
      expect(shouldUsePacketFirstIntent(intent)).toBe(true);
    }
  });

  it("does not classify owner must-do briefing prompts as app help", () => {
    const intent = classifyAssistantIntent("What are Brandon's must-do items today?");

    expect(intent).not.toBe("app_help");
  });

  it("preserves exact source lookup prompts", () => {
    const intent = classifyAssistantIntent("What source evidence supports that?");

    expect(intent).toBe("source_lookup");
    expect(shouldUsePacketFirstIntent(intent)).toBe(false);
  });

  it("keeps project-selected status prompts on latest_status when they mention evidence or next actions", () => {
    const prompts = [
      "What is the latest status for this project? Give me the owner-facing risks and next actions.",
      "Latest project status briefing for the selected project. Include source evidence, what changed, and current risks.",
    ];

    for (const prompt of prompts) {
      const intent = classifyAssistantIntent(prompt, { selectedProjectId: 1033 });
      expect(intent).toBe("latest_status");
      expect(shouldUsePacketFirstIntent(intent)).toBe(true);
    }
  });

  it("does not convert exact source lookup prompts to status just because a project is selected", () => {
    const intent = classifyAssistantIntent("What source evidence supports that?", {
      selectedProjectId: 1033,
    });

    expect(intent).toBe("source_lookup");
    expect(shouldUsePacketFirstIntent(intent)).toBe(false);
  });

  it("routes explicit Teams lookup prompts to source lookup even when a project is selected", () => {
    const prompts = [
      "Look through Teams for Westfield punch-list chatter. What is the latest real signal?",
      "Search Teams messages for the latest closeout discussion.",
      "Check Outlook email for the most recent owner thread.",
    ];

    for (const prompt of prompts) {
      const intent = classifyAssistantIntent(prompt, { selectedProjectId: 43 });
      expect(intent).toBe("source_lookup");
      expect(shouldUsePacketFirstIntent(intent)).toBe(false);
    }
  });

  it("routes explicit web-search source prompts away from internal source lookup", () => {
    const prompts = [
      "Branding question: What are the PUD requirements for Carmel, Indiana planned unit developments? Use web search and cite the sources you use.",
      "Search the web for current zoning requirements and cite sources.",
      "Use online sources to find the latest municipal ordinance requirements.",
      "Research current market competitors for a construction project management AI and cite public sources.",
      "Look up public vendor requirements for Carmel zoning and summarize the sources.",
      "Research current construction AI trends and cite sources.",
      "Search the public web for current construction AI trends and cite public URLs. Do not answer from internal Alleato records.",
    ];

    for (const prompt of prompts) {
      const intent = classifyAssistantIntent(prompt);
      expect(intent).toBe("external_research");
      expect(shouldUsePacketFirstIntent(intent)).toBe(false);
    }
  });

  it("routes employee message diagnosis prompts to source lookup even without the Teams keyword", () => {
    const intent = classifyAssistantIntent(
      "Based on all the employees' messages, where is the biggest source of confusion?",
    );

    expect(intent).toBe("source_lookup");
    expect(shouldUsePacketFirstIntent(intent)).toBe(false);
  });

  it("keeps app-help prompts out of project intelligence", () => {
    const intent = classifyAssistantIntent("How do I create a change order in the app?");

    expect(intent).toBe("app_help");
    expect(shouldUsePacketFirstIntent(intent)).toBe(false);
  });

  it("routes implementation and route-status app questions to app_help", () => {
    const prompts = [
      "What table powers the budget feature in the app?",
      "Which page backs the directory workflow?",
      "Is this feature implemented in Alleato PM?",
      "Why can't I see the admin settings?",
    ];

    for (const prompt of prompts) {
      expect(classifyAssistantIntent(prompt)).toBe("app_help");
    }
  });

  it("routes calendar invite prompts to the calendar action path before source lookup", () => {
    const prompts = [
      "Schedule a meeting with Brandon tomorrow at 2 and send an Outlook invite",
      "Create a Teams invite for the owner review",
      "Put the OAC meeting on my Outlook calendar",
    ];

    for (const prompt of prompts) {
      const intent = classifyAssistantIntent(prompt);
      expect(intent).toBe("calendar_action");
      expect(shouldUsePacketFirstIntent(intent)).toBe(false);
    }
  });

  it("routes Outlook email draft prompts to the email action path before source lookup", () => {
    const prompts = [
      "Draft a response in my email",
      "Write an email back to Megan Harrison about the meeting",
      "Prepare an Outlook message to the owner",
    ];

    for (const prompt of prompts) {
      const intent = classifyAssistantIntent(prompt);
      expect(intent).toBe("email_action");
      expect(shouldUsePacketFirstIntent(intent)).toBe(false);
    }
  });

  it("routes outbound Teams send prompts to the teams message action path before source lookup", () => {
    const prompts = [
      "Send a Teams message on my behalf, from Alleato AI, to Brandon Clymer. Use EXACTLY this message text, verbatim.",
      "Send a Teams message to Brandon saying the meeting moved to 3pm",
      "Can you message Ronnie on Teams and ask about the joist delivery?",
      "Please send a Teams message to AJ that the budget review moved",
    ];

    for (const prompt of prompts) {
      const intent = classifyAssistantIntent(prompt);
      expect(intent).toBe("teams_message_action");
      expect(shouldUsePacketFirstIntent(intent)).toBe(false);
    }
  });

  it("routes leading send-an-email prompts to the email action path", () => {
    const intent = classifyAssistantIntent(
      "Send an email to Brandon about the schedule change",
    );
    expect(intent).toBe("email_action");
  });

  it("keeps retrieval phrasings that merely mention send/message on retrieval paths", () => {
    const retrievalPrompts = [
      "Send me the important emails from today",
      "Did we send the updated schedule email to the client?",
      "Show me the message Ronnie posted in teams about the joists",
      "What did the message Ronnie sent in teams yesterday say?",
    ];

    for (const prompt of retrievalPrompts) {
      const intent = classifyAssistantIntent(prompt);
      expect(intent).not.toBe("teams_message_action");
      expect(intent).not.toBe("email_action");
    }
  });

  it("routes inbox read prompts to source lookup", () => {
    const prompts = [
      "Can you tell me my last five emails?",
      "Is there anything urgent in my inbox?",
    ];

    for (const prompt of prompts) {
      const intent = classifyAssistantIntent(prompt);
      expect(intent).toBe("source_lookup");
      expect(shouldUsePacketFirstIntent(intent)).toBe(false);
    }
  });

  it("routes waiting-on-team prompts to task follow-up", () => {
    const intent = classifyAssistantIntent("What am I waiting on from my team?");

    expect(intent).toBe("task_followup");
    expect(shouldUsePacketFirstIntent(intent)).toBe(true);
  });

  it("routes systems and processes prompts to implementation planning", () => {
    const intent = classifyAssistantIntent("What systems and processes do you think we need to put in place?");

    expect(intent).toBe("implementation_planning");
    expect(shouldUsePacketFirstIntent(intent)).toBe(true);
  });

  describe("task_write intent routing", () => {
    const WRITE_CASES = [
      "Remind me to call the owner about the permit by Friday",
      "remind me about the concrete pour inspection",
      "Add a task for the PM to confirm the AC1 solar approval owner",
      "add task: follow up with the subcontractor on steel delivery",
      "Create a task for Mike to review the updated submittal log",
      "Note for myself to check on the permit status Monday morning",
      "Flag this for follow-up with the owner",
      "Flag it for follow-up",
      "Throw this on my list to review later",
      "Put this on my list",
      "Get someone on the concrete curing delay",
      "Assign this to Sarah before end of week",
      "action item: confirm RFI response deadline with design team",
      "Generate a task from this meeting note",
      "Make a task to revisit the budget next week",
      "Create the task for Candon",
    ];

    it.each(WRITE_CASES)(
      'classifies "%s" as task_write (not task_followup)',
      (message) => {
        const intent = classifyAssistantIntent(message);
        expect(intent).toBe("task_write");
      },
    );

    it("does not trigger packet-first retrieval for task_write", () => {
      expect(shouldUsePacketFirstIntent("task_write")).toBe(false);
    });

    it("does not reclassify plain task-list read requests as task_write", () => {
      // These should remain task_followup — they are reads, not writes
      expect(classifyAssistantIntent("What are my open tasks?")).toBe("task_followup");
      expect(classifyAssistantIntent("Show me my action items")).toBe("task_followup");
      expect(classifyAssistantIntent("What's on my plate this week?")).toBe("task_followup");
    });
  });

  describe("change_event_write intent routing", () => {
    it.each([
      "Create a change request from the emails about the electrical room mini split.",
      "Draft a change event from the latest Teams messages about the permit delay.",
      "Log a potential change event using the project context on this page.",
      "Use the evidence on this project to create a change request for the added split system.",
      "Find the source first, then draft the change event.",
      "Convert this scope issue into a change request.",
      "Help me create a change request for the Playmakers project. Ask for any missing required fields, use available project evidence where possible, and preview the change request before anything is submitted.",
    ])("classifies mixed evidence/create prompt as change_event_write: %s", (prompt) => {
      const intent = classifyAssistantIntent(prompt, { selectedProjectId: 25125 });
      expect(intent).toBe("change_event_write");
      expect(shouldUsePacketFirstIntent(intent)).toBe(false);
    });

    it("keeps Playmakers-style field follow-up questions in the create workflow", () => {
      const intent = classifyAssistantIntent(
        "CR-9299-0030 the title is Design Updates and it's an owner change. How do I know for expecting revenue?",
        { selectedProjectId: 1067 },
      );

      expect(intent).toBe("change_event_write");
      expect(shouldUsePacketFirstIntent(intent)).toBe(false);
    });

    it.each([
      "Show me the emails about the sprinkler change.",
      "Pull up the Teams messages about the potential change.",
      "What source evidence supports that change event?",
      "What's the revenue source for this change event?",
    ])("keeps read-only change/source prompt out of change_event_write: %s", (prompt) => {
      expect(classifyAssistantIntent(prompt, { selectedProjectId: 25125 })).not.toBe(
        "change_event_write",
      );
    });
  });

  describe("source-lookup false positives on field names", () => {
    // Regression: production session 55e73199… — the prompt
    // "I really dont understand what Line Item Revenue Source does in change events"
    // routed to source_lookup → semanticSearch over transcripts, because the bare
    // keyword \bsource\b matched the field name "Revenue Source". The user got six
    // irrelevant transcript snippets instead of an explanation of the field.
    it("routes 'what Line Item Revenue Source does' to app_help, not source_lookup", () => {
      const intent = classifyAssistantIntent(
        "I really dont understand what Line Item Revenue Source does in change events",
      );
      expect(intent).toBe("app_help");
      expect(intent).not.toBe("source_lookup");
    });

    it.each([
      "what does the Line Item Revenue Source field do",
      "what does the forecast column mean",
      "I don't understand what the retainage toggle does",
      "I'm confused about the prime contract dropdown",
    ])("conceptual feature question routes to app_help: %s", (prompt) => {
      expect(classifyAssistantIntent(prompt)).toBe("app_help");
    });

    it.each([
      "what's the revenue source for this change event",
      "is the funding source the same on both lines",
    ])("'source' as a domain field name is NOT source_lookup: %s", (prompt) => {
      expect(classifyAssistantIntent(prompt)).not.toBe("source_lookup");
    });

    it.each([
      "show me the emails about the sprinkler change",
      "pull up the teams messages on Westfield retainage",
      "find the transcript where we discussed the change order",
      "what's the source for that budget number",
      "what is the underlying source for this figure",
      "show me where that came from in the inbox",
    ])("genuine evidence lookups still route to source_lookup: %s", (prompt) => {
      expect(classifyAssistantIntent(prompt)).toBe("source_lookup");
    });
  });

  describe("market / industry questions route to external_research (web search)", () => {
    // Regression: market-conditions and industry-trend questions without an
    // explicit "web"/"research" verb were falling to internal RAG and being
    // answered from internal files instead of searching the web.
    // The assertions below retain this regression coverage.
    it.each([
      "What's happening in the US commercial construction market this quarter?",
      "What's the outlook for lumber prices nationally?",
      "How's the commercial real estate market doing?",
      "What are interest rates doing to the construction market?",
      "What's the industry outlook for commercial construction?",
      "What are steel prices doing nationally?",
      "What's the current market price trend for structural steel right now?",
    ])("routes to external_research: %s", (prompt) => {
      expect(classifyAssistantIntent(prompt)).toBe("external_research");
    });

    it.each<[string, number | undefined]>([
      ["What are the cost trends on Westfield?", 43],
      ["What's our budget forecast?", 43],
      ["What's the current phase of Union Collective?", 43],
      ["Pull our current AR aging from Acumatica.", undefined],
      ["Compare our margin across active projects.", undefined],
      ["Show me vendor performance on Westfield.", 43],
      ["What's happening on Westfield this week?", 43],
    ])(
      "does NOT send internal question to the web: %s",
      (prompt, selectedProjectId) => {
        expect(
          classifyAssistantIntent(prompt, { selectedProjectId }),
        ).not.toBe("external_research");
      },
    );
  });
});
