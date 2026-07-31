import * as React from "react";
import { EmailShell } from "../_shell/EmailShell";

export interface RFIResponseReceivedNotificationProps {
  recipientName: string;
  projectName: string;
  rfiNumber: number;
  rfiSubject: string;
  responderName: string;
  responseExcerpt: string;
  viewUrl: string;
}

/**
 * Sent to the RFI manager + creator when a subcontractor submits a response via
 * the no-login channel (web page or email reply). The ball is now back with the
 * internal team.
 */
export default function RFIResponseReceivedNotification({
  recipientName,
  projectName,
  rfiNumber,
  rfiSubject,
  responderName,
  responseExcerpt,
  viewUrl,
}: RFIResponseReceivedNotificationProps) {
  return (
    <EmailShell
      previewText={`${responderName} responded to RFI #${rfiNumber}`}
      eyebrow="RFI Response"
      heading={`New response on RFI #${rfiNumber}`}
      ctaLabel="View RFI"
      ctaUrl={viewUrl}
    >
      <p style={{ margin: "0 0 12px" }}>Hi {recipientName},</p>
      <p style={{ margin: "0 0 12px" }}>
        <strong>{responderName}</strong> submitted a response to RFI #{rfiNumber}{" "}
        (<strong>{rfiSubject}</strong>) on <strong>{projectName}</strong>.
      </p>

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
        Response
      </p>
      <div
        style={{
          margin: "0 0 12px",
          padding: "12px 16px",
          background: "#f9fafb",
          border: "1px solid #e5e7eb",
          borderRadius: 8,
          whiteSpace: "pre-wrap",
          fontSize: 14,
          color: "#0f172a",
        }}
      >
        {responseExcerpt}
      </div>
    </EmailShell>
  );
}
