"use client";

import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/nav/app-sidebar";
import { SiteHeader } from "@/components/header";

/**
 * SidebarLayout - Shared layout component for routes that need the app sidebar
 *
 * Use this in route group layout.tsx files:
 * ```tsx
 * import { SidebarLayout } from "@/components/layouts/SidebarLayout";
 *
 * export default function Layout({ children }) {
 *   return <SidebarLayout>{children}</SidebarLayout>;
 * }
 * ```
 */
export function SidebarLayout({ children }: { children: React.ReactNode }) {
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
            className="flex min-h-0 flex-1 flex-col gap-4 p-4 pt-0"
          >
            {children}
          </main>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
