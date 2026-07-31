/**
 * @jest-environment jsdom
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

import {
  ProjectCostCodeSelector,
  ProjectCostTypeSelector,
} from "../budget-code-field-selectors";

const budgetCodes = [
  {
    id: "project-budget-code-subcontract",
    code: "04-2200",
    costType: "S",
    costTypeId: "cost-type-subcontract",
    description: "Concrete Unit Masonry",
    fullLabel: "04-2200.S - Concrete Unit Masonry",
  },
  {
    id: "project-budget-code-material",
    code: "04-2200",
    costType: "M",
    costTypeId: "cost-type-material",
    description: "Concrete Unit Masonry",
    fullLabel: "04-2200.M - Concrete Unit Masonry",
  },
  {
    id: "project-budget-code-management",
    code: "01-3126",
    costType: "L",
    costTypeId: "cost-type-labor",
    description: "Project Management",
    fullLabel: "01-3126.L - Project Management",
  },
];

describe("split project budget-code fields", () => {
  beforeAll(() => {
    Element.prototype.scrollIntoView = jest.fn();
    HTMLElement.prototype.hasPointerCapture = jest.fn(() => false);
    HTMLElement.prototype.setPointerCapture = jest.fn();
    HTMLElement.prototype.releasePointerCapture = jest.fn();
  });

  it("shows the selected cost code without embedding its cost type", () => {
    render(
      <ProjectCostCodeSelector
        value="project-budget-code-subcontract"
        onValueChange={jest.fn()}
        budgetCodes={budgetCodes}
      />,
    );

    const trigger = screen.getByRole("combobox", { name: "Cost Code" });
    expect(trigger).toHaveTextContent("04-2200 - Concrete Unit Masonry");
    expect(trigger).not.toHaveTextContent("04-2200.S");
  });

  it("deduplicates cost codes and resolves a code change to an active typed option", () => {
    const onValueChange = jest.fn();
    render(
      <ProjectCostCodeSelector
        value="project-budget-code-subcontract"
        onValueChange={onValueChange}
        budgetCodes={budgetCodes}
      />,
    );

    fireEvent.click(screen.getByRole("combobox", { name: "Cost Code" }));
    expect(
      screen.getAllByRole("option", {
        name: "04-2200 - Concrete Unit Masonry",
      }),
    ).toHaveLength(1);

    fireEvent.click(
      screen.getByRole("option", { name: "01-3126 - Project Management" }),
    );
    expect(onValueChange).toHaveBeenCalledWith(budgetCodes[2]);
  });

  it("lists only the selected cost code's cost types in the separate field", () => {
    const onValueChange = jest.fn();
    render(
      <ProjectCostTypeSelector
        value="project-budget-code-subcontract"
        onValueChange={onValueChange}
        budgetCodes={budgetCodes}
      />,
    );

    fireEvent.keyDown(screen.getByRole("combobox", { name: "Cost Type" }), {
      key: "ArrowDown",
    });

    expect(screen.getByRole("option", { name: "S" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "M" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "L" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("option", { name: "M" }));
    expect(onValueChange).toHaveBeenCalledWith(budgetCodes[1]);
  });

  it("disables Cost Type until a typed cost code is selected", () => {
    render(
      <ProjectCostTypeSelector
        value=""
        onValueChange={jest.fn()}
        budgetCodes={budgetCodes}
      />,
    );

    expect(screen.getByRole("combobox", { name: "Cost Type" })).toBeDisabled();
  });
});

describe("financial line-item integrations", () => {
  const integrationOwners = [
    "src/components/budget/BudgetLineItemCreatorModal.tsx",
    "src/components/domain/contracts/prime-contract-form/sov.tsx",
    "src/components/domain/contracts/prime-contract-detail/PrimeContractSovTab.tsx",
    "src/app/(main)/[projectId]/prime-contracts/[contractId]/components/PrimeContractOverviewTab.tsx",
  ];

  it.each(integrationOwners)(
    "%s renders independent Cost Code and Cost Type owners",
    (relativePath) => {
      const source = readFileSync(join(process.cwd(), relativePath), "utf8");

      expect(source).toContain("Cost Code");
      expect(source).toContain("Cost Type");
      expect(source).toContain("<ProjectCostCodeSelector");
      expect(source).toContain("<ProjectCostTypeSelector");
    },
  );

  it("keeps the prime-contract create totals row aligned after the column split", () => {
    const source = readFileSync(
      join(
        process.cwd(),
        "src/components/domain/contracts/prime-contract-form/sov.tsx",
      ),
      "utf8",
    );

    expect(source).toContain("colSpan={isUnitQuantityMode ? 6 : 4}");
  });
});
