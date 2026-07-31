#!/usr/bin/env node
import "dotenv/config";

const ACTIVE_BACKEND_URL = "https://alleato-backend-rbnj.onrender.com";
const backendUrl = (
  process.env.PYTHON_BACKEND_URL ||
  process.env.RENDER_BACKEND_URL ||
  process.env.BACKEND_URL ||
  ACTIVE_BACKEND_URL
).replace(/\/$/, "");
const timeoutMs = Number(process.env.DEEP_AGENTS_DOCS_WIKI_SMOKE_TIMEOUT_MS || 240000);
const adminApiKey = process.env.ADMIN_API_KEY;

const failures = [];

function fail(message) {
  failures.push(message);
}

async function postJson(path, payload, perRequestTimeoutMs = timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), perRequestTimeoutMs);
  const started = Date.now();
  try {
    const response = await fetch(`${backendUrl}${path}`, {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        "x-admin-api-key": adminApiKey,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const text = await response.text();
    let body = {};
    try {
      body = text ? JSON.parse(text) : {};
    } catch {
      body = { raw: text.slice(0, 1000) };
    }
    return {
      path,
      status: response.status,
      elapsedMs: Date.now() - started,
      body,
    };
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error(`${path} timed out after ${perRequestTimeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function detailBody(result) {
  if (result.body && typeof result.body.detail === "object" && result.body.detail !== null) {
    return result.body.detail;
  }
  return result.body ?? {};
}

function summarize(result) {
  const body = detailBody(result);
  const answer = String(body.answer || body.detail || body.raw || "");
  return {
    path: result.path,
    status: result.status,
    elapsedMs: result.elapsedMs,
    mode: body.mode ?? null,
    orchestrator: body.orchestrator ?? null,
    docsServer: body.docsServer ?? null,
    sourceCount: Array.isArray(body.sources) ? body.sources.length : 0,
    artifactCount: Array.isArray(body.artifacts) ? body.artifacts.length : 0,
    toolTrace: Array.isArray(body.toolTrace) ? body.toolTrace.slice(0, 2) : [],
    answerPreview: answer.slice(0, 500),
  };
}

function assertLlmWiki(result) {
  const body = detailBody(result);
  if (result.status !== 200) {
    fail(`LLM wiki smoke expected HTTP 200; found ${result.status}: ${JSON.stringify(body).slice(0, 500)}`);
    return;
  }
  if (body.mode !== "scaffold") {
    fail(`LLM wiki smoke expected mode=scaffold; found ${body.mode || "<missing>"}`);
  }
  if (body.orchestrator !== "alleato-llm-wiki-orchestrator") {
    fail(`LLM wiki smoke returned wrong orchestrator: ${body.orchestrator || "<missing>"}`);
  }
  if (!Array.isArray(body.artifacts) || body.artifacts.length < 3) {
    fail(`LLM wiki smoke expected at least 3 scaffold artifacts; found ${body.artifacts?.length ?? 0}`);
  }
  const firstTrace = Array.isArray(body.toolTrace) ? body.toolTrace[0] : null;
  if (firstTrace?.status !== "success") {
    fail(`LLM wiki smoke expected successful toolTrace; found ${firstTrace?.status || "<missing>"}`);
  }
}

function assertDocsResearch(result) {
  const body = detailBody(result);
  if (result.status !== 200) {
    fail(`Docs research smoke expected HTTP 200; found ${result.status}: ${JSON.stringify(body).slice(0, 500)}`);
    return;
  }
  if (body.mode !== "deep_agents") {
    fail(`Docs research smoke expected mode=deep_agents; found ${body.mode || "<missing>"}`);
  }
  if (body.orchestrator !== "alleato-docs-mcp-research-orchestrator") {
    fail(`Docs research smoke returned wrong orchestrator: ${body.orchestrator || "<missing>"}`);
  }
  if (body.docsServer !== "https://docs.langchain.com/mcp") {
    fail(`Docs research smoke expected docsServer=https://docs.langchain.com/mcp; found ${body.docsServer || "<missing>"}`);
  }
  if (!Array.isArray(body.sources) || body.sources.length < 1) {
    fail("Docs research smoke expected at least one docs source citation.");
  }
  const firstTrace = Array.isArray(body.toolTrace) ? body.toolTrace[0] : null;
  if (firstTrace?.status !== "success") {
    fail(`Docs research smoke expected successful toolTrace; found ${firstTrace?.status || "<missing>"}`);
  }
}

async function main() {
  if (!adminApiKey) {
    throw new Error("ADMIN_API_KEY is required for Deep Agents docs/wiki live smoke.");
  }
  if (!backendUrl.includes("alleato-backend-rbnj.onrender.com")) {
    throw new Error(`Refusing to smoke an unapproved backend URL: ${backendUrl}`);
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const wikiResult = await postJson(
    "/api/intelligence/deep-agent/llm-wiki",
    {
      userId: "codex-smoke",
      sessionId: `docs-wiki-smoke-${stamp}`,
      topic: "Codex Smoke Wiki",
      mode: "init",
    },
    60000,
  );
  assertLlmWiki(wikiResult);

  const docsResult = await postJson(
    "/api/intelligence/deep-agent/docs-research",
    {
      userId: "codex-smoke",
      sessionId: `docs-research-smoke-${stamp}`,
      question: "How do Deep Agents use MCP servers?",
      maxDocs: 2,
    },
    timeoutMs,
  );
  assertDocsResearch(docsResult);

  const summaries = [summarize(wikiResult), summarize(docsResult)];

  if (failures.length > 0) {
    console.error("Deep Agents docs/wiki live smoke failed:");
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    console.error(JSON.stringify(summaries, null, 2));
    process.exit(1);
  }

  console.log("Deep Agents docs/wiki live smoke passed");
  console.log(JSON.stringify(summaries, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
