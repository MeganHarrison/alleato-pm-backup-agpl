/**
 * ESLint Rule: no-supabase-auth-getuser-in-api-routes
 *
 * Prevents server-side `supabase.auth.getUser()` (no arguments) inside API route
 * handlers (app/api/**). Use `getApiRouteUser()` from @/lib/supabase/server.
 *
 * Why this exists (see project_auth_seam_migration / incident 2026-06-26):
 * The argument-less `auth.getUser()` makes the SSR client refresh+ROTATE the
 * refresh token server-side. When many API routes run in parallel for one page,
 * they rotate the same refresh token concurrently; Supabase reads that as token
 * theft and REVOKES the whole session — users get logged out mid-session and
 * pages render while every live `getUser()` 403s for up to `jwt_exp` (1h).
 *
 * `getApiRouteUser()` decodes the cookie JWT in-process (zero network, no
 * rotation). The browser stays the single refresher, so the race cannot form.
 * It is also faster (no `/user` round-trip per call).
 *
 * Allowed:
 *   - `supabase.auth.getUser(token)` WITH an explicit bearer-token argument —
 *     this validates a provided token (e.g. Playwright) and does not rotate the
 *     cookie's refresh token.
 *   - Anything outside app/api/ (browser/client refresh is intentional).
 *   - Test files.
 *
 * @type {import('eslint').Rule.RuleModule}
 */
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow argument-less supabase.auth.getUser() in API routes — use getApiRouteUser()',
      category: 'Design System',
      recommended: true,
    },
    messages: {
      racingGetUser:
        'Use `getApiRouteUser()` from "@/lib/supabase/server" instead of `supabase.auth.getUser()` in API routes. ' +
        'Argument-less auth.getUser() rotates the refresh token server-side; parallel route calls trip Supabase reuse-detection ' +
        'and revoke the whole session. getApiRouteUser() decodes the cookie JWT in-process (no rotation, no race, faster). ' +
        'If you must validate an explicit bearer token, pass it: auth.getUser(token).',
    },
    schema: [],
  },

  create(context) {
    const filename = context.getFilename();

    if (!filename.includes('/app/api/')) {
      return {};
    }
    if (
      filename.includes('.test.') ||
      filename.includes('.spec.') ||
      filename.includes('/tests/') ||
      filename.includes('/__tests__/')
    ) {
      return {};
    }

    return {
      CallExpression(node) {
        const callee = node.callee;
        // match `<something>.auth.getUser(...)`
        if (
          callee.type !== 'MemberExpression' ||
          callee.property.type !== 'Identifier' ||
          callee.property.name !== 'getUser' ||
          callee.object.type !== 'MemberExpression' ||
          callee.object.property.type !== 'Identifier' ||
          callee.object.property.name !== 'auth'
        ) {
          return;
        }
        // Allow the explicit-bearer-token form: auth.getUser(token).
        if (node.arguments.length > 0) {
          return;
        }
        context.report({ node, messageId: 'racingGetUser' });
      },
    };
  },
};
