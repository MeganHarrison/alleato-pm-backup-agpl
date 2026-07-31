import * as React from "react";
import { EmailShell } from "../_shell/EmailShell";

export interface SOVInvitationProps {
  subcontractorName: string;
  projectName: string;
  projectNumber?: string;
  commitmentNumber: string;
  contractAmount: string;
  dueDate: string;
  submissionUrl: string;
  pmName: string;
}

export default function SOVInvitation({
  subcontractorName,
  projectName,
  projectNumber,
  commitmentNumber,
  contractAmount,
  dueDate,
  submissionUrl,
  pmName,
}: SOVInvitationProps) {
  return (
    <EmailShell
      previewText={`Submit your Schedule of Values for ${projectName}`}
      eyebrow="Action required"
      heading="Submit your Schedule of Values"
      ctaLabel="Submit Schedule of Values"
      ctaUrl={submissionUrl}
      footerNote={`Need help? Reply to this email to reach ${pmName} directly.`}
    >
      <p style={{ margin: "0 0 12px" }}>Hi {subcontractorName},</p>
      <p style={{ margin: "0 0 12px" }}>
        You've been asked to submit a Schedule of Values for your contract on{" "}
        <strong>{projectName}</strong>
        {projectNumber ? ` (${projectNumber})` : ""}. Please break your
        contract amount into line items so we can track billing and payments.
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
          <DetailRow label="Contract amount" value={contractAmount} />
          <DetailRow label="Due by" value={dueDate} />
        </tbody>
      </table>

      <p style={{ margin: "0 0 12px" }}>
        Click below to enter your line items. You can save a draft and return
        to finish later.
      </p>
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
