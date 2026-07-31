/**
 * @jest-environment jsdom
 */
import { act, render, screen } from "@testing-library/react";
import { MultiStepLoader } from "../multi-step-loader";

const STATES = [{ text: "First step" }, { text: "Second step" }, { text: "Final step" }] as const;

describe("MultiStepLoader", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it("reveals the hold note only once the checklist reaches the final step", () => {
    render(
      <MultiStepLoader
        loadingStates={STATES}
        loading
        duration={1000}
        loop={false}
        holdNote="This can take a minute or two. Keep this tab open."
      />,
    );

    // Starts on the first step — the reassurance is hidden so it does not preempt the checklist.
    expect(
      screen.queryByText(/This can take a minute or two/i),
    ).not.toBeInTheDocument();

    // Advance to the middle step — still hidden.
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(
      screen.queryByText(/This can take a minute or two/i),
    ).not.toBeInTheDocument();

    // Advance to the final step — now the note appears so a long run never looks stuck.
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(
      screen.getByText(/This can take a minute or two/i),
    ).toBeInTheDocument();
  });

  it("does not render the hold note or the overlay when not loading", () => {
    render(
      <MultiStepLoader
        loadingStates={STATES}
        loading={false}
        holdNote="Keep this tab open."
      />,
    );
    expect(screen.queryByText("Keep this tab open.")).not.toBeInTheDocument();
    expect(screen.queryByText("First step")).not.toBeInTheDocument();
  });
});
