import {
  buildContinuationSections,
  buildSubcontractorInvoicePdfFilename,
} from "@/lib/subcontractor-invoice-pdf-helpers";
import React from "react";

jest.mock("@react-pdf/renderer", () => {
  const React = require("react");
  return {
    Document: ({ children }: { children: React.ReactNode }) =>
      React.createElement("Document", null, children),
    Page: ({ children, ...props }: { children: React.ReactNode }) =>
      React.createElement("Page", props, children),
    StyleSheet: { create: (styles: unknown) => styles },
    Text: ({ children, ...props }: { children: React.ReactNode }) =>
      React.createElement("Text", props, children),
    View: ({ children, ...props }: { children: React.ReactNode }) =>
      React.createElement("View", props, children),
    renderToBuffer: jest.fn(),
  };
});

import { Page } from "@react-pdf/renderer";
import { SubcontractorInvoicePdfDocument } from "@/lib/subcontractor-invoice-pdf";

function makeBaseData() {
  return {
    id: 8092,
    invoice_number: "APP-01",
    application_number: 1,
    status: "under_review",
    period_start: "2026-06-01",
    period_end: "2026-06-30",
    billing_date: "2026-06-30",
    created_at: "2026-07-01T03:43:25.337017+00:00",
    notes: null,
    project_name: "Exol Morrisville",
    project_number: "26-116",
    project_address: "2300 South Pennsylvania Ave",
    contract_number: "PO-000125",
    contract_title: "PO-000125",
    contract_date: "2026-05-27",
    gc_company_name: "Alleato Group",
    gc_company_address: "8383 Craig Street, Suite 150",
    gc_company_city: "Indianapolis",
    gc_company_state: "IN",
    gc_company_zip: "46250",
    contract_company_name: "R.J. Skelding Co, Inc",
    contract_company_address: "840 N. Dauphin Street",
    contract_company_city: "Allentown",
    contract_company_state: "PA",
    contract_company_zip: "18109",
    line_items: [
      {
        id: 22,
        sort_order: 1,
        budget_code: "506500",
        description: "Cost of Contracts- Subco",
        scheduled_value: 28000,
        work_completed_previous: 0,
        work_completed_period: 2000,
        materials_stored: 0,
        total_completed_stored: 2000,
        retainage_pct: 0,
        retainage_amount: 0,
        materials_retainage_pct: 0,
        materials_retainage_amount: 0,
        net_amount_this_period: 2000,
      },
    ],
    contract_lines: [
      {
        id: "line-1",
        line_number: 1,
        sort_order: 1,
        budget_code: "506500",
        description: "Cost of Contracts- Subco",
        amount: 28000,
      },
    ],
    approved_change_orders: [
      {
        id: "co-1",
        change_order_number: "CE-001",
        title: "Change Event 000125",
        description: "This is a Change Event",
        amount: 500,
      },
    ],
    rollup: {
      original_contract_sum: 28000,
      net_change_by_change_orders: 500,
      contract_sum_to_date: 28500,
      total_completed_and_stored: 2000,
      total_work_retainage: 0,
      total_materials_retainage: 0,
      total_retainage: 0,
      total_earned_less_retainage: 2000,
      less_previous_certificates: 0,
      current_payment_due: 2000,
      balance_to_finish_including_retainage: 26500,
      change_order_additions: 500,
      change_order_deductions: 0,
    },
    attachments: [],
  };
}

function collectRenderedText(node: React.ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(collectRenderedText).join(" ");
  if (!React.isValidElement(node)) return "";

  if (typeof node.type === "function") {
    return collectRenderedText(
      node.type(node.props as Record<string, unknown>) as React.ReactNode,
    );
  }

  return collectRenderedText(
    (node.props as { children?: React.ReactNode }).children,
  );
}

function collectElements(
  node: React.ReactNode,
  predicate: (element: React.ReactElement) => boolean,
): React.ReactElement[] {
  if (node == null || typeof node === "boolean") return [];
  if (Array.isArray(node)) {
    return node.flatMap((child) => collectElements(child, predicate));
  }
  if (!React.isValidElement(node)) return [];

  const matches = predicate(node) ? [node] : [];
  const children = (node.props as { children?: React.ReactNode }).children;
  return matches.concat(collectElements(children, predicate));
}

describe("subcontractor invoice pdf helpers", () => {
  it("builds a Procore-style filename from project metadata", () => {
    const filename = buildSubcontractorInvoicePdfFilename(
      makeBaseData(),
      new Date("2026-07-04T12:00:00.000Z"),
    );

    expect(filename).toBe(
      "26-116-Exol_Morrisville-1-Invoice_1-2026-07-04.pdf",
    );
  });

  it("builds continuation sections with contract, change order, and grand total rows", () => {
    const sections = buildContinuationSections(makeBaseData());

    expect(sections.contractRows).toHaveLength(1);
    expect(sections.contractRows[0]).toMatchObject({
      itemNo: "1",
      budgetCode: "506500",
      scheduledValue: 28000,
      thisPeriodWork: 2000,
      totalCompletedStored: 2000,
      balanceToFinish: 26000,
    });

    expect(sections.changeOrderRows).toHaveLength(1);
    expect(sections.changeOrderRows[0]).toMatchObject({
      itemNo: "2",
      budgetCode: "CE-001",
      scheduledValue: 500,
      totalCompletedStored: 0,
      balanceToFinish: 500,
    });

    expect(sections.grandTotals).toMatchObject({
      scheduledValue: 28500,
      previousWork: 0,
      thisPeriodWork: 2000,
      totalCompletedStored: 2000,
      balanceToFinish: 26500,
    });
  });

  it("renders all invoice PDF pages in landscape orientation", () => {
    const document = SubcontractorInvoicePdfDocument({ data: makeBaseData() });
    const pages = React.Children.toArray(document.props.children).filter(
      (child): child is React.ReactElement<{ orientation?: string }> =>
        React.isValidElement(child) && child.type === Page,
    );

    expect(pages).toHaveLength(2);
    expect(pages.every((page) => page.props.orientation === "landscape")).toBe(
      true,
    );
  });

  it("renders the Alleato footer on every invoice PDF page", () => {
    const document = SubcontractorInvoicePdfDocument({ data: makeBaseData() });
    const pages = React.Children.toArray(document.props.children).filter(
      (child): child is React.ReactElement<{ children?: React.ReactNode }> =>
        React.isValidElement(child) && child.type === Page,
    );

    expect(pages).toHaveLength(2);
    for (const page of pages) {
      const pageText = JSON.stringify(page.props.children);
      expect(pageText).toContain("Alleato group subcontractor invoice");
    }
  });

  it("renders the Procore-style continuation sheet columns", () => {
    const document = SubcontractorInvoicePdfDocument({ data: makeBaseData() });
    const pages = React.Children.toArray(document.props.children).filter(
      (child): child is React.ReactElement<{ children?: React.ReactNode }> =>
        React.isValidElement(child) && child.type === Page,
    );
    const continuationText = collectRenderedText(pages[1]);

    for (const label of [
      "Use Column I on Contracts where variable retainage for line items apply.",
      "ITEM NO.",
      "BUDGET CODE",
      "DESCRIPTION OF WORK",
      "SCHEDULED\nVALUE",
      "FROM PREVIOUS\nAPPLICATION\n(D + E)",
      "THIS\nPERIOD",
      "MATERIALS\nPRESENTLY STORED\n(NOT IN D OR E)",
      "TOTAL COMPLETED\nAND STORED TO DATE\n(D + E + F)",
      "%\n(G / C)",
      "BALANCE TO\nFINISH\n(C - G)",
      "RETAINAGE",
    ]) {
      expect(continuationText).toContain(label);
    }

    for (const column of ["A", "B", "C", "D", "E", "F", "G", "H", "I"]) {
      expect(continuationText).toContain(column);
    }
  });

  it("narrows the continuation table container to fit the landscape page", () => {
    const document = SubcontractorInvoicePdfDocument({ data: makeBaseData() });
    const pages = React.Children.toArray(document.props.children).filter(
      (child): child is React.ReactElement<{ children?: React.ReactNode }> =>
        React.isValidElement(child) && child.type === Page,
    );

    const detailTableComponents = collectElements(
      pages[1],
      (element) => typeof element.type === "function" && element.type.name === "DetailTable",
    );

    expect(detailTableComponents).toHaveLength(3);
    for (const component of detailTableComponents) {
      const rendered = component.type(component.props) as React.ReactElement<{
        style?: Record<string, unknown> | Array<Record<string, unknown>>;
      }>;
      const style = Array.isArray(rendered.props.style)
        ? Object.assign({}, ...rendered.props.style)
        : rendered.props.style ?? {};

      expect(style).toEqual(
        expect.objectContaining({
          width: "98.5%",
          alignSelf: "flex-start",
          borderTopWidth: 1,
        }),
      );
    }
  });
});
