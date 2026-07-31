import type { ErrorCode } from "@/lib/guardrails/error-catalog";
import { GuardrailError } from "@/lib/guardrails/errors";

type ScheduleRpcError = {
  code?: string | null;
  message: string;
};

const EXPECTED_VALIDATION_SQLSTATES = new Set([
  "22001",
  "22003",
  "22007",
  "22023",
  "23503",
  "23514",
  "54000",
]);

export function throwScheduleRequestError(
  where: string,
  message: string,
  options: { code?: ErrorCode; status?: number; cause?: unknown } = {},
): never {
  throw new GuardrailError({
    code: options.code ?? "INVALID_PAYLOAD",
    where,
    message,
    status: options.status,
    cause: options.cause,
  });
}

export function throwScheduleDatabaseError(where: string, error: ScheduleRpcError): never {
  throw new GuardrailError({
    code: "DB_ERROR",
    where,
    message: error.message,
    cause: error,
  });
}

export function throwScheduleRpcError(where: string, error: ScheduleRpcError): never {
  if (error.code === "42501") {
    throwScheduleRequestError(where, error.message, { code: "AUTH_FORBIDDEN", status: 403, cause: error });
  }
  if (error.code === "P0002") {
    throwScheduleRequestError(where, error.message, { code: "NOT_FOUND", status: 404, cause: error });
  }
  if (error.code === "23505") {
    throwScheduleRequestError(where, error.message, { code: "PRECONDITION_FAILED", status: 409, cause: error });
  }
  if (error.code === "40001") {
    throwScheduleRequestError(where, error.message, { code: "PRECONDITION_FAILED", status: 409, cause: error });
  }
  if (error.code && EXPECTED_VALIDATION_SQLSTATES.has(error.code)) {
    throwScheduleRequestError(where, error.message, { cause: error });
  }
  throwScheduleDatabaseError(where, error);
}
