/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

import { UserAccessPanel } from "../user-access-panel";
import type { PermissionTemplate } from "@/lib/permissions-shared";
import type { UserAccessSummary } from "../../_lib/user-access-data";

const projectTemplate: PermissionTemplate = {
  id: "project-admin",
  name: "Project Admin",
  scope: "project",
  description: undefined,
  rules_json: {
    directory: ["read"],
    budget: ["read"],
    contracts: ["read"],
    documents: ["read"],
    schedule: ["read"],
    submittals: ["read"],
    rfis: ["read"],
    change_orders: ["read"],
  },
  granular_flags: ["manage_project_directory"],
  is_system: true,
};

const companyTemplate: PermissionTemplate = {
  ...projectTemplate,
  id: "company-admin",
  name: "Company Admin",
  scope: "company",
};

const user: UserAccessSummary = {
  id: "person-1",
  personId: "person-1",
  authUserId: "auth-1",
  fullName: "Andrew Cannon",
  initials: "AC",
  email: "acannon@alleatogroup.com",
  profilePhotoUrl: null,
  isAdmin: false,
  companyTemplateId: null,
  companyTemplateName: null,
  projectCount: 1,
  assignedProjectCount: 1,
  missingTemplateCount: 0,
  primaryTemplateName: "Project Admin",
  memberships: [
    {
      projectId: 43,
      projectName: "Westfield Collective",
      templateId: "project-admin",
      templateName: "Project Admin",
    },
  ],
  granularOverrides: [],
};

function renderPanel() {
  return render(
    <UserAccessPanel
      user={user}
      templates={[projectTemplate]}
      companyTemplates={[companyTemplate]}
      isTemplatesLoading={false}
      isAssignmentSaving={false}
      isCompanyTemplateSaving={false}
      isGranularOverrideSaving={false}
      onAssignTemplate={jest.fn()}
      onAssignCompanyTemplate={jest.fn()}
      onSetGranularOverride={jest.fn()}
    />,
  );
}

describe("UserAccessPanel", () => {
  it("keeps access controls while removing noisy identity and helper copy", () => {
    const { container } = renderPanel();

    expect(screen.getByText("Company access")).toBeInTheDocument();
    expect(screen.getByText("Granular exceptions")).toBeInTheDocument();
    expect(screen.getByText("Project access")).toBeInTheDocument();
    expect(screen.getAllByText("Westfield Collective").length).toBeGreaterThan(0);

    expect(screen.queryByText("Identity")).not.toBeInTheDocument();
    expect(screen.queryByText("Person ID")).not.toBeInTheDocument();
    expect(screen.queryByText(/Override individual capabilities/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Each membership needs one project role/i)).not.toBeInTheDocument();

    expect(container.querySelectorAll(".overflow-hidden.border-y")).toHaveLength(0);
    expect(screen.getByText("Capability").closest(".overflow-hidden")).toHaveClass("border-t");
    expect(screen.getByText("Project").closest(".overflow-hidden")).toHaveClass("border-t");
  });
});
