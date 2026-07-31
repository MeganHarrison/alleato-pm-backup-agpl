"use client";

import * as React from "react";

import { DetailField, type DetailFieldProps } from "./DetailField";
import {
  InlineEditField,
  type InlineEditFieldProps,
} from "./InlineEditField";

type EditableDetailFieldProps = Omit<
  DetailFieldProps,
  "children" | "value" | "currency" | "date"
> &
  Omit<InlineEditFieldProps, "label"> & {
    editLabel?: string;
  };

export function EditableDetailField({
  label,
  editLabel,
  span,
  emptyPlaceholder,
  className,
  ...inlineEditProps
}: EditableDetailFieldProps): React.ReactElement {
  return (
    <DetailField
      label={label}
      span={span}
      emptyPlaceholder={emptyPlaceholder}
      className={className}
    >
      <InlineEditField
        label={editLabel ?? label}
        emptyLabel={emptyPlaceholder}
        {...inlineEditProps}
      />
    </DetailField>
  );
}

export type { EditableDetailFieldProps };
