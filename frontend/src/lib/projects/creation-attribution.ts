export const REQUEST_PROJECT_CREATION_SOURCES = [
  "web_app",
  "api",
  "test_bootstrap",
] as const;

export type RequestProjectCreationSource =
  (typeof REQUEST_PROJECT_CREATION_SOURCES)[number];

interface RequestProjectCreationAttributionInput {
  source: RequestProjectCreationSource;
  actorUserId: string;
  requestId: string;
}

/**
 * Builds the database-owned project creation contract for authenticated
 * request paths. Keeping this after caller-controlled payload fields prevents
 * clients from spoofing or erasing audit attribution.
 */
export function buildRequestProjectCreationAttribution({
  source,
  actorUserId,
  requestId,
}: RequestProjectCreationAttributionInput) {
  const createdBy = actorUserId.trim();
  const creationRequestId = requestId.trim();

  if (!createdBy) {
    throw new Error(
      "Project creation attribution requires an authenticated actor.",
    );
  }
  if (!creationRequestId) {
    throw new Error(
      "Project creation attribution requires a request correlation ID.",
    );
  }

  return {
    created_by: createdBy,
    created_via: source,
    creation_request_id: creationRequestId,
    creation_run_id: null,
  } as const;
}
