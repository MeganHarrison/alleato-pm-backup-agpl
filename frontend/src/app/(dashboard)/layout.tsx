"use client";

import * as React from "react";
import { AppSidebar } from "@/components/nav/app-sidebar";
import { CreateProjectDevConfigProvider } from "@/components/project/create-project-dev-config";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { SiteHeader } from "@/components/header";
import { feedbackTargetProps } from "@/lib/admin-feedback/constants";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider defaultOpen={false}>
      <AppSidebar />
      <SidebarInset className="h-svh overflow-hidden">
        <CreateProjectDevConfigProvider>
          <div
            className="flex min-h-0 flex-1 flex-col overflow-auto scrollbar-hide transition-[padding] duration-200 ease-out"
            style={{ paddingRight: "var(--admin-feedback-sheet-offset, 0px)" }}
        >
          <SiteHeader />
          <main
              id="app-main-content"
              className="flex min-w-0 flex-1 flex-col"
              {...feedbackTargetProps("app.main-content")}
            >
            <div className="flex-1">{children}</div>
          </main>
        </div>
        </CreateProjectDevConfigProvider>
      </SidebarInset>
    </SidebarProvider>
  );
}
