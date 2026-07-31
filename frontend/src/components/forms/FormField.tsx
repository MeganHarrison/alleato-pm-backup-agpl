"use client";

import * as React from "react";
import { HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/**
 * Shared base props for all form field components.
 * Import this and extend it to avoid repeating error/hint/required/fullWidth/disabled.
 */
export interface FormFieldBaseProps {
  error?: string;
  hint?: string;
  required?: boolean;
  fullWidth?: boolean;
  disabled?: boolean;
}

interface FormFieldProps {
  label: React.ReactNode;
  children: React.ReactNode;
  error?: string;
  hint?: string;
  /** Optional help text shown in a tooltip on an info icon next to the label. */
  labelTooltip?: React.ReactNode;
  required?: boolean;
  className?: string;
  fullWidth?: boolean;
}

/** Renders the field label with optional required marker and help tooltip. */
function LabelContent({
  label,
  required,
  labelTooltip,
}: {
  label: React.ReactNode;
  required: boolean;
  labelTooltip?: React.ReactNode;
}) {
  return (
    <>
      {label}
      {required && <span className="ml-1 text-destructive">*</span>}
      {labelTooltip && (
        <Tooltip>
          <TooltipTrigger
            type="button"
            className="ml-1 inline-flex align-middle text-muted-foreground transition-colors hover:text-foreground"
            aria-label="More information"
          >
            <HelpCircle className="size-3.5" />
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">{labelTooltip}</TooltipContent>
        </Tooltip>
      )}
    </>
  );
}

// ── Layout context ─────────────────────────────────────────────────────────

export type FormFieldLayout = "stacked" | "horizontal";
const FormLayoutContext = React.createContext<FormFieldLayout>("stacked");

export function useFormLayout(): FormFieldLayout {
  return React.useContext(FormLayoutContext);
}

export function FormLayoutProvider({
  layout,
  children,
}: {
  layout: FormFieldLayout;
  children: React.ReactNode;
}) {
  return (
    <FormLayoutContext.Provider value={layout}>
      {children}
    </FormLayoutContext.Provider>
  );
}

// ── Field id context ───────────────────────────────────────────────────────

const FormFieldContext = React.createContext<string | undefined>(undefined);

/** Returns the auto-generated input id from the nearest FormField. */
export function useFormFieldId(): string | undefined {
  return React.useContext(FormFieldContext);
}

// ── FormField ──────────────────────────────────────────────────────────────

export function FormField({
  label,
  children,
  error,
  hint,
  labelTooltip,
  required = false,
  className,
  fullWidth = false,
}: FormFieldProps) {
  const inputId = React.useId();
  const layout = useFormLayout();

  if (layout === "horizontal" && !fullWidth) {
    return (
      <FormFieldContext.Provider value={inputId}>
        <div className={cn("flex flex-col gap-y-1 sm:flex-row sm:items-start sm:gap-x-2", className)}>
          <label
            htmlFor={inputId}
            className="pt-0 text-[13px] font-medium text-foreground sm:w-40 sm:shrink-0 sm:pt-2"
          >
            <LabelContent label={label} required={required} labelTooltip={labelTooltip} />
          </label>
          <div className="flex-1 min-w-0">
            {hint && !error && (
              <p className="mb-1.5 text-sm text-muted-foreground">{hint}</p>
            )}
            {children}
            {error && (
              <p className="mt-1.5 text-sm text-destructive" data-field-error="">
                {error}
              </p>
            )}
          </div>
        </div>
      </FormFieldContext.Provider>
    );
  }

  return (
    <FormFieldContext.Provider value={inputId}>
      <div className={cn(fullWidth ? "sm:col-span-2" : "", className)}>
        <label htmlFor={inputId} className="block text-sm font-medium text-foreground">
          <LabelContent label={label} required={required} labelTooltip={labelTooltip} />
        </label>
        {hint && !error && <p className="mt-1 text-sm text-muted-foreground">{hint}</p>}
        <div className="mt-1">
          {children}
          {error && <p className="mt-2 text-sm text-destructive" data-field-error="">{error}</p>}
        </div>
      </div>
    </FormFieldContext.Provider>
  );
}
