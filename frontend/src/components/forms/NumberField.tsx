"use client";

import * as React from "react";
import { NumberInput } from "@/components/ui/number-input";
import { FormField } from "./FormField";
import { cn } from "@/lib/utils";

interface NumberFieldProps extends Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "type" | "onChange"
> {
  label: string;
  value?: number;
  onChange?: (value: number | undefined) => void;
  error?: string;
  hint?: string;
  required?: boolean;
  fullWidth?: boolean;
  prefix?: string;
  suffix?: string;
}

export function NumberField({
  label,
  value,
  onChange,
  error,
  hint,
  required = false,
  fullWidth = false,
  prefix,
  suffix,
  className,
  ...inputProps
}: NumberFieldProps) {
  const inputId =
    inputProps.id ??
    `number-field-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val === "") {
      onChange?.(undefined);
    } else {
      const numVal = parseFloat(val);
      if (!isNaN(numVal)) {
        onChange?.(numVal);
      }
    }
  };

  return (
    <FormField
      label={label}
      error={error}
      hint={hint}
      required={required}
      fullWidth={fullWidth}
    >
      <div className="relative">
        {prefix && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
            {prefix}
          </span>
        )}
        <NumberInput
          value={value ?? ""}
          onChange={handleChange}
          clearZeroOnFocus
          className={cn(
            error && "border-destructive",
            prefix && "pl-8",
            suffix && "pr-12",
            className,
          )}
          aria-invalid={!!error}
          aria-describedby={error ? `${inputId}-error` : undefined}
          id={inputId}
          aria-label={label}
          {...inputProps}
        />
        {suffix && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
            {suffix}
          </span>
        )}
      </div>
    </FormField>
  );
}
