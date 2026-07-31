import React from "react";
import type { Meta } from "@storybook/nextjs-vite";
import { Stat, StatRow } from "./stat";

const meta: Meta = {
  title: "Data Display/Stat",
  tags: ["autodocs"],
  parameters: { layout: "padded" },
};

export default meta;

export const Default = {
  render: () => <Stat label="Total Contract Value" value="$2,450,000" />,
};

export const WithChange = {
  render: () => (
    <Stat
      label="Budget Remaining"
      value="$862,500"
      change={{ value: "8.2% from last month", positive: false }}
    />
  ),
};

export const PositiveChange = {
  render: () => (
    <Stat
      label="Approved COs"
      value="$84,500"
      change={{ value: "+$12,000 this week", positive: true }}
    />
  ),
};

export const Row = {
  name: "StatRow",
  render: () => (
    <StatRow>
      <Stat label="Contract Value" value="$2,450,000" />
      <Stat label="Approved COs" value="$84,500" change={{ value: "+$22k", positive: true }} />
      <Stat label="Invoiced to Date" value="$1,200,000" />
      <Stat label="Remaining Balance" value="$1,334,500" change={{ value: "-3.1%", positive: false }} />
    </StatRow>
  ),
};

export const RowNoDividers = {
  name: "StatRow (no dividers)",
  render: () => (
    <StatRow dividers={false}>
      <Stat label="Open RFIs" value="14" />
      <Stat label="Pending Submittals" value="8" />
      <Stat label="Change Events" value="5" />
    </StatRow>
  ),
};
