import { readFileSync } from "node:fs";
import { join } from "node:path";

const appDirectory = join(__dirname, "..");
const sourceDirectory = join(appDirectory, "..");

function readAppSource(relativePath: string) {
  return readFileSync(join(appDirectory, relativePath), "utf8");
}

describe("authenticated application boundary", () => {
  it("keeps authenticated infrastructure out of the global root layout", () => {
    const rootLayout = readAppSource("layout.tsx");
    const authenticatedOnlyImports = [
      "AuthenticatedAppProviders",
      "AppSessionTracker",
      "FavoritesProvider",
      "HeaderProvider",
      "NuqsAdapter",
      "PostHogProvider",
      "ProjectProvider",
      "QueryProvider",
      "RootClientWidgets",
      "SpeedInsights",
      "VeltAuthProvider",
    ];

    for (const importName of authenticatedOnlyImports) {
      expect(rootLayout).not.toContain(importName);
    }

    expect(rootLayout).toContain("ThemeProvider");
    expect(rootLayout).toContain("<Toaster />");
    expect(rootLayout).toContain("./globals.css");
  });

  it("owns the complete authenticated provider composition in one module", () => {
    const providerBoundary = readFileSync(
      join(
        sourceDirectory,
        "components",
        "providers",
        "authenticated-app-providers.tsx",
      ),
      "utf8",
    );
    const requiredProviders = [
      "AppSessionTracker",
      "FavoritesProvider",
      "HeaderProvider",
      "NuqsAdapter",
      "PostHogProvider",
      "ProjectProvider",
      "QueryProvider",
      "RootClientWidgets",
      "SpeedInsights",
      "VeltAuthProvider",
    ];

    for (const providerName of requiredProviders) {
      expect(providerBoundary).toContain(providerName);
    }
  });

  it.each([
    "(main)/layout.tsx",
    "(admin)/layout.tsx",
    "(tables)/layout.tsx",
    "(dashboard)/layout.tsx",
    "(developer)/layout.tsx",
    "daily-brief/layout.tsx",
    "weekly-operating-review/layout.tsx",
    "monthly-executive-operating-review/layout.tsx",
  ])(
    "wraps authenticated route layout %s with the shared boundary",
    (layout) => {
      const source = readAppSource(layout);

      expect(source).toContain("AuthenticatedAppProviders");
      expect(source).toContain("<AuthenticatedAppProviders");
    },
  );

  it("keeps auth and public route layouts outside the authenticated boundary", () => {
    expect(readAppSource("auth/layout.tsx")).not.toContain(
      "AuthenticatedAppProviders",
    );
    expect(readAppSource("(public)/layout.tsx")).not.toContain(
      "AuthenticatedAppProviders",
    );
  });
});
