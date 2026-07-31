import * as React from "react";
import { EmailShell } from "../_shell/EmailShell";

export interface SubmittalDistributedNotificationProps {
  recipientName: string;
  projectName: string;
  submittalNumber: string;
  submittalTitle: string;
  distributedBy: string;
  message?: string | null;
  viewUrl: string;
}

export default function SubmittalDistributedNotification({
  recipientName,
  projectName,
  submittalNumber,
  submittalTitle,
  distributedBy,
  message,
  viewUrl,
}: SubmittalDistributedNotificationProps) {
  return (
    <EmailShell
      previewText={`Submittal ${submittalNumber} was distributed`}
      eyebrow="Submittal distributed"
      heading={`${submittalNumber} - ${submittalTitle}`}
      ctaLabel="View submittal"
      ctaUrl={viewUrl}
    >
      <p style={{ margin: "0 0 12px" }}>Hi {recipientName},</p>
      <p style={{ margin: "0 0 12px" }}>
        <strong>{distributedBy}</strong> distributed submittal{" "}
        <strong>{submittalNumber}</strong> on <strong>{projectName}</strong>.
      </p>
      {message ? (
        <p style={{ margin: "0 0 12px" }}>
          <strong>Message:</strong> {message}
        </p>
      ) : null}
    </EmailShell>
  );
}
