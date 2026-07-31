import { z } from "zod";

export const OPERATOR_PRESENTATION_SCHEMA_URL =
  "https://adaptivecards.io/schemas/adaptive-card.json";

export type OperatorChannel = "teams" | "outlook" | "slack";
export type OperatorPriority = "low" | "normal" | "high" | "urgent";
export type OperatorActionStyle =
  | "primary"
  | "secondary"
  | "positive"
  | "destructive";
export type OperatorActionKind = "submit" | "openUrl" | "copy";
export type OperatorAffordance = "button" | "url" | "copy";

const nonEmptyString = z.string().trim().min(1);

export const operatorActionSchema = z.object({
  id: nonEmptyString,
  label: nonEmptyString,
  kind: z.enum(["submit", "openUrl", "copy"]).default("submit"),
  value: z.string().trim().optional(),
  url: z.string().url().optional(),
  style: z.enum(["primary", "secondary", "positive", "destructive"]).default("secondary"),
  affordance: z.enum(["button", "url", "copy"]).default("button"),
  priority: z.number().int().min(0).max(100).default(50),
});

export const operatorMessageSchema = z.object({
  operatorId: nonEmptyString,
  approvalId: nonEmptyString,
  title: nonEmptyString,
  body: nonEmptyString,
  priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
  actions: z.array(operatorActionSchema).min(1).max(10),
  channel: z
    .object({
      preferred: z.enum(["teams", "outlook", "slack"]).default("teams"),
      capabilities: z
        .object({
          affordances: z.array(z.enum(["button", "url", "copy"])).default([
            "button",
            "url",
          ]),
          maxActions: z.number().int().min(1).max(6).default(6),
        })
        .default({ affordances: ["button", "url"], maxActions: 6 }),
      metadata: z.record(z.string(), z.unknown()).default({}),
    })
    .default({
      preferred: "teams",
      capabilities: { affordances: ["button", "url"], maxActions: 6 },
      metadata: {},
    }),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export type OperatorAction = z.infer<typeof operatorActionSchema>;
export type OperatorMessage = z.infer<typeof operatorMessageSchema>;

export type OperatorPresentationDrop = {
  actionId: string;
  label: string;
  reason: "unsupported_affordance" | "channel_action_limit" | "missing_url";
  affordance: OperatorAffordance;
  channel: OperatorChannel;
};

export type OperatorPresentationMetadata = {
  operatorId: string;
  approvalId: string;
  channel: OperatorChannel;
  requestedChannel: OperatorChannel;
  priority: OperatorPriority;
  renderedActionIds: string[];
  droppedActions: OperatorPresentationDrop[];
  capabilityMetadata: Record<string, unknown>;
};

export type TeamsAdaptiveCardPayload = {
  type: "AdaptiveCard";
  $schema: typeof OPERATOR_PRESENTATION_SCHEMA_URL;
  version: "1.5";
  body: Array<Record<string, unknown>>;
  actions: Array<Record<string, unknown>>;
};

export type RenderedOperatorPresentation = {
  card: TeamsAdaptiveCardPayload;
  metadata: OperatorPresentationMetadata;
};

export type OperatorMessageValidationResult =
  | { success: true; message: OperatorMessage }
  | {
      success: false;
      errorCode: "INVALID_OPERATOR_MESSAGE";
      fieldErrors: Record<string, string[]>;
      formErrors: string[];
    };

const priorityColor: Record<OperatorPriority, string> = {
  low: "Default",
  normal: "Accent",
  high: "Warning",
  urgent: "Attention",
};

const actionStyleToTeams: Record<OperatorActionStyle, string> = {
  primary: "positive",
  secondary: "default",
  positive: "positive",
  destructive: "destructive",
};

export function validateOperatorMessage(
  input: unknown,
): OperatorMessageValidationResult {
  const parsed = operatorMessageSchema.safeParse(input);
  if (parsed.success) {
    return { success: true, message: parsed.data };
  }

  const flattened = parsed.error.flatten();
  return {
    success: false,
    errorCode: "INVALID_OPERATOR_MESSAGE",
    fieldErrors: flattened.fieldErrors,
    formErrors: flattened.formErrors,
  };
}

function textBlock(
  text: string,
  options: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    type: "TextBlock",
    text,
    wrap: true,
    ...options,
  };
}

function factSet(message: OperatorMessage): Record<string, unknown> {
  return {
    type: "FactSet",
    facts: [
      { title: "Operator", value: message.operatorId },
      { title: "Approval", value: message.approvalId },
      { title: "Priority", value: message.priority },
    ],
  };
}

function actionToTeams(action: OperatorAction, message: OperatorMessage) {
  if (action.kind === "openUrl") {
    if (!action.url) return null;
    return {
      type: "Action.OpenUrl",
      title: action.label,
      url: action.url,
    };
  }

  return {
    type: "Action.Submit",
    title: action.label,
    style: actionStyleToTeams[action.style],
    data: {
      operatorId: message.operatorId,
      approvalId: message.approvalId,
      actionId: action.id,
      value: action.value ?? action.id,
    },
  };
}

function sortActions(actions: OperatorAction[]): OperatorAction[] {
  return [...actions].sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id));
}

export function renderOperatorMessageForTeams(
  input: OperatorMessage,
): RenderedOperatorPresentation {
  const message = operatorMessageSchema.parse(input);
  const channel: OperatorChannel = "teams";
  const affordances = new Set(message.channel.capabilities.affordances);
  const droppedActions: OperatorPresentationDrop[] = [];
  const renderedActionIds: string[] = [];
  const renderedActions: Array<Record<string, unknown>> = [];

  for (const action of sortActions(message.actions)) {
    if (!affordances.has(action.affordance)) {
      droppedActions.push({
        actionId: action.id,
        label: action.label,
        reason: "unsupported_affordance",
        affordance: action.affordance,
        channel,
      });
      continue;
    }

    if (renderedActions.length >= message.channel.capabilities.maxActions) {
      droppedActions.push({
        actionId: action.id,
        label: action.label,
        reason: "channel_action_limit",
        affordance: action.affordance,
        channel,
      });
      continue;
    }

    const rendered = actionToTeams(action, message);
    if (!rendered) {
      droppedActions.push({
        actionId: action.id,
        label: action.label,
        reason: "missing_url",
        affordance: action.affordance,
        channel,
      });
      continue;
    }

    renderedActionIds.push(action.id);
    renderedActions.push(rendered);
  }

  return {
    card: {
      type: "AdaptiveCard",
      $schema: OPERATOR_PRESENTATION_SCHEMA_URL,
      version: "1.5",
      body: [
        textBlock(message.title, {
          size: "Medium",
          weight: "Bolder",
          color: priorityColor[message.priority],
        }),
        textBlock(message.body),
        factSet(message),
      ],
      actions: renderedActions,
    },
    metadata: {
      operatorId: message.operatorId,
      approvalId: message.approvalId,
      channel,
      priority: message.priority,
      requestedChannel: message.channel.preferred,
      renderedActionIds,
      droppedActions,
      capabilityMetadata: message.channel.metadata,
    },
  };
}

export function parseAndRenderOperatorMessageForTeams(
  input: unknown,
): RenderedOperatorPresentation | OperatorMessageValidationResult {
  const validated = validateOperatorMessage(input);
  if (!validated.success) return validated;
  return renderOperatorMessageForTeams(validated.message);
}
