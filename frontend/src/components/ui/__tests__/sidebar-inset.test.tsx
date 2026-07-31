/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

import { SidebarInset } from "../sidebar";

describe("SidebarInset", () => {
  it("provides layout without creating a duplicate main landmark", () => {
    render(
      <SidebarInset data-testid="inset">
        <main>Primary content</main>
      </SidebarInset>,
    );

    expect(screen.getByTestId("inset").tagName).toBe("DIV");
    expect(screen.getAllByRole("main")).toHaveLength(1);
  });
});
