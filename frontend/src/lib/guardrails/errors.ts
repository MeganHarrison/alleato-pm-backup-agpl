import {
  getErrorCatalogEntry,
  type AlertSeverity,
  type ErrorCode,
} from "@/lib/guardrails/error-catalog";

export interface GuardrailErrorOptions {
  // ErrorCode is keyof ERROR_CATALOG. TypeScript surfaces unknown codes at
  // compile time so they can't fall through to INTERNAL_ERROR (500) at runtime.
  code: ErrorCode;
  where: string;
  message?: string;
  details?: unknown;
  cause?: unknown;
  severity?: AlertSeverity;
  status?: number;
}

export class GuardrailError extends Error {
  readonly code: ErrorCode;
  readonly where: string;
  readonly details?: unknown;
  readonly severity: AlertSeverity;
  readonly status: number;
  readonly safeToRetry: boolean;

  constructor(options: GuardrailErrorOptions) {
    const catalog = getErrorCatalogEntry(options.code);
    super(options.message ?? catalog.humanMessage);
    this.name = "GuardrailError";
    this.code = options.code;
    this.where = options.where;
    this.details = options.details;
    this.severity = options.severity ?? catalog.alertSeverity;
    this.status = options.status ?? catalog.httpStatus;
    this.safeToRetry = catalog.safeToRetry;
    if (options.cause !== undefined) {
      this.cause = options.cause;
    }
  }
}

export function asGuardrailError(
  error: unknown,
  fallback: Pick<GuardrailErrorOptions, "code" | "where">,
): GuardrailError {
  if (error instanceof GuardrailError) {
    return error;
  }

  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : error !== null &&
            typeof error === "object" &&
            "message" in error &&
            typeof (error as Record<string, unknown>).message === "string"
          ? // Supabase PostgrestError and similar plain-object errors with a message
            (error as Record<string, unknown>).message as string
          : "Unexpected error";

  return new GuardrailError({
    ...fallback,
    message,
    cause: error,
  });
}

