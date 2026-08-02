import assert from "node:assert/strict";
import test from "node:test";
import { ForbiddenError } from "eve/channels/auth";
import { authenticateAlleatoRequest } from "../agent/lib/auth.js";

const assistantTurnId = "11111111-1111-4111-8111-111111111111";
const trustedSupabaseHeaders = {
  "x-alleato-supabase-url": "https://production.supabase.test",
  "x-alleato-supabase-anon-key": "production-anon-key",
} as const;

function configureSupabase() {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://supabase.test";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
  process.env.ALLEATO_EVE_PROXY_SECRET = "trusted-proxy-secret";
}

test("rejects a trusted proxy request without a user access token", async () => {
  configureSupabase();
  const result = await authenticateAlleatoRequest(
    new Request("https://alleato.test/eve/v1/session", {
      method: "POST",
      headers: {
        "x-alleato-eve-proxy-secret": "trusted-proxy-secret",
        ...trustedSupabaseHeaders,
      },
    }),
  );
  assert.equal(result, null);
});

test("validates a dedicated proxy-bound user token without inventing project context", async () => {
  configureSupabase();
  const originalFetch = globalThis.fetch;
  let authorization = "";
  let durableTurnUrl = "";
  const requestedUrls: string[] = [];

  globalThis.fetch = async (input, init) => {
    authorization = new Headers(init?.headers).get("authorization") ?? "";
    const url = String(input);
    requestedUrls.push(url);
    if (url.endsWith("/auth/v1/user")) {
      return Response.json({ id: "user-123", email: "eve@alleato.test" });
    }
    durableTurnUrl = url;
    return Response.json([
      { command_payload: { surface: "alleato_ai" } },
    ]);
  };

  try {
    const result = await authenticateAlleatoRequest(
      new Request("https://alleato.test/eve/v1/session", {
        method: "POST",
        headers: {
          "x-alleato-user-access-token": "signed-token",
          "x-assistant-turn-id": assistantTurnId,
          "x-alleato-assistant-surface": "ai_assistant",
          "x-alleato-eve-proxy-secret": "trusted-proxy-secret",
          ...trustedSupabaseHeaders,
        },
      }),
    );
    assert.deepEqual(result, {
      assistantTurnId,
      assistantSurface: "ai_assistant",
      email: "eve@alleato.test",
      id: "user-123",
    });
    assert.equal(authorization, "Bearer signed-token");
    assert.ok(
      requestedUrls.every((url) =>
        url.startsWith("https://production.supabase.test/"),
      ),
    );
    const durableQuery = new URL(durableTurnUrl).searchParams;
    assert.equal(durableQuery.get("id"), `eq.${assistantTurnId}`);
    assert.equal(durableQuery.get("user_id"), "eq.user-123");
    assert.equal(durableQuery.get("select"), "command_payload");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("prefers the proxy-bound user token over an ambient bearer header", async () => {
  configureSupabase();
  const originalFetch = globalThis.fetch;
  const authorizations: string[] = [];
  globalThis.fetch = async (input, init) => {
    authorizations.push(
      new Headers(init?.headers).get("authorization") ?? "",
    );
    return String(input).endsWith("/auth/v1/user")
      ? Response.json({ id: "user-123" })
      : Response.json([
          { command_payload: { surface: "alleato_ai" } },
        ]);
  };

  try {
    const result = await authenticateAlleatoRequest(
      new Request("https://alleato.test/eve/v1/session", {
        method: "POST",
        headers: {
          authorization: "Bearer ambient-token",
          "x-alleato-user-access-token": "proxy-bound-token",
          "x-assistant-turn-id": assistantTurnId,
          "x-alleato-assistant-surface": "ai_assistant",
          "x-alleato-eve-proxy-secret": "trusted-proxy-secret",
          ...trustedSupabaseHeaders,
        },
      }),
    );
    assert.equal(result?.id, "user-123");
    assert.ok(
      authorizations.every(
        (authorization) => authorization === "Bearer proxy-bound-token",
      ),
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

for (const proxySecret of [null, "wrong-proxy-secret"]) {
  test(`rejects bearer auth with ${proxySecret === null ? "missing" : "wrong"} Eve proxy secret`, async () => {
    configureSupabase();
    const originalFetch = globalThis.fetch;
    let fetchCalled = false;
    globalThis.fetch = async () => {
      fetchCalled = true;
      return Response.json({ id: "user-123" });
    };

    try {
      const headers: Record<string, string> = {
        authorization: "Bearer signed-token",
        "x-assistant-turn-id": assistantTurnId,
        "x-alleato-assistant-surface": "ai_assistant",
        ...trustedSupabaseHeaders,
      };
      if (proxySecret !== null) {
        headers["x-alleato-eve-proxy-secret"] = proxySecret;
      }
      await assert.rejects(
        authenticateAlleatoRequest(
          new Request("https://alleato.test/eve/v1/session", {
            method: "POST",
            headers,
          }),
        ),
        (error) =>
          error instanceof ForbiddenError &&
          error.response.status === 403,
      );
      assert.equal(fetchCalled, false);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
}

for (const forwardedHeaders of [
  {},
  { "x-alleato-supabase-url": "https://production.supabase.test" },
  { "x-alleato-supabase-anon-key": "production-anon-key" },
]) {
  test("fails closed when the trusted proxy omits its Supabase binding", async () => {
    configureSupabase();
    const originalFetch = globalThis.fetch;
    let fetchCalled = false;
    globalThis.fetch = async () => {
      fetchCalled = true;
      return Response.json({ id: "user-123" });
    };

    try {
      await assert.rejects(
        authenticateAlleatoRequest(
          new Request("https://alleato.test/eve/v1/session", {
            method: "POST",
            headers: {
              authorization: "Bearer signed-token",
              "x-assistant-turn-id": assistantTurnId,
              "x-alleato-assistant-surface": "ai_assistant",
              "x-alleato-eve-proxy-secret": "trusted-proxy-secret",
              ...forwardedHeaders,
            },
          }),
        ),
        /must bind the request to its Supabase runtime/,
      );
      assert.equal(fetchCalled, false);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
}

for (const invalidOrigin of [
  "http://production.supabase.test",
  "https://production.supabase.test/path",
]) {
  test(`rejects malformed trusted Supabase origin ${invalidOrigin}`, async () => {
    configureSupabase();
    const originalFetch = globalThis.fetch;
    let fetchCalled = false;
    globalThis.fetch = async () => {
      fetchCalled = true;
      return Response.json({ id: "user-123" });
    };

    try {
      await assert.rejects(
        authenticateAlleatoRequest(
          new Request("https://alleato.test/eve/v1/session", {
            method: "POST",
            headers: {
              authorization: "Bearer signed-token",
              "x-assistant-turn-id": assistantTurnId,
              "x-alleato-assistant-surface": "ai_assistant",
              "x-alleato-eve-proxy-secret": "trusted-proxy-secret",
              ...trustedSupabaseHeaders,
              "x-alleato-supabase-url": invalidOrigin,
            },
          }),
        ),
        /invalid Supabase origin/,
      );
      assert.equal(fetchCalled, false);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
}

test("stores a project ID only after a Supabase RLS read confirms access", async () => {
  configureSupabase();
  const originalFetch = globalThis.fetch;
  const requestedUrls: string[] = [];

  globalThis.fetch = async (input, init) => {
    const url = String(input);
    requestedUrls.push(url);
    assert.equal(
      new Headers(init?.headers).get("authorization"),
      "Bearer signed-token",
    );
    if (url.endsWith("/auth/v1/user")) {
      return Response.json({ id: "user-123" });
    }
    if (url.includes("/rest/v1/durable_ai_turns?")) {
      return Response.json([
        { command_payload: { surface: "ask_alleato" } },
      ]);
    }
    return Response.json([{ id: 43 }]);
  };

  try {
    const result = await authenticateAlleatoRequest(
      new Request("https://alleato.test/eve/v1/session", {
        method: "POST",
        headers: {
          authorization: "Bearer signed-token",
          "x-assistant-turn-id": assistantTurnId,
          "x-alleato-assistant-surface": "ask_alleato",
          "x-alleato-eve-proxy-secret": "trusted-proxy-secret",
          ...trustedSupabaseHeaders,
          "x-alleato-project-id": "43",
        },
      }),
    );
    assert.equal(result?.selectedProjectId, 43);
    assert.equal(result?.assistantSurface, "ask_alleato");
    assert.match(
      requestedUrls[2] ?? "",
      /\/rest\/v1\/projects\?.*id=eq\.43/,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

for (const projectId of ["", "0", "-1", "1.5", "abc", "9007199254740992"]) {
  test(`fails loudly for malformed project context ${JSON.stringify(projectId)}`, async () => {
    configureSupabase();
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (input) =>
      String(input).endsWith("/auth/v1/user")
        ? Response.json({ id: "user-123", email: "eve@alleato.test" })
        : Response.json([
            { command_payload: { surface: "alleato_ai" } },
          ]);

    try {
      await assert.rejects(
        authenticateAlleatoRequest(
          new Request("https://alleato.test/eve/v1/session", {
            method: "POST",
            headers: {
              authorization: "Bearer signed-token",
              "x-assistant-turn-id": assistantTurnId,
              "x-alleato-assistant-surface": "ai_assistant",
              "x-alleato-eve-proxy-secret": "trusted-proxy-secret",
              ...trustedSupabaseHeaders,
              "x-alleato-project-id": projectId,
            },
          }),
        ),
        (error) =>
          error instanceof ForbiddenError &&
          error.response.status === 403,
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
}

test("fails loudly when Supabase RLS cannot read the selected project", async () => {
  configureSupabase();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url.endsWith("/auth/v1/user")) {
      return Response.json({ id: "user-123" });
    }
    return url.includes("/rest/v1/durable_ai_turns?")
      ? Response.json([{ command_payload: { surface: "alleato_ai" } }])
      : Response.json([]);
  };

  try {
    await assert.rejects(
      authenticateAlleatoRequest(
        new Request("https://alleato.test/eve/v1/session", {
          method: "POST",
          headers: {
            authorization: "Bearer signed-token",
            "x-assistant-turn-id": assistantTurnId,
            "x-alleato-assistant-surface": "ai_assistant",
            "x-alleato-eve-proxy-secret": "trusted-proxy-secret",
            ...trustedSupabaseHeaders,
            "x-alleato-project-id": "43",
          },
        }),
      ),
      (error) =>
        error instanceof ForbiddenError &&
        error.response.status === 403,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("does not hide Supabase project authorization service failures", async () => {
  configureSupabase();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url.endsWith("/auth/v1/user")) {
      return Response.json({ id: "user-123" });
    }
    return url.includes("/rest/v1/durable_ai_turns?")
      ? Response.json([{ command_payload: { surface: "alleato_ai" } }])
      : new Response("database unavailable", { status: 503 });
  };

  try {
    await assert.rejects(
      authenticateAlleatoRequest(
        new Request("https://alleato.test/eve/v1/session", {
          method: "POST",
          headers: {
            authorization: "Bearer signed-token",
            "x-assistant-turn-id": assistantTurnId,
            "x-alleato-assistant-surface": "ai_assistant",
            "x-alleato-eve-proxy-secret": "trusted-proxy-secret",
            ...trustedSupabaseHeaders,
            "x-alleato-project-id": "43",
          },
        }),
      ),
      /project authorization check failed with HTTP 503/,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

for (const surface of [null, "", "asrs", "AI_ASSISTANT"]) {
  test(`fails loudly for invalid assistant surface ${JSON.stringify(surface)}`, async () => {
    configureSupabase();
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () =>
      Response.json({ id: "user-123", email: "eve@alleato.test" });

    try {
      const headers: Record<string, string> = {
        authorization: "Bearer signed-token",
        "x-assistant-turn-id": assistantTurnId,
        "x-alleato-eve-proxy-secret": "trusted-proxy-secret",
        ...trustedSupabaseHeaders,
      };
      if (surface !== null) {
        headers["x-alleato-assistant-surface"] = surface;
      }
      await assert.rejects(
        authenticateAlleatoRequest(
          new Request("https://alleato.test/eve/v1/session", {
            method: "POST",
            headers,
          }),
        ),
        (error) =>
          error instanceof ForbiddenError &&
          error.response.status === 403,
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
}

for (const turnId of [null, "", "not-a-turn-id"]) {
  test(`fails loudly for invalid durable turn ${JSON.stringify(turnId)}`, async () => {
    configureSupabase();
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => Response.json({ id: "user-123" });
    try {
      const headers: Record<string, string> = {
        authorization: "Bearer signed-token",
        "x-alleato-assistant-surface": "ai_assistant",
        "x-alleato-eve-proxy-secret": "trusted-proxy-secret",
        ...trustedSupabaseHeaders,
      };
      if (turnId !== null) headers["x-assistant-turn-id"] = turnId;
      await assert.rejects(
        authenticateAlleatoRequest(
          new Request("https://alleato.test/eve/v1/session", {
            method: "POST",
            headers,
          }),
        ),
        (error) =>
          error instanceof ForbiddenError &&
          error.response.status === 403,
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
}

test("rejects a nonexistent durable turn after bearer authentication", async () => {
  configureSupabase();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) =>
    String(input).endsWith("/auth/v1/user")
      ? Response.json({ id: "user-123" })
      : Response.json([]);

  try {
    await assert.rejects(
      authenticateAlleatoRequest(
        new Request("https://alleato.test/eve/v1/session", {
          method: "POST",
          headers: {
            authorization: "Bearer signed-token",
            "x-assistant-turn-id": assistantTurnId,
            "x-alleato-assistant-surface": "ai_assistant",
            "x-alleato-eve-proxy-secret": "trusted-proxy-secret",
            ...trustedSupabaseHeaders,
          },
        }),
      ),
      (error) =>
        error instanceof ForbiddenError &&
        error.response.status === 403,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("rejects a claimed surface that mismatches the durable turn payload", async () => {
  configureSupabase();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) =>
    String(input).endsWith("/auth/v1/user")
      ? Response.json({ id: "user-123" })
      : Response.json([
          { command_payload: { surface: "ask_alleato" } },
        ]);

  try {
    await assert.rejects(
      authenticateAlleatoRequest(
        new Request("https://alleato.test/eve/v1/session", {
          method: "POST",
          headers: {
            authorization: "Bearer signed-token",
            "x-assistant-turn-id": assistantTurnId,
            "x-alleato-assistant-surface": "ai_assistant",
            "x-alleato-eve-proxy-secret": "trusted-proxy-secret",
            ...trustedSupabaseHeaders,
          },
        }),
      ),
      (error) =>
        error instanceof ForbiddenError &&
        error.response.status === 403,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("reports durable turn authorization service failures specifically", async () => {
  configureSupabase();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) =>
    String(input).endsWith("/auth/v1/user")
      ? Response.json({ id: "user-123" })
      : new Response("database unavailable", { status: 503 });

  try {
    await assert.rejects(
      authenticateAlleatoRequest(
        new Request("https://alleato.test/eve/v1/session", {
          method: "POST",
          headers: {
            authorization: "Bearer signed-token",
            "x-assistant-turn-id": assistantTurnId,
            "x-alleato-assistant-surface": "ai_assistant",
            "x-alleato-eve-proxy-secret": "trusted-proxy-secret",
            ...trustedSupabaseHeaders,
          },
        }),
      ),
      /durable turn surface verification failed with HTTP 503/,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
