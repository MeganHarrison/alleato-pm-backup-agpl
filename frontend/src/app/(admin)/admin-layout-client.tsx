"use client";

import { usePathname } from "next/navigation";

import { SiteHeader } from "@/components/header";
import { SiteFooter } from "@/components/layout/site-footer";
import { AppSidebar } from "@/components/nav/app-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import aiDashboardThemeStyles from "../(main)/ai-dashboard-theme.module.css";

export function AdminLayoutClient({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";
  const isAccountingDashboard = pathname === "/accounting";

  return (
    <SidebarProvider
      defaultOpen={false}
      className={
        isAccountingDashboard
          ? `dark ${aiDashboardThemeStyles.theme} bg-background text-foreground`
          : undefined
      }
    >
      <AppSidebar />
      <SidebarInset className="h-svh overflow-hidden">
        <div
          className="flex min-h-0 flex-1 flex-col overflow-auto scrollbar-hide transition-[padding] duration-200 ease-out"
          style={{ paddingRight: "var(--admin-feedback-sheet-offset, 0px)" }}
        >
          <SiteHeader />
          <main
            id="app-main-content"
            className="flex min-w-0 flex-1 flex-col"
          >
            <div className="flex flex-1 flex-col">{children}</div>
            <div className="global-overlay-safe-zone" aria-hidden="true" />
          </main>
          <SiteFooter />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
