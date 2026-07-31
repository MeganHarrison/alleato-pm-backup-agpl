"use client"

import * as React from "react"
import { format } from "date-fns"
import { Calendar as CalendarIcon } from "lucide-react"
import { Control, FieldPath, FieldValues } from "react-hook-form"

import { useIsMobile } from "@/hooks/use-mobile"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer"
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface Props<TFieldValues extends FieldValues> {
  control: Control<TFieldValues>
  name: FieldPath<TFieldValues>
  label: string
  description?: string
  disabled?: boolean
  placeholder?: string
  nullable?: boolean
  valueType?: "date" | "string"
}

export function RHFDateField<TFieldValues extends FieldValues>({
  control,
  name,
  label,
  description,
  disabled,
  placeholder = "Pick a date",
  nullable = false,
  valueType = "string",
}: Props<TFieldValues>) {
  const [open, setOpen] = React.useState(false)
  const isMobile = useIsMobile()

  const toDateValue = (value: unknown): Date | undefined => {
    if (!value) return undefined
    if (value instanceof Date) {
      return Number.isNaN(value.getTime()) ? undefined : value
    }
    if (typeof value === "string") {
      // Parse as local date (not UTC) to avoid off-by-one-day timezone issue
      const parts = value.match(/^(\d{4})-(\d{2})-(\d{2})/)
      if (parts) {
        return new Date(Number(parts[1]), Number(parts[2]) - 1, Number(parts[3]))
      }
      const parsed = new Date(value)
      return Number.isNaN(parsed.getTime()) ? undefined : parsed
    }
    return undefined
  }

  const toFieldValue = (date: Date | undefined) => {
    if (!date) {
      return nullable ? null : ""
    }
    if (valueType === "date") {
      return date
    }
    return format(date, "yyyy-MM-dd")
  }

  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => {
        const dateValue = toDateValue(field.value)
        const trigger = (
          <FormControl>
            <Button
              type="button"
              variant="outline"
              disabled={disabled}
              className={cn(
                "h-11 w-full justify-start text-left font-normal",
                !dateValue && "text-muted-foreground"
              )}
            >
              <CalendarIcon />
              {dateValue ? format(dateValue, "PPP") : placeholder}
            </Button>
          </FormControl>
        )

        const calendar = (
          <Calendar
            mode="single"
            selected={dateValue}
            onSelect={(date) => {
              field.onChange(toFieldValue(date))
              field.onBlur()
              if (date) {
                setOpen(false)
              }
            }}
            initialFocus
          />
        )

        return (
          <FormItem>
            <FormLabel>{label}</FormLabel>
            {description && <FormDescription>{description}</FormDescription>}

            {isMobile ? (
              <Drawer open={open} onOpenChange={setOpen}>
                <DrawerTrigger asChild>{trigger}</DrawerTrigger>
                <DrawerContent>
                  <DrawerHeader className="text-left">
                    <DrawerTitle>{label}</DrawerTitle>
                  </DrawerHeader>
                  <div className="px-4 pb-4">
                    {calendar}
                    {nullable && (
                      <div className="pt-3">
                        <Button
                          type="button"
                          variant="ghost"
                          className="w-full"
                          onClick={() => {
                            field.onChange(toFieldValue(undefined))
                            field.onBlur()
                            setOpen(false)
                          }}
                        >
                          Clear date
                        </Button>
                      </div>
                    )}
                  </div>
                </DrawerContent>
              </Drawer>
            ) : (
              <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>{trigger}</PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  {calendar}
                  {nullable && (
                    <div className="border-t p-2">
                      <Button
                        type="button"
                        variant="ghost"
                        className="w-full"
                        onClick={() => {
                          field.onChange(toFieldValue(undefined))
                          field.onBlur()
                          setOpen(false)
                        }}
                      >
                        Clear date
                      </Button>
                    </div>
                  )}
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
