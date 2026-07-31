import * as React from "react";
import { EmailShell } from "../_shell/EmailShell";

export interface InviteUserProps {
  inviterName: string;
  inviteeName?: string;
  email?: string;
  role?: string;
  acceptUrl: string;
  expiresInHours?: number;
}

export default function InviteUser({
  inviteeName,
  email,
  acceptUrl,
  expiresInHours = 72,
}: InviteUserProps) {
  return (
    <EmailShell
      previewText="Alleato Group invited you to join Alleato"
      eyebrow="Invitation"
      heading="You're invited to Alleato Project Management Platform"
      ctaLabel="Accept invitation"
      ctaUrl={acceptUrl}
      footerNote={`This invitation expires in ${expiresInHours} hours.`}
    >
      <p style={{ margin: "0 0 12px" }}>
        {inviteeName ? `Hi ${inviteeName},` : "Hi,"}
      </p>
      <p style={{ margin: "0 0 12px" }}>
        <strong>Alleato Group</strong> has invited you to join the Alleato
        project management platform.
      </p>
      <p style={{ margin: "0 0 12px" }}>
        Click the button below to accept the invitation and create your
        password.
      </p>
      {email ? (
        <p style={{ margin: "0 0 12px" }}>
          Your username is <strong>{email}</strong>.
        </p>
      ) : null}
      <p style={{ margin: "0 0 12px" }}>
        After your password is saved, use that email and password to log in.
      </p>
    </EmailShell>
  );
}
