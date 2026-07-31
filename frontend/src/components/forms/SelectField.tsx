"use client";

import * as React from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FormField } from "./FormField";
import type { FormFieldBaseProps } from "./FormField";
import { cn } from "@/lib/utils";

interface SelectOption {
  value: string;
  label: string;
}

interface SelectFieldProps extends FormFieldBaseProps {
  label: string;
  /** Keep the label accessible (aria-label) but visually hide it — for
   * compact grid layouts where the column header already conveys meaning. */
  hideLabel?: boolean;
  options: SelectOption[];
  value?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  className?: string;
  dataTestId?: string;
  /** Help text shown in a tooltip on an info icon next to the label. */
  labelTooltip?: React.ReactNode;
}

export function SelectField({
  label,
  hideLabel = false,
  options,
  value,
  onValueChange,
  placeholder = "Select an option",
  error,
  hint,
  required = false,
  fullWidth = false,
  className,
  disabled = false,
  dataTestId,
  labelTooltip,
}: SelectFieldProps) {
  const triggerId = `select-field-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

  return (
    <FormField
      label={hideLabel ? <span className="sr-only">{label}</span> : label}
      error={error}
      hint={hint}
      labelTooltip={labelTooltip}
      required={required}
      fullWidth={fullWidth}
    >
      <Select value={value} onValueChange={onValueChange} disabled={disabled}>
        <SelectTrigger
          id={triggerId}
          aria-label={label}
          className={cn("w-full", error && "border-destructive", className)}
          aria-invalid={!!error}
          data-testid={dataTestId}
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FormField>
  );
}
