import * as React from "react";
import { EmailShell } from "../_shell/EmailShell";

export interface RFINotificationProps {
  recipientName: string;
  projectName: string;
  rfiNumber: number;
  rfiSubject: string;
  question: string;
  dueDate?: string | null;
  createdBy: string;
  ballInCourt?: string | null;
  viewUrl: string;
  /**
   * No-login response link for assignees. When present, the primary button
   * sends the recipient straight to a public response page (no account needed)
   * and the app link becomes a secondary option.
   */
  respondUrl?: string | null;
  /** When true, replies to this email are ingested as the RFI response. */
  canReplyByEmail?: boolean;
}

/**
 * Sent when an RFI is distributed — created directly as "open", or moved from
 * draft → open. Goes to the assignees, distribution list, and RFI manager.
 */
export default function RFINotification({
  recipientName,
  projectName,
  rfiNumber,
  rfiSubject,
  question,
  dueDate,
  createdBy,
  ballInCourt,
  viewUrl,
  respondUrl,
  canReplyByEmail,
}: RFINotificationProps) {
  return (
    <EmailShell
      previewText={`RFI #${rfiNumber} — ${rfiSubject}`}
      eyebrow="New RFI"
      heading={`RFI #${rfiNumber} — ${rfiSubject}`}
      ctaLabel={respondUrl ? "Respond to RFI" : "View RFI"}
      ctaUrl={respondUrl ?? viewUrl}
    >
      <p style={{ margin: "0 0 12px" }}>Hi {recipientName},</p>
      <p style={{ margin: "0 0 12px" }}>
        <strong>{createdBy}</strong> sent you RFI #{rfiNumber} on{" "}
        <strong>{projectName}</strong>. A response is requested.
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
          <Row label="RFI #" value={String(rfiNumber)} />
          <Row label="Subject" value={rfiSubject} />
          <Row label="Project" value={projectName} />
          {ballInCourt ? <Row label="Ball in court" value={ballInCourt} /> : null}
          {dueDate ? <Row label="Due" value={dueDate} /> : null}
        </tbody>
      </table>

      {question ? (
        <>
          <p
            style={{
              margin: "0 0 6px",
              fontSize: 12,
              color: "#64748b",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.04em",
            }}
          >
            Question
          </p>
          <p style={{ margin: "0 0 12px", whiteSpace: "pre-wrap" }}>{question}</p>
        </>
      ) : null}

      {respondUrl ? (
        <p style={{ margin: "16px 0 0", fontSize: 13, color: "#64748b" }}>
          No account or login needed — just click <strong>Respond to RFI</strong>{" "}
          above to answer
          {canReplyByEmail ? ", or simply reply to this email" : ""}.{" "}
          <a href={viewUrl} style={{ color: "#64748b", textDecoration: "underline" }}>
            Or open it in the app
          </a>
          .
        </p>
      ) : null}
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
