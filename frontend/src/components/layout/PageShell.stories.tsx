import React from "react";
import type { Meta } from "@storybook/nextjs-vite";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ds/status-badge";
import { PageShell } from "./page-shell";

const meta: Meta = {
  title: "Layout/PageShell",
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
};

export default meta;

export const Dashboard = {
  render: () => (
    <PageShell variant="dashboard" title="Project Overview">
      <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        Dashboard content — KPI cards, charts, summary panels
      </div>
    </PageShell>
  ),
};

export const TablePage = {
  render: () => (
    <PageShell
      variant="table"
      title="Subcontracts"
      actions={<Button size="sm">+ New Subcontract</Button>}
    >
      <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        Table content — UnifiedTablePage goes here
      </div>
    </PageShell>
  ),
};

export const FormPage = {
  render: () => (
    <PageShell
      variant="form"
      title="Create Subcontract"
      onBack={() => {}}
    >
      <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        Form content — FormSection, FormGrid, FormActions
      </div>
    </PageShell>
  ),
};

export const DetailPage = {
  render: () => (
    <PageShell
      variant="detail"
      title="SC-042 — Pacific Mechanical Inc."
      statusBadge={<StatusBadge status="active" />}
      actions={<Button size="sm" variant="outline">Edit</Button>}
    >
      <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        Detail content — tabs, line items, related records
      </div>
    </PageShell>
  ),
};

export const ContentPage = {
  render: () => (
    <PageShell
      variant="content"
      title="Project Settings"
      description="Configure project-level settings and permissions."
    >
      <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        Settings / documentation / read-heavy content
      </div>
    </PageShell>
  ),
};
