import { useRef, useState } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { JSDOM } from "jsdom";

import type { TasksRow } from "@/features/tasks/task-utils";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "http://localhost/31/plane/work-items",
});
Object.assign(globalThis, {
  window: dom.window,
  document: dom.window.document,
  navigator: dom.window.navigator,
  HTMLElement: dom.window.HTMLElement,
  Element: dom.window.Element,
  Node: dom.window.Node,
  NodeFilter: dom.window.NodeFilter,
  Event: dom.window.Event,
  CustomEvent: dom.window.CustomEvent,
  KeyboardEvent: dom.window.KeyboardEvent,
  MouseEvent: dom.window.MouseEvent,
  MutationObserver: dom.window.MutationObserver,
  getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
  requestAnimationFrame: (callback: FrameRequestCallback) =>
    setTimeout(callback, 0),
  cancelAnimationFrame: (handle: number) => clearTimeout(handle),
  ResizeObserver: class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
});
for (const property of Object.getOwnPropertyNames(dom.window)) {
  if (property in globalThis) continue;
  const descriptor = Object.getOwnPropertyDescriptor(dom.window, property);
  try {
    if (descriptor) Object.defineProperty(globalThis, property, descriptor);
  } catch {
    // Node owns a few non-configurable web globals; explicit assignments above
    // replace the ones Radix needs with this document's constructors.
  }
}
require("@testing-library/jest-dom");
const { act, fireEvent, render, screen, waitFor, within } =
  require("@testing-library/react") as typeof import("@testing-library/react");
const userEvent =
  require("@testing-library/user-event").default as typeof import("@testing-library/user-event").default;
const {
  buildPlaneWorkItemsPeekHref,
  classifyPlaneWorkItemMutationFailure,
  getInitialPlaneWorkItemsLayout,
  getInitialPlaneWorkItemFilters,
  PlaneWorkItemsPage,
  restorePlaneWorkItemsOrigin,
  runPlaneWorkItemStatusMutation,
  runWithPlaneWorkItemMutationMutex,
  validatePlaneWorkItemDescription,
  WorkItemInspectorDialog,
  WorkItemStatusControl,
} =
  require("./plane-work-items-page") as typeof import("./plane-work-items-page");
const { ApiError } =
  require("@/lib/api-client") as typeof import("@/lib/api-client");

let mockView: string | null = null;
let mockSearch = "";
const mockReplace = jest.fn();
const mockApiFetch = jest.fn();
const mutationTask = {
  id: "task-1",
  status: "open",
} as TasksRow;

jest.mock("next/navigation", () => ({
  usePathname: () => "/31/plane/work-items",
  useRouter: () => ({ push: jest.fn(), replace: mockReplace }),
  useSearchParams: () => ({
    get: (name: string) => {
      if (name === "view" && mockView) return mockView;
      return new URLSearchParams(mockSearch).get(name);
    },
    toString: () => {
      const params = new URLSearchParams(mockSearch);
      if (mockView) params.set("view", mockView);
      return params.toString();
    },
  }),
}));

jest.mock("@/lib/api-client", () => {
  const actual = jest.requireActual("@/lib/api-client");
  return {
    ...actual,
    apiFetch: (...args: unknown[]) => mockApiFetch(...args),
  };
});

jest.mock("./plane-workspace-shell", () => ({
  PlaneWorkspaceShell: ({ children }: { children: React.ReactNode }) => (
    <div
      data-testid="workspace-shell"
      data-plane-workspace-surface="work-items"
    >
      <input placeholder="Search commands..." />
      {children}
    </div>
  ),
}));

function deferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

describe("PlaneWorkItemsPage", () => {
  beforeEach(() => {
    mockView = null;
    mockSearch = "";
    mockReplace.mockClear();
    mockApiFetch.mockReset();
    mockApiFetch.mockResolvedValue({ data: [] });
    document.body.style.pointerEvents = "";
  });

  it("renders the Plane command, display, analytics, and creation controls", () => {
    const html = renderToStaticMarkup(
      <PlaneWorkItemsPage projectId="31" projectName="AI Implementation" />,
    );

    expect(html).toContain('placeholder="Search commands..."');
    expect(html).toContain(">Display<");
    expect(html).toContain(">Analytics<");
    expect(html).toContain(">Add work item<");
    expect(html).toContain('data-plane-workspace-surface="work-items"');
  });

  it("initializes the board layout from the view query parameter", () => {
    mockView = "board";

    const html = renderToStaticMarkup(
      <PlaneWorkItemsPage projectId="31" projectName="AI Implementation" />,
    );

    expect(html).toContain(
      'class="grid size-7 place-items-center rounded bg-white shadow-sm" aria-label="Board view"',
    );
  });

  it.each([null, "list", "calendar", "unsupported"])(
    "falls back to list for an unsupported initial view (%s)",
    (view) => {
      expect(getInitialPlaneWorkItemsLayout(view)).toBe("list");
    },
  );

  it("reads supported saved-view filters from the initial query", () => {
    const filters = getInitialPlaneWorkItemFilters(
      new URLSearchParams(
        "status=done&priority=HIGH&due_from=2026-07-01&due_to=2026-07-31",
      ),
    );

    expect(filters).toEqual({
      status: "done",
      priority: "high",
      dueFrom: "2026-07-01",
      dueTo: "2026-07-31",
    });
  });

  it("ignores unsupported saved-view filter values", () => {
    expect(
      getInitialPlaneWorkItemFilters(
        new URLSearchParams("status=blocked&priority=critical"),
      ),
    ).toEqual({
      status: "all",
      priority: null,
      dueFrom: null,
      dueTo: null,
    });
  });

  it("adds and removes peek without dropping the active view or filters", () => {
    const activeQuery = new URLSearchParams(
      "view=board&status=done&priority=high&due_to=2026-07-31",
    );
    const openHref = buildPlaneWorkItemsPeekHref(
      "/31/plane/work-items",
      activeQuery,
      "task-42",
    );
    const closeHref = buildPlaneWorkItemsPeekHref(
      "/31/plane/work-items",
      new URL(openHref, "https://alleato.test").searchParams,
      null,
    );

    expect(openHref).toBe(
      "/31/plane/work-items?view=board&status=done&priority=high&due_to=2026-07-31&peek=task-42",
    );
    expect(closeHref).toBe(
      "/31/plane/work-items?view=board&status=done&priority=high&due_to=2026-07-31",
    );
  });

  it("restores main scroll position and focus to the inspector origin", () => {
    const main = { scrollTop: 10 };
    const origin = { focus: jest.fn() };

    restorePlaneWorkItemsOrigin(main, 284, origin);

    expect(main.scrollTop).toBe(284);
    expect(origin.focus).toHaveBeenCalledTimes(1);
  });

  it("validates the create title without changing the draft", () => {
    const blankDraft = "   ";
    const longDraft = "x".repeat(501);

    expect(validatePlaneWorkItemDescription(blankDraft)).toBe(
      "Work item title is required.",
    );
    expect(validatePlaneWorkItemDescription(longDraft)).toBe(
      "Work item title must be 500 characters or fewer.",
    );
    expect(blankDraft).toBe("   ");
    expect(longDraft).toHaveLength(501);
  });

  it("completes an optimistic status save", async () => {
    const applyStatus = jest.fn();
    const setMutation = jest.fn();

    await expect(
      runPlaneWorkItemStatusMutation({
        task: mutationTask,
        targetStatus: "done",
        requestId: 1,
        isLatest: () => true,
        persist: () => Promise.resolve(),
        applyStatus,
        setMutation,
      }),
    ).resolves.toBe("saved");

    expect(applyStatus).toHaveBeenCalledTimes(1);
    expect(applyStatus).toHaveBeenCalledWith("done");
    expect(setMutation).toHaveBeenLastCalledWith(null);
  });

  it("rolls back a rejected optimistic status save", async () => {
    const applyStatus = jest.fn();
    const setMutation = jest.fn();

    await expect(
      runPlaneWorkItemStatusMutation({
        task: mutationTask,
        targetStatus: "done",
        requestId: 2,
        isLatest: () => true,
        persist: () => Promise.reject(new Error("offline")),
        applyStatus,
        setMutation,
      }),
    ).resolves.toBe("rejected");

    expect(applyStatus.mock.calls).toEqual([["done"], ["open"]]);
    expect(setMutation).toHaveBeenLastCalledWith(
      expect.objectContaining({
        phase: "error",
        targetStatus: "done",
        failure: expect.objectContaining({
          retryable: true,
          message: "The status change could not be saved. Retry the change.",
        }),
      }),
    );
  });

  it("ignores a stale rejected response instead of rolling back newer state", async () => {
    const applyStatus = jest.fn();
    const setMutation = jest.fn();

    await expect(
      runPlaneWorkItemStatusMutation({
        task: mutationTask,
        targetStatus: "in_progress",
        requestId: 3,
        isLatest: () => false,
        persist: () => Promise.reject(new Error("late failure")),
        applyStatus,
        setMutation,
      }),
    ).resolves.toBe("stale");

    expect(applyStatus).toHaveBeenCalledTimes(1);
    expect(applyStatus).toHaveBeenCalledWith("in_progress");
    expect(setMutation).toHaveBeenCalledTimes(1);
  });

  it("ignores a stale successful response instead of clearing newer mutation state", async () => {
    const applyStatus = jest.fn();
    const setMutation = jest.fn();

    await expect(
      runPlaneWorkItemStatusMutation({
        task: mutationTask,
        targetStatus: "done",
        requestId: 6,
        isLatest: () => false,
        persist: () => Promise.resolve(),
        applyStatus,
        setMutation,
      }),
    ).resolves.toBe("stale");

    expect(applyStatus).toHaveBeenCalledTimes(1);
    expect(setMutation).toHaveBeenCalledTimes(1);
    expect(setMutation).not.toHaveBeenCalledWith(null);
  });

  it("serializes mutations synchronously while a prior request is unresolved", async () => {
    const mutex = { current: false };
    const firstRequest = deferred<string>();
    const firstPersist = jest.fn(() => firstRequest.promise);
    const secondPersist = jest.fn(() => Promise.resolve("second"));

    const first = runWithPlaneWorkItemMutationMutex({
      mutex,
      persist: firstPersist,
    });
    await expect(
      runWithPlaneWorkItemMutationMutex({
        mutex,
        persist: secondPersist,
      }),
    ).resolves.toEqual({ status: "busy" });

    expect(firstPersist).toHaveBeenCalledTimes(1);
    expect(secondPersist).not.toHaveBeenCalled();

    firstRequest.resolve("first");
    await expect(first).resolves.toEqual({
      status: "completed",
      value: "first",
    });
    await expect(
      runWithPlaneWorkItemMutationMutex({
        mutex,
        persist: secondPersist,
      }),
    ).resolves.toEqual({ status: "completed", value: "second" });
  });

  it("can retry a retryable status failure successfully", async () => {
    const persist = jest
      .fn<Promise<void>, []>()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce();
    const applyStatus = jest.fn();
    const setMutation = jest.fn();
    const runAttempt = (requestId: number) =>
      runPlaneWorkItemStatusMutation({
        task: mutationTask,
        targetStatus: "done",
        requestId,
        isLatest: (candidate) => candidate === requestId,
        persist,
        applyStatus,
        setMutation,
      });

    await expect(runAttempt(4)).resolves.toBe("rejected");
    await expect(runAttempt(5)).resolves.toBe("saved");

    expect(persist).toHaveBeenCalledTimes(2);
    expect(setMutation).toHaveBeenLastCalledWith(null);
  });

  it("classifies permission denial as specific and non-retryable", async () => {
    const failure = classifyPlaneWorkItemMutationFailure(
      new ApiError(403, { error: "Forbidden" }),
      "status",
    );

    expect(failure).toEqual({
      kind: "permission",
      message: "You do not have permission to change this work item’s status.",
      retryable: false,
    });
  });

  it("classifies an expired session separately and exposes sign-in recovery", () => {
    expect(
      classifyPlaneWorkItemMutationFailure(
        new ApiError(401, { error: "Unauthorized" }),
        "create",
      ),
    ).toEqual({
      kind: "authentication",
      message: "Your session has expired. Sign in again to continue.",
      retryable: false,
      recoveryHref: "/auth/login",
    });
  });

  it("renders a keyboard-accessible non-drag status control", () => {
    const html = renderToStaticMarkup(
      <WorkItemStatusControl
        task={{
          ...mutationTask,
          description: "Review storefront submittal",
        }}
        mutation={undefined}
        onChange={jest.fn()}
        onRetry={jest.fn()}
      />,
    );

    expect(html).toContain(
      'aria-label="Change status for Review storefront submittal"',
    );
    expect(html).toContain('<option value="open" selected="">Backlog</option>');
    expect(html).toContain('<option value="in_progress">In progress</option>');
    expect(html).toContain('<option value="done">Done</option>');
  });

  it("renders the inspector as a modal dialog, traps focus, closes on Escape, and restores focus", async () => {
    const user = userEvent.setup();

    function InspectorHarness() {
      const [open, setOpen] = useState(true);
      const originRef = useRef<HTMLButtonElement>(null);
      return (
        <>
          <button ref={originRef} type="button">
            Open inspector
          </button>
          {open ? (
            <WorkItemInspectorDialog
              task={{
                ...mutationTask,
                description: "Review storefront submittal",
              }}
              onStatusChange={async () => {}}
              statusMutation={undefined}
              onRetryStatus={jest.fn()}
              onClose={() => setOpen(false)}
              onRestoreFocus={() => originRef.current?.focus()}
            />
          ) : null}
        </>
      );
    }

    render(<InspectorHarness />);

    const dialog = await screen.findByRole("dialog", {
      name: "Review storefront submittal",
    });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(
      within(dialog).getByRole("combobox", {
        name: "Change status for Review storefront submittal in inspector",
      }),
    ).toBeVisible();

    await waitFor(() =>
      expect(
        within(dialog).getByRole("button", {
          name: "Close work item peek",
        }),
      ).toHaveFocus(),
    );
    expect(
      screen
        .getByRole("button", { name: "Open inspector", hidden: true })
        .closest('[aria-hidden="true"]'),
    ).not.toBeNull();

    await user.keyboard("{Escape}");

    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    expect(screen.getByRole("button", { name: "Open inspector" })).toHaveFocus();
  });

  it("rolls a rejected status change back in both the rendered list and inspector", async () => {
    const user = userEvent.setup();
    const patchRequest = deferred();
    mockSearch = "peek=task-1";
    mockApiFetch.mockImplementation(
      (url: string, init?: { method?: string }) => {
        if (url === "/api/tasks/task-1" && init?.method === "PATCH") {
          return patchRequest.promise;
        }
        return Promise.resolve({
          data: [
            {
              ...mutationTask,
              description: "Review storefront submittal",
            },
          ],
        });
      },
    );

    render(<PlaneWorkItemsPage projectId="31" projectName="AI Implementation" />);

    const inspectorStatus = await screen.findByRole("combobox", {
      name: "Change status for Review storefront submittal in inspector",
    });
    const listStatus = screen.getByRole("combobox", {
      name: "Change status for Review storefront submittal",
      hidden: true,
    });

    await user.selectOptions(inspectorStatus, "done");
    expect(inspectorStatus).toHaveValue("done");
    expect(listStatus).toHaveValue("done");
    expect(inspectorStatus).toBeDisabled();
    expect(listStatus).toBeDisabled();

    await act(async () => {
      patchRequest.reject(new Error("offline"));
      await patchRequest.promise.catch(() => undefined);
    });

    await waitFor(() => {
      expect(inspectorStatus).toHaveValue("open");
      expect(listStatus).toHaveValue("open");
    });
    expect(
      screen.getAllByText(
        "The status change could not be saved. Retry the change.",
      ),
    ).toHaveLength(2);
  });

  it("disables board dragging and rejects a drop while that task is saving", async () => {
    const user = userEvent.setup();
    const patchRequest = deferred();
    mockView = "board";
    mockApiFetch.mockImplementation(
      (url: string, init?: { method?: string }) => {
        if (url === "/api/tasks/task-1" && init?.method === "PATCH") {
          return patchRequest.promise;
        }
        return Promise.resolve({
          data: [
            {
              ...mutationTask,
              description: "Review storefront submittal",
            },
          ],
        });
      },
    );

    render(<PlaneWorkItemsPage projectId="31" projectName="AI Implementation" />);
    const status = await screen.findByRole("combobox", {
      name: "Change status for Review storefront submittal",
    });

    await user.selectOptions(status, "done");
    await waitFor(() => {
      const currentStatus = screen.getByRole("combobox", {
        name: "Change status for Review storefront submittal",
      });
      expect(currentStatus.closest("[draggable]")).toHaveAttribute(
        "draggable",
        "false",
      );
    });

    const backlogHeading = screen
      .getAllByText("Backlog")
      .find((element: HTMLElement) => element.tagName === "SPAN");
    const backlogColumn = backlogHeading?.closest("section");
    expect(backlogColumn).not.toBeNull();
    fireEvent.drop(backlogColumn!, {
      dataTransfer: { getData: () => "task-1" },
    });

    expect(
      mockApiFetch.mock.calls.filter(
        ([url, init]) =>
          url === "/api/tasks/task-1" &&
          (init as { method?: string } | undefined)?.method === "PATCH",
      ),
    ).toHaveLength(1);

    await act(async () => {
      patchRequest.resolve();
      await patchRequest.promise;
    });
  });

  it("allows only one rapid create request, preserves the rejected draft, and retries it", async () => {
    const user = userEvent.setup();
    const firstPost = deferred();
    let postCount = 0;
    mockApiFetch.mockImplementation(
      (url: string, init?: { method?: string }) => {
        if (url === "/api/tasks" && init?.method === "POST") {
          postCount += 1;
          return postCount === 1 ? firstPost.promise : Promise.resolve({});
        }
        return Promise.resolve({ data: [] });
      },
    );

    render(<PlaneWorkItemsPage projectId="31" projectName="AI Implementation" />);
    await user.click(screen.getByRole("button", { name: /Add work item/ }));
    const input = screen.getByPlaceholderText("New work item");
    await user.type(input, "Preserve this draft");

    await act(async () => {
      input.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
      );
      input.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
      );
    });
    expect(postCount).toBe(1);

    await act(async () => {
      firstPost.reject(new Error("offline"));
      await firstPost.promise.catch(() => undefined);
    });
    await waitFor(() => expect(input).toHaveValue("Preserve this draft"));

    await user.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(postCount).toBe(2));
    expect(screen.queryByPlaceholderText("New work item")).not.toBeInTheDocument();
  });
});
