/**
 * ESLint Rule: require-api-client
 *
 * Prevents raw `fetch()` calls for API mutations in page/component files.
 * Use `apiFetch` from `@/lib/api-client` instead — it guarantees real error
 * messages are surfaced to users instead of generic "Failed to X" text.
 *
 * Raw fetch swallows error details because every caller has to manually:
 *   1. Check response.ok
 *   2. Parse JSON error body
 *   3. Extract error + details fields
 *   4. Throw a meaningful Error
 *
 * `apiFetch` does all of this automatically. One function, zero generic errors.
 *
 * Exemptions:
 *   - API route handlers (app/api/) — these ARE the server, not a client
 *   - lib/ utilities — may have special fetch needs (SSR, external APIs)
 *   - test files
 *   - External URL fetches (https://, http://)
 *
 * @type {import('eslint').Rule.RuleModule}
 */
module.exports = {
  meta: {
    type: "suggestion",
    docs: {
      description:
        'Require apiFetch() from @/lib/api-client instead of raw fetch() for API calls',
      category: "Design System",
      recommended: true,
    },
    messages: {
      rawFetch:
        'Use `apiFetch()` from "@/lib/api-client" instead of raw `fetch()`. ' +
        "apiFetch automatically parses API errors and surfaces real error messages " +
        "to users instead of generic fallbacks. See lib/api-client.ts.",
    },
    schema: [],
  },

  create(context) {
    const filename = context.getFilename();

    // Skip files that are exempt
    if (
      // API route handlers — they're the server side
      filename.includes("/app/api/") ||
      // Library utilities that may need raw fetch (SSR, external APIs, etc.)
      filename.includes("/lib/") ||
      // Test files
      filename.includes("/tests/") ||
      filename.includes(".test.") ||
      filename.includes(".spec.") ||
      // The api-client itself
      filename.includes("api-client") ||
      // Services (may call external APIs)
      filename.includes("/services/") ||
      // Admin/dev pages (non-user-facing)
      filename.includes("/(admin)/") ||
      filename.includes("/(chat)/")
    ) {
      return {};
    }

    return {
      // Match: fetch(`/api/...`)  or  fetch("/api/...")
      // i.e., calls to our own API routes
      CallExpression(node) {
        // Check if it's a call to `fetch`
        if (
          node.callee.type !== "Identifier" ||
          node.callee.name !== "fetch"
        ) {
          return;
        }

        // Must have at least one argument
        if (node.arguments.length === 0) return;

        const firstArg = node.arguments[0];

        // Check if the URL starts with /api/ (our internal API)
        // Handles: fetch("/api/..."), fetch(`/api/...`), fetch(someVar) — only flag string literals
        let isInternalApi = false;

        if (firstArg.type === "Literal" && typeof firstArg.value === "string") {
          isInternalApi = firstArg.value.startsWith("/api/");
        } else if (firstArg.type === "TemplateLiteral") {
          // Template literal: check if the first quasi starts with /api/
          const quasis = firstArg.quasis;
          if (quasis.length > 0 && quasis[0].value.raw.startsWith("/api/")) {
            isInternalApi = true;
          }
        }

        if (isInternalApi) {
          context.report({
            node,
            messageId: "rawFetch",
          });
        }
      },
    };
  },
};
