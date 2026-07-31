import * as React from "react";
import { EmailShell } from "../_shell/EmailShell";

export interface SubmittalWorkflowHandoffNotificationProps {
  recipientName: string;
  projectName: string;
  submittalNumber: string;
  submittalTitle: string;
  respondedBy: string;
  responseStatus: string;
  stepType: string;
  viewUrl: string;
}

export default function SubmittalWorkflowHandoffNotification({
  recipientName,
  projectName,
  submittalNumber,
  submittalTitle,
  respondedBy,
  responseStatus,
  stepType,
  viewUrl,
}: SubmittalWorkflowHandoffNotificationProps) {
  return (
    <EmailShell
      previewText={`Submittal ${submittalNumber} needs your response`}
      eyebrow="Submittal response needed"
      heading={`${submittalNumber} - ${submittalTitle}`}
      ctaLabel="Review submittal"
      ctaUrl={viewUrl}
    >
      <p style={{ margin: "0 0 12px" }}>Hi {recipientName},</p>
      <p style={{ margin: "0 0 12px" }}>
        <strong>{respondedBy}</strong> responded{" "}
        <strong>{responseStatus}</strong> on submittal{" "}
        <strong>{submittalNumber}</strong> for <strong>{projectName}</strong>.
      </p>
      <p style={{ margin: "0 0 12px" }}>
        The workflow is now waiting for your <strong>{stepType}</strong>{" "}
        response.
      </p>
    </EmailShell>
  );
}
