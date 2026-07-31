import * as React from "react";
import { EmailShell } from "../_shell/EmailShell";

export interface InvoiceApprovedToSubProps {
  subcontractorName: string;
  projectName: string;
  invoiceNumber: string;
  invoiceAmount: string;
  approvedAsNoted?: boolean;
  notes?: string | null;
  invoiceUrl: string;
}

export default function InvoiceApprovedToSub({
  subcontractorName,
  projectName,
  invoiceNumber,
  invoiceAmount,
  approvedAsNoted,
  notes,
  invoiceUrl,
}: InvoiceApprovedToSubProps) {
  const heading = approvedAsNoted
    ? `Invoice ${invoiceNumber} approved as noted`
    : `Invoice ${invoiceNumber} approved`;
  return (
    <EmailShell
      previewText={`Invoice ${invoiceNumber} on ${projectName} was approved`}
      eyebrow={approvedAsNoted ? "Approved as noted" : "Approved"}
      heading={heading}
      ctaLabel="View invoice"
      ctaUrl={invoiceUrl}
    >
      <p style={{ margin: "0 0 12px" }}>Hi {subcontractorName},</p>
      <p style={{ margin: "0 0 12px" }}>
        Your invoice <strong>{invoiceNumber}</strong> on{" "}
        <strong>{projectName}</strong> has been approved
        {approvedAsNoted ? " with the notes below" : ""}.
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
          <Row label="Approved amount" value={invoiceAmount} emphasize />
        </tbody>
      </table>

      {approvedAsNoted && notes ? (
        <table
          width="100%"
          cellPadding={0}
          cellSpacing={0}
          style={{
            margin: "16px 0",
            background: "#fef9c3",
            border: "1px solid #fde68a",
            borderRadius: 8,
          }}
        >
          <tbody>
            <tr>
              <td style={{ padding: "12px 16px" }}>
                <p
                  style={{
                    margin: "0 0 4px",
                    fontSize: 12,
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                    color: "#92400e",
                  }}
                >
                  Notes
                </p>
                <p style={{ margin: 0, fontSize: 14, color: "#0f172a" }}>
                  {notes}
                </p>
              </td>
            </tr>
          </tbody>
        </table>
      ) : null}
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
