"use client"

import * as React from "react"
import { Check, ChevronsUpDown, X } from "lucide-react"
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
import { Badge } from "@/components/ui/badge"
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

export interface MultiComboboxOption {
  value: string
  label: string
  keywords?: string[]
}

interface Props<TFieldValues extends FieldValues> {
  control: Control<TFieldValues>
  name: FieldPath<TFieldValues>
  label: string
  options: MultiComboboxOption[]
  placeholder?: string
  searchPlaceholder?: string
  emptyMessage?: string
  description?: string
  disabled?: boolean
}

/**
 * RHF-compatible multi-select combobox. Manages a string[] field value.
 * Selected items appear as dismissable badges; the dropdown stays open for
 * additional selections until the user closes it.
 */
export function RHFMultiComboboxField<TFieldValues extends FieldValues>({
  control,
  name,
  label,
  options,
  placeholder = "Select options",
  searchPlaceholder = "Search",
  emptyMessage = "No results found.",
  description,
  disabled,
}: Props<TFieldValues>) {
  const [open, setOpen] = React.useState(false)
  const isMobile = useIsMobile()

  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => {
        const selected: string[] = Array.isArray(field.value) ? field.value : []

        const toggle = (optionValue: string) => {
          const updated = selected.includes(optionValue)
            ? selected.filter((value) => value !== optionValue)
            : [...selected, optionValue]
          field.onChange(updated)
        }

        const remove = (optionValue: string, e: React.MouseEvent) => {
          e.stopPropagation()
          field.onChange(selected.filter((value) => value !== optionValue))
        }

        const trigger = (
          <FormControl>
            <Button
              type="button"
              variant="outline"
              role="combobox"
              disabled={disabled}
              className={cn(
                "h-auto min-h-11 w-full justify-between py-2",
                selected.length === 0 && "text-[hsl(var(--input-placeholder))]",
              )}
              {...(selected.length === 0 && { "data-placeholder-style": "" })}
            >
              <div className="flex flex-wrap gap-1 text-left">
                {selected.length === 0 ? (
                  <span>{placeholder}</span>
                ) : (
                  selected.map((value) => {
                    const option = options.find((candidate) => candidate.value === value)
                    const label = option?.label ?? value

                    return (
                      <Badge key={value} variant="secondary" className="gap-1 font-normal">
                        {label}
                        <span
                          role="button"
                          tabIndex={0}
                          aria-label={`Remove ${label}`}
                          className="cursor-pointer rounded-full outline-none hover:bg-muted focus:ring-1"
                          onClick={(event) => remove(value, event)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault()
                              field.onChange(selected.filter((selectedValue) => selectedValue !== value))
                            }
                          }}
                        >
                          <X className="h-3 w-3" />
                        </span>
                      </Badge>
                    )
                  })
                )}
              </div>
              <ChevronsUpDown className="ml-2 shrink-0 opacity-50" />
            </Button>
          </FormControl>
        )

        const optionsList = (
          <Command>
            <CommandInput placeholder={searchPlaceholder} />
            <CommandList className="max-h-72">
              <CommandEmpty>{emptyMessage}</CommandEmpty>
              <CommandGroup>
                {options.map((option) => (
                  <CommandItem
                    key={option.value}
                    value={[
                      option.label,
                      option.value,
                      ...(option.keywords ?? []),
                    ].join(" ")}
                    className="min-h-11"
                    onSelect={() => toggle(option.value)}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        selected.includes(option.value) ? "opacity-100" : "opacity-0",
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
