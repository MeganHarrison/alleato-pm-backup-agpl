import * as React from "react";
import { EmailShell } from "../_shell/EmailShell";

export interface RFIClosedNotificationProps {
  recipientName: string;
  projectName: string;
  rfiNumber: number;
  rfiSubject: string;
  closedBy: string;
  viewUrl: string;
}

export default function RFIClosedNotification({
  recipientName,
  projectName,
  rfiNumber,
  rfiSubject,
  closedBy,
  viewUrl,
}: RFIClosedNotificationProps) {
  return (
    <EmailShell
      previewText={`RFI #${rfiNumber} has been closed — ${rfiSubject}`}
      eyebrow="RFI closed"
      heading={`RFI #${rfiNumber} — ${rfiSubject}`}
      ctaLabel="View RFI"
      ctaUrl={viewUrl}
    >
      <p style={{ margin: "0 0 12px" }}>Hi {recipientName},</p>
      <p style={{ margin: "0 0 12px" }}>
        <strong>{closedBy}</strong> closed RFI #{rfiNumber} on{" "}
        <strong>{projectName}</strong>. The official response is now available.
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
          <Row label="Closed by" value={closedBy} />
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
