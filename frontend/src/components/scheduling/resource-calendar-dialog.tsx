"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { DateField } from "@/components/forms/DateField";
import { NumberField } from "@/components/forms/NumberField";
import { SectionRuleHeading } from "@/components/layout/spacing";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type {
  ScheduleResource,
  ScheduleResourceCapacityException,
  ScheduleResourceCapacityProfile,
  ScheduleResourceCapacityProfileInput,
} from "@/types/scheduling";

interface ResourceCalendarDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  resource: ScheduleResource | null;
  profile: ScheduleResourceCapacityProfile | null;
  isLoading: boolean;
  error: string | null;
  onLoad: (resourceId: string) => Promise<ScheduleResourceCapacityProfile>;
  onSave: (
    resourceId: string,
    input: ScheduleResourceCapacityProfileInput,
  ) => Promise<ScheduleResourceCapacityProfile>;
}

interface ExceptionDraft {
  date: string;
  capacity_percent: number;
  reason: string;
}

const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

function exceptionDraft(exception: ScheduleResourceCapacityException): ExceptionDraft {
  return {
    date: exception.date,
    capacity_percent: exception.capacity_percent,
    reason: exception.reason ?? "",
  };
}

function dateFromIso(value: string): Date | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(year, month - 1, day, 12);
  return parsed.getFullYear() === year && parsed.getMonth() === month - 1 && parsed.getDate() === day
    ? parsed
    : undefined;
}

function formatDate(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function ResourceCalendarDialog({
  open,
  onOpenChange,
  resource,
  profile,
  isLoading,
  error,
  onLoad,
  onSave,
}: ResourceCalendarDialogProps) {
  const [weekdayValues, setWeekdayValues] = useState<Record<number, number | null>>({});
  const [exceptions, setExceptions] = useState<ExceptionDraft[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !resource) return;
    setSaveError(null);
    void onLoad(resource.id).catch(() => undefined);
  }, [onLoad, open, resource]);

  useEffect(() => {
    if (!open || !resource || profile?.resource_id !== resource.id) return;
    setWeekdayValues(Object.fromEntries(WEEKDAYS.map((_, weekday) => [
      weekday,
      profile.weekday_overrides.find((override) => override.weekday === weekday)?.capacity_percent ?? null,
    ])));
    setExceptions(profile.exceptions.map(exceptionDraft));
  }, [open, profile, resource]);

  const validationError = useMemo(() => {
    const activeWeekdays = Object.values(weekdayValues).filter((value) => value !== null);
    if (activeWeekdays.some((value) => !Number.isInteger(value) || value! < 0 || value! > 100)) {
      return "Weekday capacity must be a whole number from 0 through 100 percent.";
    }
    if (exceptions.some((exception) => !/^\d{4}-\d{2}-\d{2}$/.test(exception.date))) {
      return "Every capacity exception needs a valid date.";
    }
    if (new Set(exceptions.map((exception) => exception.date)).size !== exceptions.length) {
      return "Each exception date can appear only once.";
    }
    if (exceptions.some((exception) => !Number.isInteger(exception.capacity_percent)
      || exception.capacity_percent < 0
      || exception.capacity_percent > 100)) {
      return "Exception capacity must be a whole number from 0 through 100 percent.";
    }
    if (exceptions.some((exception) => exception.reason.trim().length > 240)) {
      return "Exception reasons are limited to 240 characters.";
    }
    return null;
  }, [exceptions, weekdayValues]);
  const hasCurrentProfile = Boolean(resource && profile?.resource_id === resource.id);

  const save = async () => {
    if (!resource || !hasCurrentProfile || validationError) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      await onSave(resource.id, {
        expected_version: profile?.version ?? null,
        weekday_overrides: WEEKDAYS.flatMap((_, weekday) => {
          const capacity = weekdayValues[weekday];
          return capacity === null || capacity === undefined
            ? []
            : [{ weekday, capacity_percent: capacity }];
        }),
        exceptions: exceptions.map((exception) => ({
          date: exception.date,
          capacity_percent: exception.capacity_percent,
          reason: exception.reason.trim() || null,
        })),
      });
      onOpenChange(false);
    } catch (cause) {
      setSaveError(cause instanceof Error ? cause.message : "Unable to save project capacity.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (isSaving && !nextOpen) return;
    onOpenChange(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent size="form" className="max-h-[calc(100svh-2rem)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit project capacity{resource ? `: ${resource.display_name}` : ""}</DialogTitle>
          <DialogDescription>
            These percentage overrides affect this project only. Reusable time-of-day shifts and cross-project demand are managed in Enterprise capacity and audited leveling.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Loading project capacity...
          </p>
        ) : error ? (
          <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>
        ) : (
          <div className="space-y-6">
            <section className="space-y-3" aria-label="Weekday capacity overrides">
              <div>
                <SectionRuleHeading className="mb-1" label="Weekday capacity overrides" />
                <p className="text-xs text-muted-foreground">Unchecked days inherit 100% capacity on project working days.</p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {WEEKDAYS.map((label, weekday) => {
                  const enabled = weekdayValues[weekday] !== null && weekdayValues[weekday] !== undefined;
                  return (
                    <div key={label} className="flex items-center gap-3 rounded-md border p-3">
                      <Checkbox
                        id={`capacity-${weekday}-enabled`}
                        checked={enabled}
                        disabled={isSaving}
                        onCheckedChange={(checked) => setWeekdayValues((current) => ({
                          ...current,
                          [weekday]: checked === true ? 100 : null,
                        }))}
                      />
                      <Label htmlFor={`capacity-${weekday}-enabled`} className="min-w-20">{label}</Label>
                      <NumberField
                        label={`${label} capacity percent`}
                        min={0}
                        max={100}
                        step={1}
                        disabled={!enabled || isSaving}
                        value={enabled ? weekdayValues[weekday] ?? 100 : undefined}
                        onChange={(value) => setWeekdayValues((current) => ({
                          ...current,
                          [weekday]: value ?? 0,
                        }))}
                        suffix="%"
                      />
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="space-y-3" aria-label="Dated exceptions">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <SectionRuleHeading className="mb-1" label="Dated exceptions" />
                  <p className="text-xs text-muted-foreground">Use 0% for a project-specific day off or a smaller percentage for reduced availability.</p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={isSaving}
                  onClick={() => setExceptions((current) => [...current, { date: "", capacity_percent: 0, reason: "" }])}
                >
                  <Plus className="h-4 w-4" aria-hidden="true" /> Add exception
                </Button>
              </div>
              {exceptions.length === 0 ? (
                <p className="text-sm text-muted-foreground">No dated exceptions.</p>
              ) : exceptions.map((exception, index) => (
                <div key={`${index}:${exception.date}`} className="grid gap-3 rounded-md border p-3 sm:grid-cols-[minmax(9rem,1fr)_8rem_minmax(12rem,2fr)_auto] sm:items-end">
                  <DateField
                    label={`Exception ${index + 1} date`}
                    disabled={isSaving}
                    value={dateFromIso(exception.date)}
                    onChange={(date) => setExceptions((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, date: date ? formatDate(date) : "" } : item))}
                  />
                  <NumberField
                      id={`capacity-exception-percent-${index}`}
                      label={`Exception ${index + 1} capacity`}
                      min={0}
                      max={100}
                      step={1}
                      disabled={isSaving}
                      value={exception.capacity_percent}
                      suffix="%"
                      onChange={(value) => setExceptions((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, capacity_percent: value ?? 0 } : item))}
                  />
                  <div className="space-y-1">
                    <Label htmlFor={`capacity-exception-reason-${index}`}>Reason (optional)</Label>
                    <Input
                      id={`capacity-exception-reason-${index}`}
                      maxLength={240}
                      disabled={isSaving}
                      value={exception.reason}
                      onChange={(event) => setExceptions((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, reason: event.target.value } : item))}
                    />
                  </div>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    aria-label={`Remove exception ${index + 1}`}
                    disabled={isSaving}
                    onClick={() => setExceptions((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </div>
              ))}
            </section>
          </div>
        )}

        {(validationError || saveError) && (
          <Alert variant="destructive" role="alert"><AlertDescription>{validationError ?? saveError}</AlertDescription></Alert>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" disabled={isSaving} onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="button" disabled={isLoading || Boolean(error) || Boolean(validationError) || isSaving || !hasCurrentProfile} onClick={() => void save()}>
            {isSaving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            Save project capacity
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
