import * as React from "react";
import { EmailShell } from "../_shell/EmailShell";

export interface SovApprovedToSubProps {
  subcontractorName: string;
  projectName: string;
  commitmentNumber: string;
  contractAmount: string;
  invoiceUrl: string;
}

export default function SovApprovedToSub({
  subcontractorName,
  projectName,
  commitmentNumber,
  contractAmount,
  invoiceUrl,
}: SovApprovedToSubProps) {
  return (
    <EmailShell
      previewText={`Your Schedule of Values for ${commitmentNumber} was approved`}
      eyebrow="Approved"
      heading="Your Schedule of Values was approved"
      ctaLabel="Submit an invoice"
      ctaUrl={invoiceUrl}
    >
      <p style={{ margin: "0 0 12px" }}>Hi {subcontractorName},</p>
      <p style={{ margin: "0 0 12px" }}>
        Your Schedule of Values for <strong>{commitmentNumber}</strong> on{" "}
        <strong>{projectName}</strong> has been approved. You can now submit
        invoices against it.
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
          <Row label="Commitment #" value={commitmentNumber} />
          <Row label="Contract amount" value={contractAmount} emphasize />
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
