import type { EveMessage } from "eve/react";
import { apiFetch } from "@/lib/api-client";
import { persistEveMessages } from "../use-alleato-eve-chat";

jest.mock("@/lib/api-client", () => ({ apiFetch: jest.fn() }));
jest.mock("eve/react", () => ({ useEveAgent: jest.fn() }));

const apiFetchMock = jest.mocked(apiFetch);

describe("persistEveMessages", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    apiFetchMock.mockResolvedValue(new Response(null, { status: 200 }));
  });

  it("sends a completed tool-only message so its action receipt is durable", async () => {
    const message = {
      id: "eve-assistant-tool-only",
      role: "assistant",
      parts: [
        {
          type: "dynamic-tool",
          toolName: "createRFI",
          toolCallId: "tool-call-1",
          state: "output-available",
          input: { projectId: 60, subject: "Approved verification" },
          output: { success: true, recordId: "rfi-1" },
        },
      ],
    } as EveMessage;

    await persistEveMessages("conversation-1", [message]);

    expect(apiFetchMock).toHaveBeenCalledTimes(1);
    const init = apiFetchMock.mock.calls[0]?.[1];
    expect(JSON.parse(String(init?.body))).toEqual({
      surface: "alleato_ai",
      messages: [
        {
          id: "eve-assistant-tool-only",
          role: "assistant",
          content: "",
          parts: message.parts,
        },
      ],
    });
  });
});
