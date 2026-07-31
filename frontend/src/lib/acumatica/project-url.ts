const ACUMATICA_BASE_URL =
  process.env.ACUMATICA_BASE_URL ?? "https://alleatogroup.acumatica.com";

/**
 * Deep link to a project record on the Acumatica Projects screen (PM301000).
 */
export function buildAcumaticaProjectHref(projectId: string): string {
  return `${ACUMATICA_BASE_URL}/Main?ScreenId=PM301000&ProjectID=${encodeURIComponent(projectId.trim())}`;
}
