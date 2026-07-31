import * as React from "react";
import { EmailShell } from "../_shell/EmailShell";

export interface SubcontractorInvoiceInvitationProps {
  subcontractorName: string;
  projectName: string;
  projectNumber?: string | null;
  commitmentNumber: string;
  invoiceNumber: string;
  invoiceType: "progress" | "retainage_release";
  billingPeriod: string;
  dueDate: string;
  invoiceUrl: string;
  pmName: string;
}

export default function SubcontractorInvoiceInvitation({
  subcontractorName,
  projectName,
  projectNumber,
  commitmentNumber,
  invoiceNumber,
  invoiceType,
  billingPeriod,
  dueDate,
  invoiceUrl,
  pmName,
}: SubcontractorInvoiceInvitationProps) {
  const isRelease = invoiceType === "retainage_release";

  return (
    <EmailShell
      previewText={`Submit invoice ${invoiceNumber} for ${projectName}`}
      eyebrow="Action required"
      heading={isRelease ? "Submit your retainage release invoice" : "Submit your invoice"}
      ctaLabel="Open Invoice"
      ctaUrl={invoiceUrl}
      footerNote={`Need help? Reply to this email to reach ${pmName} directly.`}
    >
      <p style={{ margin: "0 0 12px" }}>Hi {subcontractorName},</p>
      <p style={{ margin: "0 0 12px" }}>
        You've been invited to submit{" "}
        {isRelease ? "a retainage release invoice" : "an invoice"} for{" "}
        <strong>{projectName}</strong>
        {projectNumber ? ` (${projectNumber})` : ""}. Open the invoice, review
        the schedule of values, make any required updates, and submit it for review.
      </p>

      <table
        width="100%"
        cellPadding={0}
        cellSpacing={0}
        style={{
          margin: "16px 0",
          background: "#f9fafb",
          border: "1px solid #e5e7eb",
          borderRadius: 8,
        }}
      >
        <tbody>
          <DetailRow label="Commitment #" value={commitmentNumber} />
          <DetailRow label="Invoice #" value={invoiceNumber} />
          <DetailRow label="Billing period" value={billingPeriod} />
          <DetailRow label="Due by" value={dueDate} />
        </tbody>
      </table>

      {isRelease ? (
        <p style={{ margin: "0 0 12px" }}>
          The invoice has been prefilled with the retainage currently available
          to release. The current work and stored materials columns are locked
          at zero for this release-only application.
        </p>
      ) : null}
    </EmailShell>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <tr>
      <td
        style={{
          padding: "10px 16px",
          fontSize: 12,
          color: "#64748b",
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.04em",
          width: "40%",
          borderBottom: "1px solid #eef2f7",
        }}
      >
        {label}
      </td>
      <td
        style={{
          padding: "10px 16px",
          fontSize: 14,
          color: "#0f172a",
          fontWeight: 600,
          borderBottom: "1px solid #eef2f7",
        }}
      >
        {value}
      </td>
    </tr>
  );
}
