import { http, HttpResponse } from "msw";

export const handlers = [
  // Projects list
  http.get("/api/projects", () => {
    return HttpResponse.json([
      { id: 67, name: "Vermillion Rise Warehouse", number: "PRJ-67", status: "active" },
      { id: 1009, name: "Union Collective", number: "PRJ-1009", status: "active" },
    ]);
  }),

  // Single project
  http.get("/api/projects/:projectId", ({ params }) => {
    return HttpResponse.json({
      id: Number(params.projectId),
      name: "Vermillion Rise Warehouse",
      number: "PRJ-67",
      status: "active",
    });
  }),

  // Budget
  http.get("/api/projects/:projectId/budget", () => {
    return HttpResponse.json({ items: [], total: 0 });
  }),

  // Contracts
  http.get("/api/projects/:projectId/contracts", () => {
    return HttpResponse.json({ contracts: [], total: 0 });
  }),

  // Commitments
  http.get("/api/projects/:projectId/commitments", () => {
    return HttpResponse.json({ commitments: [], total: 0 });
  }),

  // Generic fallback for unhandled API routes — return empty success
  http.get("/api/*", () => {
    return HttpResponse.json({});
  }),
];
