/** @jest-environment jsdom */

import { render, screen } from "@testing-library/react";

import { ChangeEventForm } from "../ChangeEventForm";

const mockGeneralInfoSection = jest.fn(
  ({ showDescription }: { showDescription?: boolean }) => (
    <div data-testid="general-info-section">
      {showDescription === false ? "description-hidden" : "description-visible"}
    </div>
  ),
);

jest.mock("../change-event-form", () => ({
  GeneralInfoSection: (props: unknown) => mockGeneralInfoSection(props as { showDescription?: boolean }),
  LineItemsSection: () => <div data-testid="line-items-section" />,
  useChangeEventFormData: () => ({
    // RHF-backed form stub — only the members ChangeEventForm touches at render.
    form: {
      watch: (name: string) =>
        name === "attachments" ? [] : name === "expectingRevenue" ? true : "",
      getValues: () => [],
      setValue: jest.fn(),
      handleSubmit: () => (event?: { preventDefault?: () => void }) => {
        event?.preventDefault?.();
      },
      control: {},
      formState: { errors: {} },
    },
    lineItemFields: [],
    nextNumber: "CE-001",
    updateLineItem: jest.fn(),
    vendors: [],
    contracts: [],
    budgetCodes: [],
    primeContractOptions: [],
    primeContractSelectOptions: [],
    commitmentLineItemsMap: {},
    showCreateBudgetCodeModal: false,
    setShowCreateBudgetCodeModal: jest.fn(),
    setTargetBudgetCodeRowIndex: jest.fn(),
    handleCommitmentChange: jest.fn(),
    handleCommitmentLineItemChange: jest.fn(),
    handleAddAllCommitmentLineItems: jest.fn(),
    addLineItem: jest.fn(),
    removeLineItem: jest.fn(),
    csvInputRef: { current: null },
    handleCsvImport: jest.fn(),
    handleBudgetCodeCreated: jest.fn(),
  }),
}));

describe("ChangeEventForm", () => {
  beforeEach(() => {
    mockGeneralInfoSection.mockClear();
  });

  it("keeps description visible in edit mode", () => {
    render(
      <ChangeEventForm
        initialData={{}}
        onSubmit={jest.fn()}
        onCancel={jest.fn()}
        mode="edit"
        projectId={754}
      />,
    );

    expect(screen.getByText("description-visible")).toBeInTheDocument();
    expect(mockGeneralInfoSection).toHaveBeenCalled();
    expect(mockGeneralInfoSection.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        projectId: 754,
      }),
    );
  });
});
