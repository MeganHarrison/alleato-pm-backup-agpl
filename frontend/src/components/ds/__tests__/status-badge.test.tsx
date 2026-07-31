/**
 * @jest-environment jsdom
 */

import { render, screen } from "@testing-library/react";

import { StatusBadge } from "../status-badge";

describe("StatusBadge semantic status colors", () => {
  it("renders reviewed as the semantic success treatment", () => {
    render(<StatusBadge status="reviewed" />);

    expect(screen.getByText("reviewed")).toHaveClass(
      "rounded-full",
      "bg-success/10",
      "text-success",
    );
    expect(screen.getByText("reviewed").className).not.toMatch(/orange/);
  });

  it("does not use the brand accent for an unmapped status", () => {
    render(<StatusBadge status="custom status" />);

    expect(screen.getByText("custom status")).toHaveClass(
      "bg-muted",
      "text-muted-foreground",
    );
    expect(screen.getByText("custom status").className).not.toMatch(/orange/);
  });
});
