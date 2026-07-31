"use client";

import * as React from "react";
import { AppSidebar } from "@/components/nav/app-sidebar";
import { MobileBottomNav } from "@/components/nav/mobile-bottom-nav";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { SiteHeader } from "@/components/header";

export default function TablesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider defaultOpen={false}>
      <AppSidebar />
      <SidebarInset className="h-svh overflow-hidden">
        <div className="flex min-h-0 flex-1 overflow-hidden">
          <div
            className="flex min-h-0 flex-1 flex-col overflow-auto scrollbar-hide transition-[padding] duration-200 ease-out"
            style={{ paddingRight: "var(--admin-feedback-sheet-offset, 0px)" }}
          >
            <div className="hidden md:contents">
              <SiteHeader />
            </div>
            <main
              id="app-main-content"
              className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 pb-4 pt-2"
            >
              {children}
              <div className="global-overlay-safe-zone" aria-hidden="true" />
            </main>
          </div>
        </div>
        <MobileBottomNav />
      </SidebarInset>
    </SidebarProvider>
  );
}
