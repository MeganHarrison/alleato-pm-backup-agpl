/**
 * Shared form/modal error handler.
 *
 * Converts API errors into user-facing toast messages that are:
 *   1. Specific — names what failed
 *   2. Actionable — tells the user what to do
 *   3. Status-aware — 409 ≠ 500 ≠ 403
 *
 * Usage:
 *   import { handleFormError } from "@/lib/handle-form-error";
 *
 *   try {
 *     await apiFetch("/api/projects/1/budget-codes", { method: "POST", body });
 *   } catch (error) {
 *     handleFormError(error, {
 *       entity: "budget code",        // what was being created/updated
 *       action: "create",             // "create" | "update" | "delete" | "load"
 *       duplicateMessage: 'Budget code "01-3128.L" already exists. Select it from the dropdown instead.',
 *     });
 *   }
 *
 * RULES — every call site MUST:
 *   1. Pass `entity` so the fallback message names the thing that failed
 *   2. Pass `duplicateMessage` for any create/update action on a uniquely-constrained resource
 *   3. Handle post-error UI (close modals, reset state) OUTSIDE this function
 *
 * This function ONLY handles the toast. It does NOT close modals, reset forms,
 * or navigate. The caller owns UI state changes after calling this.
 */

import { toast } from "sonner";
import { ApiError } from "@/lib/api-client";

type Action = "create" | "update" | "delete" | "load" | "save";

interface HandleFormErrorOptions {
  /** What entity was being acted on (e.g., "budget code", "change order", "drawing") */
  entity: string;
  /**
   * What action was being performed. The known verbs get a friendly gerund
   * ("creating", "saving"); any other descriptive string is used verbatim.
   */
  action: Action | (string & {});
  /**
   * Custom message for 409 Conflict. MUST be provided for any create/update
   * on a uniquely-constrained resource. Should name the specific duplicate
   * and tell the user what to do instead.
   */
  duplicateMessage?: string;
  /** Custom message for 403 Forbidden. Defaults to generic permission message. */
  permissionMessage?: string;
  /** Custom message for 404 Not Found. Defaults to generic not-found message. */
  notFoundMessage?: string;
  /** If true, returns the error info instead of showing a toast. For custom UI handling. */
  silent?: boolean;
}

interface FormErrorResult {
  /** The user-facing message that was (or would be) shown */
  message: string;
  /** HTTP status code, or 0 for non-API errors */
  status: number;
  /** Whether this was a conflict (duplicate) */
  isConflict: boolean;
  /** Whether this was an auth/permission issue */
  isAuthError: boolean;
}

const ACTION_VERBS: Record<Action, string> = {
  create: "creating",
  update: "updating",
  delete: "deleting",
  load: "loading",
  save: "saving",
};

function appendRequestId(message: string, requestId?: string): string {
  if (!requestId) return message;
  return `${message} Reference ID: ${requestId}.`;
}

export function handleFormError(
  error: unknown,
  options: HandleFormErrorOptions,
): FormErrorResult {
  const { entity, action, duplicateMessage, permissionMessage, notFoundMessage, silent } = options;
  const verb = ACTION_VERBS[action as Action] ?? action;

  let message: string;
  let status = 0;
  let isConflict = false;
  let isAuthError = false;

  if (error instanceof ApiError) {
    status = error.status;

    switch (error.status) {
      case 401:
        isAuthError = true;
        message = "Your session has expired. Please refresh the page and sign in again.";
        break;

      case 403:
        isAuthError = true;
        message =
          permissionMessage ??
          `You don't have permission to ${action} this ${entity}. Contact your project admin if you need access.`;
        break;

      case 404:
        message =
          notFoundMessage ??
          `This ${entity} was not found — it may have been deleted. Try refreshing the page.`;
        break;

      case 409:
        isConflict = true;
        message =
          duplicateMessage ??
          `This ${entity} already exists. Check for duplicates and try again.`;
        break;

      case 422:
        // Validation error — the API message is usually specific enough
        message = error.message || `Invalid data while ${verb} ${entity}. Check your inputs and try again.`;
        break;

      case 429:
        message = "Too many requests. Please wait a moment and try again.";
        break;

      default:
        if (error.status >= 500) {
          message = appendRequestId(
            `Something went wrong while ${verb} this ${entity}. Please try again. If the problem persists, contact support.`,
            error.requestId,
          );
          // Log server errors for debugging
          console.error(`[handleFormError] Server error ${verb} ${entity}:`, error.status, error.body);
        } else {
          // Use the API's own message for other 4xx errors, with a fallback
          message = appendRequestId(
            error.message || `Failed while ${verb} ${entity}. Please try again.`,
            error.requestId,
          );
        }
        break;
    }
  } else if (error instanceof TypeError && error.message === "Failed to fetch") {
    // Network error — no internet or server unreachable
    message = `Could not reach the server while ${verb} this ${entity}. Check your internet connection and try again.`;
    console.error(`[handleFormError] Network error ${verb} ${entity}:`, error);
  } else {
    // Unknown error — programmer mistake or unexpected throw
    message = `An unexpected error occurred while ${verb} this ${entity}. Please try again.`;
    console.error(`[handleFormError] Unexpected error ${verb} ${entity}:`, error);
  }

  const result: FormErrorResult = { message, status, isConflict, isAuthError };

  if (!silent) {
    toast.error(message);
  }

  return result;
}
