/**
 * @jest-environment jsdom
 */
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom";

import { DrawingUploadDialog } from "../DrawingUploadDialog";

type UploadFailure = { fileName: string; error: string; code: string };
type UploadResult = { fileName: string; drawingId: string };

const uploadMock = jest.fn();
const invalidateQueriesMock = jest.fn();
const apiFetchMock = jest.fn();
const uploadToSignedUrlMock = jest.fn();

let uploadFailures: UploadFailure[] = [];
let uploadResults: UploadResult[] = [];
let lastUploadMetadata: Record<string, unknown> | null = null;
let lastPerFileMetadata: Record<string, Record<string, unknown>> | null = null;
let drawingSets: Array<{ id: string; name: string }> = [{ id: "set-existing", name: "Issued Set" }];

jest.mock("@tanstack/react-query", () => {
  const actual = jest.requireActual("@tanstack/react-query");
  return {
    ...actual,
    useQueryClient: () => ({ invalidateQueries: invalidateQueriesMock }),
  };
});

jest.mock("@/hooks/use-drawing-sets", () => ({
  useDrawingSets: () => ({ data: drawingSets }),
}));

jest.mock("@/hooks/use-drawing-upload", () => {
  const React = jest.requireActual("react");

  class DrawingUploadBatchError extends Error {
    constructor(
      readonly results: UploadResult[],
      readonly failures: UploadFailure[],
    ) {
      super(`Uploaded ${results.length} of ${results.length + failures.length} drawings`);
      this.name = "DrawingUploadBatchError";
    }
  }

  return {
    DrawingUploadBatchError,
    useDrawingUpload: () => {
      const [errors, setErrors] = React.useState<UploadFailure[]>([]);

      const uploadMultipleDrawings = async (
        files: FileList,
        metadata: Record<string, unknown>,
        perFileMetadata: Record<string, Record<string, unknown>>,
      ) => {
        lastUploadMetadata = metadata;
        lastPerFileMetadata = perFileMetadata;
        uploadMock(Array.from(files).map((file) => file.name), metadata, perFileMetadata);
        if (uploadFailures.length > 0) {
          setErrors(uploadFailures);
          throw new DrawingUploadBatchError(uploadResults, uploadFailures);
        }
        return uploadResults;
      };

      return {
        uploadMultipleDrawings,
        isUploading: false,
        progress: [],
        errors,
        clearErrors: jest.fn(),
        clearUploadState: jest.fn(() => setErrors([])),
      };
    },
  };
});

jest.mock("@/lib/api-client", () => ({
  ApiError: class ApiError extends Error {
    status: number;
    body: unknown;

    constructor(message: string, status: number, body: unknown) {
      super(message);
      this.status = status;
      this.body = body;
    }
  },
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

jest.mock("sonner", () => ({
  toast: {
    error: jest.fn(),
    success: jest.fn(),
  },
}));

jest.mock("@/components/ui/dialog", () => ({
  Dialog: ({ open, children }: { open: boolean; children: React.ReactNode }) =>
    open ? <div>{children}</div> : null,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) =>
    React.createElement("div", { role: "heading", "aria-level": 2 }, children),
}));

jest.mock("@/components/ui/select", () => ({
  Select: ({
    value,
    onValueChange,
    disabled,
    children,
  }: {
    value?: string;
    onValueChange: (value: string) => void;
    disabled?: boolean;
    children: React.ReactNode;
  }) =>
    React.createElement(
      "select",
      {
        "aria-label": "Drawing Set",
        value: value ?? "",
        disabled,
        onChange: (event: React.ChangeEvent<HTMLSelectElement>) =>
          onValueChange(event.target.value),
      },
      children,
    ),
  SelectContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectItem: ({ value, children }: { value: string; children: React.ReactNode }) =>
    React.createElement("option", { value }, children),
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectValue: ({ placeholder }: { placeholder?: string }) =>
    React.createElement("option", { value: "" }, placeholder),
}));

const makeFile = (name: string) => new File(["pdf"], name, { type: "application/pdf" });

class TestDataTransfer {
  private readonly fileItems: File[] = [];

  items = {
    add: (file: File) => {
      this.fileItems.push(file);
    },
  };

  get files() {
    return this.fileItems;
  }
}

const renderDialog = (initialFiles = [makeFile("A101.pdf"), makeFile("A102.pdf")]) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <DrawingUploadDialog
        projectId="983"
        open
        onOpenChange={jest.fn()}
        initialFiles={initialFiles}
      />
    </QueryClientProvider>,
  );
};

beforeEach(() => {
  Object.defineProperty(globalThis, "DataTransfer", {
    configurable: true,
    writable: true,
    value: TestDataTransfer,
  });
  uploadMock.mockClear();
  invalidateQueriesMock.mockClear();
  apiFetchMock.mockReset();
  uploadFailures = [];
  uploadResults = [];
  lastUploadMetadata = null;
  lastPerFileMetadata = null;
  drawingSets = [{ id: "set-existing", name: "Issued Set" }];
});

describe("DrawingUploadDialog partial batch failure guardrails", () => {
  it("keeps only failed files selected, shows persistent inline error, and changes retry label", async () => {
    uploadResults = [{ fileName: "A101.pdf", drawingId: "drawing-1" }];
    uploadFailures = [{ fileName: "A102.pdf", error: "Duplicate drawing number", code: "SERVER_ERROR" }];

    renderDialog();

    fireEvent.change(screen.getByLabelText("Drawing Set"), { target: { value: "set-existing" } });
    fireEvent.click(screen.getByRole("button", { name: "Process" }));

    await waitFor(() => {
      expect(screen.queryByText("A101.pdf")).not.toBeInTheDocument();
    });

    expect(screen.getByText("A102.pdf")).toBeInTheDocument();
    expect(screen.getByText("Some drawings did not upload")).toBeInTheDocument();
    expect(screen.getByText("A102.pdf: Duplicate drawing number")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry failed drawing" })).toBeInTheDocument();
    expect(uploadMock).toHaveBeenCalledWith(
      ["A101.pdf", "A102.pdf"],
      expect.any(Object),
      expect.any(Object),
    );
  });

  it("lets users review and correct detected metadata before batch upload", async () => {
    uploadResults = [{ fileName: "A101 First Floor Plan.pdf", drawingId: "drawing-1" }];
    uploadToSignedUrlMock.mockResolvedValue({ error: null });
    apiFetchMock.mockImplementation((url: string, options?: { method?: string }) => {
      if (url.endsWith("/drawings/upload-url")) {
        return Promise.resolve({ path: "drawings/A101.pdf", token: "upload-token" });
      }
      if (url.endsWith("/drawings") && options?.method === "POST") {
        return Promise.resolve({ id: "drawing-1", current_revision: { id: "revision-1" } });
      }
      return Promise.reject(new Error(`Unexpected apiFetch call: ${url}`));
    });

    renderDialog([makeFile("A101 First Floor Plan.pdf")]);

    fireEvent.change(screen.getByLabelText("Drawing Set"), { target: { value: "set-existing" } });
    fireEvent.change(screen.getByLabelText("A101 First Floor Plan.pdf title"), {
      target: { value: "First Floor Plan - Revised" },
    });
    fireEvent.change(screen.getByLabelText("A101 First Floor Plan.pdf revision"), {
      target: { value: "2" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Rotate A101 First Floor Plan.pdf" }));
    fireEvent.click(screen.getByRole("button", { name: "Process" }));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith(
        "/api/projects/983/drawings",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining('"title":"First Floor Plan - Revised"'),
        }),
      );
    });
    const createCall = apiFetchMock.mock.calls.find(
      ([url, options]) =>
        String(url).endsWith("/drawings") &&
        (options as { method?: string } | undefined)?.method === "POST",
    );
    const createBody = JSON.parse(
      String((createCall?.[1] as { body?: string } | undefined)?.body),
    ) as Record<string, unknown>;

    expect(createBody).toMatchObject({
      drawing_number: "A101",
      title: "First Floor Plan - Revised",
      revision_number: "2",
      discipline: "Architectural",
      rotation_degrees: 90,
      ocr_confidence_label: "high",
      ocr_confidence_score: 1,
      ocr_confidence_source: "manual",
    });
  });

  it("passes reviewed metadata for each file in a batch upload", async () => {
    uploadResults = [
      { fileName: "A101 First Floor Plan.pdf", drawingId: "drawing-1" },
      { fileName: "S201 Framing Plan.pdf", drawingId: "drawing-2" },
    ];

    renderDialog([
      makeFile("A101 First Floor Plan.pdf"),
      makeFile("S201 Framing Plan.pdf"),
    ]);

    fireEvent.change(screen.getByLabelText("Drawing Set"), { target: { value: "set-existing" } });
    fireEvent.change(screen.getByLabelText("S201 Framing Plan.pdf revision"), {
      target: { value: "3" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Rotate S201 Framing Plan.pdf" }));
    fireEvent.click(screen.getByRole("button", { name: "Rotate S201 Framing Plan.pdf" }));
    fireEvent.click(screen.getByRole("button", { name: "Process" }));

    await waitFor(() => {
      expect(lastPerFileMetadata?.["S201 Framing Plan.pdf"]).toMatchObject({
        drawing_number: "S201",
        title: "Framing Plan",
        revision_number: "3",
        discipline: "Structural",
        rotation_degrees: 180,
        ocr_confidence_label: "high",
        ocr_confidence_score: 1,
        ocr_confidence_source: "manual",
      });
    });
  });

  it("removes a selected file before batch upload", async () => {
    uploadResults = [
      { fileName: "S201 Framing Plan.pdf", drawingId: "drawing-2" },
      { fileName: "M301 Mechanical Plan.pdf", drawingId: "drawing-3" },
    ];

    renderDialog([
      makeFile("A101 First Floor Plan.pdf"),
      makeFile("S201 Framing Plan.pdf"),
      makeFile("M301 Mechanical Plan.pdf"),
    ]);

    fireEvent.click(screen.getByRole("button", { name: "Remove A101 First Floor Plan.pdf" }));
    fireEvent.change(screen.getByLabelText("Drawing Set"), { target: { value: "set-existing" } });
    fireEvent.click(screen.getByRole("button", { name: "Process" }));

    await waitFor(() => {
      expect(uploadMock).toHaveBeenCalledWith(
        ["S201 Framing Plan.pdf", "M301 Mechanical Plan.pdf"],
        expect.any(Object),
        expect.objectContaining({
          "S201 Framing Plan.pdf": expect.objectContaining({
            drawing_number: "S201",
            ocr_confidence_label: "high",
            ocr_confidence_score: 0.85,
            ocr_confidence_source: "filename",
          }),
          "M301 Mechanical Plan.pdf": expect.objectContaining({
            drawing_number: "M301",
          }),
        }),
      );
    });
    expect(screen.queryByText("A101 First Floor Plan.pdf")).not.toBeInTheDocument();
  });

  it("resolves a new drawing set to the returned set id before retrying failed files", async () => {
    uploadResults = [{ fileName: "A101.pdf", drawingId: "drawing-1" }];
    uploadFailures = [{ fileName: "A102.pdf", error: "Duplicate drawing number", code: "SERVER_ERROR" }];
    uploadToSignedUrlMock.mockResolvedValue({ error: null });
    apiFetchMock.mockImplementation((url: string, options?: { method?: string; body?: string }) => {
      if (url.endsWith("/drawings/sets")) {
        return Promise.resolve({ id: "set-created" });
      }
      if (url.endsWith("/drawings/upload-url")) {
        return Promise.resolve({ path: "drawings/A102.pdf", token: "upload-token" });
      }
      if (url.endsWith("/drawings") && options?.method === "POST") {
        return Promise.resolve({ id: "drawing-2", current_revision: { id: "revision-2" } });
      }
      return Promise.reject(new Error(`Unexpected apiFetch call: ${url}`));
    });

    const { container } = renderDialog();

    fireEvent.change(screen.getByLabelText("Drawing Set"), { target: { value: "__new__" } });
    fireEvent.change(screen.getByPlaceholderText("e.g. IFC Set 01 - 2024"), {
      target: { value: "IFC Set 01" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Process" }));

    await waitFor(() => {
      expect(lastUploadMetadata?.drawing_set_id).toBe("set-created");
    });

    expect(within(container).queryByText("A101.pdf")).not.toBeInTheDocument();
    expect(within(container).getByText("A102.pdf")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry failed drawing" })).toBeInTheDocument();

    uploadFailures = [];
    uploadResults = [{ fileName: "A102.pdf", drawingId: "drawing-2" }];
    fireEvent.click(screen.getByRole("button", { name: "Retry failed drawing" }));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith(
        "/api/projects/983/drawings",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining('"drawing_set_id":"set-created"'),
        }),
      );
    });
    expect(apiFetchMock.mock.calls.filter(([url]) => String(url).endsWith("/drawings/sets"))).toHaveLength(1);
  });
});
