"use client";

import { type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BrainCircuit,
  CircleDollarSign,
  FileText,
  FolderKanban,
  LayoutDashboard,
  ListChecks,
  Menu,
  Network,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type WorkspaceNavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  exact?: boolean;
};

const dashboardNav: WorkspaceNavItem[] = [
  {
    label: "Overview",
    href: "/ai-dashboard",
    icon: LayoutDashboard,
    exact: true,
  },
  {
    label: "Daily brief",
    href: "/daily-brief",
    icon: FileText,
  },
];

const projectIntelligenceNav: WorkspaceNavItem[] = [
  {
    label: "Projects",
    href: "/ai-dashboard/projects",
    icon: FolderKanban,
  },
  {
    label: "Decisions",
    href: "/ai-dashboard/decisions",
    icon: ListChecks,
  },
];

const operationsNav: WorkspaceNavItem[] = [
  {
    label: "Company Brain",
    href: "/ai-dashboard/company-brain",
    icon: BrainCircuit,
  },
  {
    label: "Architecture",
    href: "/ai-dashboard/architecture",
    icon: Network,
  },
];

const financialNav: WorkspaceNavItem[] = [
  {
    label: "Accounting",
    href: "/ai-dashboard/accounting",
    icon: CircleDollarSign,
  },
];

const mobileNavGroups = [
  { label: "Dashboard", items: dashboardNav },
  { label: "Project intelligence", items: projectIntelligenceNav },
  { label: "AI foundation", items: operationsNav },
  { label: "Financials", items: financialNav },
];

const mobileNav = mobileNavGroups.flatMap((group) => group.items);
const desktopNav = [...dashboardNav, ...projectIntelligenceNav, ...operationsNav, ...financialNav];

function isNavItemActive(pathname: string, item: WorkspaceNavItem): boolean {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

function WorkspaceNavLink({
  item,
  active,
}: {
  item: WorkspaceNavItem;
  active: boolean;
}) {
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex min-h-11 items-center gap-2 rounded-md text-xs transition-colors",
        "w-full px-2.5 py-2",
        active
          ? "bg-[hsl(var(--ai-dashboard-nav-active))] text-foreground"
          : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
      )}
    >
      <Icon className="size-3.5 shrink-0" />
      {item.label}
    </Link>
  );
}

export function AiDashboardWorkspaceShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "/ai-dashboard";
  const activeMobileItem = mobileNav.find((item) => isNavItemActive(pathname, item)) ?? dashboardNav[0];
  const ActiveMobileIcon = activeMobileItem.icon;

  return (
    <div className="min-h-[calc(100svh-4rem)] overflow-hidden bg-background">
      <div className="mx-auto flex min-h-[calc(100svh-4rem)] w-full max-w-none flex-col px-6 pb-10 sm:px-8 lg:px-5">
        <div className="-mx-6 border-b border-border px-6 py-3 sm:-mx-8 sm:px-8 lg:hidden">
          <nav className="flex items-center justify-between gap-3" aria-label="AI Dashboard navigation">
            <div className="flex min-w-0 items-center gap-2 text-sm font-medium text-foreground">
              <ActiveMobileIcon className="size-4 shrink-0 text-muted-foreground" />
              <span className="truncate">{activeMobileItem.label}</span>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="ghost" size="sm" className="shrink-0 gap-2 text-muted-foreground hover:text-foreground">
                  Browse
                  <Menu className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                {mobileNavGroups.map((group, groupIndex) => (
                  <div key={group.label}>
                    {groupIndex > 0 ? <DropdownMenuSeparator /> : null}
                    <DropdownMenuLabel className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                      {group.label}
                    </DropdownMenuLabel>
                    {group.items.map((item) => {
                      const Icon = item.icon;
                      const active = isNavItemActive(pathname, item);
                      return (
                        <DropdownMenuItem key={item.href} asChild>
                          <Link
                            href={item.href}
                            aria-current={active ? "page" : undefined}
                            className={cn(
                              "flex min-h-11 items-center gap-2",
                              active && "bg-[hsl(var(--ai-dashboard-nav-active))] text-foreground",
                            )}
                          >
                            <Icon className="size-4" />
                            {item.label}
                          </Link>
                        </DropdownMenuItem>
                      );
                    })}
                  </div>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </nav>
        </div>

        <div className="grid flex-1 gap-10 pt-8 lg:grid-cols-[10rem_minmax(0,1fr)] lg:pt-14">
          <aside className="hidden lg:block">
            <nav className="space-y-1" aria-label="AI Dashboard">
              {desktopNav.map((item) => (
                <WorkspaceNavLink
                  key={item.href}
                  item={item}
                  active={isNavItemActive(pathname, item)}
                />
              ))}
            </nav>
          </aside>

          <main className="min-w-0 lg:px-6 xl:px-8 2xl:px-10">{children}</main>
        </div>
      </div>
    </div>
  );
}
