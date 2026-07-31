"use client"

import * as React from "react"
import { Check, ChevronsUpDown } from "lucide-react"
import { Control, FieldPath, FieldValues } from "react-hook-form"

import { useIsMobile } from "@/hooks/use-mobile"
import { cn } from "@/lib/utils"
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer"

export interface ComboboxOption {
  value: string
  label: string
  keywords?: string[]
}

interface Props<TFieldValues extends FieldValues> {
  control: Control<TFieldValues>
  name: FieldPath<TFieldValues>
  label: string
  options: ComboboxOption[]
  placeholder?: string
  /** Fallback label shown when field.value is set but no matching option exists yet (e.g. options still loading) */
  selectedLabel?: string
  searchPlaceholder?: string
  emptyMessage?: string
  description?: string
  disabled?: boolean
  /** Allow deselecting by clicking the selected option again (sets value to null). */
  clearable?: boolean
}

export function RHFComboboxField<TFieldValues extends FieldValues>({
  control,
  name,
  label,
  options,
  placeholder = "Select an option",
  selectedLabel,
  searchPlaceholder = "Search",
  emptyMessage = "No results found.",
  description,
  disabled,
  clearable,
}: Props<TFieldValues>) {
  const [open, setOpen] = React.useState(false)
  const isMobile = useIsMobile()

  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => {
        const selected = options.find(option => option.value === field.value)
        const displayLabel = selected?.label ?? (field.value && selectedLabel ? selectedLabel : null)
        const trigger = (
          <FormControl>
            <Button
              type="button"
              variant="outline"
              role="combobox"
              disabled={disabled}
              className={cn(
                "h-11 w-full justify-between",
                !displayLabel && "text-[hsl(var(--input-placeholder))]"
              )}
              {...(!displayLabel && { "data-placeholder-style": "" })}
            >
              <span className="truncate">
                {displayLabel ?? placeholder}
              </span>
              <ChevronsUpDown className="shrink-0 opacity-50" />
            </Button>
          </FormControl>
        )
        const optionsList = (
          <Command>
            <CommandInput placeholder={searchPlaceholder} />
            <CommandList className="max-h-72">
              <CommandEmpty>{emptyMessage}</CommandEmpty>
              <CommandGroup>
                {options.map(option => (
                  <CommandItem
                    key={option.value}
                    value={[
                      option.label,
                      option.value,
                      ...(option.keywords ?? []),
                    ].join(" ")}
                    className="min-h-11"
                    onSelect={() => {
                      field.onChange(clearable && option.value === field.value ? null : option.value)
                      setOpen(false)
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        option.value === field.value
                          ? "opacity-100"
                          : "opacity-0"
                      )}
                    />
                    {option.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        )

        return (
          <FormItem className="flex flex-col">
            <FormLabel>{label}</FormLabel>
            {description && <FormDescription>{description}</FormDescription>}

            {isMobile ? (
              <Drawer open={open} onOpenChange={setOpen}>
                <DrawerTrigger asChild>{trigger}</DrawerTrigger>
                <DrawerContent>
                  <DrawerHeader className="text-left">
                    <DrawerTitle>{label}</DrawerTitle>
                  </DrawerHeader>
                  <div className="px-4 pb-4">{optionsList}</div>
                </DrawerContent>
              </Drawer>
            ) : (
              <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>{trigger}</PopoverTrigger>
                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
                  {optionsList}
                </PopoverContent>
                </Popover>
            )}

            <FormMessage />
          </FormItem>
        )
      }}
    />
  )
}
