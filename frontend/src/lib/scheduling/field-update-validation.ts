export type FieldScheduleUpdateInput = {
  actual_start_date?: string | null;
  actual_finish_date?: string | null;
  forecast_start_date?: string | null;
  forecast_finish_date?: string | null;
  remaining_duration_days?: number | null;
  delay_reason?: string | null;
  note?: string | null;
  attachment_urls?: string[];
};

type ValidationResult =
  | { value: FieldScheduleUpdateInput; error?: never }
  | { error: string; value?: never };

const dateKeys = [
  "actual_start_date",
  "actual_finish_date",
  "forecast_start_date",
  "forecast_finish_date",
] as const;

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

export function validateFieldScheduleUpdate(input: unknown): ValidationResult {
  if (!input || typeof input !== "object" || Array.isArray(input)) return { error: "Field update payload must be an object." };
  const raw = input as Record<string, unknown>;
  const value: FieldScheduleUpdateInput = {};

  for (const key of dateKeys) {
    const candidate = raw[key];
    if (candidate === undefined || candidate === null || candidate === "") continue;
    if (typeof candidate !== "string" || !isIsoDate(candidate)) return { error: `${key} must be a valid ISO date.` };
    value[key] = candidate;
  }

  if (raw.remaining_duration_days !== undefined && raw.remaining_duration_days !== null) {
    if (typeof raw.remaining_duration_days !== "number" || !Number.isFinite(raw.remaining_duration_days) || raw.remaining_duration_days < 0) {
      return { error: "remaining_duration_days must be zero or greater." };
    }
    if (!Number.isInteger(raw.remaining_duration_days)) {
      return { error: "remaining_duration_days must be a whole number of days." };
    }
    value.remaining_duration_days = raw.remaining_duration_days;
  }

  for (const key of ["delay_reason", "note"] as const) {
    const candidate = raw[key];
    if (candidate === undefined || candidate === null || candidate === "") continue;
    if (typeof candidate !== "string") return { error: `${key} must be text.` };
    value[key] = candidate.trim();
  }

  if (raw.attachment_urls !== undefined) {
    if (!Array.isArray(raw.attachment_urls) || raw.attachment_urls.some((url) => typeof url !== "string" || !URL.canParse(url))) {
      return { error: "attachment_urls must contain valid URLs." };
    }
    value.attachment_urls = raw.attachment_urls;
  }

  const changesForecast = value.forecast_start_date !== undefined
    || value.forecast_finish_date !== undefined
    || value.remaining_duration_days !== undefined;
  if (changesForecast && !value.delay_reason) {
    return { error: "Provide a delay reason when changing forecast dates or remaining duration." };
  }

  if (Object.keys(value).length === 0) return { error: "Provide at least one field update." };
  return { value };
}
