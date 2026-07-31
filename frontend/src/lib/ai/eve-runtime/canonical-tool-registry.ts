/**
 * Request-scoped tool catalog for the Eve runtime.
 *
 * This module deliberately adapts AI SDK-style tool objects instead of wrapping
 * their execute functions. Existing production tools therefore remain the
 * executable source of truth while this registry supplies policy metadata.
 */

export type ToolEffectClass = "read" | "write" | "external_delivery";

export type EveToolSurface = "ai_assistant" | "ask_alleato" | (string & {});

export type ApprovalRequirement = "none" | "user" | "policy";

export type SourceFamily =
  | "alleato_database"
  | "documents"
  | "email"
  | "meetings"
  | "external_service"
  | (string & {});

export interface AiSdkStyleTool {
  /** AI SDK 7 also permits request-context description functions. */
  description?: unknown;
  inputSchema?: unknown;
  /** Compatibility with older AI SDK tool definitions. */
  parameters?: unknown;
  execute?: unknown;
}

export interface ToolRuntimeAvailability {
  providers: readonly string[];
  enabled?: boolean;
}

export type ProjectResolution =
  | {
      status: "resolved";
      projectId: number;
    }
  | {
      status: "ambiguous";
      candidateProjectIds?: readonly number[];
    }
  | {
      status: "not_found";
      query?: string;
    };

export interface CanonicalToolDefinition<
  TTool extends AiSdkStyleTool = AiSdkStyleTool,
> {
  name: string;
  description: string;
  tool: TTool;
  effect: ToolEffectClass;
  owningService: string;
  requiredPermissions: readonly string[];
  approvalRequirement: ApprovalRequirement;
  allowedSurfaces: readonly EveToolSurface[];
  runtimeAvailability: ToolRuntimeAvailability;
  requiresProjectScope: boolean;
  sourceFamily: SourceFamily;
}

export interface CanonicalToolEntry<
  TTool extends AiSdkStyleTool = AiSdkStyleTool,
> extends CanonicalToolDefinition<TTool> {
  inputSchema: unknown;
}

export interface ToolActor {
  id: string;
  permissions: ReadonlySet<string>;
}

export interface ToolRequestContext {
  actor: ToolActor;
  surface: EveToolSurface;
  provider: string;
  project: ProjectResolution;
}

export type CanonicalToolErrorCode =
  | "CANONICAL_TOOL_INVALID_DEFINITION"
  | "CANONICAL_TOOL_DUPLICATE_NAME"
  | "CANONICAL_TOOL_NOT_AVAILABLE"
  | "PROJECT_RESOLUTION_AMBIGUOUS"
  | "PROJECT_RESOLUTION_NOT_FOUND"
  | "PROJECT_RESOLUTION_INVALID";

export class CanonicalToolRegistryError extends Error {
  constructor(
    message: string,
    readonly code: CanonicalToolErrorCode,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class InvalidCanonicalToolDefinitionError extends CanonicalToolRegistryError {
  constructor(message: string) {
    super(message, "CANONICAL_TOOL_INVALID_DEFINITION");
  }
}

export class DuplicateCanonicalToolNameError extends CanonicalToolRegistryError {
  constructor(toolName: string) {
    super(
      `Canonical tool "${toolName}" is registered more than once.`,
      "CANONICAL_TOOL_DUPLICATE_NAME",
    );
  }
}

export class ToolNotAvailableError extends CanonicalToolRegistryError {
  constructor(toolName: string) {
    super(
      `Tool "${toolName}" is not available in this request context.`,
      "CANONICAL_TOOL_NOT_AVAILABLE",
    );
  }
}

export class AmbiguousProjectResolutionError extends CanonicalToolRegistryError {
  constructor(toolName: string) {
    super(
      `Tool "${toolName}" requires one resolved project, but project resolution is ambiguous.`,
      "PROJECT_RESOLUTION_AMBIGUOUS",
    );
  }
}

export class ProjectNotFoundResolutionError extends CanonicalToolRegistryError {
  constructor(toolName: string) {
    super(
      `Tool "${toolName}" requires a resolved project, but no project was found.`,
      "PROJECT_RESOLUTION_NOT_FOUND",
    );
  }
}

export class InvalidResolvedProjectError extends CanonicalToolRegistryError {
  constructor(projectId: number) {
    super(
      `Resolved project ID must be a positive integer; received ${String(projectId)}.`,
      "PROJECT_RESOLUTION_INVALID",
    );
  }
}

function toolInputSchema(tool: AiSdkStyleTool): unknown {
  return tool.inputSchema ?? tool.parameters;
}

function validateDefinition(
  definition: CanonicalToolDefinition,
): CanonicalToolEntry {
  if (!definition.name.trim()) {
    throw new InvalidCanonicalToolDefinitionError(
      "Canonical tool name cannot be empty.",
    );
  }
  if (!definition.description.trim()) {
    throw new InvalidCanonicalToolDefinitionError(
      `Canonical tool "${definition.name}" must have a description.`,
    );
  }
  if (!definition.owningService.trim()) {
    throw new InvalidCanonicalToolDefinitionError(
      `Canonical tool "${definition.name}" must name an owning service.`,
    );
  }
  if (!definition.sourceFamily.trim()) {
    throw new InvalidCanonicalToolDefinitionError(
      `Canonical tool "${definition.name}" must name a source family.`,
    );
  }
  if (definition.allowedSurfaces.length === 0) {
    throw new InvalidCanonicalToolDefinitionError(
      `Canonical tool "${definition.name}" must allow at least one surface.`,
    );
  }
  if (definition.runtimeAvailability.providers.length === 0) {
    throw new InvalidCanonicalToolDefinitionError(
      `Canonical tool "${definition.name}" must allow at least one provider.`,
    );
  }

  const inputSchema = toolInputSchema(definition.tool);
  if (inputSchema === undefined) {
    throw new InvalidCanonicalToolDefinitionError(
      `Canonical tool "${definition.name}" must expose an AI SDK inputSchema or parameters schema.`,
    );
  }

  if (
    definition.effect !== "read" &&
    definition.approvalRequirement === "none"
  ) {
    throw new InvalidCanonicalToolDefinitionError(
      `Canonical ${definition.effect} tool "${definition.name}" must require approval.`,
    );
  }

  return Object.freeze({
    ...definition,
    requiredPermissions: Object.freeze([...definition.requiredPermissions]),
    allowedSurfaces: Object.freeze([...definition.allowedSurfaces]),
    runtimeAvailability: Object.freeze({
      ...definition.runtimeAvailability,
      providers: Object.freeze([
        ...definition.runtimeAvailability.providers,
      ]),
    }),
    inputSchema,
  });
}

function validateProjectResolution(project: ProjectResolution): void {
  if (
    project.status === "resolved" &&
    (!Number.isInteger(project.projectId) || project.projectId <= 0)
  ) {
    throw new InvalidResolvedProjectError(project.projectId);
  }
}

function isAvailableForRequest(
  entry: CanonicalToolEntry,
  context: ToolRequestContext,
): boolean {
  if (entry.runtimeAvailability.enabled === false) return false;
  if (!entry.runtimeAvailability.providers.includes(context.provider)) {
    return false;
  }
  if (!entry.allowedSurfaces.includes(context.surface)) return false;

  // Ask Alleato is intentionally a narrow, side-effect-free surface even if a
  // write tool is accidentally tagged as allowed there.
  if (context.surface === "ask_alleato" && entry.effect !== "read") return false;

  if (
    entry.requiredPermissions.some(
      (permission) => !context.actor.permissions.has(permission),
    )
  ) {
    return false;
  }

  if (
    entry.requiresProjectScope &&
    context.project.status !== "resolved"
  ) {
    return false;
  }

  return true;
}

function toolsFromEntries(
  entries: readonly CanonicalToolEntry[],
): Readonly<Record<string, AiSdkStyleTool>> {
  return Object.freeze(
    Object.fromEntries(entries.map((entry) => [entry.name, entry.tool])),
  );
}

export class RequestScopedToolCatalog {
  readonly entries: readonly CanonicalToolEntry[];
  readonly advertisedTools: Readonly<Record<string, AiSdkStyleTool>>;
  readonly executableTools: Readonly<Record<string, AiSdkStyleTool>>;
  readonly advertisedNames: readonly string[];
  readonly executableNames: readonly string[];

  constructor(
    private readonly allEntries: readonly CanonicalToolEntry[],
    readonly context: ToolRequestContext,
  ) {
    validateProjectResolution(context.project);

    this.entries = Object.freeze(
      allEntries.filter((entry) => isAvailableForRequest(entry, context)),
    );

    // Both catalogs are materialized from the exact same filtered entry list.
    // This makes it impossible to advertise a tool that cannot be executed.
    this.advertisedTools = toolsFromEntries(this.entries);
    this.executableTools = toolsFromEntries(this.entries);
    this.advertisedNames = Object.freeze(Object.keys(this.advertisedTools));
    this.executableNames = Object.freeze(Object.keys(this.executableTools));
  }

  getExecutableTool(toolName: string): AiSdkStyleTool {
    const executable = this.executableTools[toolName];
    if (executable) return executable;

    const registered = this.allEntries.find(
      (entry) => entry.name === toolName,
    );
    if (registered?.requiresProjectScope) {
      if (this.context.project.status === "ambiguous") {
        throw new AmbiguousProjectResolutionError(toolName);
      }
      if (this.context.project.status === "not_found") {
        throw new ProjectNotFoundResolutionError(toolName);
      }
    }

    throw new ToolNotAvailableError(toolName);
  }
}

export class CanonicalToolRegistry {
  readonly entries: readonly CanonicalToolEntry[];

  constructor(definitions: readonly CanonicalToolDefinition[]) {
    const names = new Set<string>();
    const entries = definitions.map((definition) => {
      if (names.has(definition.name)) {
        throw new DuplicateCanonicalToolNameError(definition.name);
      }
      names.add(definition.name);
      return validateDefinition(definition);
    });
    this.entries = Object.freeze(entries);
  }

  forRequest(context: ToolRequestContext): RequestScopedToolCatalog {
    return new RequestScopedToolCatalog(this.entries, context);
  }
}

/**
 * Identity helper that preserves the concrete AI SDK tool type while requiring
 * all canonical policy metadata next to the adapter registration.
 */
export function defineCanonicalTool<
  const TTool extends AiSdkStyleTool,
>(
  definition: CanonicalToolDefinition<TTool>,
): CanonicalToolDefinition<TTool> {
  return definition;
}

export function createCanonicalToolRegistry(
  definitions: readonly CanonicalToolDefinition[],
): CanonicalToolRegistry {
  return new CanonicalToolRegistry(definitions);
}
