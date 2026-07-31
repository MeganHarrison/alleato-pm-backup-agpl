const SECRET_PATTERNS: RegExp[] = [
  /sk-[A-Za-z0-9_-]{16,}/g,
  /sk-proj-[A-Za-z0-9_-]{16,}/g,
  /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}/g,
  /(postgres(?:ql)?:\/\/)[^\s'"`]+/gi,
  /(SUPABASE_SERVICE_ROLE_KEY|AI_GATEWAY_API_KEY|OPENAI_API_KEY|ANTHROPIC_API_KEY|DATABASE_URL|RAG_DATABASE_URL)=([^\s]+)/gi,
  /([A-Za-z0-9_]*(?:TOKEN|SECRET|KEY|DSN)[A-Za-z0-9_]*["']?\s*[:=]\s*["']?)([^"'\s,}]+)/gi,
];

export function redact(value: unknown): unknown {
  if (typeof value === "string") return redactText(value);
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [
        key,
        isSecretKey(key) ? "[REDACTED]" : redact(entry),
      ]),
    );
  }
  return value;
}

export function redactText(input: string, maxLength = 4000): string {
  let output = input;
  for (const pattern of SECRET_PATTERNS) {
    output = output.replace(pattern, (match, prefix) => {
      if (typeof prefix === "string" && match.startsWith(prefix)) return `${prefix}[REDACTED]`;
      return "[REDACTED]";
    });
  }
  return output.length > maxLength ? `${output.slice(0, maxLength)}...[truncated]` : output;
}

function isSecretKey(key: string): boolean {
  return /(token|secret|key|dsn|password|database_url)/i.test(key);
}
