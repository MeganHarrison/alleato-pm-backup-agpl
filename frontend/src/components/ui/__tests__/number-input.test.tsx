/** @jest-environment jsdom */

import * as React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { NumberInput } from "../number-input";

describe("NumberInput", () => {
  it("applies a readable minimum width by default", () => {
    render(<NumberInput value="42" onChange={() => undefined} formatOnBlur={false} />);

    expect(screen.getByRole("textbox")).toHaveClass("min-w-20");
  });

  it("renders zero as empty content when clearZeroOnFocus is enabled", () => {
    render(
      <NumberInput
        value="0"
        onChange={() => undefined}
        formatOnBlur={false}
        clearZeroOnFocus
      />,
    );

    const input = screen.getByRole("textbox");
    expect(input).toHaveValue("");
  });

  it("replaces a focused zero value when the browser appends instead of replacing", () => {
    function Harness() {
      const [value, setValue] = React.useState("0");
      return <NumberInput value={value} onChange={(event) => setValue(event.target.value)} formatOnBlur={false} />;
    }

    render(<Harness />);

    const input = screen.getByRole("textbox");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "02" } });

    expect(input).toHaveValue("2");
  });

  it("replaces a focused zero value when the browser inserts before the old value", () => {
    function Harness() {
      const [value, setValue] = React.useState("0");
      return <NumberInput value={value} onChange={(event) => setValue(event.target.value)} formatOnBlur={false} />;
    }

    render(<Harness />);

    const input = screen.getByRole("textbox");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "20" } });

    expect(input).toHaveValue("2");
  });
});
