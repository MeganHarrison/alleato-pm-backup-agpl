import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("Eve authenticated project context", () => {
  const hookSource = readFileSync(
    join(
      __dirname,
      "..",
      "..",
      "..",
      "hooks",
      "use-alleato-eve-chat.ts",
    ),
    "utf8",
  );

  it("sends selected project scope through a server-verifiable request header", () => {
    expect(hookSource).toContain(
      'host: "/api/ai-assistant/eve/proxy"',
    );
    expect(hookSource).toContain('headers: async () =>');
    expect(hookSource).toContain('"x-alleato-project-id"');
    expect(hookSource).toContain('"x-alleato-assistant-surface"');
    expect(hookSource).toContain("projectId > 0");
  });

  it("keeps the current path as a non-authoritative model context hint", () => {
    expect(hookSource).toContain("currentPath:");
    expect(hookSource).toContain("window.location.pathname");
  });
});
