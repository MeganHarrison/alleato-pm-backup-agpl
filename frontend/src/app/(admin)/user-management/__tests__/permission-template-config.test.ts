import { ALL_GRANULAR_FLAGS, ALL_MODULES } from "@/lib/permissions-shared";

import {
  PERMISSION_TEMPLATE_MODULES,
  PERMISSION_TEMPLATE_TOOLS,
} from "../permission-template-config";

describe("permission-template-config", () => {
  it("covers every supported permission module exactly once", () => {
    expect(
      PERMISSION_TEMPLATE_MODULES.map((tool) => tool.moduleKey).sort(),
    ).toEqual([...ALL_MODULES].sort());
  });

  it("maps every granular flag to exactly one tool", () => {
    expect(
      PERMISSION_TEMPLATE_TOOLS.flatMap((tool) => tool.granularFlags).sort(),
    ).toEqual([...ALL_GRANULAR_FLAGS].sort());
  });
});
