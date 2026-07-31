import { apiFetch } from "@/lib/api-client";

export interface StoredDrawingAnnotation {
  id: string;
  annotation_type: string;
  page: number;
  data: unknown;
}

export interface DrawingAnnotationStore {
  load(signal?: AbortSignal): Promise<StoredDrawingAnnotation[]>;
  create(input: Omit<StoredDrawingAnnotation, "id">): Promise<StoredDrawingAnnotation>;
  update(id: string, data: unknown): Promise<StoredDrawingAnnotation>;
  remove(id: string): Promise<void>;
}

export function createHttpDrawingAnnotationStore(
  projectId: string,
  drawingId: string,
): DrawingAnnotationStore {
  const url = `/api/projects/${projectId}/drawings/${drawingId}/annotations`;

  return {
    async load(signal) {
      const response = await apiFetch<{ annotations?: StoredDrawingAnnotation[] }>(url, {
        signal,
        cache: "no-store",
      });
      return response.annotations ?? [];
    },
    async create(input) {
      const response = await apiFetch<{ annotation: StoredDrawingAnnotation }>(url, {
        method: "POST",
        body: JSON.stringify(input),
      });
      return response.annotation;
    },
    async update(id, data) {
      const response = await apiFetch<{ annotation: StoredDrawingAnnotation }>(`${url}/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ data }),
      });
      return response.annotation;
    },
    async remove(id) {
      await apiFetch(`${url}/${id}`, { method: "DELETE" });
    },
  };
}

/** Test adapter: retains the same store contract without an HTTP runtime. */
export function createInMemoryDrawingAnnotationStore(
  initial: StoredDrawingAnnotation[] = [],
): DrawingAnnotationStore {
  const rows = new Map(initial.map((row) => [row.id, row]));
  let nextId = 1;

  return {
    async load() {
      return [...rows.values()];
    },
    async create(input) {
      const row: StoredDrawingAnnotation = { ...input, id: `annotation-${nextId++}` };
      rows.set(row.id, row);
      return row;
    },
    async update(id, data) {
      const existing = rows.get(id);
      if (!existing) throw new Error(`Drawing annotation ${id} was not found.`);
      const updated = { ...existing, data };
      rows.set(id, updated);
      return updated;
    },
    async remove(id) {
      if (!rows.delete(id)) throw new Error(`Drawing annotation ${id} was not found.`);
    },
  };
}
