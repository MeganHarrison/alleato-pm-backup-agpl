"use client";

import * as React from "react";
import type { ReactElement } from "react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";

export type InlineSelectOption = {
  value: string;
  label: string;
};

export function InlineSelectEditor({
  value,
  options,
  placeholder = "Select value",
  onChange,
  onCommit,
  onCancel,
  searchable = false,
}: {
  value: string;
  options: InlineSelectOption[];
  placeholder?: string;
  onChange: (value: string) => void;
  onCommit: (value?: string) => void;
  onCancel?: () => void;
  searchable?: boolean;
}): ReactElement {
  const [search, setSearch] = React.useState("");

  if (searchable) {
    const selectedOption = options.find((option) => option.value === value);
    return (
      <Popover
        open
        onOpenChange={(open) => {
          if (!open) onCancel?.();
        }}
      >
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 px-0"
            data-row-interactive="true"
            aria-label={placeholder}
          >
            {selectedOption?.label ?? placeholder}
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-60 p-0"
          align="start"
          onOpenAutoFocus={(event) => event.preventDefault()}
        >
          <Command>
            <CommandInput
              autoFocus
              placeholder={placeholder}
              value={search}
              onValueChange={setSearch}
            />
            <CommandList className="max-h-48 overflow-y-auto">
              <CommandEmpty>No matching options.</CommandEmpty>
              <CommandGroup>
                {options.map((option) => (
                  <CommandItem
                    key={option.value}
                    value={option.label}
                    onSelect={() => {
                      onChange(option.value);
                      onCommit(option.value);
                    }}
                  >
                    {option.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <Select
      value={value}
      onValueChange={(nextValue) => {
        onChange(nextValue);
        window.requestAnimationFrame(() => onCommit(nextValue));
      }}
    >
      <SelectTrigger
        size="sm"
        variant="inline"
        className="h-8 px-0"
        data-row-interactive="true"
        aria-label={placeholder}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent align="start">
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
