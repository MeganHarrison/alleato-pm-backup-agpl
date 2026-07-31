/**
 * Network egress policy: SSRF IP classification, URL credential/secret
 * redaction, and the outbound egress gate used by fetchWithGuardrails.
 *
 * IP classifier and redaction helpers vendored from OpenClaw
 * (`packages/net-policy`, MIT License, (c) 2026 OpenClaw Foundation).
 */
export * from "./ip";
export * from "./redact-sensitive-url";
export * from "./url-userinfo";
export * from "./assert-url-allowed";
