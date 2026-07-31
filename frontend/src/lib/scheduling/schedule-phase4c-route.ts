import { GuardrailError } from "@/lib/guardrails/errors";
import { ScheduleResourceServiceError } from "@/lib/services/schedule-resource-service";
import {
  throwScheduleDatabaseError,
  throwScheduleRequestError,
  throwScheduleRpcError,
} from "@/lib/scheduling/schedule-route-errors";
import { getApiRouteUser } from "@/lib/supabase/server";

export async function requireScheduleApiUser(where: string) {
  const user = await getApiRouteUser();
  if (!user) {
    throw new GuardrailError({ code: "AUTH_EXPIRED", where, message: "Authentication required." });
  }
  return user;
}

export function rethrowPhase4cServiceError(where: string, error: ScheduleResourceServiceError): never {
  if (error.operation === "rpc" && error.databaseError) throwScheduleRpcError(where, error.databaseError);
  if (error.databaseError) throwScheduleDatabaseError(where, error.databaseError);
  throwScheduleRequestError(where, error.message, { code: "PRECONDITION_FAILED", status: 409, cause: error });
}
