import { GuardrailError } from "@/lib/guardrails/errors";
import { MarketingServiceError } from "@/lib/ai/services/marketing-service";

export function marketingError(error: unknown, where: string): GuardrailError {
  if (error instanceof MarketingServiceError) {
    return new GuardrailError({
      code: "DB_ERROR",
      where,
      message: error.message,
      details: {
        action: error.action,
        cause: error.causeMessage,
        prevention: error.prevention,
      },
    });
  }

  return new GuardrailError({
    code: "INTERNAL_ERROR",
    where,
    message: error instanceof Error ? error.message : "Marketing workflow failed.",
  });
}
