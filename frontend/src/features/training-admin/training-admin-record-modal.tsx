"use client";

import * as React from "react";

import { InfoAlert } from "@/components/ds/InfoAlert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Modal,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from "@/components/ui/unified-modal";

import type {
  TrainingAdminFieldDefinition,
  TrainingAdminRecord,
  TrainingAdminReferenceOptions,
  TrainingAdminTableDefinition,
} from "./types";

type FormValue = string | boolean;
type FormState = Record<string, FormValue>;

function inputValue(field: TrainingAdminFieldDefinition, value: unknown) {
  if (field.type === "boolean") return value === true;
  if (field.type === "json") {
    return JSON.stringify(value ?? (field.key === "metadata" ? {} : []), null, 2);
  }
  if (field.type === "string-array") {
    return Array.isArray(value) ? value.join(", ") : "";
  }
  return value == null ? "" : String(value);
}

function initialState(
  definition: TrainingAdminTableDefinition,
  record: TrainingAdminRecord | null,
): FormState {
  return Object.fromEntries(
    definition.fields.map((field) => [
      field.key,
      inputValue(field, record?.[field.key] ?? definition.defaults[field.key]),
    ]),
  );
}

function serializeField(field: TrainingAdminFieldDefinition, value: FormValue) {
  if (field.type === "boolean") return value === true;
  const text = String(value);
  if (!text.trim() && field.nullable) return null;
  if (field.type === "number" || field.key === "rescore_days") {
    const parsed = Number(text);
    if (!Number.isFinite(parsed)) {
      throw new Error(`${field.label} must be a number.`);
    }
    return parsed;
  }
  if (field.type === "json") {
    try {
      return JSON.parse(text);
    } catch {
      throw new Error(`${field.label} must contain valid JSON.`);
    }
  }
  if (field.type === "string-array") {
    return text
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return text;
}

function buildPayload(
  definition: TrainingAdminTableDefinition,
  state: FormState,
) {
  return Object.fromEntries(
    definition.fields.map((field) => [
      field.key,
      serializeField(field, state[field.key] ?? ""),
    ]),
  );
}

function FieldControl({
  field,
  value,
  references,
  disabled,
  onChange,
}: {
  field: TrainingAdminFieldDefinition;
  value: FormValue;
  references: TrainingAdminReferenceOptions;
  disabled: boolean;
  onChange: (value: FormValue) => void;
}) {
  const options =
    field.options ??
    (field.referenceKey ? references[field.referenceKey] ?? [] : []);

  if (field.type === "boolean") {
    return (
      <Select
        value={value === true ? "true" : "false"}
        onValueChange={(next) => onChange(next === "true")}
        disabled={disabled}
      >
        <SelectTrigger id={field.key}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="true">Yes</SelectItem>
          <SelectItem value="false">No</SelectItem>
        </SelectContent>
      </Select>
    );
  }

  if (field.type === "select" || field.type === "reference") {
    const selectValue = String(value || (field.nullable ? "__none__" : ""));
    return (
      <Select
        value={selectValue}
        onValueChange={(next) => onChange(next === "__none__" ? "" : next)}
        disabled={disabled}
      >
        <SelectTrigger id={field.key}>
          <SelectValue placeholder={`Select ${field.label.toLowerCase()}`} />
        </SelectTrigger>
        <SelectContent>
          {field.nullable ? (
            <SelectItem value="__none__">None</SelectItem>
          ) : null}
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  if (field.type === "textarea" || field.type === "json") {
    return (
      <Textarea
        id={field.key}
        value={String(value)}
        onChange={(event) => onChange(event.target.value)}
        rows={field.type === "json" ? 8 : 5}
        className={field.type === "json" ? "font-mono text-xs" : undefined}
        placeholder={field.placeholder}
        disabled={disabled}
      />
    );
  }

  return (
    <Input
      id={field.key}
      type={
        field.type === "number"
          ? "number"
          : field.type === "date"
            ? "date"
            : field.type === "datetime"
              ? "datetime-local"
              : "text"
      }
      value={String(value)}
      onChange={(event) => onChange(event.target.value)}
      placeholder={field.placeholder}
      disabled={disabled}
    />
  );
}

export function TrainingAdminRecordModal({
  definition,
  references,
  record,
  open,
  isSaving,
  onOpenChange,
  onSave,
}: {
  definition: TrainingAdminTableDefinition;
  references: TrainingAdminReferenceOptions;
  record: TrainingAdminRecord | null;
  open: boolean;
  isSaving: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (payload: Record<string, unknown>) => Promise<void>;
}) {
  const [state, setState] = React.useState<FormState>(() =>
    initialState(definition, record),
  );
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open) {
      setState(initialState(definition, record));
      setError(null);
    }
  }, [definition, open, record]);

  async function handleSave() {
    setError(null);
    try {
      await onSave(buildPayload(definition, state));
      onOpenChange(false);
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : `${definition.singularLabel} could not be saved.`,
      );
    }
  }

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent className="max-h-screen overflow-y-auto sm:max-w-2xl">
        <ModalHeader>
          <ModalTitle>
            {record ? `Edit ${definition.singularLabel}` : `Add ${definition.singularLabel}`}
          </ModalTitle>
        </ModalHeader>

        <div className="space-y-5 py-2">
          {error ? <InfoAlert variant="error">{error}</InfoAlert> : null}
          {definition.fields.map((field) => (
            <div key={field.key} className="space-y-2">
              <Label htmlFor={field.key}>
                {field.label}
                {field.required ? " *" : ""}
              </Label>
              <FieldControl
                field={field}
                value={state[field.key] ?? ""}
                references={references}
                disabled={Boolean(record && field.createOnly)}
                onChange={(value) =>
                  setState((current) => ({ ...current, [field.key]: value }))
                }
              />
              {field.help ? (
                <p className="text-xs text-muted-foreground">{field.help}</p>
              ) : null}
            </div>
          ))}
        </div>

        <ModalFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button type="button" onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Saving…" : "Save"}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
