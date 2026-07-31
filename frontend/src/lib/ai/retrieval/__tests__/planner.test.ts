// frontend/src/lib/ai/retrieval/__tests__/planner.test.ts
import type { UIMessage } from "ai";
import { detectChatAttachmentCapabilitiesAcrossMessages } from "@/lib/ai/chat-attachment-capabilities";
import { planRetrieval } from "../planner";

function userMsg(text: string): UIMessage {
  return { id: "u1", role: "user", parts: [{ type: "text", text }] } as never;
}
function assistantMsg(text: string): UIMessage {
  return {
    id: "a1",
    role: "assistant",
    parts: [{ type: "text", text }],
  } as never;
}

describe("planRetrieval", () => {
  it.each([
    "What did we discuss in the most recent meetings for this project?",
    "Summarize the risks for the selected project.",
    "What changed on the current project yesterday?",
    "Search email and Teams for that project.",
    "What did we discuss for this job?",
    "Search email and Teams for the job.",
    "What changed at the current jobsite?",
    "What are the open risks at that site?",
  ])("refuses to broaden an unresolved project-relative request: %s", (message) => {
    const plan = planRetrieval({ message, messages: [userMsg(message)] });

    expect(plan).toMatchObject({
      responseFormat: "project_scope_required",
      reason: "selected_project_context_missing",
      sources: {},
    });
  });

  it("keeps project-relative retrieval scoped when the client supplies the project id", () => {
    const message =
      "What did we discuss in the most recent meetings for this project?";
    const plan = planRetrieval({
      message,
      selectedProjectId: 1102,
      messages: [userMsg(message)],
    });

    expect(plan.responseFormat).not.toBe("project_scope_required");
    expect(plan.selectedProjectId).toBe(1102);
  });

  it("routes a recovered project selection as a fresh scoped request instead of following up to the scope stop", () => {
    const message =
      "What did we discuss in the most recent meetings for this project? Cite the source meetings.";
    const messages = [
      userMsg(message),
      assistantMsg(
        "Select a project before I search. No project context reached the assistant.",
      ),
      userMsg(message),
    ];

    const plan = planRetrieval({
      message,
      selectedProjectId: 1097,
      messages,
    });

    expect(plan).toMatchObject({
      responseFormat: "source_specific_rag",
      reason: "project_context_source_specific_rag_recent_meetings",
      selectedProjectId: 1097,
      sources: {
        sourceSpecificRag: { kind: "recent_meetings" },
      },
    });
    expect(plan.sources.reusePriorBriefing).toBeUndefined();
  });

  it.each([
    "What about the risks?",
    "Continue",
    "And what changed yesterday?",
  ])(
    "keeps a shorthand follow-up fail-closed after a project-scope stop: %s",
    (message) => {
      const firstQuestion = "What changed on this project yesterday?";
      const scopeStop = [
        "Select a project before I search.",
        "No project context reached the assistant.",
      ].join("\n");
      const messages = [
        userMsg(firstQuestion),
        assistantMsg(scopeStop),
        userMsg(message),
      ];

      const plan = planRetrieval({ message, messages });

      expect(plan).toMatchObject({
        responseFormat: "project_scope_required",
        reason: "selected_project_context_missing",
        sources: {},
      });
    },
  );

  it.each([
    "What is Alleato's mission?",
    "Who is Brandon?",
    "When was the company founded?",
  ])(
    "allows a fresh topic after a project-scope stop: %s",
    (message) => {
      const firstQuestion = "What changed on this project yesterday?";
      const messages = [
        userMsg(firstQuestion),
        assistantMsg("Select a project before I search."),
        userMsg(message),
      ];

      const plan = planRetrieval({ message, messages });

      expect(plan.responseFormat).not.toBe("project_scope_required");
      expect(plan.reason).not.toBe("selected_project_context_missing");
    },
  );

  it("status question with selected project → packet + snapshot, no external sources", () => {
    const message =
      "What's the status of the Vermillion Rise Warehouse project?";
    const plan = planRetrieval({
      message,
      selectedProjectId: 67,
      messages: [userMsg(message)],
    });
    expect(plan.responseFormat).toBe("briefing_template");
    expect(plan.sources.intelligencePacket).toBeDefined();
    expect(plan.sources.intelligenceEvidence).toEqual({ mode: "current" });
    expect(plan.sources.projectSnapshot).toBeDefined();
    expect(plan.sources.research).toBeUndefined();
  });

  it("status question without selected project still emits packet retrieval", () => {
    const message =
      "What's the status of the Vermillion Rise Warehouse project?";
    const plan = planRetrieval({
      message,
      messages: [userMsg(message)],
    });
    expect(plan.responseFormat).toBe("briefing_template");
    expect(plan.sources.intelligencePacket).toBeDefined();
    expect(plan.sources.intelligenceEvidence).toEqual({ mode: "current" });
    expect(plan.sources.projectSnapshot).toBeDefined();
    expect(plan.selectedProjectId).toBeUndefined();
    expect(plan.reason).toBe("packet_first_resolve_from_text");
  });

  it("source lookup question → source_lookup format with vector search only", () => {
    const message =
      "Show me the meeting where we discussed the slab pour timeline";
    const plan = planRetrieval({ message, messages: [userMsg(message)] });
    expect(plan.responseFormat).toBe("source_lookup");
    expect(plan.sources.semanticVectorSearch).toBeDefined();
    expect(plan.sources.intelligencePacket).toBeUndefined();
  });

  it("source lookup with selected project preloads the project operating context before vector drilldown", () => {
    const message =
      "Show me the meeting where we discussed the slab pour timeline";
    const plan = planRetrieval({
      message,
      selectedProjectId: 67,
      messages: [userMsg(message)],
    });
    expect(plan.responseFormat).toBe("source_lookup");
    expect(plan.selectedProjectId).toBe(67);
    expect(plan.sources.intelligencePacket).toBeDefined();
    expect(plan.sources.projectSnapshot).toBeDefined();
    expect(plan.sources.semanticVectorSearch).toBeDefined();
    expect(plan.reason).toBe("project_context_source_lookup_intent");
  });

  it("source-specific RAG with selected project keeps the project operating context loaded", () => {
    const message =
      "What did recent Teams discussions say about Vermillion Rise?";
    const plan = planRetrieval({
      message,
      selectedProjectId: 67,
      messages: [userMsg(message)],
    });
    expect(plan.responseFormat).toBe("source_specific_rag");
    expect(plan.selectedProjectId).toBe(67);
    expect(plan.sources.intelligencePacket).toBeDefined();
    expect(plan.sources.projectSnapshot).toBeDefined();
    expect(plan.sources.sourceSpecificRag).toBeDefined();
    expect(plan.reason).toContain("project_context_source_specific_rag");
  });

  it.each([
    "Create a change request from the emails about the electrical room mini split.",
    "Draft a change event from the latest Teams messages about the permit delay.",
    "Use the evidence on this project to log a potential change.",
    "Find the source first, then draft the change event.",
    "Help me create a change request for the Playmakers project. Ask for any missing required fields, use available project evidence where possible, and preview the change request before anything is submitted.",
  ])(
    "routes evidence-backed change-event writes to the tool loop: %s",
    (message) => {
      const plan = planRetrieval({
        message,
        selectedProjectId: 25125,
        messages: [userMsg(message)],
      });

      expect(plan.intent).toBe("change_event_write");
      expect(plan.responseFormat).toBe("conversational");
      expect(plan.reason).toBe("project_context_change_event_write_request");
      expect(plan.selectedProjectId).toBe(25125);
      expect(plan.sources.intelligencePacket).toBeDefined();
      expect(plan.sources.projectSnapshot).toBeDefined();
      expect(plan.sources.semanticVectorSearch).toEqual({ query: message });
      expect(plan.sources.sourceSpecificRag).toBeUndefined();
    },
  );

  it("keeps a feedback confirmation on the submitFeedback tool loop instead of returning a project briefing", () => {
    const message =
      "Yes please log it as a feature that is missed and have it fixed.";
    const plan = planRetrieval({
      message,
      selectedProjectId: 1144,
      messages: [
        userMsg("Can the AI edit existing Prime Contract SOV rows?"),
        assistantMsg(
          "I cannot edit those rows yet, but I can log this as a feature gap/bug.",
        ),
        userMsg(message),
      ],
    });

    expect(plan).toMatchObject({
      intent: "feedback_write",
      responseFormat: "conversational",
      reason: "feedback_write_request",
      selectedProjectId: 1144,
      sources: {},
    });
    expect(plan.sources.projectSnapshot).toBeUndefined();
    expect(plan.sources.semanticVectorSearch).toBeUndefined();
    expect(plan.sources.reusePriorBriefing).toBeUndefined();
  });

  it.each([
    "Update cost code 01-3120 on this Prime Contract SOV to $5,000.",
    "Preview changing cost code 01-3120 on this Prime Contract SOV from $5,000 to $5,100. Do not apply it.",
    "Edit the prime contract schedule of values and add cost code 01-3127.",
  ])("keeps a Prime Contract SOV write on the action-tool loop: %s", (message) => {
    const plan = planRetrieval({
      message,
      selectedProjectId: 1144,
      messages: [userMsg(message)],
    });

    expect(plan).toMatchObject({
      intent: "prime_contract_sov_write",
      responseFormat: "conversational",
      reason: "prime_contract_sov_write_request",
      selectedProjectId: 1144,
      sources: {},
    });
    expect(plan.responseFormat).not.toBe("briefing_template");
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
  ] as const)("keeps a read-only SOV gerund prompt out of the action-tool loop: %s", (message, expectedIntent) => {
    const plan = planRetrieval({
      message,
      selectedProjectId: 1144,
      messages: [userMsg(message)],
    });

    expect(plan.intent).toBe(expectedIntent);
    expect(plan.intent).not.toBe("prime_contract_sov_write");
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
  ])("keeps a read-only Prime Contract SOV update on the briefing path: %s", (message) => {
    const plan = planRetrieval({
      message,
      selectedProjectId: 1144,
      messages: [userMsg(message)],
    });

    expect(plan.intent).toBe("latest_status");
    expect(plan.responseFormat).toBe("briefing_template");
    expect(plan.sources.projectSnapshot).toEqual({ reason: "intent" });
  });

  it("keeps an explicit row change in a mixed SOV update prompt on the action-tool path", () => {
    const message =
      "Update me on this Prime Contract SOV, then change row 1 to $5,000.";
    const plan = planRetrieval({
      message,
      selectedProjectId: 1144,
      messages: [userMsg(message)],
    });

    expect(plan.intent).toBe("prime_contract_sov_write");
    expect(plan.responseFormat).toBe("conversational");
  });

  it("keeps a strategic conversational follow-up on the prior briefing seam", () => {
    const firstQuestion =
      "What matters most in my inbox today? Give me the top three priorities and why they matter.";
    const firstAnswer = "Project reports, payroll changes, and cash flow need attention.";
    const followUp =
      "Based on that, what are the three decisions Brandon should personally make or communicate today?";

    const plan = planRetrieval({
      message: followUp,
      messages: [userMsg(firstQuestion), assistantMsg(firstAnswer), userMsg(followUp)],
    });

    expect(plan.reason).toBe("followup_to_prior_briefing");
    expect(plan.responseFormat).toBe("conversational");
    expect(plan.sources.reusePriorBriefing).toBe(true);
    expect(plan.sources.semanticVectorSearch).toEqual({ query: followUp });
  });

  it("keeps an explicit conversational reference off a fresh executive run when history is absent", () => {
    const message =
      "Based on that, what are the three decisions Brandon should personally make today?";

    const plan = planRetrieval({ message, messages: [userMsg(message)] });

    expect(plan.reason).toBe("followup_to_prior_briefing");
    expect(plan.sources.reusePriorBriefing).toBe(true);
    expect(plan.sources.semanticVectorSearch).toEqual({ query: message });
  });

  it("keeps change-event source review prompts on source lookup when no write is requested", () => {
    const message = "Show me the emails about the electrical room change event.";
    const plan = planRetrieval({
      message,
      selectedProjectId: 25125,
      messages: [userMsg(message)],
    });

    expect(plan.intent).toBe("source_lookup");
    expect(plan.responseFormat).toBe("source_lookup");
    expect(plan.reason).toBe("project_context_source_lookup_intent");
    expect(plan.sources.semanticVectorSearch).toBeDefined();
  });

  it("routes same-day Teams message prompts away from generic semantic search", () => {
    const message = "what insights can be found in the teams messages today?";
    const plan = planRetrieval({
      message,
      messages: [userMsg(message)],
    });

    expect(plan.responseFormat).toBe("source_specific_rag");
    expect(plan.reason).toBe("source_specific_rag_recent_teams_discussions");
    expect(plan.sources.sourceSpecificRag).toEqual({
      kind: "recent_teams_discussions",
    });
    expect(plan.sources.semanticVectorSearch).toBeUndefined();
  });

  it("routes recent meeting evidence prompts to source-specific RAG before specialist tools", () => {
    const message =
      "Did Brandon say anything about billing in recent meetings that I need to remember?";
    const plan = planRetrieval({
      message,
      messages: [userMsg(message)],
    });

    expect(plan.responseFormat).toBe("source_specific_rag");
    expect(plan.reason).toBe("source_specific_rag_recent_meetings");
    expect(plan.sources.sourceSpecificRag).toEqual({
      kind: "recent_meetings",
    });
    expect(plan.sources.semanticVectorSearch).toBeUndefined();
  });

  it("routes selected-project source-health wording to packet and snapshot checks", () => {
    const message =
      "Before I trust the AI readout, tell me whether the project packet, snapshot, and document sources look stale, missing, thin, or current enough.";
    const plan = planRetrieval({
      message,
      selectedProjectId: 67,
      messages: [userMsg(message)],
    });
    expect(plan.intent).toBe("source_health");
    expect(plan.reason).toBe("project_context_source_health");
    expect(plan.sources.intelligencePacket).toBeDefined();
    expect(plan.sources.projectSnapshot).toBeDefined();
    expect(plan.sources.semanticVectorSearch).toBeUndefined();
  });

  it("does not let source-health wording steal exact selected-project document lookup", () => {
    const message =
      "Find the exact spec or document evidence behind any current closeout obligation. Start with the project operating context, then drill into the source.";
    const plan = planRetrieval({
      message,
      selectedProjectId: 67,
      messages: [userMsg(message)],
    });
    expect(plan.reason).toBe("project_context_source_lookup_intent");
    expect(plan.sources.intelligencePacket).toBeDefined();
    expect(plan.sources.projectSnapshot).toBeDefined();
    expect(plan.sources.semanticVectorSearch).toBeDefined();
  });

  it.each([
    "What is the highest priority Brandon should focus on right now across the business?",
    "What are Brandon's must-do items today?",
    "How does the pipeline look right now?",
    "Give me an overview of the active projects health",
    "Give me a portfolio health overview across all projects",
    "Find important insights from today's meetings.",
    "Are any clients upset or showing relationship risk? Use recent meetings, email, and Teams evidence.",
    "Has there been anything important that's happened today over email or in teams or email or meeting transcripts?",
    "Anything important happen this week?",
    "What happened today?",
    "Have there been any important or exciting things that have happened in the meetings team messages or emails today?",
  ])(
    "delegates broad operator question to executive Deep Agents workflow: %s",
    (message) => {
      const plan = planRetrieval({ message, messages: [userMsg(message)] });
      expect(plan.responseFormat).toBe("briefing_template");
      expect(plan.reason).toBe("executive_deep_agent_broad_operator_question");
      expect(plan.sources.semanticVectorSearch).toBeUndefined();
      expect(plan.sources.sourceSpecificRag).toBeUndefined();
    },
  );

  it("app help question → app_help format with App Expert retrieval", () => {
    const message = "How do I create a change order in the app?";
    const plan = planRetrieval({ message, messages: [userMsg(message)] });
    expect(plan.responseFormat).toBe("app_help");
    expect(plan.sources.appExpert).toEqual({ question: message });
  });

  it("brandon daily update request → brandon_daily format", () => {
    const message = "give me the brandon daily update";
    const plan = planRetrieval({ message, messages: [userMsg(message)] });
    expect(plan.responseFormat).toBe("brandon_daily");
    expect(plan.sources.brandonDailyUpdate).toBe(true);
  });

  it.each([
    "what important emails have I received this morning?",
    "anything urgent in my inbox today?",
    "show me emails that need a reply",
    "what came in through Outlook this morning",
    "what mail arrived today",
    "any important messages I got today?",
    "what are the priority emails from today",
  ])(
    "routes inbox triage wording to Microsoft specialist delegation: %s",
    (message) => {
      const plan = planRetrieval({ message, messages: [userMsg(message)] });
      expect(plan.responseFormat).toBe("conversational");
      expect(plan.reason).toContain("microsoft_specialist_delegation");
      expect(plan.sources.recentEmails).toBeUndefined();
      expect(plan.sources.sourceSpecificRag).toBeUndefined();
      expect(plan.sources.semanticVectorSearch).toBeUndefined();
    },
  );

  it.each([
    "what important emails have I received this morning?",
    "show me today's inbox",
    "what came in through Outlook today",
  ])(
    "uses today's business window for same-day email wording: %s",
    (message) => {
      const plan = planRetrieval({ message, messages: [userMsg(message)] });
      expect(plan.reason).toContain("microsoft_specialist_delegation");
      expect(plan.sources.recentEmails).toBeUndefined();
    },
  );

  it("cross-source investigation → closed research contract, not inbox delegation", () => {
    const message =
      "We had an employee quit this week suddenly saying he didn't feel like he fit in and put his resignation in effective immediately — can you research through the teams messages, emails, and meetings and see where this might have initiated?";
    const plan = planRetrieval({ message, messages: [userMsg(message)] });
    expect(plan.intent).toBe("source_lookup");
    expect(plan.responseFormat).toBe("source_lookup");
    expect(plan.sources.semanticVectorSearch).toBeUndefined();
    expect(plan.sources.research?.requests.map((request) => request.source)).toEqual([
      "meetings",
      "email",
      "teams",
    ]);
    expect(plan.reason).toContain("cross_source_investigation");
    expect(plan.reason).not.toContain("microsoft_specialist_delegation");
  });

  it("financial question → preconsult includes CFO", () => {
    const message =
      "What's our exposure on pending change orders across all projects?";
    const plan = planRetrieval({ message, messages: [userMsg(message)] });
    expect(plan.preconsult).toContain("cfo");
  });

  it("follow-up question reuses prior briefing context", () => {
    const message = "what's the source for the slab pour update?";
    const plan = planRetrieval({
      message,
      messages: [
        userMsg("give me a briefing on Vermillion Rise"),
        assistantMsg("**Hard Facts**\n- Project: Vermillion Rise..."),
        userMsg(message),
      ],
    });
    expect(plan.sources.reusePriorBriefing).toBe(true);
  });

  // Regression for session d87edc77: "tell me more about union collective" was
  // NOT recognized as a follow-up, fell through to conversational_fallback with
  // zero sources, and the model returned an empty response. It must now route
  // to the follow-up path with prior-briefing reuse AND a fresh vector search.
  it.each([
    "tell me more about union collective",
    "more about the permit risk",
    "what about steel pricing",
    "go deeper on the FA panel approval",
  ])("drill-down follow-up %j retrieves fresh grounding", (message) => {
    const plan = planRetrieval({
      message,
      messages: [
        userMsg("what's the status of our projects"),
        assistantMsg(
          "Union Collective is the biggest watch item; permit/earthwork timing could slip...",
        ),
        userMsg(message),
      ],
    });
    expect(plan.reason).toBe("followup_to_prior_briefing");
    expect(plan.sources.reusePriorBriefing).toBe(true);
    expect(plan.sources.semanticVectorSearch).toBeDefined();
  });
});

describe("source-health routing must not hijack content questions", () => {
  // Regression for the assistantSourceHealth hijack: prompts using the common
  // adjective "current" (or "status"/"latest") were being routed to the
  // source-health fast-path and answered with a freshness report instead of the
  // real answer. The assertions below retain this regression coverage.
  const mustNotRoute: Array<[string, number | undefined]> = [
    [
      "Quick facts on Westfield — contract value, current phase, and project address.",
      43,
    ],
    [
      "What is Alleato's mission and what are the current strategic goals for the company?",
      undefined,
    ],
    [
      "Pull our current AR aging from Acumatica — who owes us and how overdue are they?",
      undefined,
    ],
    [
      "What's the current market price trend for structural steel right now? Check the web.",
      undefined,
    ],
    [
      "Look through Teams for Westfield punch-list chatter. What is the latest real signal?",
      43,
    ],
    ["What risks exist in the business right now?", undefined],
    [
      "Which vendors have we spent the most with this year? Pull it from Acumatica.",
      undefined,
    ],
  ];
  it.each(mustNotRoute)(
    "does NOT route to source_health: %s",
    (message, selectedProjectId) => {
      const plan = planRetrieval({
        message,
        selectedProjectId,
        messages: [userMsg(message)],
      });
      expect(plan.intent).not.toBe("source_health");
    },
  );

  const mustRoute: Array<[string, number | undefined]> = [
    [
      "For Westfield document intelligence, before I trust the AI readout, tell me whether the project packet, snapshot, and document sources look stale, missing, thin, or current enough.",
      43,
    ],
    [
      "Before I trust the AI readout, are Teams, Outlook, meetings, and packets current enough? Tell me what is stale or missing.",
      undefined,
    ],
    [
      "Are Teams messages current enough to trust today, or is source sync stale?",
      undefined,
    ],
    ["What's the source health right now?", undefined],
    ["Is my data fresh?", undefined],
    ["Are the sources synced?", undefined],
  ];
  it.each(mustRoute)(
    "DOES route genuine source-health question: %s",
    (message, selectedProjectId) => {
      const plan = planRetrieval({
        message,
        selectedProjectId,
        messages: [userMsg(message)],
      });
      expect(plan.intent).toBe("source_health");
    },
  );
});

describe("attachments + transactional asks must not status-dump", () => {
  // Regression for the Goodwill Noblesville session: messages carrying
  // attachments, or asking to create a record / migrate data, were routed to
  // the project-status briefing instead of being acted on.
  it("a message with attachments routes to conversational, not the briefing", () => {
    const message =
      "I attached a few exports — help me get everything crossed over.";
    const plan = planRetrieval({
      message,
      selectedProjectId: 43,
      messages: [userMsg(message)],
      hasAttachments: true,
    });
    expect(plan.responseFormat).not.toBe("briefing_template");
    expect(plan.reason).toBe("user_attachments_present");
  });

  it("keeps the exact Nexcom text-only follow-up attached to the prior screenshot", () => {
    const message =
      "Are you not able to see the cost codes and amounts in the screen shot I uploaded?";
    const messages = [
      {
        id: "nexcom-user-image",
        role: "user",
        parts: [
          {
            type: "text",
            text: "Can you add the missing cost codes and amounts to this prime sov?",
          },
          {
            type: "file",
            mediaType: "image/png",
            filename: "image.png",
            url: "data:image/png;base64,iVBORw0KGgo=",
          },
        ],
      },
      assistantMsg(
        "The SOV row could not be matched without an exact project cost type.",
      ),
      userMsg(message),
    ] as UIMessage[];
    const capabilities =
      detectChatAttachmentCapabilitiesAcrossMessages(messages);

    const plan = planRetrieval({
      message,
      selectedProjectId: 1144,
      messages,
      hasAttachments: capabilities.hasAttachments,
    });

    expect(capabilities).toMatchObject({
      hasAttachments: true,
      readableImageCount: 1,
    });
    expect(plan.responseFormat).toBe("conversational");
    expect(plan.reason).toBe("user_attachments_present");
  });

  it.each([
    "Can you help with creating the commitment also?",
    "Create a subcontract commitment for the temp wall.",
    "Open a change order for the added vestibule work.",
    "How do I cross this data over from the old system?",
    "I'm trying to migrate our records into this platform.",
  ])(
    "transactional/migration ask routes to conversational, not briefing: %s",
    (message) => {
      const plan = planRetrieval({
        message,
        selectedProjectId: 43,
        messages: [userMsg(message)],
      });
      expect(plan.responseFormat).not.toBe("briefing_template");
    },
  );

  it("does NOT mis-route a genuine status question (no regression)", () => {
    const message = "Give me the current status and risks on Westfield.";
    const plan = planRetrieval({
      message,
      selectedProjectId: 43,
      messages: [userMsg(message)],
    });
    expect(plan.responseFormat).toBe("briefing_template");
  });
});

describe("outbound send requests must reach the send tools, not retrieval", () => {
  // Regression for the 2026-07-10 production miss: "Send a Teams message on my
  // behalf, from Alleato AI, to Brandon Clymer …" was classified source_lookup
  // and answered with semantic-search hits; sendTeamsMessage was never reached.
  it.each([
    "Send a Teams message on my behalf, from Alleato AI, to Brandon Clymer. Use EXACTLY this message text, verbatim.",
    "Send a Teams message to Brandon saying the meeting moved to 3pm",
    "Can you message Ronnie on Teams and ask about the joist delivery?",
    "Send an email to Brandon about the schedule change",
    "Please send a Teams message to AJ that the budget review moved",
  ])("outbound send routes to conversational with no retrieval hijack: %s", (message) => {
    const plan = planRetrieval({ message, messages: [userMsg(message)] });
    expect(plan.reason).toBe("outbound_message_send_request");
    expect(plan.responseFormat).toBe("conversational");
    expect(plan.sources.semanticVectorSearch).toBeUndefined();
  });

  it.each([
    "Send me the important emails from today",
    "Did we send the updated schedule email to the client?",
    "Show me the message Ronnie posted in teams about the joists",
    "Has there been anything important that's happened today over email or in teams or meeting transcripts?",
    "Dig through the teams messages and emails and figure out where the resignation started",
  ])("retrieval phrasings that mention send/message stay on retrieval: %s", (message) => {
    const plan = planRetrieval({ message, messages: [userMsg(message)] });
    expect(plan.reason).not.toBe("outbound_message_send_request");
  });
});
