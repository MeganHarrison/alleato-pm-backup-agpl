"use client";

import * as React from "react";
import { Check, ChevronDown, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
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
import type { ContractOption } from "./types";

interface ContractComboboxProps {
  value: string;
  onChange: (value: string) => void;
  contracts: ContractOption[];
  disabled?: boolean;
}

export function ContractCombobox({
  value,
  onChange,
  contracts,
  disabled = false,
}: ContractComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const contractListId = React.useId();
  const selected = contracts.find((c) => c.id === value);

  const filtered = React.useMemo(() => {
    if (!search.trim()) return contracts;
    const q = search.toLowerCase();
    return contracts.filter((c) => c.label.toLowerCase().includes(q));
  }, [contracts, search]);

  const poContracts = filtered.filter((c) => c.type === "purchase_order");
  const subContracts = filtered.filter((c) => c.type === "subcontract");

  return (
    <Popover open={disabled ? false : open} onOpenChange={disabled ? undefined : setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-controls={contractListId}
          aria-label="Select contract"
          disabled={disabled}
          className={cn(
            "flex h-9 w-full min-w-0 items-center justify-between overflow-hidden px-3 py-2 text-sm font-normal",
            !selected && "text-muted-foreground",
          )}
        >
          <span className="min-w-0 truncate text-left">
            {selected ? selected.label : "Select commitment..."}
          </span>
          <ChevronDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[350px] p-0" align="start" sideOffset={0}>
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search commitments..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandList id={contractListId} className="max-h-[200px]">
            {selected && (
              <CommandGroup>
                <CommandItem
                  value="__clear__"
                  onSelect={() => {
                    onChange("");
                    setOpen(false);
                    setSearch("");
                  }}
                  className="cursor-pointer text-muted-foreground"
                >
                  <X className="mr-2 h-4 w-4" />
                  Clear selection
                </CommandItem>
              </CommandGroup>
            )}
            <CommandEmpty>No contracts found.</CommandEmpty>
            {poContracts.length > 0 && (
              <CommandGroup heading="Purchase Orders">
                {poContracts.map((c) => (
                  <CommandItem
                    key={c.id}
                    value={c.id}
                    onSelect={() => {
                      onChange(c.id);
                      setOpen(false);
                      setSearch("");
                    }}
                    className="cursor-pointer"
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === c.id ? "opacity-100" : "opacity-0",
                      )}
                    />
                    {c.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {subContracts.length > 0 && (
              <CommandGroup heading="Subcontracts">
                {subContracts.map((c) => (
                  <CommandItem
                    key={c.id}
                    value={c.id}
                    onSelect={() => {
                      onChange(c.id);
                      setOpen(false);
                      setSearch("");
                    }}
                    className="cursor-pointer"
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === c.id ? "opacity-100" : "opacity-0",
                      )}
                    />
                    {c.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
