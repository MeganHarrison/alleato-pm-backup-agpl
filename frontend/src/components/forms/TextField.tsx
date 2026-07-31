"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { FormField } from "./FormField";
import { cn } from "@/lib/utils";

interface TextFieldProps extends Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "type"
> {
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  fullWidth?: boolean;
}

export function TextField({
  label,
  error,
  hint,
  required = false,
  fullWidth = false,
  className,
  ...inputProps
}: TextFieldProps) {
  const inputId =
    inputProps.id ??
    `text-field-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

  return (
    <FormField
      label={label}
      error={error}
      hint={hint}
      required={required}
      fullWidth={fullWidth}
    >
      <Input
        type="text"
        className={cn(error && "border-destructive", className)}
        aria-invalid={!!error}
        aria-describedby={error ? `${inputId}-error` : undefined}
        id={inputId}
        aria-label={label}
        {...inputProps}
      />
    </FormField>
  );
}
