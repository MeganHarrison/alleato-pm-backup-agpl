import { describe, expect, it } from "vitest";

import { createMemoryPlanePagesEditorAdapter } from "../memory-adapter";
import { PlanePagesEditorAdapterError } from "../types";

describe("createMemoryPlanePagesEditorAdapter", () => {
  it("creates a version for every saved document", async () => {
    const adapter = createMemoryPlanePagesEditorAdapter({
      documents: [
        {
          id: "page-1",
          title: "Page",
          blocks: [],
          updatedAt: "2026-07-31T12:00:00.000Z",
        },
      ],
    });

    const loaded = await adapter.loadDocument("page-1");
    loaded.title = "Updated";
    await adapter.saveDocument(loaded);

    await expect(adapter.listVersions("page-1")).resolves.toEqual([
      expect.objectContaining({ title: "Updated", pageId: "page-1" }),
    ]);
  });

  it("returns defensive copies and rejects missing records specifically", async () => {
    const adapter = createMemoryPlanePagesEditorAdapter({
      documents: [
        {
          id: "page-1",
          title: "Page",
          blocks: [{ id: "block-1", type: "paragraph", text: "Body" }],
          updatedAt: "2026-07-31T12:00:00.000Z",
        },
      ],
    });

    const first = await adapter.loadDocument("page-1");
    first.blocks[0].text = "Mutated";
    const second = await adapter.loadDocument("page-1");

    expect(second.blocks[0].text).toBe("Body");
    await expect(adapter.loadDocument("missing")).rejects.toBeInstanceOf(
      PlanePagesEditorAdapterError,
    );
  });
});
