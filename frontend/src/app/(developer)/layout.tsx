import { AppSidebar } from "@/components/nav/app-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { SiteHeader } from "@/components/header";
import { requireDeveloper } from "@/lib/auth/require-developer";

/**
 * Route group for developer-only surfaces.
 *
 * Pages under app/(developer)/ are visible ONLY to users with
 * user_profiles.is_developer=true. Non-developers (including normal admins)
 * are redirected to /access-denied.
 *
 * Use this group for:
 *  - internal diagnostics
 *  - schema/inventory dumps
 *  - experimental features pre-rollout
 *  - prompt and model tuning UIs
 *  - anything you do not want regular admins to see
 *
 * Auth gating runs once at the layout level (server component), so individual
 * pages in this group do not need to repeat the check.
 */
export default async function DeveloperLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireDeveloper();

  return (
    <SidebarProvider defaultOpen={false}>
      <AppSidebar />
      <SidebarInset className="h-svh overflow-hidden">
        <div
          className="flex min-h-0 flex-1 flex-col overflow-auto scrollbar-hide transition-[padding] duration-200 ease-out"
          style={{ paddingRight: "var(--admin-feedback-sheet-offset, 0px)" }}
        >
          <SiteHeader />
          <main
            id="app-main-content"
            className="flex min-h-0 min-w-0 flex-1 flex-col"
          >
            <div className="flex-1">{children}</div>
          </main>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
