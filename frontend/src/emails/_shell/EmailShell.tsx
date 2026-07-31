/**
 * Shared Alleato email shell — header, body, optional CTA, footer.
 * All transactional templates wrap their content in this component for
 * consistent branding and table-based layout that renders well in every
 * major email client.
 */
import * as React from "react";
import { APP_BASE_URL } from "@/lib/email/client";

const C = {
  page: "#f6f7f9",
  surface: "#ffffff",
  surfaceAlt: "#f9fafb",
  border: "#e5e7eb",
  fg: "#0f172a",
  mutedFg: "#475569",
  mutedFgSoft: "#94a3b8",
  // Alleato brand orange — hsl(29 71% 52%) / hsl(28 69% 45%) from globals.css
  brand: "#dc822e",
  brandDark: "#c26d24",
  primaryFg: "#ffffff",
};

const LOGO_URL = `${APP_BASE_URL}/Alleato-Group-Logo_Dark.png`;

export interface EmailShellProps {
  previewText: string;
  heading?: string;
  eyebrow?: string;
  ctaLabel?: string;
  ctaUrl?: string;
  footerNote?: string;
  children: React.ReactNode;
}

export function EmailShell({
  previewText,
  heading,
  eyebrow,
  ctaLabel,
  ctaUrl,
  footerNote,
  children,
}: EmailShellProps) {
  return (
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta httpEquiv="Content-Type" content="text/html; charset=UTF-8" />
      </head>
      <body
        style={{
          margin: 0,
          padding: 0,
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          background: C.page,
        }}
      >
        <span style={{ display: "none", maxHeight: 0, overflow: "hidden" }}>
          {previewText}
        </span>

        <table
          width="100%"
          cellPadding={0}
          cellSpacing={0}
          style={{ background: C.page, padding: "32px 0" }}
        >
          <tbody>
            <tr>
              <td align="center">
                <table
                  width={600}
                  cellPadding={0}
                  cellSpacing={0}
                  style={{
                    maxWidth: 600,
                    width: "100%",
                    background: C.surface,
                    borderRadius: 12,
                    overflow: "hidden",
                    boxShadow: "0 1px 3px rgba(15, 23, 42, 0.08)",
                  }}
                >
                  <tbody>
                    <tr>
                      <td
                        style={{
                          background: C.surface,
                          padding: "24px 32px 20px",
                          borderBottom: `1px solid ${C.border}`,
                        }}
                      >
                        <img
                          src={LOGO_URL}
                          alt="Alleato"
                          height={26}
                          style={{
                            height: "26px",
                            width: "auto",
                            display: "block",
                            border: 0,
                            outline: "none",
                            textDecoration: "none",
                          }}
                        />
                      </td>
                    </tr>

                    {eyebrow && (
                      <tr>
                        <td style={{ padding: "28px 32px 0" }}>
                          <p
                            style={{
                              margin: 0,
                              fontSize: 12,
                              fontWeight: 600,
                              textTransform: "uppercase",
                              letterSpacing: "0.06em",
                              color: C.brand,
                            }}
                          >
                            {eyebrow}
                          </p>
                        </td>
                      </tr>
                    )}

                    {heading && (
                      <tr>
                        <td style={{ padding: "8px 32px 0" }}>
                          <h1
                            style={{
                              margin: 0,
                              fontSize: 22,
                              fontWeight: 700,
                              color: C.fg,
                              lineHeight: 1.3,
                            }}
                          >
                            {heading}
                          </h1>
                        </td>
                      </tr>
                    )}

                    <tr>
                      <td
                        style={{
                          padding: heading ? "16px 32px 8px" : "28px 32px 8px",
                          fontSize: 14,
                          color: C.fg,
                          lineHeight: 1.6,
                        }}
                      >
                        {children}
                      </td>
                    </tr>

                    {ctaLabel && ctaUrl && (
                      <tr>
                        <td style={{ padding: "16px 32px 32px" }}>
                          <a
                            href={ctaUrl}
                            style={{
                              display: "inline-block",
                              background: C.brand,
                              color: C.primaryFg,
                              textDecoration: "none",
                              fontSize: 14,
                              fontWeight: 600,
                              padding: "12px 20px",
                              borderRadius: 8,
                            }}
                          >
                            {ctaLabel}
                          </a>
                        </td>
                      </tr>
                    )}

                    <tr>
                      <td
                        style={{
                          borderTop: `1px solid ${C.border}`,
                          padding: "16px 32px",
                          background: C.surfaceAlt,
                        }}
                      >
                        <p
                          style={{
                            margin: 0,
                            fontSize: 12,
                            color: C.mutedFgSoft,
                          }}
                        >
                          {footerNote ?? (
                            <>
                              Sent by{" "}
                              <a
                                href={APP_BASE_URL}
                                style={{ color: C.mutedFg }}
                              >
                                Alleato
                              </a>
                              . This is a transactional message.
                            </>
                          )}
                        </p>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>
          </tbody>
        </table>
      </body>
    </html>
  );
}
