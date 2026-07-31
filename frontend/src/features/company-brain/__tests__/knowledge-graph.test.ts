import { buildMockKnowledgeGraph } from "../lib/mock-knowledge-data";
import { transformToKnowledgeGraph } from "../lib/graph-transformers";
import { computeLayout, hash01 } from "../lib/graph-layout";
import { CATEGORY_META } from "../lib/graph-colors";
import { filterKnowledgeGraphByTimeRange } from "../hooks/use-knowledge-graph";

describe("buildMockKnowledgeGraph", () => {
  const graph = buildMockKnowledgeGraph();

  it("is deterministic for a given seed", () => {
    const a = buildMockKnowledgeGraph(42);
    const b = buildMockKnowledgeGraph(42);
    expect(JSON.stringify(a)).toEqual(JSON.stringify(b));
  });

  it("produces unique node ids", () => {
    const ids = new Set(graph.nodes.map((n) => n.id));
    expect(ids.size).toBe(graph.nodes.length);
  });

  it("covers all 12 categories with populated clusters", () => {
    CATEGORY_META.forEach((c) => {
      expect(graph.nodes.some((n) => n.type === c.type)).toBe(true);
    });
  });

  it("creates at least 75 relationships", () => {
    expect(graph.relationships.length).toBeGreaterThanOrEqual(75);
  });

  it("gives every node at least one relationship", () => {
    graph.nodes.forEach((n) => expect(n.relationshipCount).toBeGreaterThan(0));
  });

  it("uses meaningful titles (never 'Node N')", () => {
    graph.nodes.forEach((n) => expect(n.title).not.toMatch(/^node\s*\d+$/i));
  });

  it("keeps relationship endpoints referencing real nodes", () => {
    const ids = new Set(graph.nodes.map((n) => n.id));
    graph.relationships.forEach((r) => {
      expect(ids.has(r.sourceNodeId)).toBe(true);
      expect(ids.has(r.targetNodeId)).toBe(true);
    });
  });
});

describe("transformToKnowledgeGraph", () => {
  it("maps raw records + links and computes relationship counts", () => {
    const graph = transformToKnowledgeGraph(
      [
        { id: "a", type: "meeting", title: "Kickoff", createdAt: "2026-07-01T00:00:00Z" },
        { id: "b", type: "decision", title: "Go ESFR", createdAt: "2026-07-02T00:00:00Z" },
      ],
      [{ id: "l1", from: "a", to: "b", type: "generated" }],
    );
    expect(graph.nodes).toHaveLength(2);
    expect(graph.relationships).toHaveLength(1);
    expect(graph.nodes.find((n) => n.id === "a")?.relationshipCount).toBe(1);
  });

  it("drops links whose endpoints are missing", () => {
    const graph = transformToKnowledgeGraph(
      [{ id: "a", type: "meeting", title: "Kickoff", createdAt: "2026-07-01T00:00:00Z" }],
      [{ id: "l1", from: "a", to: "ghost", type: "related_to" }],
    );
    expect(graph.relationships).toHaveLength(0);
  });
});

describe("filterKnowledgeGraphByTimeRange", () => {
  const now = new Date("2026-07-20T12:00:00Z");
  const graph = transformToKnowledgeGraph(
    [
      { id: "recent", type: "meeting", title: "Recent", createdAt: "2026-07-20T08:00:00Z" },
      { id: "weekly", type: "decision", title: "Weekly", createdAt: "2026-07-16T12:00:00Z" },
      { id: "historic", type: "document", title: "Historic", createdAt: "2026-06-01T12:00:00Z" },
    ],
    [
      { id: "recent-weekly", from: "recent", to: "weekly", type: "related_to" },
      { id: "weekly-historic", from: "weekly", to: "historic", type: "related_to" },
    ],
  );

  it("filters records and relationships to the selected time range", () => {
    const filtered = filterKnowledgeGraphByTimeRange(graph, "7d", now);

    expect(filtered.nodes.map((node) => node.id)).toEqual(["recent", "weekly"]);
    expect(filtered.relationships.map((relationship) => relationship.id)).toEqual([
      "recent-weekly",
    ]);
    expect(filtered.nodes.find((node) => node.id === "recent")?.relationshipCount).toBe(1);
  });

  it("keeps the complete graph for live and all views", () => {
    expect(filterKnowledgeGraphByTimeRange(graph, "live", now)).toBe(graph);
    expect(filterKnowledgeGraphByTimeRange(graph, "all", now)).toBe(graph);
  });
});

describe("computeLayout", () => {
  const graph = buildMockKnowledgeGraph();
  const layout = computeLayout(graph, 1440, 820);

  it("creates one cluster per category", () => {
    expect(layout.clusters).toHaveLength(CATEGORY_META.length);
  });

  it("keeps cluster anchors inside the viewport bounds", () => {
    layout.clusters.forEach((c) => {
      expect(c.ax).toBeGreaterThanOrEqual(70);
      expect(c.ax).toBeLessThanOrEqual(1440 - 70);
      expect(c.ay).toBeGreaterThanOrEqual(104);
      expect(c.ay).toBeLessThanOrEqual(820 - 150);
    });
  });

  it("places every node", () => {
    graph.nodes.forEach((n) => expect(layout.placement.has(n.id)).toBe(true));
  });

  it("centers the brain", () => {
    expect(layout.cx).toBe(720);
    expect(layout.cy).toBe(410);
    expect(layout.brainR).toBeGreaterThan(0);
  });
});

describe("hash01", () => {
  it("is stable and within [0,1)", () => {
    expect(hash01("meeting-0")).toBe(hash01("meeting-0"));
    for (const s of ["a", "meeting-3", "rel-99", "x"]) {
      const v = hash01(s);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});
