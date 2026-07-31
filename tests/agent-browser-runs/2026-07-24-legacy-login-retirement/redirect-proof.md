# Legacy Login Redirect Proof

Date: 2026-07-24
Branch: `codex/retire-legacy-login-routes`
Local origin: `http://localhost:3017`

## HTTP Boundary

Both requests returned `307 Temporary Redirect` with the same canonical location:

```text
GET /auth/login-v2?callbackUrl=%2F983%2Fbudget%3Ftab%3Dcosts&source=bookmark&error=expired
GET /auth/login-v3?callbackUrl=%2F983%2Fbudget%3Ftab%3Dcosts&source=bookmark&error=expired

Location: /auth/login?callbackUrl=%2F983%2Fbudget%3Ftab%3Dcosts&source=bookmark&error=expired
```

This proves the callback, its nested query, and the additional `source` and `error` parameters are preserved.

## End-user Browser Boundary

`agent-browser` followed each legacy URL and reported:

```text
http://localhost:3017/auth/login?callbackUrl=%2F983%2Fbudget%3Ftab%3Dcosts&source=bookmark&error=expired
```

The resulting accessibility snapshot exposed the canonical controls: Email address, Password, Show password, Sign in, and Forgot your password.

- `browser/login-v2-canonical-redirect.png`
- `browser/login-v3-canonical-redirect.png`

Both screenshots were visually reviewed and render the canonical Alleato login page.
