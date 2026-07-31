"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { ONBOARDING_VISIBILITY_EVENT } from "@/lib/onboarding/copy";
import { AskAlleatoPanel, type AskAlleatoPanelTab } from "./AskAlleatoPanel";

function shouldHideForRoute(pathname: string) {
  return (
    pathname.startsWith("/auth") ||
    pathname === "/login" ||
    pathname === "/signup" ||
    pathname === "/ai" ||
    pathname.startsWith("/ai/") ||
    pathname.startsWith("/ai-assistant") ||
    pathname.startsWith("/ai-avatar")
  );
}

export function AskAlleatoRoot() {
  const pathname = usePathname()! ?? "/";
  const [open, setOpen] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState<AskAlleatoPanelTab>("feedback");
  const [onboardingOpen, setOnboardingOpen] = React.useState(false);

  React.useEffect(() => {
    const openShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "i") {
        event.preventDefault();
        setActiveTab("ai");
        setOpen(true);
      }
    };

    const onboardingVisibility = (event: Event) => {
      const detail = (event as CustomEvent<{ open?: boolean }>).detail;
      setOnboardingOpen(detail?.open === true);
      if (detail?.open) setOpen(false);
    };

    window.addEventListener("keydown", openShortcut);
    window.addEventListener(ONBOARDING_VISIBILITY_EVENT, onboardingVisibility);
    document.documentElement.dataset.askAlleatoShortcutReady = "true";

    return () => {
      window.removeEventListener("keydown", openShortcut);
      window.removeEventListener(ONBOARDING_VISIBILITY_EVENT, onboardingVisibility);
      document.documentElement.dataset.askAlleatoShortcutReady = "false";
    };
  }, []);

  React.useEffect(() => {
    if (shouldHideForRoute(pathname)) {
      setOpen(false);
    }
  }, [pathname]);

  if (shouldHideForRoute(pathname) || onboardingOpen) {
    return null;
  }

  return (
    <AskAlleatoPanel
      open={open}
      onOpenChange={setOpen}
      activeTab={activeTab}
      onActiveTabChange={setActiveTab}
      pagePath={pathname}
    />
  );
}
