"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { AppSidebar } from "@/components/nav/app-sidebar";
import { MobileBottomNav } from "@/components/nav/mobile-bottom-nav";
import { CreateProjectDevConfigProvider } from "@/components/project/create-project-dev-config";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { SiteHeader } from "@/components/header";
import { SiteFooter } from "@/components/layout/site-footer";
import { AuthenticatedAppProviders } from "@/components/providers/authenticated-app-providers";
import { useProject } from "@/contexts/project-context";
import { useDeferredMount } from "@/hooks/use-deferred-mount";
import { useProjectPermissions } from "@/hooks/use-project-permissions";
import { useProcorePanelStore } from "@/lib/stores/procore-panel-store";
// AdminFeedbackWidget replaced by UnifiedFeedbackWidget in root layout
import { feedbackTargetProps } from "@/lib/admin-feedback/constants";
import aiDashboardThemeStyles from "./ai-dashboard-theme.module.css";

const ProcoreReferencePanel = dynamic(
  () =>
    import("@/components/header/procore-reference-panel").then(
      (mod) => mod.ProcoreReferencePanel,
    ),
  { ssr: false },
);
const WelcomeOnboarding = dynamic(
  () =>
    import("@/components/onboarding/WelcomeOnboarding").then(
      (mod) => mod.WelcomeOnboarding,
    ),
  { ssr: false },
);

/** Floating overlays extracted to a single component to avoid mixed static/dynamic children key warnings. */
function Overlays() {
  const { projectId } = useProject();
  const { userType, isLoading } = useProjectPermissions(projectId);
  const shouldMountDeferredOverlays = useDeferredMount(6_000);
  const isSubcontractor = userType?.toLowerCase() === "subcontractor";

  if (!shouldMountDeferredOverlays) {
    return null;
  }

  return (
    <React.Suspense fallback={null}>
      <div className="contents">
        <WelcomeOnboarding
          deferAutoOpen={isLoading}
          suppressAutoOpen={isSubcontractor}
          suppressStorageValue="skipped:subcontractor"
        />
      </div>
    </React.Suspense>
  );
}

/**
 * Main layout with sidebar as primary navigation.
 * Sidebar starts expanded with icon-collapse mode.
 * Minimal top header provides breadcrumbs and context.
 */
export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname()!;
  const shouldMountDeferredPanels = useDeferredMount(6_000);
  const isAiDashboard =
    pathname === "/ai-dashboard" ||
    pathname.startsWith("/ai-dashboard/") ||
    pathname === "/ai/company-brain";
  const isCompanyBrain = pathname === "/ai/company-brain";
  const isImmersiveChatPage =
    pathname?.startsWith("/team-chat") || pathname?.startsWith("/comments");
  // The AI chat surface is a fixed-height app pane that anchors its composer to
  // the bottom and manages its own mobile bottom-nav clearance. It must NOT get
  // the shared `.global-overlay-safe-zone` spacer (that spacer is for scrolling
  // pages to clear the floating launchers) — on a fixed-height pane it floats
  // the composer up and leaves ~128px of dead space above the bottom nav.
  const isAiChatPage =
    ((pathname === "/ai" || pathname.startsWith("/ai/")) &&
      pathname !== "/ai/company-brain") ||
    pathname === "/ai-assistant" ||
    pathname.startsWith("/ai-assistant/");
  const isDrawingViewer = /\/drawings\/viewer\//.test(pathname ?? "");
  const isProcoreReferenceOpen = useProcorePanelStore((state) => state.open);
  const appShell = isImmersiveChatPage ? (
    <SidebarProvider defaultOpen={false}>
      <AppSidebar />
      <SidebarInset className="h-svh overflow-hidden">
        <CreateProjectDevConfigProvider>
          <main
            id="app-main-content"
            className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
            {...feedbackTargetProps("app.main-content")}
          >
            {children}
          </main>
        </CreateProjectDevConfigProvider>
      </SidebarInset>
    </SidebarProvider>
  ) : (
    <SidebarProvider
      defaultOpen={isCompanyBrain}
      className={
        isAiDashboard
          ? `dark ${aiDashboardThemeStyles.theme} bg-background text-foreground`
          : undefined
      }
    >
      {!isDrawingViewer && <AppSidebar key="app-sidebar" />}
      <SidebarInset key="app-shell" className="h-svh overflow-hidden">
        <CreateProjectDevConfigProvider>
          <div className="flex min-h-0 flex-1 overflow-hidden">
            <div
              className={
                "flex min-h-0 min-w-0 flex-1 flex-col overflow-auto scrollbar-hide transition-[padding] duration-200 ease-out"
              }
              style={{
                paddingRight: "var(--admin-feedback-sheet-offset, 0px)",
              }}
            >
              {!isDrawingViewer && (
                <div key="site-header" className="hidden md:contents">
                  <SiteHeader hideBreadcrumbs={isCompanyBrain} />
                </div>
              )}
              <main
                id="app-main-content"
                key="main-content"
                className="flex min-h-0 min-w-0 flex-1 flex-col"
                {...feedbackTargetProps("app.main-content")}
              >
                <React.Fragment key="route-content">{children}</React.Fragment>
                {!isDrawingViewer && !isAiChatPage && (
                  <div
                    className="global-overlay-safe-zone"
                    aria-hidden="true"
                  />
                )}
              </main>
              {shouldMountDeferredPanels && isProcoreReferenceOpen && (
                <ProcoreReferencePanel key="procore-reference-panel" />
              )}
              {!isDrawingViewer && (
                <div className="hidden shrink-0 md:block">
                  <SiteFooter />
                </div>
              )}
            </div>
          </div>
        </CreateProjectDevConfigProvider>
        {!isDrawingViewer && <MobileBottomNav key="mobile-bottom-nav" />}
        <Overlays key="floating-overlays" />
      </SidebarInset>
    </SidebarProvider>
  );

  return <AuthenticatedAppProviders>{appShell}</AuthenticatedAppProviders>;
}
