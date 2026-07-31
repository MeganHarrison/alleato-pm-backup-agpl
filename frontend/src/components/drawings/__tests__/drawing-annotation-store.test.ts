import { createInMemoryDrawingAnnotationStore } from "../drawing-annotation-store";

describe("in-memory drawing annotation store", () => {
  it("retains the production store contract across create, update, load, and remove", async () => {
    const store = createInMemoryDrawingAnnotationStore();
    const created = await store.create({
      annotation_type: "rectangle",
      page: 1,
      data: { page_percent: true, start: { x: 10, y: 10 }, end: { x: 20, y: 20 } },
    });

    expect(await store.load()).toEqual([created]);

    const updated = await store.update(created.id, { page_percent: true, start: { x: 15, y: 15 } });
    expect(updated.data).toEqual({ page_percent: true, start: { x: 15, y: 15 } });

    await store.remove(created.id);
    await expect(store.load()).resolves.toEqual([]);
  });

  it("fails loudly when an update or delete targets a missing annotation", async () => {
    const store = createInMemoryDrawingAnnotationStore();

    await expect(store.update("missing", {})).rejects.toThrow("Drawing annotation missing was not found.");
    await expect(store.remove("missing")).rejects.toThrow("Drawing annotation missing was not found.");
  });
});
