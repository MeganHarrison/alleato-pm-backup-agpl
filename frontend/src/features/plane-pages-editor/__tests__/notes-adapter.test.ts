import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createProjectNotesEditorAdapter,
  projectNotesBlockDocumentMarker,
} from "../notes-adapter";
import { PlanePagesEditorAdapterError } from "../types";

const page = {
  id: 21,
  project_id: 31,
  title: "Turnover plan",
  body: "Legacy project note",
  archived: false,
  created_at: "2026-07-31T12:00:00.000Z",
  created_by: "user-1",
  updated_at: "2026-07-31T13:00:00.000Z",
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("createProjectNotesEditorAdapter", () => {
  it("loads and saves through the project-scoped notes API", async () => {
    const onPageSaved = vi.fn();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: [page] }),
      })
      .mockImplementationOnce(
        async (_input: RequestInfo | URL, init?: RequestInit) => {
          const requestBody = JSON.parse(String(init?.body));
          return {
            ok: true,
            status: 200,
            json: async () => ({
              data: {
                ...page,
                title: requestBody.title,
                body: requestBody.body,
                updated_at: "2026-07-31T14:00:00.000Z",
              },
            }),
          };
        },
      );
    vi.stubGlobal("fetch", fetchMock);

    const adapter = createProjectNotesEditorAdapter({
      projectId: 31,
      onPageSaved,
    });
    expect(adapter.capabilities).toEqual({ comments: false, versions: false });

    const loaded = await adapter.loadDocument("21");
    expect(loaded.blocks).toEqual([
      expect.objectContaining({
        type: "paragraph",
        text: "Legacy project note",
      }),
    ]);
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/api/notes?project_id=31",
      expect.objectContaining({ headers: expect.any(Object) }),
    );

    const saved = await adapter.saveDocument({
      ...loaded,
      title: "Updated turnover plan",
      blocks: [
        { id: "heading-1", type: "heading", text: "Closeout" },
        {
          id: "check-1",
          type: "check",
          text: "Collect warranties",
          checked: true,
        },
      ],
    });

    const patchBody = JSON.parse(
      String(fetchMock.mock.calls[1]?.[1]?.body),
    ) as Record<string, unknown>;
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/notes",
      expect.objectContaining({ method: "PATCH" }),
    );
    expect(patchBody).toMatchObject({
      projectId: 31,
      pageId: 21,
      title: "Updated turnover plan",
    });
    expect(String(patchBody.body)).toContain(projectNotesBlockDocumentMarker);
    expect(saved.blocks).toEqual([
      { id: "heading-1", type: "heading", text: "Closeout" },
      {
        id: "check-1",
        type: "check",
        text: "Collect warranties",
        checked: true,
      },
    ]);
    expect(onPageSaved).toHaveBeenCalledWith(
      expect.objectContaining({ id: 21, title: "Updated turnover plan" }),
    );
  });

  it("fails loudly for unavailable persistent collaboration features", async () => {
    const adapter = createProjectNotesEditorAdapter({
      projectId: 31,
      onPageSaved: vi.fn(),
    });

    await expect(adapter.listComments("21")).rejects.toMatchObject({
      action: "list-comments",
      message: "Comments are not available for Alleato Pages yet.",
    });
    await expect(adapter.listVersions("21")).rejects.toBeInstanceOf(
      PlanePagesEditorAdapterError,
    );
  });

  it("rejects a cross-list miss without attempting a write", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: [] }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const adapter = createProjectNotesEditorAdapter({
      projectId: 31,
      onPageSaved: vi.fn(),
    });

    await expect(adapter.loadDocument("99")).rejects.toMatchObject({
      action: "load",
      message: "The requested project page was not found.",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
