import * as React from "react";
import { EmailShell } from "../_shell/EmailShell";

export interface RFIUpdateNotificationProps {
  recipientName: string;
  projectName: string;
  rfiNumber: number;
  rfiSubject: string;
  updatedBy: string;
  /** Human-readable list of what changed, e.g. ["Status changed to Answered"]. */
  changeSummary: string[];
  ballInCourt?: string | null;
  dueDate?: string | null;
  viewUrl: string;
}

/**
 * Sent when a live RFI is updated (status change, reassignment, due-date or
 * question edit). Goes to everyone involved — submitter, reviewers (assignees),
 * RFI manager, and the distribution list.
 */
export default function RFIUpdateNotification({
  recipientName,
  projectName,
  rfiNumber,
  rfiSubject,
  updatedBy,
  changeSummary,
  ballInCourt,
  dueDate,
  viewUrl,
}: RFIUpdateNotificationProps) {
  return (
    <EmailShell
      previewText={`RFI #${rfiNumber} updated — ${rfiSubject}`}
      eyebrow="RFI updated"
      heading={`RFI #${rfiNumber} — ${rfiSubject}`}
      ctaLabel="View RFI"
      ctaUrl={viewUrl}
    >
      <p style={{ margin: "0 0 12px" }}>Hi {recipientName},</p>
      <p style={{ margin: "0 0 12px" }}>
        <strong>{updatedBy}</strong> updated RFI #{rfiNumber} on{" "}
        <strong>{projectName}</strong>.
      </p>

      {changeSummary.length > 0 ? (
        <ul style={{ margin: "0 0 16px", paddingLeft: 20 }}>
          {changeSummary.map((change, i) => (
            <li key={i} style={{ margin: "0 0 4px", fontSize: 14, color: "#0f172a" }}>
              {change}
            </li>
          ))}
        </ul>
      ) : null}

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
          <Row label="RFI #" value={String(rfiNumber)} />
          <Row label="Subject" value={rfiSubject} />
          <Row label="Project" value={projectName} />
          {ballInCourt ? <Row label="Ball in court" value={ballInCourt} /> : null}
          {dueDate ? <Row label="Due" value={dueDate} /> : null}
        </tbody>
      </table>
    </EmailShell>
  );
}

function Row({ label, value }: { label: string; value: string }) {
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
          fontWeight: 700,
          borderBottom: "1px solid #eef2f7",
        }}
      >
        {value}
      </td>
    </tr>
  );
}
