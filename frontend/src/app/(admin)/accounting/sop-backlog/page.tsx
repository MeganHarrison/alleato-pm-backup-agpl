"use client";

import * as React from "react";
import { CheckCircle2, FileText, Link2, Plus } from "lucide-react";
import { PageShell } from "@/components/layout";
import {
  Button,
  DataTable,
  EmptyState,
  InfoAlert,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SectionHeader,
  StatusBadge,
  Textarea,
} from "@/components/ds";
import { apiFetch } from "@/lib/api-client";

type SopStatus = "needed" | "draft" | "in_review" | "published" | "archived";
type BusinessArea = "accounting" | "finance";
type PriorityLabel = "critical" | "high" | "medium" | "low";

type SopBacklogRecord = {
  id: string;
  title: string;
  business_area: BusinessArea;
  document_type: "sop";
  status: SopStatus;
  priority: number;
  priority_label: PriorityLabel | null;
  description: string | null;
  owner: string | null;
  linked_document_metadata_id: string | null;
  linked_document_title: string | null;
  linked_document_status: string;
  project_name: string | null;
  age_days: number;
  last_updated_days: number;
  created_at: string;
  updated_at: string;
};

type SopBacklogResponse = {
  records: SopBacklogRecord[];
  generatedAt: string;
};

type FormState = {
  title: string;
  business_area: BusinessArea;
  priority: string;
  priority_label: PriorityLabel;
  owner: string;
  description: string;
};

const INITIAL_FORM: FormState = {
  title: "",
  business_area: "accounting",
  priority: "10",
  priority_label: "high",
  owner: "",
  description: "",
};

const SOP_STATUS_OPTIONS: Array<{ value: SopStatus; label: string }> = [
  { value: "needed", label: "Needed" },
  { value: "draft", label: "Draft" },
  { value: "in_review", label: "In review" },
  { value: "published", label: "Published" },
  { value: "archived", label: "Archived" },
];

function formatAge(days: number): string {
  if (days <= 0) return "Today";
  if (days === 1) return "1 day";
  return `${days} days`;
}

function priorityToneClass(priority: number): string {
  if (priority <= 10) return "text-danger";
  if (priority <= 30) return "text-warning";
  return "text-muted-foreground";
}

export default function SopBacklogPage() {
  const [records, setRecords] = React.useState<SopBacklogRecord[]>([]);
  const [form, setForm] = React.useState<FormState>(INITIAL_FORM);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const loadRecords = React.useCallback(() => {
    setIsLoading(true);
    setError(null);
    apiFetch<SopBacklogResponse>("/api/accounting/sop-backlog")
      .then((response) => setRecords(response.records))
      .catch((loadError: unknown) => {
        setError(loadError instanceof Error ? loadError.message : "Failed to load SOP backlog.");
      })
      .finally(() => setIsLoading(false));
  }, []);

  React.useEffect(() => {
    loadRecords();
  }, [loadRecords]);


  async function createRecord(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.title.trim()) {
      setError("SOP title is required.");
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const response = await apiFetch<{ record: SopBacklogRecord }>(
        "/api/accounting/sop-backlog",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: form.title,
            business_area: form.business_area,
            document_type: "sop",
            status: "needed",
            priority: Number.parseInt(form.priority, 10),
            priority_label: form.priority_label,
            owner: form.owner || null,
            description: form.description || null,
          }),
        },
      );
      setRecords((current) => [response.record, ...current]);
      setForm(INITIAL_FORM);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to create SOP backlog record.");
    } finally {
      setIsSaving(false);
    }
  }

  async function updateStatus(record: SopBacklogRecord, status: SopStatus) {
    setError(null);
    const previous = records;
    setRecords((current) =>
      current.map((item) => (item.id === record.id ? { ...item, status } : item)),
    );
    try {
      const response = await apiFetch<{ record: SopBacklogRecord }>(
        `/api/accounting/sop-backlog/${record.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        },
      );
      setRecords((current) =>
        current.map((item) => (item.id === record.id ? response.record : item)),
      );
    } catch (statusError) {
      setRecords(previous);
      setError(statusError instanceof Error ? statusError.message : "Failed to update SOP status.");
    }
  }

  return (
    <PageShell
      variant="dashboard"
      title="SOP Backlog"
      description="Track accounting and finance SOP items that still need a linked process or file."
    >
      <div className="space-y-8">
        {error && (
          <InfoAlert variant="error" role="alert">
            {error}
          </InfoAlert>
        )}

        <section aria-label="Create placeholder SOP" className="space-y-4">
          <SectionHeader title="Create placeholder SOP" />
          <p className="max-w-3xl text-sm text-muted-foreground">
            Add the requirement now and link the SOP file later in document intake.
          </p>

          <form onSubmit={createRecord} className="grid grid-cols-1 gap-4 lg:grid-cols-12">
            <div className="space-y-2 lg:col-span-4">
              <Label htmlFor="sop-title">Title</Label>
              <Input
                id="sop-title"
                value={form.title}
                onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                placeholder="Monthly close checklist SOP"
                required
              />
            </div>

            <div className="space-y-2 lg:col-span-2">
              <Label>Area</Label>
              <Select
                value={form.business_area}
                onValueChange={(value: BusinessArea) =>
                  setForm((current) => ({ ...current, business_area: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="accounting">Accounting</SelectItem>
                  <SelectItem value="finance">Finance</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 lg:col-span-2">
              <Label htmlFor="sop-priority">Priority</Label>
              <Input
                id="sop-priority"
                type="number"
                min={0}
                value={form.priority}
                onChange={(event) =>
                  setForm((current) => ({ ...current, priority: event.target.value }))
                }
              />
            </div>

            <div className="space-y-2 lg:col-span-2">
              <Label>Priority label</Label>
              <Select
                value={form.priority_label}
                onValueChange={(value: PriorityLabel) =>
                  setForm((current) => ({ ...current, priority_label: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="critical">Critical</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 lg:col-span-2">
              <Label htmlFor="sop-owner">Owner</Label>
              <Input
                id="sop-owner"
                value={form.owner}
                onChange={(event) => setForm((current) => ({ ...current, owner: event.target.value }))}
                placeholder="Owner"
              />
            </div>

            <div className="space-y-2 lg:col-span-10">
              <Label htmlFor="sop-description">Description</Label>
              <Textarea
                id="sop-description"
                value={form.description}
                onChange={(event) =>
                  setForm((current) => ({ ...current, description: event.target.value }))
                }
                placeholder="What gap does leadership need closed?"
              />
            </div>

            <div className="flex items-end lg:col-span-2">
              <Button type="submit" className="w-full gap-2" disabled={isSaving}>
                <Plus className="h-4 w-4" />
                Add SOP
              </Button>
            </div>
          </form>
        </section>

        <section aria-label="Leadership backlog" className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <SectionHeader title="Leadership backlog" count={records.length} />
            <Button variant="outline" size="sm" onClick={loadRecords} disabled={isLoading}>
              Refresh
            </Button>
          </div>

          {isLoading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Loading SOP backlog...</p>
          ) : records.length === 0 ? (
            <EmptyState
              title="No SOP backlog"
              description="Create one placeholder now to make follow-up ownership explicit."
              action={
                <Button variant="outline" size="sm" onClick={loadRecords}>
                  Reload
                </Button>
              }
            />
          ) : (
            <DataTable
              columns={[
                {
                  key: "title",
                  header: "SOP",
                  primary: true,
                  render: (record) => (
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="font-medium text-foreground">{record.title}</span>
                      </div>
                      {record.description ? (
                        <p className="max-w-md text-xs leading-relaxed text-muted-foreground">
                          {record.description}
                        </p>
                      ) : null}
                    </div>
                  ),
                },
                {
                  key: "business_area",
                  header: "Area",
                  render: (record) => <span className="capitalize">{record.business_area}</span>,
                },
                {
                  key: "status",
                  header: "Status",
                  render: (record) => (
                    <Select
                      value={record.status}
                      onValueChange={(value: SopStatus) => {
                        void updateStatus(record, value);
                      }}
                    >
                      <SelectTrigger size="sm" className="w-36 min-h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SOP_STATUS_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ),
                },
                {
                  key: "priority",
                  header: "Priority",
                  align: "right",
                  render: (record) => (
                    <div className="text-right">
                      <span className={`font-medium tabular-nums ${priorityToneClass(record.priority)}`}>
                        {record.priority}
                      </span>
                      {record.priority_label ? (
                        <p className="text-xs capitalize text-muted-foreground">
                          {record.priority_label}
                        </p>
                      ) : null}
                    </div>
                  ),
                },
                {
                  key: "owner",
                  header: "Owner",
                  render: (record) => <span>{record.owner ?? "-"}</span>,
                },
                {
                  key: "linked",
                  header: "Linked document",
                  render: (record) => (
                    <div className="flex min-w-0 items-start gap-2">
                      {record.linked_document_metadata_id ? (
                        <CheckCircle2 className="mt-0.5 h-4 w-4 text-success" />
                      ) : (
                        <Link2 className="mt-0.5 h-4 w-4 text-muted-foreground" />
                      )}
                      <div className="min-w-0">
                        <StatusBadge status={record.linked_document_status || "Draft"} />
                        {record.linked_document_title ? (
                          <p className="mt-1 text-xs text-muted-foreground">{record.linked_document_title}</p>
                        ) : null}
                      </div>
                    </div>
                  ),
                },
                {
                  key: "age",
                  header: "Age",
                  render: (record) => (
                    <div className="text-muted-foreground">
                      <p>{formatAge(record.age_days)}</p>
                      <p className="text-xs">Updated {formatAge(record.last_updated_days)}</p>
                    </div>
                  ),
                },
              ]}
              rows={records}
              emptyMessage="No SOP backlog records yet."
            />
          )}
        </section>
      </div>
    </PageShell>
  );
}
