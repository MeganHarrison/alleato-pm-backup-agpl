/**
 * @jest-environment jsdom
 *
 * Guardrail for attachment-row noise regressions.
 *
 * The shared attachment primitive used to expose inline category selectors and
 * direct action icons on every row, which made detail pages look editable and
 * cluttered even when the user only needed to scan files. This test keeps the
 * default list row quiet and verifies category editing stays behind the
 * overflow menu until explicitly requested.
 */

import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";

import { EntityAttachments } from "../document-picker";
import { apiFetch } from "@/lib/api-client";

jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn(), warning: jest.fn() } }));
jest.mock("@/lib/documents/upload-entity-attachment", () => ({
  uploadEntityAttachment: jest.fn(),
}));
jest.mock("@/lib/api-client", () => ({
  apiFetch: jest.fn(),
}));

const apiFetchMock = apiFetch as jest.MockedFunction<typeof apiFetch>;

function renderWithQueryClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  );
}

beforeAll(() => {
  Element.prototype.hasPointerCapture = jest.fn();
  Element.prototype.setPointerCapture = jest.fn();
  Element.prototype.releasePointerCapture = jest.fn();
  Element.prototype.scrollIntoView = jest.fn();
});

describe("EntityAttachments list rows", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    apiFetchMock.mockImplementation(async (input, init) => {
      const url = String(input);

      if (url.startsWith("/api/document-picker/linked?") && (!init || !("method" in init) || !init.method)) {
        return [
          {
            document_metadata_id: "doc-1",
            document_type: "insurance",
            attached_at: "2026-07-03T15:00:00.000Z",
            title: "ACORD Form 20260608-121830.pdf",
            file_name: "ACORD Form 20260608-121830.pdf",
            file_path: null,
            source_size: 162816,
            download_url: "https://example.com/acord.pdf",
          },
        ] as never;
      }

      if (url.startsWith("/api/document-picker/types?for=")) {
        return [
          {
            type_key: "insurance",
            display_name: "Insurance",
            category: "attachments",
            sort_order: 1,
          },
          {
            type_key: "w9",
            display_name: "W-9",
            category: "attachments",
            sort_order: 2,
          },
        ] as never;
      }

      if (url === "/api/document-picker/linked" && init?.method === "PATCH") {
        return {} as never;
      }

      throw new Error(`Unhandled apiFetch call: ${url} ${init?.method ?? "GET"}`);
    });
  });

  it("keeps the row quiet by default and reveals type editing only from the overflow menu", async () => {
    const user = userEvent.setup();

    renderWithQueryClient(
      <EntityAttachments
        entityType="commitment"
        entityId="commitment-1"
        projectId={876}
        showLabel={false}
      />,
    );

    expect(await screen.findByText("ACORD Form 20260608-121830.pdf")).toBeInTheDocument();
    expect(screen.getByText("Insurance")).toBeInTheDocument();
    expect(
      screen.queryByRole("combobox", {
        name: /document type for acord form 20260608-121830\.pdf/i,
      }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^download$/i })).not.toBeInTheDocument();
    expect(screen.queryByText("159 KB")).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("button", {
        name: /attachment actions for acord form 20260608-121830\.pdf/i,
      }),
    );

    expect(screen.getByRole("menuitem", { name: /^edit$/i })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /^download$/i })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /^delete$/i })).toBeInTheDocument();

    await user.click(screen.getByRole("menuitem", { name: /^edit$/i }));

    await waitFor(() => {
      expect(
        screen.getByRole("combobox", {
          name: /document type for acord form 20260608-121830\.pdf/i,
        }),
      ).toBeInTheDocument();
    });
  });
});
