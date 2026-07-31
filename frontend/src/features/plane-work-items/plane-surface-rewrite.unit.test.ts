import fs from "node:fs";
import path from "node:path";

describe("Plane surface route-budget rewrite", () => {
  const frontendRoot = process.cwd();
  const nextConfig = fs.readFileSync(
    path.join(frontendRoot, "next.config.ts"),
    "utf8",
  );
  const rewritesBlock = nextConfig.slice(nextConfig.indexOf("async rewrites()"));
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
});
