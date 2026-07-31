import React from "react";
import type { Meta } from "@storybook/nextjs-vite";
import { PageTabs } from "./PageTabs";

const meta: Meta = {
  title: "Navigation/PageTabs",
  tags: ["autodocs"],
  parameters: { layout: "padded" },
};

export default meta;

const tabs = [
  { label: "Overview", href: "/overview" },
  { label: "Schedule of Values", href: "/sov", count: 14 },
  { label: "Change Orders", href: "/change-orders", count: 3 },
  { label: "Invoices", href: "/invoices", count: 7 },
  { label: "Documents", href: "/documents" },
];

function DefaultDemo() {
  const [active, setActive] = React.useState("/overview");
  return (
    <PageTabs
      tabs={tabs.map((t) => ({ ...t, isActive: t.href === active }))}
      onTabClick={setActive}
    />
  );
}

function InlineDemo() {
  const [active, setActive] = React.useState("/overview");
  return (
    <PageTabs
      variant="inline"
      tabs={tabs.map((t) => ({ ...t, isActive: t.href === active }))}
      onTabClick={setActive}
    />
  );
}

function ManyTabsDemo() {
  const manyTabs = [
    "Overview", "Budget", "Commitments", "Change Events",
    "Change Orders", "Invoicing", "RFIs", "Submittals",
    "Drawings", "Schedule", "Daily Logs", "Documents",
  ].map((label, i) => ({
    label,
    href: `/${label.toLowerCase().replace(/\s+/g, "-")}`,
    isActive: i === 0,
  }));
  const [active, setActive] = React.useState(manyTabs[0].href);
  return (
    <PageTabs
      tabs={manyTabs.map((t) => ({ ...t, isActive: t.href === active }))}
      onTabClick={setActive}
    />
  );
}

export const Default = { render: () => <DefaultDemo /> };
export const Inline = { render: () => <InlineDemo /> };
export const ManyTabs = { render: () => <ManyTabsDemo /> };
