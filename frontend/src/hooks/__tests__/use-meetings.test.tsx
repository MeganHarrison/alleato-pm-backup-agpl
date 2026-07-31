/**
 * @jest-environment jsdom
 */
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";

import {
  meetingKeys,
  useCreateItemTask,
  useReorderCategories,
  useReorderItems,
  type MeetingDetail,
} from "../use-meetings";

jest.mock("sonner", () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

const apiFetchMock = jest.fn();

jest.mock("@/lib/api-client", () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
}));

const PROJECT_ID = "42";
const MEETING_ID = "meeting-1";

function baseMeetingDetail(): MeetingDetail {
  return {
    meeting: {
      id: MEETING_ID,
      project_id: 42,
      series_id: "series-1",
      number: 1,
      name: "Weekly OAC",
      meeting_link: null,
      location: null,
      meeting_date: null,
      timezone: "UTC",
      start_time: null,
      end_time: null,
      is_private: false,
      is_draft: false,
      mode: "agenda",
      overview: null,
      template_id: null,
      transcript_document_id: null,
      created_by: null,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
      deleted_at: null,
      status: "awaiting_minutes",
    },
    attendees: [],
    categories: [
      {
        id: "cat-a",
        meeting_id: MEETING_ID,
        name: "Category A",
        position: 0,
        created_at: "2026-01-01T00:00:00.000Z",
        items: [
          {
            id: "item-1",
            meeting_id: MEETING_ID,
            category_id: "cat-a",
            position: 0,
            title: "Item 1",
            description: null,
            official_minutes: null,
            assignee_person_id: null,
            due_date: null,
            status: "open",
            priority: null,
            origin_meeting_id: MEETING_ID,
            carried_from_item_id: null,
            created_at: "2026-01-01T00:00:00.000Z",
            updated_at: "2026-01-01T00:00:00.000Z",
            agenda_number: "1.1",
            task_count: 0,
          },
          {
            id: "item-2",
            meeting_id: MEETING_ID,
            category_id: "cat-a",
            position: 1,
            title: "Item 2",
            description: null,
            official_minutes: null,
            assignee_person_id: null,
            due_date: null,
            status: "open",
            priority: null,
            origin_meeting_id: MEETING_ID,
            carried_from_item_id: null,
            created_at: "2026-01-01T00:00:00.000Z",
            updated_at: "2026-01-01T00:00:00.000Z",
            agenda_number: "1.2",
            task_count: 0,
          },
        ],
      },
      {
        id: "cat-b",
        meeting_id: MEETING_ID,
        name: "Category B",
        position: 1,
        created_at: "2026-01-01T00:00:00.000Z",
        items: [],
      },
    ],
  };
}

function createWrapperAndClient() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  return { queryClient, Wrapper };
}

describe("useReorderCategories", () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
  });

  it("optimistically reorders categories, then rolls back on error", async () => {
    const { queryClient, Wrapper } = createWrapperAndClient();
    const detail = baseMeetingDetail();
    queryClient.setQueryData(meetingKeys.detail(PROJECT_ID, MEETING_ID), detail);

    // Deferred rejection: lets us observe the optimistic state (applied
    // synchronously by onMutate) before the mutation settles and rolls back.
    let rejectRequest!: (error: Error) => void;
    apiFetchMock.mockReturnValue(
      new Promise((_resolve, reject) => {
        rejectRequest = reject;
      }),
    );

    const { result } = renderHook(() => useReorderCategories(PROJECT_ID, MEETING_ID), {
      wrapper: Wrapper,
    });

    act(() => {
      result.current.mutate(["cat-b", "cat-a"]);
    });

    // Optimistic update applied via onMutate: cat-b comes first immediately,
    // before the (still-pending) request settles.
    await waitFor(() => {
      const optimistic = queryClient.getQueryData<MeetingDetail>(
        meetingKeys.detail(PROJECT_ID, MEETING_ID),
      );
      expect(optimistic?.categories.map((c) => c.id)).toEqual(["cat-b", "cat-a"]);
    });
    const optimistic = queryClient.getQueryData<MeetingDetail>(
      meetingKeys.detail(PROJECT_ID, MEETING_ID),
    );
    expect(optimistic?.categories.map((c) => c.position)).toEqual([0, 1]);

    act(() => {
      rejectRequest(new Error("Reorder failed"));
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    // Rolled back to the original snapshot after the mutation fails.
    const rolledBack = queryClient.getQueryData<MeetingDetail>(
      meetingKeys.detail(PROJECT_ID, MEETING_ID),
    );
    expect(rolledBack?.categories.map((c) => c.id)).toEqual(["cat-a", "cat-b"]);
  });
});

describe("useReorderItems", () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
  });

  it("optimistically moves/reorders items, then rolls back on error", async () => {
    const { queryClient, Wrapper } = createWrapperAndClient();
    const detail = baseMeetingDetail();
    queryClient.setQueryData(meetingKeys.detail(PROJECT_ID, MEETING_ID), detail);

    let rejectRequest!: (error: Error) => void;
    apiFetchMock.mockReturnValue(
      new Promise((_resolve, reject) => {
        rejectRequest = reject;
      }),
    );

    const { result } = renderHook(() => useReorderItems(PROJECT_ID, MEETING_ID), {
      wrapper: Wrapper,
    });

    act(() => {
      result.current.mutate({ categoryId: "cat-b", orderedIds: ["item-2"] });
    });

    await waitFor(() => {
      const optimistic = queryClient.getQueryData<MeetingDetail>(
        meetingKeys.detail(PROJECT_ID, MEETING_ID),
      );
      const catB = optimistic?.categories.find((c) => c.id === "cat-b");
      expect(catB?.items.map((i) => i.id)).toEqual(["item-2"]);
    });

    act(() => {
      rejectRequest(new Error("Reorder failed"));
    });

    const optimistic = queryClient.getQueryData<MeetingDetail>(
      meetingKeys.detail(PROJECT_ID, MEETING_ID),
    );
    const catA = optimistic?.categories.find((c) => c.id === "cat-a");
    const catB = optimistic?.categories.find((c) => c.id === "cat-b");
    expect(catA?.items.map((i) => i.id)).toEqual(["item-1"]);
    expect(catB?.items[0]?.category_id).toBe("cat-b");

    await waitFor(() => expect(result.current.isError).toBe(true));

    const rolledBack = queryClient.getQueryData<MeetingDetail>(
      meetingKeys.detail(PROJECT_ID, MEETING_ID),
    );
    const rolledBackCatA = rolledBack?.categories.find((c) => c.id === "cat-a");
    const rolledBackCatB = rolledBack?.categories.find((c) => c.id === "cat-b");
    expect(rolledBackCatA?.items.map((i) => i.id)).toEqual(["item-1", "item-2"]);
    expect(rolledBackCatB?.items).toEqual([]);
  });
});

describe("useCreateItemTask", () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
  });

  it("increments the cached agenda item task count after creating a linked task", async () => {
    const { queryClient, Wrapper } = createWrapperAndClient();
    const detail = baseMeetingDetail();
    queryClient.setQueryData(meetingKeys.detail(PROJECT_ID, MEETING_ID), detail);
    apiFetchMock.mockResolvedValue({
      id: "task-1",
      title: "Confirm permit response",
      meeting_item_id: "item-1",
    });

    const { result } = renderHook(() => useCreateItemTask(PROJECT_ID, MEETING_ID), {
      wrapper: Wrapper,
    });

    act(() => {
      result.current.mutate({
        itemId: "item-1",
        data: {
          title: "Confirm permit response",
          assignee_person_id: null,
          due_date: null,
        },
      });
    });

    await waitFor(() => {
      const updated = queryClient.getQueryData<MeetingDetail>(
        meetingKeys.detail(PROJECT_ID, MEETING_ID),
      );
      expect(updated?.categories[0]?.items[0]?.task_count).toBe(1);
    });
    expect(apiFetchMock).toHaveBeenCalledWith(
      "/api/projects/42/meetings/meeting-1/items/item-1/tasks",
      expect.objectContaining({ method: "POST" }),
    );
  });
});
