import { Control, FieldPath, FieldValues } from "react-hook-form"

import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"

import { MoneyField } from "../MoneyField"

interface Props<TFieldValues extends FieldValues> {
  control: Control<TFieldValues>
  name: FieldPath<TFieldValues>
  label: string
  placeholder?: string
  description?: string
  min?: number
  disabled?: boolean
  allowNegative?: boolean
  showCurrency?: boolean
}

/**
 * React Hook Form adapter for MoneyField.
 *
 * This component contains ZERO input behavior — it only bridges
 * RHF's control/name to MoneyField's value/onChange.
 * All formatting, sanitization, and UX lives in MoneyField.
 */
export function RHFMoneyField<TFieldValues extends FieldValues>({
  control,
  name,
  label,
  placeholder,
  description,
  min,
  disabled,
  allowNegative,
  showCurrency,
}: Props<TFieldValues>) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          {description && <FormDescription>{description}</FormDescription>}
          <FormControl>
            <MoneyField
              id={`${String(name)}-money-field`}
              label={label}
              value={typeof field.value === "number" ? field.value : undefined}
              onChange={(val) => field.onChange(val as never)}
              placeholder={placeholder}
              min={min}
              disabled={disabled}
              allowNegative={allowNegative}
              showCurrency={showCurrency}
              inline
            />
          </FormControl>

          <FormMessage />
        </FormItem>
      )}
    />
  )
}
