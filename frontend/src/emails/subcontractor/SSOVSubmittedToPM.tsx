import * as React from "react";
import { EmailShell } from "../_shell/EmailShell";

export interface SSOVSubmittedToPMProps {
  pmName: string;
  subcontractorName: string;
  projectName: string;
  commitmentNumber: string;
  commitmentTitle: string;
  contractAmount: string;
  reviewUrl: string;
}

export default function SSOVSubmittedToPM({
  pmName,
  subcontractorName,
  projectName,
  commitmentNumber,
  commitmentTitle,
  contractAmount,
  reviewUrl,
}: SSOVSubmittedToPMProps) {
  return (
    <EmailShell
      previewText={`${subcontractorName} submitted their Schedule of Values for ${commitmentNumber}`}
      eyebrow="Review required"
      heading="Subcontractor SOV awaiting review"
      ctaLabel="Review SOV"
      ctaUrl={reviewUrl}
    >
      <p style={{ margin: "0 0 12px" }}>Hi {pmName},</p>
      <p style={{ margin: "0 0 12px" }}>
        <strong>{subcontractorName}</strong> submitted their Schedule of Values
        on <strong>{projectName}</strong> and it's waiting for your review.
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
          <Row label="Title" value={commitmentTitle} />
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
