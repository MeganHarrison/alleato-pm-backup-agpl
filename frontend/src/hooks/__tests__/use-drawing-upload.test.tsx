/**
 * @jest-environment jsdom
 */
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";

import { useDrawingUpload } from "../use-drawing-upload";

const apiFetchMock = jest.fn();
const uploadToSignedUrlMock = jest.fn();

jest.mock("@/lib/api-client", () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
}));

jest.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    storage: {
      from: () => ({
        uploadToSignedUrl: uploadToSignedUrlMock,
      }),
    },
  }),
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

function createFileList(files: File[]): FileList {
  return Object.assign(files, {
    item: (index: number) => files[index] ?? null,
  }) as FileList;
}

describe("useDrawingUpload", () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
    uploadToSignedUrlMock.mockResolvedValue({ error: null });
  });

  it("persists reviewed rotation metadata during batch uploads", async () => {
    const createBodies: Array<Record<string, unknown>> = [];
    apiFetchMock.mockImplementation((url: string, options?: { body?: string }) => {
      if (url.endsWith("/drawings/upload-url")) {
        return Promise.resolve({ path: "drawings/S201.pdf", token: "signed-token" });
      }
      if (url.endsWith("/drawings")) {
        createBodies.push(JSON.parse(String(options?.body)) as Record<string, unknown>);
        return Promise.resolve({
          id: "drawing-1",
          current_revision: { id: "revision-1" },
        });
      }
      return Promise.reject(new Error(`Unexpected apiFetch call: ${url}`));
    });

    const { result } = renderHook(() => useDrawingUpload("983"), {
      wrapper: createWrapper(),
    });
    const file = new File(["pdf"], "S201 Framing Plan.pdf", {
      type: "application/pdf",
    });

    await act(async () => {
      await result.current.uploadMultipleDrawings(
        createFileList([file]),
        {
          drawing_set_id: "set-1",
          received_date: "2026-06-23T12:00:00.000Z",
        },
        {
          "S201 Framing Plan.pdf": {
            drawing_number: "S201",
            title: "Framing Plan",
            revision_number: "3",
            discipline: "Structural",
            rotation_degrees: 180,
            ocr_confidence_label: "high",
            ocr_confidence_score: 0.85,
            ocr_confidence_source: "filename",
          },
        },
      );
    });

    expect(createBodies[0]).toMatchObject({
      drawing_number: "S201",
      title: "Framing Plan",
      revision_number: "3",
      discipline: "Structural",
      rotation_degrees: 180,
      ocr_confidence_label: "high",
      ocr_confidence_score: 0.85,
      ocr_confidence_source: "filename",
    });
  });
});
