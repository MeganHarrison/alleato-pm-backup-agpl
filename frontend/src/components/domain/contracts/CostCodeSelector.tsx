"use client";

import * as React from "react";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useCostCodes } from "@/hooks/use-cost-codes";

interface CostCodeSelectorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function CostCodeSelector({
  value,
  onChange,
  placeholder = "Select cost code",
  className,
}: CostCodeSelectorProps) {
  const [open, setOpen] = React.useState(false);

  const { costCodes, isLoading } = useCostCodes();

  const selectedCode = costCodes.find((cc) => cc.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-[150px] justify-between", className)}
          disabled={isLoading}
          {...(!selectedCode && !isLoading && { "data-placeholder-style": "" })}
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <span className="truncate">
              {selectedCode ? selectedCode.id : placeholder}
            </span>
          )}
          <ChevronsUpDown className="shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" sideOffset={0}>
        <Command>
          <CommandInput placeholder="Search cost codes..." />
          <CommandEmpty>No cost code found.</CommandEmpty>
          <CommandGroup className="max-h-[300px] overflow-auto">
            {costCodes.map((costCode) => (
              <CommandItem
                key={costCode.id}
                value={`${costCode.id} ${costCode.description || ""}`}
                onSelect={() => {
                  onChange(costCode.id);
                  setOpen(false);
                }}
              >
                <Check
                  className={cn(
                    "mr-2 h-4 w-4",
                    value === costCode.id ? "opacity-100" : "opacity-0",
                  )}
                />
                <div className="flex-1">
                  <div className="font-medium">{costCode.id}</div>
                  <div className="text-sm text-muted-foreground">
                    {costCode.description || "No description"}
                  </div>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
