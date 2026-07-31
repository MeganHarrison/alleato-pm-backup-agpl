/**
 * @jest-environment jsdom
 */
/* eslint-disable design-system/no-raw-heading, design-system/no-raw-detail-field -- test doubles expose semantic roles */

import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";

import { RfiDetail } from "../rfi-detail";
import type { RFI } from "@/types/database-extensions";

jest.mock("next/navigation", () => ({ useRouter: () => ({ push: jest.fn(), refresh: jest.fn() }) }));
jest.mock("@/components/layout", () => ({
  ContentSectionStack: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DetailLayout: ({ children, sidebar }: { children: ReactNode; sidebar: ReactNode }) => <div>{children}{sidebar}</div>,
  SectionRuleHeading: ({ label }: { label: string }) => <h2>{label}</h2>,
}));
jest.mock("@/components/ds", () => ({
  EmptyState: ({ title }: { title: string }) => <div>{title}</div>,
  Form: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Heading: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
  InspectorRail: ({ children }: { children: ReactNode }) => <aside>{children}</aside>,
  InspectorSection: ({ children, title }: { children: ReactNode; title: string }) => <section><h2>{title}</h2>{children}</section>,
  PropertyList: ({ children }: { children: ReactNode }) => <dl>{children}</dl>,
  PropertyRow: ({ children, label }: { children: ReactNode; label: string }) => <div><dt>{label}</dt><dd>{children}</dd></div>,
  StatusBadge: ({ status }: { status: string }) => <span data-testid="rfi-details-status">{status}</span>,
  EditModeActions: () => null,
  EntityAttachments: () => <div>attachments</div>,
}));
jest.mock("@/components/forms", () => ({ FormSection: ({ children }: { children: ReactNode }) => <div>{children}</div> }));
jest.mock("@/components/domain/related-items/RelatedItemsPanel", () => ({ RelatedItemsPanel: () => null }));
jest.mock("@/components/rfis/rfi-responses", () => ({ RfiResponses: () => <div>responses</div> }));
jest.mock("@/components/rfis/rfi-formal-responses", () => ({ RfiFormalResponses: () => null }));
jest.mock("@/components/rfis/rfi-form-fields", () => ({ RfiFormFields: () => null }));
jest.mock("@/components/ds/InlineEditField", () => ({ InlineEditField: ({ display, value }: { display?: ReactNode; value?: string }) => <>{display ?? value}</> }));
jest.mock("@/hooks/use-rfis", () => ({ useUpdateRfi: () => ({ mutateAsync: jest.fn(), isPending: false }) }));
jest.mock("@/lib/api-client", () => ({ apiFetch: jest.fn() }));
jest.mock("react-hook-form", () => ({ useForm: () => ({ getValues: jest.fn(), setError: jest.fn(), reset: jest.fn() }) }));

const rfi = {
  id: "1df9c180-b5df-4afd-99b6-3da27289086a",
  number: 1,
  status: "open",
  subject: "Test RFI",
  question: "Test question",
  assignees: [],
  is_private: false,
  created_at: "2026-07-16T00:00:00.000Z",
} as RFI;

describe("RFI details status", () => {
  it("renders the single pill-style status in Details", () => {
    render(<RfiDetail rfi={rfi} projectId={1142} />);

    // The inspector intentionally has desktop and mobile placements; CSS shows
    // exactly one at a time on the rendered route.
    expect(screen.getAllByRole("heading", { name: "Details" })).toHaveLength(2);
    expect(screen.getAllByText("RFI Number")).toHaveLength(2);
    expect(screen.getAllByText("#1")).toHaveLength(2);
    expect(screen.getAllByText("Status")).toHaveLength(2);
    expect(screen.getAllByTestId("rfi-details-status")).toHaveLength(2);
    screen.getAllByTestId("rfi-details-status").forEach((status) => {
      expect(status).toHaveTextContent("Open");
    });
  });
});
