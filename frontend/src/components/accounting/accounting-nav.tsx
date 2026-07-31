"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  FileText,
  CreditCard,
  Receipt,
  FolderKanban,
  ClipboardList,
  FileStack,
  Landmark,
  ArrowDownRight,
  ArrowUpRight,
  ScrollText,
  BookOpen,
  BarChart3,
  Wallet,
} from "lucide-react";

type NavItem = {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  exact?: boolean;
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Overview",
    items: [
      {
        label: "Dashboard",
        href: "/accounting",
        icon: LayoutDashboard,
        exact: true,
      },
    ],
  },
  {
    label: "Receivables",
    items: [
      { label: "AR Invoices", href: "/accounting/invoices", icon: FileText },
      {
        label: "AR Payments",
        href: "/accounting/payments",
        icon: ArrowDownRight,
      },
    ],
  },
  {
    label: "Payables",
    items: [
      { label: "AP Bills", href: "/accounting/bills", icon: Receipt },
      { label: "AP Checks", href: "/accounting/checks", icon: CreditCard },
      {
        label: "AP Invoices",
        href: "/accounting/ap-invoices",
        icon: FileStack,
      },
      {
        label: "AP Payments",
        href: "/accounting/ap-payments",
        icon: Landmark,
      },
    ],
  },
  {
    label: "Reports",
    items: [
      { label: "SOP Backlog", href: "/accounting/sop-backlog", icon: BookOpen },
      { label: "Finance Spend", href: "/accounting/finance-spend", icon: BarChart3 },
      { label: "Direct Costs", href: "/accounting/direct-costs", icon: Wallet },
      { label: "WIP Report", href: "/accounting/wip", icon: ClipboardList },
      {
        label: "PSR",
        href: "/accounting/projects",
        icon: ScrollText,
      },
      { label: "Projects", href: "/accounting/projects", icon: FolderKanban },
    ],
  },
];

function isActive(href: string, pathname: string | null, exact?: boolean): boolean {
  if (!pathname) return false;
  if (exact) return pathname === href;
  return pathname.startsWith(href);
}

export function AccountingNav() {
  const pathname = usePathname();

  return (
    <div className="sticky top-0 z-30 border-b border-border/50 bg-background/95 backdrop-blur-sm">
      <div className="flex min-w-0 overflow-x-auto scrollbar-hide">
        <nav className="flex min-w-max items-stretch gap-0 px-4">
          {NAV_GROUPS.map((group, groupIndex) => (
            <div key={group.label} className="flex items-stretch">
              {groupIndex > 0 && (
                <div className="my-3 mx-1 w-px bg-border/60 shrink-0" />
              )}
              <div className="flex items-stretch gap-0.5 px-1">
                {group.items.map((item) => {
                  const active = isActive(item.href, pathname, item.exact);
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href + item.label}
                      href={item.href}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium transition-colors whitespace-nowrap relative",
                        "after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[2px] after:rounded-t-full after:transition-all",
                        active
                          ? "text-foreground after:bg-primary"
                          : "text-muted-foreground hover:text-foreground after:bg-transparent",
                      )}
                    >
                      <Icon
                        className={cn(
                          "h-3.5 w-3.5 shrink-0",
                          active ? "text-primary" : "text-muted-foreground/70",
                        )}
                      />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </div>
    </div>
  );
}
