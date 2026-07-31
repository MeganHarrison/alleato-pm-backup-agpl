import type { ProjectEmail } from "@/hooks/use-emails";
import {
  chunkImportanceFeedbackEmailIds,
  IMPORTANCE_FEEDBACK_BATCH_SIZE,
  matchesEmailImportanceVisibility,
  getEmailsRefreshInterval,
  normalizeEmailImportanceVisibilityFilter,
  reconcileSelectedEmail,
} from "@/app/(main)/[projectId]/emails/emails-client.helpers";
import {
  buildMailboxWorkflowTabs,
  countMailboxEmailsByWorkflow,
  isArchivedMailboxEmail,
  isDraftMailboxEmail,
  matchesMailboxWorkflowFilter,
  normalizeMailboxWorkflowFilter,
} from "@/features/emails/mailbox-workflow-tabs";

function buildEmail(
  priority: ProjectEmail["assistant_priority"],
  overrides: Partial<ProjectEmail> = {},
): ProjectEmail {
  return {
    id: 1,
    project_id: 876,
    project: null,
    subject: "Subject",
    body: null,
    body_html: null,
    body_text: null,
    from_name: "Brandon Clymer",
    from_email: "bclymer@alleatogroup.com",
    to_list: [],
    cc_list: [],
    bcc_list: [],
    status: "Received",
    sent_at: null,
    received_at: null,
    is_private: false,
    is_starred: false,
    has_attachments: false,
    related_tool: null,
    related_id: null,
    distribution_group: null,
    thread_id: null,
    created_by: null,
    created_at: null,
    updated_at: null,
    deleted_at: null,
    assistant_priority: priority,
    ...overrides,
  };
}

describe("normalizeMailboxWorkflowFilter", () => {
  it("falls back invalid values to pending", () => {
    expect(normalizeMailboxWorkflowFilter("done")).toBe("done");
    expect(normalizeMailboxWorkflowFilter("invalid")).toBe("pending");
    expect(normalizeMailboxWorkflowFilter(null)).toBe("pending");
  });
});

describe("mailbox workflow classification", () => {
  it("separates pending from done (feedback-given) emails in the shared dataset", () => {
    const inboxEmail = buildEmail("high", { id: 1, assistant_action: "reply" });
    const draftEmail = buildEmail("normal", {
      id: 2,
      assistant_action: "reply",
      assistant_review: {
        reviewId: "review-2",
        reviewOutcome: "draft_edited",
        reviewerNote: null,
        draftBody: "Draft response",
        assistantCategory: "Client Follow-up",
        feedbackProvidedAt: null,
        fieldFeedback: {
          action: "unreviewed",
          priority: "unreviewed",
          category: "unreviewed",
          draft: "unreviewed",
          project: "unreviewed",
          owner: "unreviewed",
          reason: "unreviewed",
          score: "unreviewed",
        },
        projectAssignmentFeedback: {
          status: "unreviewed",
          correctedProjectId: null,
          reasonSignals: [],
          reasonNote: null,
        },
      },
    });
    const archivedEmail = buildEmail("low", {
      id: 3,
      assistant_action: "ignore",
      assistant_review: {
        reviewId: "review-3",
        reviewOutcome: "marked_no_action",
        reviewerNote: null,
        draftBody: null,
        assistantCategory: "No Action",
        feedbackProvidedAt: null,
        fieldFeedback: {
          action: "unreviewed",
          priority: "unreviewed",
          category: "unreviewed",
          draft: "unreviewed",
          project: "unreviewed",
          owner: "unreviewed",
          reason: "unreviewed",
          score: "unreviewed",
        },
        projectAssignmentFeedback: {
          status: "unreviewed",
          correctedProjectId: null,
          reasonSignals: [],
          reasonNote: null,
        },
      },
    });
    const feedbackSubmittedEmail = buildEmail("normal", {
      id: 4,
      assistant_action: "watch",
      assistant_review: {
        reviewId: "review-4",
        reviewOutcome: "watched",
        reviewerNote: "This was corrected already.",
        draftBody: null,
        assistantCategory: "Accounting",
        feedbackProvidedAt: "2026-07-06T13:00:00.000Z",
        fieldFeedback: {
          action: "correct",
          priority: "incorrect",
          category: "correct",
          draft: "unreviewed",
          project: "unreviewed",
          owner: "unreviewed",
          reason: "unreviewed",
          score: "unreviewed",
        },
        projectAssignmentFeedback: {
          status: "unreviewed",
          correctedProjectId: null,
          reasonSignals: [],
          reasonNote: null,
        },
      },
    });

    const counts = countMailboxEmailsByWorkflow([
      inboxEmail,
      draftEmail,
      archivedEmail,
      feedbackSubmittedEmail,
    ]);

    // Only the email with a feedbackProvidedAt timestamp is "done"; the other
    // three (unreviewed inbox, draft, archived-without-feedback) stay pending.
    expect(counts).toEqual({
      pending: 3,
      done: 1,
    });
    expect(isDraftMailboxEmail(draftEmail)).toBe(true);
    expect(isArchivedMailboxEmail(archivedEmail)).toBe(true);
    expect(matchesMailboxWorkflowFilter(inboxEmail, "pending")).toBe(true);
    expect(matchesMailboxWorkflowFilter(feedbackSubmittedEmail, "pending")).toBe(
      false,
    );
    expect(
      matchesMailboxWorkflowFilter(feedbackSubmittedEmail, "done"),
    ).toBe(true);
  });
});

describe("buildMailboxWorkflowTabs", () => {
  it("preserves existing query state while swapping the workflow filter", () => {
    const tabs = buildMailboxWorkflowTabs({
      pathname: "/outlook-draft-feedback",
      searchParams: new URLSearchParams(
        "view=mail&search=invoice&page=3&priority=high",
      ),
      counts: {
        pending: 8,
        done: 5,
      },
      activeWorkflow: "pending",
    });

    expect(tabs.map((tab) => tab.label)).toEqual(["Pending", "Done"]);
    expect(tabs[0]).toMatchObject({
      href: "/outlook-draft-feedback?view=mail&search=invoice&page=1&workflow=pending",
      count: 8,
      isActive: true,
      compact: true,
    });
    expect(tabs[1]).toMatchObject({
      href: "/outlook-draft-feedback?view=mail&search=invoice&page=1&workflow=done",
      count: 5,
      isActive: false,
      compact: true,
    });
    expect(tabs[0]?.href.includes("priority=")).toBe(false);
  });
});

describe("getEmailsRefreshInterval", () => {
  it("polls only for mailbox review mode", () => {
    expect(getEmailsRefreshInterval(true)).toBe(60 * 60 * 1000);
    expect(getEmailsRefreshInterval(false)).toBe(false);
  });
});

describe("email importance visibility", () => {
  it("normalizes unsupported relevance filters to the default inbox", () => {
    expect(normalizeEmailImportanceVisibilityFilter("not_important")).toBe(
      "not_important",
    );
    expect(normalizeEmailImportanceVisibilityFilter("all")).toBe("all");
    expect(normalizeEmailImportanceVisibilityFilter("bad")).toBe("default");
    expect(normalizeEmailImportanceVisibilityFilter(null)).toBe("default");
  });

  it("hides not-important emails from the default inbox and exposes filter views", () => {
    const important = buildEmail("normal", { id: 1 });
    const notImportant = buildEmail("low", { id: 2 });
    const unmarked = buildEmail("normal", { id: 3 });
    const feedback = {
      "1": {
        signal: "important",
        reasonCategory: "decision_needed",
        reason: "Needs a response",
        createdAt: "2026-07-02T12:00:00.000Z",
      },
      "2": {
        signal: "not_important",
        reasonCategory: "marketing_noise",
        reason: "Vendor blast",
        createdAt: "2026-07-02T12:01:00.000Z",
      },
    } as const;

    expect(
      [important, notImportant, unmarked].filter((email) =>
        matchesEmailImportanceVisibility(email, feedback, "default"),
      ),
    ).toEqual([important, unmarked]);
    expect(
      [important, notImportant, unmarked].filter((email) =>
        matchesEmailImportanceVisibility(email, feedback, "not_important"),
      ),
    ).toEqual([notImportant]);
    expect(
      [important, notImportant, unmarked].filter((email) =>
        matchesEmailImportanceVisibility(email, feedback, "all"),
      ),
    ).toEqual([important, notImportant, unmarked]);
  });
});

describe("reconcileSelectedEmail", () => {
  it("replaces the selected row with the refreshed query copy", () => {
    const stale = buildEmail("high", {
      id: 42,
      assistant_review: {
        reviewId: "review-1",
        reviewOutcome: "skipped",
        reviewerNote: null,
        draftBody: null,
        assistantCategory: null,
        feedbackProvidedAt: null,
        fieldFeedback: {
          action: "unreviewed",
          priority: "unreviewed",
          category: "unreviewed",
          draft: "unreviewed",
          project: "unreviewed",
          owner: "unreviewed",
          reason: "unreviewed",
          score: "unreviewed",
        },
        projectAssignmentFeedback: {
          status: "unreviewed",
          correctedProjectId: null,
          reasonSignals: [],
          reasonNote: null,
        },
      },
    });
    const refreshed = buildEmail("urgent", {
      id: 42,
      assistant_review: {
        reviewId: "review-1",
        reviewOutcome: "draft_edited",
        reviewerNote: "Saved",
        draftBody: "Updated draft",
        assistantCategory: "Reply Needed",
        feedbackProvidedAt: "2026-06-30T12:00:00.000Z",
        fieldFeedback: {
          action: "correct",
          priority: "correct",
          category: "correct",
          draft: "correct",
          project: "unreviewed",
          owner: "unreviewed",
          reason: "unreviewed",
          score: "unreviewed",
        },
        projectAssignmentFeedback: {
          status: "unreviewed",
          correctedProjectId: null,
          reasonSignals: [],
          reasonNote: null,
        },
      },
    });

    expect(reconcileSelectedEmail([refreshed], stale)).toEqual(refreshed);
  });

  it("clears the selection when the row no longer exists", () => {
    const selected = buildEmail("normal", { id: 99 });
    expect(reconcileSelectedEmail([], selected)).toBeNull();
  });
});

describe("chunkImportanceFeedbackEmailIds", () => {
  const ids = (count: number) =>
    Array.from({ length: count }, (_, index) => String(index + 1));

  it("returns no batches for an empty list", () => {
    expect(chunkImportanceFeedbackEmailIds([])).toEqual([]);
  });

  it("keeps a small mailbox in a single batch", () => {
    const list = ids(42);
    const batches = chunkImportanceFeedbackEmailIds(list);
    expect(batches).toHaveLength(1);
    expect(batches[0]).toEqual(list);
  });

  it("splits a large mailbox so no request URL overflows (HTTP 431 guard)", () => {
    // Brandon's mailbox is ~1000 emails — the exact case that 431'd when every
    // id went into one `emailId`-per-param GET.
    const batches = chunkImportanceFeedbackEmailIds(ids(1000));
    expect(batches).toHaveLength(10);
    for (const batch of batches) {
      expect(batch.length).toBeLessThanOrEqual(IMPORTANCE_FEEDBACK_BATCH_SIZE);
    }
    // Every id is preserved exactly once across the batches.
    expect(batches.flat()).toEqual(ids(1000));
  });

  it("falls back to the default size for a non-positive batch size", () => {
    expect(chunkImportanceFeedbackEmailIds(ids(250), 0)).toHaveLength(3);
    expect(chunkImportanceFeedbackEmailIds(ids(250), -5)).toHaveLength(3);
  });
});
