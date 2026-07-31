import {
  ASSISTANT_ACTION_CATALOG,
  buildAssistantActionCatalog,
} from "@/lib/ai/assistant-action-catalog";
import { GLOBAL_ASSISTANT_TOOL_REGISTRY } from "@/lib/ai/tool-registry";

function catalogItems() {
  return ASSISTANT_ACTION_CATALOG.flatMap((group) => group.items);
}

describe("assistant action catalog", () => {
  it("puts review and approval actions first in the command catalog", () => {
    expect(ASSISTANT_ACTION_CATALOG.map((group) => group.title)).toEqual([
      "Review and approve",
      "Create records",
      "Find evidence",
      "Reports and briefings",
      "Personalization",
      "Delivery",
    ]);
  });

  it("derives high-value actions from the assistant tool registry", () => {
    const items = catalogItems();

    expect(items.find((item) => item.toolName === "createRFI")).toMatchObject({
      label: "Draft an RFI",
      status: "preview_required",
      requiresApproval: true,
    });
    expect(
      items.find((item) => item.toolName === "getProjectBriefingSnapshot"),
    ).toMatchObject({
      label: "Project status report",
      status: "ready",
      requiresApproval: false,
    });
  });

  it("includes route actions without requiring registry tools", () => {
    const approvalsAction = catalogItems().find((item) => item.id === "openAiApprovals");
    const profileAction = catalogItems().find((item) => item.id === "openAiProfile");

    expect(approvalsAction).toMatchObject({
      label: "Review AI approvals",
      href: "/ai/approvals",
      toolName: null,
      status: "ready",
      requiresApproval: false,
    });
    expect(profileAction).toMatchObject({
      label: "Review my AI profile",
      href: "/ai/profile",
      toolName: null,
    });
  });

  it("keeps delivery actions preview-first", () => {
    const teamsAction = catalogItems().find(
      (item) => item.toolName === "sendTeamsMessage",
    );

    expect(teamsAction).toMatchObject({
      status: "preview_required",
      requiresApproval: true,
    });
  });

  it("fails loudly when catalog metadata references a missing registry tool", () => {
    const registryWithoutRfi = GLOBAL_ASSISTANT_TOOL_REGISTRY.filter(
      (entry) => entry.name !== "createRFI",
    );

    expect(() =>
      buildAssistantActionCatalog({ registry: registryWithoutRfi }),
    ).toThrow("AI action catalog metadata missing registry entry: createRFI");
  });
});
