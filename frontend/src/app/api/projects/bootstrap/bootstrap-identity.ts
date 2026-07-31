interface BootstrapProjectIdentityInput {
  templateName: string;
  templateProjectNumber: string;
  customName?: unknown;
  requestId: string;
}

/**
 * Gives every bootstrap run a deterministic request-scoped identity. The
 * projects table intentionally rejects duplicate active names, so a fixed
 * default makes repeatable and concurrent E2E runs fail before their first
 * workflow step.
 */
export function buildBootstrapProjectIdentity({
  templateName,
  templateProjectNumber,
  customName,
  requestId,
}: BootstrapProjectIdentityInput) {
  const runSuffix = requestId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 12);
  if (!runSuffix) {
    throw new Error("Project bootstrap requires a request correlation ID.");
  }

  const requestedName = typeof customName === "string" ? customName.trim() : "";

  return {
    projectName: requestedName || `${templateName} ${runSuffix}`,
    projectNumber: `${templateProjectNumber}-${runSuffix}`,
  };
}
