"use client";

import { useState } from "react";
import { PageTabs, Tabs, TabsContent, TabsList, TabsTrigger, Badge } from "@/components/ds";
import {
  BarChart3,
  Clock,
  DollarSign,
  FileText,
  Inbox,
  LayoutGrid,
  List,
  Settings,
  Users,
} from "lucide-react";

export function TabsSection() {
  const [activePageTab, setActivePageTab] = useState("inbox");

  return (
    <section id="tabs" className="scroll-mt-8">
      {/* Section Header */}
      <div className="flex items-center gap-3 mb-8 pb-4 border-b border-border">
        <span className="font-mono text-[11px] font-medium text-muted-foreground/40 w-6 shrink-0">
          13
        </span>
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-foreground">
            Tabs
          </h2>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Pill tabs (default) and underline tabs (line variant). Use tabs to
            switch between related views within the same context.
          </p>
        </div>
      </div>

      <div className="space-y-6">
        {/* Pill Tabs — Default */}
        <div className="space-y-3">
          <h3 className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground/60">
            Pill Tabs — Default
          </h3>
          <div className="rounded-xl bg-card shadow-sm overflow-hidden">
            <Tabs defaultValue="overview" className="p-6">
              <TabsList>
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="budget">Budget</TabsTrigger>
                <TabsTrigger value="commitments">Commitments</TabsTrigger>
                <TabsTrigger value="reports">Reports</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="mt-6">
                <div className="grid gap-4 sm:grid-cols-3">
                  {[
                    {
                      label: "Total Budget",
                      value: "$4.2M",
                      sub: "+8.3% from last month",
                      icon: DollarSign,
                    },
                    {
                      label: "Committed",
                      value: "$3.1M",
                      sub: "74% of budget",
                      icon: FileText,
                    },
                    {
                      label: "Variance",
                      value: "$1.1M",
                      sub: "Remaining budget",
                      icon: BarChart3,
                    },
                  ].map(({ label, value, sub, icon: Icon }) => (
                    <div
                      key={label}
                      className="rounded-lg border border-border bg-background p-4"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                          {label}
                        </p>
                      </div>
                      <p className="text-2xl font-semibold text-foreground">
                        {value}
                      </p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {sub}
                      </p>
                    </div>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="budget" className="mt-6">
                <div className="space-y-2">
                  {[
                    { code: "01-000", name: "General Conditions", pct: 82 },
                    { code: "03-000", name: "Concrete", pct: 95 },
                    { code: "05-000", name: "Metals", pct: 61 },
                    { code: "09-000", name: "Finishes", pct: 43 },
                  ].map(({ code, name, pct }) => (
                    <div
                      key={code}
                      className="flex items-center gap-4 rounded-lg border border-border bg-background px-4 py-3"
                    >
                      <span className="font-mono text-[11px] text-muted-foreground w-14 shrink-0">
                        {code}
                      </span>
                      <span className="flex-1 text-[13px] text-foreground">
                        {name}
                      </span>
                      <div className="flex items-center gap-3">
                        <div className="h-1.5 w-24 rounded-full bg-primary/10 overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-[12px] font-medium text-foreground w-8 text-right">
                          {pct}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="commitments" className="mt-6">
                <p className="text-[13px] text-muted-foreground">
                  Commitments content — contracts, subcontracts, and purchase
                  orders.
                </p>
              </TabsContent>

              <TabsContent value="reports" className="mt-6">
                <p className="text-[13px] text-muted-foreground">
                  Reports content — export budget summaries, variance reports,
                  and spend forecasts.
                </p>
              </TabsContent>
            </Tabs>
          </div>
        </div>

        {/* Line / Underline Tabs */}
        <div className="space-y-3">
          <h3 className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground/60">
            Page Tabs
          </h3>
          <div className="rounded-xl bg-card shadow-sm overflow-hidden">
            <div className="p-6">
              <PageTabs
                tabs={[
                  { label: "Inbox", href: "inbox", count: 4, isActive: activePageTab === "inbox" },
                  { label: "Team", href: "team", isActive: activePageTab === "team" },
                  { label: "Recent", href: "recent", isActive: activePageTab === "recent" },
                  { label: "Settings", href: "settings", isActive: activePageTab === "settings" },
                ]}
                variant="inline"
                className="mb-6"
                onTabClick={setActivePageTab}
              />

              {activePageTab === "inbox" ? (
                <div className="space-y-2">
                  {[
                    {
                      title: "RFI #042 response needed",
                      time: "2 min ago",
                      unread: true,
                    },
                    {
                      title: "Change order CO-017 approved",
                      time: "1 hr ago",
                      unread: true,
                    },
                    {
                      title: "Budget update from Westfield",
                      time: "3 hrs ago",
                      unread: true,
                    },
                    {
                      title: "Submittal 88-A reviewed",
                      time: "Yesterday",
                      unread: false,
                    },
                  ].map(({ title, time, unread }) => (
                    <div
                      key={title}
                      className="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-muted/50 transition-colors cursor-pointer"
                    >
                      {unread && (
                        <div className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                      )}
                      {!unread && <div className="h-1.5 w-1.5 shrink-0" />}
                      <p
                        className={`flex-1 text-[13px] ${unread ? "font-medium text-foreground" : "text-muted-foreground"}`}
                      >
                        {title}
                      </p>
                      <span className="text-[11px] text-muted-foreground shrink-0">
                        {time}
                      </span>
                    </div>
                  ))}
                </div>
              ) : null}
              {activePageTab === "team" ? (
                <p className="text-[13px] text-muted-foreground">
                  Team notifications and mentions.
                </p>
              ) : null}
              {activePageTab === "recent" ? (
                <p className="text-[13px] text-muted-foreground">
                  Recently viewed items.
                </p>
              ) : null}
              {activePageTab === "settings" ? (
                <p className="text-[13px] text-muted-foreground">
                  Notification preferences and settings.
                </p>
              ) : null}
            </div>
          </div>
        </div>

        {/* Icon Toggle Group */}
        <div className="space-y-3">
          <h3 className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground/60">
            View Toggle (Compact Pills)
          </h3>
          <div className="rounded-xl bg-card p-6 shadow-sm">
            <Tabs defaultValue="grid">
              <TabsList className="h-8">
                <TabsTrigger value="grid" className="h-6 gap-1.5 px-2.5">
                  <LayoutGrid className="h-3.5 w-3.5" />
                  <span className="text-[12px]">Grid</span>
                </TabsTrigger>
                <TabsTrigger value="list" className="h-6 gap-1.5 px-2.5">
                  <List className="h-3.5 w-3.5" />
                  <span className="text-[12px]">List</span>
                </TabsTrigger>
              </TabsList>
              <TabsContent value="grid" className="mt-4">
                <p className="text-[13px] text-muted-foreground">
                  Grid view content
                </p>
              </TabsContent>
              <TabsContent value="list" className="mt-4">
                <p className="text-[13px] text-muted-foreground">
                  List view content
                </p>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </section>
  );
}
