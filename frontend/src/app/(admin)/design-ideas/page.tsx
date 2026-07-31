"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ds";

// New sections matching HTML reference (17 sections)
import { ElevationSection } from "./_sections/elevation";
import { ShadowsSection } from "./_sections/shadows";
import { TypographyScaleSection } from "./_sections/typography-scale";
import { WhitespaceSection } from "./_sections/whitespace";
import { BentoGridSection } from "./_sections/bento-grid";
import { DividersSection } from "./_sections/dividers";
import { AccentBarsSection } from "./_sections/accent-bars";
import { InvertedPyramidSection } from "./_sections/inverted-pyramid";
import { MasterDetailSection } from "./_sections/master-detail";
import { SettingsPageSection } from "./_sections/settings-page";
import { NavSidebarSection } from "./_sections/nav-sidebar";
import { KpiBlocksSection } from "./_sections/kpi-blocks";
import { DataTablesSection } from "./_sections/data-tables";
import { InteractiveStatesSection } from "./_sections/interactive-states";
import { EmptyStatesSection } from "./_sections/empty-states";
import { SpacingSystemSection } from "./_sections/spacing-system";
import { ColorSystemSection } from "./_sections/color-system";

// Existing React-interactive sections (kept after the 17 HTML sections)
import { FormInputsSection } from "./_sections/form-inputs";
import { OverlaysSection } from "./_sections/overlays";
import { NavigationSection } from "./_sections/navigation";
import { AccordionsSection } from "./_sections/accordions";
import { TabsSection } from "./_sections/tabs-section";
import { BadgesSection } from "./_sections/badges-section";
import { ProgressSkeletonsSection } from "./_sections/progress-skeletons";

const navGroups = [
  {
    label: "Hierarchy",
    items: [
      { id: "elevation", label: "Surface Elevation" },
      { id: "shadows", label: "Shadows" },
      { id: "typography", label: "Typography Scale" },
      { id: "whitespace", label: "Whitespace" },
      { id: "bento", label: "Bento Grid" },
      { id: "dividers", label: "Dividers" },
      { id: "accents", label: "Accent Bars" },
    ],
  },
  {
    label: "Layouts",
    items: [
      { id: "inverted-pyramid", label: "Inverted Pyramid" },
      { id: "master-detail", label: "Master / Detail" },
      { id: "settings-pattern", label: "Settings Page" },
      { id: "nav-pattern", label: "Navigation" },
    ],
  },
  {
    label: "Components",
    items: [
      { id: "kpi", label: "KPI Blocks" },
      { id: "tables", label: "Data Tables" },
      { id: "states", label: "Interactive States" },
      { id: "empty", label: "Empty States" },
    ],
  },
  {
    label: "Foundations",
    items: [
      { id: "spacing", label: "Spacing System" },
      { id: "colors", label: "Color System" },
    ],
  },
  {
    label: "Overlays",
    items: [{ id: "overlays", label: "Modals & Sheets" }],
  },
  {
    label: "Controls",
    items: [
      { id: "form-inputs", label: "Forms & Inputs" },
      { id: "navigation", label: "Tabs & Breadcrumbs" },
      { id: "accordions", label: "Accordions" },
    ],
  },
  {
    label: "Indicators",
    items: [
      { id: "badges", label: "Badges & Pills" },
      { id: "progress", label: "Progress & Skeletons" },
    ],
  },
];

export default function DesignSystemPage() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="min-h-screen bg-background">
      <div className="flex">
        {/* Sticky Sidebar — matches HTML sidenav */}
        <nav className="sticky top-0 hidden h-screen w-[220px] shrink-0 overflow-y-auto border-r border-border bg-card px-2 py-6 shadow-sm lg:block">
          <div className="flex items-center justify-between px-2 mb-6">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground/40">
                Design Reference
              </span>
              <span className="inline-block text-[9px] font-bold uppercase tracking-[0.06em] px-1.5 py-0.5 rounded bg-primary/[0.07] text-primary border border-primary/20">
                Light
              </span>
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              aria-label="Toggle theme"
            >
              <Sun className="rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
              <Moon className="absolute rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            </Button>
          </div>

          {navGroups.map((group) => (
            <div key={group.label} className="mb-6">
              <p className="mb-1 mt-4 px-2 text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground/30">
                {group.label}
              </p>
              <ul className="space-y-0.5">
                {group.items.map((item) => (
                  <li key={item.id}>
                    <a
                      href={`#${item.id}`}
                      className="block rounded-md px-2 py-1 text-[13px] text-muted-foreground/60 transition-colors hover:bg-muted hover:text-foreground"
                    >
                      {item.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        {/* Main Content */}
        <main className="min-w-0 flex-1 px-14 py-12 max-w-[1100px]">
          {/* Page Header */}
          <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-primary mb-3">
            Visual Reference — Light Mode
          </p>
          <h1 className="text-[32px] font-bold tracking-[-0.03em] text-foreground leading-[1.1] mb-3">
            Premium Light UI
            <br />
            Examples for AI Agents
          </h1>
          <p className="text-[15px] text-muted-foreground leading-[1.7] max-w-[600px] mb-12">
            The same 16 hierarchy techniques and layout patterns — recalibrated
            for light mode. Different rules, different traps, different wins.
          </p>

          {/* Mode Callout */}
          <div className="bg-primary/[0.07] border border-primary/20 border-l-[3px] border-l-primary rounded-lg px-4 py-3 text-[13px] text-muted-foreground leading-[1.6] mb-14">
            <strong className="text-foreground">
              Light mode is not dark mode inverted.
            </strong>{" "}
            Four key differences: (1) Elevation goes <em>lighter</em> — white
            panels float above a gray canvas, not the other way around. (2)
            Shadows carry the depth work that dark contrast does in dark mode —
            use them deliberately. (3) Text opacity values shift: secondary is
            55% (not 65%), tertiary is 35% (not 40%). (4) Status and accent
            colors need to be slightly more saturated to hold against white
            backgrounds.
          </div>

          {/* All Sections */}
          <div className="space-y-[72px]">
            {/* Hierarchy (01–07) */}
            <ElevationSection />
            <ShadowsSection />
            <TypographyScaleSection />
            <WhitespaceSection />
            <BentoGridSection />
            <DividersSection />
            <AccentBarsSection />

            {/* Layouts (08–11) */}
            <InvertedPyramidSection />
            <MasterDetailSection />
            <SettingsPageSection />
            <NavSidebarSection />

            {/* Components (12–15) */}
            <KpiBlocksSection />
            <DataTablesSection />
            <InteractiveStatesSection />
            <EmptyStatesSection />

            {/* Foundations (16–17) */}
            <SpacingSystemSection />
            <ColorSystemSection />

            {/* React-Interactive Sections */}
            <OverlaysSection />
            <FormInputsSection />
            <NavigationSection />
            <AccordionsSection />
            <TabsSection />
            <BadgesSection />
            <ProgressSkeletonsSection />
          </div>
        </main>
      </div>
    </div>
  );
}
