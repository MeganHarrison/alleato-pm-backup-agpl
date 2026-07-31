/**
 * @jest-environment jsdom
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { MessageResponse } from "../message";
import { appToast } from "@/lib/toast/app-toast";

jest.mock("@streamdown/cjk", () => ({ cjk: {} }), { virtual: true });
jest.mock("@streamdown/code", () => ({ code: {} }), { virtual: true });
jest.mock("@streamdown/math", () => ({ math: {} }), { virtual: true });
jest.mock("@streamdown/mermaid", () => ({ mermaid: {} }), { virtual: true });
jest.mock("shiki", () => ({
  bundledLanguages: { text: {}, csv: {} },
  bundledLanguagesInfo: [{ id: "csv", aliases: ["csv"] }],
  createHighlighter: jest.fn(async () => ({
    getLoadedLanguages: () => ["csv", "text"],
    codeToTokens: (code: string) => ({
      bg: "transparent",
      fg: "inherit",
      tokens: code.split("\n").map((line) => [
        {
          content: line,
          color: "inherit",
          htmlStyle: {},
        },
      ]),
    }),
  })),
}), { virtual: true });
jest.mock("streamdown", () => {
  const React = require("react");

  return {
    Streamdown: ({
      children,
      components,
    }: {
      children?: string;
      components?: { code?: React.ComponentType<Record<string, unknown>> };
    }) => {
      const content = typeof children === "string" ? children : "";
      const match = content.match(/^```([^\n]+)?\n([\s\S]*?)\n```$/);

      if (match && components?.code) {
        const CodeComponent = components.code;

        return React.createElement(
          CodeComponent,
          {
            className: match[1] ? `language-${match[1].trim()}` : undefined,
            "data-block": "true",
          },
          match[2],
        );
      }

      return React.createElement("div", null, children);
    },
  };
}, { virtual: true });

jest.mock("@/lib/toast/app-toast", () => ({
  appToast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

const toastMock = appToast as jest.Mocked<typeof appToast>;

describe("MessageResponse code actions", () => {
  const writeTextMock = jest.fn<Promise<void>, [string]>();
  const createObjectUrlMock = jest.fn(() => "blob:test-url");
  const revokeObjectUrlMock = jest.fn();
  const anchorClickMock = jest
    .spyOn(HTMLAnchorElement.prototype, "click")
    .mockImplementation(() => {});

  beforeEach(() => {
    jest.clearAllMocks();
    writeTextMock.mockResolvedValue(undefined);

    Object.defineProperty(global.navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: writeTextMock,
      },
    });

    Object.defineProperty(global.URL, "createObjectURL", {
      configurable: true,
      value: createObjectUrlMock,
    });

    Object.defineProperty(global.URL, "revokeObjectURL", {
      configurable: true,
      value: revokeObjectUrlMock,
    });
  });

  afterAll(() => {
    anchorClickMock.mockRestore();
  });

  it("copies fenced code content from the AI Assistant response surface", async () => {
    render(
      <MessageResponse>
        {"```csv\nworkflow_key,object_label\nchange_event,Change Event\n```"}
      </MessageResponse>,
    );

    fireEvent.click(screen.getByRole("button", { name: /copy code/i }));

    await waitFor(() => {
      expect(writeTextMock).toHaveBeenCalledWith(
        "workflow_key,object_label\nchange_event,Change Event",
      );
    });

    expect(toastMock.success).toHaveBeenCalledWith("Copied to clipboard");
  });

  it("downloads fenced code content with an artifact filename", async () => {
    render(
      <MessageResponse>
        {"```csv\nworkflow_key,object_label\nchange_event,Change Event\n```"}
      </MessageResponse>,
    );

    fireEvent.click(screen.getByRole("button", { name: /download code/i }));

    await waitFor(() => {
      expect(createObjectUrlMock).toHaveBeenCalledTimes(1);
      expect(anchorClickMock).toHaveBeenCalledTimes(1);
    });

    expect(toastMock.success).toHaveBeenCalledWith("Downloaded file");
  });
});
