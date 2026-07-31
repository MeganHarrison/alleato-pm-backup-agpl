import type { Metadata } from "next";
import { Suspense } from "react";
import { EmailsSurfaceClient } from "@/features/emails/emails-surface-client";

export const metadata: Metadata = {
  title: "Emails",
};

export const dynamic = "force-dynamic";

export default function EmailsPage() {
  return (
    <div className="flex min-h-0 flex-1 overflow-hidden">
      <Suspense>
        <EmailsSurfaceClient />
      </Suspense>
    </div>
  );
}
