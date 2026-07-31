import * as React from "react";
import { EmailShell } from "../_shell/EmailShell";

export interface ForgotPasswordProps {
  userName?: string;
  resetUrl: string;
  expiresInMinutes?: number;
  requestIp?: string;
}

export default function ForgotPassword({
  userName,
  resetUrl,
  expiresInMinutes = 60,
  requestIp,
}: ForgotPasswordProps) {
  return (
    <EmailShell
      previewText="Reset your Alleato password"
      eyebrow="Password reset"
      heading="Reset your password"
      ctaLabel="Reset password"
      ctaUrl={resetUrl}
      footerNote={`If you didn't request this, you can safely ignore this email. The link expires in ${expiresInMinutes} minutes.`}
    >
      <p style={{ margin: "0 0 12px" }}>
        {userName ? `Hi ${userName},` : "Hi,"}
      </p>
      <p style={{ margin: "0 0 12px" }}>
        We received a request to reset your Alleato password. Click the button
        below to choose a new one.
      </p>
      {requestIp && (
        <p style={{ margin: "0 0 12px", fontSize: 12, color: "#64748b" }}>
          Requested from IP {requestIp}
        </p>
      )}
    </EmailShell>
  );
}
