/**
 * ESLint Rule: no-external-fetch-in-api-routes
 *
 * Prevents raw `fetch()` calls to external HTTP/HTTPS URLs inside API route
 * handlers (app/api/**). Use `fetchWithGuardrails` from @/lib/fetch-with-guardrails.
 *
 * Raw fetch to external services has four failure modes that cost real money:
 *   1. No timeout  — a hung external service hangs your serverless function until
 *      the platform kills it (300s default), burning CPU time and blocking requests.
 *   2. No retry    — transient failures (network blips, cold starts) cause user-
 *      visible errors instead of transparent recovery.
 *   3. No request-ID propagation — errors in external services cannot be correlated
 *      back to the originating user request in logs.
 *   4. No structured error output — raw fetch errors appear as generic "fetch failed"
 *      with no actionable detail for on-call.
 *
 * fetchWithGuardrails adds all four automatically.
 *
 * Exemptions:
 *   - lib/ utilities (may have intentional raw fetch for specific SSR/proxy needs)
 *   - The fetch-with-guardrails implementation itself
 *   - Test files
 *   - Internal /api/ calls (already covered by require-api-client)
 *
 * @type {import('eslint').Rule.RuleModule}
 */
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow raw fetch() to external URLs in API routes — use fetchWithGuardrails',
      category: 'Design System',
      recommended: true,
    },
    messages: {
      rawExternalFetch:
        'Use `fetchWithGuardrails` from "@/lib/fetch-with-guardrails" instead of raw `fetch()` for external service calls. ' +
        'Raw fetch has no timeout (hangs forever), no retry, no request-ID propagation, and no structured error output. ' +
        'fetchWithGuardrails adds all four.',
    },
    schema: [],
  },

  create(context) {
    const filename = context.getFilename();

    // Only enforce inside API route handlers
    if (!filename.includes('/app/api/')) {
      return {};
    }

    // Exempt the guardrails implementation itself and test files
    if (
      filename.includes('fetch-with-guardrails') ||
      filename.includes('.test.') ||
      filename.includes('.spec.') ||
      filename.includes('/tests/')
    ) {
      return {};
    }

    function isExternalUrl(value) {
      return (
        typeof value === 'string' &&
        (value.startsWith('http://') || value.startsWith('https://'))
      );
    }

    function isExternalTemplateStart(quasis) {
      if (!quasis || quasis.length === 0) return false;
      const raw = quasis[0].value.raw;
      return raw.startsWith('http://') || raw.startsWith('https://');
    }

    return {
      CallExpression(node) {
        if (
          node.callee.type !== 'Identifier' ||
          node.callee.name !== 'fetch'
        ) {
          return;
        }

        if (node.arguments.length === 0) return;

        const firstArg = node.arguments[0];
        let isExternal = false;

        if (firstArg.type === 'Literal') {
          isExternal = isExternalUrl(firstArg.value);
        } else if (firstArg.type === 'TemplateLiteral') {
          isExternal = isExternalTemplateStart(firstArg.quasis);
        }

        if (isExternal) {
          context.report({ node, messageId: 'rawExternalFetch' });
        }
      },
    };
  },
};
