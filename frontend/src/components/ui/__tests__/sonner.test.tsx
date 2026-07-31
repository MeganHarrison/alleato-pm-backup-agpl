/** @jest-environment jsdom */

import { render, waitFor } from "@testing-library/react";

import { Toaster } from "../sonner";

const sonnerMock = jest.fn(() => null);

jest.mock("next-themes", () => ({
  useTheme: () => ({ theme: "light" }),
}));
jest.mock("sonner", () => ({
  Toaster: (props: unknown) => sonnerMock(props),
}));
jest.mock("../toast-instrumentation", () => ({
  ToastInstrumentation: () => null,
}));

describe("Toaster", () => {
  it("forces error descriptions to a readable foreground and clears the assistant control", async () => {
    render(<Toaster />);

    await waitFor(() => expect(sonnerMock).toHaveBeenCalled());
    const props = sonnerMock.mock.calls.at(-1)?.[0] as {
      offset: { bottom: number; right: number };
      toastOptions: { classNames: { error: string } };
    };

    expect(props.offset).toEqual({ bottom: 80, right: 16 });
    expect(props.toastOptions.classNames.error).toContain(
      "[&_[data-description]]:!text-white",
    );
  });
});
