"use client";

import Link from "next/link";

import { cn } from "@/lib/utils";
import type { AdminMenuItem, AdminMenuSection } from "./admin-dashboard-data";

function MenuItemRow({ item }: { item: AdminMenuItem }) {
  const Icon = item.icon;

  const content = (
    <>
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-primary">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-2">
          <span className="text-xs font-medium text-foreground">{item.label}</span>
          {item.badge ? (
            <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
              {item.badge}
            </span>
          ) : null}
          <code className="truncate text-[11px] text-muted-foreground/70">{item.route}</code>
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">{item.description}</p>
      </div>
    </>
  );

  const className = "group flex min-h-12 gap-2 py-2";

  if (!item.href) {
    return <div className={cn(className, "cursor-default")}>{content}</div>;
  }

  return (
    <Link href={item.href} target="_blank" rel="noreferrer" className={className}>
      {content}
    </Link>
  );
}

export function AdminDirectoryView({ sections }: { sections: AdminMenuSection[] }) {
  const items = sections
    .flatMap((section) => section.groups.flatMap((group) => group.items))
    .sort((a, b) => a.label.localeCompare(b.label));

  return (
    <div className="grid gap-x-10 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => (
        <MenuItemRow key={item.route} item={item} />
      ))}
    </div>
  );
}
