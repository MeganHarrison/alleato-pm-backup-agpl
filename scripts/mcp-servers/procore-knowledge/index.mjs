#!/usr/bin/env node
/**
 * Procore Knowledge MCP Server
 *
 * Exposes 3 tools to Claude Code:
 *   - search_procore_docs     — semantic search over crawled Procore support articles
 *   - get_procore_manifest    — returns captured UI manifest for a specific tool
 *   - list_procore_manifests  — lists all tools that have manifests
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import { readFileSync, readdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MANIFESTS_DIR = join(__dirname, "../../..", ".claude/procore-manifests");

// ── Clients ─────────────────────────────────────────────────────────────────

const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  "https://lgveqfnpkxvzbnnwuled.supabase.co";

const SUPABASE_KEY =
  process.env.SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_KEY) {
  process.stderr.write("ERROR: No Supabase key found in environment\n");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  ...(process.env.AI_GATEWAY_API_KEY
    ? {
        apiKey: process.env.AI_GATEWAY_API_KEY,
        baseURL: "https://ai-gateway.vercel.sh/v1",
      }
    : {}),
});

// ── Embedding helper ─────────────────────────────────────────────────────────

async function embed(text) {
  const response = await openai.embeddings.create({
    model: "text-embedding-3-large",
    dimensions: 3072,
    input: text.substring(0, 8000),
  });
  return response.data[0].embedding;
}

// ── Tool implementations ─────────────────────────────────────────────────────

async function searchProcoreDocs({ query, match_count = 8, threshold = 0.3 }) {
  const embedding = await embed(query);

  const { data, error } = await supabase.rpc("search_support_articles", {
    query_embedding: embedding,
    match_count,
    match_threshold: threshold,
  });

  if (error) {
    return { error: `Search failed: ${error.message}` };
  }

  if (!data || data.length === 0) {
    return {
      results: [],
      message: "No matching Procore documentation found for this query.",
    };
  }

  const results = data.map((r, i) => ({
    rank: i + 1,
    title: r.title,
    heading: r.heading || null,
    category: r.category || null,
    subcategory: r.subcategory || null,
    url: r.url,
    similarity: Math.round(r.similarity * 1000) / 1000,
    text: r.chunk_text,
  }));

  return {
    query,
    total: results.length,
    results,
  };
}

function listProcoreManifests() {
  if (!existsSync(MANIFESTS_DIR)) {
    return { tools: [], message: "No manifests directory found." };
  }

  const tools = readdirSync(MANIFESTS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => {
      const manifestPath = join(MANIFESTS_DIR, d.name, "manifest.json");
      const hasManifest = existsSync(manifestPath);
      let summary = null;
      if (hasManifest) {
        try {
          const m = JSON.parse(readFileSync(manifestPath, "utf8"));
          summary = {
            capturedAt: m.capturedAt || m.captured_at || null,
            statesCount: m.states ? Object.keys(m.states).length : null,
          };
        } catch {
          // ignore parse errors
        }
      }
      return { slug: d.name, hasManifest, summary };
    });

  return { tools, total: tools.length };
}

function getProcoreManifest({ tool_slug, state = null }) {
  const manifestPath = join(MANIFESTS_DIR, tool_slug, "manifest.json");

  if (!existsSync(manifestPath)) {
    const available = listProcoreManifests().tools.map((t) => t.slug);
    return {
      error: `No manifest found for "${tool_slug}".`,
      available_tools: available,
    };
  }

  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));

  // If a specific state is requested, return just that state
  if (state && manifest.states) {
    if (!manifest.states[state]) {
      return {
        error: `State "${state}" not found in manifest.`,
        available_states: Object.keys(manifest.states),
      };
    }
    return {
      tool: tool_slug,
      state,
      data: manifest.states[state],
    };
  }

  // Return full manifest but trim large DOM snapshots to keep context manageable
  const trimmed = { ...manifest };
  if (trimmed.states) {
    const stateKeys = Object.keys(trimmed.states);
    trimmed.available_states = stateKeys;
    trimmed.tip = `Pass state="<name>" to get a single state. Available: ${stateKeys.join(", ")}`;
    // Include a condensed view of each state (fields/columns only, no raw HTML)
    trimmed.states_summary = {};
    for (const [key, val] of Object.entries(trimmed.states)) {
      trimmed.states_summary[key] = {
        formFields: val.formFields || val.form_fields || null,
        columns: val.columns || val.tableColumns || null,
        actions: val.actions || val.toolbar_actions || null,
        filters: val.filters || null,
      };
    }
    delete trimmed.states;
  }

  return { tool: tool_slug, manifest: trimmed };
}

// ── MCP Server ───────────────────────────────────────────────────────────────

const server = new Server(
  { name: "procore-knowledge", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "search_procore_docs",
      description:
        "Semantic search over crawled Procore support documentation. Use this to understand what Procore does for any feature, workflow, field, or UI pattern before writing code or auditing an implementation.",
      inputSchema: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description:
              "Natural language query, e.g. 'change event status workflow' or 'budget line item columns'",
          },
          match_count: {
            type: "number",
            description: "Number of results to return (default 8, max 20)",
            default: 8,
          },
          threshold: {
            type: "number",
            description: "Similarity threshold 0-1 (default 0.3)",
            default: 0.3,
          },
        },
        required: ["query"],
      },
    },
    {
      name: "list_procore_manifests",
      description:
        "List all Procore tools that have captured UI manifests (field-level snapshots from the live Procore app).",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "get_procore_manifest",
      description:
        "Get the captured UI manifest for a specific Procore tool. Manifests contain exact field names, form structure, columns, filters, and action buttons from the live Procore app — use this for gap analysis.",
      inputSchema: {
        type: "object",
        properties: {
          tool_slug: {
            type: "string",
            description:
              "Tool slug, e.g. 'change-events', 'change-orders', 'invoicing'",
          },
          state: {
            type: "string",
            description:
              "Optional: specific UI state to retrieve (e.g. 'list', 'create', 'detail'). Omit to get all states summary.",
          },
        },
        required: ["tool_slug"],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    let result;

    switch (name) {
      case "search_procore_docs":
        result = await searchProcoreDocs(args);
        break;
      case "list_procore_manifests":
        result = listProcoreManifests();
        break;
      case "get_procore_manifest":
        result = getProcoreManifest(args);
        break;
      default:
        return {
          content: [{ type: "text", text: `Unknown tool: ${name}` }],
          isError: true,
        };
    }

    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  } catch (err) {
    return {
      content: [{ type: "text", text: `Error: ${err.message}` }],
      isError: true,
    };
  }
});

// ── Start ────────────────────────────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);
process.stderr.write("Procore Knowledge MCP server running\n");
