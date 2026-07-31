import {
  getHomeAiApprovalMeta,
  getHomePrimaryQueueAction,
} from "../home-action-routing";

describe("getHomeAiApprovalMeta", () => {
  it("shows loading state while AI review decisions are being checked", () => {
    expect(
      getHomeAiApprovalMeta({
        isLoading: true,
        aiApprovalCount: 0,
        interruptCount: 0,
      }),
    ).toBe("Checking AI decisions.");
  });

  it("keeps quiet AI approval decisions out of widget-interrupt copy", () => {
    expect(
      getHomeAiApprovalMeta({
        isLoading: false,
        aiApprovalCount: 2,
        interruptCount: 0,
      }),
    ).toBe("2 AI decisions waiting quietly in the review queue.");
  });

  it("surfaces AI approvals that also alert the widget", () => {
    expect(
      getHomeAiApprovalMeta({
        isLoading: false,
        aiApprovalCount: 2,
        interruptCount: 1,
      }),
    ).toBe("2 AI decisions waiting. 1 also alerts the AI widget.");
  });
});

describe("getHomePrimaryQueueAction", () => {
  it("routes to due project tasks before AI approvals", () => {
    expect(
      getHomePrimaryQueueAction({
        todayTasks: [{ project_id: 25125 }],
        openTasks: [{ project_id: 43 }],
        aiApprovalCount: 2,
      }),
    ).toEqual({
      href: "/25125/tasks",
      label: "Open tasks",
    });
  });

  it("routes to AI approvals when no project task queue is waiting", () => {
    expect(
      getHomePrimaryQueueAction({
        todayTasks: [],
        openTasks: [],
        aiApprovalCount: 3,
      }),
    ).toEqual({
      href: "/ai/approvals",
      label: "Review AI",
    });
  });

  it("falls back to the task inbox when there is no task project or AI review", () => {
    expect(
      getHomePrimaryQueueAction({
        todayTasks: [],
        openTasks: [{ project_id: null }],
        aiApprovalCount: 0,
      }),
    ).toEqual({
      href: "/tasks",
      label: "Open tasks",
    });
  });
});
