import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import {
  normalizePdfScheduleText,
  normalizeScheduleRows,
  type ScheduleImportPreview,
} from "@/lib/scheduling/schedule-import-preview";
import { getApiRouteUser } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import * as XLSX from "xlsx";

export const runtime = "nodejs";
export const maxDuration = 60;

const SCHEDULE_IMPORT_FILE_LIMIT_BYTES = 50 * 1024 * 1024;

function normalizeBackendUrl(): string {
  const backendUrl = (process.env.BACKEND_URL || process.env.PYTHON_BACKEND_URL || "").trim();
  if (!backendUrl) {
    throw new GuardrailError({
      code: "CONFIGURATION_ERROR",
      where: "projects/[projectId]/scheduling/tasks/preview#POST",
      message: "Missing backend URL. Set BACKEND_URL or PYTHON_BACKEND_URL.",
      status: 503,
      severity: "high",
    });
  }
  return backendUrl.replace(/\/+$/, "");
}

function getAdminApiKey(): string {
  const adminKey = process.env.ADMIN_API_KEY?.trim();
  if (!adminKey) {
    throw new GuardrailError({
      code: "CONFIGURATION_ERROR",
      where: "projects/[projectId]/scheduling/tasks/preview#POST",
      message: "ADMIN_API_KEY is not configured.",
      status: 503,
      severity: "high",
    });
  }
  return adminKey;
}

function parseBackendError(status: number, body: unknown): string {
  if (body && typeof body === "object" && "detail" in body) {
    const detail = (body as { detail?: unknown }).detail;
    if (typeof detail === "string" && detail.trim()) return detail;
  }
  return `PDF schedule extraction failed (HTTP ${status}).`;
}

async function extractPdfTextViaBackend(file: File, projectId: string): Promise<string> {
  const formData = new FormData();
  formData.append("file", file, file.name);

  const extractUrl = new URL("/api/scheduling/schedule-pdf/extract", normalizeBackendUrl());
  extractUrl.searchParams.set("project_id", projectId);

  const response = await fetch(extractUrl, {
    method: "POST",
    headers: {
      "x-admin-api-key": getAdminApiKey(),
    },
    body: formData,
  });

  const payload = await response.json().catch(() => ({})) as {
    text?: string;
    detail?: string;
  };

  if (!response.ok) {
    throw new Error(parseBackendError(response.status, payload));
  }

  if (!payload.text?.trim()) {
    throw new Error("No readable text was extracted from this PDF. Upload MPP, XML, Excel, or CSV instead.");
  }

  return payload.text;
}

function parseTabularFile(file: File, buffer: Buffer): ScheduleImportPreview {
  const lowerName = file.name.toLowerCase();
  const sourceFormat = lowerName.endsWith(".csv") ? "csv" : "xlsx";
  const workbook = sourceFormat === "csv"
    ? XLSX.read(buffer.toString("utf-8"), { type: "string", cellDates: true })
    : XLSX.read(buffer, { type: "buffer", cellDates: true });

  const worksheetName = workbook.SheetNames[0];
  if (!worksheetName) {
    throw new Error("No worksheet was found in this schedule file.");
  }

  const worksheet = workbook.Sheets[worksheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
    defval: "",
    raw: false,
  });

  if (rows.length === 0) {
    throw new Error("No rows were found in this schedule file.");
  }

  return normalizeScheduleRows(rows, sourceFormat);
}

export const POST = withApiGuardrails<{ projectId: string }>(
  "projects/[projectId]/scheduling/tasks/preview#POST",
  async ({ request, params }) => {
    const { projectId } = await params;
    const user = await getApiRouteUser();

    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "projects/[projectId]/scheduling/tasks/preview#POST",
        message: "Authentication required.",
      });
    }

    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "A schedule source file is required." }, { status: 400 });
    }

    if (file.size > SCHEDULE_IMPORT_FILE_LIMIT_BYTES) {
      return NextResponse.json(
        { error: "Schedule files must be smaller than 50 MB." },
        { status: 413 },
      );
    }

    const lowerName = file.name.toLowerCase();
    const isTabular = lowerName.endsWith(".xlsx") || lowerName.endsWith(".csv");
    const isPdf = lowerName.endsWith(".pdf") || file.type === "application/pdf";

    if (!isTabular && !isPdf) {
      return NextResponse.json(
        { error: "Upload a schedule file as .mpp, .mpt, .xml, .xlsx, .csv, or .pdf." },
        { status: 400 },
      );
    }

    try {
      const preview = isPdf
        ? normalizePdfScheduleText(await extractPdfTextViaBackend(file, projectId))
        : parseTabularFile(file, Buffer.from(await file.arrayBuffer()));

      return NextResponse.json(preview);
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Unable to preview schedule import file." },
        { status: 422 },
      );
    }
  },
);
