"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import { DataTable, type TableColumn } from "@/components/ds/data-table";
import { ExpandableSearch } from "@/components/tables/unified/table-toolbar";
import { PageShell } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { buildCrmWorkspaceTabs } from "@/features/crm/crm-workspace-tabs";
import { useCrmWorkspace } from "@/hooks/use-crm";
import type { CrmLead } from "@/lib/crm/types";

const COLUMNS: TableColumn<CrmLead>[] = [
  {
    key: "name",
    header: "Lead",
    primary: true,
    render: (lead) => (
      <Link
        className="underline-offset-4 hover:text-primary hover:underline"
        href={`/crm/leads?leadId=${encodeURIComponent(lead.id)}`}
        onClick={(event) => event.stopPropagation()}
      >
        {lead.fullName}
      </Link>
    ),
  },
  {
    key: "company",
    header: "Prospect company",
    render: (lead) => lead.prospectCompanyName,
  },
  { key: "title", header: "Title", render: (lead) => lead.jobTitle ?? "—" },
  { key: "email", header: "Email", render: (lead) => lead.email ?? "—" },
  { key: "phone", header: "Phone", render: (lead) => lead.phone ?? "—" },
  { key: "owner", header: "Owner", render: (lead) => lead.owner.name },
  { key: "status", header: "Status", render: (lead) => lead.status },
  {
    key: "follow-up",
    header: "Next follow-up",
    render: (lead) => lead.nextFollowUpAt ?? "—",
  },
];

export function CrmLeadsWorkspace() {
  const pathname = usePathname();
  const router = useRouter();
  const { leads, createLead, isLoading, error, refresh } = useCrmWorkspace();
  const [query, setQuery] = React.useState("");
  const [isAdding, setIsAdding] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [form, setForm] = React.useState({
    fullName: "",
    prospectCompanyName: "",
    jobTitle: "",
    email: "",
    phone: "",
  });

  const visibleLeads = React.useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const activeLeads = leads.filter((lead) => lead.status !== "converted");
    if (!normalized) return activeLeads;
    return activeLeads.filter((lead) =>
      [
        lead.fullName,
        lead.prospectCompanyName,
        lead.jobTitle,
        lead.email,
        lead.phone,
      ]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(normalized)),
    );
  }, [leads, query]);

  const save = async () => {
    setFormError(null);
    if (!form.fullName.trim() || !form.prospectCompanyName.trim()) {
      setFormError("Enter the person's name and prospect company.");
      return;
    }
    setIsSaving(true);
    try {
      const lead = await createLead({
        fullName: form.fullName.trim(),
        prospectCompanyName: form.prospectCompanyName.trim(),
        jobTitle: form.jobTitle.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
      });
      setForm({
        fullName: "",
        prospectCompanyName: "",
        jobTitle: "",
        email: "",
        phone: "",
      });
      setIsAdding(false);
      toast.success("Lead added");
      router.push(`/crm/leads?leadId=${encodeURIComponent(lead.id)}`);
    } catch (caught) {
      const message =
        caught instanceof Error ? caught.message : "Refresh and try again.";
      setFormError(message);
      toast.error("Lead could not be added", {
        description: message,
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <PageShell
      variant="table"
      title="Leads"
      description="Track people before they become customers. A deal is optional, and no Acumatica company is created."
      tabs={buildCrmWorkspaceTabs(pathname)}
      actions={
        <Button onClick={() => setIsAdding((value) => !value)}>
          <Plus className="mr-2 size-4" /> Add lead
        </Button>
      }
    >
      {isAdding ? (
        <form
          className="rounded-lg border border-border bg-muted/20 p-4"
          aria-label="Add lead"
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape" && !isSaving) {
              setFormError(null);
              setIsAdding(false);
            }
          }}
        >
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <Input
              name="full_name"
              aria-label="Full name"
              placeholder="Full name *"
              value={form.fullName}
              onChange={(event) =>
                setForm((value) => ({ ...value, fullName: event.target.value }))
              }
            />
            <Input
              name="prospect_company_name"
              aria-label="Prospect company"
              placeholder="Prospect company *"
              value={form.prospectCompanyName}
              onChange={(event) =>
                setForm((value) => ({
                  ...value,
                  prospectCompanyName: event.target.value,
                }))
              }
            />
            <Input
              name="job_title"
              aria-label="Job title"
              placeholder="Job title"
              value={form.jobTitle}
              onChange={(event) =>
                setForm((value) => ({ ...value, jobTitle: event.target.value }))
              }
            />
            <Input
              name="email"
              aria-label="Email"
              type="email"
              placeholder="Email"
              value={form.email}
              onChange={(event) =>
                setForm((value) => ({ ...value, email: event.target.value }))
              }
            />
            <Input
              name="phone"
              aria-label="Phone"
              placeholder="Phone"
              value={form.phone}
              onChange={(event) =>
                setForm((value) => ({ ...value, phone: event.target.value }))
              }
            />
          </div>
          {formError ? (
            <p role="alert" className="mt-3 text-sm text-destructive">
              {formError}
            </p>
          ) : null}
          <div className="mt-3 flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setIsAdding(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving} aria-busy={isSaving}>
              {isSaving ? "Saving..." : "Save lead"}
            </Button>
          </div>
        </form>
      ) : null}

      <ExpandableSearch
        value={query}
        onChange={setQuery}
        placeholder="Search people, companies, email, or phone"
        ariaLabel="Search leads"
      />

      {error ? (
        <div className="rounded-lg border border-destructive/30 p-6 text-sm">
          <p>Leads could not be loaded.</p>
          <Button
            className="mt-3"
            variant="outline"
            onClick={() => void refresh()}
          >
            Try again
          </Button>
        </div>
      ) : isLoading ? (
        <p className="py-16 text-center text-sm text-muted-foreground">
          Loading leads...
        </p>
      ) : (
        <div className="rounded-lg border border-border bg-muted/20">
          <DataTable
            rows={visibleLeads}
            columns={COLUMNS}
            emptyMessage="No leads yet. Add the first person to start your deal flow."
            onRowClick={(lead) =>
              router.push(`/crm/leads?leadId=${encodeURIComponent(lead.id)}`)
            }
          />
        </div>
      )}
    </PageShell>
  );
}
