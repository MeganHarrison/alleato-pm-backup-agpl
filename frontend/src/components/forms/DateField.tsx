"use client";

import * as React from "react";
import { format, isValid, parse } from "date-fns";
import { Calendar as CalendarIcon, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { FormField } from "./FormField";
import type { FormFieldBaseProps } from "./FormField";

const DATE_FORMATS = [
  "MM/dd/yyyy",
  "M/d/yyyy",
  "MM-dd-yyyy",
  "M-d-yyyy",
  "yyyy-MM-dd",
  "MMM d, yyyy",
  "MMMM d, yyyy",
];

function parseInputDate(input: string): Date | undefined {
  for (const fmt of DATE_FORMATS) {
    const parsed = parse(input, fmt, new Date());
    if (isValid(parsed) && parsed.getFullYear() > 1900) return parsed;
  }
  return undefined;
}

interface DateFieldProps extends FormFieldBaseProps {
  label: string;
  /** Keep the label accessible (aria-label) but visually hide it — for
   * compact grid layouts where the column header already conveys meaning. */
  hideLabel?: boolean;
  value?: Date;
  onChange?: (date: Date | undefined) => void;
  className?: string;
  placeholder?: string;
  labelTooltip?: string;
}

export function DateField({
  label,
  hideLabel = false,
  value,
  onChange,
  error,
  hint,
  required = false,
  fullWidth = false,
  className,
  disabled = false,
  placeholder = "MM/DD/YYYY",
  labelTooltip,
}: DateFieldProps) {
  const triggerId = `date-field-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

  const [inputValue, setInputValue] = React.useState(
    value ? format(value, "MM/dd/yyyy") : "",
  );
  const [open, setOpen] = React.useState(false);

  // Sync input when value changes externally (e.g. form reset)
  React.useEffect(() => {
    setInputValue(value ? format(value, "MM/dd/yyyy") : "");
  }, [value]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setInputValue(raw);
    if (raw === "") {
      onChange?.(undefined);
    } else {
      const parsed = parseInputDate(raw);
      if (parsed) onChange?.(parsed);
    }
  };

  const handleCalendarSelect = (date: Date | undefined) => {
    onChange?.(date);
    setInputValue(date ? format(date, "MM/dd/yyyy") : "");
    setOpen(false);
  };

  return (
    <FormField
      label={
        hideLabel ? (
          <span className="sr-only">{label}</span>
        ) : labelTooltip ? (
          <span className="inline-flex items-center gap-1">
            {label}
            <Tooltip>
              <TooltipTrigger asChild>
                <span
                  className="inline-flex text-muted-foreground"
                  aria-label={`${label} help`}
                >
                  <HelpCircle className="size-3.5" />
                </span>
              </TooltipTrigger>
              <TooltipContent>
                <p>{labelTooltip}</p>
              </TooltipContent>
            </Tooltip>
          </span>
        ) : (
          label
        )
      }
      error={error}
      hint={hint}
      required={required}
      fullWidth={fullWidth}
    >
      <div className={cn("flex gap-1", className)} id={triggerId}>
        <Input
          value={inputValue}
          onChange={handleInputChange}
          placeholder={placeholder}
          disabled={disabled}
          aria-label={label}
          className={cn(error && "border-destructive")}
        />
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              disabled={disabled}
              aria-label={`Open calendar for ${label}`}
              className="size-11 shrink-0 xl:size-9"
            >
              <CalendarIcon />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <Calendar
              mode="single"
              selected={value}
              onSelect={handleCalendarSelect}
              initialFocus
            />
          </PopoverContent>
        </Popover>
      </div>
    </FormField>
  );
}
