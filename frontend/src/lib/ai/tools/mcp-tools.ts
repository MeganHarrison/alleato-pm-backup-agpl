import { createMCPClient, type MCPClient } from "@ai-sdk/mcp";
import type { ToolSet } from "ai";
import {
  assistantMcpToolDescriptor,
  type AssistantMcpToolDescriptor,
} from "@/lib/ai/tool-descriptors";

type McpServerConfig = {
  name: string;
  url: string;
  authorization?: string;
  headers?: Record<string, string>;
  allowedTools?: string[];
};

type McpToolBundle = {
  tools: ToolSet;
  approvalRequiredToolNames: string[];
  trace: Record<string, unknown>[];
  close: () => Promise<void>;
};

type McpToolExposureOptions = {
  allowArtifactWrites?: boolean;
};

const MCP_CONNECT_TIMEOUT_MS = 8_000;
const EXCALIDRAW_MCP_SERVER_NAME = "excalidraw";
const EXCALIDRAW_MCP_SERVER_URL = "https://mcp.excalidraw.com/mcp";
const EXCALIDRAW_MCP_ALLOWED_TOOLS = [
  "read_me",
  "create_view",
  "export_to_excalidraw",
  "save_checkpoint",
  "read_checkpoint",
];

function parseJsonServerConfig(): McpServerConfig[] {
  const raw = process.env.AI_ASSISTANT_MCP_SERVERS;
  if (!raw?.trim()) return [];

  const parsed = JSON.parse(raw) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error("AI_ASSISTANT_MCP_SERVERS must be a JSON array.");
  }

  return parsed.map((server, index) => {
    if (!server || typeof server !== "object") {
      throw new Error(`AI_ASSISTANT_MCP_SERVERS[${index}] must be an object.`);
    }
    const value = server as Record<string, unknown>;
    const name = typeof value.name === "string" ? value.name.trim() : "";
    const url = typeof value.url === "string" ? value.url.trim() : "";
    if (!name || !url) {
      throw new Error(`AI_ASSISTANT_MCP_SERVERS[${index}] requires name and url.`);
    }

    const headers =
      value.headers && typeof value.headers === "object" && !Array.isArray(value.headers)
        ? Object.fromEntries(
            Object.entries(value.headers as Record<string, unknown>).filter(
              (entry): entry is [string, string] => typeof entry[1] === "string",
            ),
          )
        : undefined;

    return {
      name,
      url,
      authorization:
        typeof value.authorization === "string" ? value.authorization : undefined,
      headers,
      allowedTools: Array.isArray(value.allowedTools)
        ? value.allowedTools.filter((toolName): toolName is string => typeof toolName === "string")
        : undefined,
    };
  });
}

function getConfiguredMcpServers(): McpServerConfig[] {
  const servers = parseJsonServerConfig();
  const configuredServerNames = new Set(servers.map((server) => server.name));

  if (
    process.env.AI_ASSISTANT_DISABLE_EXCALIDRAW_MCP !== "true" &&
    !configuredServerNames.has(EXCALIDRAW_MCP_SERVER_NAME)
  ) {
    servers.push({
      name: EXCALIDRAW_MCP_SERVER_NAME,
      url: EXCALIDRAW_MCP_SERVER_URL,
      allowedTools: EXCALIDRAW_MCP_ALLOWED_TOOLS,
    });
  }

  const supabaseToken =
    process.env.SUPABASE_ACCESS_TOKEN ?? process.env.SUPABASE_MANAGEMENT_API_TOKEN;

  if (process.env.AI_ASSISTANT_DISABLE_SUPABASE_MCP !== "true" && supabaseToken) {
    servers.push({
      name: "supabase",
      url: "https://mcp.supabase.com/mcp?project_ref=lgveqfnpkxvzbnnwuled",
      authorization: supabaseToken,
    });
  }

  const linearUrl = process.env.LINEAR_MCP_SERVER_URL;
  const linearToken = process.env.LINEAR_MCP_TOKEN ?? process.env.LINEAR_API_KEY;
  if (linearUrl && linearToken) {
    servers.push({
      name: "linear",
      url: linearUrl,
      authorization: linearToken,
    });
  }

  return servers;
}

function descriptorForMcpTool(
  server: McpServerConfig,
  toolName: string,
): AssistantMcpToolDescriptor {
  return assistantMcpToolDescriptor({
    serverName: server.name,
    toolName,
    allowedTools: server.allowedTools,
  });
}

function shouldEnableMcpTool(server: McpServerConfig, toolName: string): boolean {
  return descriptorForMcpTool(server, toolName).enabled;
}

function prefixMcpTools(
  server: McpServerConfig,
  tools: ToolSet,
  options: McpToolExposureOptions = {},
): ToolSet {
  const allowArtifactWrites = options.allowArtifactWrites ?? true;
  return Object.fromEntries(
    Object.entries(tools).flatMap(([toolName, tool]) => {
      const descriptor = descriptorForMcpTool(server, toolName);
      const enabledForSurface =
        descriptor.enabled &&
        (allowArtifactWrites || descriptor.effect !== "allowlisted_artifact_write");
      return enabledForSurface ? [[descriptor.prefixedName, tool]] : [];
    }),
  ) as ToolSet;
}

function describeMcpToolExposure(
  server: McpServerConfig,
  tools: ToolSet,
): AssistantMcpToolDescriptor[] {
  return Object.keys(tools).map((toolName) =>
    descriptorForMcpTool(server, toolName),
  );
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

export async function createAiAssistantMcpTools(
  options: McpToolExposureOptions = {},
): Promise<McpToolBundle> {
  const servers = getConfiguredMcpServers();
  const clients: MCPClient[] = [];
  const trace: Record<string, unknown>[] = [];
  const tools: ToolSet = {};
  const approvalRequiredToolNames = new Set<string>();

  for (const server of servers) {
    try {
      const headers = {
        ...server.headers,
        ...(server.authorization
          ? { Authorization: `Bearer ${server.authorization}` }
          : {}),
      };
      const client = await withTimeout(
        createMCPClient({
          name: `alleato-ai-assistant-${server.name}`,
          transport: {
            type: "http",
            url: server.url,
            headers,
            redirect: "error",
          },
        }),
        MCP_CONNECT_TIMEOUT_MS,
        `${server.name} MCP connection`,
      );
      clients.push(client);

      const discoveredTools = await withTimeout(
        client.tools(),
        MCP_CONNECT_TIMEOUT_MS,
        `${server.name} MCP tool discovery`,
      );
      const safeTools = prefixMcpTools(server, discoveredTools as ToolSet, options);
      const descriptors = describeMcpToolExposure(
        server,
        discoveredTools as ToolSet,
      );
      Object.assign(tools, safeTools);
      for (const descriptor of descriptors) {
        if (
          descriptor.effect === "allowlisted_artifact_write" &&
          Object.prototype.hasOwnProperty.call(safeTools, descriptor.prefixedName)
        ) {
          approvalRequiredToolNames.add(descriptor.prefixedName);
        }
      }

      trace.push({
        tool: "mcpToolDiscovery",
        input: {
          server: server.name,
          url: server.url,
        },
        output: {
          discoveredToolCount: Object.keys(discoveredTools).length,
          enabledToolCount: Object.keys(safeTools).length,
          enabledTools: Object.keys(safeTools),
          allowArtifactWrites: options.allowArtifactWrites ?? true,
          enabledToolDescriptors: descriptors.filter(
            (descriptor) =>
              Object.prototype.hasOwnProperty.call(safeTools, descriptor.prefixedName),
          ),
          deniedToolDescriptors: descriptors.filter(
            (descriptor) =>
              !Object.prototype.hasOwnProperty.call(safeTools, descriptor.prefixedName),
          ),
          allowedTools: server.allowedTools,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      trace.push({
        tool: "mcpToolDiscovery",
        input: {
          server: server.name,
          url: server.url,
        },
        output: {
          error: error instanceof Error ? error.message : String(error),
        },
        timestamp: new Date().toISOString(),
      });
    }
  }

  return {
    tools,
    approvalRequiredToolNames: Array.from(approvalRequiredToolNames).sort(),
    trace,
    close: async () => {
      await Promise.allSettled(clients.map((client) => client.close()));
    },
  };
}

export const mcpToolPolicyForTests = {
  EXCALIDRAW_MCP_ALLOWED_TOOLS,
  getConfiguredMcpServers,
  descriptorForMcpTool,
  describeMcpToolExposure,
  prefixMcpTools,
  shouldEnableMcpTool,
};
