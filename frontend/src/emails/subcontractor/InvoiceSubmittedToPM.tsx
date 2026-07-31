import * as React from "react";
import { EmailShell } from "../_shell/EmailShell";

export interface InvoiceSubmittedToPMProps {
  pmName: string;
  subcontractorName: string;
  projectName: string;
  invoiceNumber: string;
  invoiceAmount: string;
  billingPeriod: string;
  reviewUrl: string;
}

export default function InvoiceSubmittedToPM({
  pmName,
  subcontractorName,
  projectName,
  invoiceNumber,
  invoiceAmount,
  billingPeriod,
  reviewUrl,
}: InvoiceSubmittedToPMProps) {
  return (
    <EmailShell
      previewText={`${subcontractorName} submitted invoice ${invoiceNumber}`}
      eyebrow="Review required"
      heading="New invoice awaiting review"
      ctaLabel="Review invoice"
      ctaUrl={reviewUrl}
    >
      <p style={{ margin: "0 0 12px" }}>Hi {pmName},</p>
      <p style={{ margin: "0 0 12px" }}>
        <strong>{subcontractorName}</strong> submitted a new invoice on{" "}
        <strong>{projectName}</strong> and it's waiting for your approval.
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
          <Row label="Invoice #" value={invoiceNumber} />
          <Row label="Amount" value={invoiceAmount} emphasize />
          <Row label="Billing period" value={billingPeriod} />
        </tbody>
      </table>
    </EmailShell>
  );
}

function Row({
  label,
  value,
  emphasize,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
}) {
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
          fontSize: emphasize ? 16 : 14,
          color: "#0f172a",
          fontWeight: 700,
          borderBottom: "1px solid #eef2f7",
        }}
      >
        {value}
      </td>
    </tr>
  );
}
