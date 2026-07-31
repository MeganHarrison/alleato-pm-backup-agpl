import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { PageShell, PageTabs, SectionRuleHeading } from "@/components/layout";
import { EmptyState } from "@/components/ds";
import { Button } from "@/components/ui/button";
import { serviceDb } from "@/lib/supabase/service-db";

export const dynamic = "force-dynamic";

type SettingsTab = "general" | "divisions" | "sets" | "permissions";

interface PageProps {
  params: Promise<{ projectId: string }>;
  searchParams?: Promise<{ tab?: string }>;
}

function normalizeTab(value: string | undefined): SettingsTab {
  if (value === "divisions" || value === "sets" || value === "permissions") {
    return value;
  }
  return "general";
}

function deriveDivisionNumber(sectionNumber: string): string {
  const prefix = sectionNumber.trim().slice(0, 2);
  return /^\d{2}$/.test(prefix) ? prefix : "100";
}

export default async function SpecificationSettingsPage({
  params,
  searchParams,
}: PageProps) {
  const { projectId } = await params;
  const resolvedSearchParams = await searchParams;
  const activeTab = normalizeTab(resolvedSearchParams?.tab);
  const projectIdNum = Number.parseInt(projectId, 10);

  const [
    sectionsResult,
    archivedResult,
    revisionsResult,
    divisionsResult,
    areasResult,
    subscribersResult,
  ] = await Promise.all([
    serviceDb.from("specification_sections")
      .select("id, section_number, title, status", { count: "exact" })
      .eq("project_id", projectIdNum)
      .neq("status", "archived")
      .order("section_number"),
    serviceDb.from("specification_sections")
      .select("id", { count: "exact", head: true })
      .eq("project_id", projectIdNum)
      .eq("status", "archived"),
    serviceDb.from("specification_section_revisions")
      .select(
        "id, specification_sections!specification_section_revisions_section_id_fkey!inner(project_id)",
        { count: "exact", head: true },
      )
      .eq("specification_sections.project_id", projectIdNum),
    serviceDb.from("specification_divisions")
      .select("id, division_number, title, description")
      .eq("project_id", projectIdNum)
      .order("division_number"),
    serviceDb.from("specification_areas")
      .select("id, name, description")
      .eq("project_id", projectIdNum)
      .order("sort_order"),
    serviceDb.from("specification_subscribers")
      .select("id, specification_sections!inner(project_id)", { count: "exact", head: true })
      .eq("specification_sections.project_id", projectIdNum),
  ]);

  const sections = sectionsResult.data ?? [];
  const divisions = divisionsResult.data ?? [];
  const areas = areasResult.data ?? [];
  const counts = {
    activeSections: sectionsResult.count ?? sections.length,
    archivedSections: archivedResult.count ?? 0,
    revisions: revisionsResult.count ?? 0,
    subscribers: subscribersResult.count ?? 0,
  };

  const derivedDivisionRows =
    divisions.length > 0
      ? divisions.map((division) => ({
          number: division.division_number,
          title: division.title,
          source: "Configured",
        }))
      : Array.from(
          new Map(
            sections.map((section) => [
              deriveDivisionNumber(section.section_number),
              {
                number: deriveDivisionNumber(section.section_number),
                title:
                  deriveDivisionNumber(section.section_number) === "100"
                    ? "Unclassified"
                    : `Division ${deriveDivisionNumber(section.section_number)}`,
                source: "Derived from section number",
              },
            ]),
          ).values(),
        ).sort((left, right) => left.number.localeCompare(right.number));

  const basePath = `/${projectId}/specifications/settings`;
  const tabs = [
    { label: "General", href: `${basePath}?tab=general`, isActive: activeTab === "general" },
    { label: "Divisions", href: `${basePath}?tab=divisions`, isActive: activeTab === "divisions" },
    { label: "Sets", href: `${basePath}?tab=sets`, isActive: activeTab === "sets" },
    {
      label: "Permissions",
      href: `${basePath}?tab=permissions`,
      isActive: activeTab === "permissions",
    },
  ];

  return (
    <PageShell
      variant="content"
      title="Specifications Settings"
      actions={
        <Button variant="outline" size="sm" asChild>
          <Link href={`/${projectId}/specifications`}>
            <ArrowLeft className="h-4 w-4" />
            Specifications
          </Link>
        </Button>
      }
    >
        <PageTabs tabs={tabs} variant="inline" />

        {activeTab === "general" && (
          <section className="space-y-6">
            <div className="space-y-2">
              <SectionRuleHeading label="General Settings" />
              <div className="divide-y divide-border text-sm">
                <div className="grid gap-2 py-3 sm:grid-cols-[18rem_1fr]">
                  <span className="font-medium text-foreground">
                    Revision number ordering scheme
                  </span>
                  <span className="text-muted-foreground">
                    Letters first, then numbers. Stored revisions currently use numeric sequence.
                  </span>
                </div>
                <div className="grid gap-2 py-3 sm:grid-cols-[18rem_1fr]">
                  <span className="font-medium text-foreground">
                    Enable specifications by area
                  </span>
                  <span className="text-muted-foreground">
                    {areas.length > 0
                      ? `${areas.length} specification area${areas.length === 1 ? "" : "s"} configured.`
                      : "No specification areas configured."}
                  </span>
                </div>
                <div className="grid gap-2 py-3 sm:grid-cols-[18rem_1fr]">
                  <span className="font-medium text-foreground">
                    Specifications subscribers
                  </span>
                  <span className="text-muted-foreground">
                    {counts.subscribers} subscriber record{counts.subscribers === 1 ? "" : "s"}.
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <SectionRuleHeading label="Current Data" />
              <div className="divide-y divide-border text-sm">
                <div className="grid gap-2 py-3 sm:grid-cols-[18rem_1fr]">
                  <span className="font-medium text-foreground">Active sections</span>
                  <span className="text-muted-foreground">{counts.activeSections}</span>
                </div>
                <div className="grid gap-2 py-3 sm:grid-cols-[18rem_1fr]">
                  <span className="font-medium text-foreground">Revisions</span>
                  <span className="text-muted-foreground">{counts.revisions}</span>
                </div>
                <div className="grid gap-2 py-3 sm:grid-cols-[18rem_1fr]">
                  <span className="font-medium text-foreground">Recycle bin</span>
                  <span className="text-muted-foreground">{counts.archivedSections}</span>
                </div>
              </div>
            </div>
          </section>
        )}

        {activeTab === "divisions" && (
          <section className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <SectionRuleHeading label="Divisions" />
              <Button variant="outline" size="sm" asChild>
                <Link href={`/${projectId}/specifications`}>Create Division</Link>
              </Button>
            </div>
            <div className="divide-y divide-border text-sm">
              <div className="grid grid-cols-[7rem_1fr] gap-4 py-2 font-medium text-muted-foreground sm:grid-cols-[7rem_1fr_12rem]">
                <span>Number</span>
                <span>Description</span>
                <span className="hidden sm:block">Source</span>
              </div>
              {derivedDivisionRows.length === 0 ? (
                <EmptyState
                  title="No divisions"
                  description="Create a division from the Specifications page."
                  className="py-8"
                />
              ) : (
                derivedDivisionRows.map((division) => (
                  <div
                    key={division.number}
                    className="grid grid-cols-[7rem_1fr] gap-4 py-3 sm:grid-cols-[7rem_1fr_12rem]"
                  >
                    <span className="font-mono">{division.number}</span>
                    <span>{division.title}</span>
                    <span className="hidden text-muted-foreground sm:block">
                      {division.source}
                    </span>
                  </div>
                ))
              )}
            </div>
          </section>
        )}

        {activeTab === "sets" && (
          <section className="space-y-4">
            <SectionRuleHeading label="Sets" />
            <div className="divide-y divide-border text-sm">
              <div className="grid grid-cols-[1fr_8rem_8rem] gap-4 py-2 font-medium text-muted-foreground">
                <span>Name</span>
                <span>Set Date</span>
                <span>Status</span>
              </div>
              <EmptyState
                title="No specification sets"
                description="Sets are not stored separately yet; upload metadata is retained on revision notes."
                className="py-8"
              />
            </div>
          </section>
        )}

        {activeTab === "permissions" && (
          <section className="space-y-4">
            <SectionRuleHeading label="User Permissions for Specifications" />
            <div className="divide-y divide-border text-sm">
              <div className="grid gap-4 py-2 font-medium text-muted-foreground md:grid-cols-[12rem_1fr_14rem]">
                <span>Permission area</span>
                <span>Current behavior</span>
                <span>Change support</span>
              </div>
              <div className="grid gap-2 py-3 md:grid-cols-[12rem_1fr_14rem] md:gap-4">
                <span className="font-medium">Read</span>
                <span>Controlled by project document permissions.</span>
                <span className="text-muted-foreground">Managed in project permissions.</span>
              </div>
              <div className="grid gap-2 py-3 md:grid-cols-[12rem_1fr_14rem] md:gap-4">
                <span className="font-medium">Create and update</span>
                <span>Authenticated project users use guarded API routes.</span>
                <span className="text-muted-foreground">Per-tool permission editing is not wired.</span>
              </div>
              <div className="grid gap-2 py-3 md:grid-cols-[12rem_1fr_14rem] md:gap-4">
                <span className="font-medium">Subscribers</span>
                <span>
                  {counts.subscribers} current subscriber record{counts.subscribers === 1 ? "" : "s"}.
                </span>
                <span className="text-muted-foreground">Managed from specification rows.</span>
              </div>
            </div>
          </section>
        )}
    </PageShell>
  );
}
