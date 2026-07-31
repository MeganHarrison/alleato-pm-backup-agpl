"use client";

import { useEffect, useState } from "react";
import { Mail } from "lucide-react";

import { ErrorState } from "@/components/ds";
import { SectionRuleHeading } from "@/components/layout/spacing";
import { apiFetch } from "@/lib/api-client";
import {
  EmailDetailSheet,
  type EmailDetailRecord,
} from "@/features/emails/email-detail-sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { formatDateTime } from "./shared";

interface EmailRow {
  id: string;
  sent_by_email: string | null;
  to_recipients: string[];
  cc_recipients: string[];
  subject: string | null;
  body: string | null;
  body_missing_reason: string | null;
  email_type: string;
  sent_at: string;
  status: string;
}

interface EmailsResponse {
  data: EmailRow[];
}

function formatEmailType(value: string): string {
  return value.replace(/[-_]/g, " ");
}

function emailToDetailRecord(email: EmailRow): EmailDetailRecord {
  return {
    id: email.id,
    subject: email.subject ?? "Untitled email",
    body: email.body ?? email.body_missing_reason,
    bodyText: email.body ?? email.body_missing_reason,
    fromName: null,
    fromEmail: email.sent_by_email,
    toList: email.to_recipients,
    ccList: email.cc_recipients,
    status: email.status,
    sentAt: email.sent_at,
    sourceLabel: "Invoice email",
    relatedLabel: formatEmailType(email.email_type),
  };
}

export function EmailsTab({
  projectId,
  invoiceId,
}: {
  projectId: string;
  invoiceId: number;
}) {
  const [rows, setRows] = useState<EmailRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedEmail, setSelectedEmail] = useState<EmailRow | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const body = await apiFetch<EmailsResponse>(
          `/api/projects/${projectId}/invoicing/subcontractor/invoices/${invoiceId}/emails`,
        );
        if (!cancelled) setRows(body.data ?? []);
      } catch (error) {
        if (!cancelled) {
          setRows([]);
          setLoadError(
            error instanceof Error
              ? error.message
              : "Email history could not be loaded.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [projectId, invoiceId]);

  const selectedEmailDetail = selectedEmail
    ? emailToDetailRecord(selectedEmail)
    : null;

  return (
    <section className="space-y-4">
      <SectionRuleHeading label="Emails" />
      {loading ? (
        <div className="py-8 text-center text-sm text-muted-foreground">
          Loading…
        </div>
      ) : loadError ? (
        <ErrorState
          title="Email history could not be loaded"
          error={loadError}
          className="py-8"
        />
      ) : rows.length === 0 ? (
        <div className="py-12 text-center space-y-2">
          <Mail className="h-8 w-8 mx-auto text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No emails sent yet.</p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Sent</TableHead>
              <TableHead>From</TableHead>
              <TableHead>To</TableHead>
              <TableHead>Subject</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow
                key={r.id}
                tabIndex={0}
                role="button"
                aria-label={`Open email details for ${r.subject ?? "untitled email"}`}
                className="cursor-pointer hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => setSelectedEmail(r)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setSelectedEmail(r);
                  }
                }}
              >
                <TableCell className="text-muted-foreground">
                  {formatDateTime(r.sent_at)}
                </TableCell>
                <TableCell>{r.sent_by_email ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground">
                  {r.to_recipients.join(", ")}
                </TableCell>
                <TableCell className="font-medium">
                  {r.subject ?? "—"}
                </TableCell>
                <TableCell className="capitalize">
                  {formatEmailType(r.email_type)}
                </TableCell>
                <TableCell className="capitalize">{r.status}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      <EmailDetailSheet
        email={selectedEmailDetail}
        open={Boolean(selectedEmail)}
        onOpenChange={(open) => {
          if (!open) setSelectedEmail(null);
        }}
      />
    </section>
  );
}
