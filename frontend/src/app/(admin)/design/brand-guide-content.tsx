"use client";

import Image from "next/image";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/ds/status-badge";
import { cn } from "@/lib/utils";

const GUIDE_NAVIGATION = [
  { href: "#identity", label: "Identity" },
  { href: "#color", label: "Color" },
  { href: "#type", label: "Typography" },
  { href: "#principles", label: "Principles" },
  { href: "#components", label: "Components" },
  { href: "#layout", label: "Layout" },
  { href: "#voice", label: "Voice" },
] as const;

const CORE_COLORS = [
  {
    name: "Alleato Orange",
    token: "primary",
    value: "#DC822E",
    usage: "Primary action, current selection, rare emphasis",
    className: "bg-primary text-primary-foreground",
    prominent: true,
  },
  {
    name: "Action Slate",
    token: "action",
    value: "#3B4C63",
    usage: "Established product actions owned by the action variant",
    className: "bg-action text-action-foreground",
    prominent: false,
  },
  {
    name: "Carbon Ink",
    token: "foreground",
    value: "#18181B",
    usage: "Primary type and dark contrast fields",
    className: "bg-foreground text-background",
    prominent: false,
  },
] as const;

const NEUTRAL_COLORS = [
  {
    name: "Canvas",
    token: "background",
    value: "#FFFFFF",
    className: "bg-background",
  },
  {
    name: "Quiet surface",
    token: "muted",
    value: "#F2F2F2",
    className: "bg-muted",
  },
  {
    name: "Hairline",
    token: "border",
    value: "#E6E6E6",
    className: "bg-border",
  },
  {
    name: "Muted graphite",
    token: "muted-foreground",
    value: "#606262",
    className: "bg-muted-foreground",
  },
] as const;

const TYPE_SCALE = [
  {
    label: "Page headline",
    meta: "32 / 40 · 500",
    sample: "Clarity under pressure.",
    className: "text-3xl font-medium tracking-tight sm:text-[2rem]",
  },
  {
    label: "Section title",
    meta: "18 / 23 · 600",
    sample: "The next correct action",
    className: "text-lg font-semibold tracking-tight",
  },
  {
    label: "Body",
    meta: "14 / 21 · 400",
    sample:
      "Project teams should understand the current state, act without friction, and trust the source.",
    className: "max-w-2xl text-sm leading-6",
  },
  {
    label: "Label",
    meta: "14 / 18 · 500",
    sample: "Contract status",
    className: "text-sm font-medium",
  },
  {
    label: "Metadata",
    meta: "12 / 18 · 400",
    sample: "Updated 12 minutes ago",
    className: "text-xs text-muted-foreground",
  },
  {
    label: "Data mono",
    meta: "14 / 21 · 400",
    sample: "CO-2026-0041  ·  $1,245,000",
    className: "font-mono text-sm tabular-nums",
  },
] as const;

const PRINCIPLES = [
  {
    number: "01",
    title: "Design for execution",
    description:
      "Every surface helps someone decide, act, correct, or verify. Static insight without a next action is incomplete.",
  },
  {
    number: "02",
    title: "Reduce before adding",
    description:
      "Remove duplicate copy, decorative structure, and exposed complexity before introducing new UI.",
  },
  {
    number: "03",
    title: "Evidence earns trust",
    description:
      "Important claims and recommendations stay close to their source record and canonical action.",
  },
  {
    number: "04",
    title: "Consistency compounds",
    description:
      "Repeated workflows share layout, density, interaction patterns, and component vocabulary.",
  },
  {
    number: "05",
    title: "Fail loudly, recover clearly",
    description:
      "Errors name the cause, preserve the user’s work, and provide the smallest useful recovery action.",
  },
] as const;

const SPACING_SCALE = [
  { label: "04", className: "w-1" },
  { label: "08", className: "w-2" },
  { label: "12", className: "w-3" },
  { label: "16", className: "w-4" },
  { label: "24", className: "w-6" },
  { label: "32", className: "w-8" },
  { label: "48", className: "w-12" },
] as const;

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-mono text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
      {children}
    </p>
  );
}

function GuideSection({
  id,
  index,
  title,
  intro,
  children,
  className,
}: {
  id: string;
  index: string;
  title: string;
  intro?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      id={id}
      className={cn(
        "scroll-mt-24 border-t border-border pt-8 sm:pt-10",
        className,
      )}
    >
      <div className="grid gap-5 lg:grid-cols-[8rem_minmax(0,1fr)] lg:gap-10">
        <SectionLabel>{index}</SectionLabel>
        <div className="min-w-0">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(15rem,25rem)] lg:items-start lg:gap-10">
            <h2 className="text-2xl font-medium tracking-tight text-foreground sm:text-3xl">
              {title}
            </h2>
            {intro ? (
              <p className="max-w-xl text-sm leading-6 text-muted-foreground">
                {intro}
              </p>
            ) : null}
          </div>
          <div className="mt-8 sm:mt-10">{children}</div>
        </div>
      </div>
    </section>
  );
}

function ColorBlock({
  name,
  token,
  value,
  usage,
  className,
  prominent,
}: (typeof CORE_COLORS)[number]) {
  return (
    <article
      className={cn(
        "flex min-h-52 flex-col justify-between p-5 sm:p-6",
        prominent ? "sm:col-span-2 sm:min-h-72" : "sm:min-h-64",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <p className="text-sm font-medium">{name}</p>
        <code className="font-mono text-xs opacity-70">{value}</code>
      </div>
      <div>
        <code className="font-mono text-xs opacity-70">--{token}</code>
        <p className="mt-2 max-w-xs text-sm leading-5 opacity-80">{usage}</p>
      </div>
    </article>
  );
}

function PrincipleRow({
  number,
  title,
  description,
}: (typeof PRINCIPLES)[number]) {
  return (
    <div className="grid gap-3 border-t border-border py-5 first:border-t-0 sm:grid-cols-[4rem_15rem_minmax(0,1fr)] sm:items-baseline sm:gap-6">
      <span className="font-mono text-xs text-primary">{number}</span>
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
        {description}
      </p>
    </div>
  );
}

function UsageExample({
  label,
  good,
  bad,
}: {
  label: string;
  good: string;
  bad: string;
}) {
  return (
    <div className="grid gap-4 border-t border-border py-5 first:border-t-0 md:grid-cols-[10rem_1fr_1fr] md:items-start md:gap-6">
      <p className="text-sm font-medium text-foreground">{label}</p>
      <div>
        <p className="mb-2 font-mono text-xs uppercase tracking-[0.14em] text-status-success">
          Use
        </p>
        <p className="text-sm leading-6 text-foreground">{good}</p>
      </div>
      <div>
        <p className="mb-2 font-mono text-xs uppercase tracking-[0.14em] text-destructive">
          Avoid
        </p>
        <p className="text-sm leading-6 text-muted-foreground">{bad}</p>
      </div>
    </div>
  );
}

export function BrandGuideContent() {
  return (
      <div className="mx-auto w-full max-w-screen-2xl">
        <header className="pb-10 pt-2 sm:pb-14 lg:pb-20">
          <div className="flex items-center justify-between gap-5">
            <Image
              src="/Alleato-Group-Logo_Dark.png"
              alt="Alleato Group"
              width={280}
              height={61}
              priority
              className="h-auto w-40 sm:w-52 dark:hidden"
            />
            <Image
              src="/Alleato-Group-Logo_Light.png"
              alt="Alleato Group"
              width={280}
              height={61}
              priority
              className="hidden h-auto w-40 sm:w-52 dark:block"
            />
            <p className="font-mono text-xs uppercase tracking-[0.16em] text-muted-foreground">
              Brand system · 2026
            </p>
          </div>

          <div className="mt-12 grid gap-8 lg:mt-20 lg:grid-cols-[minmax(0,1.35fr)_minmax(20rem,0.65fr)] lg:items-end lg:gap-16">
            <div>
              <SectionLabel>The Operator&apos;s Workbench</SectionLabel>
              <h1 className="mt-5 max-w-4xl text-4xl font-medium leading-[1.02] tracking-[-0.045em] text-foreground sm:text-6xl lg:text-7xl">
                Quiet confidence for complex work.
              </h1>
            </div>
            <div className="border-t border-border pt-5 lg:mb-1">
              <p className="max-w-lg text-base leading-7 text-muted-foreground">
                Alleato helps construction teams understand the current state,
                take the next correct action, and trust the evidence behind every
                decision.
              </p>
              <div className="mt-6 flex items-center gap-3">
                <span className="size-2 rounded-full bg-primary" aria-hidden="true" />
                <p className="text-sm font-medium text-foreground">
                  Quiet. Precise. Operator-grade.
                </p>
              </div>
            </div>
          </div>
        </header>

        <div className="sticky top-0 z-20 -mx-4 border-y border-border bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/85 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
          <nav
            aria-label="Brand guide sections"
            className="mx-auto flex max-w-screen-2xl gap-1 overflow-x-auto py-2 scrollbar-hide"
          >
            {GUIDE_NAVIGATION.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="inline-flex min-h-11 shrink-0 items-center rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {item.label}
              </a>
            ))}
          </nav>
        </div>

        <main className="space-y-16 pb-16 pt-12 sm:space-y-20 sm:pt-16 lg:space-y-28 lg:pb-24 lg:pt-20">
          <GuideSection
            id="identity"
            index="01 / Identity"
            title="Built for serious work"
            intro="The brand communicates confidence through clarity, never decoration. It should feel calm under pressure and technically credible."
          >
            <div className="grid overflow-hidden lg:grid-cols-[1.1fr_0.9fr]">
              <div className="flex min-h-72 flex-col justify-between bg-foreground p-6 text-background sm:min-h-96 sm:p-10">
                <Image
                  src="/Alleato-Group-Logo_Light.png"
                  alt="Alleato Group in light treatment"
                  width={360}
                  height={79}
                  className="h-auto w-52 brightness-0 invert sm:w-72"
                />
                <div>
                  <p className="max-w-md text-3xl font-medium leading-tight tracking-tight sm:text-5xl">
                    Content outweighs chrome.
                  </p>
                  <p className="mt-4 max-w-md text-sm leading-6 text-background/65">
                    Controls, filters, badges, and helper text stay subordinate
                    to the user&apos;s work.
                  </p>
                </div>
              </div>
              <div className="flex min-h-72 flex-col justify-between bg-primary p-6 text-primary-foreground sm:min-h-96 sm:p-10">
                <div className="flex items-start justify-between gap-4">
                  <span className="font-mono text-xs uppercase tracking-[0.16em] opacity-70">
                    Core signal
                  </span>
                  <span className="font-mono text-xs opacity-70">#DC822E</span>
                </div>
                <p className="max-w-sm text-2xl font-medium leading-tight tracking-tight sm:text-4xl">
                  Orange means act, select, or attend.
                </p>
              </div>
            </div>
          </GuideSection>

          <GuideSection
            id="color"
            index="02 / Color"
            title="One accent, used with intent"
            intro="The palette is restrained. Orange carries the brand, neutrals carry the work, and status colors communicate state rather than decoration."
          >
            <div className="grid gap-px bg-border sm:grid-cols-2 lg:grid-cols-4">
              {CORE_COLORS.map((color) => (
                <ColorBlock key={color.token} {...color} />
              ))}
            </div>

            <div className="mt-10">
              <div className="mb-4 flex items-baseline justify-between gap-4">
                <h3 className="text-base font-semibold text-foreground">
                  Neutral foundation
                </h3>
                <p className="font-mono text-xs text-muted-foreground">
                  Runtime semantic tokens
                </p>
              </div>
              <div className="grid border-y border-border sm:grid-cols-2 lg:grid-cols-4">
                {NEUTRAL_COLORS.map((color, index) => (
                  <div
                    key={color.token}
                    className={cn(
                      "py-5 sm:px-5",
                      index > 0 && "sm:border-l sm:border-border",
                    )}
                  >
                    <div
                      className={cn(
                        "h-16 w-full border border-border",
                        color.className,
                      )}
                    />
                    <div className="mt-3 flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {color.name}
                        </p>
                        <code className="font-mono text-xs text-muted-foreground">
                          --{color.token}
                        </code>
                      </div>
                      <code className="font-mono text-xs text-muted-foreground">
                        {color.value}
                      </code>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-10 grid gap-6 lg:grid-cols-[12rem_minmax(0,1fr)]">
              <div>
                <h3 className="text-base font-semibold text-foreground">Status</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Use a shared status primitive. Color is never the only cue.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3 border-y border-border py-5">
                <StatusBadge status="Approved" />
                <StatusBadge status="Pending" />
                <StatusBadge status="Overdue" />
                <StatusBadge status="In Progress" />
                <StatusBadge status="Archived" />
              </div>
            </div>
          </GuideSection>

          <GuideSection
            id="type"
            index="03 / Typography"
            title="Neutral, compact, legible"
            intro="Inter carries the entire product. The scale is intentionally tight so dense workflows remain calm and predictable."
          >
            <div className="border-y border-border">
              {TYPE_SCALE.map((style) => (
                <div
                  key={style.label}
                  className="grid gap-3 border-t border-border py-6 first:border-t-0 lg:grid-cols-[10rem_9rem_minmax(0,1fr)] lg:items-baseline lg:gap-6"
                >
                  <p className="text-sm font-medium text-foreground">
                    {style.label}
                  </p>
                  <code className="font-mono text-xs text-muted-foreground">
                    {style.meta}
                  </code>
                  <p className={cn("text-foreground", style.className)}>
                    {style.sample}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-10 grid gap-8 bg-muted/60 p-6 sm:p-8 lg:grid-cols-[minmax(0,1fr)_17rem] lg:items-end">
              <p className="max-w-xl text-3xl font-medium leading-tight tracking-[-0.03em] text-foreground sm:text-4xl">
                The interface should disappear into the work.
              </p>
              <div className="space-y-3 text-sm leading-6 text-muted-foreground">
                <p>Sentence case for headings and actions.</p>
                <p>Maximum 65 to 75 characters for prose.</p>
                <p>Monospace only when fixed width improves scanning.</p>
              </div>
            </div>
          </GuideSection>

          <GuideSection
            id="principles"
            index="04 / Principles"
            title="A system of earned attention"
            intro="Every visible element spends attention. Its place is justified by comprehension, confidence, speed, prevention, evidence, or recovery."
          >
            <div className="border-y border-border">
              {PRINCIPLES.map((principle) => (
                <PrincipleRow key={principle.number} {...principle} />
              ))}
            </div>
          </GuideSection>

          <GuideSection
            id="components"
            index="05 / Components"
            title="Familiar patterns are a feature"
            intro="Shared primitives own geometry, interaction states, density, and accessibility. Consume their variants instead of recreating their classes."
          >
            <div className="grid gap-10 lg:grid-cols-2 lg:gap-14">
              <div>
                <div className="mb-5 flex items-baseline justify-between gap-4">
                  <h3 className="text-base font-semibold text-foreground">
                    Actions
                  </h3>
                  <code className="font-mono text-xs text-muted-foreground">
                    Button
                  </code>
                </div>
                <div className="flex min-h-44 flex-wrap items-center gap-3 border-y border-border p-5 sm:p-7">
                  <Button>Save changes</Button>
                  <Button variant="action">Open review</Button>
                  <Button variant="outline">Cancel</Button>
                  <Button variant="ghost">View source</Button>
                </div>
                <p className="mt-4 max-w-xl text-sm leading-6 text-muted-foreground">
                  One primary action per surface. Use direct command labels and
                  keep destructive actions last.
                </p>
              </div>

              <div>
                <div className="mb-5 flex items-baseline justify-between gap-4">
                  <h3 className="text-base font-semibold text-foreground">
                    Fields
                  </h3>
                  <code className="font-mono text-xs text-muted-foreground">
                    Input
                  </code>
                </div>
                <div className="flex min-h-44 items-center border-y border-border p-5 sm:p-7">
                  <div className="w-full max-w-md">
                    <label
                      htmlFor="brand-guide-input"
                      className="mb-2 block text-sm font-medium text-foreground"
                    >
                      Commitment title
                    </label>
                    <Input
                      id="brand-guide-input"
                      placeholder="Enter a title"
                      aria-describedby="brand-guide-input-help"
                    />
                    <p
                      id="brand-guide-input-help"
                      className="mt-2 text-xs text-muted-foreground"
                    >
                      Labels explain the decision, not the database field.
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <div className="mb-5 flex items-baseline justify-between gap-4">
                  <h3 className="text-base font-semibold text-foreground">
                    Compact menu
                  </h3>
                  <code className="font-mono text-xs text-muted-foreground">
                    DropdownMenu
                  </code>
                </div>
                <div className="flex min-h-44 items-center border-y border-border p-5 sm:p-7">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline">Record actions</Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-52">
                      <DropdownMenuItem>Edit</DropdownMenuItem>
                      <DropdownMenuItem>Duplicate</DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-destructive">
                        Archive
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <p className="mt-4 max-w-xl text-sm leading-6 text-muted-foreground">
                  Two to five direct commands. No feed, search, metrics, or
                  internal scroll.
                </p>
              </div>

              <div>
                <div className="mb-5 flex items-baseline justify-between gap-4">
                  <h3 className="text-base font-semibold text-foreground">
                    Feedback
                  </h3>
                  <code className="font-mono text-xs text-muted-foreground">
                    StatusBadge
                  </code>
                </div>
                <div className="flex min-h-44 flex-wrap items-center gap-3 border-y border-border p-5 sm:p-7">
                  <StatusBadge status="Approved" />
                  <StatusBadge status="Pending" />
                  <StatusBadge status="Rejected" />
                  <span className="text-sm text-muted-foreground">
                    Last checked 4 minutes ago
                  </span>
                </div>
                <p className="mt-4 max-w-xl text-sm leading-6 text-muted-foreground">
                  Success stays quiet. Alerts are reserved for a state that
                  requires recovery.
                </p>
              </div>
            </div>
          </GuideSection>

          <GuideSection
            id="layout"
            index="06 / Layout"
            title="Open sections, clear rhythm"
            intro="White space is the primary separator. Borders define controls and real boundaries, not arbitrary groups."
          >
            <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-14">
              <div className="bg-muted/55 p-4 sm:p-6">
                <div className="bg-background px-4 py-5 sm:px-6">
                  <div className="flex items-start justify-between gap-4 border-b border-border pb-5">
                    <div>
                      <div className="h-2 w-16 bg-primary" />
                      <div className="mt-4 h-5 w-48 bg-foreground" />
                    </div>
                    <div className="h-9 w-28 rounded-lg bg-primary" />
                  </div>
                  <div className="space-y-8 pt-8">
                    <div>
                      <div className="h-4 w-36 bg-foreground" />
                      <div className="mt-4 space-y-px bg-border">
                        <div className="h-12 bg-background" />
                        <div className="h-12 bg-background" />
                        <div className="h-12 bg-background" />
                      </div>
                    </div>
                    <div>
                      <div className="h-4 w-28 bg-foreground" />
                      <div className="mt-4 h-24 bg-muted" />
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-base font-semibold text-foreground">
                  Spacing rhythm
                </h3>
                <div className="mt-5 space-y-4 border-y border-border py-5">
                  {SPACING_SCALE.map((space) => (
                    <div
                      key={space.label}
                      className="grid grid-cols-[2rem_minmax(0,1fr)] items-center gap-4"
                    >
                      <code className="font-mono text-xs text-muted-foreground">
                        {space.label}
                      </code>
                      <div className="h-3 bg-muted">
                        <div
                          className={cn("h-full bg-primary", space.className)}
                        />
                      </div>
                    </div>
                  ))}
                </div>
                <p className="mt-5 text-sm leading-6 text-muted-foreground">
                  Four pixels handles micro alignment. Eight to sixteen groups
                  related controls. Twenty-four to thirty-two separates content.
                  Forty-eight marks a major shift.
                </p>
              </div>
            </div>

            <div className="mt-10 grid gap-4 border-y border-border py-6 sm:grid-cols-3">
              <div className="py-3 sm:pr-5">
                <p className="font-mono text-xs text-primary">01</p>
                <p className="mt-3 text-sm font-semibold text-foreground">
                  Page shell
                </p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Owns navigation, responsive gutters, and scroll behavior.
                </p>
              </div>
              <div className="py-3 sm:border-l sm:border-border sm:px-5">
                <p className="font-mono text-xs text-primary">02</p>
                <p className="mt-3 text-sm font-semibold text-foreground">
                  Section content
                </p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Open on the canvas, structured by type, spacing, and rows.
                </p>
              </div>
              <div className="py-3 sm:border-l sm:border-border sm:pl-5">
                <p className="font-mono text-xs text-primary">03</p>
                <p className="mt-3 text-sm font-semibold text-foreground">
                  Localized module
                </p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  A real bounded object such as attachments, comments, or input.
                </p>
              </div>
            </div>
          </GuideSection>

          <GuideSection
            id="voice"
            index="07 / Voice"
            title="Direct, specific, low-drama"
            intro="Copy gives the user information they lack: a constraint, consequence, source, state, or recovery action."
          >
            <div className="border-y border-border">
              <UsageExample
                label="Page title"
                good="Create prime contract"
                bad="Prime Contract Creation Experience"
              />
              <UsageExample
                label="Description"
                good="Changes to this signed contract require re-approval."
                bad="Use this page to view and edit contract details."
              />
              <UsageExample
                label="Error"
                good="The contract could not be saved because the number is already in use. Choose another number."
                bad="Something went wrong. Please try again."
              />
              <UsageExample
                label="Empty state"
                good="No commitments yet. Create the first commitment to begin tracking contracted cost."
                bad="There is nothing to show here."
              />
            </div>

            <div className="mt-12 bg-foreground px-6 py-12 text-background sm:px-10 sm:py-16">
              <p className="font-mono text-xs uppercase tracking-[0.16em] text-background/55">
                The final test
              </p>
              <p className="mt-6 max-w-2xl text-3xl font-medium leading-tight tracking-[-0.03em] sm:text-5xl">
                Users should think about their work, not the software.
              </p>
            </div>
          </GuideSection>
        </main>
      </div>
  );
}
