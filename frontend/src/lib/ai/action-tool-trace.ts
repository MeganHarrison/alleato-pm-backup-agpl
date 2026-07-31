const STRUCTURED_ACTION_OUTPUT_KEYS = [
  "action",
  "message",
  "success",
  "record",
  "receipt",
  "widget",
  "preview",
  "notificationDecision",
  "missingFields",
] as const;

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

function hasStructuredActionOutput(output: Record<string, unknown>): boolean {
  return STRUCTURED_ACTION_OUTPUT_KEYS.some((key) =>
    Object.prototype.hasOwnProperty.call(output, key),
  );
}

export function preserveActionToolTraceOutput(params: {
  rawOutput: unknown;
  summarizedOutput: Record<string, unknown>;
}): Record<string, unknown> {
  const output = asRecord(params.rawOutput);
  if (!hasStructuredActionOutput(output)) return params.summarizedOutput;

  const preserved = { ...params.summarizedOutput };
  for (const key of STRUCTURED_ACTION_OUTPUT_KEYS) {
    if (Object.prototype.hasOwnProperty.call(output, key)) {
      preserved[key] = output[key];
    }
  }

  return preserved;
}
