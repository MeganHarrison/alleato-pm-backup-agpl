/**
 * @jest-environment jsdom
 *
 * Column-integrity guardrail for the Subcontractor SOV table. It renders a
 * conditional number of columns (6 when editable, 5 when locked), and every
 * parent / child / per-parent-footer / grand-total row plus their colSpans must
 * stay aligned with the header in BOTH states.
 */

import { render, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

import { SubcontractorSovTab } from "../SubcontractorSovTab";
import { assertTableColumnIntegrity } from "@/test-utils/table-column-integrity";
import { apiFetch } from "@/lib/api-client";

jest.mock("@/lib/api-client", () => ({
  apiFetch: jest.fn(),
}));

const mockedApiFetch = apiFetch as jest.MockedFunction<typeof apiFetch>;

function payload(opts: { status: string; canEdit: boolean }) {
  return {
    data: {
      status: opts.status,
      targetAmount: 25120,
      sourceSov: [
        {
          id: "p1",
          line_number: 1,
          budget_code: "024113",
          description: "Demolition",
          amount: 25120,
          billed_to_date: 0,
        },
      ],
      lineItems: [
        {
          id: "c1",
          source_sov_item_id: "p1",
          line_number: 1,
          budget_code: "024113",
          description: "Selective demo",
          amount: 25120,
          billed_to_date: 0,
        },
      ],
      submittedAt: null,
      reviewedAt: null,
      reviewNotes: null,
      inviteSentAt: null,
      invoiceContacts: [],
      permissions: { canEdit: opts.canEdit, canReview: false, canSendNotification: false },
    },
  };
}

async function renderAndGetTable() {
  const { container } = render(<SubcontractorSovTab projectId={25125} commitmentId="test-commitment" />);
  await waitFor(() => expect(container.querySelector("table")).not.toBeNull());
  return container.querySelector("table") as HTMLTableElement;
}

beforeEach(() => {
  mockedApiFetch.mockReset();
});

describe("SubcontractorSovTab column integrity", () => {
  it("keeps every row aligned when editable (6 columns)", async () => {
    mockedApiFetch.mockResolvedValue(payload({ status: "draft", canEdit: true }));
    const table = await renderAndGetTable();
    expect(assertTableColumnIntegrity(table)).toBe(6);
  });

  it("keeps every row aligned when locked (5 columns, no actions)", async () => {
    mockedApiFetch.mockResolvedValue(payload({ status: "approved", canEdit: true }));
    const table = await renderAndGetTable();
    expect(assertTableColumnIntegrity(table)).toBe(5);
  });
});
