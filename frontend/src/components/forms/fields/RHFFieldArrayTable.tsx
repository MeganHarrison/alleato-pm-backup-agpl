"use client"

import * as React from "react"
import {
  Control,
  FieldArray,
  FieldArrayPath,
  FieldValues,
  useFieldArray,
} from "react-hook-form"
import { Plus, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type Column<TFieldValues extends FieldValues, TName extends FieldArrayPath<TFieldValues>> = {
  key: string
  header: React.ReactNode
  mobileLabel?: React.ReactNode
  className?: string
  cell: (args: {
    index: number
    rowName: `${TName}.${number}`
  }) => React.ReactNode
}

interface Props<
  TFieldValues extends FieldValues,
  TName extends FieldArrayPath<TFieldValues>
> {
  control: Control<TFieldValues>
  name: TName
  label?: string
  description?: string
  columns: Column<TFieldValues, TName>[]
  createRow: () => FieldArray<TFieldValues, TName>
  addLabel?: string
  minRows?: number
}

export function RHFFieldArrayTable<
  TFieldValues extends FieldValues,
  TName extends FieldArrayPath<TFieldValues>
>({
  control,
  name,
  label,
  description,
  columns,
  createRow,
  addLabel = "Add Row",
  minRows = 1,
}: Props<TFieldValues, TName>) {
  const { fields, append, remove } = useFieldArray({
    control,
    name,
  })

  React.useEffect(() => {
    if (fields.length === 0 && minRows > 0) {
      for (let i = 0; i < minRows; i += 1) {
        append(createRow())
      }
    }
  }, [append, createRow, fields.length, minRows])

  return (
    <div className="space-y-4">
      {(label || description) && (
        <div className="space-y-1">
          {/* eslint-disable-next-line design-system/no-raw-heading */}
          {label && <h3 className="text-sm font-medium">{label}</h3>}
          {description && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
        </div>
      )}

      <div className="space-y-3 md:hidden">
        {fields.map((field, index) => {
          const rowName = `${name}.${index}` as `${TName}.${number}`

          return (
            <div key={field.id} className="space-y-4 rounded-lg border p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-foreground">
                  {label ? `${label} ${index + 1}` : `Row ${index + 1}`}
                </p>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => remove(index)}
                  disabled={fields.length <= minRows}
                  aria-label={`Remove row ${index + 1}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              {columns.map(column => (
                <div key={column.key} className="space-y-2">
                  {column.mobileLabel ? (
                    <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                      {column.mobileLabel}
                    </p>
                  ) : null}
                  {column.cell({ index, rowName })}
                </div>
              ))}
            </div>
          )
        })}
      </div>

      <div className="hidden overflow-x-auto rounded-lg border md:block">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map(column => (
                <TableHead key={column.key} className={column.className}>
                  {column.header}
                </TableHead>
              ))}
              <TableHead className="w-16" />
            </TableRow>
          </TableHeader>

          <TableBody>
            {fields.map((field, index) => {
              const rowName = `${name}.${index}` as `${TName}.${number}`

              return (
                <TableRow key={field.id}>
                  {columns.map(column => (
                    <TableCell key={column.key} className={column.className}>
                      {column.cell({ index, rowName })}
                    </TableCell>
                  ))}

                  <TableCell>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => remove(index)}
                      disabled={fields.length <= minRows}
                      aria-label={`Remove row ${index + 1}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      <Button
        type="button"
        variant="outline"
        onClick={() => append(createRow())}
        className="w-full sm:w-auto"
      >
        <Plus />
        {addLabel}
      </Button>
    </div>
  )
}
