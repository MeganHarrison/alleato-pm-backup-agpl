'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// ─── Context ──────────────────────────────────────────────────────────────────

interface TourContextValue {
  currentStep: number;
  totalSteps: number;
  next: () => void;
  dismiss: () => void;
}

const TourContext = React.createContext<TourContextValue>({
  currentStep: 0,
  totalSteps: 0,
  next: () => {},
  dismiss: () => {},
});

export function useTour() {
  return React.useContext(TourContext);
}

// ─── Tour ─────────────────────────────────────────────────────────────────────

export interface TourProps {
  /** TourDialog elements — each is one step. */
  children: React.ReactNode;
  /** Whether the tour is currently running. */
  isActive: boolean;
  /** Called when the last step completes or the user dismisses. */
  onComplete?: () => void;
}

export function Tour({ children, isActive, onComplete }: TourProps) {
  const [currentStep, setCurrentStep] = React.useState(0);

  const steps = React.Children.toArray(children).filter(
    (c): c is React.ReactElement => React.isValidElement(c),
  );
  const totalSteps = steps.length;

  React.useEffect(() => {
    if (!isActive) setCurrentStep(0);
  }, [isActive]);

  const next = React.useCallback(() => {
    if (currentStep >= totalSteps - 1) {
      onComplete?.();
    } else {
      setCurrentStep((s) => s + 1);
    }
  }, [currentStep, totalSteps, onComplete]);

  const dismiss = React.useCallback(() => {
    onComplete?.();
  }, [onComplete]);

  if (!isActive) return null;

  return (
    <TourContext.Provider value={{ currentStep, totalSteps, next, dismiss }}>
      {steps[currentStep]}
    </TourContext.Provider>
  );
}

// ─── Spotlight overlay (SVG mask with cut-out) ────────────────────────────────

function TourSpotlight({ rect }: { rect: DOMRect | null }) {
  const [vw, setVw] = React.useState(0);
  const [vh, setVh] = React.useState(0);

  React.useEffect(() => {
    const update = () => { setVw(window.innerWidth); setVh(window.innerHeight); };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  if (!vw || !vh) return <div className="absolute inset-0 bg-black/50 pointer-events-none" />;

  if (!rect) {
    return <div className="absolute inset-0 bg-black/50 pointer-events-none" />;
  }

  const pad = 8;
  const x = rect.left - pad;
  const y = rect.top - pad;
  const w = rect.width + pad * 2;
  const h = rect.height + pad * 2;
  const r = 8;

  return (
    <svg
      className="absolute inset-0 pointer-events-none"
      width={vw}
      height={vh}
    >
      <defs>
        <mask id="tour-mask">
          <rect width={vw} height={vh} fill="white" />
          <rect x={x} y={y} width={w} height={h} rx={r} ry={r} fill="black" />
        </mask>
      </defs>
      <rect width={vw} height={vh} fill="rgba(0,0,0,0.55)" mask="url(#tour-mask)" />
      {/* Highlight ring around target */}
      <rect
        x={x - 2}
        y={y - 2}
        width={w + 4}
        height={h + 4}
        rx={r + 2}
        ry={r + 2}
        fill="none"
        stroke="hsl(var(--primary))"
        strokeWidth={2}
        strokeOpacity={0.7}
      />
    </svg>
  );
}

// ─── TourDialog ───────────────────────────────────────────────────────────────

export interface TourDialogProps {
  /** CSS selector for the element to spotlight, e.g. "[data-tour='my-feature']" */
  target?: string;
  children: React.ReactNode;
  className?: string;
}

export function TourDialog({ target, children, className }: TourDialogProps) {
  const [rect, setRect] = React.useState<DOMRect | null>(null);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
    if (!target) return;
    const el = document.querySelector(target);
    if (el) {
      setRect(el.getBoundingClientRect());
      el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [target]);

  // Position dialog below (or above if near bottom of viewport) the spotlight target
  const dialogStyle = React.useMemo((): React.CSSProperties => {
    if (!rect) return { position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };

    const dialogW = 320;
    const gap = 14;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let top = rect.bottom + gap;
    let left = rect.left;

    // Flip above if overflows bottom
    if (top + 220 > vh - 16) top = rect.top - 220 - gap;
    // Clamp horizontal
    if (left + dialogW > vw - 8) left = vw - dialogW - 8;
    if (left < 8) left = 8;

    return { position: 'fixed', top, left };
  }, [rect]);

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-50">
      <TourSpotlight rect={rect} />
      <div
        className={cn(
          'absolute z-10 w-80 overflow-hidden rounded-xl border border-border bg-card shadow-lg',
          className,
        )}
        style={dialogStyle}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}

// ─── TourDialog sub-components ────────────────────────────────────────────────

export function TourDialogHeader({ children, className }: React.HTMLAttributes<HTMLDivElement>) {
  const { currentStep, totalSteps } = useTour();
  return (
    <div className={cn('px-4 pt-4 pb-2', className)}>
      {totalSteps > 1 && (
        <p className="mb-1 text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
          Step {currentStep + 1} of {totalSteps}
        </p>
      )}
      <p className="text-sm font-semibold leading-snug text-foreground">{children}</p>
    </div>
  );
}

export function TourDialogBody({ children, className }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('px-4 pb-3 text-sm leading-relaxed text-muted-foreground', className)}>
      {children}
    </div>
  );
}

export function TourDialogFooter({ children, className }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('flex items-center justify-between gap-2 border-t border-border px-4 py-3', className)}>
      {children}
    </div>
  );
}

export function TourDialogActions({ children, className }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex items-center gap-2', className)}>{children}</div>;
}

// ─── Action buttons ───────────────────────────────────────────────────────────

export function TourNextButton({ children, className, ...props }: React.ComponentProps<typeof Button>) {
  const { next, currentStep, totalSteps } = useTour();
  const isLast = currentStep >= totalSteps - 1;
  return (
    <Button size="sm" onClick={next} className={className} {...props}>
      {children ?? (isLast ? 'Done' : 'Next →')}
    </Button>
  );
}

export function TourDismissButton({ children, className, ...props }: React.ComponentProps<typeof Button>) {
  const { dismiss } = useTour();
  return (
    <Button variant="ghost" size="sm" onClick={dismiss} className={cn('text-muted-foreground', className)} {...props}>
      {children ?? 'Dismiss'}
    </Button>
  );
}

export function TourDialogCloseButton({ children, className, ...props }: React.ComponentProps<typeof Button>) {
  const { dismiss } = useTour();
  return (
    <Button variant="ghost" size="sm" onClick={dismiss} className={className} {...props}>
      {children ?? '✕'}
    </Button>
  );
}
