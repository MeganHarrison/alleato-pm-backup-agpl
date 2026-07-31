import type { ReactNode } from "react";
import { AppCapabilityAccessDenied } from "@/components/guards/app-capability-access-denied";
import { canCurrentUserAccessAppCapability } from "@/lib/app-capabilities";
import { AccountingNav } from "@/components/accounting/accounting-nav";

export default async function AccountingLayout({
  children,
}: {
  children: ReactNode;
}) {
  const canViewAccounting = await canCurrentUserAccessAppCapability(
    "view_accounting",
  );

  if (!canViewAccounting) {
    return (
      <AppCapabilityAccessDenied
        title="Accounting"
        description="This accounting surface is limited to users with accounting access."
      />
    );
  }

  return (
    <>
      <AccountingNav />
      {children}
    </>
  );
}
