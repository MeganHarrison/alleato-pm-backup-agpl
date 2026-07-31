import { readFileSync } from "node:fs";
import { join } from "node:path";

const appDirectory = join(__dirname, "..");

describe("global overlay safe zone", () => {
  it("reserves launcher clearance in every canonical app shell", () => {
    const mainLayout = readFileSync(
      join(appDirectory, "(main)", "layout.tsx"),
      "utf8",
    );
    const tablesLayout = readFileSync(
      join(appDirectory, "(tables)", "layout.tsx"),
      "utf8",
    );
    const adminLayout = readFileSync(
      join(appDirectory, "(admin)", "admin-layout-client.tsx"),
      "utf8",
    );
    const globalStyles = readFileSync(
      join(appDirectory, "globals.css"),
      "utf8",
    );

    expect(mainLayout).toContain("global-overlay-safe-zone");
    expect(tablesLayout).toContain("global-overlay-safe-zone");
    expect(adminLayout).toContain("global-overlay-safe-zone");
    expect(globalStyles).toContain(
      "flex: 0 0 calc(8rem + env(safe-area-inset-bottom));",
    );
    expect(globalStyles).toContain("flex-basis: 6rem;");
  });
});
