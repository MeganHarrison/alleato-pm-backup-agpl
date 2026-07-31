"use client";

import * as React from "react";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { wordStartFilter } from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { FormField } from "./FormField";

export interface SearchableSelectOption {
  value: string;
  label: string;
  description?: string;
}

interface SearchableSelectProps {
  label?: string;
  options: SearchableSelectOption[];
  value?: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  triggerClassName?: string;
  addButton?: React.ReactNode;
  onCreateNew?: () => void;
  createNewLabel?: string;
  showIndicator?: boolean;
  triggerVariant?: "default" | "outline" | "secondary" | "ghost" | "link" | "destructive";
  triggerTestId?: string;
  optionTestIdPrefix?: string;
  searchInputTestId?: string;
}

export function SearchableSelect({
  label,
  options,
  value,
  onValueChange,
  placeholder = "Select...",
  searchPlaceholder = "Search",
  emptyMessage = "No results found.",
  disabled = false,
  required = false,
  className,
  triggerClassName,
  addButton,
  onCreateNew,
  createNewLabel = "+ Create New",
  showIndicator = true,
  triggerVariant = "outline",
  triggerTestId,
  optionTestIdPrefix,
  searchInputTestId,
}: SearchableSelectProps) {
  const [open, setOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");

  const selectedOption = options.find((opt) => opt.value === value);

  const filteredOptions = React.useMemo(() => {
    if (!searchQuery) return options;
    return options.filter(
      (opt) =>
        wordStartFilter(
          opt.label,
          searchQuery,
          opt.description ? [opt.description] : [],
        ) === 1,
    );
  }, [options, searchQuery]);

  const handleSelect = (selectedValue: string) => {
    onValueChange(selectedValue);
    setOpen(false);
    setSearchQuery("");
  };

  const control = (
    <div className={cn("min-w-0", !label && className)}>
      <div className="flex gap-2 min-w-0">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant={triggerVariant}
              role="combobox"
              aria-expanded={open}
              className={cn(
                "flex-1 justify-between font-normal min-w-0",
                triggerClassName,
              )}
              disabled={disabled}
              data-testid={triggerTestId}
              {...(!value && { "data-placeholder-style": "" })}
            >
              <span className="truncate">
                {selectedOption?.label || placeholder}
              </span>
              {showIndicator ? (
                <ChevronsUpDown className="shrink-0 opacity-50" />
              ) : null}
            </Button>
          </PopoverTrigger>
          <PopoverContent
            className="w-[var(--radix-popover-trigger-width)] p-0"
            align="start"
          >
            <div className="flex flex-col">
              {/* Search Input */}
              <div className="flex items-center border-b px-4 py-2">
                <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                <Input
                  placeholder={searchPlaceholder}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-8 border-0 p-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                  data-testid={searchInputTestId}
                />
              </div>

              {/* Options List */}
              <div className="max-h-72 overflow-y-auto">
                {filteredOptions.length === 0 ? (
                  <div className="py-6 text-center text-sm text-muted-foreground">
                    {emptyMessage}
                  </div>
                ) : (
                  filteredOptions.map((option) => (
                    <div
                      key={option.value}
                      className={cn(
                        "relative flex cursor-pointer select-none items-center px-4 py-2 text-sm hover:bg-accent hover:text-accent-foreground",
                        value === option.value && "bg-accent",
                      )}
                      onClick={() => handleSelect(option.value)}
                      data-testid={
                        optionTestIdPrefix
                          ? `${optionTestIdPrefix}-${option.value}`
                          : undefined
                      }
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          value === option.value ? "opacity-100" : "opacity-0",
                        )}
                      />
                      <span className="truncate">{option.label}</span>
                    </div>
                  ))
                )}
              </div>

              {/* Create New Button */}
              {onCreateNew && (
                <div className="border-t p-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start text-sm font-normal text-primary hover:text-primary hover:bg-primary/10"
                    onClick={() => {
                      setOpen(false);
                      onCreateNew();
                    }}
                  >
                    {createNewLabel}
                  </Button>
                </div>
              )}
            </div>
          </PopoverContent>
        </Popover>
        {addButton && <div className="flex-shrink-0">{addButton}</div>}
      </div>
    </div>
  );

  if (!label) {
    return control;
  }

  return (
    <FormField label={label} required={required} className={className}>
      {control}
    </FormField>
  );
}
