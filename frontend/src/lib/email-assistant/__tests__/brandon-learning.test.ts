import {
  BRANDON_LEARNING_SUPPRESSION_PREFIX,
  deriveBrandonDraftLearning,
  formatBrandonDraftLearningGuidance,
} from "../brandon-learning";

describe("deriveBrandonDraftLearning", () => {
  it("extracts concise Brandon sign-off and direct-thread preferences", () => {
    const learning = deriveBrandonDraftLearning([
      {
        review_outcome: "draft_copied",
        draft_body: "That works for us. See you tomorrow at 3pm.\n\nThank You\nBrandon Clymer",
        assistant_action: "reply",
        assistant_priority: "high",
        reviewer_note: null,
        created_at: "2026-06-17T05:00:00Z",
      },
      {
        review_outcome: "draft_edited",
        draft_body: "Approved. Please send the ACH for $420.00.\n\nThank You\nBrandon Clymer",
        assistant_action: "reply",
        assistant_priority: "urgent",
        reviewer_note: null,
        created_at: "2026-06-17T05:05:00Z",
      },
    ]);

    expect(learning.reviewCount).toBe(2);
    expect(learning.draftCount).toBe(2);
    expect(learning.guidanceItems).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "thank_you_closing",
          text: 'Prefer Brandon-style closing with "Thank You" when a sign-off is needed.',
        }),
      ]),
    );
    expect(learning.guidance).toEqual(
      expect.arrayContaining([
        "Keep Brandon replies concise; recent approved drafts are usually under 55 words.",
        'Prefer Brandon-style closing with "Thank You" when a sign-off is needed.',
        "For active threads, start directly with the answer instead of adding a greeting.",
        "Favor specific commitments from the thread over generic acknowledgements; Brandon edits drafts when they are too vague.",
      ]),
    );
  });

  it("extracts delegation and skip preferences without needing draft bodies", () => {
    const learning = deriveBrandonDraftLearning([
      {
        review_outcome: "delegated",
        draft_body: null,
        assistant_action: "delegate",
        assistant_priority: "high",
        reviewer_note: "Route internally",
        created_at: "2026-06-17T05:00:00Z",
      },
      {
        review_outcome: "marked_no_action",
        draft_body: null,
        assistant_action: "ignore",
        assistant_priority: "low",
        reviewer_note: null,
        created_at: "2026-06-17T05:05:00Z",
      },
    ]);

    expect(learning.guidance).toEqual([
      "Do not overcommit on internal, payment, legal, or project-risk items; acknowledge and route to the right owner when needed.",
      "Avoid drafting for low-signal messages unless there is a clear ask, deadline, or business risk.",
    ]);
  });

  it("suppresses guidance by stable ID when Brandon marks a learning as wrong", () => {
    const suppressedItem =
      'Prefer Brandon-style closing with "Thank You" when a sign-off is needed.';
    const learning = deriveBrandonDraftLearning([
      {
        review_outcome: "draft_copied",
        draft_body: "That works for us. See you tomorrow at 3pm.\n\nThank You\nBrandon Clymer",
        assistant_action: "reply",
        assistant_priority: "high",
        reviewer_note: null,
        created_at: "2026-06-17T05:00:00Z",
      },
      {
        review_outcome: "draft_edited",
        draft_body: "Approved. Please send the ACH for $420.00.\n\nThank You\nBrandon Clymer",
        assistant_action: "reply",
        assistant_priority: "urgent",
        reviewer_note: null,
        created_at: "2026-06-17T05:05:00Z",
      },
      {
        review_outcome: "marked_no_action",
        draft_body: null,
        assistant_action: "ignore",
        assistant_priority: "low",
        reviewer_note: `${BRANDON_LEARNING_SUPPRESSION_PREFIX} id=thank_you_closing; text=${suppressedItem}`,
        created_at: "2026-06-17T05:10:00Z",
      },
    ]);

    expect(learning.guidance).not.toContain(suppressedItem);
    expect(learning.guidanceItems).toEqual(
      expect.not.arrayContaining([
        expect.objectContaining({
          id: "thank_you_closing",
        }),
      ]),
    );
    expect(learning.guidance).toEqual(
      expect.arrayContaining([
        "Keep Brandon replies concise; recent approved drafts are usually under 55 words.",
        "For active threads, start directly with the answer instead of adding a greeting.",
      ]),
    );
  });

  it("still honors old exact-string suppression notes", () => {
    const suppressedItem =
      'Prefer Brandon-style closing with "Thank You" when a sign-off is needed.';
    const learning = deriveBrandonDraftLearning([
      {
        review_outcome: "draft_copied",
        draft_body: "That works for us. See you tomorrow at 3pm.\n\nThank You\nBrandon Clymer",
        assistant_action: "reply",
        assistant_priority: "high",
        reviewer_note: null,
        created_at: "2026-06-17T05:00:00Z",
      },
      {
        review_outcome: "marked_no_action",
        draft_body: null,
        assistant_action: "ignore",
        assistant_priority: "low",
        reviewer_note: `${BRANDON_LEARNING_SUPPRESSION_PREFIX} ${suppressedItem}`,
        created_at: "2026-06-17T05:10:00Z",
      },
    ]);

    expect(learning.guidance).not.toContain(suppressedItem);
  });
});

describe("formatBrandonDraftLearningGuidance", () => {
  it("formats guidance as bounded assistant context", () => {
    const guidance = formatBrandonDraftLearningGuidance({
      reviewCount: 1,
      draftCount: 1,
      guidance: ['Prefer Brandon-style closing with "Thank You" when a sign-off is needed.'],
    });

    expect(guidance).toContain("Brandon review learnings");
    expect(guidance).toContain("Use these as style and decision preferences only.");
  });

  it("returns an empty string when no guidance exists", () => {
    expect(
      formatBrandonDraftLearningGuidance({
        reviewCount: 0,
        draftCount: 0,
        guidance: [],
      }),
    ).toBe("");
  });
});
