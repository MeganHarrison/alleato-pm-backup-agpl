"use client";

import { useRef, useState } from "react";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronRight,
  Copy,
  FileCode2,
  Layers,
  Zap,
  MousePointer,
  Sparkles,
  Home,
  Settings,
  Search,
  Bell,
  Mail,
  Calendar,
  Users,
} from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AnimatedBeam } from "@/components/ui-library/animated-beam";
import {
  AnimatedList,
  AnimatedListItem,
} from "@/components/ui-library/animated-list";
import {
  Avatar,
  AvatarBadge,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
} from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ButtonGroup, ButtonGroupText } from "@/components/ui/button-group";
import { Confetti, ConfettiButton } from "@/components/ui/confetti";
import { Dock, DockIcon } from "@/components/ui/dock";
import { DottedMap } from "@/components/ui/dotted-map";
import { IconCloud } from "@/components/ui/icon-cloud";
import { LightRays } from "@/components/ui/light-rays";
import Text3DFlip from "@/components/ui/text-3d-flip";
import { TransitionPanel } from "@/components/ui/transition-panel";
import { AnimatedBackground } from "@/components/motion/animated-background";
import {
  Modal,
  ModalTrigger,
  ModalBody,
  ModalContent,
  ModalFooter,
} from "@/components/ui-library/animated-modal";
import CardBackgroundOverlay from "@/components/ui/card-background-overlay";
import CardAuthor from "@/components/ui/card-author";
import CardFeatureAnimated, {
  Card as AcCard,
  CardSkeletonContainer,
  CardTitle as AcCardTitle,
  CardDescription as AcCardDescription,
} from "@/components/ui/card-feature-animated";
import { Tree, Folder, File } from "@/components/ui/file-tree";
import { FileUpload } from "@/components/ui/file-upload";
import { FloatingNav } from "@/components/ui/floating-navbar";
import { Highlighter } from "@/components/ui/highlighter";
import { LinkPreview } from "@/components/ui/link-preview";
import { MultiStepLoader } from "@/components/ui/multi-step-loader";
import { Notch, type NotchItem } from "@/components/ui/notch";
import { Tooltip } from "@/components/ui/tooltip-card";
import WorldMap from "@/components/ui-library/world-map";
import ExpandableCardDemoImport from "@/components/ui-library/expandable-card-demo-standard";
import ExpandableCardGridDemoImport from "@/components/ui-library/expandable-card-demo-grid";
import { OrbitingCirclesDemo } from "@/components/ui-library/orbiting-circles-demo";
import {
  PropertyList,
  Property,
  PropertyLabel,
  PropertyValue,
} from "@/components/ui/property";
import { SplitPage, useSplitPage } from "@/components/ui/split-page";
import {
  BarChart,
  AreaChart,
  LineChart,
  Sparkline,
} from "@/components/ui/charts";
import {
  Tour,
  TourDialog,
  TourDialogHeader,
  TourDialogBody,
  TourDialogFooter,
  TourNextButton,
  TourDismissButton,
} from "@/components/ui/tour";
import {
  FiltersProvider,
  FiltersAddButton,
  ActiveFiltersList,
  NoFilteredResults,
  useFilters,
  type FilterDef,
  type ActiveFilter,
} from "@/components/ui/filters";
import {
  StatBreakdown,
  StatBreakdownCard,
  StatBreakdownGrid,
} from "@/components/ui/stat-breakdown";
import { Button } from "@/components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { NumberInput } from "@/components/ui/number-input";
import { SimplePagination } from "@/components/ui/pagination";
import { Progress } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import {
  CreditCard,
  Upload,
  Navigation2,
  Network,
  Map,
  RefreshCcw,
  ScanText,
  LayoutList,
  PanelLeft,
  Inbox,
  ArrowLeft,
  TrendingUp,
  Table,
  LayoutDashboard,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Sidebar nav ─────────────────────────────────────────────────────────────

const SECTIONS = [
  { id: "core-ui", label: "Core UI", icon: FileCode2 },
  { id: "accordion", label: "Accordion", parent: true },
  { id: "alerts", label: "Alerts", parent: true },
  { id: "avatars", label: "Avatars", parent: true },
  { id: "badges", label: "Badges", parent: true },
  { id: "button-group", label: "Button Group", parent: true },
  { id: "input-group", label: "Input Group", parent: true },
  { id: "number-input", label: "Number Input", parent: true },
  { id: "pagination", label: "Pagination", parent: true },
  { id: "progress-spinner", label: "Progress + Spinner", parent: true },
  { id: "switches", label: "Switches", parent: true },
  { id: "layout", label: "Layout", icon: PanelLeft },
  { id: "split-page", label: "Split Page", parent: true },
  { id: "cards", label: "Cards", icon: CreditCard },
  { id: "card-background-overlay", label: "Background Overlay", parent: true },
  { id: "card-author", label: "Author Card", parent: true },
  { id: "card-feature-animated", label: "Feature Animated", parent: true },
  { id: "special-effects", label: "Special Effects", icon: Sparkles },
  { id: "animated-beam", label: "Animated Beam", parent: true },
  { id: "light-rays", label: "Light Rays", parent: true },
  { id: "orbiting-circles", label: "Orbiting Circles", parent: true },
  { id: "dotted-map", label: "Dotted Map", parent: true },
  { id: "interactive", label: "Interactive", icon: MousePointer },
  { id: "dock", label: "Dock", parent: true },
  { id: "icon-cloud", label: "Icon Cloud", parent: true },
  { id: "confetti", label: "Confetti", parent: true },
  { id: "motion", label: "Motion", icon: Zap },
  { id: "animated-list", label: "Animated List", parent: true },
  { id: "animated-background", label: "Animated Background", parent: true },
  { id: "transition-panel", label: "Transition Panel", parent: true },
  { id: "text-3d-flip", label: "Text 3D Flip", parent: true },
  { id: "animated-modal", label: "Animated Modal", parent: true },
  { id: "navigation", label: "Navigation", icon: Navigation2 },
  { id: "floating-navbar", label: "Floating Navbar", parent: true },
  { id: "notch", label: "Notch", parent: true },
  { id: "data-display", label: "Data Display", icon: LayoutList },
  { id: "property", label: "Property", parent: true },
  { id: "file-tree", label: "File Tree", parent: true },
  { id: "world-map", label: "World Map", parent: true },
  { id: "expandable-card", label: "Expandable Card", parent: true },
  { id: "expandable-card-grid", label: "Expandable Card — Grid", parent: true },
  { id: "inputs", label: "Inputs", icon: Upload },
  { id: "file-upload", label: "File Upload", parent: true },
  { id: "link-preview", label: "Link Preview", parent: true },
  { id: "tooltip-card", label: "Tooltip Card", parent: true },
  { id: "feedback", label: "Feedback", icon: RefreshCcw },
  { id: "multi-step-loader", label: "Multi-Step Loader", parent: true },
  { id: "highlighter", label: "Highlighter", parent: true },
  { id: "visualization", label: "Visualization", icon: TrendingUp },
  { id: "bar-chart", label: "Bar Chart", parent: true },
  { id: "area-chart", label: "Area Chart", parent: true },
  { id: "line-chart", label: "Line Chart", parent: true },
  { id: "sparkline", label: "Sparkline", parent: true },
  { id: "engagement", label: "Engagement", icon: Users },
  { id: "tour", label: "Tour", parent: true },
  { id: "advanced-data", label: "Advanced Data", icon: Table },
  { id: "filters", label: "Filters", parent: true },
  { id: "stat-breakdown", label: "Stat Breakdown", parent: true },
  { id: "dashboard-widgets", label: "Dashboard Widgets", icon: LayoutDashboard },
  { id: "health-ring", label: "Health Ring", parent: true },
  { id: "ai-brief-callout", label: "AI Brief Callout", parent: true },
  { id: "schedule-timeline", label: "Schedule Timeline", parent: true },
  { id: "milestone-timeline", label: "Milestone Timeline", parent: true },
  { id: "activity-list", label: "Activity List", parent: true },
  { id: "ai-chat-panel", label: "AI Chat Panel", parent: true },
];

function scrollTo(id: string) {
  document
    .getElementById(id)
    ?.scrollIntoView({ behavior: "smooth", block: "start" });
}

// ─── Copy-paste usage snippets (keyed by section id) ──────────────────────────
// The import path + minimal JSX you paste into a page to use each component.

const CODE_SNIPPETS: Record<string, string> = {
  accordion: `import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";

<Accordion type="single" collapsible defaultValue="item-1">
  <AccordionItem value="item-1">
    <AccordionTrigger>When should I use this?</AccordionTrigger>
    <AccordionContent>Secondary detail goes here.</AccordionContent>
  </AccordionItem>
</Accordion>`,

  alerts: `import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";

<Alert variant="warning">
  <AlertTriangle />
  <AlertTitle>Needs review</AlertTitle>
  <AlertDescription>Two line items are missing cost codes.</AlertDescription>
</Alert>`,

  avatars: `import {
  Avatar,
  AvatarFallback,
  AvatarBadge,
  AvatarGroup,
  AvatarGroupCount,
} from "@/components/ui/avatar";

<AvatarGroup>
  <Avatar><AvatarFallback>BC</AvatarFallback></Avatar>
  <Avatar><AvatarFallback>JD</AvatarFallback></Avatar>
  <AvatarGroupCount>+4</AvatarGroupCount>
</AvatarGroup>`,

  badges: `import { Badge } from "@/components/ui/badge";

<Badge variant="active">Active</Badge>
<Badge variant="warning">Pending</Badge>
<Badge variant="success">Approved</Badge>
<Badge variant="inactive">Inactive</Badge>`,

  "button-group": `import { ButtonGroup, ButtonGroupText } from "@/components/ui/button-group";
import { Button } from "@/components/ui/button";

<ButtonGroup>
  <ButtonGroupText>Scope</ButtonGroupText>
  <Button variant="outline">Project</Button>
  <Button variant="outline">Company</Button>
</ButtonGroup>`,

  "input-group": `import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupButton,
} from "@/components/ui/input-group";

<InputGroup>
  <InputGroupAddon>Package</InputGroupAddon>
  <InputGroupInput defaultValue="SUB-042" aria-label="Package" />
  <InputGroupButton>Apply</InputGroupButton>
</InputGroup>`,

  "number-input": `import { NumberInput } from "@/components/ui/number-input";

const [value, setValue] = useState("1250.00");

<NumberInput
  value={value}
  onChange={(event) => setValue(event.target.value)}
  aria-label="Quantity"
/>`,

  pagination: `import { SimplePagination } from "@/components/ui/pagination";

const [page, setPage] = useState(1);

<SimplePagination currentPage={page} totalPages={10} onPageChange={setPage} />`,

  "progress-spinner": `import { Progress } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";

<Progress value={72} />
<Spinner />`,

  switches: `import { Switch } from "@/components/ui/switch";

<Switch defaultChecked aria-label="Notify assignee" />`,

  "split-page": `import { SplitPage, useSplitPage } from "@/components/ui/split-page";

<SplitPage breakpoint="md" defaultIsOpen>
  <div>Left pane — list</div>
  <div>Right pane — detail</div>
</SplitPage>

// Toggle panes from any child with the hook:
const { onOpen, onClose } = useSplitPage();`,

  "card-background-overlay": `import CardBackgroundOverlay from "@/components/ui/card-background-overlay";

<CardBackgroundOverlay />`,

  "card-author": `import CardAuthor from "@/components/ui/card-author";

<CardAuthor />`,

  "card-feature-animated": `import CardFeatureAnimated from "@/components/ui/card-feature-animated";

<CardFeatureAnimated />`,

  "animated-beam": `import { useRef } from "react";
import { AnimatedBeam } from "@/components/ui-library/animated-beam";

const containerRef = useRef<HTMLDivElement>(null);
const fromRef = useRef<HTMLDivElement>(null);
const toRef = useRef<HTMLDivElement>(null);

<div ref={containerRef} className="relative flex justify-between">
  <div ref={fromRef}>A</div>
  <div ref={toRef}>B</div>
  <AnimatedBeam containerRef={containerRef} fromRef={fromRef} toRef={toRef} />
</div>`,

  "light-rays": `import { LightRays } from "@/components/ui/light-rays";

<div className="relative h-64 overflow-hidden">
  <LightRays count={8} color="rgba(160, 200, 255, 0.25)" blur={32} speed={12} length="80%" />
</div>`,

  "orbiting-circles": `import { OrbitingCircles } from "@/components/ui/orbiting-circles";

<OrbitingCircles iconSize={40}>
  <YourIcon />
  <YourIcon />
</OrbitingCircles>
<OrbitingCircles iconSize={30} radius={100} reverse speed={2}>
  <YourIcon />
</OrbitingCircles>`,

  "dotted-map": `import { DottedMap } from "@/components/ui/dotted-map";

<DottedMap
  markers={[
    { lat: 40.7128, lng: -74.006, size: 0.6, pulse: true },
    { lat: 51.5074, lng: -0.1278, size: 0.6, pulse: true },
  ]}
  dotRadius={0.3}
  pulse
/>`,

  dock: `import { Dock, DockIcon } from "@/components/ui/dock";
import { Home, Search, Settings } from "lucide-react";

<Dock>
  <DockIcon><Home className="h-5 w-5" /></DockIcon>
  <DockIcon><Search className="h-5 w-5" /></DockIcon>
  <DockIcon><Settings className="h-5 w-5" /></DockIcon>
</Dock>`,

  "icon-cloud": `import { IconCloud } from "@/components/ui/icon-cloud";

<IconCloud
  images={[
    "https://cdn.simpleicons.org/react/61DAFB",
    "https://cdn.simpleicons.org/nextdotjs/000000",
  ]}
/>`,

  confetti: `import { ConfettiButton } from "@/components/ui/confetti";

<ConfettiButton options={{ spread: 90, particleCount: 80, origin: { y: 0.6 } }}>
  🎉 Fire Confetti
</ConfettiButton>`,

  "animated-list": `import {
  AnimatedList,
  AnimatedListItem,
} from "@/components/ui-library/animated-list";

<AnimatedList delay={1200}>
  {items.map((item, i) => (
    <div key={i}>{item.title}</div>
  ))}
</AnimatedList>`,

  "animated-background": `import { AnimatedBackground } from "@/components/motion/animated-background";
import { Button } from "@/components/ui/button";

<AnimatedBackground
  defaultValue="Overview"
  className="rounded-md bg-background shadow-sm"
  transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
>
  {tabs.map((tab) => (
    <Button key={tab} data-id={tab} variant="ghost" size="sm">
      {tab}
    </Button>
  ))}
</AnimatedBackground>`,

  "transition-panel": `import { TransitionPanel } from "@/components/ui/transition-panel";

const [active, setActive] = useState(0);

<TransitionPanel
  activeIndex={active}
  variants={{
    enter: { opacity: 0, x: 12 },
    center: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -12 },
  }}
  transition={{ duration: 0.18, ease: "easeOut" }}
>
  {panels.map((text, i) => (
    <p key={i}>{text}</p>
  ))}
</TransitionPanel>`,

  "text-3d-flip": `import Text3DFlip from "@/components/ui/text-3d-flip";

<Text3DFlip
  className="text-3xl font-bold [perspective:500px]"
  textClassName="[transform-style:preserve-3d]"
  flipTextClassName="text-primary [transform-style:preserve-3d]"
  rotateDirection="right"
>
  Hover over me
</Text3DFlip>`,

  "animated-modal": `import {
  Modal,
  ModalTrigger,
  ModalBody,
  ModalContent,
  ModalFooter,
} from "@/components/ui-library/animated-modal";

<Modal>
  <ModalTrigger>Open Modal</ModalTrigger>
  <ModalBody>
    <ModalContent>
      <h4>Spring Modal</h4>
      <p>Spring physics entry/exit animation.</p>
    </ModalContent>
    <ModalFooter>
      <Button>Confirm</Button>
    </ModalFooter>
  </ModalBody>
</Modal>`,

  "floating-navbar": `import { FloatingNav } from "@/components/ui/floating-navbar";

<FloatingNav
  navItems={[
    { name: "Home", link: "/" },
    { name: "Projects", link: "/projects" },
    { name: "Budget", link: "/budget" },
  ]}
/>`,

  notch: `import { Notch, type NotchItem } from "@/components/ui/notch";

const items: NotchItem[] = [
  {
    id: "background",
    label: "Background",
    options: [
      { id: "#3b82f6", label: "Blue" },
      { id: "#8b5cf6", label: "Violet" },
    ],
    value: bg,
    onChange: (id) => setBg(id),
  },
];

<Notch items={items} position="bottom" />`,

  property: `import {
  PropertyList,
  Property,
  PropertyLabel,
  PropertyValue,
} from "@/components/ui/property";
import { Mail, Phone } from "lucide-react";

// 1. Single property
<Property label="Project Manager" value="Brandon Clymer" />

// 2. Property list — inside a card
<div className="rounded-lg border border-border px-4">
  <PropertyList>
    <Property label="Owner" value="Brandon Clymer" />
    <Property label="Contract value" value="$4,200,000" />
    <Property label="Location" value="Morrisville, NC" />
  </PropertyList>
</div>

// 3. Composable — icon label (PropertyLabel + PropertyValue)
<PropertyList>
  <Property>
    <PropertyLabel width="20px">
      <Mail className="h-4 w-4 text-muted-foreground" />
    </PropertyLabel>
    <PropertyValue>brandon@alleatogroup.com</PropertyValue>
  </Property>
  <Property>
    <PropertyLabel width="20px">
      <Phone className="h-4 w-4 text-muted-foreground" />
    </PropertyLabel>
    <PropertyValue>(919) 555-0142</PropertyValue>
  </Property>
</PropertyList>

// 4. Rich value nodes — value accepts any ReactNode
<PropertyList>
  <Property
    label="Budget used"
    value={
      <div className="flex flex-1 flex-col gap-1">
        <span className="text-sm">$840,000 / $4,200,000</span>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary" style={{ width: "20%" }} />
        </div>
      </div>
    }
  />
  <Property
    label="Status"
    value={
      <span className="inline-flex rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
        On track
      </span>
    }
  />
</PropertyList>`,

  "file-tree": `import { Tree, Folder, File } from "@/components/ui/file-tree";

<Tree initialSelectedId="budget">
  <Folder element="Documents" value="docs">
    <File value="contract.pdf"><span>Contract.pdf</span></File>
  </Folder>
</Tree>`,

  "world-map": `import WorldMap from "@/components/ui-library/world-map";

<WorldMap
  dots={[
    { start: { lat: 64.2008, lng: -149.4937 }, end: { lat: 34.0522, lng: -118.2437 } },
    { start: { lat: 51.5074, lng: -0.1278 }, end: { lat: 28.6139, lng: 77.209 } },
  ]}
/>`,

  "expandable-card": `import ExpandableCardDemo from "@/components/ui-library/expandable-card-demo-standard";

<ExpandableCardDemo />`,

  "expandable-card-grid": `import ExpandableCardGridDemo from "@/components/ui-library/expandable-card-demo-grid";

<ExpandableCardGridDemo />`,

  "file-upload": `import { FileUpload } from "@/components/ui/file-upload";

<FileUpload onChange={(files) => console.log(files)} />`,

  "link-preview": `import { LinkPreview } from "@/components/ui/link-preview";

<LinkPreview
  url="https://nextjs.org"
  isStatic
  imageSrc="https://assets.aceternity.com/demos/next.png"
>
  Next.js
</LinkPreview>`,

  "tooltip-card": `import { Tooltip } from "@/components/ui/tooltip-card";

<Tooltip content="Morrisville Station is a $42M mixed-use development.">
  <span className="underline decoration-dotted">Morrisville Station</span>
</Tooltip>`,

  "multi-step-loader": `import { MultiStepLoader } from "@/components/ui/multi-step-loader";

const [loading, setLoading] = useState(false);
const states = [{ text: "Connecting..." }, { text: "Syncing..." }, { text: "Done!" }];

<MultiStepLoader loadingStates={states} loading={loading} duration={800} loop={false} />`,

  highlighter: `import { Highlighter } from "@/components/ui/highlighter";

<Highlighter action="highlight" color="#fde68a">budget variance</Highlighter>
<Highlighter action="underline" color="#f97316">change order log</Highlighter>
<Highlighter action="circle" color="#6366f1">submittal deadline</Highlighter>`,

  "bar-chart": `import { BarChart } from "@/components/ui/charts";

<BarChart
  data={data}
  categories={["Revenue", "Costs"]}
  valueFormatter={(v) => "$" + (v / 1000).toFixed(0) + "k"}
  height="260px"
  yAxisWidth={52}
/>`,

  "area-chart": `import { AreaChart } from "@/components/ui/charts";

<AreaChart
  data={data}
  categories={["Revenue", "Costs"]}
  valueFormatter={(v) => "$" + (v / 1000).toFixed(0) + "k"}
  height="260px"
  yAxisWidth={52}
/>`,

  "line-chart": `import { LineChart } from "@/components/ui/charts";

<LineChart
  data={data}
  categories={["Revenue", "Costs"]}
  valueFormatter={(v) => "$" + (v / 1000).toFixed(0) + "k"}
  height="260px"
  yAxisWidth={52}
/>`,

  sparkline: `import { Sparkline } from "@/components/ui/charts";

<Sparkline
  data={data}
  categories={["v"]}
  height="36px"
  className="w-20"
  colors={["hsl(var(--chart-2))"]}
/>`,

  tour: `import {
  Tour,
  TourDialog,
  TourDialogHeader,
  TourDialogBody,
  TourDialogFooter,
  TourNextButton,
  TourDismissButton,
} from "@/components/ui/tour";

<Tour isActive={isActive} onComplete={() => setIsActive(false)}>
  <TourDialog target="[data-tour='proj-name']">
    <TourDialogHeader>Project name</TourDialogHeader>
    <TourDialogBody>Give your project a clear name.</TourDialogBody>
    <TourDialogFooter>
      <TourDismissButton />
      <TourNextButton />
    </TourDialogFooter>
  </TourDialog>
</Tour>`,

  filters: `import {
  FiltersProvider,
  FiltersAddButton,
  ActiveFiltersList,
  NoFilteredResults,
  type FilterDef,
} from "@/components/ui/filters";

const filters: FilterDef[] = [
  {
    id: "status",
    label: "Status",
    type: "enum",
    options: [{ value: "active", label: "Active" }],
  },
];

<FiltersProvider filters={filters} onChange={setActive}>
  <FiltersAddButton />
  <ActiveFiltersList />
</FiltersProvider>`,

  "stat-breakdown": `import {
  StatBreakdownCard,
  StatBreakdownGrid,
} from "@/components/ui/stat-breakdown";

<StatBreakdownGrid>
  <StatBreakdownCard
    name="Total tokens"
    total="4,229"
    details={[
      { name: "Completion tokens", value: "1,480", percentageValue: 35 },
      { name: "Prompt tokens", value: "2,749", percentageValue: 65 },
    ]}
  />
</StatBreakdownGrid>`,
};

// ─── Section wrapper ──────────────────────────────────────────────────────────

function CodeBlock({ code }: { code: string }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    void navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <div className="mt-3 overflow-hidden rounded-xl border border-border bg-muted/40">
      <div className="flex items-center justify-between px-1.5 py-1">
        <Button
          onClick={() => setOpen((value) => !value)}
          variant="ghost"
          size="sm"
          aria-expanded={open}
          className="h-7 gap-1.5 px-2 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          <ChevronRight
            className={cn(
              "h-3.5 w-3.5 transition-transform",
              open && "rotate-90",
            )}
          />
          Usage
        </Button>
        {open && (
          <Button
            onClick={handleCopy}
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
            {copied ? "Copied" : "Copy"}
          </Button>
        )}
      </div>
      {open && (
        <pre className="overflow-x-auto border-t border-border px-4 py-3 text-xs leading-relaxed">
          <code className="font-mono text-foreground/90">{code}</code>
        </pre>
      )}
    </div>
  );
}

function ComponentSection({
  id,
  name,
  description,
  children,
  previewClassName,
}: {
  id: string;
  name: string;
  description: string;
  children: React.ReactNode;
  previewClassName?: string;
}) {
  const code = CODE_SNIPPETS[id];
  return (
    <section id={id} className="scroll-mt-8">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-foreground">{name}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      <div
        className={cn(
          "flex items-center justify-center rounded-xl border border-border bg-muted/30 min-h-64 overflow-hidden relative",
          previewClassName,
        )}
      >
        {children}
      </div>
      {code && <CodeBlock code={code} />}
    </section>
  );
}

function SectionHeading({
  id,
  label,
  icon: Icon,
}: {
  id: string;
  label: string;
  icon: React.ElementType;
}) {
  return (
    <div id={id} className="flex items-center gap-2 pt-2 scroll-mt-8">
      <Icon className="h-4 w-4 text-muted-foreground" />
      <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        {label}
      </h3>
      <div className="flex-1 h-px bg-border" />
    </div>
  );
}

// ─── Core UI Demos ───────────────────────────────────────────────────────────

function AccordionDemo() {
  return (
    <div className="w-full max-w-lg p-6">
      <Accordion type="single" collapsible defaultValue="item-1">
        <AccordionItem value="item-1">
          <AccordionTrigger>When should I use this?</AccordionTrigger>
          <AccordionContent>
            Use accordions for secondary detail that should not compete with the
            primary workflow.
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="item-2">
          <AccordionTrigger>What should stay visible?</AccordionTrigger>
          <AccordionContent>
            Keep labels, current state, and recovery actions visible outside the
            collapsed content.
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}

function AlertsDemo() {
  return (
    <div className="grid w-full gap-3 p-6">
      <Alert>
        <CheckCircle2 />
        <AlertTitle>Ready to publish</AlertTitle>
        <AlertDescription>
          All required fields have source-backed values.
        </AlertDescription>
      </Alert>
      <Alert variant="warning">
        <AlertTriangle />
        <AlertTitle>Needs review</AlertTitle>
        <AlertDescription>
          Two line items are missing cost code assignments.
        </AlertDescription>
      </Alert>
    </div>
  );
}

function AvatarsDemo() {
  return (
    <div className="flex w-full items-center justify-center gap-6 p-6">
      <Avatar size="lg">
        <AvatarFallback>MH</AvatarFallback>
        <AvatarBadge />
      </Avatar>
      <AvatarGroup>
        <Avatar>
          <AvatarFallback>BC</AvatarFallback>
        </Avatar>
        <Avatar>
          <AvatarFallback>JD</AvatarFallback>
        </Avatar>
        <Avatar>
          <AvatarFallback>AR</AvatarFallback>
        </Avatar>
        <AvatarGroupCount>+4</AvatarGroupCount>
      </AvatarGroup>
    </div>
  );
}

function BadgesDemo() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-2 p-6">
      <Badge variant="active">Active</Badge>
      <Badge variant="warning">Pending</Badge>
      <Badge variant="success">Approved</Badge>
      <Badge variant="inactive">Inactive</Badge>
      <Badge variant="project-manager">Project manager</Badge>
    </div>
  );
}

function ButtonGroupDemo() {
  return (
    <div className="flex flex-col items-center gap-4 p-6">
      <ButtonGroup>
        <Button variant="outline">Day</Button>
        <Button variant="outline">Week</Button>
        <Button variant="outline">Month</Button>
      </ButtonGroup>
      <ButtonGroup>
        <ButtonGroupText>Scope</ButtonGroupText>
        <Button variant="outline">Project</Button>
        <Button variant="outline">Company</Button>
      </ButtonGroup>
    </div>
  );
}

function InputGroupDemo() {
  return (
    <div className="w-full max-w-md space-y-3 p-6">
      <InputGroup>
        <InputGroupAddon>Package</InputGroupAddon>
        <InputGroupInput defaultValue="SUB-042" aria-label="Package" />
        <InputGroupButton>Apply</InputGroupButton>
      </InputGroup>
      <InputGroup>
        <InputGroupAddon align="inline-start">CO</InputGroupAddon>
        <InputGroupInput defaultValue="004" aria-label="Change order" />
      </InputGroup>
    </div>
  );
}

function NumberInputDemo() {
  const [value, setValue] = useState("1250.00");

  return (
    <div className="w-full max-w-xs space-y-3 p-6">
      <NumberInput
        value={value}
        onChange={(event) => setValue(event.target.value)}
        aria-label="Quantity"
      />
      <p className="text-xs text-muted-foreground">
        Raw value: <span className="tabular-nums">{value || "empty"}</span>
      </p>
    </div>
  );
}

function PaginationDemo() {
  const [page, setPage] = useState(3);

  return (
    <div className="w-full p-6">
      <SimplePagination
        currentPage={page}
        totalPages={10}
        onPageChange={setPage}
      />
    </div>
  );
}

function ProgressSpinnerDemo() {
  return (
    <div className="w-full max-w-sm space-y-4 p-6">
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">Upload progress</span>
          <span className="text-muted-foreground">72%</span>
        </div>
        <Progress value={72} />
      </div>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Spinner />
        Syncing drawings
      </div>
    </div>
  );
}

function SwitchesDemo() {
  return (
    <div className="grid w-full max-w-sm gap-4 p-6">
      <label className="flex items-center justify-between gap-4 text-sm">
        <span>Notify assignee</span>
        <Switch defaultChecked aria-label="Notify assignee" />
      </label>
      <label className="flex items-center justify-between gap-4 text-sm">
        <span>Require approval</span>
        <Switch aria-label="Require approval" />
      </label>
    </div>
  );
}

// ─── Animated Beam Demo ───────────────────────────────────────────────────────

function AnimatedBeamDemo() {
  const containerRef = useRef<HTMLDivElement>(null);
  const fromRef = useRef<HTMLDivElement>(null);
  const toRef = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={containerRef}
      className="relative flex w-full max-w-sm items-center justify-between px-16 py-12"
    >
      <div
        ref={fromRef}
        className="flex h-12 w-12 items-center justify-center rounded-full border border-border bg-background shadow-sm"
      >
        <Layers className="h-5 w-5 text-muted-foreground" />
      </div>
      <div className="flex h-12 w-12 items-center justify-center rounded-full border border-border bg-background shadow-sm">
        <Sparkles className="h-5 w-5 text-primary" />
      </div>
      <div
        ref={toRef}
        className="flex h-12 w-12 items-center justify-center rounded-full border border-border bg-background shadow-sm"
      >
        <Zap className="h-5 w-5 text-muted-foreground" />
      </div>
      <AnimatedBeam
        containerRef={containerRef}
        fromRef={fromRef}
        toRef={toRef}
        gradientStartColor="#DB802D"
        gradientStopColor="#9c40ff"
      />
    </div>
  );
}

// ─── Light Rays Demo ──────────────────────────────────────────────────────────

function LightRaysDemo() {
  return (
    <div className="relative w-full h-64 rounded-xl overflow-hidden flex items-center justify-center bg-neutral-950">
      <LightRays
        count={8}
        color="rgba(160, 200, 255, 0.25)"
        blur={32}
        speed={12}
        length="80%"
      />
      <span
        className="relative z-10 text-lg font-semibold tracking-tight"
        style={{ color: "white" }}
      >
        Light Rays
      </span>
    </div>
  );
}

// ─── Dotted Map Demo ──────────────────────────────────────────────────────────

function DottedMapDemo() {
  return (
    <div className="w-full max-w-lg px-4 text-muted-foreground">
      <DottedMap
        markers={[
          { lat: 40.7128, lng: -74.006, size: 0.6, pulse: true },
          { lat: 51.5074, lng: -0.1278, size: 0.6, pulse: true },
          { lat: 35.6762, lng: 139.6503, size: 0.6, pulse: true },
          { lat: -33.8688, lng: 151.2093, size: 0.5 },
        ]}
        dotRadius={0.3}
        pulse
      />
    </div>
  );
}

// ─── Dock Demo ────────────────────────────────────────────────────────────────

function DockDemo() {
  const icons = [Home, Search, Bell, Mail, Calendar, Settings];
  return (
    <div className="flex items-end justify-center py-8 w-full">
      <Dock>
        {icons.map((Icon, i) => (
          <DockIcon key={i}>
            <Icon className="h-5 w-5 text-foreground" />
          </DockIcon>
        ))}
      </Dock>
    </div>
  );
}

// ─── Icon Cloud Demo ──────────────────────────────────────────────────────────

const CLOUD_IMAGES = [
  "https://cdn.simpleicons.org/typescript/3178C6",
  "https://cdn.simpleicons.org/react/61DAFB",
  "https://cdn.simpleicons.org/nextdotjs/000000",
  "https://cdn.simpleicons.org/tailwindcss/06B6D4",
  "https://cdn.simpleicons.org/supabase/3FCF8E",
  "https://cdn.simpleicons.org/vercel/000000",
  "https://cdn.simpleicons.org/postgresql/4169E1",
  "https://cdn.simpleicons.org/prisma/2D3748",
  "https://cdn.simpleicons.org/openai/412991",
  "https://cdn.simpleicons.org/framer/0055FF",
  "https://cdn.simpleicons.org/figma/F24E1E",
  "https://cdn.simpleicons.org/github/181717",
];

function IconCloudDemo() {
  return (
    <div className="flex items-center justify-center w-48 h-48">
      <IconCloud images={CLOUD_IMAGES} />
    </div>
  );
}

// ─── Confetti Demo ────────────────────────────────────────────────────────────

function ConfettiDemo() {
  return (
    <div className="flex flex-col items-center gap-4 py-8">
      <ConfettiButton
        options={{ spread: 90, particleCount: 80, origin: { y: 0.6 } }}
      >
        🎉 Fire Confetti
      </ConfettiButton>
      <p className="text-xs text-muted-foreground">Click to trigger</p>
    </div>
  );
}

// ─── Animated List Demo ───────────────────────────────────────────────────────

const NOTIFICATIONS = [
  { icon: "🔔", title: "New comment", body: "Sarah left a note on Budget Q3" },
  { icon: "✅", title: "Task completed", body: "Foundation poured — Lot 12" },
  {
    icon: "📄",
    title: "Submittal approved",
    body: "Steel reinforcement — Rev C",
  },
  { icon: "💬", title: "New RFI", body: "Waterproofing membrane spec?" },
  { icon: "📦", title: "PO issued", body: "Electrical rough-in — $42,000" },
];

function AnimatedListDemo() {
  return (
    <div className="w-full max-w-xs py-4">
      <AnimatedList delay={1200}>
        {NOTIFICATIONS.map((n, i) => (
          <div
            key={i}
            className="flex items-start gap-3 rounded-lg border border-border bg-background px-3 py-2.5 shadow-sm w-full"
          >
            <span className="text-lg leading-none mt-0.5">{n.icon}</span>
            <div className="min-w-0">
              <p className="text-xs font-medium text-foreground">{n.title}</p>
              <p className="text-xs text-muted-foreground truncate">{n.body}</p>
            </div>
          </div>
        ))}
      </AnimatedList>
    </div>
  );
}

// ─── Animated Background Demo ─────────────────────────────────────────────────

const NAV_TABS = ["Overview", "Analytics", "Reports", "Settings"];

function AnimatedBackgroundDemo() {
  return (
    <div className="flex space-x-1 rounded-lg bg-muted p-1">
      <AnimatedBackground
        defaultValue={NAV_TABS[0]}
        className="rounded-md bg-background shadow-sm"
        transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
      >
        {NAV_TABS.map((tab) => (
          <Button
            key={tab}
            data-id={tab}
            variant="ghost"
            size="sm"
            className="px-3 py-1.5 text-sm font-medium text-muted-foreground data-[checked=true]:text-foreground"
          >
            {tab}
          </Button>
        ))}
      </AnimatedBackground>
    </div>
  );
}

// ─── Transition Panel Demo ────────────────────────────────────────────────────

const PANEL_TABS = ["Features", "Pricing", "FAQ"];
const PANEL_CONTENT = [
  "Powerful construction management tools — budgets, contracts, change orders, drawings, submittals, and RFIs in one platform.",
  "Start free. Scale as you grow. No per-seat pricing. Unlimited projects on every plan.",
  "Yes, you can import data from Procore, Excel, or CSV. Migration support is included.",
];

function TransitionPanelDemo() {
  const [active, setActive] = useState(0);

  return (
    <div className="w-full max-w-sm">
      <div className="flex space-x-1 mb-4 rounded-lg bg-muted p-1">
        {PANEL_TABS.map((t, i) => (
          <Button
            key={t}
            onClick={() => setActive(i)}
            variant="ghost"
            size="sm"
            className={cn(
              "flex-1 rounded-md py-1.5 text-xs font-medium transition-colors h-auto",
              active === i
                ? "bg-background text-foreground shadow-sm hover:bg-background"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t}
          </Button>
        ))}
      </div>
      <TransitionPanel
        activeIndex={active}
        variants={{
          enter: { opacity: 0, x: 12 },
          center: { opacity: 1, x: 0 },
          exit: { opacity: 0, x: -12 },
        }}
        transition={{ duration: 0.18, ease: "easeOut" }}
        className="min-h-16 px-1"
      >
        {PANEL_CONTENT.map((text, i) => (
          <p key={i} className="text-sm text-muted-foreground leading-relaxed">
            {text}
          </p>
        ))}
      </TransitionPanel>
    </div>
  );
}

// ─── Text 3D Flip Demo ────────────────────────────────────────────────────────

function Text3DFlipDemo() {
  return (
    <div className="flex flex-col items-center gap-3 py-4">
      <Text3DFlip
        className="text-3xl font-bold text-foreground [perspective:500px]"
        textClassName="[transform-style:preserve-3d]"
        flipTextClassName="text-primary [transform-style:preserve-3d]"
        rotateDirection="right"
      >
        Hover over me
      </Text3DFlip>
      <p className="text-xs text-muted-foreground">
        Hover to animate each character
      </p>
    </div>
  );
}

// ─── Animated Modal Demo ──────────────────────────────────────────────────────

function AnimatedModalDemo() {
  return (
    <div className="py-8">
      <Modal>
        <ModalTrigger className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
          Open Modal
        </ModalTrigger>
        <ModalBody>
          <ModalContent>
            <h4 className="mb-2 text-base font-semibold text-foreground">
              Spring Modal
            </h4>
            <p className="text-sm text-muted-foreground">
              This modal uses spring physics for a natural entry/exit animation.
              Click outside or the × to close.
            </p>
          </ModalContent>
          <ModalFooter>
            <Button className="rounded-md px-4 py-2 text-sm font-medium">
              Confirm
            </Button>
          </ModalFooter>
        </ModalBody>
      </Modal>
    </div>
  );
}

// ─── Layout demos ─────────────────────────────────────────────────────────────

const INBOX_ITEMS = [
  {
    id: 1,
    from: "Brandon Clymer",
    subject: "Morrisville – RFI #42 response",
    preview: "See attached structural clarification...",
    time: "9:14 AM",
    unread: true,
  },
  {
    id: 2,
    from: "Sarah Mitchell",
    subject: "Change order CO-0018 approved",
    preview: "The owner has signed off on the scope change...",
    time: "Yesterday",
    unread: false,
  },
  {
    id: 3,
    from: "Tyler Ross",
    subject: "Submittal 14B – rejected",
    preview: "Missing fire-rating stamp on sheet A-201...",
    time: "Mon",
    unread: false,
  },
  {
    id: 4,
    from: "Jen Paulson",
    subject: "Invoice #INV-2024-0037 ready",
    preview: "Attached is the pay application for period...",
    time: "Jun 20",
    unread: false,
  },
];

function InboxDetail({
  item,
  onBack,
}: {
  item: (typeof INBOX_ITEMS)[0];
  onBack: () => void;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b border-border px-4 py-3">
        <Button
          onClick={onBack}
          variant="ghost"
          size="sm"
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground md:hidden h-auto px-1 py-0"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back
        </Button>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">
            {item.subject}
          </p>
          <p className="text-xs text-muted-foreground">From: {item.from}</p>
        </div>
      </div>
      <div className="flex-1 p-6 text-sm text-muted-foreground">
        <p>
          {item.preview} Lorem ipsum dolor sit amet consectetur adipisicing
          elit. Quisquam, voluptatem.
        </p>
      </div>
    </div>
  );
}

function SplitPageDemo() {
  const [selected, setSelected] = useState<(typeof INBOX_ITEMS)[0] | null>(
    null,
  );

  return (
    <div
      className="w-full border border-border rounded-xl overflow-hidden"
      style={{ height: 420 }}
    >
      <SplitPage breakpoint="md" defaultIsOpen={!selected}>
        {/* Left pane — inbox list */}
        <div className="flex h-full w-full flex-col border-r border-border md:w-64">
          <div className="flex items-center gap-2 border-b border-border px-4 py-3">
            <Inbox className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-semibold text-foreground">Inbox</span>
          </div>
          <div className="flex-1 overflow-y-auto">
            {INBOX_ITEMS.map((item) => (
              <SplitPageListItem
                key={item.id}
                item={item}
                isSelected={selected?.id === item.id}
                onSelect={() => setSelected(item)}
              />
            ))}
          </div>
        </div>

        {/* Right pane — detail */}
        {selected ? (
          <SplitPageDetailPane
            item={selected}
            onClear={() => setSelected(null)}
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-muted-foreground">
            <Inbox className="h-8 w-8 opacity-30" />
            <p className="text-sm">Select a message to read</p>
          </div>
        )}
      </SplitPage>
    </div>
  );
}

function SplitPageListItem({
  item,
  isSelected,
  onSelect,
}: {
  item: (typeof INBOX_ITEMS)[0];
  isSelected: boolean;
  onSelect: () => void;
}) {
  const { onClose } = useSplitPage();
  return (
    <Button
      onClick={() => {
        onSelect();
        onClose();
      }}
      variant="ghost"
      className={cn(
        "w-full justify-start text-left px-4 py-3 rounded-none border-b border-border transition-colors hover:bg-muted/60 h-auto",
        isSelected && "bg-primary/5",
      )}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span
          className={cn(
            "text-xs truncate",
            item.unread
              ? "font-semibold text-foreground"
              : "text-muted-foreground",
          )}
        >
          {item.from}
        </span>
        <span className="text-[10px] shrink-0 text-muted-foreground">
          {item.time}
        </span>
      </div>
      <p
        className={cn(
          "text-xs truncate mt-0.5",
          item.unread ? "text-foreground font-medium" : "text-muted-foreground",
        )}
      >
        {item.subject}
      </p>
      <p className="text-[11px] text-muted-foreground truncate mt-0.5">
        {item.preview}
      </p>
    </Button>
  );
}

function SplitPageDetailPane({
  item,
  onClear,
}: {
  item: (typeof INBOX_ITEMS)[0];
  onClear: () => void;
}) {
  const { onOpen } = useSplitPage();
  return (
    <InboxDetail
      item={item}
      onBack={() => {
        onClear();
        onOpen();
      }}
    />
  );
}

// ─── Navigation demos ─────────────────────────────────────────────────────────

function FloatingNavDemo() {
  const navItems = [
    { name: "Home", link: "#" },
    { name: "Projects", link: "#" },
    { name: "Budget", link: "#" },
    { name: "Team", link: "#" },
  ];
  return (
    <div className="relative w-full h-48 flex items-center justify-center bg-gradient-to-b from-muted/60 to-background rounded-lg overflow-hidden">
      <p className="text-xs text-muted-foreground">
        Appears fixed at top when scrolling up on a real page
      </p>
      {/* Show static version for preview */}
      <div className="absolute top-4 inset-x-0 flex justify-center pointer-events-none">
        <div className="flex items-center justify-center space-x-2 rounded-full border border-border/20 bg-background/80 px-2 py-1.5 shadow-sm backdrop-blur-md">
          <div className="flex items-center gap-1">
            {navItems.map((item, idx) => (
              <span
                key={idx}
                className="relative flex items-center gap-1 rounded-full px-4 py-2 text-sm font-medium text-muted-foreground"
              >
                {item.name}
              </span>
            ))}
          </div>
          <div className="h-5 w-px bg-border" />
          <Button size="sm" className="rounded-full px-4">
            Login
          </Button>
        </div>
      </div>
    </div>
  );
}

function NotchDemo() {
  const [bg, setBg] = useState("#3b82f6");
  const [align, setAlign] = useState<"left" | "center" | "right">("center");

  const items: NotchItem[] = [
    {
      id: "background",
      label: "Background",
      options: [
        { id: "#3b82f6", label: "Blue" },
        { id: "#8b5cf6", label: "Violet" },
        { id: "#10b981", label: "Emerald" },
        { id: "#f43f5e", label: "Rose" },
      ],
      value: bg,
      onChange: (id) => setBg(id),
    },
    {
      id: "alignment",
      label: "Alignment",
      options: [
        { id: "left", label: "Left" },
        { id: "center", label: "Center" },
        { id: "right", label: "Right" },
      ],
      value: align,
      onChange: (id) => setAlign(id as "left" | "center" | "right"),
    },
  ];

  return (
    <div
      className="relative flex w-full items-center justify-center overflow-hidden rounded-lg bg-muted [&_.fixed]:absolute"
      style={{ minHeight: 400 }}
    >
      <div
        className={cn(
          "relative flex w-64 flex-col justify-center gap-2 overflow-hidden rounded-2xl px-1 pt-1 pb-8 text-white shadow-sm transition-colors duration-300",
          align === "left"
            ? "items-start text-left"
            : align === "right"
              ? "items-end text-right"
              : "items-center text-center",
        )}
      >
        <div
          style={{ background: bg }}
          className="absolute inset-0 transition-colors duration-300"
        />
        <img
          src="https://images.unsplash.com/photo-1559825481-12a05cc00344?q=80&w=400&auto=format&fit=crop"
          alt="demo"
          className="relative z-20 h-full w-full rounded-xl object-cover shadow-xs"
        />
        <div className="relative z-20 px-4">
          <h3 className="mt-4 text-lg font-semibold">Construction site</h3>
          <p className="text-sm text-white/80">
            Use the notch below to adjust.
          </p>
        </div>
      </div>
      <Notch items={items} position="bottom" />
    </div>
  );
}

// ─── Data Display demos ───────────────────────────────────────────────────────

function PropertyDemo() {
  return (
    <div className="w-full max-w-2xl space-y-8 p-6">
      {/* Single property */}
      <div>
        <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Single property
        </p>
        <Property label="Project Manager" value="Brandon Clymer" />
      </div>

      {/* Property list — contact card */}
      <div>
        <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Property list
        </p>
        <div className="rounded-lg border border-border">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <span className="text-sm font-semibold">Morrisville Station</span>
            <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
              Active
            </span>
          </div>
          <div className="px-4">
            <PropertyList>
              <Property label="Owner" value="Brandon Clymer" />
              <Property label="Contract value" value="$4,200,000" />
              <Property label="Start date" value="March 1, 2025" />
              <Property
                label="Projected completion"
                value="December 15, 2025"
              />
              <Property label="Location" value="Morrisville, NC" />
            </PropertyList>
          </div>
        </div>
      </div>

      {/* Icon label width */}
      <div>
        <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Composable — icon label
        </p>
        <PropertyList>
          <Property>
            <PropertyLabel width="20px">
              <svg
                className="h-4 w-4 text-muted-foreground"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.5}
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75"
                />
              </svg>
            </PropertyLabel>
            <PropertyValue>brandon@alleatogroup.com</PropertyValue>
          </Property>
          <Property>
            <PropertyLabel width="20px">
              <svg
                className="h-4 w-4 text-muted-foreground"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.5}
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 6z"
                />
              </svg>
            </PropertyLabel>
            <PropertyValue>(919) 555-0142</PropertyValue>
          </Property>
        </PropertyList>
      </div>

      {/* Value as ReactNode */}
      <div>
        <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Rich value nodes
        </p>
        <div className="rounded-lg border border-border px-4">
          <PropertyList>
            <Property
              label="Budget used"
              value={
                <div className="flex flex-1 flex-col gap-1">
                  <span className="text-sm">$840,000 / $4,200,000</span>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: "20%" }}
                    />
                  </div>
                </div>
              }
            />
            <Property
              label="Status"
              value={
                <span className="inline-flex rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                  On track
                </span>
              }
            />
            <Property label="Change orders" value="3 open · $42,500" />
          </PropertyList>
        </div>
      </div>
    </div>
  );
}

function FileTreeDemo() {
  return (
    <div className="w-full max-w-xs py-4">
      <Tree initialSelectedId="budget" className="w-full">
        <Folder element="Morrisville Station" value="project">
          <Folder element="Documents" value="docs">
            <File value="contract.pdf">
              <span>Contract.pdf</span>
            </File>
            <File value="specs.pdf">
              <span>Specs.pdf</span>
            </File>
          </Folder>
          <Folder element="Drawings" value="drawings">
            <File value="A-101">
              <span>A-101 Floor Plan.dwg</span>
            </File>
            <File value="S-201">
              <span>S-201 Structural.dwg</span>
            </File>
          </Folder>
          <Folder element="Budget" value="budget-folder">
            <File value="budget">
              <span>Budget_v3.xlsx</span>
            </File>
            <File value="sov">
              <span>SOV_Final.xlsx</span>
            </File>
          </Folder>
        </Folder>
      </Tree>
    </div>
  );
}

function WorldMapDemo() {
  return (
    <div className="w-full bg-background rounded-lg py-6 px-4">
      <WorldMap
        dots={[
          {
            start: { lat: 64.2008, lng: -149.4937 },
            end: { lat: 34.0522, lng: -118.2437 },
          },
          {
            start: { lat: 34.0522, lng: -118.2437 },
            end: { lat: 40.7128, lng: -74.006 },
          },
          {
            start: { lat: 51.5074, lng: -0.1278 },
            end: { lat: 28.6139, lng: 77.209 },
          },
          {
            start: { lat: 28.6139, lng: 77.209 },
            end: { lat: -33.8688, lng: 151.2093 },
          },
        ]}
      />
    </div>
  );
}

// ─── Inputs demos ─────────────────────────────────────────────────────────────

function FileUploadDemo() {
  return (
    <div className="w-full max-w-lg mx-auto border border-dashed bg-background border-border rounded-lg">
      <FileUpload />
    </div>
  );
}

function LinkPreviewDemo() {
  return (
    <div className="flex items-center justify-center px-8 py-12">
      <div className="text-base text-muted-foreground max-w-sm text-center leading-relaxed">
        Built with{" "}
        <LinkPreview
          url="https://nextjs.org"
          isStatic
          imageSrc="https://assets.aceternity.com/demos/next.png"
          className="font-bold text-foreground"
        >
          Next.js
        </LinkPreview>{" "}
        and{" "}
        <LinkPreview
          url="https://tailwindcss.com"
          isStatic
          imageSrc="https://assets.aceternity.com/demos/tailwindcss.png"
          className="font-bold text-foreground"
        >
          Tailwind CSS
        </LinkPreview>{" "}
        — hover to preview the link destination.
      </div>
    </div>
  );
}

function TooltipCardDemo() {
  return (
    <div className="px-8 py-10 max-w-md text-sm text-muted-foreground leading-relaxed">
      The project is managed by{" "}
      <Tooltip
        content={
          <div>
            <div className="font-semibold text-foreground">Brandon Clymer</div>
            <div className="mt-1 text-xs text-muted-foreground">
              Project Executive at Alleato Group. Oversees all active contracts.
            </div>
          </div>
        }
      >
        <span className="cursor-pointer font-semibold text-foreground underline decoration-dotted">
          Brandon Clymer
        </span>
      </Tooltip>{" "}
      and the budget is tracked against{" "}
      <Tooltip content="Morrisville Station is a $42M mixed-use development in Morrisville, NC.">
        <span className="cursor-pointer font-semibold text-foreground underline decoration-dotted">
          Morrisville Station
        </span>
      </Tooltip>
      . Hover either name to see the card.
    </div>
  );
}

// ─── Feedback demos ───────────────────────────────────────────────────────────

const LOADING_STATES = [
  { text: "Connecting to Acumatica..." },
  { text: "Pulling budget lines..." },
  { text: "Syncing change orders..." },
  { text: "Embedding documents..." },
  { text: "Updating project intelligence..." },
  { text: "Done!" },
];

function MultiStepLoaderDemo() {
  const [loading, setLoading] = useState(false);
  return (
    <div className="flex flex-col items-center gap-4 py-8">
      <Button onClick={() => setLoading(true)} size="sm" variant="outline">
        Run loader
      </Button>
      <MultiStepLoader
        loadingStates={LOADING_STATES}
        loading={loading}
        duration={800}
        loop={false}
      />
      {loading && (
        <Button
          onClick={() => setLoading(false)}
          variant="ghost"
          size="sm"
          className="fixed bottom-8 right-8 z-[200] text-xs text-muted-foreground hover:text-foreground"
        >
          Dismiss
        </Button>
      )}
    </div>
  );
}

function HighlighterDemo() {
  return (
    <div className="px-8 py-10 space-y-6 max-w-md">
      <p className="text-sm text-foreground leading-relaxed">
        The{" "}
        <Highlighter action="highlight" color="#fde68a">
          budget variance
        </Highlighter>{" "}
        for Q2 came in under projection.
      </p>
      <p className="text-sm text-foreground leading-relaxed">
        Please review the{" "}
        <Highlighter action="underline" color="#f97316">
          change order log
        </Highlighter>{" "}
        before Thursday.
      </p>
      <p className="text-sm text-foreground leading-relaxed">
        The{" "}
        <Highlighter action="circle" color="#6366f1">
          submittal deadline
        </Highlighter>{" "}
        was flagged as critical.
      </p>
      <p className="text-sm text-foreground leading-relaxed">
        <Highlighter action="box" color="#10b981">
          Phase 3 closeout
        </Highlighter>{" "}
        documents are now complete.
      </p>
    </div>
  );
}

// ─── Visualization demos ──────────────────────────────────────────────────────

const MONTHLY_DATA = [
  { date: "Jan", Revenue: 142000, Costs: 98000 },
  { date: "Feb", Revenue: 168000, Costs: 112000 },
  { date: "Mar", Revenue: 155000, Costs: 105000 },
  { date: "Apr", Revenue: 192000, Costs: 128000 },
  { date: "May", Revenue: 210000, Costs: 140000 },
  { date: "Jun", Revenue: 248000, Costs: 160000 },
  { date: "Jul", Revenue: 231000, Costs: 155000 },
];

const fmt = (v: number) => "$" + (v / 1000).toFixed(0) + "k";

const SPARK_ROWS = [
  {
    label: "Contract value",
    value: "$4.2M",
    trend: "+8%",
    up: true,
    data: [
      { v: 38 },
      { v: 42 },
      { v: 39 },
      { v: 45 },
      { v: 48 },
      { v: 44 },
      { v: 52 },
    ],
  },
  {
    label: "Change orders",
    value: "3 open",
    trend: "-1",
    up: true,
    data: [
      { v: 7 },
      { v: 5 },
      { v: 6 },
      { v: 4 },
      { v: 5 },
      { v: 3 },
      { v: 3 },
    ],
  },
  {
    label: "Submittals",
    value: "78% approved",
    trend: "+4%",
    up: true,
    data: [
      { v: 60 },
      { v: 65 },
      { v: 68 },
      { v: 71 },
      { v: 73 },
      { v: 75 },
      { v: 78 },
    ],
  },
  {
    label: "RFIs outstanding",
    value: "12",
    trend: "+3",
    up: false,
    data: [
      { v: 6 },
      { v: 8 },
      { v: 7 },
      { v: 9 },
      { v: 10 },
      { v: 11 },
      { v: 12 },
    ],
  },
];

function BarChartDemo() {
  return (
    <div className="w-full p-6">
      <BarChart
        data={MONTHLY_DATA}
        categories={["Revenue", "Costs"]}
        valueFormatter={fmt}
        height="260px"
        yAxisWidth={52}
      />
    </div>
  );
}

function AreaChartDemo() {
  return (
    <div className="w-full p-6">
      <AreaChart
        data={MONTHLY_DATA}
        categories={["Revenue", "Costs"]}
        valueFormatter={fmt}
        height="260px"
        yAxisWidth={52}
      />
    </div>
  );
}

function LineChartDemo() {
  return (
    <div className="w-full p-6">
      <LineChart
        data={MONTHLY_DATA}
        categories={["Revenue", "Costs"]}
        valueFormatter={fmt}
        height="260px"
        yAxisWidth={52}
      />
    </div>
  );
}

function SparklineDemo() {
  return (
    <div className="w-full max-w-sm p-4">
      <div className="overflow-hidden rounded-xl border border-border divide-y divide-border">
        {SPARK_ROWS.map((row) => (
          <div key={row.label} className="flex items-center gap-3 px-4 py-3">
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground truncate">
                {row.label}
              </p>
              <p className="text-sm font-semibold text-foreground">
                {row.value}
              </p>
            </div>
            <span
              className={cn(
                "text-xs font-medium tabular-nums",
                row.up
                  ? "text-green-600 dark:text-green-400"
                  : "text-destructive",
              )}
            >
              {row.trend}
            </span>
            <Sparkline
              data={row.data}
              categories={["v"]}
              height="36px"
              className="w-20 shrink-0"
              colors={[
                row.up ? "hsl(var(--chart-2))" : "hsl(var(--destructive))",
              ]}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Engagement demos ─────────────────────────────────────────────────────────

function TourDemo() {
  const [isActive, setIsActive] = useState(false);
  return (
    <div className="w-full max-w-sm space-y-4 p-6">
      <div className="rounded-xl border border-border p-5 space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold">Project Settings</p>
          <span className="text-xs text-muted-foreground px-2 py-1 rounded-md border border-border">
            ⋯ Options
          </span>
        </div>
        <div className="space-y-3">
          <div data-tour="proj-name">
            <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Project name
            </p>
            <div className="rounded-md border border-border px-3 py-2 text-sm">
              Morrisville Station
            </div>
          </div>
          <div data-tour="proj-date">
            <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Completion date
            </p>
            <div className="rounded-md border border-border px-3 py-2 text-sm text-muted-foreground">
              Dec 15, 2025
            </div>
          </div>
          <div data-tour="proj-team">
            <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Team
            </p>
            <div className="flex gap-1.5">
              {["BC", "SM", "TR"].map((i) => (
                <div
                  key={i}
                  className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium text-primary"
                >
                  {i}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <Button className="w-full" onClick={() => setIsActive(true)}>
        Start tour
      </Button>

      <Tour isActive={isActive} onComplete={() => setIsActive(false)}>
        <TourDialog target="[data-tour='proj-name']">
          <TourDialogHeader>Project name</TourDialogHeader>
          <TourDialogBody>
            Give your project a clear name — it appears across all reports,
            emails, and AI responses.
          </TourDialogBody>
          <TourDialogFooter>
            <TourDismissButton />
            <TourNextButton />
          </TourDialogFooter>
        </TourDialog>
        <TourDialog target="[data-tour='proj-date']">
          <TourDialogHeader>Completion date</TourDialogHeader>
          <TourDialogBody>
            Alleato tracks schedule risk against this date automatically and
            flags slippage in the AI briefing.
          </TourDialogBody>
          <TourDialogFooter>
            <TourDismissButton />
            <TourNextButton />
          </TourDialogFooter>
        </TourDialog>
        <TourDialog target="[data-tour='proj-team']">
          <TourDialogHeader>Team members</TourDialogHeader>
          <TourDialogBody>
            Add team members to grant access to this project's documents,
            emails, and AI assistant.
          </TourDialogBody>
          <TourDialogFooter>
            <TourDismissButton />
            <TourNextButton>Done</TourNextButton>
          </TourDialogFooter>
        </TourDialog>
      </Tour>
    </div>
  );
}

// ─── Filters demo ─────────────────────────────────────────────────────────────

const DEMO_FILTERS: FilterDef[] = [
  {
    id: "status",
    label: "Status",
    type: "enum",
    options: [
      { value: "draft", label: "Draft" },
      { value: "active", label: "Active" },
      { value: "complete", label: "Complete" },
      { value: "on_hold", label: "On Hold" },
    ],
  },
  {
    id: "company",
    label: "Company",
    type: "string",
  },
  {
    id: "amount",
    label: "Amount",
    type: "number",
  },
  {
    id: "date",
    label: "Date",
    type: "date",
  },
  {
    id: "approved",
    label: "Approved",
    type: "boolean",
  },
];

type DemoRow = {
  id: number;
  name: string;
  company: string;
  status: string;
  amount: number;
  date: string;
  approved: boolean;
};

const DEMO_ROWS: DemoRow[] = [
  {
    id: 1,
    name: "Structural Steel Package",
    company: "Baker Steel",
    status: "active",
    amount: 482000,
    date: "2026-03-01",
    approved: true,
  },
  {
    id: 2,
    name: "MEP Subcontract",
    company: "Pinnacle MEP",
    status: "draft",
    amount: 218000,
    date: "2026-04-15",
    approved: false,
  },
  {
    id: 3,
    name: "Concrete Foundations",
    company: "CreteCo",
    status: "complete",
    amount: 155000,
    date: "2026-01-10",
    approved: true,
  },
  {
    id: 4,
    name: "Roofing & Waterproofing",
    company: "Summit Roofing",
    status: "on_hold",
    amount: 97500,
    date: "2026-06-01",
    approved: false,
  },
  {
    id: 5,
    name: "Electrical Distribution",
    company: "Apex Electric",
    status: "active",
    amount: 310000,
    date: "2026-02-20",
    approved: true,
  },
];

function applyFilters(rows: DemoRow[], active: ActiveFilter[]): DemoRow[] {
  return rows.filter((row) =>
    active.every((f) => {
      if (f.value === null || f.value === undefined || f.value === "")
        return true;
      if (f.id === "status") {
        const vals = f.value as string[];
        if (!vals.length) return true;
        return f.operator === "is_not"
          ? !vals.includes(row.status)
          : vals.includes(row.status);
      }
      if (f.id === "company") {
        const v = (f.value as string).toLowerCase();
        const match = row.company.toLowerCase().includes(v);
        return f.operator === "not_contains" ? !match : match;
      }
      if (f.id === "amount") {
        const n = f.value as number;
        const ops: Record<string, boolean> = {
          eq: row.amount === n,
          neq: row.amount !== n,
          gt: row.amount > n,
          lt: row.amount < n,
          gte: row.amount >= n,
          lte: row.amount <= n,
        };
        return ops[f.operator] ?? true;
      }
      if (f.id === "date") {
        return f.operator === "before"
          ? row.date < (f.value as string)
          : f.operator === "after"
            ? row.date > (f.value as string)
            : row.date === (f.value as string);
      }
      if (f.id === "approved") {
        const match = row.approved === f.value;
        return f.operator === "is_not" ? !match : match;
      }
      return true;
    }),
  );
}

function FiltersDemo() {
  const [active, setActive] = useState<ActiveFilter[]>([]);
  const filtered = applyFilters(DEMO_ROWS, active);

  return (
    <FiltersProvider filters={DEMO_FILTERS} onChange={setActive}>
      <div className="w-full space-y-3">
        {/* Toolbar row */}
        <div className="flex flex-wrap items-center gap-2">
          <FiltersAddButton />
          <ActiveFiltersList />
        </div>

        {/* Table */}
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                  Name
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                  Company
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                  Status
                </th>
                <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">
                  Amount
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                  Date
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors"
                >
                  <td className="px-3 py-2 text-sm font-medium text-foreground">
                    {row.name}
                  </td>
                  <td className="px-3 py-2 text-sm text-muted-foreground">
                    {row.company}
                  </td>
                  <td className="px-3 py-2">
                    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium bg-muted text-muted-foreground capitalize">
                      {row.status.replace("_", " ")}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right text-sm tabular-nums text-foreground">
                    ${row.amount.toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-sm text-muted-foreground">
                    {row.date}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!filtered.length && <NoFilteredResults />}
        </div>
      </div>
    </FiltersProvider>
  );
}

// ─── Dashboard Widgets demos ───────────────────────────────────────────────────
// Ported from the retired "design-system-update" page mockup — reimplemented
// with Tailwind + design tokens instead of inline styles/hardcoded colors.

function HealthRingDemo() {
  const scores = [86, 62, 38];
  return (
    <div className="flex items-center gap-8 p-6">
      {scores.map((score) => {
        const size = 56;
        const r = (size - 8) / 2;
        const c = 2 * Math.PI * r;
        const off = c - (score / 100) * c;
        const color =
          score >= 75
            ? "text-emerald-600"
            : score >= 50
              ? "text-amber-600"
              : "text-destructive";
        return (
          <div key={score} className="relative" style={{ width: size, height: size }}>
            <svg
              width={size}
              height={size}
              className="-rotate-90"
              aria-label={`Health score ${score}`}
            >
              <circle
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke="currentColor"
                className="text-muted"
                strokeWidth={4}
              />
              <circle
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke="currentColor"
                strokeWidth={4}
                strokeDasharray={c}
                strokeDashoffset={off}
                strokeLinecap="round"
                className={cn("transition-[stroke-dashoffset] duration-700", color)}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className={cn("text-xs font-semibold", color)}>{score}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function AiBriefCalloutDemo() {
  return (
    <div className="w-full max-w-xl p-6">
      <div className="rounded-lg border border-primary/15 bg-gradient-to-br from-primary/5 via-primary/[0.03] to-transparent px-5 py-4">
        <div className="mb-2 flex items-center gap-2">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/70 text-[10px] text-primary-foreground">
            <Sparkles className="h-3 w-3" />
          </span>
          <span className="text-xs font-semibold uppercase tracking-wide text-primary">
            AI Project Brief
          </span>
          <span className="ml-auto text-[11px] text-muted-foreground">
            Updated 2 hours ago · 4 meetings analyzed
          </span>
        </div>
        <p className="text-sm leading-relaxed text-foreground/80">
          Morrisville Station is 82% complete but tracking 3 days behind
          schedule, primarily due to a late MEP rough-in. Financially, the
          project is $122.5K over the original contract (1.3%), driven by
          Finishes and Electrical overruns.
        </p>
      </div>
    </div>
  );
}

const SCHEDULE_DAYS_ELAPSED = 138;
const SCHEDULE_DAYS_TOTAL = 164;

function ScheduleTimelineDemo() {
  const timelinePct = Math.round(
    (SCHEDULE_DAYS_ELAPSED / SCHEDULE_DAYS_TOTAL) * 100,
  );
  const targetPct = 84;

  return (
    <div className="w-full max-w-xl p-6">
      <div className="mb-2 flex justify-between text-xs text-muted-foreground">
        <span>Oct 15, 2024</span>
        <span>Apr 25, 2025</span>
      </div>
      <div className="relative mt-5 h-6 rounded-md bg-muted">
        <div
          className="absolute inset-y-0 left-0 rounded-md bg-gradient-to-r from-primary to-primary/70 transition-all duration-700"
          style={{ width: `${timelinePct}%` }}
        />
        <div
          className="absolute inset-y-0 w-0.5 bg-foreground/20"
          style={{ left: `${targetPct}%` }}
        >
          <span className="absolute -top-4 left-1/2 -translate-x-1/2 text-[9px] font-semibold text-muted-foreground">
            SC
          </span>
        </div>
        <div
          className="absolute -inset-y-1 w-[3px] rounded bg-blue-600"
          style={{ left: `${timelinePct}%` }}
        >
          <span className="absolute -top-4 left-1/2 -translate-x-1/2 text-[9px] font-semibold text-blue-600">
            Today
          </span>
        </div>
      </div>
      <div className="mt-2 flex justify-between text-[10px] text-muted-foreground">
        <span>
          Day {SCHEDULE_DAYS_ELAPSED} of {SCHEDULE_DAYS_TOTAL}
        </span>
        <span>{timelinePct}% timeline · 82% work complete</span>
      </div>
    </div>
  );
}

const MILESTONES = [
  { name: "Foundation Complete", date: "Nov 22, 2024", status: "complete" as const },
  { name: "Structural Steel", date: "Dec 18, 2024", status: "complete" as const },
  { name: "MEP Systems Complete", date: "Feb 21, 2025", status: "complete" as const },
  { name: "Finishes & Fixtures", date: "Mar 7, 2025", status: "in-progress" as const },
  { name: "Final Inspections / TCO", date: "Mar 21, 2025", status: "upcoming" as const },
  { name: "Substantial Completion", date: "Mar 28, 2025", status: "upcoming" as const },
];

function MilestoneTimelineDemo() {
  return (
    <div className="w-full max-w-sm p-6">
      {MILESTONES.map((ms, i) => (
        <div key={ms.name} className="flex items-start">
          <div className="flex w-9 flex-shrink-0 flex-col items-center">
            <div
              className={cn(
                "h-1.5 w-px",
                i === 0
                  ? "h-2 bg-transparent"
                  : ms.status === "upcoming"
                    ? "bg-border"
                    : "bg-emerald-600",
              )}
            />
            <div
              className={cn(
                "h-2.5 w-2.5 shrink-0 rounded-full",
                ms.status === "complete" && "bg-emerald-600",
                ms.status === "in-progress" &&
                  "bg-primary ring-4 ring-primary/15",
                ms.status === "upcoming" && "border-2 border-border bg-background",
              )}
            />
            {i < MILESTONES.length - 1 && (
              <div
                className={cn(
                  "min-h-[18px] w-px flex-1",
                  ms.status === "complete" ? "bg-emerald-600" : "bg-border",
                )}
              />
            )}
          </div>
          <div className="flex-1 pb-2 pt-0.5">
            <p
              className={cn(
                "text-xs",
                ms.status === "in-progress" && "font-semibold text-foreground",
                ms.status === "upcoming" && "text-muted-foreground",
                ms.status === "complete" && "text-foreground/80",
              )}
            >
              {ms.name}
            </p>
            <p className="mt-0.5 text-[10px] text-muted-foreground">{ms.date}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

const ACTIVITY_MEETINGS = [
  {
    month: "Feb",
    day: "24",
    title: "OAC — Morrisville Station",
    summary:
      "Construction nearing completion. Plumbing, electrical, and wood trim starting.",
    decisions: ["Approved alternate sprinkler head placement"],
    attendees: 15,
    avatars: ["BC", "JD"],
    overflow: 12,
  },
  {
    month: "Feb",
    day: "17",
    title: "Beer Line Discussion",
    summary:
      "Rerouting PVC beer lines under bar to prevent interference with coolers.",
    decisions: ["Trenching over elbow routing"],
    attendees: 6,
    avatars: ["AL", "DS"],
    overflow: 3,
  },
];

function ActivityListDemo() {
  return (
    <div className="w-full max-w-lg p-6">
      {ACTIVITY_MEETINGS.map((m, i) => (
        <div
          key={m.title}
          className={cn(
            "flex gap-4 py-4",
            i < ACTIVITY_MEETINGS.length - 1 && "border-b border-border",
          )}
        >
          <div className="w-11 shrink-0 text-center">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              {m.month}
            </p>
            <p className="text-lg font-semibold leading-none text-foreground">
              {m.day}
            </p>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-sm font-medium text-foreground">{m.title}</h3>
              <AvatarGroup>
                {m.avatars.map((a) => (
                  <Avatar key={a} className="h-6 w-6">
                    <AvatarFallback className="text-[9px]">{a}</AvatarFallback>
                  </Avatar>
                ))}
                <AvatarGroupCount className="h-6 w-6 text-[9px]">
                  +{m.overflow}
                </AvatarGroupCount>
              </AvatarGroup>
            </div>
            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
              {m.summary}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {m.decisions.map((d) => (
                <span
                  key={d}
                  className="rounded bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700 dark:bg-blue-950/40 dark:text-blue-400"
                >
                  ✓ {d}
                </span>
              ))}
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              {m.attendees} attendees
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

function AiChatPanelDemo() {
  const [open, setOpen] = useState(true);

  return (
    <div className="relative h-[420px] w-full max-w-sm p-6">
      {!open ? (
        <Button
          onClick={() => setOpen(true)}
          className="absolute bottom-6 right-6 h-14 w-14 rounded-full p-0 shadow-lg"
        >
          <Sparkles className="h-5 w-5" />
        </Button>
      ) : (
        <div className="absolute bottom-6 right-6 flex h-96 w-80 flex-col overflow-hidden rounded-xl border border-border bg-background shadow-xl">
          <div className="flex items-center justify-between border-b border-border bg-muted/40 px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/70">
                <Sparkles className="h-3.5 w-3.5 text-primary-foreground" />
              </span>
              <div>
                <p className="text-xs font-semibold text-foreground">
                  Project Intelligence
                </p>
                <p className="text-[10px] text-muted-foreground">
                  Morrisville Station
                </p>
              </div>
            </div>
            <Button
              onClick={() => setOpen(false)}
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 text-muted-foreground"
            >
              ×
            </Button>
          </div>
          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            <div className="max-w-[85%] rounded-2xl rounded-bl-sm bg-muted px-3 py-2 text-xs text-foreground">
              Ask anything about this project — schedule, budget, risks, or
              recent decisions.
            </div>
            <div className="ml-auto max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-3 py-2 text-xs text-primary-foreground">
              What's driving the schedule delay?
            </div>
            <div className="max-w-[85%] rounded-2xl rounded-bl-sm bg-muted px-3 py-2 text-xs leading-relaxed text-foreground">
              The 3-day variance traces to MEP rough-in, which finished behind
              baseline due to a crew shortage the week of Feb 10.
            </div>
          </div>
          <div className="flex items-center gap-2 border-t border-border p-3">
            <InputGroupInput
              placeholder="Ask about this project..."
              className="text-xs"
              aria-label="Chat message"
            />
            <Button size="sm" className="h-8 px-3 text-xs">
              Send
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function UILibraryPage() {
  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="hidden lg:block w-52 shrink-0 sticky top-0 h-screen overflow-y-auto border-r border-border bg-background py-8 px-4">
        <div className="mb-6 flex items-center gap-2 px-1">
          <FileCode2 className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">
            UI Library
          </span>
        </div>
        <nav className="space-y-0.5">
          {SECTIONS.map((s) =>
            s.parent ? (
              <Button
                key={s.id}
                onClick={() => scrollTo(s.id)}
                variant="ghost"
                size="sm"
                className="w-full justify-start rounded px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted h-auto"
              >
                {s.label}
              </Button>
            ) : (
              <Button
                key={s.id}
                onClick={() => scrollTo(s.id)}
                variant="ghost"
                size="sm"
                className="w-full justify-start flex items-center gap-2 rounded px-2 py-2 text-xs font-semibold text-foreground/70 uppercase tracking-wider hover:text-foreground mt-4 first:mt-0 h-auto"
              >
                {s.icon && <s.icon className="h-3 w-3" />}
                {s.label}
              </Button>
            ),
          )}
        </nav>
      </aside>

      {/* Main content */}
      <main className="flex-1 min-w-0 py-8 px-6 lg:px-12">
        <div className="mx-auto flex w-full max-w-5xl flex-col">
          {/* Header */}
          <div className="mb-10">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              UI Library
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Magic UI-style components built with motion/react, Tailwind, and
              shadcn primitives. All components live in{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-xs">
                components/ui/
              </code>{" "}
              and{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-xs">
                components/motion/
              </code>
              .
            </p>
          </div>

          <div className="space-y-10">
            {/* ── Core UI ── */}
            <SectionHeading id="core-ui" label="Core UI" icon={FileCode2} />

            <ComponentSection
              id="accordion"
              name="Accordion"
              description="Disclosure primitive for secondary detail. Keep primary labels and status visible outside the collapsed body."
            >
              <AccordionDemo />
            </ComponentSection>

            <ComponentSection
              id="alerts"
              name="Alerts"
              description="Status and recovery messages with semantic variants for normal, warning, success, info, and destructive states."
            >
              <AlertsDemo />
            </ComponentSection>

            <ComponentSection
              id="avatars"
              name="Avatars"
              description="User identity primitives with fallback initials, presence badge, groups, and overflow counts."
            >
              <AvatarsDemo />
            </ComponentSection>

            <ComponentSection
              id="badges"
              name="Badges"
              description="Compact semantic labels for status and role display when plain text is not enough."
            >
              <BadgesDemo />
            </ComponentSection>

            <ComponentSection
              id="button-group"
              name="Button Group"
              description="Grouped controls for adjacent choices and compact segmented actions."
            >
              <ButtonGroupDemo />
            </ComponentSection>

            <ComponentSection
              id="input-group"
              name="Input Group"
              description="Input composition primitive for inline prefixes, suffixes, and compact actions without local field chrome."
            >
              <InputGroupDemo />
            </ComponentSection>

            <ComponentSection
              id="number-input"
              name="Number Input"
              description="Numeric entry with focus-time raw editing and blur-time formatting for quantities and non-currency numbers."
            >
              <NumberInputDemo />
            </ComponentSection>

            <ComponentSection
              id="pagination"
              name="Pagination"
              description="Compact pagination with next/previous controls, page buttons, ellipsis, and jump input for long lists."
            >
              <PaginationDemo />
            </ComponentSection>

            <ComponentSection
              id="progress-spinner"
              name="Progress + Spinner"
              description="Progress and loading primitives for async states that need visible status without a decorative loader."
            >
              <ProgressSpinnerDemo />
            </ComponentSection>

            <ComponentSection
              id="switches"
              name="Switches"
              description="Binary setting control for persistent on/off preferences and workflow toggles."
            >
              <SwitchesDemo />
            </ComponentSection>

            {/* ── Layout ── */}
            <SectionHeading id="layout" label="Layout" icon={PanelLeft} />

            <ComponentSection
              id="split-page"
              name="Split Page"
              description="Two-pane layout: both panes visible side-by-side on desktop, one pane at a time on mobile. useSplitPage().onOpen / onClose toggles between panes."
              previewClassName="p-0 overflow-hidden"
            >
              <SplitPageDemo />
            </ComponentSection>

            {/* ── Cards ── */}
            <SectionHeading id="cards" label="Cards" icon={CreditCard} />

            <ComponentSection
              id="card-background-overlay"
              name="Background Overlay Card"
              description="A full-bleed image card that swaps to an animated GIF on hover, with a dark overlay and copy layered on top."
            >
              <CardBackgroundOverlay />
            </ComponentSection>

            <ComponentSection
              id="card-author"
              name="Author Card"
              description="Blog-style card with an author avatar, name, read time, and a darkening overlay on hover. Ideal for content feeds."
            >
              <CardAuthor />
            </ComponentSection>

            <ComponentSection
              id="card-feature-animated"
              name="Feature Animated Card"
              description="Showcases a set of tools with sequentially bouncing icon circles and a travelling sparkle beam. Great for landing pages."
              previewClassName="bg-neutral-50 dark:bg-neutral-900"
            >
              <CardFeatureAnimated />
            </ComponentSection>

            {/* ── Special Effects ── */}
            <SectionHeading
              id="special-effects"
              label="Special Effects"
              icon={Sparkles}
            />

            <ComponentSection
              id="animated-beam"
              name="Animated Beam"
              description="An animated gradient beam that travels along a path between two nodes. Great for showcasing integrations."
            >
              <AnimatedBeamDemo />
            </ComponentSection>

            <ComponentSection
              id="light-rays"
              name="Light Rays"
              description="Animated light rays that sweep across a dark background. Useful for hero sections and dramatic backdrops."
              previewClassName="p-0"
            >
              <LightRaysDemo />
            </ComponentSection>

            <ComponentSection
              id="orbiting-circles"
              name="Orbiting Circles"
              description="Icons or elements that orbit around a central point at configurable radii and speeds."
            >
              <OrbitingCirclesDemo />
            </ComponentSection>

            <ComponentSection
              id="dotted-map"
              name="Dotted Map"
              description="An SVG world map rendered as dots with optional animated pulse markers."
            >
              <DottedMapDemo />
            </ComponentSection>

            {/* ── Interactive ── */}
            <SectionHeading
              id="interactive"
              label="Interactive"
              icon={MousePointer}
            />

            <ComponentSection
              id="dock"
              name="Dock"
              description="An Apple macOS-style dock with spring-physics magnification on hover."
            >
              <DockDemo />
            </ComponentSection>

            <ComponentSection
              id="icon-cloud"
              name="Icon Cloud"
              description="A 3D rotating sphere of icons rendered on canvas. Draggable and responds to mouse position."
            >
              <IconCloudDemo />
            </ComponentSection>

            <ComponentSection
              id="confetti"
              name="Confetti"
              description="Canvas-based confetti burst. Use ConfettiButton for a one-click trigger or the Confetti canvas directly."
            >
              <ConfettiDemo />
            </ComponentSection>

            {/* ── Motion ── */}
            <SectionHeading id="motion" label="Motion" icon={Zap} />

            <ComponentSection
              id="animated-list"
              name="Animated List"
              description="Items animate in one by one on a configurable delay using spring physics."
            >
              <AnimatedListDemo />
            </ComponentSection>

            <ComponentSection
              id="animated-background"
              name="Animated Background"
              description="A shared animated background that slides between sibling elements — great for tab bars and segmented controls."
            >
              <AnimatedBackgroundDemo />
            </ComponentSection>

            <ComponentSection
              id="transition-panel"
              name="Transition Panel"
              description="Animates between content panels with configurable variants. Pair with a tab list to control the active index."
            >
              <TransitionPanelDemo />
            </ComponentSection>

            <ComponentSection
              id="text-3d-flip"
              name="Text 3D Flip"
              description="Each character flips in 3D on hover using CSS transform-style: preserve-3d and motion/react."
            >
              <Text3DFlipDemo />
            </ComponentSection>

            <ComponentSection
              id="animated-modal"
              name="Animated Modal"
              description="A modal with a spring 3D entry animation and blurred backdrop. Includes trigger, body, content, and footer slots."
            >
              <AnimatedModalDemo />
            </ComponentSection>

            {/* ── Navigation ── */}
            <SectionHeading
              id="navigation"
              label="Navigation"
              icon={Navigation2}
            />

            <ComponentSection
              id="floating-navbar"
              name="Floating Navbar"
              description="A pill-shaped nav bar that appears at the top of the viewport when scrolling up. Hides when scrolling down."
            >
              <FloatingNavDemo />
            </ComponentSection>

            <ComponentSection
              id="notch"
              name="Notch"
              description="A floating notch bar pinned to the bottom of the screen with grouped option pickers. Reveals choices on tap with spring animation."
              previewClassName="min-h-96"
            >
              <NotchDemo />
            </ComponentSection>

            {/* ── Data Display ── */}
            <SectionHeading
              id="data-display"
              label="Data Display"
              icon={LayoutList}
            />

            <ComponentSection
              id="property"
              name="Property"
              description="Consistent key/value display with a fixed label column. Use PropertyList for stacked groups, Property shorthand for quick rows, or compose PropertyLabel/PropertyValue for custom layouts."
              previewClassName="justify-start items-start"
            >
              <PropertyDemo />
            </ComponentSection>

            <ComponentSection
              id="file-tree"
              name="File Tree"
              description="Accordion-backed tree with folder expand/collapse, file selection, and keyboard navigation. Powered by Radix Accordion."
              previewClassName="justify-start items-start p-6"
            >
              <FileTreeDemo />
            </ComponentSection>

            <ComponentSection
              id="world-map"
              name="World Map"
              description="Dotted SVG world map with animated curved arcs connecting lat/lng pairs. Theme-aware dots (light/dark)."
              previewClassName="bg-white dark:bg-black"
            >
              <WorldMapDemo />
            </ComponentSection>

            <ComponentSection
              id="expandable-card"
              name="Expandable Card"
              description="List items expand into a full modal card with shared layout animations via motion/react layoutId. Click any row to expand."
              previewClassName="items-start justify-start p-4"
            >
              <ExpandableCardDemoImport />
            </ComponentSection>

            <ComponentSection
              id="expandable-card-grid"
              name="Expandable Card — Grid"
              description="Same expand-into-modal interaction as above, laid out as a responsive grid instead of a vertical list. Click any card to expand."
              previewClassName="items-start justify-start p-4"
            >
              <ExpandableCardGridDemoImport />
            </ComponentSection>

            {/* ── Inputs ── */}
            <SectionHeading id="inputs" label="Inputs" icon={Upload} />

            <ComponentSection
              id="file-upload"
              name="File Upload"
              description="Drag-and-drop upload zone with motion hover animation. Uses react-dropzone under the hood."
              previewClassName="bg-background"
            >
              <FileUploadDemo />
            </ComponentSection>

            <ComponentSection
              id="link-preview"
              name="Link Preview"
              description="Hover a link to see an inline screenshot preview pop up. Uses microlink.io for live screenshots or static images for speed."
            >
              <LinkPreviewDemo />
            </ComponentSection>

            <ComponentSection
              id="tooltip-card"
              name="Tooltip Card"
              description="Mouse-tracking tooltip that follows cursor and can render any rich content — text, images, person cards, quotes."
            >
              <TooltipCardDemo />
            </ComponentSection>

            {/* ── Feedback ── */}
            <SectionHeading id="feedback" label="Feedback" icon={RefreshCcw} />

            <ComponentSection
              id="multi-step-loader"
              name="Multi-Step Loader"
              description="Animated multi-step progress list with check icons. Full-screen overlay — great for long async operations like AI runs or data syncs."
            >
              <MultiStepLoaderDemo />
            </ComponentSection>

            <ComponentSection
              id="highlighter"
              name="Highlighter"
              description="Inline text annotation using rough-notation — supports highlight, underline, circle, box, strike-through, and bracket styles."
            >
              <HighlighterDemo />
            </ComponentSection>

            {/* ── Visualization ── */}
            <SectionHeading
              id="visualization"
              label="Visualization"
              icon={TrendingUp}
            />

            <ComponentSection
              id="bar-chart"
              name="Bar Chart"
              description="Grouped or stacked bar chart built on Recharts. Accepts any data with a date key plus named series. Custom tooltip and axis labels use design system tokens."
              previewClassName="items-start justify-start"
            >
              <BarChartDemo />
            </ComponentSection>

            <ComponentSection
              id="area-chart"
              name="Area Chart"
              description="Area chart with gradient fills per series. Supports stacking. Same data format as BarChart."
              previewClassName="items-start justify-start"
            >
              <AreaChartDemo />
            </ComponentSection>

            <ComponentSection
              id="line-chart"
              name="Line Chart"
              description="Multi-series line chart. Best for trend comparison across time. All axes and tooltip match the design system."
              previewClassName="items-start justify-start"
            >
              <LineChartDemo />
            </ComponentSection>

            <ComponentSection
              id="sparkline"
              name="Sparkline"
              description="Axis-free inline trend chart. Use in KPI rows, table cells, or cards. No axes, no legend, no tooltip — pure signal."
              previewClassName="justify-start items-start"
            >
              <SparklineDemo />
            </ComponentSection>

            {/* ── Engagement ── */}
            <SectionHeading id="engagement" label="Engagement" icon={Users} />

            <ComponentSection
              id="tour"
              name="Tour"
              description="Multi-step guided tour with an SVG spotlight cutout and a floating dialog positioned next to each target element. Target any element via CSS selector."
              previewClassName="justify-start items-start"
            >
              <TourDemo />
            </ComponentSection>

            {/* ── Advanced Data ── */}
            <SectionHeading
              id="advanced-data"
              label="Advanced Data"
              icon={Table}
            />

            <ComponentSection
              id="filters"
              name="Filters"
              description="Composable filter bar with a chip-per-filter design. FiltersProvider manages state; FiltersAddButton adds chips; ActiveFiltersList renders them. Supports enum, string, number, date, and boolean filter types with per-type operators."
              previewClassName="items-start justify-start"
            >
              <FiltersDemo />
            </ComponentSection>

            <ComponentSection
              id="stat-breakdown"
              name="Stat Breakdown"
              description="Metric card with a large total and labeled progress-bar breakdown rows. StatBreakdownCard adds a border for use in grids; StatBreakdownGrid handles responsive column layout."
              previewClassName="items-start justify-start"
            >
              <StatBreakdownGrid>
                <StatBreakdownCard
                  name="Average tokens per request"
                  total="341"
                  details={[
                    {
                      name: "Completion tokens",
                      value: "136",
                      percentageValue: 40,
                    },
                    {
                      name: "Prompt tokens",
                      value: "205",
                      percentageValue: 60,
                    },
                  ]}
                />
                <StatBreakdownCard
                  name="Total tokens"
                  total="4,229"
                  details={[
                    {
                      name: "Completion tokens",
                      value: "1,480",
                      percentageValue: 35,
                    },
                    {
                      name: "Prompt tokens",
                      value: "2,749",
                      percentageValue: 65,
                    },
                  ]}
                />
                <StatBreakdownCard
                  name="Tokens — advanced model"
                  total="1,040"
                  details={[
                    {
                      name: "Completion tokens",
                      value: "260",
                      percentageValue: 25,
                    },
                    {
                      name: "Prompt tokens",
                      value: "780",
                      percentageValue: 75,
                    },
                  ]}
                />
                <StatBreakdownCard
                  name="Tokens — base model"
                  total="2,920"
                  details={[
                    {
                      name: "Completion tokens",
                      value: "847",
                      percentageValue: 29,
                    },
                    {
                      name: "Prompt tokens",
                      value: "2,073",
                      percentageValue: 71,
                    },
                  ]}
                />
              </StatBreakdownGrid>
            </ComponentSection>

            {/* ── Dashboard Widgets ── */}
            <SectionHeading
              id="dashboard-widgets"
              label="Dashboard Widgets"
              icon={LayoutDashboard}
            />

            <ComponentSection
              id="health-ring"
              name="Health Ring"
              description="Circular progress indicator for a 0-100 score, colored by threshold (healthy, at-risk, critical)."
            >
              <HealthRingDemo />
            </ComponentSection>

            <ComponentSection
              id="ai-brief-callout"
              name="AI Brief Callout"
              description="Gradient-bordered callout for AI-generated summaries, with a source/freshness timestamp in the header."
            >
              <AiBriefCalloutDemo />
            </ComponentSection>

            <ComponentSection
              id="schedule-timeline"
              name="Schedule Timeline"
              description="Horizontal progress bar showing elapsed vs. total duration, with a target-date marker and a distinct 'today' marker."
            >
              <ScheduleTimelineDemo />
            </ComponentSection>

            <ComponentSection
              id="milestone-timeline"
              name="Milestone Timeline"
              description="Vertical stepper for sequential milestones — complete, in-progress, and upcoming states with connecting rail."
            >
              <MilestoneTimelineDemo />
            </ComponentSection>

            <ComponentSection
              id="activity-list"
              name="Activity List"
              description="Date-block + avatar-stack list for meetings or activity feeds, with inline decision/outcome tags."
            >
              <ActivityListDemo />
            </ComponentSection>

            <ComponentSection
              id="ai-chat-panel"
              name="AI Chat Panel"
              description="Floating assistant widget — collapsed FAB expands into a chat panel with message bubbles and an input row."
              previewClassName="items-end justify-end"
            >
              <AiChatPanelDemo />
            </ComponentSection>
          </div>
        </div>
      </main>
    </div>
  );
}
