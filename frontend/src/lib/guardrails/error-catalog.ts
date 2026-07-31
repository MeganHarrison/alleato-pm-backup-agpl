export type AlertSeverity = "critical" | "high" | "medium" | "low";

export interface ErrorCatalogEntry {
  code: string;
  humanMessage: string;
  typicalCause: string;
  preventionRule: string;
  alertSeverity: AlertSeverity;
  httpStatus: number;
  safeToRetry: boolean;
}

// `as const satisfies` so the keys form a string-literal union (ErrorCode below)
// while still type-checking each entry against ErrorCatalogEntry. Add new codes
// here — DO NOT throw a GuardrailError with a string code that isn't in this
// object, or the wrapper will fall back to INTERNAL_ERROR (500). The
// code-catalog-coverage.test.ts regression test enforces this.
export const ERROR_CATALOG = {
  AUTH_EXPIRED: {
    code: "AUTH_EXPIRED",
    humanMessage: "Authentication expired. Sign in again and retry.",
    typicalCause: "Session token is missing, invalid, or expired.",
    preventionRule: "Validate auth at route entry and refresh tokens before expiry.",
    alertSeverity: "medium",
    httpStatus: 401,
    safeToRetry: true,
  },
  // Routes that semantically distinguish "no session at all" from "session
  // existed but expired" use UNAUTHORIZED. Both map to HTTP 401 — never let
  // either fall through to 500.
  UNAUTHORIZED: {
    code: "UNAUTHORIZED",
    humanMessage: "Authentication required.",
    typicalCause: "Request arrived with no valid session/bearer credential.",
    preventionRule: "Validate auth at route entry before any other work.",
    alertSeverity: "medium",
    httpStatus: 401,
    safeToRetry: true,
  },
  AUTH_FORBIDDEN: {
    code: "AUTH_FORBIDDEN",
    humanMessage: "You do not have permission to perform this action.",
    typicalCause: "Authenticated user is missing required role/scope.",
    preventionRule: "Apply role/permission checks at route entry and return explicit denial.",
    alertSeverity: "medium",
    httpStatus: 403,
    safeToRetry: false,
  },
  MISSING_ENV_VAR: {
    code: "MISSING_ENV_VAR",
    humanMessage: "Service configuration is incomplete.",
    typicalCause: "Required environment variable is not set at runtime.",
    preventionRule: "Run startup env validation and block boot on missing vars.",
    alertSeverity: "high",
    httpStatus: 500,
    safeToRetry: false,
  },
  INVALID_PAYLOAD: {
    code: "INVALID_PAYLOAD",
    humanMessage: "Request payload is invalid.",
    typicalCause: "Input failed required field, type, range, or enum validation.",
    preventionRule: "Apply schema validation at every API entry point.",
    alertSeverity: "low",
    httpStatus: 400,
    safeToRetry: false,
  },
  UPSTREAM_TIMEOUT: {
    code: "UPSTREAM_TIMEOUT",
    humanMessage: "Upstream service timed out.",
    typicalCause: "External service did not respond within timeout.",
    preventionRule: "Use timeout + retry + backoff wrapper for all outbound calls.",
    alertSeverity: "high",
    httpStatus: 504,
    safeToRetry: true,
  },
  UPSTREAM_FAILURE: {
    code: "UPSTREAM_FAILURE",
    humanMessage: "Upstream dependency failed.",
    typicalCause: "Third-party API returned a server error or unexpected payload.",
    preventionRule: "Normalize third-party failures and add contract checks.",
    alertSeverity: "high",
    httpStatus: 502,
    safeToRetry: true,
  },
  SCHEMA_MISMATCH: {
    code: "SCHEMA_MISMATCH",
    humanMessage: "Schema or contract mismatch detected.",
    typicalCause: "Response contract changed or DB schema differs from expected types.",
    preventionRule: "Run contract tests and schema validation in quality gate.",
    alertSeverity: "critical",
    httpStatus: 500,
    safeToRetry: false,
  },
  ROUTE_BINDING_MISSING: {
    code: "ROUTE_BINDING_MISSING",
    humanMessage: "Endpoint route binding is missing.",
    typicalCause: "Route file/path naming conflict or route was removed.",
    preventionRule: "Run route audit and smoke tests on deploy.",
    alertSeverity: "high",
    httpStatus: 404,
    safeToRetry: false,
  },
  DB_MIGRATION_MISMATCH: {
    code: "DB_MIGRATION_MISMATCH",
    humanMessage: "Database migration mismatch detected.",
    typicalCause: "App expects columns/tables not applied in current environment.",
    preventionRule: "Validate migrations in pre-deploy and block release on mismatch.",
    alertSeverity: "critical",
    httpStatus: 500,
    safeToRetry: false,
  },
  INTERNAL_ERROR: {
    code: "INTERNAL_ERROR",
    humanMessage: "Unexpected server error.",
    typicalCause: "Unhandled exception in route, job, or workflow step.",
    preventionRule: "Wrap handlers in universal error guardrail wrapper.",
    alertSeverity: "high",
    httpStatus: 500,
    safeToRetry: false,
  },
  /** @deprecated Use AUTH_FORBIDDEN */
  FORBIDDEN: {
    code: "FORBIDDEN",
    humanMessage: "You do not have permission to perform this action.",
    typicalCause: "Authenticated user is missing required role/scope.",
    preventionRule: "Apply role/permission checks at route entry and return explicit denial.",
    alertSeverity: "medium",
    httpStatus: 403,
    safeToRetry: false,
  },
  /** @deprecated Use INVALID_PAYLOAD */
  VALIDATION_ERROR: {
    code: "VALIDATION_ERROR",
    humanMessage: "Request validation failed.",
    typicalCause: "Required field is missing or value failed type/range validation.",
    preventionRule: "Validate all required fields at the API entry point before processing.",
    alertSeverity: "low",
    httpStatus: 400,
    safeToRetry: false,
  },
  NOT_FOUND: {
    code: "NOT_FOUND",
    humanMessage: "The requested resource was not found.",
    typicalCause: "Record ID does not exist, was deleted, or belongs to a different user.",
    preventionRule: "Verify resource existence before returning and scope queries to the authenticated user.",
    alertSeverity: "low",
    httpStatus: 404,
    safeToRetry: false,
  },
  DB_ERROR: {
    code: "DB_ERROR",
    humanMessage: "Database operation failed.",
    typicalCause: "Constraint violation, connection error, or unexpected DB response.",
    preventionRule: "Validate data before mutations and monitor DB health metrics.",
    alertSeverity: "high",
    httpStatus: 500,
    safeToRetry: false,
  },
  NOT_IMPLEMENTED: {
    code: "NOT_IMPLEMENTED",
    humanMessage: "This action is not wired to a real implementation.",
    typicalCause: "A route or UI action was added before the backing workflow existed.",
    preventionRule: "Do not return success for placeholder behavior; ship the implementation or block explicitly.",
    alertSeverity: "high",
    httpStatus: 501,
    safeToRetry: false,
  },
  // Codes below are in active use across api/ routes. Each route also passes
  // an explicit `status:` override, but registering them here ensures they
  // pass type checking AND surface in the error catalog for monitoring.
  /** @deprecated Use DB_ERROR */
  DATABASE_ERROR: {
    code: "DATABASE_ERROR",
    humanMessage: "Database operation failed.",
    typicalCause: "Constraint violation, connection error, or unexpected DB response.",
    preventionRule: "Validate data before mutations and monitor DB health metrics.",
    alertSeverity: "high",
    httpStatus: 500,
    safeToRetry: false,
  },
  DB_INSERT_FAILED: {
    code: "DB_INSERT_FAILED",
    humanMessage: "Could not save the record.",
    typicalCause: "Unique violation, FK violation, or RLS policy denial on INSERT.",
    preventionRule: "Pre-validate uniqueness and FK targets; check RLS policies in tests.",
    alertSeverity: "high",
    httpStatus: 500,
    safeToRetry: false,
  },
  DB_DELETE_FAILED: {
    code: "DB_DELETE_FAILED",
    humanMessage: "Could not delete the record.",
    typicalCause: "FK constraint, RLS denial, or row no longer exists.",
    preventionRule: "Cascade-aware delete plan + RLS coverage tests.",
    alertSeverity: "medium",
    httpStatus: 500,
    safeToRetry: false,
  },
  /** @deprecated Use INVALID_PAYLOAD */
  INVALID_INPUT: {
    code: "INVALID_INPUT",
    humanMessage: "Request input is invalid.",
    typicalCause: "Required field missing or value did not match expected shape.",
    preventionRule: "Apply schema validation at every API entry point.",
    alertSeverity: "low",
    httpStatus: 400,
    safeToRetry: false,
  },
  /** @deprecated Use INVALID_PAYLOAD */
  BAD_REQUEST: {
    code: "BAD_REQUEST",
    humanMessage: "Request could not be processed.",
    typicalCause: "Malformed body, unsupported parameter combination, or invalid header.",
    preventionRule: "Validate request shape before any side effect.",
    alertSeverity: "low",
    httpStatus: 400,
    safeToRetry: false,
  },
  /** @deprecated Use MISSING_ENV_VAR */
  MISSING_CONFIG: {
    code: "MISSING_CONFIG",
    humanMessage: "Service configuration is incomplete.",
    typicalCause: "Required runtime configuration value is not set.",
    preventionRule: "Validate config at boot and block startup on missing values.",
    alertSeverity: "high",
    httpStatus: 500,
    safeToRetry: false,
  },
  READ_ONLY_RESOURCE: {
    code: "READ_ONLY_RESOURCE",
    humanMessage: "This resource is read-only and cannot be modified through the API.",
    typicalCause: "Attempted mutation on an entity that has no write contract.",
    preventionRule: "Document write contracts in OpenAPI and gate writes at route entry.",
    alertSeverity: "low",
    httpStatus: 405,
    safeToRetry: false,
  },
  SUBMITTAL_WORKFLOW_NOT_ASSIGNED: {
    code: "SUBMITTAL_WORKFLOW_NOT_ASSIGNED",
    humanMessage: "You are not assigned to this submittal workflow step.",
    typicalCause: "User attempted to act on a workflow step that belongs to another reviewer.",
    preventionRule: "Verify assignee match before allowing workflow transitions.",
    alertSeverity: "low",
    httpStatus: 403,
    safeToRetry: false,
  },
  PRECONDITION_FAILED: {
    code: "PRECONDITION_FAILED",
    humanMessage: "Required precondition was not met.",
    typicalCause: "Resource is not in the expected state for the requested operation.",
    preventionRule: "Check resource state before performing state transitions.",
    alertSeverity: "low",
    httpStatus: 412,
    safeToRetry: false,
  },
  /** @deprecated Use UPSTREAM_FAILURE */
  UPSTREAM_ERROR: {
    code: "UPSTREAM_ERROR",
    humanMessage: "Upstream service returned an error.",
    typicalCause: "External API returned 4xx/5xx during a backend-driven workflow.",
    preventionRule: "Wrap upstream calls with timeout/retry and surface structured failures.",
    alertSeverity: "high",
    httpStatus: 502,
    safeToRetry: true,
  },
  /** @deprecated Use INVALID_PAYLOAD */
  VALIDATION: {
    code: "VALIDATION",
    humanMessage: "Request validation failed.",
    typicalCause: "Required field is missing or value failed type/range validation.",
    preventionRule: "Validate inputs at the API entry point before any side effect.",
    alertSeverity: "low",
    httpStatus: 400,
    safeToRetry: false,
  },
  /** @deprecated Use MISSING_ENV_VAR */
  CONFIGURATION_ERROR: {
    code: "CONFIGURATION_ERROR",
    humanMessage: "Service configuration error.",
    typicalCause: "Required configuration value is missing or invalid.",
    preventionRule: "Validate config at boot and block startup on missing values.",
    alertSeverity: "high",
    httpStatus: 500,
    safeToRetry: false,
  },
} as const satisfies Record<string, ErrorCatalogEntry>;

export type ErrorCode = keyof typeof ERROR_CATALOG;

export function isKnownErrorCode(code: string): code is ErrorCode {
  return Object.prototype.hasOwnProperty.call(ERROR_CATALOG, code);
}

export function getErrorCatalogEntry(code: string): ErrorCatalogEntry {
  if (isKnownErrorCode(code)) {
    return ERROR_CATALOG[code];
  }
  // In dev/test, surface the bad code loudly so it's caught before deploy.
  // In prod, fall back to INTERNAL_ERROR rather than crashing — the route
  // already broke once; don't make it crash twice on the error path.
  if (process.env.NODE_ENV !== "production") {
    console.error(
      `[error-catalog] Unknown error code "${code}" — falling back to INTERNAL_ERROR. ` +
        `Add it to ERROR_CATALOG in frontend/src/lib/guardrails/error-catalog.ts.`,
    );
  }
  return ERROR_CATALOG.INTERNAL_ERROR;
}
