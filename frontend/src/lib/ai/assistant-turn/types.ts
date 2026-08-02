export const ASSISTANT_TURN_DURABLE_STATUSES = [
  "accepted",
  "running",
  "completed",
  "failed",
  "canceled",
] as const;

export type AssistantTurnDurableStatus =
  (typeof ASSISTANT_TURN_DURABLE_STATUSES)[number];
export type AssistantTurnTerminalOutcome =
  | "completed"
  | "completed_with_warnings"
  | "needs_user_input"
  | "canceled"
  | "failed";
export type AssistantTurnLifecycle = "accepted" | "running" | "terminal";

export interface AssistantTurnActor {
  id: string;
  organizationId: string | null;
  permissions: readonly string[];
}

export interface StartAssistantTurnCommand {
  type: "start";
  idempotencyKey: string;
  sessionId: string;
  payloadIdentity: string;
  payload: unknown;
}

export interface CancelAssistantTurnCommand {
  type: "cancel";
  turnId: string;
  reason?: string;
}

export interface ResumeAssistantTurnCommand {
  type: "resume";
  turnId: string;
  approvalRequestId: string;
  payloadIdentity: string;
  decision: "approved" | "rejected";
}

export type AssistantTurnCommand =
  | StartAssistantTurnCommand
  | CancelAssistantTurnCommand
  | ResumeAssistantTurnCommand;

export interface ObserveAssistantTurnQuery {
  turnId: string;
  afterSequence?: number;
}

export type AssistantTurnSourceKind = "tool" | "source" | "artifact";
export type AssistantTurnSourceReceiptStatus =
  | "pending"
  | "succeeded"
  | "warning"
  | "failed"
  | "skipped";

export interface AssistantTurnSourceReceipt {
  id: string;
  kind: AssistantTurnSourceKind;
  required: boolean;
  status: AssistantTurnSourceReceiptStatus;
  message?: string;
}

export type AssistantTurnApprovalState =
  | { status: "not_required" }
  | {
      status: "pending";
      requestId: string;
      payloadIdentity: string;
      prompt: string;
    }
  | {
      status: "resolved";
      requestId: string;
      payloadIdentity: string;
      decision: "approved" | "rejected";
      resolvedBy: string;
      resolvedAt: string;
    };

export interface AssistantTurnReceipt {
  turnId: string;
  idempotencyKey: string;
  sessionId: string;
  actorId: string;
  status: AssistantTurnDurableStatus;
  stage: string;
  lifecycle: AssistantTurnLifecycle;
  terminal: AssistantTurnTerminalOutcome | null;
  payloadIdentity: string;
  commandPayload: unknown;
  approval: AssistantTurnApprovalState;
  sources: readonly AssistantTurnSourceReceipt[];
  warningMessages: readonly string[];
  cancellationRequestedAt: string | null;
  runtimeKind: string | null;
  runtimeLocator: string | null;
  version: number;
  errorMessage: string | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  updatedAt: string;
}

export interface AssistantTurnReplayEvent {
  turnId: string;
  sequence: number;
  type:
    | "turn.accepted"
    | "turn.running"
    | "turn.cancellation_requested"
    | "turn.canceled"
    | "turn.approval_requested"
    | "turn.approval_resolved"
    | "turn.terminal"
    | "runtime.event";
  occurredAt: string;
  durability: "durable";
  data?: Readonly<Record<string, unknown>>;
}

export interface AssistantTurnObservation {
  receipt: AssistantTurnReceipt;
  events: readonly AssistantTurnReplayEvent[];
}

export interface AcceptAssistantTurnInput {
  turnId: string;
  command: StartAssistantTurnCommand;
  actor: AssistantTurnActor;
  now: string;
}

export interface AssistantTurnTransition {
  terminal: AssistantTurnTerminalOutcome;
  stage: string;
  errorMessage: string | null;
  completedAt: string;
}

export interface PersistAssistantTurnRuntimeInput {
  turnId: string;
  actor: AssistantTurnActor;
  result: AssistantTurnRuntimeResult;
  transition: AssistantTurnTransition | null;
  now: string;
}

export interface ResolveAssistantTurnApprovalInput {
  turnId: string;
  actor: AssistantTurnActor;
  requestId: string;
  payloadIdentity: string;
  decision: "approved" | "rejected";
  now: string;
}

export interface ResolveAssistantTurnApprovalResult {
  receipt: AssistantTurnReceipt;
  payload: unknown;
  won: boolean;
}

export interface AssistantTurnRepository {
  accept(
    input: AcceptAssistantTurnInput,
  ): Promise<{ receipt: AssistantTurnReceipt; isNew: boolean }>;
  get(
    turnId: string,
    actor: AssistantTurnActor,
  ): Promise<AssistantTurnReceipt | null>;
  claim(
    turnId: string,
    actor: AssistantTurnActor,
    now: string,
  ): Promise<AssistantTurnReceipt>;
  complete(
    turnId: string,
    actor: AssistantTurnActor,
    transition: AssistantTurnTransition,
  ): Promise<AssistantTurnReceipt>;
  fail(
    turnId: string,
    actor: AssistantTurnActor,
    transition: AssistantTurnTransition,
  ): Promise<AssistantTurnReceipt>;
  persistRuntimeResult(
    input: PersistAssistantTurnRuntimeInput,
  ): Promise<AssistantTurnReceipt>;
  resolveApproval(
    input: ResolveAssistantTurnApprovalInput,
  ): Promise<ResolveAssistantTurnApprovalResult>;
  cancel(
    turnId: string,
    actor: AssistantTurnActor,
    reason: string,
    now: string,
  ): Promise<AssistantTurnReceipt>;
  isCancellationRequested(
    turnId: string,
    actor: AssistantTurnActor,
  ): Promise<boolean>;
  listEvents(
    turnId: string,
    actor: AssistantTurnActor,
    afterSequence: number,
  ): Promise<readonly AssistantTurnReplayEvent[]>;
}

export interface AssistantTurnRuntimeEvent {
  type: string;
  data?: Readonly<Record<string, unknown>>;
}

export type AssistantTurnRuntimeResult =
  | {
      status: "completed";
      sources?: readonly AssistantTurnSourceReceipt[];
      warnings?: readonly string[];
      events?: readonly AssistantTurnRuntimeEvent[];
    }
  | {
      status: "delegated";
      runtimeKind: "eve";
      runtimeLocator: string;
      sources?: readonly AssistantTurnSourceReceipt[];
      events?: readonly AssistantTurnRuntimeEvent[];
    }
  | {
      status: "needs_user_input";
      message: string;
      sources?: readonly AssistantTurnSourceReceipt[];
      events?: readonly AssistantTurnRuntimeEvent[];
    }
  | {
      status: "approval_required";
      requestId: string;
      prompt: string;
      sources?: readonly AssistantTurnSourceReceipt[];
      events?: readonly AssistantTurnRuntimeEvent[];
    }
  | {
      status: "failed";
      message: string;
      sources?: readonly AssistantTurnSourceReceipt[];
      events?: readonly AssistantTurnRuntimeEvent[];
    };

export interface AssistantTurnRuntimeInvocation {
  turnId: string;
  actor: AssistantTurnActor;
  payloadIdentity: string;
  payload: unknown;
  resume: null | {
    approvalRequestId: string;
    decision: "approved";
  };
}

export interface AssistantTurnRuntimeGeneration {
  response: Response;
  result?: Promise<AssistantTurnRuntimeResult>;
}

export interface AssistantTurnRuntimeExecutor {
  generate(
    invocation: AssistantTurnRuntimeInvocation,
  ): Promise<AssistantTurnRuntimeGeneration>;
  cancel?(turnId: string, actor: AssistantTurnActor): Promise<void>;
}

export type AssistantTurnExecutionDisposition =
  | "started"
  | "duplicate"
  | "canceled"
  | "resumed";

export interface ExecuteAssistantTurnResult {
  receipt: AssistantTurnReceipt;
  response: Response | null;
  disposition: AssistantTurnExecutionDisposition;
}

export interface AssistantTurn {
  execute(
    command: AssistantTurnCommand,
    actor: AssistantTurnActor,
  ): Promise<ExecuteAssistantTurnResult>;
  observe(
    query: ObserveAssistantTurnQuery,
    actor: AssistantTurnActor,
  ): Promise<AssistantTurnObservation>;
}

export interface AssistantTurnDependencies {
  repository: AssistantTurnRepository;
  runtime: AssistantTurnRuntimeExecutor;
  createTurnId: () => string;
  defer: (task: Promise<void>) => void;
  now?: () => string;
  onBackgroundError?: (error: unknown) => void;
}

export class AssistantTurnNotFoundError extends Error {
  constructor(turnId: string) {
    super(`Assistant turn "${turnId}" was not found for this actor.`);
    this.name = "AssistantTurnNotFoundError";
  }
}

export class AssistantTurnConflictError extends Error {
  constructor(
    message: string,
    readonly receipt?: AssistantTurnReceipt,
  ) {
    super(message);
    this.name = "AssistantTurnConflictError";
  }
}

export class AssistantTurnApprovalPersistenceError extends Error {
  constructor(turnId: string) {
    super(
      `Assistant turn "${turnId}" has no matching durable pending approval for this payload.`,
    );
    this.name = "AssistantTurnApprovalPersistenceError";
  }
}
