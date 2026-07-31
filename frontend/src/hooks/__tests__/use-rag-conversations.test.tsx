/** @jest-environment jsdom */

import type { ReactNode } from "react";
import { act, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import { useCreateConversation } from "../use-rag-conversations";

jest.mock("@/lib/api-client", () => ({
  apiFetch: jest.fn(),
}));

jest.mock("sonner", () => ({
  toast: { error: jest.fn() },
}));

const mockApiFetch = apiFetch as jest.MockedFunction<typeof apiFetch>;

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe("useCreateConversation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("coalesces concurrent creation attempts into one API request", async () => {
    let resolveRequest: ((value: unknown) => void) | undefined;
    mockApiFetch.mockReturnValue(
      new Promise((resolve) => {
        resolveRequest = resolve;
      }) as ReturnType<typeof apiFetch>,
    );

    const { result } = renderHook(() => useCreateConversation(), { wrapper });

    let firstRequest: Promise<unknown> | undefined;
    let secondRequest: Promise<unknown> | undefined;
    await act(async () => {
      firstRequest = result.current.mutateAsync("One conversation");
      secondRequest = result.current.mutateAsync("One conversation");
      await Promise.resolve();
    });

    expect(mockApiFetch).toHaveBeenCalledTimes(1);

    resolveRequest?.({
      conversation: {
        session_id: "session-1",
        title: "One conversation",
        last_message_at: null,
        created_at: "2026-07-22T18:00:00.000Z",
        metadata: { surface: "alleato_ai" },
        is_pinned: false,
      },
    });

    await expect(firstRequest).resolves.toMatchObject({
      session_id: "session-1",
    });
    await expect(secondRequest).resolves.toMatchObject({
      session_id: "session-1",
    });
  });
});
