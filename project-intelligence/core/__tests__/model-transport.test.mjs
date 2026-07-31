import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { callModel, getProviderConfigs, isProviderAvailabilityError } from "../model-transport.mjs";

describe("Project Intelligence model transport", () => {
  it("orders the gateway before the direct OpenAI fallback", () => {
    const providers = getProviderConfigs({
      model: "openai/gpt-5.6-terra",
      env: { AI_GATEWAY_API_KEY: "gateway", OPENAI_API_KEY: "direct" },
    });
    assert.deepEqual(providers.map((provider) => provider.name), ["ai_gateway", "openai_direct"]);
    assert.equal(providers[1].model, "gpt-5.6-terra");
  });

  it("fails loudly when no provider is configured", () => {
    assert.throws(() => getProviderConfigs({ env: {} }), /AI_GATEWAY_API_KEY or OPENAI_API_KEY/);
  });

  it("falls back only after an availability failure", async () => {
    const requests = [];
    const fetchImpl = async (url) => {
      requests.push(url);
      if (requests.length === 1) {
        return { ok: false, status: 429, text: async () => JSON.stringify({ error: { message: "quota" } }) };
      }
      return { ok: true, status: 200, text: async () => JSON.stringify({ choices: [{ message: { content: "  complete  " } }] }) };
    };
    const result = await callModel([{ role: "user", content: "test" }], {
      env: { AI_GATEWAY_API_KEY: "gateway", OPENAI_API_KEY: "direct" },
      fetchImpl,
      timeoutMs: 1000,
    });
    assert.equal(result, "complete");
    assert.equal(requests.length, 2);
  });

  it("passes an explicit JSON response format to the provider", async () => {
    let requestBody = null;
    const fetchImpl = async (_url, request) => {
      requestBody = JSON.parse(request.body);
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ choices: [{ finish_reason: "stop", message: { content: '{"ok":true}' } }] }),
      };
    };
    const responseFormat = {
      type: "json_schema",
      json_schema: {
        name: "transport_test",
        schema: {
          type: "object",
          properties: { ok: { type: "boolean" } },
          required: ["ok"],
          additionalProperties: false,
        },
      },
    };
    const result = await callModel([{ role: "user", content: "Return JSON" }], {
      env: { AI_GATEWAY_API_KEY: "gateway" },
      fetchImpl,
      responseFormat,
      returnMetadata: true,
      timeoutMs: 1000,
    });
    assert.deepEqual(requestBody.response_format, responseFormat);
    assert.deepEqual(result, {
      content: '{"ok":true}',
      provider: "ai_gateway",
      finishReason: "stop",
      usage: null,
    });
  });

  it("fails loudly when a provider returns no model content", async () => {
    const fetchImpl = async () => ({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ choices: [{ finish_reason: "length", message: { content: "" } }] }),
    });
    await assert.rejects(
      callModel([{ role: "user", content: "test" }], {
        env: { AI_GATEWAY_API_KEY: "gateway" },
        fetchImpl,
        timeoutMs: 1000,
      }),
      /empty content; finish_reason=length/,
    );
  });

  it("classifies auth, quota, server, and timeout errors as provider availability failures", () => {
    assert.equal(isProviderAvailabilityError(401, "unauthorized"), true);
    assert.equal(isProviderAvailabilityError(429, "rate limit"), true);
    assert.equal(isProviderAvailabilityError(503, "unavailable"), true);
    assert.equal(isProviderAvailabilityError(400, "invalid schema"), false);
  });
});
