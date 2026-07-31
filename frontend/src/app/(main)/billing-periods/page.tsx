"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Global /billing-periods page — redirects to the project list.
 *
 * Billing periods are project-scoped and live under
 * /[projectId]/invoices?tab=billing-periods. This global page redirects users
 * so they can access billing periods from within a project.
 */
export default function BillingPeriodsRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/");
  }, [router]);

  return (
    <div className="flex h-full items-center justify-center">
      <p className="text-sm text-muted-foreground">
        Redirecting — billing periods are accessed from within a project...
      </p>
    </div>
  );
}
