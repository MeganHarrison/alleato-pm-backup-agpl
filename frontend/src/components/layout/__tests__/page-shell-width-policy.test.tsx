/** @jest-environment jsdom */

import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

import { PageShell } from "../page-shell";

jest.mock("next/navigation", () => ({
  usePathname: () => "/1149/commitments/1/invoices/8268",
}));

jest.mock("../page-header-unified", () => ({
  PageHeader: ({ title }: { title: string }) => <h1>{title}</h1>,
}));

describe("PageShell width policy", () => {
  it("keeps standard detail routes on the wide content width", () => {
    const { container } = render(
      <PageShell variant="detail" title="Invoice details">
        <div>Invoice body</div>
      </PageShell>,
    );

    expect(
      screen.getByRole("heading", { name: "Invoice details" }),
    ).toBeInTheDocument();
    expect(container.querySelector(".max-w-screen-2xl")).toBeInTheDocument();
    expect(container.querySelector(".max-w-6xl")).not.toBeInTheDocument();
  });
});

