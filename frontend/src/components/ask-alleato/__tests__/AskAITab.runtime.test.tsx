/** @jest-environment jsdom */

import { fireEvent, render, screen } from "@testing-library/react";
import { AskAITab } from "../tabs/AskAITab";
import {
  useAskAlleatoChat,
  useAskAlleatoIdentity,
} from "../useAskAlleatoChat";

jest.mock("../useAskAlleatoChat", () => ({
  getMessageText: jest.fn(() => ""),
  useAskAlleatoIdentity: jest.fn(),
  useAskAlleatoChat: jest.fn(),
}));

const mockedIdentity = jest.mocked(useAskAlleatoIdentity);
const mockedChat = jest.mocked(useAskAlleatoChat);

const idleChat = {
  messages: [],
  status: "ready",
  sessionId: null,
  send: jest.fn(),
  stop: jest.fn(),
  error: null,
  isStreaming: false,
};

describe("AskAITab canonical Eve transport", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedChat.mockReturnValue(idleChat);
  });

  it("mounts no transport until authentication resolves", () => {
    mockedIdentity.mockReturnValue({
      error: null,
      userId: null,
      isLoading: true,
    });

    render(<AskAITab />);

    expect(screen.getByRole("status")).toHaveTextContent(
      "Preparing Ask Alleato",
    );
    expect(mockedChat).not.toHaveBeenCalled();
  });

  it("mounts the canonical chat transport for the authenticated user", () => {
    mockedIdentity.mockReturnValue({
      error: null,
      userId: "user-1",
      isLoading: false,
    });

    render(<AskAITab />);

    expect(mockedChat).toHaveBeenCalledTimes(1);
    expect(mockedChat).toHaveBeenCalledWith("user-1");
  });

  it("shows authentication failure without mounting another transport", () => {
    mockedIdentity.mockReturnValue({
      error: "Your session expired",
      userId: null,
      isLoading: false,
    });

    render(<AskAITab />);

    expect(mockedChat).not.toHaveBeenCalled();
    expect(screen.getByText("Your session expired")).toBeInTheDocument();
  });

  it("exposes the live Eve stop action while a response is streaming", () => {
    const stop = jest.fn();
    mockedIdentity.mockReturnValue({
      error: null,
      userId: "user-1",
      isLoading: false,
    });
    mockedChat.mockReturnValue({
      ...idleChat,
      status: "streaming",
      isStreaming: true,
      stop,
    });

    render(<AskAITab />);

    fireEvent.click(
      screen.getByRole("button", { name: "Stop Ask Alleato response" }),
    );
    expect(stop).toHaveBeenCalledTimes(1);
  });
});
