import { requireAdminDashboardAccess } from "@/lib/auth/admin-dashboard";
import { usesAppAdminPageAccess } from "@/lib/auth/admin-page-access";
import { requireAppAdminPageAccess } from "@/lib/auth/require-app-admin";
import { AuthenticatedAppProviders } from "@/components/providers/authenticated-app-providers";
import { headers } from "next/headers";
import { AdminLayoutClient } from "./admin-layout-client";

/**
 * Layout for admin pages.
 * Includes the full app chrome (sidebar, header, footer) for consistency.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = (await headers()).get("x-alleato-pathname");
  if (usesAppAdminPageAccess(pathname)) {
    await requireAppAdminPageAccess();
  } else {
    await requireAdminDashboardAccess();
  }

  return (
    <AuthenticatedAppProviders>
      <AdminLayoutClient>{children}</AdminLayoutClient>
    </AuthenticatedAppProviders>
  );
}
