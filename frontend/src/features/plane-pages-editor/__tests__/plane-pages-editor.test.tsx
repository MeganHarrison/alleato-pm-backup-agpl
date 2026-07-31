import * as React from "react";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { createMemoryPlanePagesEditorAdapter } from "../memory-adapter";
import { PlanePagesEditor } from "../plane-pages-editor";
import type {
  PlanePageEditorDocument,
  PlanePagesEditorAdapter,
} from "../types";
import { PlanePagesEditorAdapterError } from "../types";

const now = "2026-07-31T12:00:00.000Z";

function makeDocument(): PlanePageEditorDocument {
  return {
    id: "page-1",
    title: "Coordination plan",
    blocks: [{ id: "block-1", type: "paragraph", text: "Original body" }],
    updatedAt: now,
    updatedBy: "Megan",
  };
}

function makeAdapter() {
  return createMemoryPlanePagesEditorAdapter({
    documents: [makeDocument()],
    versions: [
      {
        id: "version-original",
        pageId: "page-1",
        title: "Earlier plan",
        blocks: [{ id: "old-block", type: "paragraph", text: "Earlier body" }],
        createdAt: "2026-07-30T12:00:00.000Z",
        createdBy: "Megan",
      },
    ],
    comments: [
      {
        id: "comment-1",
        pageId: "page-1",
        body: "Confirm the turnover date.",
        authorName: "Alex",
        createdAt: now,
      },
    ],
    authorName: "Megan",
  });
}

describe("PlanePagesEditor", () => {
  it("edits the title, adds a block with Enter, changes its type, and saves", async () => {
    const adapter = makeAdapter();
    const saveSpy = vi.spyOn(adapter, "saveDocument");
    const user = userEvent.setup();

    render(<PlanePagesEditor pageId="page-1" adapter={adapter} />);

    const title = await screen.findByLabelText("Page title");
    await user.clear(title);
    await user.type(title, "Turnover plan");

    const firstBlock = screen.getByLabelText("Block 1, Text");
    await user.click(firstBlock);
    await user.keyboard("{Enter}");

    const secondBlock = screen.getByLabelText("Block 2, Text");
    await user.type(secondBlock, "Closeout documents");
    await user.click(screen.getByLabelText("Change block 2 type"));
    await user.click(screen.getByRole("option", { name: "To-do" }));
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(saveSpy).toHaveBeenCalledTimes(1));
    expect(saveSpy.mock.calls[0][0]).toMatchObject({
      title: "Turnover plan",
      blocks: [
        expect.objectContaining({ text: "Original body" }),
        expect.objectContaining({
          text: "Closeout documents",
          type: "check",
        }),
      ],
    });
    expect(await screen.findByText("Saved")).toBeInTheDocument();
  });

  it("keeps unsaved edits visible and provides retry when saving fails", async () => {
    const adapter = makeAdapter();
    adapter.saveDocument = vi
      .fn()
      .mockRejectedValueOnce(
        new PlanePagesEditorAdapterError(
          "save",
          "The secure notes API rejected the update.",
          "Check page permissions and retry.",
        ),
      )
      .mockImplementation(async (document) => document);
    const user = userEvent.setup();

    render(<PlanePagesEditor pageId="page-1" adapter={adapter} />);

    const title = await screen.findByLabelText("Page title");
    await user.clear(title);
    await user.type(title, "Preserved draft");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(
      await screen.findByText(/secure notes API rejected the update/i),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Page title")).toHaveValue("Preserved draft");

    await user.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(adapter.saveDocument).toHaveBeenCalledTimes(2));
    expect(screen.getByLabelText("Page title")).toHaveValue("Preserved draft");
  });

  it("does not overwrite edits entered while an earlier save is in flight", async () => {
    const adapter = makeAdapter();
    let releaseSave: (() => void) | undefined;
    const saveGate = new Promise<void>((resolve) => {
      releaseSave = resolve;
    });
    adapter.saveDocument = vi.fn(async (document) => {
      await saveGate;
      return { ...document, updatedAt: "2026-07-31T13:00:00.000Z" };
    });
    const user = userEvent.setup();

    render(<PlanePagesEditor pageId="page-1" adapter={adapter} />);

    const title = await screen.findByLabelText("Page title");
    await user.clear(title);
    await user.type(title, "First saved draft");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(adapter.saveDocument).toHaveBeenCalledTimes(1));

    await user.type(title, " plus newer edits");
    await act(async () => releaseSave?.());

    expect(title).toHaveValue("First saved draft plus newer edits");
    expect(await screen.findByText("Unsaved changes")).toBeInTheDocument();
  });

  it("posts and resolves comments without leaving the editor", async () => {
    const adapter = makeAdapter();
    const user = userEvent.setup();

    render(<PlanePagesEditor pageId="page-1" adapter={adapter} />);

    await screen.findByLabelText("Page title");
    await user.click(screen.getByRole("button", { name: "Open comments" }));
    expect(
      await screen.findByText("Confirm the turnover date."),
    ).toBeInTheDocument();

    await user.type(screen.getByLabelText("New comment"), "Date is confirmed.");
    await user.click(screen.getByRole("button", { name: "Comment" }));
    expect(await screen.findByText("Date is confirmed.")).toBeInTheDocument();

    const resolveButtons = screen.getAllByRole("button", { name: "Resolve" });
    await user.click(resolveButtons[resolveButtons.length - 1]);
    expect(await screen.findByText("Resolved")).toBeInTheDocument();
  });

  it("restores a version into an editable dirty draft", async () => {
    const adapter = makeAdapter();
    const user = userEvent.setup();

    render(<PlanePagesEditor pageId="page-1" adapter={adapter} />);

    await screen.findByLabelText("Page title");
    await user.click(
      screen.getByRole("button", { name: "Open version history" }),
    );
    await user.click(await screen.findByRole("button", { name: "Restore" }));

    expect(screen.getByLabelText("Page title")).toHaveValue("Earlier plan");
    expect(screen.getByText("Unsaved changes")).toBeInTheDocument();
    expect(screen.getByLabelText("Block 1, Text")).toHaveValue("Earlier body");
  });

  it("supports Ctrl+S from the block editor", async () => {
    const adapter = makeAdapter();
    const saveSpy = vi.spyOn(adapter, "saveDocument");

    render(<PlanePagesEditor pageId="page-1" adapter={adapter} />);

    await screen.findByLabelText("Page title");
    fireEvent.keyDown(window, { key: "s", ctrlKey: true });
    await waitFor(() => expect(saveSpy).toHaveBeenCalledTimes(1));
  });

  it("fails loudly when the page cannot load", async () => {
    const adapter: PlanePagesEditorAdapter = {
      ...makeAdapter(),
      loadDocument: vi
        .fn()
        .mockRejectedValue(
          new PlanePagesEditorAdapterError(
            "load",
            "Page access was denied.",
            "Ask a project administrator for Documents access.",
          ),
        ),
    };

    render(<PlanePagesEditor pageId="page-1" adapter={adapter} />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Page access was denied. Ask a project administrator for Documents access.",
    );
  });

  it("keeps editing available when comments or history cannot load", async () => {
    const adapter = makeAdapter();
    adapter.listVersions = vi
      .fn()
      .mockRejectedValue(new Error("History service unavailable"));

    render(<PlanePagesEditor pageId="page-1" adapter={adapter} />);

    expect(await screen.findByLabelText("Page title")).toHaveValue(
      "Coordination plan",
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Page history or comments could not be loaded. Page editing is still available.",
    );
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
  });

  it("reports a successful save accurately when secondary refresh fails", async () => {
    const adapter = makeAdapter();
    const saveSpy = vi.spyOn(adapter, "saveDocument");
    adapter.listComments = vi
      .fn()
      .mockResolvedValueOnce([])
      .mockRejectedValue(new Error("Comments service unavailable"));
    const user = userEvent.setup();

    render(<PlanePagesEditor pageId="page-1" adapter={adapter} />);

    const title = await screen.findByLabelText("Page title");
    await user.clear(title);
    await user.type(title, "Saved despite panel outage");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(saveSpy).toHaveBeenCalledTimes(1));
    expect(await screen.findByText("Saved")).toBeInTheDocument();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Page history or comments could not be loaded. Page editing is still available.",
    );
    expect(screen.queryByText("Save failed")).not.toBeInTheDocument();
  });

  it("keeps unsupported collaboration capabilities quiet until requested", async () => {
    const adapter = makeAdapter();
    adapter.capabilities = { comments: false, versions: false };
    adapter.listComments = vi.fn();
    adapter.listVersions = vi.fn();
    const user = userEvent.setup();

    render(<PlanePagesEditor pageId="page-1" adapter={adapter} />);

    expect(await screen.findByLabelText("Page title")).toBeInTheDocument();
    expect(adapter.listComments).not.toHaveBeenCalled();
    expect(adapter.listVersions).not.toHaveBeenCalled();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Open comments" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Comments are not available for Alleato Pages yet.",
    );
    expect(
      screen.queryByRole("heading", { name: "Comments" }),
    ).not.toBeInTheDocument();
  });

  it("guards unsupported capability changes from an open panel", async () => {
    const adapter = makeAdapter();
    adapter.capabilities = { comments: true, versions: false };
    adapter.listVersions = vi.fn();
    const user = userEvent.setup();

    render(<PlanePagesEditor pageId="page-1" adapter={adapter} />);

    await screen.findByLabelText("Page title");
    await user.click(screen.getByRole("button", { name: "Open comments" }));
    expect(
      await screen.findByText("Confirm the turnover date."),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "History" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Version history is not available for Alleato Pages yet.",
    );
    expect(
      screen.queryByText("Versions appear after the first save."),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("Confirm the turnover date."),
    ).not.toBeInTheDocument();
    expect(adapter.listVersions).not.toHaveBeenCalled();
  });

  it("keeps archive and restore reachable from the detail header", async () => {
    const adapter = makeAdapter();
    const onToggle = vi.fn();
    const user = userEvent.setup();

    const { rerender } = render(
      <PlanePagesEditor
        pageId="page-1"
        adapter={adapter}
        archiveAction={{ archived: false, isWorking: false, onToggle }}
      />,
    );

    await user.click(
      await screen.findByRole("button", { name: "Archive page" }),
    );
    expect(onToggle).toHaveBeenCalledTimes(1);

    rerender(
      <PlanePagesEditor
        pageId="page-1"
        adapter={adapter}
        archiveAction={{ archived: true, isWorking: false, onToggle }}
      />,
    );
    expect(
      screen.getByRole("button", { name: "Restore page" }),
    ).toBeInTheDocument();
  });

  it("refuses to archive a dirty page until its edits are saved", async () => {
    const adapter = makeAdapter();
    const onToggle = vi.fn();
    const user = userEvent.setup();

    render(
      <PlanePagesEditor
        pageId="page-1"
        adapter={adapter}
        archiveAction={{ archived: false, isWorking: false, onToggle }}
      />,
    );

    const title = await screen.findByLabelText("Page title");
    await user.type(title, " updated");
    await user.click(screen.getByRole("button", { name: "Archive page" }));

    expect(onToggle).not.toHaveBeenCalled();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Save this page before changing its archive status. Your unsaved edits are still here.",
    );

    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Saved")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Archive page" }));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });
});
