#!/usr/bin/env node

import { createMCPClient } from "../../frontend/node_modules/@ai-sdk/mcp/dist/index.mjs";

const EXCALIDRAW_MCP_URL = "https://mcp.excalidraw.com/mcp";
const EXPECTED_EXCALIDRAW_TOOLS = [
  "mcp_excalidraw_read_me",
  "mcp_excalidraw_create_view",
  "mcp_excalidraw_export_to_excalidraw",
  "mcp_excalidraw_save_checkpoint",
  "mcp_excalidraw_read_checkpoint",
].sort();

const client = await createMCPClient({
  name: "verify-ai-assistant-excalidraw-mcp",
  transport: {
    type: "http",
    url: EXCALIDRAW_MCP_URL,
    redirect: "error",
  },
});

try {
  const discoveredTools = await client.tools();
  const discoveredToolNames = Object.keys(discoveredTools).sort();
  const enabledTools = discoveredToolNames.map((toolName) => `mcp_excalidraw_${toolName}`).sort();
  const missing = EXPECTED_EXCALIDRAW_TOOLS.filter((toolName) => !enabledTools.includes(toolName));

  const result = {
    status: missing.length === 0 ? "pass" : "fail",
    checkedAt: new Date().toISOString(),
    endpoint: EXCALIDRAW_MCP_URL,
    expectedTools: EXPECTED_EXCALIDRAW_TOOLS,
    discoveredToolNames,
    enabledTools,
    missing,
    discoveredToolCount: discoveredToolNames.length,
    enabledToolCount: enabledTools.length,
  };

  const output = JSON.stringify(result, null, 2);
  if (missing.length > 0) {
    console.error(output);
    process.exitCode = 1;
  } else {
    console.log(output);
  }
} finally {
  await client.close();
}
