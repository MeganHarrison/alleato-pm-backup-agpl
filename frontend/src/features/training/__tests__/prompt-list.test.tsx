/**
 * @jest-environment jsdom
 */
import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { toast } from "sonner";

import { PromptList } from "../PromptList";

jest.mock("sonner", () => ({ toast: { error: jest.fn() } }));

describe("PromptList", () => {
  const writeText = jest.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    writeText.mockReset();
    writeText.mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
  });

  it("renders every prompt", () => {
    render(<PromptList prompts={["Prompt one", "Prompt two"]} />);

    expect(screen.getByText("Prompt one")).toBeInTheDocument();
    expect(screen.getByText("Prompt two")).toBeInTheDocument();
  });

  it("copies the prompt text to the clipboard when its copy button is clicked", async () => {
    render(<PromptList prompts={["Prompt one", "Prompt two"]} />);

    const copyButtons = screen.getAllByRole("button", { name: /copy/i });
    fireEvent.click(copyButtons[1]);

    await waitFor(() => expect(writeText).toHaveBeenCalledWith("Prompt two"));
  });

  it("shows a Copied confirmation after copying, scoped to that one prompt", async () => {
    render(<PromptList prompts={["Prompt one", "Prompt two"]} />);

    const copyButtons = screen.getAllByRole("button", { name: /copy/i });
    fireEvent.click(copyButtons[0]);

    expect(
      await screen.findByRole("button", { name: /copied/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /copy prompt two/i }),
    ).toBeInTheDocument();
  });
  it("shows a recoverable error when clipboard access is denied", async () => {
    writeText.mockRejectedValueOnce(new Error("denied"));
    render(<PromptList prompts={["Prompt one"]} />);

    fireEvent.click(screen.getByRole("button", { name: /copy prompt one/i }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "Could not copy this prompt. Select the text and copy it manually.",
      ),
    );
    expect(
      screen.getByRole("button", { name: /copy prompt one/i }),
    ).toBeInTheDocument();
  });
});
