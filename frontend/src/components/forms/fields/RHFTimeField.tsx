import * as React from "react";
import type {
  Control,
  ControllerRenderProps,
  FieldPath,
  FieldValues,
} from "react-hook-form";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";

interface RHFTimeFieldProps<TFieldValues extends FieldValues> {
  control: Control<TFieldValues>;
  name: FieldPath<TFieldValues>;
  label: string;
  placeholder?: string;
  description?: string;
  disabled?: boolean;
}

/**
 * Free-text time field that normalizes on blur to 24h "HH:MM".
 *
 * Root-cause fix: native `<input type="time">` renders a segmented editor
 * (hour / minute / AM-PM) that cannot accept a literal ":" keystroke — typing
 * "09:00" the way a user naturally would resets the segment editor and the
 * value collapses to empty, silently blocking submission. This field instead
 * accepts free text ("9:00am", "0900", "14:30", "2:30 PM", ...) and parses it
 * on blur, so normal typing always works.
 */
export function RHFTimeField<TFieldValues extends FieldValues>({
  control,
  name,
  label,
  placeholder = "e.g. 9:00 AM",
  description,
  disabled,
}: RHFTimeFieldProps<TFieldValues>) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <TimeFieldBody
          field={field}
          label={label}
          placeholder={placeholder}
          description={description}
          disabled={disabled}
        />
      )}
    />
  );
}

interface TimeFieldBodyProps<TFieldValues extends FieldValues> {
  field: ControllerRenderProps<TFieldValues, FieldPath<TFieldValues>>;
  label: string;
  placeholder?: string;
  description?: string;
  disabled?: boolean;
}

// Split out so the hooks below run at the top level of a real component,
// not inside FormField's render-prop callback (which react-hooks/rules-of-hooks
// correctly flags — a render prop is not a component as far as React's rules
// are concerned).
function TimeFieldBody<TFieldValues extends FieldValues>({
  field,
  label,
  placeholder,
  description,
  disabled,
}: TimeFieldBodyProps<TFieldValues>) {
  const [draft, setDraft] = React.useState<string>(field.value ?? "");

  // Keep the draft in sync when the field value changes externally
  // (e.g. form.reset()).
  React.useEffect(() => {
    setDraft(field.value ?? "");
  }, [field.value]);

  const commit = () => {
    const parsed = parseTimeInput(draft);
    if (parsed !== null) {
      setDraft(parsed);
      field.onChange(parsed);
    } else if (draft.trim() === "") {
      field.onChange("");
    } else {
      // Leave the raw text in place so RHF's regex validation surfaces a
      // visible "Use a valid time" error instead of silently discarding it.
      field.onChange(draft);
    }
    field.onBlur();
  };

  return (
    <FormItem>
      <FormLabel>{label}</FormLabel>
      {description ? <FormDescription>{description}</FormDescription> : null}
      <FormControl>
        <Input
          name={field.name}
          ref={field.ref}
          value={draft}
          placeholder={placeholder}
          disabled={disabled}
          inputMode="numeric"
          autoComplete="off"
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
        />
      </FormControl>
      <FormMessage />
    </FormItem>
  );
}

/**
 * Parses common free-text time formats into 24h "HH:MM", or returns null if
 * the input can't be confidently parsed.
 *
 * Accepts: "9:00", "09:00", "9:00am", "9:00 AM", "0900", "900pm", "14:30".
 */
export function parseTimeInput(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;

  const meridiemMatch = value.match(/\b(am|pm)\b/i);
  const meridiem = meridiemMatch ? meridiemMatch[1].toLowerCase() : null;
  const digitsOnly = value.replace(/[^0-9:]/gi, "").trim();

  let hours: number;
  let minutes: number;

  if (digitsOnly.includes(":")) {
    const [hStr, mStr = "0"] = digitsOnly.split(":");
    hours = Number(hStr);
    minutes = Number(mStr);
  } else if (digitsOnly.length <= 2) {
    // "9" or "14" -> top of the hour
    hours = Number(digitsOnly);
    minutes = 0;
  } else if (digitsOnly.length === 3) {
    // "930" -> 9:30
    hours = Number(digitsOnly.slice(0, 1));
    minutes = Number(digitsOnly.slice(1));
  } else if (digitsOnly.length === 4) {
    // "0930" / "1430" -> HH:MM
    hours = Number(digitsOnly.slice(0, 2));
    minutes = Number(digitsOnly.slice(2));
  } else {
    return null;
  }

  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  if (minutes < 0 || minutes > 59) return null;

  if (meridiem) {
    if (hours < 1 || hours > 12) return null;
    if (meridiem === "pm" && hours !== 12) hours += 12;
    if (meridiem === "am" && hours === 12) hours = 0;
  } else if (hours < 0 || hours > 23) {
    return null;
  }

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}
