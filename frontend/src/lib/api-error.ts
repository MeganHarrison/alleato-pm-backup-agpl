import { getErrorCatalogEntry } from "@/lib/guardrails/error-catalog";
import { generateRequestId } from "@/lib/guardrails/observability";

/**
 * Classifies database/service errors into safe, user-facing responses.
 * Prevents leaking internal details (table names, constraints, etc.) to clients.
 */
export function classifyError(error: unknown): { message: string; status: number } {
  // Handle Error instances, Supabase PostgrestError objects (plain objects with .message), and strings
  const msg =
    error instanceof Error
      ? error.message
      : typeof error === "object" && error !== null && "message" in error
        ? String((error as { message: unknown }).message)
        : String(error);

  // Duplicate records
  if (msg.includes("duplicate key") || msg.includes("unique constraint")) {
    return { message: "A record with this information already exists.", status: 409 };
  }

  // Foreign key violations
  if (msg.includes("violates foreign key") || msg.includes("foreign key constraint")) {
    // Distinguish between INSERT/UPDATE (missing reference) and DELETE (still referenced)
    if (msg.includes("is still referenced") || msg.includes("update or delete on table")) {
      return { message: "Cannot delete: this record is still referenced by other records. Remove related items first.", status: 409 };
    }
    return { message: "Referenced record not found.", status: 400 };
  }

  // Not null violations - provide specific field context
  if (msg.includes("violates not-null") || msg.includes("not-null constraint")) {
    if (msg.includes("cost_type_id")) {
      return { message: "Cost type is required.", status: 400 };
    }
    if (msg.includes("cost_code_id")) {
      return { message: "Cost code is required.", status: 400 };
    }
    return { message: "Required fields are missing.", status: 400 };
  }

  // Check constraint violations
  if (msg.includes("violates check constraint")) {
    if (msg.includes("projects_delivery_method_check")) {
      return { message: "Delivery method is invalid. Choose a listed delivery method.", status: 400 };
    }
    if (msg.includes("projects_project_sector_check")) {
      return { message: "Project sector is invalid. Choose a listed project sector.", status: 400 };
    }
    if (msg.includes("projects_work_scope_check")) {
      return { message: "Work scope is invalid. Choose a listed work scope.", status: 400 };
    }
    return { message: "Invalid field value.", status: 400 };
  }

  // Bad date/time input
  if (msg.includes("invalid input syntax for type date") || msg.includes("date/time field value out of range")) {
    return { message: "Invalid date value. Provide a valid date or leave it empty.", status: 400 };
  }

  // Permission denied
  if (msg.includes("permission denied") || msg.includes("insufficient_privilege")) {
    return { message: "You do not have permission to perform this action.", status: 403 };
  }

  // Row-level security
  if (msg.includes("new row violates row-level security")) {
    return { message: "Access denied.", status: 403 };
  }

  // Not found
  if (msg.includes("PGRST116") || msg.includes("no rows")) {
    return { message: "Record not found.", status: 404 };
  }

  // Include the raw message in dev so errors are diagnosable
  const isDev = process.env.NODE_ENV === "development";
  const fallback = isDev
    ? `Server error: ${msg.slice(0, 200)}`
    : "An unexpected error occurred. Please try again.";
  return { message: fallback, status: 500 };
}

/**
 * Helper to create a JSON error response with classified error.
 * Always includes the raw error message in `details` so clients can display
 * actionable information instead of a generic fallback.
 */
export function apiErrorResponse(error: unknown): Response {
  const { message, status } = classifyError(error);
  const requestId = generateRequestId();
  // Always log the full error server-side for debugging
  console.error(
    JSON.stringify({
      event: "api_error_response",
      request_id: requestId,
      timestamp: new Date().toISOString(),
      status,
      where: "api-route",
      error:
        error instanceof Error ? error.message : typeof error === "string" ? error : "unknown",
    }),
  );

  // Extract raw message for the details field
  const rawMessage =
    error instanceof Error
      ? error.message
      : typeof error === "object" && error !== null && "message" in error
        ? String((error as { message: unknown }).message)
        : typeof error === "string"
          ? error
          : undefined;

  // Include raw message in details when it differs from the classified message
  // so the client can display something actionable.
  const details = rawMessage && rawMessage !== message ? rawMessage : undefined;

  const catalog = getErrorCatalogEntry("INTERNAL_ERROR");
  const responseBody = {
    success: false as const,
    error_code: catalog.code,
    error_message: message,
    where_it_failed: "api-route",
    request_id: requestId,
    timestamp: new Date().toISOString(),
    ...(details ? { details } : {}),
    // Backward compatibility for existing clients
    error: message,
  };

  return Response.json(responseBody, {
    status,
    headers: {
      "x-request-id": requestId,
    },
  });
}
