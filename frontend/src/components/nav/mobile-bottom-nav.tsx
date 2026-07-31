"use client";

/**
 * MobileBottomNav
 *
 * A thumb-reachable bottom tab bar shown ONLY on mobile (`md:hidden`). It gives
 * the four primary mobile jobs a one-tap home, replacing the hamburger →
 * drawer → scroll path as the *primary* way to move around, and surfacing two
 * things that were previously unreachable on mobile:
 *
 *   - Notifications (the header bell lives in a `md:hidden`-gated desktop
 *     cluster, so on mobile there was no notification affordance at all).
 *   - The AI assistant as a first-class destination.
 *
 * The hamburger drawer is preserved — the "Menu" tab opens it — so every tool
 * remains reachable. Tabs are semantic-token themed (light/dark), safe-area
 * aware (pairs with `viewport-fit=cover`), and every target is ≥ 44px.
 */

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Home, Menu, Sparkles, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useProject } from "@/contexts/project-context";
import { useSidebar } from "@/components/ui/sidebar";
import { BottomNavAlertBadge } from "./mobile-bottom-nav-alert-badge";

interface TabConfig {
  key: string;
  label: string;
  icon: LucideIcon;
  /** Resolve the destination href given the active project (null = company scope). */
  href: (projectId: number | null) => string;
  /** Whether this tab is the active one for the current pathname. */
  isActive: (pathname: string) => boolean;
  /** Renders an unread/status badge over the icon. */
  badge?: React.ReactNode;
}

const TABS: TabConfig[] = [
  {
    key: "home",
    label: "Home",
    icon: Home,
    href: (projectId) => (projectId ? `/${projectId}/home` : "/"),
    isActive: (pathname) =>
      pathname === "/" ||
      /^\/\d+$/.test(pathname) ||
      /^\/\d+\/home(\/|$)/.test(pathname),
  },
  {
    key: "ai",
    label: "AI",
    icon: Sparkles,
    href: () => "/ai",
    isActive: (pathname) =>
      pathname === "/ai" ||
      pathname.startsWith("/ai/") ||
      pathname === "/ai-assistant" ||
      pathname.startsWith("/ai-assistant/"),
  },
  {
    key: "alerts",
    label: "Alerts",
    icon: Bell,
    href: () => "/notifications",
    isActive: (pathname) => pathname.startsWith("/notifications"),
    badge: <BottomNavAlertBadge />,
  },
];

function TabButton({
  label,
  icon: Icon,
  active,
  badge,
}: {
  label: string;
  icon: LucideIcon;
  active: boolean;
  badge?: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "flex h-full min-h-11 w-full flex-col items-center justify-center gap-0.5 text-xs font-medium transition-colors",
        active ? "text-primary" : "text-muted-foreground",
      )}
    >
      <span className="relative flex items-center justify-center">
        <Icon
          className="h-5 w-5"
          strokeWidth={active ? 2 : 1.6}
          aria-hidden="true"
        />
        {badge}
      </span>
      <span className="leading-none">{label}</span>
    </span>
  );
}

export function MobileBottomNav() {
  const pathname = usePathname() ?? "";
  const { projectId } = useProject();
  const { setOpenMobile } = useSidebar();

  return (
    <nav
      aria-label="Primary"
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur",
        "supports-[backdrop-filter]:bg-background/80 md:hidden",
        "pb-[env(safe-area-inset-bottom)]",
      )}
    >
      <div className="grid h-14 grid-cols-4">
        {TABS.map((tab) => {
          const active = tab.isActive(pathname);
          return (
            <Link
              key={tab.key}
              href={tab.href(projectId)}
              aria-label={tab.label}
              aria-current={active ? "page" : undefined}
              className="flex items-center justify-center outline-none focus-visible:bg-muted/60"
            >
              <TabButton
                label={tab.label}
                icon={tab.icon}
                active={active}
                badge={tab.badge}
              />
            </Link>
          );
        })}

        {/* Menu — opens the full navigation drawer so every tool stays reachable. */}
        <Button
          type="button"
          variant="ghost"
          onClick={() => setOpenMobile(true)}
          aria-label="Open menu"
          className="h-full w-full rounded-none p-0 hover:bg-transparent focus-visible:bg-muted/60 focus-visible:ring-0"
        >
          <TabButton label="Menu" icon={Menu} active={false} />
        </Button>
      </div>
    </nav>
  );
}
