import type {
  ScheduleResourceCapacityDiagnostic,
  ScheduleResourceCapacityProfile,
  ScheduleResourceCapacityResolution,
} from "@/types/scheduling";
import { isWorkingDay, type ScheduleCalendar } from "./schedule-calendar";
import { parseScheduleDate } from "./schedule-placement-math";

export interface BuildScheduleResourceCapacityResolverInput {
  calendar: ScheduleCalendar;
  capacity_profiles?: readonly ScheduleResourceCapacityProfile[];
}

export interface ScheduleResourceCapacityResolver {
  diagnostics: ScheduleResourceCapacityDiagnostic[];
  resolve: (resourceId: string, date: string) => ScheduleResourceCapacityResolution;
  rangeDiagnostics: (start: string, finish: string) => ScheduleResourceCapacityDiagnostic[];
}

interface IndexedProfile {
  configured: boolean;
  coverageStart: string | null;
  coverageFinish: string | null;
  coverageValid: boolean;
  weekdayCapacity: Map<number, number>;
  exceptionCapacity: Map<string, { capacity: number; reason: string | null }>;
}

function isCapacity(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0 && value <= 100;
}

function diagnosticSort(
  left: ScheduleResourceCapacityDiagnostic,
  right: ScheduleResourceCapacityDiagnostic,
): number {
  return JSON.stringify([
    left.code,
    left.resource_id,
    left.fact_type,
    left.key,
    left.date,
    left.message,
  ]).localeCompare(JSON.stringify([
    right.code,
    right.resource_id,
    right.fact_type,
    right.key,
    right.date,
    right.message,
  ]));
}

function unavailable(): ScheduleResourceCapacityResolution {
  return { capacity_percent: 0, source: "unavailable", reason: null, available: false };
}

function indexProfile(
  profile: ScheduleResourceCapacityProfile,
  diagnostics: ScheduleResourceCapacityDiagnostic[],
): IndexedProfile {
  const coveragePairIsComplete = profile.coverage_start_date === null && profile.coverage_finish_date === null;
  const coveragePairIsBounded = parseScheduleDate(profile.coverage_start_date)
    && parseScheduleDate(profile.coverage_finish_date)
    && profile.coverage_start_date! <= profile.coverage_finish_date!;
  const coverageValid = Boolean(coveragePairIsComplete || coveragePairIsBounded);
  if (!coverageValid) {
    diagnostics.push({
      code: "invalid_capacity_fact",
      resource_id: profile.resource_id,
      fact_type: "coverage",
      key: `${profile.coverage_start_date ?? "null"}:${profile.coverage_finish_date ?? "null"}`,
      message: `Resource ${profile.resource_id} has invalid capacity coverage bounds.`,
    });
  }

  const weekdayGroups = new Map<number, number[]>();
  for (const fact of profile.weekday_overrides) {
    if (!Number.isSafeInteger(fact.weekday) || fact.weekday < 0 || fact.weekday > 6 || !isCapacity(fact.capacity_percent)) {
      diagnostics.push({
        code: "invalid_capacity_fact",
        resource_id: profile.resource_id,
        fact_type: "weekday",
        key: String(fact.weekday),
        message: `Resource ${profile.resource_id} has an invalid weekday capacity fact for ${fact.weekday}.`,
      });
      continue;
    }
    weekdayGroups.set(fact.weekday, [...(weekdayGroups.get(fact.weekday) ?? []), fact.capacity_percent]);
  }
  const weekdayCapacity = new Map<number, number>();
  for (const [weekday, capacities] of [...weekdayGroups].sort(([left], [right]) => left - right)) {
    if (capacities.length > 1) {
      diagnostics.push({
        code: "duplicate_capacity_fact",
        resource_id: profile.resource_id,
        fact_type: "weekday",
        key: String(weekday),
        message: `Resource ${profile.resource_id} has duplicate weekday capacity facts for ${weekday}.`,
      });
    } else {
      weekdayCapacity.set(weekday, capacities[0]);
    }
  }

  const exceptionGroups = new Map<string, Array<{ capacity: number; reason: string | null }>>();
  for (const fact of profile.exceptions) {
    if (!parseScheduleDate(fact.date) || !isCapacity(fact.capacity_percent)) {
      diagnostics.push({
        code: "invalid_capacity_fact",
        resource_id: profile.resource_id,
        fact_type: "exception",
        key: fact.date,
        message: `Resource ${profile.resource_id} has an invalid dated capacity fact for ${fact.date}.`,
      });
      continue;
    }
    exceptionGroups.set(fact.date, [
      ...(exceptionGroups.get(fact.date) ?? []),
      { capacity: fact.capacity_percent, reason: fact.reason },
    ]);
  }
  const exceptionCapacity = new Map<string, { capacity: number; reason: string | null }>();
  for (const [date, facts] of [...exceptionGroups].sort(([left], [right]) => left.localeCompare(right))) {
    if (facts.length > 1) {
      diagnostics.push({
        code: "duplicate_capacity_fact",
        resource_id: profile.resource_id,
        fact_type: "exception",
        key: date,
        message: `Resource ${profile.resource_id} has duplicate dated capacity facts for ${date}.`,
      });
    } else {
      exceptionCapacity.set(date, facts[0]);
    }
  }

  return {
    configured: profile.configured,
    coverageStart: profile.coverage_start_date,
    coverageFinish: profile.coverage_finish_date,
    coverageValid,
    weekdayCapacity,
    exceptionCapacity,
  };
}

export function buildScheduleResourceCapacityResolver({
  calendar,
  capacity_profiles = [],
}: BuildScheduleResourceCapacityResolverInput): ScheduleResourceCapacityResolver {
  const diagnostics: ScheduleResourceCapacityDiagnostic[] = [];
  const groupedProfiles = new Map<string, ScheduleResourceCapacityProfile[]>();
  for (const profile of capacity_profiles) {
    groupedProfiles.set(profile.resource_id, [...(groupedProfiles.get(profile.resource_id) ?? []), profile]);
  }

  const indexedProfiles = new Map<string, IndexedProfile>();
  const ambiguousResources = new Set<string>();
  for (const [resourceId, profiles] of [...groupedProfiles].sort(([left], [right]) => left.localeCompare(right))) {
    if (profiles.length > 1) {
      ambiguousResources.add(resourceId);
      diagnostics.push({
        code: "duplicate_capacity_profile",
        resource_id: resourceId,
        fact_type: "profile",
        key: resourceId,
        message: `Resource ${resourceId} has duplicate capacity profiles.`,
      });
      continue;
    }
    indexedProfiles.set(resourceId, indexProfile(profiles[0], diagnostics));
  }
  diagnostics.sort(diagnosticSort);

  function resolve(resourceId: string, date: string): ScheduleResourceCapacityResolution {
    if (!parseScheduleDate(date)) return unavailable();
    if (!isWorkingDay(date, calendar)) {
      return { capacity_percent: 0, source: "project_non_working", reason: null, available: true };
    }
    if (ambiguousResources.has(resourceId)) return unavailable();
    const profile = indexedProfiles.get(resourceId);
    if (!profile || !profile.configured) {
      return { capacity_percent: 100, source: "inherited", reason: null, available: true };
    }
    if (!profile.coverageValid) return unavailable();
    if (
      (profile.coverageStart && date < profile.coverageStart)
      || (profile.coverageFinish && date > profile.coverageFinish)
    ) {
      return unavailable();
    }
    const exception = profile.exceptionCapacity.get(date);
    if (exception) {
      return {
        capacity_percent: exception.capacity,
        source: "date_exception",
        reason: exception.reason,
        available: true,
      };
    }
    const weekday = parseScheduleDate(date)!.getUTCDay();
    const weekdayCapacity = profile.weekdayCapacity.get(weekday);
    if (weekdayCapacity !== undefined) {
      return {
        capacity_percent: weekdayCapacity,
        source: "weekday_override",
        reason: null,
        available: true,
      };
    }
    return { capacity_percent: 100, source: "inherited", reason: null, available: true };
  }

  function rangeDiagnostics(start: string, finish: string): ScheduleResourceCapacityDiagnostic[] {
    if (!parseScheduleDate(start) || !parseScheduleDate(finish) || start > finish) return [];
    const result: ScheduleResourceCapacityDiagnostic[] = [];
    for (const [resourceId, profile] of [...indexedProfiles].sort(([left], [right]) => left.localeCompare(right))) {
      if (!profile.configured || !profile.coverageValid) continue;
      const uncoveredDate = profile.coverageStart && start < profile.coverageStart
        ? start
        : profile.coverageFinish && finish > profile.coverageFinish
          ? finish
          : null;
      if (uncoveredDate) {
        result.push({
          code: "uncovered_capacity_range",
          resource_id: resourceId,
          fact_type: "coverage",
          key: `${start}:${finish}`,
          date: uncoveredDate,
          message: `Resource ${resourceId} capacity facts do not cover ${start} through ${finish}.`,
        });
      }
    }
    return result.sort(diagnosticSort);
  }

  return { diagnostics, resolve, rangeDiagnostics };
}
