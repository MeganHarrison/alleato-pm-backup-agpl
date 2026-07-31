import fs from "node:fs";
import path from "node:path";

describe("Plane surface route-budget rewrite", () => {
  const frontendRoot = process.cwd();
  const nextConfig = fs.readFileSync(
    path.join(frontendRoot, "next.config.ts"),
    "utf8",
  );
  const rewritesBlock = nextConfig.slice(
    nextConfig.indexOf("async rewrites()"),
  );
  const tasksPage = fs.readFileSync(
    path.join(
      frontendRoot,
      "src",
      "app",
      "(main)",
      "[projectId]",
      "tasks",
      "page.tsx",
    ),
    "utf8",
  );
  const companyTasksPage = fs.readFileSync(
    path.join(frontendRoot, "src", "app", "(tables)", "tasks", "page.tsx"),
    "utf8",
  );
  const retiredRoutePage = path.join(
    frontendRoot,
    "src",
    "app",
    "(main)",
    "[projectId]",
    "plane",
    "[planeSurface]",
    "page.tsx",
  );

  it("rewrites Plane URLs into the existing Tasks route", () => {
    expect(rewritesBlock).toContain('source: "/:projectId/plane"');
    expect(rewritesBlock).toContain(
      'destination: "/:projectId/tasks?planeSurface=home"',
    );
    expect(rewritesBlock).toContain(
      'source: "/:projectId/plane/:planeSurface"',
    );
    expect(rewritesBlock).toContain(
      'destination: "/:projectId/tasks?planeSurface=:planeSurface"',
    );
  });

  it("dispatches rewritten surfaces without a second dynamic route boundary", () => {
    expect(fs.existsSync(retiredRoutePage)).toBe(false);
    expect(tasksPage).toContain("PlaneSurfaceDispatcher");
    expect(tasksPage).toContain("planeSurfaceParam");
  });

  it("keeps legacy project Tasks as the fallback outside Plane rewrites", () => {
    expect(tasksPage).toContain("TasksInboxClient");
    expect(tasksPage).toContain("if (planeSurface)");
    expect(tasksPage).toContain("<PlaneSurfaceDispatcher");
    expect(tasksPage).toContain("<TasksInboxClient");
    expect(tasksPage).not.toContain("redirect(");
  });

  it("leaves company-wide Tasks on the shared TasksInbox composition", () => {
    expect(companyTasksPage).toContain("import { TasksInbox }");
    expect(companyTasksPage).toContain("<TasksInbox />");
    expect(companyTasksPage).not.toContain("redirect(");
    expect(companyTasksPage).not.toContain("PlaneSurfaceDispatcher");
  });
});
