import * as React from "react";
import { EmailShell } from "../_shell/EmailShell";

export interface SubcontractorSovInviteProps {
  subcontractorName: string;
  projectName: string;
  projectNumber?: string;
  commitmentNumber: string;
  contractAmount: string;
  dueDate: string;
  inviteUrl: string;
  pmName: string;
}

export default function SubcontractorSovInvite({
  subcontractorName,
  projectName,
  projectNumber,
  commitmentNumber,
  contractAmount,
  dueDate,
  inviteUrl,
  pmName,
}: SubcontractorSovInviteProps) {
  return (
    <EmailShell
      previewText={`You've been invited to submit your Schedule of Values for ${projectName}`}
      eyebrow="You're invited"
      heading="Submit your Schedule of Values"
      ctaLabel="Create account & submit SOV"
      ctaUrl={inviteUrl}
      footerNote={`Need help? Reply to this email to reach ${pmName} directly.`}
    >
      <p style={{ margin: "0 0 12px" }}>Hi {subcontractorName},</p>
      <p style={{ margin: "0 0 12px" }}>
        You've been invited to submit a Schedule of Values for your contract on{" "}
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
        Click the button below to create your account and submit your line
        items. You can save a draft and return to finish later.
      </p>

      <p
        style={{
          margin: "0",
          padding: "12px 16px",
          background: "#eff6ff",
          borderRadius: 8,
          fontSize: 13,
          color: "#1e40af",
        }}
      >
        <strong>First time?</strong> Clicking the button will walk you through
        setting up your password. This invitation link expires in 24 hours.
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
