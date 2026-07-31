#!/usr/bin/env tsx

import fs from "fs";
import path from "path";
import * as dotenv from "dotenv";
import Papa from "papaparse";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

type CsvRow = {
  "Item Number"?: string;
  Title?: string;
  "Assigned To"?: string;
  Priority?: string;
  "Due Date"?: string;
  Category?: string;
  Status?: string;
  Location?: string;
};

const normalize = (value: string | undefined | null): string => (value ?? "").trim();

const parseDueDate = (raw: string): string | null => {
  const value = normalize(raw);
  if (!value) return null;
  const parts = value.split("/").map((part) => part.trim());
  if (parts.length !== 3) return null;

  const [m, d, y] = parts;
  const month = Number(m);
  const day = Number(d);
  const year = Number(y);
  if (!month || !day || !year) return null;

  const iso = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const dt = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(dt.getTime())) return null;
  return iso;
};

const mapPriority = (raw: string): string => {
  const value = normalize(raw).toLowerCase();
  if (value === "low" || value === "medium" || value === "high") return value;
  return "medium";
};

const mapStatus = (raw: string): string => {
  const value = normalize(raw).toLowerCase();
  if (value === "assigned") return "initiated";
  if (value === "not resolved" || value === "open") return "work_required";
  if (value === "resolved" || value === "closed") return "closed";
  return "initiated";
};

function getArg(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  if (index === -1 || index === process.argv.length - 1) return undefined;
  return process.argv[index + 1];
}

async function main() {
  const projectIdArg = getArg("--project-id");
  const csvPathArg = getArg("--csv");

  if (!projectIdArg || !csvPathArg) {
    throw new Error("Usage: npx tsx scripts/import-punch-list-csv.ts --project-id <number> --csv <absolute-path>");
  }

  const projectId = Number(projectIdArg);
  if (!Number.isInteger(projectId) || projectId <= 0) {
    throw new Error("Invalid --project-id value");
  }

  const csv = fs.readFileSync(csvPathArg, "utf8");
  const parsed = Papa.parse<CsvRow>(csv, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });

  if (parsed.errors.length > 0) {
    throw new Error(`CSV parse failed: ${parsed.errors[0]?.message ?? "unknown error"}`);
  }

  const sourceRows = parsed.data;
  const dedupe = new Set<string>();
  const uniqueRows: CsvRow[] = [];

  for (const row of sourceRows) {
    const key = [
      normalize(row["Item Number"]),
      normalize(row.Title).toLowerCase(),
      normalize(row["Assigned To"]).toLowerCase(),
      normalize(row.Location).toLowerCase(),
      normalize(row["Due Date"]),
      normalize(row.Priority).toLowerCase(),
    ].join("|");

    if (!key.replace(/\|/g, "")) continue;
    if (dedupe.has(key)) continue;
    dedupe.add(key);
    uniqueRows.push(row);
  }

  const { data: maxRows, error: maxError } = await supabase
    .from("punch_items")
    .select("number")
    .eq("project_id", projectId)
    .order("number", { ascending: false })
    .limit(1);

  if (maxError) throw maxError;

  let nextNumber = (maxRows?.[0]?.number ?? 0) + 1;

  const rowsToInsert = uniqueRows.map((row, idx) => {
    const sourceItem = normalize(row["Item Number"]);
    const rawTitle = normalize(row.Title);
    const title = rawTitle || `Untitled punch item (${sourceItem || idx + 1})`;

    return {
      project_id: projectId,
      number: nextNumber++,
      title,
      status: mapStatus(normalize(row.Status)),
      priority: mapPriority(normalize(row.Priority)),
      due_date: parseDueDate(normalize(row["Due Date"])),
      location: normalize(row.Location) || null,
      trade: normalize(row.Category) || null,
      assignee_company: normalize(row["Assigned To"]) || null,
      ball_in_court: normalize(row["Assigned To"]) || null,
      reference: `import:westfield-punch-csv:2026-02-12:src-${sourceItem || "na"}:row-${idx + 1}`,
      description: null,
      is_deleted: false,
      is_private: false,
      created_by: null,
      updated_by: null,
    };
  });

  const batchSize = 100;
  let inserted = 0;
  for (let i = 0; i < rowsToInsert.length; i += batchSize) {
    const batch = rowsToInsert.slice(i, i + batchSize);
    const { error } = await supabase.from("punch_items").insert(batch);
    if (error) throw new Error(`Insert failed at batch ${i / batchSize + 1}: ${error.message}`);
    inserted += batch.length;
  }

  console.log(
    JSON.stringify(
      {
        projectId,
        sourceRows: sourceRows.length,
        uniqueRows: uniqueRows.length,
        inserted,
        skippedDuplicates: sourceRows.length - uniqueRows.length,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

