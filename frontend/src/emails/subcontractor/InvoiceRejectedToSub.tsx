import * as React from "react";
import { EmailShell } from "../_shell/EmailShell";

export interface InvoiceRejectedToSubProps {
  subcontractorName: string;
  projectName: string;
  invoiceNumber: string;
  reviewNotes?: string | null;
  resubmitUrl: string;
}

export default function InvoiceRejectedToSub({
  subcontractorName,
  projectName,
  invoiceNumber,
  reviewNotes,
  resubmitUrl,
}: InvoiceRejectedToSubProps) {
  return (
    <EmailShell
      previewText={`Revisions requested on invoice ${invoiceNumber}`}
      eyebrow="Revisions requested"
      heading={`Invoice ${invoiceNumber} needs revisions`}
      ctaLabel="Revise & resubmit"
      ctaUrl={resubmitUrl}
    >
      <p style={{ margin: "0 0 12px" }}>Hi {subcontractorName},</p>
      <p style={{ margin: "0 0 12px" }}>
        Your invoice <strong>{invoiceNumber}</strong> on{" "}
        <strong>{projectName}</strong> was reviewed and needs changes before it
        can be approved. Please update it and resubmit.
      </p>

      {reviewNotes ? (
        <table
          width="100%"
          cellPadding={0}
          cellSpacing={0}
          style={{
            margin: "16px 0",
            background: "#fef9c3",
            border: "1px solid #fde68a",
            borderRadius: 8,
          }}
        >
          <tbody>
            <tr>
              <td style={{ padding: "12px 16px" }}>
                <p
                  style={{
                    margin: "0 0 4px",
                    fontSize: 12,
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                    color: "#92400e",
                  }}
                >
                  Reviewer notes
                </p>
                <p style={{ margin: 0, fontSize: 14, color: "#0f172a" }}>
                  {reviewNotes}
                </p>
              </td>
            </tr>
          </tbody>
        </table>
      ) : null}
    </EmailShell>
  );
}
