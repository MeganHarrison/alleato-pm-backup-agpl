"use client";

import type * as React from "react";

import { usePathname } from "next/navigation";

import { PageTabs } from "@/components/layout";

interface NavItem {
  label: string;
  href: string;
}

const settingsTabs: NavItem[] = [
  { label: "Profile", href: "/settings/profile" },
  { label: "Company", href: "/settings/account" },
];

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()! ?? "";

  const tabs = settingsTabs.map((tab) => ({
    ...tab,
    isActive: pathname === tab.href || pathname.startsWith(`${tab.href}/`),
  }));

  return (
    <div className="flex min-h-0 h-full flex-1 flex-col overflow-auto bg-background">
      <div>
        <div className="mx-auto w-full max-w-screen-2xl px-4 pt-6 sm:px-6 lg:px-8">
          <div className="space-y-4">
            <div>
              <h1 className="text-2xl font-semibold tracking-normal text-foreground">
                Settings
              </h1>
            </div>
            <PageTabs tabs={tabs} variant="inline" className="mb-0" />
          </div>
        </div>
      </div>

      <div className="min-w-0 flex-1 [&>*]:mx-auto">
        {children}
      </div>
    </div>
  );
}
