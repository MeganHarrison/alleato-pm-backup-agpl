jest.mock("@/lib/ai/orchestrator", () => ({
  buildCouncilModePromptInjection: jest.fn(() => "\n\n## Council Mode"),
  createStrategistTools: jest.fn(),
  getStrategistSystemPrompt: jest.fn(() => "BASE STRATEGIST PROMPT"),
  STRATEGIST_MODEL: "test-model",
}));

jest.mock("ai", () => ({
  generateText: jest.fn(),
  streamText: jest.fn(),
  isStepCount: jest.fn((count: number) => ({ count })),
}));

jest.mock("@/lib/ai/providers", () => ({
  getLanguageModel: jest.fn(),
}));

jest.mock("@/lib/ai/services/ai-memory-service", () => ({
  getMemoriesForSession: jest.fn(),
  buildMemoryContextPayload: jest.fn(),
}));

jest.mock("@/lib/ai/services/conversation-memory", () => ({
  generateConversationMemory: jest.fn(),
  getRecentConversationSummaries: jest.fn(),
  buildRecentConversationsBlock: jest.fn(),
}));

jest.mock("@/lib/ai/services/workspace-artifact-service", () => ({
  listArtifacts: jest.fn(),
  buildWorkspaceContextBlock: jest.fn(),
}));

jest.mock("@/lib/ai/services/agent-learning-service", () => ({
  getRelevantAgentLearnings: jest.fn(),
  buildAgentLearningContextBlock: jest.fn(),
}));

jest.mock("@/lib/ai/services/skill-injection-service", () => ({
  buildSkillInjectionContext: jest.fn(),
}));

jest.mock("@/lib/ai/services/task-training-service", () => ({
  buildTaskGenerationTrainingBlock: jest.fn(),
  shouldLoadTaskTrainingContext: jest.fn(),
}));

jest.mock("@/lib/users/current-user-profile-server", () => ({
  loadCurrentUserProfilePayload: jest.fn(),
}));

jest.mock("@/lib/supabase/service", () => ({
  createServiceClient: jest.fn(() => ({})),
}));

import {
  buildMemoryContextPayload,
  getMemoriesForSession,
} from "@/lib/ai/services/ai-memory-service";
import {
  generateConversationMemory,
  buildRecentConversationsBlock,
  getRecentConversationSummaries,
} from "@/lib/ai/services/conversation-memory";
import {
  buildAgentLearningContextBlock,
  getRelevantAgentLearnings,
} from "@/lib/ai/services/agent-learning-service";
import { buildSkillInjectionContext } from "@/lib/ai/services/skill-injection-service";
import { shouldLoadTaskTrainingContext } from "@/lib/ai/services/task-training-service";
import {
  buildWorkspaceContextBlock,
  listArtifacts,
} from "@/lib/ai/services/workspace-artifact-service";
import { loadCurrentUserProfilePayload } from "@/lib/users/current-user-profile-server";
import { generateText } from "ai";
import { getLanguageModel } from "@/lib/ai/providers";
import { createStrategistTools } from "@/lib/ai/orchestrator";
import {
  assembleSystemPrompt,
  generateBotResponse,
  normalizeBotResponseText,
} from "../bot-core";

const mockGetMemoriesForSession = getMemoriesForSession as jest.MockedFunction<
  typeof getMemoriesForSession
>;
const mockBuildMemoryContextPayload =
  buildMemoryContextPayload as jest.MockedFunction<
    typeof buildMemoryContextPayload
  >;
const mockGetRecentConversationSummaries =
  getRecentConversationSummaries as jest.MockedFunction<
    typeof getRecentConversationSummaries
  >;
const mockGenerateConversationMemory =
  generateConversationMemory as jest.MockedFunction<
    typeof generateConversationMemory
  >;
const mockBuildRecentConversationsBlock =
  buildRecentConversationsBlock as jest.MockedFunction<
    typeof buildRecentConversationsBlock
  >;
const mockGetRelevantAgentLearnings =
  getRelevantAgentLearnings as jest.MockedFunction<
    typeof getRelevantAgentLearnings
  >;
const mockBuildAgentLearningContextBlock =
  buildAgentLearningContextBlock as jest.MockedFunction<
    typeof buildAgentLearningContextBlock
  >;
const mockBuildSkillInjectionContext =
  buildSkillInjectionContext as jest.MockedFunction<
    typeof buildSkillInjectionContext
  >;
const mockShouldLoadTaskTrainingContext =
  shouldLoadTaskTrainingContext as jest.MockedFunction<
    typeof shouldLoadTaskTrainingContext
  >;
const mockListArtifacts = listArtifacts as jest.MockedFunction<
  typeof listArtifacts
>;
const mockBuildWorkspaceContextBlock =
  buildWorkspaceContextBlock as jest.MockedFunction<
    typeof buildWorkspaceContextBlock
  >;
const mockLoadCurrentUserProfilePayload =
  loadCurrentUserProfilePayload as jest.MockedFunction<
    typeof loadCurrentUserProfilePayload
  >;
const mockGenerateText = generateText as jest.MockedFunction<
  typeof generateText
>;
const mockGetLanguageModel = getLanguageModel as jest.MockedFunction<
  typeof getLanguageModel
>;
const mockCreateStrategistTools = createStrategistTools as jest.MockedFunction<
  typeof createStrategistTools
>;

describe("bot-core prompt assembly", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetMemoriesForSession.mockResolvedValue({
      preferences: [],
      relevant: [],
      team: [],
      errors: [],
    });
    mockBuildMemoryContextPayload.mockReturnValue({
      block: "",
      selected: [],
    });
    mockGetRecentConversationSummaries.mockResolvedValue([]);
    mockGenerateConversationMemory.mockResolvedValue(undefined);
    mockBuildRecentConversationsBlock.mockReturnValue("");
    mockGetRelevantAgentLearnings.mockResolvedValue([]);
    mockBuildAgentLearningContextBlock.mockReturnValue({
      block: "",
      selected: [],
    });
    mockBuildSkillInjectionContext.mockResolvedValue({
      block: "",
      usage: null,
    });
    mockShouldLoadTaskTrainingContext.mockReturnValue(false);
    mockListArtifacts.mockResolvedValue([]);
    mockBuildWorkspaceContextBlock.mockReturnValue("");
    mockLoadCurrentUserProfilePayload.mockResolvedValue({
      id: "user-1",
      fullName: "Test User",
      email: "-",
      profileCompleteness: 65,
      isAdmin: false,
      isDeveloper: false,
      onboardingCompletedAt: null,
    });
    mockGetLanguageModel.mockReturnValue("test-language-model" as never);
    mockCreateStrategistTools.mockReturnValue({} as never);
  });

  it("injects registry-owned tool routing guidance into the runtime prompt", async () => {
    const prompt = await assembleSystemPrompt({
      userId: "user-1",
      messageText: "",
    });

    expect(prompt).toContain("BASE STRATEGIST PROMPT");
    expect(prompt).toContain("## Tool Routing Policy");
    expect(prompt).toContain("searchTeamsMessages (teams)");
    expect(prompt).toContain("do not substitute meetings");
  });

  it("injects bounded AI profile context from selected memories", async () => {
    mockBuildMemoryContextPayload.mockReturnValue({
      block: "## Memory Context\nMemory content",
      selected: [
        {
          id: "mem_project",
          type: "preference",
          content: "Prefers concise project risk summaries.",
          confidence: 0.9,
          importance: 0.8,
          project_id: 25125,
          meeting_id: null,
          source: "manual",
          visibility: "private",
          created_at: "2026-06-01T12:00:00.000Z",
        },
      ],
    });
    mockLoadCurrentUserProfilePayload.mockResolvedValue({
      id: "user-1",
      fullName: "Test User",
      email: "test@example.com",
      title: "Project Manager",
      role: "pm",
      profileCompleteness: 80,
      isAdmin: false,
      isDeveloper: false,
      onboardingCompletedAt: null,
    });

    const prompt = await assembleSystemPrompt({
      userId: "user-1",
      messageText: "What should I focus on today?",
      selectedProjectId: 25125,
    });

    expect(prompt).toContain("## AI Profile Context");
    expect(prompt).toContain("User: Test User <test@example.com>");
    expect(prompt).toContain("Role: pm");
    expect(prompt).toContain("Default write mode: preview_only");
    expect(prompt).toContain("Prefers concise project risk summaries.");
    expect(prompt).toContain(
      "Leadership context: not_configured (Leadership coaching context has no durable source or visibility policy yet.)",
    );
    expect(prompt).toContain(
      "Do not imply unavailable leadership context was used.",
    );
  });

  it("degrades explicitly when AI profile context cannot load", async () => {
    mockLoadCurrentUserProfilePayload.mockRejectedValue(
      new Error("profile lookup failed"),
    );

    const prompt = await assembleSystemPrompt({
      userId: "user-1",
      messageText: "Draft an RFI",
    });

    expect(prompt).toContain("## AI Profile Context");
    expect(prompt).toContain("Status: degraded");
    expect(prompt).toContain("User: Unknown user");
    expect(prompt).toContain("Default write mode: preview_only");
    expect(prompt).toContain("Blocked capabilities: write_actions, delivery_actions");
    expect(prompt).toContain(
      "AI profile context could not be loaded: profile lookup failed",
    );
  });
});

describe("bot-core response normalization", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetLanguageModel.mockReturnValue("test-language-model" as never);
    mockCreateStrategistTools.mockReturnValue({} as never);
    mockShouldLoadTaskTrainingContext.mockReturnValue(false);
  });

  it("uses tool result messages when the model returns no final text", () => {
    const normalized = normalizeBotResponseText({
      modelText: "",
      generationResult: {
        toolResults: [
          {
            type: "tool-result",
            toolName: "createGeneratedTask",
            output: {
              action: "preview",
              message:
                "Here's the task I'll add to the Tasks page. Reply **confirm** to proceed.",
            },
          },
        ],
      },
      toolTrace: [],
    });

    expect(normalized).toEqual({
      text: "Here's the task I'll add to the Tasks page. Reply **confirm** to proceed.",
      responseSource: "tool_result",
      rawTextLength: 0,
    });
  });

  it("returns non-empty text for tool-only bot generations", async () => {
    mockGenerateText.mockResolvedValue({
      text: "",
      toolResults: [
        {
          type: "tool-result",
          toolCallId: "call-1",
          toolName: "createGeneratedTask",
          input: {},
          output: {
            action: "preview",
            message:
              "Here's the task I'll add to the Tasks page. Reply **confirm** to proceed.",
          },
        },
      ],
      usage: { inputTokens: 10, outputTokens: 0, totalTokens: 10 },
    } as never);

    const result = await generateBotResponse({
      userId: "user-1",
      messageText: "Create a task for this and assign to Candon",
      platform: "teams",
    });

    expect(result.text).toBe(
      "Here's the task I'll add to the Tasks page. Reply **confirm** to proceed.",
    );
    expect(result.responseSource).toBe("tool_result");
    expect(result.rawTextLength).toBe(0);
  });

  it("routes Teams task-write prompts through direct action-tool mode", async () => {
    mockGenerateText.mockResolvedValue({
      text: "Task **Confirm utility transfer impact** was added to the Tasks page.",
      toolResults: [],
      usage: { inputTokens: 12, outputTokens: 8, totalTokens: 20 },
    } as never);

    await generateBotResponse({
      userId: "user-1",
      messageText: "Create the task for Candon",
      selectedProjectId: 43,
      platform: "teams",
    });

    expect(mockCreateStrategistTools).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({
        pinnedProjectId: 43,
        includeActionTools: true,
        generatedTaskWriteMode: "direct",
      }),
    );
    expect(mockGenerateText).toHaveBeenCalledWith(
      expect.objectContaining({
        instructions: expect.stringContaining(
          "in Teams, that tool call writes the task directly",
        ),
      }),
    );
  });
});
