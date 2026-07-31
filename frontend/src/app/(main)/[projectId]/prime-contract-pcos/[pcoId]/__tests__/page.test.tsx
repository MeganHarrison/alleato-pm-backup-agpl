/**
 * @jest-environment jsdom
 */

import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";

import PrimeContractPcoDetailPage from "../page";

jest.mock("next/navigation", () => ({
  useParams: () => ({
    projectId: "876",
    contractId: "b16a3f2a-1111-4b7a-9c2e-000000000001",
    pcoId: "f44fbfd1-5b9a-4e14-9bd9-74f983fb04fd",
  }),
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
  }),
}));

jest.mock("sonner", () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

const pcoDetail = {
  id: "f44fbfd1-5b9a-4e14-9bd9-74f983fb04fd",
  project_id: 876,
  prime_contract_id: "b16a3f2a-1111-4b7a-9c2e-000000000001",
  pco_number: "PCO-004",
  title: "Additional site work",
  status: "pending" as const,
  description: null,
  change_reason: null,
  revision: null,
  is_private: false,
  executed: false,
  signed_co_received_date: null,
  request_received_from: null,
  location: null,
  field_change: false,
  reference: null,
  paid_in_full: false,
  total_amount: 1000,
  calculated_amount: 1000,
  schedule_impact: null,
  created_at: "2026-06-01T00:00:00.000Z",
  created_by: null,
  created_by_name: null,
  updated_at: null,
  promoted_to_co_id: null,
  promoted_at: null,
  due_date: null,
  line_items: [],
  line_items_count: 0,
  change_event_links: [],
  attachments: [],
  prime_contract: {
    id: "b16a3f2a-1111-4b7a-9c2e-000000000001",
    contract_number: "PC-01",
    title: "Morrisville Prime Contract",
    status: "approved",
    contract_company: { id: "c1", name: "Acme Construction" },
    client: null,
    vendor: null,
  },
};

jest.mock("@/lib/api-client", () => ({
  apiFetch: jest.fn().mockResolvedValue(undefined),
}));

const { apiFetch } = jest.requireMock("@/lib/api-client") as {
  apiFetch: jest.Mock;
};

jest.mock("@/lib/handle-form-error", () => ({
  handleFormError: jest.fn(),
}));

jest.mock("@/lib/prime-contract-pcos/financial-markup-load", () => ({
  shouldLoadPrimeContractPcoFinancialMarkup: () => false,
}));

jest.mock("@/lib/change-orders/prime-contract-change-order-statuses", () => ({
  PRIME_CONTRACT_CHANGE_ORDER_STATUSES: [
    { value: "draft", label: "Draft" },
    { value: "pending", label: "Pending" },
    { value: "approved", label: "Approved" },
    { value: "void", label: "Void" },
  ],
}));

jest.mock("next/dynamic", () => () => {
  const DynamicStub = () => null;
  return DynamicStub;
});

jest.mock("@/components/forms", () => ({
  FileUploadField: () => null,
}));

jest.mock("@/components/ui/button", () => ({
  Button: ({ children, onClick }: { children: ReactNode; onClick?: () => void }) => (
    <div role="button" tabIndex={0} onClick={onClick}>
      {children}
    </div>
  ),
}));

jest.mock("@/components/ui/alert-dialog", () => ({
  AlertDialog: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  AlertDialogAction: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  AlertDialogCancel: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  AlertDialogContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  AlertDialogDescription: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  AlertDialogFooter: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  AlertDialogHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  AlertDialogTitle: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

jest.mock("@/components/ui/skeleton", () => ({
  Skeleton: () => <div>loading</div>,
}));

jest.mock("@/components/ds", () => ({
  DetailField: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DetailFieldGrid: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  EditableDetailField: () => <div>editable</div>,
  EmptyState: ({ title }: { title: string }) => <div>{title}</div>,
  ErrorState: ({ error }: { error: string }) => <div>{error}</div>,
  Text: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  StatusBadge: ({ status }: { status: string }) => (
    <div data-testid="pco-status-badge">{status}</div>
  ),
  InlineTable: ({ children }: { children: ReactNode }) => <table>{children}</table>,
  InlineTableHeader: ({ children }: { children: ReactNode }) => <thead>{children}</thead>,
  InlineTableHeaderRow: ({ children }: { children: ReactNode }) => <tr>{children}</tr>,
  InlineTableHeaderCell: ({ children }: { children: ReactNode }) => <th>{children}</th>,
  InlineTableBody: ({ children }: { children: ReactNode }) => <tbody>{children}</tbody>,
  InlineTableRow: ({ children }: { children: ReactNode }) => <tr>{children}</tr>,
  InlineTableCell: ({ children }: { children: ReactNode }) => <td>{children}</td>,
}));

jest.mock("@/components/layout", () => ({
  ContentSectionStack: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  PageTabs: () => <div data-testid="pco-page-tabs">tabs</div>,
  PageShell: ({
    children,
    title,
    actions,
  }: {
    children: ReactNode;
    title: string;
    actions?: ReactNode;
  }) => (
    <main>
      <h1>{title}</h1>
      {actions}
      {children}
    </main>
  ),
}));

jest.mock("@/components/layout/spacing", () => ({
  SectionRuleHeading: ({ label }: { label: string }) => <div>{label}</div>,
}));

jest.mock("../prime-contract-pco-header-actions", () => ({
  PrimeContractPcoHeaderActions: () => <div>header-actions</div>,
}));

describe("PrimeContractPcoDetailPage", () => {
  beforeEach(() => {
    apiFetch.mockReset();
    apiFetch.mockResolvedValue(pcoDetail);
  });

  it("renders the status/related-contract block below the title and above the tabs", async () => {
    render(<PrimeContractPcoDetailPage />);

    const statusBadge = await screen.findByTestId("pco-status-badge");
    const tabs = screen.getByTestId("pco-page-tabs");

    // The status + related contract block must render before (above) the tab
    // bar — it belongs directly under the page title, not below the tabs.
    const statusComesBeforeTabs = Boolean(
      statusBadge.compareDocumentPosition(tabs) & Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(statusComesBeforeTabs).toBe(true);
  });
});
