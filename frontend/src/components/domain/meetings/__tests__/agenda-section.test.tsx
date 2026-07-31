/**
 * @jest-environment jsdom
 */
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";

import { AgendaSection, MeetingActionItemsSection } from "../agenda-section";
import type { MeetingDetail } from "@/hooks/use-meetings";

// Minutes-mode agenda items render an attachments picker (`meeting_item` is a
// registered Pattern C entity type) which reads `useQueryClient()` — every
// render in this file needs a provider, not just the minutes-mode assertion,
// so a future addition can't silently reintroduce this crash.
function renderWithQueryClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  );
}

// --- Mocks -------------------------------------------------------------

jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));

// jsdom lacks pointer-capture / scrollIntoView used by Radix + dnd-kit.
beforeAll(() => {
  Element.prototype.hasPointerCapture = jest.fn();
  Element.prototype.setPointerCapture = jest.fn();
  Element.prototype.releasePointerCapture = jest.fn();
  Element.prototype.scrollIntoView = jest.fn();
});

// `jest.mock` factories are hoisted above module-scope `const`/`let`
// declarations, so the mock fns are created inside the factory itself and
// stashed on `globalThis` for the assertions further down this file to
// reach the same jest.fn() instances.
jest.mock("@/hooks/use-meetings", () => {
  const actual = jest.requireActual("@/hooks/use-meetings");
  const mocks = {
    createCategoryMock: jest.fn(),
    updateCategoryMock: jest.fn(),
    deleteCategoryMock: jest.fn(),
    reorderCategoriesMock: jest.fn(),
    reorderItemsMock: jest.fn(),
    createItemMock: jest.fn(),
    updateItemMock: jest.fn(),
    deleteItemMock: jest.fn(),
    createItemTaskMock: jest.fn(),
  };
  (globalThis as Record<string, unknown>).__agendaSectionMocks = mocks;

  function mutationHook(mockFn: jest.Mock) {
    return () => ({
      mutate: (variables: unknown, options?: { onSuccess?: (data: unknown) => void }) => {
        mockFn(variables);
        options?.onSuccess?.(undefined);
      },
      isPending: false,
    });
  }

  return {
    ...actual,
    useCreateCategory: mutationHook(mocks.createCategoryMock),
    useUpdateCategory: mutationHook(mocks.updateCategoryMock),
    useDeleteCategory: mutationHook(mocks.deleteCategoryMock),
    useReorderCategories: mutationHook(mocks.reorderCategoriesMock),
    useReorderItems: mutationHook(mocks.reorderItemsMock),
    useCreateItem: mutationHook(mocks.createItemMock),
    useUpdateItem: mutationHook(mocks.updateItemMock),
    useDeleteItem: mutationHook(mocks.deleteItemMock),
    useCreateItemTask: mutationHook(mocks.createItemTaskMock),
    useItemHistory: () => ({ data: { history: [] }, isLoading: false }),
  };
});

const {
  createCategoryMock,
  updateCategoryMock,
  deleteCategoryMock,
  reorderCategoriesMock,
  reorderItemsMock,
  createItemMock,
  updateItemMock,
  deleteItemMock,
  createItemTaskMock,
} = (globalThis as Record<string, unknown>).__agendaSectionMocks as {
  createCategoryMock: jest.Mock;
  updateCategoryMock: jest.Mock;
  deleteCategoryMock: jest.Mock;
  reorderCategoriesMock: jest.Mock;
  reorderItemsMock: jest.Mock;
  createItemMock: jest.Mock;
  updateItemMock: jest.Mock;
  deleteItemMock: jest.Mock;
  createItemTaskMock: jest.Mock;
};

jest.mock("@tanstack/react-query", () => {
  const actual = jest.requireActual("@tanstack/react-query");
  return {
    ...actual,
    useQuery: () => ({ data: { tasks: [] }, isLoading: false, refetch: jest.fn() }),
  };
});

jest.mock("@/hooks/use-users", () => ({
  useUsers: () => ({
    users: [
      {
        id: "person-1",
        first_name: "Jane",
        last_name: "Doe",
        email: "jane@example.com",
        phone_business: null,
        phone_mobile: null,
        job_title: null,
        company_id: null,
        person_type: "user",
        status: null,
        created_at: null,
        updated_at: null,
      },
    ],
    options: [],
    isLoading: false,
    error: null,
    refetch: jest.fn(),
  }),
}));

// --- Fixtures ------------------------------------------------------------

function buildDetail(): MeetingDetail {
  return {
    meeting: {
      id: "meeting-1",
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
      series_name: "Weekly OAC Series",
    },
    attendees: [],
    categories: [
      {
        id: "cat-a",
        meeting_id: "meeting-1",
        name: "Category A",
        position: 0,
        created_at: "2026-01-01T00:00:00.000Z",
        items: [
          {
            id: "item-1",
            meeting_id: "meeting-1",
            category_id: "cat-a",
            position: 0,
            title: "Open Item",
            description: null,
            official_minutes: null,
            assignee_person_id: null,
            due_date: null,
            status: "open",
            priority: null,
            origin_meeting_id: "meeting-1",
            carried_from_item_id: null,
            created_at: "2026-01-01T00:00:00.000Z",
            updated_at: "2026-01-01T00:00:00.000Z",
            agenda_number: "1.1",
            task_count: 0,
          },
          {
            id: "item-2",
            meeting_id: "meeting-1",
            category_id: "cat-a",
            position: 1,
            title: "Closed Item",
            description: null,
            official_minutes: null,
            assignee_person_id: null,
            due_date: null,
            status: "closed",
            priority: null,
            origin_meeting_id: "meeting-1",
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
        meeting_id: "meeting-1",
        name: "Category B",
        position: 1,
        created_at: "2026-01-01T00:00:00.000Z",
        items: [
          {
            id: "item-3",
            meeting_id: "meeting-1",
            category_id: "cat-b",
            position: 0,
            title: "Second Category Item",
            description: null,
            official_minutes: null,
            assignee_person_id: null,
            due_date: null,
            status: "in_progress",
            priority: null,
            origin_meeting_id: "meeting-1",
            carried_from_item_id: null,
            created_at: "2026-01-01T00:00:00.000Z",
            updated_at: "2026-01-01T00:00:00.000Z",
            agenda_number: "2.1",
            task_count: 0,
          },
        ],
      },
    ],
  };
}

// --- Tests -----------------------------------------------------------------

describe("AgendaSection", () => {
  beforeEach(() => {
    createCategoryMock.mockReset();
    updateCategoryMock.mockReset();
    deleteCategoryMock.mockReset();
    reorderCategoriesMock.mockReset();
    reorderItemsMock.mockReset();
    createItemMock.mockReset();
    updateItemMock.mockReset();
    deleteItemMock.mockReset();
    createItemTaskMock.mockReset();
  });

  it("renders agenda items with server-computed agenda_number, not a locally computed value", () => {
    renderWithQueryClient(
      <AgendaSection projectId={42} meetingId="meeting-1" detail={buildDetail()} mode="agenda" />,
    );

    expect(screen.getByText("1.1")).toBeInTheDocument();
    expect(screen.getByText("1.2")).toBeInTheDocument();
    expect(screen.getByText("2.1")).toBeInTheDocument();
  });

  it("renders a compact source link when an agenda item has seeded source metadata", () => {
    const detail = buildDetail();
    detail.categories[0].items[0].description = [
      "Review the permit path.",
      "",
      "Source: Transcript topic 1 (/760/intelligence/sources/source-1#meeting-segment-segment-1)",
      "Context: Weekly design coordination",
    ].join("\n");

    renderWithQueryClient(
      <AgendaSection projectId={42} meetingId="meeting-1" detail={detail} mode="agenda" />,
    );

    const link = screen.getByLabelText("Open source: Transcript topic 1");
    expect(link).toHaveAttribute(
      "href",
      "/760/intelligence/sources/source-1#meeting-segment-segment-1",
    );
    expect(screen.getByText("Closed Item")).toBeInTheDocument();
    expect(screen.queryByLabelText("Open source: Closed Item")).not.toBeInTheDocument();
  });

  it("hides closed items when the status filter is set to Open", async () => {
    const user = userEvent.setup();
    renderWithQueryClient(
      <AgendaSection projectId={42} meetingId="meeting-1" detail={buildDetail()} mode="agenda" />,
    );

    expect(screen.getByText("Closed Item")).toBeInTheDocument();

    const filterTrigger = screen.getByLabelText("Filter by status");
    await user.click(filterTrigger);
    const openOption = await screen.findByRole("option", { name: "Open" });
    await user.click(openOption);

    await waitFor(() => {
      expect(screen.queryByText("Closed Item")).not.toBeInTheDocument();
    });
    expect(screen.getByText("Open Item")).toBeInTheDocument();
  });

  it("renders a quiet action-items section only for agenda items with linked tasks", () => {
    const detail = buildDetail();
    detail.categories[1].items[0].task_count = 1;

    renderWithQueryClient(
      <MeetingActionItemsSection
        projectId={42}
        meetingId="meeting-1"
        detail={detail}
      />,
    );

    expect(screen.getByTestId("meeting-action-items-section")).toBeInTheDocument();
    expect(screen.getByText("Second Category Item")).toBeInTheDocument();
    expect(screen.queryByText("Open Item")).not.toBeInTheDocument();
    expect(screen.queryByText("Closed Item")).not.toBeInTheDocument();
  });

  it("hides the action-items section when no agenda items have linked tasks", () => {
    renderWithQueryClient(
      <MeetingActionItemsSection
        projectId={42}
        meetingId="meeting-1"
        detail={buildDetail()}
      />,
    );

    expect(screen.queryByTestId("meeting-action-items-section")).not.toBeInTheDocument();
  });

  it("creates a linked task with title, owner, and due date from an expanded agenda item", async () => {
    const user = userEvent.setup();
    const detail = buildDetail();
    detail.categories[0].items[0].assignee_person_id = "person-1";
    detail.categories[0].items[0].due_date = "2026-07-15";

    const { container } = renderWithQueryClient(
      <AgendaSection projectId={42} meetingId="meeting-1" detail={detail} mode="agenda" />,
    );

    const agendaRow = container.querySelector('[data-item-id="item-1"]') as HTMLElement;
    expect(agendaRow).not.toBeNull();

    await user.click(within(agendaRow).getByLabelText("Expand item"));
    await user.click(within(agendaRow).getByLabelText("Create task"));
    await user.type(
      within(agendaRow).getByPlaceholderText("Task: Open Item"),
      "Confirm permit response",
    );
    await user.click(within(agendaRow).getByRole("button", { name: "Create" }));

    await waitFor(() => {
      expect(createItemTaskMock).toHaveBeenCalledWith({
        itemId: "item-1",
        data: {
          title: "Confirm permit response",
          assignee_person_id: "person-1",
          due_date: "2026-07-15",
        },
      });
    });
  });

  it("calls useCreateItem when quick-adding an item at the bottom of a category", async () => {
    const user = userEvent.setup();
    renderWithQueryClient(
      <AgendaSection projectId={42} meetingId="meeting-1" detail={buildDetail()} mode="agenda" />,
    );

    const quickAddInputs = screen.getAllByPlaceholderText("Add item…");
    await user.type(quickAddInputs[0], "New action item{enter}");

    await waitFor(() => {
      expect(createItemMock).toHaveBeenCalledWith(
        expect.objectContaining({ category_id: "cat-a", title: "New action item" }),
      );
    });
  });

  it("hides the official minutes textarea in agenda mode and shows it in minutes mode", async () => {
    const user = userEvent.setup();

    // Agenda mode: expand the first item — no "Official Minutes" field.
    const { unmount, container } = renderWithQueryClient(
      <AgendaSection projectId={42} meetingId="meeting-1" detail={buildDetail()} mode="agenda" />,
    );

    const agendaRow = container.querySelector('[data-item-id="item-1"]') as HTMLElement;
    expect(agendaRow).not.toBeNull();
    await user.click(within(agendaRow).getByLabelText("Expand item"));

    expect(screen.queryByText("Official Minutes")).not.toBeInTheDocument();
    unmount();

    // Minutes mode (fresh mount, independent of the agenda-mode instance
    // above): expanding the same item now reveals the official-minutes field.
    const { container: minutesContainer } = renderWithQueryClient(
      <AgendaSection projectId={42} meetingId="meeting-1" detail={buildDetail()} mode="minutes" />,
    );

    const minutesRow = minutesContainer.querySelector('[data-item-id="item-1"]') as HTMLElement;
    expect(minutesRow).not.toBeNull();
    await user.click(within(minutesRow).getByLabelText("Expand item"));

    expect(await within(minutesRow).findByText("Official Minutes")).toBeInTheDocument();
  });
});
