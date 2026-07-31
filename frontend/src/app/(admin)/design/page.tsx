"use client";

import { useState } from "react";
import {
  FileText,
  FolderOpen,
  Info,
  LayoutDashboard,
  List,
  PenLine,
  Plus,
  Search,
  Settings,
  AlertTriangle,
  CheckCircle,
  XCircle,
  ChevronsUpDown,
  Calculator,
  Smile,
  CalendarIcon,
  Bold,
  Italic,
  Underline,
  User,
  CreditCard,
} from "lucide-react";

// DS barrel — all components from one path
import {
  // Layout
  PageTabs,
  Separator,
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  ScrollArea,
  ScrollBar,
  // Status
  StatusBadge,
  StatusDot,
  StatusText,
  // Data display
  KpiRow,
  DataTable,
  SectionHeader,
  AttachmentUploadPanel,
  Eyebrow,
  DateAvatar,
  AvatarStack,
  Progress,
  Avatar,
  AvatarImage,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
  // Feedback & states
  EmptyState,
  Skeleton,
  Alert,
  AlertTitle,
  AlertDescription,
  Spinner,
  // Form components
  Button,
  Input,
  Textarea,
  Label,
  Checkbox,
  Switch,
  RadioGroup,
  RadioGroupItem,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Slider,
  // Overlays
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  Popover,
  PopoverContent,
  PopoverTrigger,
  // Navigation
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  // Cards
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  // Table cell primitives
  CellText,
  CellLink,
  CellEmail,
  CellCurrency,
  CellNumber,
  CellPercent,
  CellDate,
  CellStatus,
  CellBadge,
  TableTagBadge,
  TableAvatarUsers,
  TableCountIndicator,
  TruncatedCell,
  // Misc
  Badge,
  // New DS components
  BackButton,
  InfoAlert,
  DetailField,
  DetailFieldGrid,
  ConfirmDeleteDialog,
  DetailActions,
  EditModeActions,
  SplitButton,
  MoneyField,
} from "@/components/ds";

import { cn } from "@/lib/utils";
import { SimplePagination } from "@/components/ui/pagination";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Calendar } from "@/components/ui/calendar";
import { NumberInput } from "@/components/ui/number-input";
import { PageShell } from "@/components/layout";
import { PageHeader } from "@/components/layout/page-header-unified";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";

// ---------------------------------------------------------------------------
// Demo data
// ---------------------------------------------------------------------------

const STATUSES = [
  "Draft",
  "Pending",
  "Approved",
  "Active",
  "Rejected",
  "Overdue",
  "Closed",
  "Archived",
  "In Progress",
  "Complete",
  "Not synced",
  "Submitted",
  "Cancelled",
  "Open",
] as const;

interface DemoRow {
  id: string;
  name: string;
  status: string;
  amount: number;
  date: string;
}

const TABLE_ROWS: DemoRow[] = [
  { id: "1", name: "Foundation Work", status: "Approved", amount: 245000, date: "2026-03-15" },
  { id: "2", name: "Steel Framing", status: "In Progress", amount: 182000, date: "2026-04-01" },
  { id: "3", name: "Electrical Rough-In", status: "Pending", amount: 67500, date: "2026-04-20" },
  { id: "4", name: "HVAC Installation", status: "Draft", amount: 134000, date: "2026-05-10" },
  { id: "5", name: "Concrete Pour", status: "Complete", amount: 89000, date: "2026-02-28" },
];

const TABLE_COLUMNS = [
  {
    key: "name",
    header: "Name",
    primary: true,
    render: (row: DemoRow) => row.name,
  },
  {
    key: "status",
    header: "Status",
    render: (row: DemoRow) => <StatusBadge status={row.status} />,
  },
  {
    key: "amount",
    header: "Amount",
    align: "right" as const,
    render: (row: DemoRow) =>
      new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(row.amount),
  },
  {
    key: "date",
    header: "Date",
    render: (row: DemoRow) => row.date,
  },
];

// ---------------------------------------------------------------------------
// Local doc primitives — defined at module scope (never inside a component)
// ---------------------------------------------------------------------------

function DesignSection({
  id,
  title,
  description,
  children,
}: {
  id?: string;
  title: string;
  description?: string;
  children?: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24">
      <div className="mb-8 flex items-baseline gap-6">
        <h2 className="shrink-0 text-xl font-bold tracking-tight text-foreground">
          {title}
        </h2>
        {description && (
          <p className="text-sm text-muted-foreground leading-snug">{description}</p>
        )}
      </div>
      <div className="space-y-10">{children}</div>
    </section>
  );
}

function SubSection({
  title,
  children,
}: {
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <p className="shrink-0 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground/50">
          {title}
        </p>
        <div className="h-px flex-1 bg-border/60" />
      </div>
      {children}
    </div>
  );
}

function Preview({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-start gap-4 rounded-lg border border-border/50 bg-muted/20 p-6",
        className,
      )}
    >
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default function DesignSystemComponentsPage() {
  const [activeTab, setActiveTab] = useState("overview");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [switchChecked, setSwitchChecked] = useState(true);
  const [checkboxChecked, setCheckboxChecked] = useState(true);
  const [paginationPage, setPaginationPage] = useState(1);
  const [collapsibleOpen, setCollapsibleOpen] = useState(false);
  const [sliderValue, setSliderValue] = useState([33]);
  const [calendarDate, setCalendarDate] = useState<Date | undefined>(new Date());
  const [numberInputValue, setNumberInputValue] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [attachmentDemoFiles, setAttachmentDemoFiles] = useState([
    {
      id: "a1",
      name: "Metaballs_Presentation_2.pdf",
      sizeBytes: 446 * 1024,
      uploadedAtLabel: "2 days ago",
      downloadUrl: "#",
    },
    {
      id: "a2",
      name: "Metaballs_Presentation_1.pdf",
      sizeBytes: 446 * 1024,
      uploadedAtLabel: "2 days ago",
      downloadUrl: "#",
    },
  ]);

  /** Simulates an attachment upload and appends it into the demo attachment list. */
  async function handleAttachmentDemoUpload(file: File) {
    await new Promise((resolve) => setTimeout(resolve, 900));
    const demoFile = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      name: file.name,
      sizeBytes: file.size,
      uploadedAtLabel: "just now",
      downloadUrl: "#",
    };
    setAttachmentDemoFiles((current) => [demoFile, ...current]);
  }

  const NAV_SECTIONS = [
    { group: "Tokens", items: [
      { href: "#tokens-colors", label: "Colors" },
      { href: "#tokens-typography", label: "Typography" },
      { href: "#tokens-spacing", label: "Spacing" },
      { href: "#tokens-radius", label: "Radius" },
      { href: "#tokens-shadows", label: "Shadows" },
      { href: "#tokens-motion", label: "Motion" },
    ]},
    { group: "Components", items: [
      { href: "#section-layout", label: "1. Layout" },
      { href: "#section-status", label: "2. Status" },
      { href: "#section-data", label: "3. Data Display" },
      { href: "#section-feedback", label: "4. Feedback" },
      { href: "#section-forms", label: "5. Forms" },
      { href: "#section-overlays", label: "6. Overlays" },
      { href: "#section-navigation", label: "7. Navigation" },
      { href: "#section-cards", label: "8. Cards" },
      { href: "#section-cells", label: "9. Cell Primitives" },
      { href: "#section-missing", label: "10. Missing" },
    ]},
  ];

  return (
    <PageShell
      variant="detailWide"
      title="Design System"
      description="Living inventory of every token and component. Import from @/components/ds."
      showHeader={false}
    >

      {/* 2-column layout: sticky left nav + scrollable content */}
      <div className="flex gap-8 items-start">
        {/* Left vertical nav */}
        <nav className="hidden lg:block w-48 shrink-0 self-start sticky top-4 max-h-[calc(100vh-2rem)] overflow-y-auto space-y-6">
          {NAV_SECTIONS.map((group) => (
            <div key={group.group}>
              <p className="mb-2 px-0 text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground/40">
                {group.group}
              </p>
              <ul className="space-y-px">
                {group.items.map(({ href, label }) => (
                  <li key={href}>
                    <a
                      href={href}
                      className="flex items-center rounded px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                      {label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        {/* Main content */}
        <div className="min-w-0 flex-1 space-y-16">
      <PageHeader
        title="Design System"
        description="Living inventory of every token and component. Import from @/components/ds."
        className="px-0 sm:px-0 lg:px-0"
      />

      {/* ================================================================== */}
      {/* SECTION 0: DESIGN TOKENS                                            */}
      {/* ================================================================== */}

      {/* ── COLORS ────────────────────────────────────────────────────────── */}
      <DesignSection id="tokens-colors" title="Colors" description="Semantic color tokens. Use only these — zero hex codes, zero gray-*/blue-* classes.">

        {/* Background tokens */}
        <SubSection title="Backgrounds">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {[
              { token: "bg-background", label: "background", desc: "Page bg" },
              { token: "bg-card", label: "card", desc: "Card / elevated surface" },
              { token: "bg-muted", label: "muted", desc: "Subtle / hover" },
              { token: "bg-accent", label: "accent", desc: "Active / selected" },
              { token: "bg-popover", label: "popover", desc: "Dropdowns / modals" },
              { token: "bg-primary", label: "primary", desc: "Primary action" },
              { token: "bg-secondary", label: "secondary", desc: "Secondary action" },
              { token: "bg-destructive", label: "destructive", desc: "Delete / danger" },
            ].map(({ token, label, desc }) => (
              <div key={token} className="overflow-hidden rounded-md border border-border">
                <div className={`${token} h-12 w-full`} />
                <div className="bg-card p-2">
                  <code className="block text-xs font-mono text-foreground">{token}</code>
                  <p className="mt-0.5 text-xs text-muted-foreground">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </SubSection>

        {/* Text tokens */}
        <SubSection title="Text">
          <div className="divide-y divide-border rounded-md border border-border overflow-hidden">
            {[
              { token: "text-foreground", bg: "bg-foreground", sample: "Primary text — headings & body" },
              { token: "text-muted-foreground", bg: "bg-muted-foreground", sample: "Secondary text — descriptions & labels" },
              { token: "text-primary", bg: "bg-primary", sample: "Brand accent — links & active nav" },
              { token: "text-destructive", bg: "bg-destructive", sample: "Error text — destructive actions" },
              { token: "text-card-foreground", bg: "bg-card-foreground", sample: "Text on card surfaces" },
            ].map(({ token, bg, sample }) => (
              <div key={token} className="flex items-center gap-4 bg-card px-4 py-2.5">
                <div className={`${bg} h-6 w-6 shrink-0 rounded border border-border`} />
                <span className={`${token} flex-1 text-sm`}>{sample}</span>
                <code className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-xs font-mono text-muted-foreground">{token}</code>
              </div>
            ))}
          </div>
        </SubSection>

        {/* Border tokens */}
        <SubSection title="Borders">
          <div className="divide-y divide-border rounded-md border border-border overflow-hidden">
            {[
              { token: "border-border", desc: "Default borders (use sparingly)" },
              { token: "border-input", desc: "Form input borders" },
              { token: "border-ring", desc: "Focus ring color" },
            ].map(({ token, desc }) => (
              <div key={token} className="flex items-center gap-4 bg-card px-4 py-2.5">
                <div className={`h-6 w-16 rounded border-2 ${token} shrink-0`} />
                <div className="flex-1">
                  <code className="text-xs font-mono text-foreground">{token}</code>
                  <p className="text-xs text-muted-foreground">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </SubSection>

        {/* Chart colors */}
        <SubSection title="Chart Colors">
          <div className="flex gap-3 flex-wrap">
            {[
              { cls: "bg-[hsl(var(--chart-1))]", label: "chart-1" },
              { cls: "bg-[hsl(var(--chart-2))]", label: "chart-2" },
              { cls: "bg-[hsl(var(--chart-3))]", label: "chart-3" },
              { cls: "bg-[hsl(var(--chart-4))]", label: "chart-4" },
              { cls: "bg-[hsl(var(--chart-5))]", label: "chart-5" },
            ].map(({ cls, label }) => (
              <div key={label} className="flex items-center gap-2">
                <div className={`${cls} h-6 w-6 rounded-full border border-border`} />
                <code className="text-xs font-mono text-muted-foreground">--{label}</code>
              </div>
            ))}
          </div>
        </SubSection>

        {/* Status colors */}
        <SubSection title="Status Colors">
          <p className="text-xs text-muted-foreground">Always use <code className="rounded bg-muted px-1 font-mono">StatusBadge</code> — never map these manually.</p>
          <div className="flex flex-wrap gap-2">
            {["Draft", "Pending", "Approved", "Active", "Rejected", "Overdue", "Closed", "In Progress", "Complete", "Submitted", "Cancelled", "Open"].map((s) => (
              <StatusBadge key={s} status={s} />
            ))}
          </div>
        </SubSection>

        {/* CSS variable reference */}
        <SubSection title="CSS Variable Reference">
          <p className="text-xs text-muted-foreground">Defined in <code className="font-mono">globals.css</code>. Never use raw values — always use Tailwind tokens.</p>
          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Token</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">CSS Var</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Light</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Dark</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {[
                  { token: "primary", var: "--primary", light: "260 37% 59%", dark: "245 58% 62%" },
                  { token: "background", var: "--background", light: "0 0% 100%", dark: "240 6% 9%" },
                  { token: "card", var: "--card", light: "0 0% 100%", dark: "240 5% 13%" },
                  { token: "muted", var: "--muted", light: "216 100% 99%", dark: "240 5% 16%" },
                  { token: "accent", var: "--accent", light: "260 30% 95%", dark: "260 30% 20%" },
                  { token: "foreground", var: "--foreground", light: "240 6% 12%", dark: "0 0% 92%" },
                  { token: "muted-foreground", var: "--muted-foreground", light: "240 4% 46%", dark: "0 0% 65%" },
                  { token: "destructive", var: "--destructive", light: "0 72% 51%", dark: "0 72% 51%" },
                  { token: "border", var: "--border", light: "0 0% 90%", dark: "240 5% 19%" },
                  { token: "ring", var: "--ring", light: "260 37% 59%", dark: "245 58% 62%" },
                ].map(({ token, var: cssVar, light, dark }) => (
                  <tr key={token} className="bg-card">
                    <td className="px-3 py-2 font-mono text-foreground">{token}</td>
                    <td className="px-3 py-2 font-mono text-muted-foreground">{cssVar}</td>
                    <td className="px-3 py-2 text-muted-foreground">{light}</td>
                    <td className="px-3 py-2 text-muted-foreground">{dark}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SubSection>
      </DesignSection>

      <Separator />

      {/* ── TYPOGRAPHY ────────────────────────────────────────────────────── */}
      <DesignSection id="tokens-typography" title="Typography" description="Font stack, size scale, weight, and letter-spacing tokens.">

        <SubSection title="Font Stack">
          <div className="divide-y divide-border rounded-md border border-border overflow-hidden">
            <div className="bg-card px-4 py-3">
              <p className="font-sans text-base text-foreground">The quick brown fox jumps — Inter (sans)</p>
              <code className="text-xs text-muted-foreground font-mono">font-sans · Inter Variable</code>
            </div>
            <div className="bg-card px-4 py-3">
              <p className="font-mono text-base text-foreground">const value = 42; // JetBrains Mono</p>
              <code className="text-xs text-muted-foreground font-mono">font-mono · JetBrains Mono</code>
            </div>
          </div>
        </SubSection>

        <SubSection title="Font Sizes">
          <div className="divide-y divide-border rounded-md border border-border overflow-hidden">
            {[
              { cls: "text-2xl font-semibold tracking-tight", token: "text-2xl", desc: "24px · Page titles (rare)" },
              { cls: "text-xl font-semibold tracking-tight", token: "text-xl", desc: "20px · Page sub-headings" },
              { cls: "text-lg font-semibold", token: "text-lg", desc: "18px · Section headings (h2)" },
              { cls: "text-base", token: "text-base", desc: "16px · Body text, form inputs" },
              { cls: "text-sm", token: "text-sm", desc: "14px · Secondary text, table cells" },
              { cls: "text-xs", token: "text-xs", desc: "12px · Metadata, timestamps, fine print" },
            ].map(({ cls, token, desc }) => (
              <div key={token} className="flex items-center justify-between bg-card px-4 py-2.5">
                <span className={`${cls} text-foreground`}>The quick brown fox</span>
                <div className="ml-4 shrink-0 text-right">
                  <code className="block text-xs font-mono text-muted-foreground">{token}</code>
                  <span className="text-xs text-muted-foreground">{desc}</span>
                </div>
              </div>
            ))}
          </div>
        </SubSection>

        <SubSection title="Font Weights">
          <div className="divide-y divide-border rounded-md border border-border overflow-hidden">
            {[
              { cls: "font-light", token: "font-light", desc: "Large numbers, KPI values" },
              { cls: "font-normal", token: "font-normal", desc: "Body text, descriptions" },
              { cls: "font-medium", token: "font-medium", desc: "Labels, table headers, nav" },
              { cls: "font-semibold", token: "font-semibold", desc: "Section headings, emphasis" },
            ].map(({ cls, token, desc }) => (
              <div key={token} className="flex items-center justify-between bg-card px-4 py-2.5">
                <span className={`${cls} text-base text-foreground`}>The quick brown fox</span>
                <div className="ml-4 shrink-0 text-right">
                  <code className="block text-xs font-mono text-muted-foreground">{token}</code>
                  <span className="text-xs text-muted-foreground">{desc}</span>
                </div>
              </div>
            ))}
          </div>
        </SubSection>

        <SubSection title="Letter Spacing">
          <div className="divide-y divide-border rounded-md border border-border overflow-hidden">
            {[
              { cls: "tracking-tight", token: "tracking-tight", desc: "−0.025em · Default headings" },
              { cls: "tracking-normal", token: "tracking-normal", desc: "0 · Body text" },
              { cls: "tracking-wider", token: "tracking-wider", desc: "0.05em · Eyebrow labels" },
              { cls: "tracking-widest", token: "tracking-widest", desc: "0.1em · Uppercase micro labels" },
            ].map(({ cls, token, desc }) => (
              <div key={token} className="flex items-center justify-between bg-card px-4 py-2.5">
                <span className={`${cls} text-sm font-medium text-foreground`}>ALLEATO DESIGN SYSTEM</span>
                <div className="ml-4 shrink-0 text-right">
                  <code className="block text-xs font-mono text-muted-foreground">{token}</code>
                  <span className="text-xs text-muted-foreground">{desc}</span>
                </div>
              </div>
            ))}
          </div>
        </SubSection>
      </DesignSection>

      <Separator />

      {/* ── SPACING ───────────────────────────────────────────────────────── */}
      <DesignSection id="tokens-spacing" title="Spacing" description="Standard spacing scale. Use gap-*, p-*, m-* — no arbitrary values.">
        <p className="text-sm text-muted-foreground">8px grid system. Every value is a multiple of 8px (4px for tight situations).</p>

        <div className="space-y-2">
          {[
            { token: "gap-1 / p-1", px: "4px", name: "micro", use: "Icon-to-text gap", width: "w-1" },
            { token: "gap-2 / p-2", px: "8px", name: "tight", use: "Badge + text, label + input", width: "w-2" },
            { token: "gap-3 / p-3", px: "12px", name: "compact", use: "Compact list items", width: "w-3" },
            { token: "gap-4 / p-4", px: "16px", name: "base", use: "Default item spacing within a section", width: "w-4" },
            { token: "gap-6 / p-6", px: "24px", name: "comfortable", use: "Form field spacing", width: "w-6" },
            { token: "gap-8 / p-8", px: "32px", name: "section", use: "Between page sections", width: "w-8" },
            { token: "gap-12 / p-12", px: "48px", name: "break", use: "Major visual breaks", width: "w-12" },
          ].map(({ token, px, name, use, width }) => (
            <div key={token} className="flex items-center gap-4">
              <div className="flex h-5 shrink-0 items-center" style={{ width: "3rem" }}>
                <div className={`${width} h-4 rounded-sm bg-primary/30`} />
              </div>
              <div className="w-16 shrink-0">
                <span className="text-xs font-medium text-foreground">{px}</span>
                <span className="ml-1 text-xs text-muted-foreground">({name})</span>
              </div>
              <code className="w-32 shrink-0 text-xs font-mono text-muted-foreground">{token}</code>
              <span className="text-xs text-muted-foreground">{use}</span>
            </div>
          ))}
        </div>
      </DesignSection>

      <Separator />

      {/* ── BORDER RADIUS ─────────────────────────────────────────────────── */}
      <DesignSection id="tokens-radius" title="Border Radius" description="Approved radius values. rounded-md for inputs/cards, rounded-lg for panels.">
        <div className="flex flex-wrap gap-4">
          {[
            { token: "rounded-sm", cls: "rounded-sm", label: "rounded-sm", use: "Tight UI, tags" },
            { token: "rounded-md", cls: "rounded-md", label: "rounded-md", use: "Inputs, buttons (default)" },
            { token: "rounded-lg", cls: "rounded-lg", label: "rounded-lg", use: "Cards, modals" },
            { token: "rounded-xl", cls: "rounded-xl", label: "rounded-xl", use: "Large panels" },
            { token: "rounded-full", cls: "rounded-full", label: "rounded-full", use: "Avatars, badges, pills" },
          ].map(({ token, cls, label, use }) => (
            <div key={token} className="flex flex-col items-center gap-2">
              <div className={`${cls} h-16 w-16 border-2 border-primary/50 bg-primary/10`} />
              <code className="text-xs font-mono text-muted-foreground">{label}</code>
              <span className="text-xs text-muted-foreground">{use}</span>
            </div>
          ))}
        </div>
      </DesignSection>

      <Separator />

      {/* ── SHADOWS ───────────────────────────────────────────────────────── */}
      <DesignSection id="tokens-shadows" title="Shadows" description="Only shadow-xs (cards) or shadow-sm (dropdowns). Never shadow-md or larger.">
        <p className="text-sm text-muted-foreground">Only two shadow levels. Most elements have NO shadow — tonal elevation replaces them.</p>
        <div className="flex flex-wrap gap-6">
          {[
            { token: "shadow-none", cls: "shadow-none", label: "(none)", use: "Most elements" },
            { token: "shadow-xs", cls: "shadow-xs", label: "shadow-xs", use: "Form inputs, select triggers" },
            { token: "shadow-sm", cls: "shadow-sm", label: "shadow-sm", use: "Cards (on hover), dropdowns" },
          ].map(({ token, cls, label, use }) => (
            <div key={token} className="flex flex-col items-center gap-2">
              <div className={`${cls} h-16 w-24 rounded-lg border border-border bg-card`} />
              <code className="text-xs font-mono text-muted-foreground">{label}</code>
              <span className="max-w-24 text-center text-xs text-muted-foreground">{use}</span>
            </div>
          ))}
        </div>
      </DesignSection>

      <Separator />

      {/* ── MOTION ────────────────────────────────────────────────────────── */}
      <DesignSection id="tokens-motion" title="Motion / Animation" description="Transition and animation utilities for consistent motion.">
        <div className="space-y-4">
          <SubSection title="Transition Durations">
            <div className="overflow-x-auto rounded-md border border-border">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">Token</th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">CSS Var</th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">Value</th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">Usage</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {[
                    { token: "duration-0", var: "--transition-instant", value: "0ms", use: "Instant (keyboard nav highlight)" },
                    { token: "duration-100", var: "--transition-fast", value: "100ms", use: "Fast — hover states, micro-interactions" },
                    { token: "duration-150", var: "--transition-normal", value: "150ms", use: "Normal — most transitions" },
                    { token: "duration-200", var: "--transition-spring", value: "200ms", use: "Spring — command palette, modals" },
                  ].map((row) => (
                    <tr key={row.token} className="bg-card">
                      <td className="px-3 py-2 font-mono text-foreground">{row.token}</td>
                      <td className="px-3 py-2 font-mono text-muted-foreground">{row.var}</td>
                      <td className="px-3 py-2 text-muted-foreground">{row.value}</td>
                      <td className="px-3 py-2 text-muted-foreground">{row.use}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SubSection>

          <SubSection title="Easing Functions">
            <div className="overflow-x-auto rounded-md border border-border">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">Name</th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">CSS Var</th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">Curve</th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">Usage</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {[
                    { name: "ease-out-expo", var: "--ease-out-expo", curve: "cubic-bezier(0.19, 1, 0.22, 1)", use: "Smooth deceleration — panels, menus" },
                    { name: "ease-spring", var: "--ease-spring", curve: "cubic-bezier(0.34, 1.56, 0.64, 1)", use: "Slight overshoot — command palette, toasts" },
                    { name: "ease-premium", var: "--ease-premium", curve: "cubic-bezier(0.16, 1, 0.3, 1)", use: "Premium feel — most Framer Motion" },
                  ].map((row) => (
                    <tr key={row.name} className="bg-card">
                      <td className="px-3 py-2 font-mono text-foreground">{row.name}</td>
                      <td className="px-3 py-2 font-mono text-muted-foreground">{row.var}</td>
                      <td className="px-3 py-2 font-mono text-muted-foreground">{row.curve}</td>
                      <td className="px-3 py-2 text-muted-foreground">{row.use}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SubSection>
        </div>
      </DesignSection>

      {/* ================================================================== */}
      {/* SECTION 1: Layout Components */}
      {/* ================================================================== */}
      <Separator />
      <DesignSection id="section-layout" title="1. Layout Components" description="PageShell, PageContainer, Separator, Accordion, and structural primitives.">

      {/* PageShell */}
      <SubSection title="PageShell">
        <p className="text-sm text-muted-foreground">
          The one entry point for all page layouts. Every new page must use one of these variants.
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {([
            { variant: "dashboard", maxWidth: "full-width", useCase: "Home / overview pages with KPI cards + charts", example: "/760/home" },
            { variant: "table", maxWidth: "full-width", useCase: "Data table pages (UnifiedTablePage inside)", example: "/760/direct-costs" },
            { variant: "form", maxWidth: "max-w-5xl", useCase: "Create / edit forms with optional back button", example: "/760/commitments/new" },
            { variant: "detail", maxWidth: "max-w-6xl", useCase: "Record detail pages with tabs, line items", example: "/760/commitments/686736b1-b1c8-4589-aded-369686c9d05c" },
            { variant: "content", maxWidth: "max-w-4xl", useCase: "Settings / docs / read-heavy pages", example: "/design" },
          ] as const).map((item) => (
            <div
              key={item.variant}
              className="rounded-md bg-muted/50 p-4"
            >
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="font-mono text-xs">
                  {item.variant}
                </Badge>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {item.maxWidth}
              </p>
              <p className="mt-1 text-sm text-foreground">{item.useCase}</p>
              <a href={item.example} className="mt-2 inline-block text-xs text-primary hover:underline">
                View example &rarr;
              </a>
            </div>
          ))}
        </div>
      </SubSection>

      {/* PageContainer */}
      <SubSection title="PageContainer">
        <p className="text-sm text-muted-foreground">
          Low-level mx-auto wrapper with responsive padding:{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">px-3 sm:px-5 lg:px-7</code>.
          Used internally by PageShell. Rarely needed directly.
        </p>
      </SubSection>

      {/* PageHeader */}
      <SubSection title="PageHeader / ProjectPageHeader">
        <p className="text-sm text-muted-foreground">
          Unified header with title, description, optional actions and status badge. Shown here inside PageShell above.
        </p>
      </SubSection>

      {/* PageTabs */}
      <SubSection title="PageTabs (border-bottom style)">
        <PageTabs
          variant="inline"
          tabs={[
            { label: "Overview", href: "overview", count: 3, isActive: activeTab === "overview" },
            { label: "Details", href: "details", isActive: activeTab === "details" },
            { label: "History", href: "history", count: 12, isActive: activeTab === "history" },
            { label: "Settings", href: "settings", isActive: activeTab === "settings" },
          ]}
          onTabClick={(href) => setActiveTab(href)}
        />
        <p className="text-xs text-muted-foreground">
          Site standard. Uses <code className="rounded bg-muted px-1 py-0.5 font-mono">onTabClick</code> for local state or router.push for real navigation.
        </p>
      </SubSection>

      {/* Section Tabs */}
      <SubSection title="Section Tabs (pill style)">
        <Tabs defaultValue="tab1" className="max-w-sm">
          <TabsList>
            <TabsTrigger value="tab1">Tab 1</TabsTrigger>
            <TabsTrigger value="tab2">Tab 2</TabsTrigger>
            <TabsTrigger value="tab3">Tab 3</TabsTrigger>
          </TabsList>
        </Tabs>
        <p className="text-xs text-muted-foreground">
          Use these for section-level content inside a page. Page-level navigation should use <code className="rounded bg-muted px-1 py-0.5 font-mono">PageTabs</code>.
        </p>
      </SubSection>

      {/* Separator */}
      <SubSection title="Separator">
        <p className="text-sm text-muted-foreground">
          Visual divider for content sections. Supports horizontal (default) and vertical orientations.
        </p>
        <div className="space-y-4">
          <Eyebrow>Horizontal (default)</Eyebrow>
          <div className="rounded-md bg-muted/30 p-4">
            <p className="text-sm text-foreground">Content above</p>
            <Separator className="my-3" />
            <p className="text-sm text-foreground">Content below</p>
          </div>
          <Eyebrow>Vertical</Eyebrow>
          <div className="flex h-8 items-center gap-4 rounded-md bg-muted/30 px-4">
            <span className="text-sm text-foreground">Left</span>
            <Separator orientation="vertical" />
            <span className="text-sm text-foreground">Center</span>
            <Separator orientation="vertical" />
            <span className="text-sm text-foreground">Right</span>
          </div>
        </div>
      </SubSection>

      {/* Accordion */}
      <SubSection title="Accordion">
        <p className="text-sm text-muted-foreground">
          Collapsible content sections. Supports single and multiple mode. Import from{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs font-mono">@/components/ds</code>.
        </p>
        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="item-1">
            <AccordionTrigger>What is the design system?</AccordionTrigger>
            <AccordionContent>
              The design system is a collection of reusable components, tokens, and patterns that ensure consistency across the Alleato platform.
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="item-2">
            <AccordionTrigger>How do I import components?</AccordionTrigger>
            <AccordionContent>
              Import everything from <code className="rounded bg-muted px-1 py-0.5 text-xs font-mono">@/components/ds</code>. This barrel re-exports all approved shadcn/ui primitives and custom DS components.
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="item-3">
            <AccordionTrigger>Can I use hardcoded colors?</AccordionTrigger>
            <AccordionContent>
              No. Always use semantic tokens like <code className="rounded bg-muted px-1 py-0.5 text-xs font-mono">bg-background</code>,{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-xs font-mono">text-foreground</code>, and{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-xs font-mono">border-border</code>. ESLint will block hardcoded colors.
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </SubSection>

      {/* Collapsible */}
      <SubSection title="Collapsible">
        <p className="text-sm text-muted-foreground">
          Toggle content visibility with a trigger. More manual than Accordion — use when you need custom trigger UI.
        </p>
        <Collapsible open={collapsibleOpen} onOpenChange={setCollapsibleOpen} className="w-full space-y-2">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-semibold text-foreground">3 tagged items</h4>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="icon-sm">
                <ChevronsUpDown className="h-4 w-4" />
                <span className="sr-only">Toggle</span>
              </Button>
            </CollapsibleTrigger>
          </div>
          <div className="rounded-md bg-muted/30 px-4 py-2 text-sm text-foreground">
            Always visible item
          </div>
          <CollapsibleContent className="space-y-2">
            <div className="rounded-md bg-muted/30 px-4 py-2 text-sm text-foreground">
              Hidden item 1
            </div>
            <div className="rounded-md bg-muted/30 px-4 py-2 text-sm text-foreground">
              Hidden item 2
            </div>
          </CollapsibleContent>
        </Collapsible>
      </SubSection>

      {/* ScrollArea */}
      <SubSection title="ScrollArea">
        <p className="text-sm text-muted-foreground">
          Custom scrollbar container. Use for constrained-height lists, code blocks, and side panels.
        </p>
        <ScrollArea className="h-48 w-full rounded-md border border-border">
          <div className="p-4">
            {["1","2","3","4","5","6","7","8","9","10","11","12","13","14","15","16","17","18","19","20"].map((n) => (
              <div key={n} className="border-b border-border py-2 text-sm text-foreground last:border-b-0">
                Item {n} — Scrollable content row
              </div>
            ))}
          </div>
        </ScrollArea>
        <p className="text-xs text-muted-foreground">
          Horizontal scrolling: use <code className="rounded bg-muted px-1 py-0.5 font-mono">ScrollBar orientation=&quot;horizontal&quot;</code>.
        </p>
      </SubSection>
      </DesignSection>{/* end section-layout */}

      {/* ================================================================== */}
      {/* SECTION 2: Status Components */}
      {/* ================================================================== */}
      <Separator />
      <DesignSection id="section-status" title="2. Status Components" description="StatusBadge, StatusDot, StatusText — always use these, never hand-roll status colors.">

      {/* StatusBadge */}
      <SubSection title="StatusBadge">
        <p className="text-sm text-muted-foreground">
          Pass a raw status string — colors are resolved automatically via STATUS_TO_VARIANT map.
        </p>
        <div className="flex flex-wrap gap-2">
          {STATUSES.map((s) => (
            <StatusBadge key={s} status={s} />
          ))}
        </div>
      </SubSection>

      {/* StatusDot */}
      <SubSection title="StatusDot">
        <p className="text-sm text-muted-foreground">
          Minimal inline dot + label for tables and compact views.
        </p>
        <div className="flex flex-wrap gap-4">
          {STATUSES.map((s) => (
            <StatusDot key={s} status={s} />
          ))}
        </div>
      </SubSection>

      {/* StatusText */}
      <SubSection title="StatusText">
        <p className="text-sm text-muted-foreground">
          Plain muted text for non-emphasized statuses.
        </p>
        <div className="flex flex-wrap gap-4">
          {STATUSES.map((s) => (
            <StatusText key={s} status={s} />
          ))}
        </div>
      </SubSection>

      </DesignSection>{/* end section-status */}

      {/* ================================================================== */}
      {/* SECTION 3: Data Display */}
      {/* ================================================================== */}
      <Separator />
      <DesignSection id="section-data" title="3. Data Display" description="KpiBlock, DataTable, SectionHeader, EmptyState, and data visualization primitives.">

      {/* KpiRow */}
      <SubSection title="KpiBlock &amp; KpiRow">
        <KpiRow
          metrics={[
            { label: "Total Budget", value: "$2.4M", delta: { value: "3.2%", positive: true }, context: "vs. last quarter" },
            { label: "Committed", value: "$1.8M", context: "75% of budget" },
            { label: "Pending", value: "$340K", delta: { value: "12%", positive: false }, context: "2 pending COs" },
            { label: "Remaining", value: "$260K", context: "10.8% available" },
          ]}
        />
      </SubSection>

      {/* DataTable */}
      <SubSection title="DataTable">
        <DataTable columns={TABLE_COLUMNS} rows={TABLE_ROWS} />
      </SubSection>

      {/* SectionHeader */}
      <SubSection title="SectionHeader">
        <div className="rounded-md bg-muted/30 p-4">
          <SectionHeader
            title="Line Items"
            count={12}
            action={{ label: "View all", onClick: () => {} }}
          />
          <p className="text-sm text-muted-foreground">
            Content beneath the section header goes here.
          </p>
        </div>
      </SubSection>

      {/* Eyebrow */}
      <SubSection title="Eyebrow">
        <Eyebrow>SECTION LABEL</Eyebrow>
        <p className="text-sm text-muted-foreground">
          11px uppercase tracking-wider. Tier 1 text hierarchy.
        </p>
      </SubSection>

      {/* DateAvatar */}
      <SubSection title="DateAvatar">
        <div className="flex items-center gap-6">
          <DateAvatar date="2026-03-26" size="md" />
          <DateAvatar date="2026-12-25" size="sm" />
        </div>
      </SubSection>

      {/* AvatarStack */}
      <SubSection title="AvatarStack">
        <div className="flex items-center gap-6">
          <AvatarStack avatars={["JD", "MH", "BC", "TS"]} max={4} size="md" />
          <AvatarStack avatars={["JD", "MH", "BC", "TS"]} max={3} size="sm" />
        </div>
        <p className="text-sm text-muted-foreground">
          Overlapping avatar initials. Props: avatars (string[]), max, size (sm | md).
        </p>
      </SubSection>

      {/* Avatar + AvatarGroup */}
      <SubSection title="Avatar &amp; AvatarGroup (shadcn)">
        <p className="text-sm text-muted-foreground">
          Base avatar primitives from shadcn. Use for individual avatars or composable groups with overflow count.
        </p>
        <Eyebrow>Single Avatars</Eyebrow>
        <div className="flex items-center gap-3">
          <Avatar>
            <AvatarImage src="https://github.com/shadcn.png" alt="User" />
            <AvatarFallback>CN</AvatarFallback>
          </Avatar>
          <Avatar>
            <AvatarFallback>JD</AvatarFallback>
          </Avatar>
          <Avatar>
            <AvatarFallback>MH</AvatarFallback>
          </Avatar>
        </div>
        <Eyebrow>AvatarGroup with overflow</Eyebrow>
        <AvatarGroup>
          <Avatar>
            <AvatarFallback>JD</AvatarFallback>
          </Avatar>
          <Avatar>
            <AvatarFallback>MH</AvatarFallback>
          </Avatar>
          <Avatar>
            <AvatarFallback>BC</AvatarFallback>
          </Avatar>
          <AvatarGroupCount>+5</AvatarGroupCount>
        </AvatarGroup>
      </SubSection>

      {/* Progress */}
      <SubSection title="Progress">
        <p className="text-sm text-muted-foreground">
          Linear progress indicator. Pass a <code className="rounded bg-muted px-1 py-0.5 text-xs font-mono">value</code> between 0 and 100.
        </p>
        <div className="space-y-4">
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Empty (0%)</span>
              <span>0%</span>
            </div>
            <Progress value={0} />
          </div>
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Quarter (25%)</span>
              <span>25%</span>
            </div>
            <Progress value={25} />
          </div>
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Half (50%)</span>
              <span>50%</span>
            </div>
            <Progress value={50} />
          </div>
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Almost (75%)</span>
              <span>75%</span>
            </div>
            <Progress value={75} />
          </div>
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Complete (100%)</span>
              <span>100%</span>
            </div>
            <Progress value={100} />
          </div>
        </div>
      </SubSection>

      {/* HoverCard */}
      <SubSection title="HoverCard">
        <p className="text-sm text-muted-foreground">
          Content card that appears on hover. Use for user profiles, link previews, or contextual details.
        </p>
        <HoverCard>
          <HoverCardTrigger asChild>
            <Button variant="link" className="p-0 h-auto text-primary">
              @alleato-team
            </Button>
          </HoverCardTrigger>
          <HoverCardContent className="w-80">
            <div className="flex gap-4">
              <Avatar>
                <AvatarFallback>AT</AvatarFallback>
              </Avatar>
              <div className="space-y-1">
                <h4 className="text-sm font-semibold text-foreground">Alleato Team</h4>
                <p className="text-sm text-muted-foreground">
                  Construction project management platform. Building smarter tools for GCs.
                </p>
                <div className="flex items-center pt-2">
                  <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">
                    Founded January 2025
                  </span>
                </div>
              </div>
            </div>
          </HoverCardContent>
        </HoverCard>
      </SubSection>

      </DesignSection>{/* end section-data */}

      {/* ================================================================== */}
      {/* SECTION 4: Feedback & States */}
      {/* ================================================================== */}
      <Separator />
      <DesignSection id="section-feedback" title="4. Feedback & States" description="Alert, Skeleton, Spinner, Progress, Toast — for async states and system feedback.">

      {/* EmptyState */}
      <SubSection title="EmptyState">
        <div className="space-y-6">
          <p className="text-sm text-muted-foreground">
            EmptyState visuals are primitive-controlled. The action button style is caller-controlled via{" "}
            <code>Button variant</code> and should match product context.
          </p>

          <div className="grid gap-6 md:grid-cols-2">
            <EmptyState
              icon={<FolderOpen />}
              title="No contracts yet"
              description="Create your first contract to start tracking commitments and change orders."
              action={
                <Button size="sm" onClick={() => {}}>
                  <Plus />
                  Create Contract
                </Button>
              }
            />

            <EmptyState
              icon={<FolderOpen />}
              title="No SOV lines yet"
              description="Add SOV lines with budget codes to track the contract value."
              action={
                <Button size="sm" variant="outline" onClick={() => {}}>
                  <Plus />
                  Add SOV Line
                </Button>
              }
            />
          </div>
        </div>
      </SubSection>

      {/* Skeleton */}
      <SubSection title="Skeleton">
        <div className="space-y-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-8 w-full" />
        </div>
      </SubSection>

      {/* Alert */}
      <SubSection title="Alert — All Variants">
        <div className="grid gap-3">
          <Alert>
            <Info />
            <AlertTitle>Default</AlertTitle>
            <AlertDescription>
              Standard informational alert with neutral styling.
            </AlertDescription>
          </Alert>
          <Alert variant="info">
            <Info />
            <AlertTitle>Info</AlertTitle>
            <AlertDescription>
              Contextual information the user should be aware of.
            </AlertDescription>
          </Alert>
          <Alert variant="success">
            <CheckCircle />
            <AlertTitle>Success</AlertTitle>
            <AlertDescription>
              Operation completed successfully.
            </AlertDescription>
          </Alert>
          <Alert variant="warning">
            <AlertTriangle />
            <AlertTitle>Warning</AlertTitle>
            <AlertDescription>
              Something needs attention but is not critical.
            </AlertDescription>
          </Alert>
          <Alert variant="destructive">
            <XCircle />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>
              Something went wrong. Please try again.
            </AlertDescription>
          </Alert>
        </div>
      </SubSection>

      {/* Spinner */}
      <SubSection title="Spinner">
        <div className="flex items-center gap-4">
          <Spinner className="size-4" />
          <Spinner className="size-6" />
          <Spinner className="size-8" />
          <span className="text-sm text-muted-foreground">Sizes: 16px, 24px, 32px</span>
        </div>
      </SubSection>

      </DesignSection>{/* end section-feedback */}

      {/* ================================================================== */}
      {/* SECTION 5: Form Components */}
      {/* ================================================================== */}
      <Separator />
      <DesignSection id="section-forms" title="5. Form Components" description="All form inputs, Button variants, and form layout primitives.">

      {/* Buttons */}
      <SubSection title="Button — All Variants &amp; Sizes">

        {/* Variant grid */}
        <div className="space-y-3">
          <Eyebrow>Variants (default size)</Eyebrow>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex flex-col items-center gap-1">
              <Button variant="default">Default</Button>
              <span className="text-[10px] text-muted-foreground">default</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <Button variant="outline">Outline</Button>
              <span className="text-[10px] text-muted-foreground">outline</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <Button variant="ghost">Ghost</Button>
              <span className="text-[10px] text-muted-foreground">ghost</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <Button variant="destructive">Destructive</Button>
              <span className="text-[10px] text-muted-foreground">destructive</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <Button variant="secondary">Secondary</Button>
              <span className="text-[10px] text-muted-foreground">secondary</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <Button variant="link">Link</Button>
              <span className="text-[10px] text-muted-foreground">link</span>
            </div>
          </div>
        </div>

        {/* Size grid */}
        <div className="space-y-3">
          <Eyebrow>Text Button Sizes</Eyebrow>
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col items-center gap-1">
              <Button size="xs">Extra Small</Button>
              <span className="text-[10px] text-muted-foreground">xs (28px)</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <Button size="sm">Small</Button>
              <span className="text-[10px] text-muted-foreground">sm (32px)</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <Button>Default</Button>
              <span className="text-[10px] text-muted-foreground">default (36px)</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <Button size="lg">Large</Button>
              <span className="text-[10px] text-muted-foreground">lg (40px)</span>
            </div>
          </div>
        </div>

        {/* Icon button sizes */}
        <div className="space-y-3">
          <Eyebrow>Icon Button Sizes</Eyebrow>
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col items-center gap-1">
              <Button variant="outline" size="icon-xs"><Search /></Button>
              <span className="text-[10px] text-muted-foreground">icon-xs (28px)</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <Button variant="outline" size="icon-sm"><Search /></Button>
              <span className="text-[10px] text-muted-foreground">icon-sm (32px)</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <Button variant="outline" size="icon"><Search /></Button>
              <span className="text-[10px] text-muted-foreground">icon (36px)</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <Button variant="outline" size="icon-lg"><Search /></Button>
              <span className="text-[10px] text-muted-foreground">icon-lg (40px)</span>
            </div>
          </div>
        </div>

        {/* Matched pairs */}
        <div className="space-y-3">
          <Eyebrow>Matched Pairs (same height)</Eyebrow>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5 rounded-md bg-muted/30 px-3 py-2">
              <Button size="sm">Small Text</Button>
              <Button variant="outline" size="icon-sm"><Search /></Button>
              <span className="ml-2 text-[10px] text-muted-foreground">both 32px</span>
            </div>
            <div className="flex items-center gap-1.5 rounded-md bg-muted/30 px-3 py-2">
              <Button>Default Text</Button>
              <Button variant="outline" size="icon"><Search /></Button>
              <span className="ml-2 text-[10px] text-muted-foreground">both 36px</span>
            </div>
          </div>
        </div>
      </SubSection>

      {/* Form fields */}
      <SubSection title="Form Fields">
        <div className="grid gap-6 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="demo-input">Input</Label>
            <Input id="demo-input" placeholder="Enter text..." />
          </div>
          <div className="space-y-2">
            <Label htmlFor="demo-select">Select</Label>
            <Select>
              <SelectTrigger id="demo-select">
                <SelectValue placeholder="Choose option..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="a">Option A</SelectItem>
                <SelectItem value="b">Option B</SelectItem>
                <SelectItem value="c">Option C</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="demo-textarea">Textarea</Label>
            <Textarea id="demo-textarea" placeholder="Enter description..." rows={3} />
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Checkbox
                id="demo-checkbox"
                checked={checkboxChecked}
                onCheckedChange={(v) => setCheckboxChecked(v === true)}
              />
              <Label htmlFor="demo-checkbox">Checkbox</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="demo-switch"
                checked={switchChecked}
                onCheckedChange={setSwitchChecked}
              />
              <Label htmlFor="demo-switch">Switch</Label>
            </div>
          </div>
          <div className="space-y-2">
            <Label>RadioGroup</Label>
            <RadioGroup defaultValue="option1">
              <div className="flex items-center gap-2">
                <RadioGroupItem value="option1" id="r1" />
                <Label htmlFor="r1">Option 1</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="option2" id="r2" />
                <Label htmlFor="r2">Option 2</Label>
              </div>
            </RadioGroup>
          </div>
        </div>
      </SubSection>

      {/* Slider */}
      <SubSection title="Slider">
        <p className="text-sm text-muted-foreground">
          Draggable value slider. Supports single value and range mode.
        </p>
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Value</span>
              <span>{sliderValue[0]}%</span>
            </div>
            <Slider
              value={sliderValue}
              onValueChange={setSliderValue}
              max={100}
              step={1}
            />
          </div>
          <div className="space-y-2">
            <Eyebrow>Disabled</Eyebrow>
            <Slider defaultValue={[50]} max={100} step={1} disabled />
          </div>
        </div>
      </SubSection>

      {/* ToggleGroup */}
      <SubSection title="ToggleGroup">
        <p className="text-sm text-muted-foreground">
          Mutually exclusive toggle buttons. Use for view modes, alignment, and formatting options.
        </p>
        <div className="space-y-4">
          <Eyebrow>Single selection (outline)</Eyebrow>
          <ToggleGroup type="single" variant="outline" defaultValue="bold">
            <ToggleGroupItem value="bold" aria-label="Toggle bold">
              <Bold className="h-4 w-4" />
            </ToggleGroupItem>
            <ToggleGroupItem value="italic" aria-label="Toggle italic">
              <Italic className="h-4 w-4" />
            </ToggleGroupItem>
            <ToggleGroupItem value="underline" aria-label="Toggle underline">
              <Underline className="h-4 w-4" />
            </ToggleGroupItem>
          </ToggleGroup>
          <Eyebrow>Single selection (default variant)</Eyebrow>
          <ToggleGroup type="single" defaultValue="list">
            <ToggleGroupItem value="grid" aria-label="Grid view">
              <LayoutDashboard className="h-4 w-4" />
            </ToggleGroupItem>
            <ToggleGroupItem value="list" aria-label="List view">
              <List className="h-4 w-4" />
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
      </SubSection>

      {/* Calendar */}
      <SubSection title="Calendar">
        <p className="text-sm text-muted-foreground">
          Month calendar built on react-day-picker. Use inside a Popover to create a DatePicker.
        </p>
        <div className="flex justify-start">
          <Calendar
            mode="single"
            selected={calendarDate}
            onSelect={setCalendarDate}
            className="rounded-md border border-border"
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Selected: {calendarDate?.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) ?? "none"}
        </p>
      </SubSection>

      {/* NumberInput */}
      <SubSection title="NumberInput">
        <p className="text-sm text-muted-foreground">
          Enhanced number input for budget/financial data entry. Auto-selects on focus, formats currency on blur.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="demo-number">Standard Number</Label>
            <NumberInput
              id="demo-number"
              placeholder="Enter amount"
              value={numberInputValue}
              onChange={(e) => setNumberInputValue(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="demo-currency">Currency (MoneyField)</Label>
            <MoneyField
              label="Currency Demo"
              inline
              value={245000}
              showCurrency={false}
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Currency inputs use <code className="rounded bg-muted px-1 py-0.5 font-mono">MoneyField</code> exclusively.{" "}
          <code className="rounded bg-muted px-1 py-0.5 font-mono">NumberInput</code> is for non-currency numbers only.
        </p>
      </SubSection>

      </DesignSection>{/* end section-forms */}

      {/* ================================================================== */}
      {/* SECTION 6: Overlays */}
      {/* ================================================================== */}
      <Separator />
      <DesignSection id="section-overlays" title="6. Overlays" description="Dialog, Sheet, Tooltip, Popover, AlertDialog, Drawer — all modal patterns.">

      <div className="flex flex-wrap gap-3">
        {/* Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline">Open Dialog</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Dialog Title</DialogTitle>
              <DialogDescription>
                This is a demo dialog. Dialogs are modal overlays for confirmations, forms, and details.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={() => setDialogOpen(false)}>Confirm</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Sheet */}
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetTrigger asChild>
            <Button variant="outline">Open Sheet</Button>
          </SheetTrigger>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>Sheet Title</SheetTitle>
              <SheetDescription>
                Sheets slide in from the edge. Use for detail panels, filters, and secondary forms.
              </SheetDescription>
            </SheetHeader>
          </SheetContent>
        </Sheet>

        {/* Tooltip */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline">Hover for Tooltip</Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>This is a tooltip</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* Popover */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline">Open Popover</Button>
          </PopoverTrigger>
          <PopoverContent className="w-64">
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-foreground">Popover Content</h4>
              <p className="text-sm text-muted-foreground">
                Popovers are for non-modal content like filters, settings pickers, and contextual info.
              </p>
            </div>
          </PopoverContent>
        </Popover>

        {/* AlertDialog */}
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive">Delete Item</Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete this item and remove its data from our servers.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction>Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Drawer */}
        <Drawer>
          <DrawerTrigger asChild>
            <Button variant="outline">Open Drawer</Button>
          </DrawerTrigger>
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle>Drawer Title</DrawerTitle>
              <DrawerDescription>
                Drawers slide up from the bottom on mobile. Use for action sheets and mobile-first overlays.
              </DrawerDescription>
            </DrawerHeader>
            <div className="p-4">
              <p className="text-sm text-muted-foreground">
                Drawer content goes here. On desktop, this behaves like a bottom sheet.
              </p>
            </div>
            <DrawerFooter>
              <Button>Submit</Button>
              <DrawerClose asChild>
                <Button variant="outline">Cancel</Button>
              </DrawerClose>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>
      </div>

      <p className="text-xs text-muted-foreground">
        <strong>When to use which:</strong> Dialog = confirmations &amp; small forms. Sheet = detail panels &amp; large forms.
        AlertDialog = destructive confirmations (user must choose). Drawer = mobile action sheets. Popover = non-modal contextual content.
        Tooltip = hover hint text.
      </p>

      </DesignSection>{/* end section-overlays */}

      {/* ================================================================== */}
      {/* SECTION 7: Navigation */}
      {/* ================================================================== */}
      <Separator />
      <DesignSection id="section-navigation" title="7. Navigation" description="Tabs, DropdownMenu, Breadcrumb, Command palette, and wayfinding components.">

      {/* Tabs (shadcn) */}
      <SubSection title="Tabs (shadcn pill-style)">
        <Tabs defaultValue="general">
          <TabsList>
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="notifications">Notifications</TabsTrigger>
            <TabsTrigger value="security">Security</TabsTrigger>
          </TabsList>
          <TabsContent value="general" className="pt-4">
            <p className="text-sm text-muted-foreground">General settings content.</p>
          </TabsContent>
          <TabsContent value="notifications" className="pt-4">
            <p className="text-sm text-muted-foreground">Notification preferences content.</p>
          </TabsContent>
          <TabsContent value="security" className="pt-4">
            <p className="text-sm text-muted-foreground">Security settings content.</p>
          </TabsContent>
        </Tabs>
      </SubSection>

      {/* DropdownMenu */}
      <SubSection title="DropdownMenu">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">
              Actions
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem>
              <PenLine />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem>
              <FileText />
              Duplicate
            </DropdownMenuItem>
            <DropdownMenuItem className="text-destructive">
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SubSection>

      {/* Breadcrumb */}
      <SubSection title="Breadcrumb">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/">Projects</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink href="/">Vermillion Rise</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Budget</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </SubSection>

      {/* Pagination */}
      <SubSection title="Pagination">
        <p className="text-sm text-muted-foreground">
          Page navigation with prev/next buttons and page numbers. Automatically collapses with ellipsis for many pages.
        </p>
        <SimplePagination
          currentPage={paginationPage}
          totalPages={10}
          onPageChange={setPaginationPage}
        />
        <p className="text-xs text-muted-foreground">
          Current page: {paginationPage} / 10. Import{" "}
          <code className="rounded bg-muted px-1 py-0.5 font-mono">SimplePagination</code> from{" "}
          <code className="rounded bg-muted px-1 py-0.5 font-mono">@/components/ui/pagination</code>.
        </p>
      </SubSection>

      {/* Command Palette */}
      <SubSection title="Command Palette">
        <p className="text-sm text-muted-foreground">
          Searchable command list (cmdk). Use standalone or inside a Dialog for a spotlight-style search.
        </p>
        <Command className="rounded-md border border-border">
          <CommandInput placeholder="Type a command or search..." />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup heading="Suggestions">
              <CommandItem>
                <CalendarIcon className="mr-2 h-4 w-4" />
                <span>Calendar</span>
              </CommandItem>
              <CommandItem>
                <Smile className="mr-2 h-4 w-4" />
                <span>Search Emoji</span>
              </CommandItem>
              <CommandItem>
                <Calculator className="mr-2 h-4 w-4" />
                <span>Calculator</span>
              </CommandItem>
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup heading="Settings">
              <CommandItem>
                <User className="mr-2 h-4 w-4" />
                <span>Profile</span>
              </CommandItem>
              <CommandItem>
                <CreditCard className="mr-2 h-4 w-4" />
                <span>Billing</span>
              </CommandItem>
              <CommandItem>
                <Settings className="mr-2 h-4 w-4" />
                <span>Settings</span>
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </SubSection>

      </DesignSection>{/* end section-navigation */}

      {/* ================================================================== */}
      {/* SECTION 8: Cards */}
      {/* ================================================================== */}
      <Separator />
      <DesignSection id="section-cards" title="8. Cards" description="Card primitives. Use bg-card + border-border + rounded-lg — no ad-hoc card styling.">

      <Card>
        <CardHeader>
          <CardTitle>Card Title</CardTitle>
          <CardDescription>
            Cards use bg-card with border-border. Only shadow-xs or shadow-sm allowed.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-foreground">
            Card content goes here. Use Card for grouping related information.
          </p>
        </CardContent>
      <CardFooter className="flex justify-end gap-2">
          <Button variant="outline" size="sm">Cancel</Button>
          <Button size="sm">Save</Button>
        </CardFooter>
      </Card>

      </DesignSection>{/* end section-cards */}

      {/* ================================================================== */}
      {/* SECTION 9: Table Cell Primitives */}
      {/* ================================================================== */}
      <Separator />
      <DesignSection id="section-cells" title="9. Table Cell Primitives" description="Cell*, Table* — use ONLY these in column render functions. Never raw JSX in table cells.">

      <p className="text-sm text-muted-foreground">
        Use these in column <code className="rounded bg-muted px-1 py-0.5 text-xs font-mono">render</code> functions.
        Import from <code className="rounded bg-muted px-1 py-0.5 text-xs font-mono">@/components/ds</code>.
      </p>

      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full text-sm">
          <thead className="bg-primary/10">
            <tr className="border-b border-border">
              <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-[0.04em] text-foreground/85">
                Component
              </th>
              <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-[0.04em] text-foreground/85">
                Live Example
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            <tr className="hover:bg-muted/50">
              <td className="px-4 py-2.5 font-medium text-foreground">CellText</td>
              <td className="px-4 py-2.5"><CellText value="Plain text value" /></td>
            </tr>
            <tr className="hover:bg-muted/50">
              <td className="px-4 py-2.5 font-medium text-foreground">CellText (empty)</td>
              <td className="px-4 py-2.5"><CellText value={null} /></td>
            </tr>
            <tr className="hover:bg-muted/50">
              <td className="px-4 py-2.5 font-medium text-foreground">TruncatedCell</td>
              <td className="px-4 py-2.5"><TruncatedCell value="This is a very long text that will be truncated with an ellipsis and show a tooltip on hover" maxWidth={200} /></td>
            </tr>
            <tr className="hover:bg-muted/50">
              <td className="px-4 py-2.5 font-medium text-foreground">CellLink</td>
              <td className="px-4 py-2.5"><CellLink value="Acme Corp" href="#" /></td>
            </tr>
            <tr className="hover:bg-muted/50">
              <td className="px-4 py-2.5 font-medium text-foreground">CellEmail</td>
              <td className="px-4 py-2.5"><CellEmail value="john@example.com" /></td>
            </tr>
            <tr className="hover:bg-muted/50">
              <td className="px-4 py-2.5 font-medium text-foreground">CellCurrency</td>
              <td className="px-4 py-2.5"><CellCurrency value={245000} /></td>
            </tr>
            <tr className="hover:bg-muted/50">
              <td className="px-4 py-2.5 font-medium text-foreground">CellNumber</td>
              <td className="px-4 py-2.5"><CellNumber value={1234} /></td>
            </tr>
            <tr className="hover:bg-muted/50">
              <td className="px-4 py-2.5 font-medium text-foreground">CellPercent</td>
              <td className="px-4 py-2.5"><CellPercent value={87.5} /></td>
            </tr>
            <tr className="hover:bg-muted/50">
              <td className="px-4 py-2.5 font-medium text-foreground">CellDate</td>
              <td className="px-4 py-2.5"><CellDate value="2026-03-26" /></td>
            </tr>
            <tr className="hover:bg-muted/50">
              <td className="px-4 py-2.5 font-medium text-foreground">CellStatus</td>
              <td className="px-4 py-2.5"><CellStatus value="Approved" /></td>
            </tr>
            <tr className="hover:bg-muted/50">
              <td className="px-4 py-2.5 font-medium text-foreground">CellBadge</td>
              <td className="px-4 py-2.5">
                <CellBadge
                  value="contractor"
                  colorMap={{ contractor: "bg-blue-50 text-blue-600", vendor: "bg-purple-50 text-purple-600" }}
                />
              </td>
            </tr>
            <tr className="hover:bg-muted/50">
              <td className="px-4 py-2.5 font-medium text-foreground">TableTagBadge</td>
              <td className="px-4 py-2.5"><TableTagBadge label="Structural" variant="outline" /></td>
            </tr>
            <tr className="hover:bg-muted/50">
              <td className="px-4 py-2.5 font-medium text-foreground">TableAvatarUsers</td>
              <td className="px-4 py-2.5"><TableAvatarUsers users={["john@acme.com", "mary@acme.com", "bob@acme.com"]} /></td>
            </tr>
            <tr className="hover:bg-muted/50">
              <td className="px-4 py-2.5 font-medium text-foreground">TableCountIndicator</td>
              <td className="px-4 py-2.5"><TableCountIndicator count={7} /></td>
            </tr>
          </tbody>
        </table>
      </div>

      </DesignSection>{/* end section-cells */}

      {/* ================================================================== */}
      {/* SECTION 10: New DS Components */}
      {/* ================================================================== */}
      <Separator />
      <DesignSection id="section-missing" title="10. New DS Components" description="Freshly built components ready to use. Import from @/components/ds.">
        <div className="rounded-md border border-success/30 bg-success/10 px-4 py-3">
          <p className="text-sm font-medium text-foreground">
            All listed components are implemented and available in the design system.
          </p>
          <p className="text-xs text-muted-foreground">
            Use <code className="font-mono">@/components/ds</code> as the single import path.
          </p>
        </div>

        {/* BackButton */}
        <div className="space-y-3">
          <p className="text-sm font-semibold text-foreground">BackButton</p>
          <p className="text-xs text-muted-foreground">Standardized back navigation. Pass <code className="font-mono">onClick</code> for <code className="font-mono">router.back()</code> or <code className="font-mono">href</code> for a fixed URL.</p>
          <div className="flex items-center gap-4">
            <BackButton onClick={() => {}} />
            <BackButton onClick={() => {}} label="Return to contracts" />
          </div>
        </div>

        <Separator />

        {/* InfoAlert */}
        <div className="space-y-3">
          <p className="text-sm font-semibold text-foreground">InfoAlert</p>
          <p className="text-xs text-muted-foreground">Lightweight contextual messages. Four variants: <code className="font-mono">info</code> (default), <code className="font-mono">warning</code>, <code className="font-mono">success</code>, <code className="font-mono">error</code>.</p>
          <div className="space-y-2 max-w-lg">
            <InfoAlert>This budget is locked and cannot be edited until the next billing period.</InfoAlert>
            <InfoAlert variant="warning">This change order has not been approved by the owner yet.</InfoAlert>
            <InfoAlert variant="success">Contract fully executed. All parties have signed.</InfoAlert>
            <InfoAlert variant="error">One or more line items exceed the approved budget.</InfoAlert>
          </div>
        </div>

        <Separator />

        {/* DetailField + DetailFieldGrid */}
        <div className="space-y-3">
          <p className="text-sm font-semibold text-foreground">DetailField + DetailFieldGrid</p>
          <p className="text-xs text-muted-foreground">Label/value pairs for read-only detail views. Wrap in <code className="font-mono">DetailFieldGrid</code> for responsive column layout (<code className="font-mono">cols=2|3|4</code>).</p>
          <DetailFieldGrid cols={3} className="max-w-2xl">
            <DetailField label="Contract Number" value="CO-2026-0041" />
            <DetailField label="Status" value={<StatusBadge status="Approved" />} />
            <DetailField label="Total Value" value="$1,245,000" />
            <DetailField label="Executed Date" value="April 2, 2026" />
            <DetailField label="Owner" value="Vermillion Rise LLC" />
            <DetailField label="Notes" value={null} />
          </DetailFieldGrid>
        </div>

        <Separator />

        {/* DetailActions */}
        <div className="space-y-3">
          <p className="text-sm font-semibold text-foreground">DetailActions</p>
          <p className="text-xs text-muted-foreground">Overflow-only action menu for detail page headers. Uses a vertical 3-dot trigger with actions inside the menu.</p>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 px-4 py-2">
              <span className="text-sm font-medium text-foreground">Change Order #41</span>
              <DetailActions
                onEdit={() => {}}
                onDelete={() => {}}
                onShare={() => {}}
              />
            </div>
            <div className="flex items-center gap-2 px-4 py-2">
              <span className="text-sm font-medium text-foreground">Contract #12</span>
              <DetailActions
                onEdit={() => {}}
                onDelete={() => {}}
                extraActions={[
                  { label: "Duplicate", onClick: () => {} },
                  { label: "Export PDF", onClick: () => {} },
                ]}
              />
            </div>
          </div>
        </div>

        <Separator />

        {/* EditModeActions */}
        <div className="space-y-3">
          <p className="text-sm font-semibold text-foreground">EditModeActions</p>
          <p className="text-xs text-muted-foreground">View/edit toggle with save/cancel. In view mode shows Edit; in edit mode shows Cancel + Save. Click Edit to toggle.</p>
          <div className="flex items-center gap-4">
            <EditModeActions
              isEditing={isEditing}
              onEdit={() => setIsEditing(true)}
              onSave={async () => {
                setIsSaving(true);
                await new Promise((r) => setTimeout(r, 1200));
                setIsSaving(false);
                setIsEditing(false);
              }}
              onCancel={() => setIsEditing(false)}
              isSaving={isSaving}
            />
            <span className="text-xs text-muted-foreground">
              Mode: <code className="font-mono">{isEditing ? "editing" : "view"}</code>
            </span>
          </div>
        </div>

        <Separator />

        {/* SplitButton */}
        <div className="space-y-3">
          <p className="text-sm font-semibold text-foreground">SplitButton</p>
          <p className="text-xs text-muted-foreground">Primary action + secondary actions dropdown. Includes default primary and a soft purple variant.</p>
          <div className="flex items-center gap-4">
            <SplitButton
              label="Save"
              onClick={() => {}}
              actions={[
                { label: "Save & Close", onClick: () => {} },
                { label: "Save as Draft", onClick: () => {} },
                { label: "Discard changes", onClick: () => {}, destructive: true, separator: true },
              ]}
            />
            <SplitButton
              label="Submit"
              variant="soft"
              onClick={() => {}}
              actions={[
                { label: "Submit for review", onClick: () => {} },
                { label: "Submit & notify owner", onClick: () => {} },
              ]}
            />
          </div>
        </div>

        <Separator />

        {/* AttachmentUploadPanel */}
        <div className="space-y-3">
          <p className="text-sm font-semibold text-foreground">AttachmentUploadPanel</p>
          <p className="text-xs text-muted-foreground">
            Reusable upload-and-attach surface with drag/drop, queue, and attached-file list.
            Use for record attachments and document uploads.
          </p>
          <div className="max-w-2xl">
            <AttachmentUploadPanel
              title="Upload and attach file"
              description="Attachments will be a part of this project."
              files={attachmentDemoFiles}
              onUploadFile={handleAttachmentDemoUpload}
            />
          </div>
        </div>

        <Separator />

        {/* ConfirmDeleteDialog */}
        <div className="space-y-3">
          <p className="text-sm font-semibold text-foreground">ConfirmDeleteDialog</p>
          <p className="text-xs text-muted-foreground">Standard destructive confirmation. Pass <code className="font-mono">itemName</code> for auto-generated title, or override with <code className="font-mono">title</code> + <code className="font-mono">description</code>.</p>
          <Button variant="destructive" size="sm" onClick={() => setConfirmDeleteOpen(true)}>
            Delete record
          </Button>
          <ConfirmDeleteDialog
            open={confirmDeleteOpen}
            onOpenChange={setConfirmDeleteOpen}
            itemName="Change Order #41"
            onConfirm={async () => {
              await new Promise((r) => setTimeout(r, 800));
              setConfirmDeleteOpen(false);
            }}
          />
        </div>

        <Separator />

        {/* PageShell tabs */}
        <div className="space-y-3">
          <p className="text-sm font-semibold text-foreground">PageShell tabs integration</p>
          <p className="text-xs text-muted-foreground">Pass a <code className="font-mono">tabs</code> prop to <code className="font-mono">PageShell</code> and the tab bar renders automatically below the header — no manual placement needed.</p>
          <pre className="rounded-md bg-muted p-4 text-xs leading-relaxed text-foreground overflow-x-auto">{`<PageShell
  variant="detail"
  title="Contract #1042"
  tabs={[
    { label: "Overview",    href: "/...", isActive: true },
    { label: "Line Items",  href: "/...", isActive: false },
    { label: "Attachments", href: "/...", isActive: false },
  ]}
>
  ...
</PageShell>`}</pre>
        </div>

      </DesignSection>{/* end section-missing */}
        </div>{/* end main content */}
      </div>{/* end 2-col layout */}
    </PageShell>
  );
}
