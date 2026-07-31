"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Bot,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Lightbulb,
  Sparkles,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { PageShell } from "@/components/layout";
import { SectionRuleHeading } from "@/components/layout/spacing";
import { cn } from "@/lib/utils";

type VariantKey = "annotated" | "walkthrough" | "explain";
type FocusTreatment = "soft-fill" | "focus-wash" | "raised";

const VARIANTS: Array<{ key: VariantKey; name: string }> = [
  { key: "annotated", name: "Annotated screen" },
  { key: "walkthrough", name: "Guided walkthrough" },
  { key: "explain", name: "Ask as you work" },
];

const FIELD_DETAILS = {
  contractName: {
    title: "Contract name",
    purpose: "A clear, durable label for the agreement your team will recognize in reports and change orders.",
    annotatedDescription: "Use the owner, scope, and agreement type so the base contract remains easy to distinguish from later amendments and change orders.",
    scenarios: ["Distinguish the base agreement from amendments.", "Make the owner and scope obvious at a glance."],
    example: "Northside Medical Office — Base Contract",
  },
  status: {
    title: "Status",
    purpose: "Controls where this contract is in its lifecycle and signals whether the agreement is ready for downstream work.",
    annotatedDescription: "Keep the contract in Draft while terms or scope can still change. Move it to Pending Approval when it is ready for review, then mark it Executed only after every required signature is complete. Use Cancelled when negotiations close without an agreement.",
    scenarios: ["Keep it Draft while terms are still changing.", "Move to Executed only after every required signature is complete.", "Use Cancelled if negotiations close without an agreement."],
    example: "Draft → Pending Approval → Executed",
  },
  executedDate: {
    title: "Executed date",
    purpose: "Records when the agreement became legally active, rather than when someone started entering it.",
    annotatedDescription: "Enter the final signature date once the agreement is executed. Leave this blank while the contract is still in Draft or Pending Approval.",
    scenarios: ["Enter the final signature date.", "Leave empty while the contract is still pending approval."],
    example: "Mar 18, 2026",
  },
  retainage: {
    title: "Default retainage",
    purpose: "The percentage withheld from payment applications until agreed work is complete.",
    annotatedDescription: "Use the percentage agreed in the prime contract. Set it to 0% only when the agreement has no retainage, and enter a percentage such as 10%, not a decimal or dollar amount.",
    scenarios: ["Use the percentage agreed in the prime contract.", "Set to 0% only when the contract has no retainage."],
    example: "10% — not 0.10 or 10,000",
  },
} as const;

type FieldKey = keyof typeof FIELD_DETAILS;

const WALKTHROUGH: FieldKey[] = ["contractName", "status", "executedDate", "retainage"];

const SELECTED_FIELD_TREATMENTS: Record<FocusTreatment, string> = {
  "soft-fill": "-mx-3 -my-3 rounded-lg bg-muted/70 px-3 py-3",
  "focus-wash": "-mx-3 -my-3 rounded-lg bg-muted/50 px-3 py-3",
  raised: "-mx-3 -my-3 rounded-lg bg-card px-3 py-3 shadow-xs",
};

export function ContextualHelpPrototype() {
  const searchParams = useSearchParams();
  const requested = searchParams.get("variant");
  const variant: VariantKey = VARIANTS.some((item) => item.key === requested)
    ? (requested as VariantKey)
    : "annotated";
  const requestedFocus = searchParams.get("focus");
  const focusTreatment: FocusTreatment = requestedFocus === "focus-wash" || requestedFocus === "raised"
    ? requestedFocus
    : "soft-fill";

  return (
    <PageShell
      variant="detailWide"
      title=""
      showHeader={false}
    >
      {variant === "annotated" ? <AnnotatedVariant focusTreatment={focusTreatment} /> : null}
      {variant === "walkthrough" ? <WalkthroughVariant /> : null}
      {variant === "explain" ? <ExplainVariant /> : null}
      <PrototypeSwitcher current={variant} focusTreatment={focusTreatment} />
    </PageShell>
  );
}

function AnnotatedVariant({ focusTreatment }: { focusTreatment: FocusTreatment }) {
  const [selected, setSelected] = useState<FieldKey>("status");
  const detail = FIELD_DETAILS[selected];
  const selectedIndex = WALKTHROUGH.indexOf(selected);
  const moveToField = (nextIndex: number) => {
    if (nextIndex < 0 || nextIndex >= WALKTHROUGH.length) return;
    setSelected(WALKTHROUGH[nextIndex]!);
  };

  return (
    <div className="mx-auto w-full max-w-screen-2xl pb-24 pt-4">
      <div className="mt-8 grid gap-8 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <ContractScreen selected={selected} onSelect={setSelected} hotspots focusTreatment={focusTreatment} />
        <aside className="flex min-h-80 flex-col rounded-[20px] bg-muted/50 p-6 shadow-sm">
          <div className="space-y-3">
            <p className="text-base font-semibold text-foreground">{detail.title}</p>
            <p className="text-sm leading-6 text-muted-foreground">{detail.annotatedDescription}</p>
          </div>
          <div className="mt-auto flex items-center justify-between pt-8">
            <Button
              aria-label="Previous field"
              disabled={selectedIndex === 0}
              onClick={() => moveToField(selectedIndex - 1)}
              size="icon-sm"
              variant="ghost"
            >
              <ArrowLeft className="size-4" />
            </Button>
            <p className="text-xs text-muted-foreground">{selectedIndex + 1} of {WALKTHROUGH.length}</p>
            <Button
              aria-label="Next field"
              disabled={selectedIndex === WALKTHROUGH.length - 1}
              onClick={() => moveToField(selectedIndex + 1)}
              size="icon-sm"
              variant="ghost"
            >
              <ArrowRight className="size-4" />
            </Button>
          </div>
        </aside>
      </div>
    </div>
  );
}

function WalkthroughVariant() {
  const [step, setStep] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const transitionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const field = WALKTHROUGH[step];
  const detail = FIELD_DETAILS[field];

  useEffect(() => () => {
    if (transitionTimer.current) clearTimeout(transitionTimer.current);
  }, []);

  const moveToStep = (nextStep: number) => {
    if (isTransitioning || nextStep < 0 || nextStep >= WALKTHROUGH.length) return;
    setIsTransitioning(true);
    transitionTimer.current = setTimeout(() => {
      setStep(nextStep);
      setIsTransitioning(false);
    }, 160);
  };

  return (
    <div className="mx-auto w-full max-w-screen-2xl pb-24 pt-4">
      <PrototypeHeading
        eyebrow="Variant B"
        title="Walk me through creating this contract"
        description="A permanent, deliberate tour for a task someone may only do a few times a year."
      />
      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_19rem]">
        <div
          key={`screen-${step}`}
          className={cn(
            "relative motion-reduce:animate-none",
            isTransitioning
              ? "animate-out fade-out-0 duration-150 ease-in"
              : "animate-in fade-in-0 slide-in-from-left-1 duration-300 ease-out",
          )}
        >
          <ContractScreen selected={field} walkthrough />
        </div>
        {/* Prototype-only coaching module: a localized, bounded task guide. */}
        <aside
          key={`guide-${step}`}
          className={cn(
            "flex min-h-96 flex-col justify-between rounded-[20px] border border-border bg-card p-6 shadow-sm motion-reduce:animate-none",
            isTransitioning
              ? "animate-out fade-out-0 slide-out-to-right-1 duration-150 ease-in"
              : "animate-in fade-in-0 slide-in-from-right-1 duration-300 ease-out",
          )}
        >
          <div className="transition-opacity duration-200">
            <p className="text-sm font-medium text-primary">Step {step + 1} of {WALKTHROUGH.length}</p>
            <p className="mt-3 text-xl font-semibold tracking-tight text-foreground">Start with {detail.title.toLowerCase()}</p>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">{detail.purpose}</p>
            <p className="mt-6 text-sm font-medium text-foreground">{detail.example}</p>
          </div>
          <div className="space-y-3">
            <div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary transition-all" style={{ width: `${((step + 1) / WALKTHROUGH.length) * 100}%` }} /></div>
            <div className="flex justify-between gap-3">
              <Button variant="ghost" size="sm" disabled={step === 0 || isTransitioning} onClick={() => moveToStep(step - 1)}><ArrowLeft className="size-4" />Back</Button>
              <Button size="sm" disabled={isTransitioning || step === WALKTHROUGH.length - 1} onClick={() => moveToStep(step + 1)}>{step === WALKTHROUGH.length - 1 ? "Finished" : "Next"}<ArrowRight className="size-4" /></Button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function ExplainVariant() {
  const [selected, setSelected] = useState<FieldKey>("retainage");
  const [advanced, setAdvanced] = useState(false);
  const detail = FIELD_DETAILS[selected];
  return (
    <div className="mx-auto w-full max-w-screen-2xl pb-24 pt-4">
      <PrototypeHeading
        eyebrow="Variant C"
        title="Keep help in the workflow, on demand"
        description="A small explain affordance on each field opens contextual guidance without turning the page into a tutorial."
      />
      <div className="mt-8 grid gap-8 xl:grid-cols-[minmax(0,1fr)_25rem]">
        <ContractScreen selected={selected} onSelect={setSelected} explain />
        <aside className="space-y-6 border-l border-border pl-6">
          <div className="flex items-start justify-between gap-4"><div><p className="text-sm font-medium text-primary">Explain this field</p><p className="mt-1 text-xl font-semibold tracking-tight text-foreground">Why does {detail.title.toLowerCase()} exist?</p></div><Bot className="size-5 text-primary" /></div>
          <p className="text-sm leading-6 text-muted-foreground">{detail.purpose}</p>
          <InfoSection label="Practical guidance"><ul className="space-y-3">{detail.scenarios.map((item) => <li key={item} className="flex gap-2"><Lightbulb className="mt-0.5 size-4 shrink-0 text-primary" />{item}</li>)}</ul></InfoSection>
          <button type="button" className="flex items-center gap-2 text-sm font-medium text-foreground" onClick={() => setAdvanced((current) => !current)}><span className={cn("flex size-4 items-center justify-center rounded-full border border-border text-[10px]", advanced && "border-primary bg-primary text-primary-foreground")}>{advanced ? "✓" : ""}</span>Show advanced context</button>
          {advanced ? <div className="space-y-3 border-t border-border pt-5 text-sm leading-6 text-muted-foreground"><p><span className="font-medium text-foreground">Downstream effect:</span> This field is preserved on the contract record and reflected in payment-application calculations.</p><p><span className="font-medium text-foreground">Source confidence:</span> AI-generated guidance must cite the field definition and product policy it used.</p></div> : null}
        </aside>
      </div>
    </div>
  );
}

function ContractScreen({ selected, onSelect, hotspots = false, walkthrough = false, explain = false, focusTreatment = "soft-fill" }: { selected: FieldKey; onSelect?: (field: FieldKey) => void; hotspots?: boolean; walkthrough?: boolean; explain?: boolean; focusTreatment?: FocusTreatment }) {
  const fields: Array<{ key: FieldKey; label: string; value: string; helper?: string }> = [
    { key: "contractName", label: "Contract name", value: "Northside Medical Office — Base Contract" },
    { key: "status", label: "Status", value: "Draft" },
    { key: "executedDate", label: "Executed date", value: "Not executed yet", helper: "Required once the agreement is executed." },
    { key: "retainage", label: "Default retainage", value: "10%", helper: "Applied to new payment applications unless changed." },
  ];
  return (
    <section aria-label="Prime Contract form example" className="bg-card px-5 py-6 sm:px-8">
      <div className="flex items-center justify-between border-b border-border pb-5"><div><p className="text-sm text-muted-foreground">Prime Contracts</p><p className="mt-1 text-xl font-semibold tracking-tight text-foreground">Create Prime Contract</p></div><Button size="sm">Save draft</Button></div>
      <div className="mt-7 grid gap-x-6 gap-y-7 sm:grid-cols-2">
        {fields.map((field, index) => {
          const isSelected = selected === field.key;
          return <div key={field.key} className={cn(
            "relative transition-[background-color,box-shadow,opacity] duration-150 ease-out",
            isSelected && SELECTED_FIELD_TREATMENTS[focusTreatment],
            focusTreatment === "focus-wash" && !isSelected && "opacity-60",
          )}>
            <div className="mb-2 flex items-center justify-between gap-3"><label className="text-sm font-medium">{field.label}</label>{hotspots ? <Hotspot number={index + 1} onClick={() => onSelect?.(field.key)} /> : null}{explain ? <button type="button" className="flex items-center gap-1 text-xs font-medium text-primary" onClick={() => onSelect?.(field.key)}><Sparkles className="size-3" />Explain</button> : null}</div>
            <button type="button" disabled={!onSelect} onClick={() => onSelect?.(field.key)} className={cn("w-full rounded-md border border-input bg-background px-3 py-2.5 text-left text-sm", onSelect && "hover:border-primary")}>{field.value}</button>
            {field.helper ? <p className="mt-2 text-xs leading-5 text-muted-foreground">{field.helper}</p> : null}
          </div>;
        })}
      </div>
      <div className="mt-10 border-t border-border pt-6"><p className="text-sm font-medium">Schedule of Values</p><p className="mt-1 text-sm text-muted-foreground">Add line items after the contract details are established.</p></div>
      {walkthrough ? <p className="mt-6 flex items-center gap-2 text-xs text-muted-foreground"><CircleHelp className="size-4" />The highlighted field is the current walkthrough step.</p> : null}
    </section>
  );
}

function Hotspot({ number, onClick }: { number: number; onClick: () => void }) {
  return <button type="button" aria-label={`Explain field ${number}`} onClick={onClick} className="flex size-6 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">{number}</button>;
}

function InfoSection({ label, children }: { label: string; children: React.ReactNode }) {
  return <section className="space-y-3 text-sm leading-6 text-muted-foreground"><SectionRuleHeading label={label} className="mb-0" />{children}</section>;
}

function PrototypeHeading({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return <header className="max-w-3xl"><p className="text-sm font-semibold text-primary">{eyebrow}</p><h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">{title}</h1><p className="mt-3 text-base leading-7 text-muted-foreground">{description}</p></header>;
}

function PrototypeSwitcher({ current, focusTreatment }: { current: VariantKey; focusTreatment: FocusTreatment }) {
  const router = useRouter();
  const pathname = usePathname();
  const currentIndex = VARIANTS.findIndex((variant) => variant.key === current);
  const setVariant = useCallback((index: number) => {
    const next = VARIANTS[(index + VARIANTS.length) % VARIANTS.length];
    router.replace(`${pathname}?variant=${next.key}&focus=${focusTreatment}`, { scroll: false });
  }, [focusTreatment, pathname, router]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.matches("input, textarea, [contenteditable='true']")) return;
      if (event.key === "ArrowLeft") setVariant(currentIndex - 1);
      if (event.key === "ArrowRight") setVariant(currentIndex + 1);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentIndex, setVariant]);

  if (process.env.NODE_ENV === "production") return null;
  const currentVariant = VARIANTS[currentIndex];
  return <div className="fixed inset-x-0 bottom-5 z-50 flex justify-center px-4"><div className="flex items-center gap-1 rounded-full border border-border bg-foreground px-2 py-2 text-background shadow-lg"><button type="button" aria-label="Previous prototype variant" className="rounded-full p-2 hover:bg-background/15" onClick={() => setVariant(currentIndex - 1)}><ChevronLeft className="size-4" /></button><span className="min-w-44 px-2 text-center text-xs font-medium">{currentVariant.key.toUpperCase()} — {currentVariant.name}</span><button type="button" aria-label="Next prototype variant" className="rounded-full p-2 hover:bg-background/15" onClick={() => setVariant(currentIndex + 1)}><ChevronRight className="size-4" /></button></div></div>;
}
