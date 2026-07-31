"use client";

import Link from "next/link";
import { RedocStandalone } from "redoc";
import { PageShell } from "@/components/layout";

const SPEC_URL = "/openapi.yaml";

export default function RedocPage() {
  return (
    <PageShell
      variant="dashboard"
      title="ReDoc API Reference"
      description="Explore auth flows, schema details, and every frontend/backend endpoint in one place."
      actions={
        <div className="flex flex-wrap gap-4">
          <Link
            className="rounded-md border border-border px-4 py-2 text-sm font-medium text-muted-foreground shadow-sm transition hover:border-border hover:bg-muted"
            href="/redoc"
          >
            Refresh view
          </Link>
          <Link
            className="rounded-md border border-border px-4 py-2 text-sm font-medium text-muted-foreground shadow-sm transition hover:border-border hover:bg-muted"
            href="/api-docs"
          >
            Open Swagger UI
          </Link>
        </div>
      }
    >
      <div className="min-h-160 max-h-[calc(100vh-180px)] overflow-hidden rounded-xl border border-border bg-background text-foreground shadow-sm">
        <RedocStandalone
          specUrl={SPEC_URL}
          options={{
            expandResponses: "200,201,204",
            hideDownloadButton: false,
            hideHostname: false,
            showExtensions: true,
            menuToggle: true,
            pathInMiddlePanel: true,
            scrollYOffset: 78,
          }}
        />
      </div>
    </PageShell>
  );
}
