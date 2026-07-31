/** Request policy boundary for Eve tool factories. */
export type AiSdkStyleTool = { description?: unknown; inputSchema?: unknown; parameters?: unknown; execute?: (...args: never[]) => unknown; [key: string]: unknown };
export type ToolEffectClass = "read" | "write" | "external_delivery";
export type ApprovalRequirement = "none" | "user";
export type EveToolSurface = "ai_assistant" | "ask_alleato";
export type SourceFamily = "alleato_database" | "documents" | "email" | "meetings" | "external_service";
export type ProjectResolution = { status: "resolved"; projectId: number } | { status: "not_found" };

export interface CanonicalToolDefinition {
  name: string; description: string; tool: AiSdkStyleTool; effect: ToolEffectClass; owningService: string;
  requiredPermissions: readonly string[]; approvalRequirement: ApprovalRequirement; allowedSurfaces: readonly EveToolSurface[];
  runtimeAvailability: { providers: readonly string[] }; requiresProjectScope: boolean; sourceFamily: SourceFamily;
}
export interface RequestScopedToolEntry extends CanonicalToolDefinition { inputSchema: unknown }
export interface RequestScopedToolCatalog { entries: readonly RequestScopedToolEntry[]; advertisedNames: readonly string[]; executableNames: readonly string[] }
export interface CanonicalToolRegistry {
  entries: readonly CanonicalToolDefinition[];
  forRequest(input: { actor: { id: string; permissions: Iterable<string> }; surface: EveToolSurface; provider: string; project: ProjectResolution }): RequestScopedToolCatalog;
}

function validate(definition: CanonicalToolDefinition): CanonicalToolDefinition {
  const name = definition.name.trim();
  if (!name) throw new Error("Canonical tool definitions require a name.");
  if (!definition.tool || typeof definition.tool !== "object") throw new Error(`Canonical tool "${name}" has no executable tool object.`);
  if (!definition.allowedSurfaces.length) throw new Error(`Canonical tool "${name}" is not available on any surface.`);
  if (!definition.runtimeAvailability.providers.length) throw new Error(`Canonical tool "${name}" is not available from any provider.`);
  return Object.freeze({ ...definition, name, requiredPermissions: Object.freeze([...definition.requiredPermissions]), allowedSurfaces: Object.freeze([...definition.allowedSurfaces]), runtimeAvailability: Object.freeze({ providers: Object.freeze([...definition.runtimeAvailability.providers]) }) });
}

/** Build once; request filtering is centralized so factory output cannot expand a surface silently. */
export function createCanonicalToolRegistry(definitions: readonly CanonicalToolDefinition[]): CanonicalToolRegistry {
  const names = new Set<string>();
  const entries = Object.freeze(definitions.map((definition) => {
    const entry = validate(definition);
    if (names.has(entry.name)) throw new Error(`Canonical tool registry contains duplicate tool "${entry.name}".`);
    names.add(entry.name);
    return entry;
  }));
  return Object.freeze({
    entries,
    forRequest({ actor, surface, provider, project }) {
      const permissions = new Set(actor.permissions);
      const scopedEntries = entries
        .filter((entry) => entry.allowedSurfaces.includes(surface))
        .filter((entry) => entry.runtimeAvailability.providers.includes(provider))
        .filter((entry) => entry.requiredPermissions.every((permission) => permissions.has(permission)))
        .filter((entry) => !entry.requiresProjectScope || project.status === "resolved")
        .map((entry) => Object.freeze({ ...entry, inputSchema: entry.tool.inputSchema ?? entry.tool.parameters }));
      const requestNames = Object.freeze(scopedEntries.map((entry) => entry.name));
      return Object.freeze({ entries: Object.freeze(scopedEntries), advertisedNames: requestNames, executableNames: requestNames });
    },
  });
}
