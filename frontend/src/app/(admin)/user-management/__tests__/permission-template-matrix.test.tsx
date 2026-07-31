/**
 * @jest-environment jsdom
 */
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

import { PermissionTemplateMatrix } from "../permission-template-matrix";
import type { PermissionTemplate } from "@/lib/permissions-shared";

const template: PermissionTemplate = {
  id: "template-1",
  name: "Operations",
  scope: "company",
  description: "Company access template",
  rules_json: {
    directory: ["read"],
    budget: ["read", "write"],
    contracts: ["read"],
    commitments: ["read"],
    estimates: ["none"],
    documents: ["read"],
    schedule: ["read"],
    submittals: ["read"],
    rfis: ["read"],
    change_orders: ["read"],
    change_events: ["none"],
    emails: ["read"],
  },
  granular_flags: [],
  is_system: true,
};

describe("PermissionTemplateMatrix", () => {
  it("keeps granular options collapsed until the tool is opened", () => {
    render(
      <PermissionTemplateMatrix
        template={template}
        isSaving={false}
        onChange={jest.fn()}
      />,
    );

    expect(
      screen.queryByText("Create budget modifications"),
    ).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: /show budget options/i }),
    );

    expect(screen.getByText("Create budget modifications")).toBeInTheDocument();
    expect(screen.getByText("Approve budget changes")).toBeInTheDocument();
  });
});
