#!/usr/bin/env node
// UserPromptSubmit hook: make authenticated browser readiness a first action,
// not a late excuse after a raw browser command has reached /auth/login.

let raw = "";
process.stdin.on("data", (chunk) => (raw += chunk));
process.stdin.on("end", () => {
  let prompt = "";
  try {
    prompt = JSON.parse(raw).prompt ?? "";
  } catch {
    prompt = raw;
  }

  const browserSignals = /\b(browser|agent-browser|screenshot|visual|responsive|e2e|end[ -]?to[ -]?end|user journey|frontend proof|localhost)\b/i;
  if (browserSignals.test(prompt)) {
    process.stdout.write(
      [
        "=== AUTHENTICATED BROWSER READINESS (auto-injected) ===",
        "For an Alleato protected route, do not begin with raw `agent-browser open`.",
        "Run before the first browser navigation:",
        "npm run verify:browser-auth -- --base-url <origin> --route <canonical-route> --session <task>-auth-preflight",
        "This refreshes env-backed test auth, clears stale daemon state, loads the correct origin state, and proves the route did not redirect to /auth/login.",
        "A raw /auth/login redirect is not an auth blocker. Only the preflight may establish one, after its built-in retry.",
      ].join("\n") + "\n",
    );
  }
});
