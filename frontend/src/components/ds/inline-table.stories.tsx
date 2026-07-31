import React from "react";
import type { Meta } from "@storybook/nextjs-vite";
import {
  InlineTable,
  InlineTableBody,
  InlineTableFooter,
  InlineTableFooterCell,
  InlineTableFooterRow,
  InlineTableHeader,
  InlineTableHeaderCell,
  InlineTableHeaderRow,
  InlineTableRow,
  InlineTableCell,
} from "./inline-table";

const meta: Meta = {
  title: "Data Display/InlineTable",
  tags: ["autodocs"],
  parameters: { layout: "padded" },
};

export default meta;

export const EditVariant = {
  name: "Edit variant (SOV-style)",
  render: () => (
    <InlineTable variant="edit">
      <InlineTableHeader>
        <InlineTableHeaderRow>
          <InlineTableHeaderCell>Description</InlineTableHeaderCell>
          <InlineTableHeaderCell align="right">Scheduled Value</InlineTableHeaderCell>
          <InlineTableHeaderCell align="right">% Complete</InlineTableHeaderCell>
          <InlineTableHeaderCell align="right">Amount</InlineTableHeaderCell>
        </InlineTableHeaderRow>
      </InlineTableHeader>
      <InlineTableBody>
        {[
          { desc: "Mobilization", value: "$24,500", pct: "100%", amt: "$24,500" },
          { desc: "Site Work & Excavation", value: "$185,000", pct: "75%", amt: "$138,750" },
          { desc: "Concrete Foundation", value: "$320,000", pct: "60%", amt: "$192,000" },
          { desc: "Structural Steel", value: "$480,000", pct: "40%", amt: "$192,000" },
        ].map((row) => (
          <InlineTableRow key={row.desc}>
            <InlineTableCell>{row.desc}</InlineTableCell>
            <InlineTableCell align="right">{row.value}</InlineTableCell>
            <InlineTableCell align="right">{row.pct}</InlineTableCell>
            <InlineTableCell align="right" numeric>{row.amt}</InlineTableCell>
          </InlineTableRow>
        ))}
      </InlineTableBody>
      <InlineTableFooter>
        <InlineTableFooterRow>
          <InlineTableFooterCell>Total</InlineTableFooterCell>
          <InlineTableFooterCell align="right">$1,009,500</InlineTableFooterCell>
          <InlineTableFooterCell align="right">54%</InlineTableFooterCell>
          <InlineTableFooterCell align="right" numeric>$547,250</InlineTableFooterCell>
        </InlineTableFooterRow>
      </InlineTableFooter>
    </InlineTable>
  ),
};

export const ReadVariant = {
  name: "Read variant (detail panel)",
  render: () => (
    <InlineTable variant="read">
      <InlineTableHeader>
        <InlineTableHeaderRow>
          <InlineTableHeaderCell>Line Item</InlineTableHeaderCell>
          <InlineTableHeaderCell align="right">Original</InlineTableHeaderCell>
          <InlineTableHeaderCell align="right">Approved COs</InlineTableHeaderCell>
          <InlineTableHeaderCell align="right">Revised</InlineTableHeaderCell>
        </InlineTableHeaderRow>
      </InlineTableHeader>
      <InlineTableBody>
        {[
          { item: "03-000 Concrete", orig: "$320,000", cos: "$15,000", revised: "$335,000" },
          { item: "05-000 Metals", orig: "$480,000", cos: "$0", revised: "$480,000" },
          { item: "15-000 Mechanical", orig: "$485,000", cos: "$22,500", revised: "$507,500" },
        ].map((row) => (
          <InlineTableRow key={row.item}>
            <InlineTableCell>{row.item}</InlineTableCell>
            <InlineTableCell align="right">{row.orig}</InlineTableCell>
            <InlineTableCell align="right">{row.cos}</InlineTableCell>
            <InlineTableCell align="right" numeric>{row.revised}</InlineTableCell>
          </InlineTableRow>
        ))}
      </InlineTableBody>
    </InlineTable>
  ),
};
