"use server";

import {
  normalizeSiteManagementChecklist,
  serializeSiteManagementChecklist,
  type SiteManagementChecklistState,
} from "@/lib/daily-log/site-management-checklist";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database.types";
import { revalidatePath } from "next/cache";

type DailyLogInsert = Database["public"]["Tables"]["daily_logs"]["Insert"];
type DailyLogRow = Database["public"]["Tables"]["daily_logs"]["Row"];
type DailyLogWeatherInsert =
  Database["public"]["Tables"]["daily_log_weather"]["Insert"];
type DailyLogManpowerInsert =
  Database["public"]["Tables"]["daily_log_manpower"]["Insert"];
type DailyLogEquipmentInsert =
  Database["public"]["Tables"]["daily_log_equipment"]["Insert"];
type DailyLogNoteInsert =
  Database["public"]["Tables"]["daily_log_notes"]["Insert"];

export type DailyLogStatus = "draft" | "pending" | "complete";

export type DailyLogWeatherInput = {
  area?: string;
  timeObserved?: string;
  delay?: boolean;
  location?: string;
  sky?: string;
  temperature?: number | null;
  calamity?: string;
  average?: string;
  precipitation?: string;
  wind?: string;
  groundOrSea?: string;
  comments?: string;
};

export type DailyLogManpowerInput = {
  area?: string;
  companyId?: string;
  trade?: string;
  workersCount: number;
  hoursWorked?: number | null;
  costCode?: string;
  location?: string;
  comments?: string;
  issueFlag?: boolean;
};

export type DailyLogEquipmentInput = {
  area?: string;
  equipmentName: string;
  hoursOperated?: number | null;
  hoursIdle?: number | null;
  costCode?: string;
  location?: string;
  inspected?: boolean;
  inspectionTime?: string;
  comments?: string;
};

export type DailyLogNoteInput = {
  area?: string;
  category?: string;
  location?: string;
  description: string;
  issueFlag?: boolean;
};

function maybeNotFound(error: { code?: string; message: string } | null) {
  return !error || error.code === "PGRST116";
}

/** Normalizes weather payloads into a JSON-safe shape accepted by Supabase. */
function normalizeWeatherConditions(
  value: unknown,
): DailyLogInsert["weather_conditions"] {
  if (value === undefined) return undefined;
  if (value === null) return null;

  try {
    return JSON.parse(JSON.stringify(value)) as DailyLogInsert["weather_conditions"];
  } catch {
    return null;
  }
}

export async function createDailyLog(params: {
  projectId: number;
  logDate: string; // YYYY-MM-DD
  weatherConditions?: unknown;
}) {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    return { error: `Could not verify daily log author: ${userError.message}` };
  }

  if (!user) {
    return { error: "You must be signed in to create a daily log." };
  }

  const { data, error } = await supabase
    .from("daily_logs")
    .insert({
      project_id: params.projectId,
      log_date: params.logDate,
      created_by: user.id,
      weather_conditions: normalizeWeatherConditions(params.weatherConditions),
    })
    .select()
    .single();
  if (error) return { error: error.message };
  revalidatePath(`/${params.projectId}/daily-log`);
  return { success: true, data } as const;
}

function cleanString(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function cleanTime(value: string | undefined): string | null {
  const trimmed = cleanString(value);
  if (!trimmed) return null;
  return /^\d{2}:\d{2}$/.test(trimmed) ? trimmed : null;
}

function cleanNumber(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function formatChecklistSchemaError(message?: string) {
  if (!message || !message.includes("site_management_checklist")) {
    return null;
  }

  return "Daily log checklist submissions require Supabase migration 20260616231500_daily_logs_site_management_checklist.sql before this template can be saved.";
}

async function deleteExistingSectionRows(dailyLogId: string) {
  const supabase = await createClient();
  const deleteResults = await Promise.all([
    supabase.from("daily_log_weather").delete().eq("daily_log_id", dailyLogId),
    supabase.from("daily_log_manpower").delete().eq("daily_log_id", dailyLogId),
    supabase.from("daily_log_equipment").delete().eq("daily_log_id", dailyLogId),
    supabase.from("daily_log_notes").delete().eq("daily_log_id", dailyLogId),
  ]);

  const failed = deleteResults.find((result) => result.error);
  return failed?.error?.message ?? null;
}

export async function saveDailyLogWithCoreSections(params: {
  projectId: number;
  logDate: string;
  status: DailyLogStatus;
  generalNotes?: string;
  weather: DailyLogWeatherInput[];
  manpower: DailyLogManpowerInput[];
  equipment: DailyLogEquipmentInput[];
  notes: DailyLogNoteInput[];
}) {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    return { error: `Could not verify daily log author: ${userError.message}` };
  }

  if (!user) {
    return { error: "You must be signed in to save a daily log." };
  }

  const completedAt = params.status === "complete" ? new Date().toISOString() : null;
  const completedBy = params.status === "complete" ? user.id : null;

  const weatherSummary = params.weather
    .map((entry) =>
      [
        cleanString(entry.sky),
        cleanNumber(entry.temperature) == null ? null : `${entry.temperature}°`,
        cleanString(entry.precipitation),
        cleanString(entry.wind),
        cleanString(entry.comments),
      ]
        .filter(Boolean)
        .join(" / "),
    )
    .filter(Boolean)
    .join("\n");

  const dailyLogPayload: DailyLogInsert = {
    project_id: params.projectId,
    log_date: params.logDate,
    status: params.status,
    completed_at: completedAt,
    completed_by: completedBy,
    created_by: user.id,
    general_notes: cleanString(params.generalNotes),
    weather_conditions: weatherSummary || null,
    updated_at: new Date().toISOString(),
  };

  const { data: dailyLog, error: logError } = await supabase
    .from("daily_logs")
    .upsert(dailyLogPayload, { onConflict: "project_id,log_date" })
    .select()
    .single();

  if (logError || !dailyLog) {
    return {
      error:
        formatChecklistSchemaError(logError?.message) ??
        logError?.message ??
        "Daily log was not saved.",
    };
  }

  const deleteError = await deleteExistingSectionRows(dailyLog.id);
  if (deleteError) {
    return { error: `Daily log saved, but existing section rows were not replaced: ${deleteError}` };
  }

  const weatherRows: DailyLogWeatherInsert[] = params.weather.map((entry) => ({
    daily_log_id: dailyLog.id,
    area: cleanString(entry.area),
    time_observed: cleanTime(entry.timeObserved),
    delay: Boolean(entry.delay),
    location: cleanString(entry.location),
    sky: cleanString(entry.sky),
    temperature: cleanNumber(entry.temperature),
    calamity: cleanString(entry.calamity),
    average: cleanString(entry.average),
    precipitation: cleanString(entry.precipitation),
    wind: cleanString(entry.wind),
    ground_or_sea: cleanString(entry.groundOrSea),
    comments: cleanString(entry.comments),
  }));

  const manpowerRows: DailyLogManpowerInsert[] = params.manpower.map((entry) => ({
    daily_log_id: dailyLog.id,
    area: cleanString(entry.area),
    company_id: cleanString(entry.companyId),
    trade: cleanString(entry.trade),
    workers_count: entry.workersCount,
    hours_worked: cleanNumber(entry.hoursWorked),
    cost_code: cleanString(entry.costCode),
    location: cleanString(entry.location),
    comments: cleanString(entry.comments),
    issue_flag: Boolean(entry.issueFlag),
  }));

  const equipmentRows: DailyLogEquipmentInsert[] = params.equipment.map((entry) => ({
    daily_log_id: dailyLog.id,
    area: cleanString(entry.area),
    equipment_name: entry.equipmentName.trim(),
    hours_operated: cleanNumber(entry.hoursOperated),
    hours_idle: cleanNumber(entry.hoursIdle),
    cost_code: cleanString(entry.costCode),
    location: cleanString(entry.location),
    inspected: Boolean(entry.inspected),
    inspection_time: cleanTime(entry.inspectionTime),
    comments: cleanString(entry.comments),
    notes: cleanString(entry.comments),
  }));

  const noteRows: DailyLogNoteInsert[] = params.notes.map((entry) => ({
    daily_log_id: dailyLog.id,
    area: cleanString(entry.area),
    category: cleanString(entry.category),
    location: cleanString(entry.location),
    description: entry.description.trim(),
    issue_flag: Boolean(entry.issueFlag),
  }));

  const insertJobs = [
    weatherRows.length > 0
      ? supabase.from("daily_log_weather").insert(weatherRows)
      : Promise.resolve({ error: null }),
    manpowerRows.length > 0
      ? supabase.from("daily_log_manpower").insert(manpowerRows)
      : Promise.resolve({ error: null }),
    equipmentRows.length > 0
      ? supabase.from("daily_log_equipment").insert(equipmentRows)
      : Promise.resolve({ error: null }),
    noteRows.length > 0
      ? supabase.from("daily_log_notes").insert(noteRows)
      : Promise.resolve({ error: null }),
  ];

  const insertResults = await Promise.all(insertJobs);
  const insertError = insertResults.find((result) => result.error);
  if (insertError?.error) {
    return { error: `Daily log saved, but section rows failed: ${insertError.error.message}` };
  }

  revalidatePath(`/${params.projectId}/daily-log`);
  revalidatePath(`/${params.projectId}/daily-log/new`);
  revalidatePath(`/${params.projectId}/daily-log/${dailyLog.id}/edit`);
  return { success: true, data: dailyLog } as const;
}

export async function getSiteLeadChecklistForDate(params: {
  projectId: number;
  logDate: string;
}) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("daily_logs")
    .select("id, status, site_management_checklist")
    .eq("project_id", params.projectId)
    .eq("log_date", params.logDate)
    .maybeSingle();

  if (error && !maybeNotFound(error)) {
    return { error: `Site lead checklist could not be loaded: ${error.message}` };
  }

  return {
    success: true,
    data: {
      dailyLogId: data?.id ?? null,
      status: (data?.status as DailyLogStatus | null) ?? null,
      checklist: normalizeSiteManagementChecklist(data?.site_management_checklist),
    },
  } as const;
}

export async function saveSiteLeadChecklistForDate(params: {
  projectId: number;
  logDate: string;
  siteManagementChecklist: SiteManagementChecklistState;
}) {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    return { error: `Could not verify checklist author: ${userError.message}` };
  }

  if (!user) {
    return { error: "You must be signed in to save a site lead checklist." };
  }

  const serializedChecklist = serializeSiteManagementChecklist(params.siteManagementChecklist);
  const existingResult = await supabase
    .from("daily_logs")
    .select("id")
    .eq("project_id", params.projectId)
    .eq("log_date", params.logDate)
    .maybeSingle();

  if (existingResult.error && !maybeNotFound(existingResult.error)) {
    return { error: `Could not load the linked daily log: ${existingResult.error.message}` };
  }

  if (existingResult.data?.id) {
    const { data, error } = await supabase
      .from("daily_logs")
      .update({
        site_management_checklist: serializedChecklist,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existingResult.data.id)
      .eq("project_id", params.projectId)
      .select("id")
      .single();

    if (error || !data) {
      return {
        error:
          formatChecklistSchemaError(error?.message) ??
          error?.message ??
          "Site lead checklist was not saved.",
      };
    }

    revalidatePath(`/${params.projectId}/daily-log`);
    revalidatePath(`/${params.projectId}/daily-log/site-lead-checklist`);
    return { success: true, data } as const;
  }

  const { data, error } = await supabase
    .from("daily_logs")
    .insert({
      project_id: params.projectId,
      log_date: params.logDate,
      created_by: user.id,
      site_management_checklist: serializedChecklist,
      updated_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error || !data) {
    return {
      error:
        formatChecklistSchemaError(error?.message) ??
        error?.message ??
        "Site lead checklist was not saved.",
    };
  }

  revalidatePath(`/${params.projectId}/daily-log`);
  revalidatePath(`/${params.projectId}/daily-log/site-lead-checklist`);
  return { success: true, data } as const;
}

export async function createDailyLogManpower(params: {
  dailyLogId: string;
  companyId?: string;
  trade?: string;
  workersCount: number;
  hoursWorked?: number;
}) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("daily_log_manpower")
    .insert({
      daily_log_id: params.dailyLogId,
      company_id: params.companyId ?? null,
      trade: params.trade ?? null,
      workers_count: params.workersCount,
      hours_worked: params.hoursWorked ?? null,
    })
    .select()
    .single();
  if (error) return { error: error.message };
  revalidatePath(`/`); // generic revalidate; parent page should also revalidate
  return { success: true, data } as const;
}

export async function createDailyLogEquipment(params: {
  dailyLogId: string;
  equipmentName: string;
  hoursOperated?: number;
  hoursIdle?: number;
  notes?: string;
}) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("daily_log_equipment")
    .insert({
      daily_log_id: params.dailyLogId,
      equipment_name: params.equipmentName,
      hours_operated: params.hoursOperated ?? null,
      hours_idle: params.hoursIdle ?? null,
      notes: params.notes ?? null,
    })
    .select()
    .single();
  if (error) return { error: error.message };
  revalidatePath(`/`);
  return { success: true, data } as const;
}

export async function createDailyLogNote(params: {
  dailyLogId: string;
  category?: string;
  description: string;
}) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("daily_log_notes")
    .insert({
      daily_log_id: params.dailyLogId,
      category: params.category ?? null,
      description: params.description,
    })
    .select()
    .single();
  if (error) return { error: error.message };
  revalidatePath(`/`);
  return { success: true, data } as const;
}

export async function getDailyLogWithSections(params: {
  dailyLogId: string;
  projectId: number;
}) {
  const supabase = await createClient();

  const [logResult, weatherResult, manpowerResult, equipmentResult, notesResult] =
    await Promise.all([
      supabase
        .from("daily_logs")
        .select("*")
        .eq("id", params.dailyLogId)
        .eq("project_id", params.projectId)
        .single(),
      supabase
        .from("daily_log_weather")
        .select("*")
        .eq("daily_log_id", params.dailyLogId),
      supabase
        .from("daily_log_manpower")
        .select("*")
        .eq("daily_log_id", params.dailyLogId),
      supabase
        .from("daily_log_equipment")
        .select("*")
        .eq("daily_log_id", params.dailyLogId),
      supabase
        .from("daily_log_notes")
        .select("*")
        .eq("daily_log_id", params.dailyLogId),
    ]);

  if (logResult.error || !logResult.data) {
    return { error: "Daily log was not found for this project." };
  }

  const sectionErrors = [
    { name: "weather", error: weatherResult.error },
    { name: "manpower", error: manpowerResult.error },
    { name: "equipment", error: equipmentResult.error },
    { name: "notes", error: notesResult.error },
  ].filter((result) => result.error);

  if (sectionErrors.length > 0) {
    const details = sectionErrors
      .map((result) => `${result.name}: ${result.error?.message}`)
      .join("; ");

    return { error: `Daily log sections could not be loaded: ${details}` };
  }

  return {
    success: true,
    data: {
      log: logResult.data,
      weather: weatherResult.data ?? [],
      manpower: manpowerResult.data ?? [],
      equipment: equipmentResult.data ?? [],
      notes: notesResult.data ?? [],
    },
  } as const;
}

export async function updateDailyLogWithCoreSections(
  dailyLogId: string,
  params: {
    projectId: number;
    logDate: string;
    status: DailyLogStatus;
    generalNotes?: string;
    weather: DailyLogWeatherInput[];
    manpower: DailyLogManpowerInput[];
    equipment: DailyLogEquipmentInput[];
    notes: DailyLogNoteInput[];
  },
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const completedAt = params.status === "complete" ? new Date().toISOString() : null;
  const completedBy = params.status === "complete" ? user?.id ?? null : null;

  const weatherSummary = params.weather
    .map((entry) =>
      [
        cleanString(entry.sky),
        cleanNumber(entry.temperature) == null ? null : `${entry.temperature}°`,
        cleanString(entry.precipitation),
        cleanString(entry.wind),
        cleanString(entry.comments),
      ]
        .filter(Boolean)
        .join(" / "),
    )
    .filter(Boolean)
    .join("\n");

  const dailyLogPayload: DailyLogInsert = {
    log_date: params.logDate,
    status: params.status,
    completed_at: completedAt,
    completed_by: completedBy,
    general_notes: cleanString(params.generalNotes),
    weather_conditions: weatherSummary || null,
    updated_at: new Date().toISOString(),
  };

  const { data: dailyLog, error: logError } = await supabase
    .from("daily_logs")
    .update(dailyLogPayload)
    .eq("id", dailyLogId)
    .eq("project_id", params.projectId)
    .select()
    .single();

  if (logError) {
    return {
      error:
        formatChecklistSchemaError(logError.message) ??
        (logError.code === "PGRST116"
          ? "Daily log was not found for this project."
          : logError.message),
    };
  }

  if (!dailyLog) {
    return { error: "Daily log was not found for this project." };
  }

  const deleteError = await deleteExistingSectionRows(dailyLogId);
  if (deleteError) {
    return { error: `Daily log saved, but existing section rows were not replaced: ${deleteError}` };
  }

  const weatherRows: DailyLogWeatherInsert[] = params.weather.map((entry) => ({
    daily_log_id: dailyLogId,
    area: cleanString(entry.area),
    time_observed: cleanTime(entry.timeObserved),
    delay: Boolean(entry.delay),
    location: cleanString(entry.location),
    sky: cleanString(entry.sky),
    temperature: cleanNumber(entry.temperature),
    calamity: cleanString(entry.calamity),
    average: cleanString(entry.average),
    precipitation: cleanString(entry.precipitation),
    wind: cleanString(entry.wind),
    ground_or_sea: cleanString(entry.groundOrSea),
    comments: cleanString(entry.comments),
  }));

  const manpowerRows: DailyLogManpowerInsert[] = params.manpower.map((entry) => ({
    daily_log_id: dailyLogId,
    area: cleanString(entry.area),
    company_id: cleanString(entry.companyId),
    trade: cleanString(entry.trade),
    workers_count: entry.workersCount,
    hours_worked: cleanNumber(entry.hoursWorked),
    cost_code: cleanString(entry.costCode),
    location: cleanString(entry.location),
    comments: cleanString(entry.comments),
    issue_flag: Boolean(entry.issueFlag),
  }));

  const equipmentRows: DailyLogEquipmentInsert[] = params.equipment.map((entry) => ({
    daily_log_id: dailyLogId,
    area: cleanString(entry.area),
    equipment_name: entry.equipmentName.trim(),
    hours_operated: cleanNumber(entry.hoursOperated),
    hours_idle: cleanNumber(entry.hoursIdle),
    cost_code: cleanString(entry.costCode),
    location: cleanString(entry.location),
    inspected: Boolean(entry.inspected),
    inspection_time: cleanTime(entry.inspectionTime),
    comments: cleanString(entry.comments),
    notes: cleanString(entry.comments),
  }));

  const noteRows: DailyLogNoteInsert[] = params.notes.map((entry) => ({
    daily_log_id: dailyLogId,
    area: cleanString(entry.area),
    category: cleanString(entry.category),
    location: cleanString(entry.location),
    description: entry.description.trim(),
    issue_flag: Boolean(entry.issueFlag),
  }));

  const insertJobs = [
    weatherRows.length > 0
      ? supabase.from("daily_log_weather").insert(weatherRows)
      : Promise.resolve({ error: null }),
    manpowerRows.length > 0
      ? supabase.from("daily_log_manpower").insert(manpowerRows)
      : Promise.resolve({ error: null }),
    equipmentRows.length > 0
      ? supabase.from("daily_log_equipment").insert(equipmentRows)
      : Promise.resolve({ error: null }),
    noteRows.length > 0
      ? supabase.from("daily_log_notes").insert(noteRows)
      : Promise.resolve({ error: null }),
  ];

  const insertResults = await Promise.all(insertJobs);
  const insertError = insertResults.find((result) => result.error);
  if (insertError?.error) {
    return { error: `Daily log saved, but section rows failed: ${insertError.error.message}` };
  }

  revalidatePath(`/${params.projectId}/daily-log`);
  revalidatePath(`/${params.projectId}/daily-log/${dailyLogId}/edit`);
  return { success: true, data: dailyLog } as const;
}
