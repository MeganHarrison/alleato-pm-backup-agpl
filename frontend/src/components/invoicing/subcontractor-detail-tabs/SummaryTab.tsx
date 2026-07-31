"use client";

import { useState } from "react";
import { format, isValid, parse } from "date-fns";
import { Calendar as CalendarIcon, Paperclip, Upload, X } from "lucide-react";
import { toast } from "sonner";

import { apiFetch } from "@/lib/api-client";
import { buildAcumaticaApBillHref } from "@/lib/acumatica/ap-bill-url";
import { DetailField, DetailFieldGrid, InfoAlert } from "@/components/ds";
import { InvoiceStatusBadge } from "@/components/invoicing/InvoiceStatusBadge";
import { LabelValueRow } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { formatPercent } from "@/lib/table-config/formatters";
import { formatCurrency, formatDate, type InvoiceRollup } from "./shared";
import { SectionRuleHeading } from "@/components/layout/spacing";

const DATE_FORMATS = [
  "MM/dd/yyyy",
  "M/d/yyyy",
  "MM-dd-yyyy",
  "M-d-yyyy",
  "yyyy-MM-dd",
  "MMM d, yyyy",
  "MMMM d, yyyy",
];

function parseInputDate(input: string): Date | undefined {
  for (const fmt of DATE_FORMATS) {
    const parsed = parse(input, fmt, new Date());
    if (isValid(parsed) && parsed.getFullYear() > 1900) return parsed;
  }
  return undefined;
}

function isoToDisplay(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  return isValid(d) ? format(d, "MM/dd/yyyy") : iso;
}

function displayToIso(display: string): string {
  const d = parseInputDate(display);
  return d ? format(d, "yyyy-MM-dd") : "";
}

type Attachment = {
  id?: string | number;
  file_name?: string | null;
  url?: string | null;
};

type CoSummary = {
  additions: number;
  deductions: number;
  net: number;
};

type InvoiceShape = {
  subcontract_id?: number | null;
  purchase_order_id?: number | null;
  acumatica_doc_type?: string | null;
  acumatica_ref_nbr?: string | null;
  acumatica_sync_at?: string | null;
  contract_number?: string | null;
  contract_title?: string | null;
  contract_company_name?: string | null;
  contract_company_address?: string | null;
  contract_company_city?: string | null;
  contract_company_state?: string | null;
  contract_company_zip?: string | null;
  contract_date?: string | null;
  gc_company_name?: string | null;
  gc_company_address?: string | null;
  gc_company_city?: string | null;
  gc_company_state?: string | null;
  gc_company_zip?: string | null;
  project_name?: string | null;
  project_number?: string | null;
  project_address?: string | null;
  application_number?: number | null;
  billing_period_name?: string | null;
  invoice_number?: string | null;
  period_start?: string | null;
  period_end?: string | null;
  billing_date?: string | null;
  status?: string | null;
  percent_complete?: number | null;
  approved_at?: string | null;
  submitted_at?: string | null;
  notes?: string | null;
  attachments?: Attachment[] | null;
  rollup?: InvoiceRollup | null;
  co_summary?: CoSummary | null;
};

function InlineDatePicker({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const dateValue = parseInputDate(value);

  return (
    <div className="flex gap-1">
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="MM/DD/YYYY"
        aria-label={label}
        className="h-8 w-44"
      />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 shrink-0"
            aria-label={`Open calendar for ${label}`}
          >
            <CalendarIcon className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <Calendar
            mode="single"
            selected={dateValue}
            onSelect={(date) => {
              onChange(date ? format(date, "MM/dd/yyyy") : "");
              setOpen(false);
            }}
            initialFocus
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

function formatCompanyAddress(
  address?: string | null,
  city?: string | null,
  state?: string | null,
  zip?: string | null,
): string[] {
  const lines: string[] = [];
  if (address) lines.push(address);
  const cityStateZip = [city, state].filter(Boolean).join(", ");
  if (cityStateZip || zip) {
    lines.push([cityStateZip, zip].filter(Boolean).join(" "));
  }
  return lines;
}

interface SummaryTabProps {
  invoice: InvoiceShape;
  editing?: boolean;
  projectId?: string;
  invoiceId?: number;
  onSave?: () => Promise<void>;
  onCancel?: () => void;
}

export function SummaryTab({
  invoice,
  editing = false,
  projectId,
  invoiceId,
  onSave,
  onCancel,
}: SummaryTabProps) {
  const attachments = invoice.attachments ?? [];

  const [fields, setFields] = useState({
    invoice_number: invoice.invoice_number ?? "",
    period_start: isoToDisplay(invoice.period_start?.split("T")[0] ?? ""),
    period_end: isoToDisplay(invoice.period_end?.split("T")[0] ?? ""),
    billing_date: isoToDisplay(invoice.billing_date?.split("T")[0] ?? ""),
    notes: invoice.notes ?? "",
  });
  const [saving, setSaving] = useState(false);

  function updateField(key: keyof typeof fields, value: string) {
    setFields((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    if (!projectId || !invoiceId) return;
    setSaving(true);
    try {
      const payload = {
        ...fields,
        period_start: displayToIso(fields.period_start),
        period_end: displayToIso(fields.period_end),
        billing_date: displayToIso(fields.billing_date),
      };
      await apiFetch(
        `/api/projects/${projectId}/invoicing/subcontractor/invoices/${invoiceId}`,
        {
          method: "PATCH",
          body: JSON.stringify(payload),
        },
      );
      toast.success("Invoice updated");
      await onSave?.();
    } catch (err) {
      const message = err instanceof Error && err.message ? err.message : "Failed to save";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  const gcAddress = formatCompanyAddress(
    invoice.gc_company_address,
    invoice.gc_company_city,
    invoice.gc_company_state,
    invoice.gc_company_zip,
  );
  const subAddress = formatCompanyAddress(
    invoice.contract_company_address,
    invoice.contract_company_city,
    invoice.contract_company_state,
    invoice.contract_company_zip,
  );

  const coSummary = invoice.co_summary;
  const changeOrderAdditions = coSummary?.additions ?? 0;
  const changeOrderDeductions = coSummary?.deductions ?? 0;
  const changeOrderNet = coSummary?.net ?? 0;
  const erpRefNbr = invoice.acumatica_ref_nbr?.trim();
  const erpDocType = invoice.acumatica_doc_type?.trim() || "Bill";
  const erpHref = erpRefNbr
    ? buildAcumaticaApBillHref(erpDocType, erpRefNbr)
    : null;
  const isErpLinked = Boolean(invoice.acumatica_sync_at || erpRefNbr);

  // An invoice not linked to a subcontract/PO commitment cannot resolve its
  // contract company, commitment number, original contract sum, or SOV — the
  // whole G702 form renders blank/$0. Surface that loudly instead of letting a
  // broken-looking page masquerade as a bug.
  const isUnlinked = !invoice.subcontract_id && !invoice.purchase_order_id;

  return (
    <div className="space-y-12">
      {isUnlinked && (
        <InfoAlert variant="warning" role="alert">
          <span className="font-medium">Not linked to a commitment.</span> This
          invoice has no subcontract or purchase order, so the contract company,
          commitment number, and original contract sum below cannot be shown and
          the totals read $0. Link it to its commitment to populate this form
          {invoice.notes ? (
            <>
              {" "}(the notes reference{" "}
              <span className="font-medium">{invoice.notes}</span>)
            </>
          ) : null}
          .
        </InfoAlert>
      )}

      {/* Edit actions bar */}
      {editing && (
        <div className="flex items-center justify-end gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={saving}
            onClick={onCancel}
          >
            <X className="h-4 w-4 mr-1" /> Cancel
          </Button>
          <Button size="sm" disabled={saving} onClick={handleSave}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      )}

      {/* ── Section 1: General Information ── */}
      <section className="space-y-4">
        <SectionRuleHeading label="General Information" />
        <DetailFieldGrid columns={2}>
          <DetailField label="Period Start">
            {editing ? (
              <InlineDatePicker
                value={fields.period_start}
                onChange={(v) => updateField("period_start", v)}
                label="Period Start"
              />
            ) : (
              formatDate(invoice.period_start)
            )}
          </DetailField>
          <DetailField label="Period End">
            {editing ? (
              <InlineDatePicker
                value={fields.period_end}
                onChange={(v) => updateField("period_end", v)}
                label="Period End"
              />
            ) : (
              formatDate(invoice.period_end)
            )}
          </DetailField>
          <DetailField label="Billing Date">
            {editing ? (
              <InlineDatePicker
                value={fields.billing_date}
                onChange={(v) => updateField("billing_date", v)}
                label="Billing Date"
              />
            ) : (
              formatDate(invoice.billing_date)
            )}
          </DetailField>
          <DetailField label="Invoice #">
            {editing ? (
              <Input
                type="text"
                className="h-8 w-44"
                value={fields.invoice_number}
                onChange={(e) => updateField("invoice_number", e.target.value)}
                placeholder="Invoice number"
                maxLength={255}
              />
            ) : (
              invoice.invoice_number ?? "—"
            )}
          </DetailField>
          <DetailField label="ERP Link">
            {erpHref && erpRefNbr ? (
              <a
                href={erpHref}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium text-primary underline-offset-4 hover:underline"
              >
                {erpDocType} {erpRefNbr}
              </a>
            ) : isErpLinked ? (
              "Linked, missing ERP reference"
            ) : (
              "Not linked"
            )}
          </DetailField>
          <DetailField label="Commitment #">
            {invoice.contract_number ?? "—"}
            {invoice.contract_title ? ` — ${invoice.contract_title}` : ""}
          </DetailField>
          <DetailField label="Contract Company">
            {invoice.contract_company_name ?? "—"}
          </DetailField>
          <DetailField label="Status">
            {invoice.status ? (
              <InvoiceStatusBadge status={invoice.status} />
            ) : (
              "—"
            )}
          </DetailField>
          <DetailField label="Percent Complete">
            {formatPercent(invoice.percent_complete ?? 0, 2)}
          </DetailField>
          <DetailField label="Payment Date">
            {formatDate(invoice.approved_at)}
          </DetailField>
          <DetailField label="Submitted">
            {formatDate(invoice.submitted_at)}
          </DetailField>
          <DetailField label="Overall Comments" span={2}>
            {editing ? (
              <Textarea
                className="min-h-16 text-sm"
                value={fields.notes}
                onChange={(e) => updateField("notes", e.target.value)}
                placeholder="Add comments…"
              />
            ) : (
              invoice.notes ?? "—"
            )}
          </DetailField>
        </DetailFieldGrid>
      </section>

      {/* ── Section 2: Summary Preview (AIA G702-style) ── */}
      <section className="space-y-6">
        <SectionRuleHeading label="Summary Preview" />

        {/* TO / FROM address blocks (stacked) + Project metadata (right column) */}
        <div className="grid grid-cols-1 gap-y-6 sm:grid-cols-2 sm:gap-x-20 sm:gap-y-0">
          {/* Left column: stacked TO then FROM */}
          <div className="space-y-6">
            <div className="space-y-1 text-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                To General Contractor
              </p>
              <p className="font-medium text-foreground">
                {invoice.gc_company_name ?? "—"}
              </p>
              {gcAddress.map((line, i) => (
                <p key={i} className="text-muted-foreground">{line}</p>
              ))}
            </div>
            <div className="space-y-1 text-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                From Subcontractor
              </p>
              <p className="font-medium text-foreground">
                {invoice.contract_company_name ?? "—"}
              </p>
              {subAddress.map((line, i) => (
                <p key={i} className="text-muted-foreground">{line}</p>
              ))}
            </div>
          </div>

          {/* Right column: Project / Application metadata */}
          <DetailFieldGrid columns={1} className="gap-y-2">
            <DetailField label="Project">
              {invoice.project_name ?? "—"}
            </DetailField>
            <DetailField label="Project Number">
              {invoice.project_number ?? "—"}
            </DetailField>
            <DetailField label="Application No.">
              {invoice.application_number ?? "—"}
            </DetailField>
            <DetailField label="Period To">
              {formatDate(invoice.period_end)}
            </DetailField>
            <DetailField label="Subcontract Date">
              {formatDate(invoice.contract_date)}
            </DetailField>
            <DetailField label="Contract For">
              {invoice.project_name ?? "—"}
            </DetailField>
          </DetailFieldGrid>
        </div>

        {/* Subcontractor's Application for Payment (G702 rollup) */}
        {invoice.rollup && (
          <div className="space-y-4">
            <SectionRuleHeading label="Subcontractor's Application for Payment" />
            <p className="text-sm text-muted-foreground">
              Application is made for payment, as shown below, in connection
              with the Contract. Continuation sheet is attached.
            </p>
            <dl className="divide-y divide-border text-sm">
              {[
                {
                  label: "1. Original Contract Sum",
                  value: invoice.rollup.original_contract_sum,
                },
                {
                  label: "2. Net Change by Change Orders",
                  value: invoice.rollup.net_change_by_change_orders,
                },
                {
                  label: "3. Contract Sum to Date (1 + 2)",
                  value: invoice.rollup.contract_sum_to_date,
                  emphasis: true,
                },
                {
                  label: "4. Total Completed & Stored to Date",
                  value: invoice.rollup.total_completed_and_stored,
                },
                {
                  label: "5a. Work Retainage",
                  value: invoice.rollup.total_work_retainage ?? 0,
                },
                {
                  label: "5b. Materials Retainage",
                  value: invoice.rollup.total_materials_retainage ?? 0,
                },
                {
                  label: "5. Total Retainage (5a + 5b)",
                  value: invoice.rollup.total_retainage,
                },
                {
                  label: "6. Total Earned Less Retainage (4 − 5)",
                  value: invoice.rollup.total_earned_less_retainage,
                  emphasis: true,
                },
                {
                  label: "7. Less Previous Certificates for Payment",
                  value: invoice.rollup.less_previous_certificates,
                },
                {
                  label: "8. Current Payment Due (6 − 7)",
                  value: invoice.rollup.current_payment_due,
                  emphasis: true,
                },
                {
                  label: "9. Balance to Finish, Including Retainage (3 − 6)",
                  value: invoice.rollup.balance_to_finish_including_retainage,
                },
              ].map((row) => (
                <div
                  key={row.label}
                  className="flex items-center justify-between py-2"
                >
                  <dt
                    className={
                      row.emphasis
                        ? "font-semibold text-foreground"
                        : "text-muted-foreground"
                    }
                  >
                    {row.label}
                  </dt>
                  <dd
                    className={`tabular-nums ${
                      row.emphasis
                        ? "font-semibold text-foreground"
                        : "text-foreground"
                    }`}
                  >
                    {formatCurrency(row.value)}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        )}

        <div className="space-y-4">
          <SectionRuleHeading label="Change Order Summary" />
          <div className="overflow-hidden border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-1/2 align-bottom text-xs uppercase text-foreground">
                    Change Order Summary
                  </TableHead>
                  <TableHead className="w-1/4 text-xs uppercase text-foreground">
                    Additions
                  </TableHead>
                  <TableHead className="w-1/4 text-xs uppercase text-foreground">
                    Deductions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[
                  {
                    label:
                      "Total changes approved in previous months by Owner/Client:",
                    additions: changeOrderAdditions,
                    deductions: changeOrderDeductions,
                  },
                  {
                    label: "Total approved this Month:",
                    additions: 0,
                    deductions: 0,
                  },
                  {
                    label: "Totals:",
                    additions: changeOrderAdditions,
                    deductions: changeOrderDeductions,
                  },
                ].map((row) => (
                  <TableRow key={row.label}>
                    <TableCell className="text-sm">{row.label}</TableCell>
                    <TableCell className="text-right tabular-nums text-sm">
                      {formatCurrency(row.additions)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-sm">
                      {formatCurrency(row.deductions)}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow>
                  <TableCell className="text-sm font-medium">
                    Net changes by change order:
                  </TableCell>
                  <TableCell
                    colSpan={2}
                    className="text-right tabular-nums text-sm font-medium"
                  >
                    {formatCurrency(changeOrderNet)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </div>
      </section>

      {/* ── Section 3: Attachments ── */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <SectionRuleHeading label="Attachments" />
          {editing && (
            <Button size="sm" variant="outline" disabled>
              <Upload className="h-4 w-4 mr-1" /> Upload
            </Button>
          )}
        </div>
        {attachments.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">
            No attachments yet.
          </p>
        ) : (
          <ul className="space-y-2">
            {attachments.map((att, idx) => (
              <li
                key={att.id ?? idx}
                className="flex items-center gap-2 text-sm"
              >
                <Paperclip className="h-4 w-4 text-muted-foreground" />
                {att.url ? (
                  <a
                    href={att.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary hover:underline"
                  >
                    {att.file_name ?? "Attachment"}
                  </a>
                ) : (
                  <span>{att.file_name ?? "Attachment"}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
