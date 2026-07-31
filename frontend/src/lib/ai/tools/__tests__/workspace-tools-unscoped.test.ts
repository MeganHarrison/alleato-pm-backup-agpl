import { z } from "zod";

import { listArtifacts } from "@/lib/ai/services/workspace-artifact-service";
import { createWorkspaceTools } from "../workspace-tools";

jest.mock("ai", () => ({
  tool: (definition: unknown) => definition,
}));

jest.mock("@/lib/ai/services/workspace-artifact-service", () => ({
  archiveArtifact: jest.fn(),
  createArtifact: jest.fn(),
  getArtifact: jest.fn(),
  listArtifacts: jest.fn(),
  promoteArtifact: jest.fn(),
  searchArtifacts: jest.fn(),
  updateArtifact: jest.fn(),
}));

describe("listWorkspaceArtifacts", () => {
  it("advertises provider-safe nullable filters", () => {
    const tools = createWorkspaceTools(
      "00000000-0000-4000-8000-000000000001",
    );
    const schema = z.toJSONSchema(
      tools.listWorkspaceArtifacts.inputSchema as z.ZodType,
    );

    expect(schema.required).toEqual([
      "projectId",
      "artifactType",
      "status",
      "limit",
    ]);
    expect(schema.properties?.projectId).toEqual(
      expect.objectContaining({ default: null }),
    );
    expect(schema.properties?.artifactType).toEqual(
      expect.objectContaining({ default: null }),
    );
    expect(schema.properties?.status).toEqual(
      expect.objectContaining({ default: null }),
    );
  });

  it("keeps an explicit null project filter unscoped when runtime options include a pinned project", async () => {
    const onTrace = jest.fn();
    const tools = createWorkspaceTools(
      "00000000-0000-4000-8000-000000000001",
      { onTrace, pinnedProjectId: 25125 },
    );
    jest.mocked(listArtifacts).mockResolvedValue([]);

    await tools.listWorkspaceArtifacts.execute?.(
      {
        projectId: null,
        artifactType: null,
        status: null,
        limit: 10,
      },
      { toolCallId: "workspace-list-unscoped", messages: [] },
    );

    expect(listArtifacts).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: undefined }),
    );
    expect(onTrace).toHaveBeenCalledWith(
      expect.objectContaining({
        tool: "listWorkspaceArtifacts",
        input: expect.objectContaining({ projectId: null }),
      }),
    );
  });
});
