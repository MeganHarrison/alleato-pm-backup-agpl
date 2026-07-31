"use client";

import { useEffect, useState } from "react";
import { CalendarDays, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { SectionRuleHeading } from "@/components/layout/spacing";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DateField } from "@/components/forms/DateField";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ScheduleCalendar, ScheduleCalendarException } from "@/lib/scheduling/schedule-calendar";

const weekdays = [
  { value: 0, label: "Sun" }, { value: 1, label: "Mon" }, { value: 2, label: "Tue" },
  { value: 3, label: "Wed" }, { value: 4, label: "Thu" }, { value: 5, label: "Fri" }, { value: 6, label: "Sat" },
];

type Exception = ScheduleCalendarException;
export type CalendarSettingsPayload = { working_weekdays: number[]; exceptions: Exception[] };

function exceptionsFrom(calendar: ScheduleCalendar): Exception[] {
  if (calendar.exceptions) {
    return calendar.exceptions.map((exception) => ({ ...exception })).sort((left, right) => left.date.localeCompare(right.date));
  }
  return [
    ...calendar.non_working_dates.map((date) => ({ date, is_working: false })),
    ...(calendar.working_date_overrides ?? []).map((date) => ({ date, is_working: true })),
  ].sort((left, right) => left.date.localeCompare(right.date));
}

function dateFromIso(value: string): Date | undefined {
  return value ? new Date(`${value}T12:00:00`) : undefined;
}

function isoFromDate(value: Date | undefined): string {
  if (!value) return "";
  return [value.getFullYear(), String(value.getMonth() + 1).padStart(2, "0"), String(value.getDate()).padStart(2, "0")].join("-");
}

export function CalendarSettingsDialog({
  open,
  onOpenChange,
  calendar,
  onSave,
  saveDisabledReason = null,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  calendar: ScheduleCalendar;
  onSave: (payload: CalendarSettingsPayload) => Promise<void>;
  saveDisabledReason?: string | null;
}) {
  const [workingWeekdays, setWorkingWeekdays] = useState(calendar.working_weekdays);
  const [exceptions, setExceptions] = useState<Exception[]>(exceptionsFrom(calendar));
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setWorkingWeekdays(calendar.working_weekdays);
      setExceptions(exceptionsFrom(calendar));
      setSaveError(null);
    }
  }, [calendar, open]);

  const toggleWeekday = (day: number) => {
    setWorkingWeekdays((current) => current.includes(day) ? current.filter((value) => value !== day) : [...current, day].sort((left, right) => left - right));
  };

  const save = async () => {
    if (saveDisabledReason) {
      setSaveError(saveDisabledReason);
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      await onSave({
        working_weekdays: workingWeekdays,
        exceptions: exceptions
          .filter((exception) => exception.date)
          .map((exception) => ({
            date: exception.date,
            is_working: exception.is_working,
            ...(exception.reason?.trim() ? { reason: exception.reason.trim() } : {}),
          })),
      });
      onOpenChange(false);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "The schedule calendar could not be saved. Try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="form">
        <DialogHeader>
          <DialogTitle>Schedule calendar</DialogTitle>
          <DialogDescription>Set the workweek and dated exceptions used for schedule impact and CPM calculations.</DialogDescription>
        </DialogHeader>
        <section aria-label="Working weekdays" className="space-y-3">
          <SectionRuleHeading label="Working weekdays" className="mb-0" />
          <div className="flex flex-wrap gap-x-4 gap-y-3">
            {weekdays.map((day) => (
              <label key={day.value} className="flex min-h-9 items-center gap-2 text-sm">
                <Checkbox checked={workingWeekdays.includes(day.value)} onCheckedChange={() => toggleWeekday(day.value)} />
                {day.label}
              </label>
            ))}
          </div>
        </section>
        <section aria-label="Dated exceptions" className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <SectionRuleHeading label="Dated exceptions" className="mb-0" />
            <Button type="button" variant="ghost" size="sm" onClick={() => setExceptions((current) => [...current, { date: "", is_working: false }])}>
              <Plus /> Add date
            </Button>
          </div>
          {exceptions.map((exception, index) => (
            <div key={`${exception.date}-${index}`} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)_auto_auto] sm:items-end">
              <DateField label={`Exception date ${index + 1}`} hideLabel value={dateFromIso(exception.date)} onChange={(date) => setExceptions((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, date: isoFromDate(date) } : item))} />
              <div className="space-y-2">
                <Label htmlFor={`calendar-exception-reason-${index}`} className="sr-only">Reason {index + 1}</Label>
                <Input
                  id={`calendar-exception-reason-${index}`}
                  aria-label={`Reason ${index + 1}`}
                  maxLength={240}
                  placeholder="Reason (optional)"
                  value={exception.reason ?? ""}
                  onChange={(event) => setExceptions((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, reason: event.target.value } : item))}
                />
              </div>
              <Button type="button" variant="outline" size="sm" aria-pressed={exception.is_working} onClick={() => setExceptions((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, is_working: !item.is_working } : item))}>
                {exception.is_working ? "Working" : "Non-working"}
              </Button>
              <Button type="button" variant="ghost" size="icon" aria-label={`Remove exception ${index + 1}`} onClick={() => setExceptions((current) => current.filter((_, itemIndex) => itemIndex !== index))}>
                <Trash2 />
              </Button>
            </div>
          ))}
          {exceptions.length === 0 && <p className="text-sm text-muted-foreground">No dated exceptions.</p>}
        </section>
        {saveError && (
          <p role="alert" className="text-sm text-destructive">
            {saveError}
          </p>
        )}
        <DialogFooter showCloseButton>
          <Button type="button" onClick={save} disabled={saving || workingWeekdays.length === 0 || Boolean(saveDisabledReason)}>
            <CalendarDays /> {saving ? "Saving…" : "Save calendar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
