/**
 * Loads Acumatica actual costs from the already-synced `acumatica_project_budgets`
 * table (PM APP Supabase, refreshed daily by the Render Acumatica sync) for the
 * Phase 2 reconciliation diff. No live Acumatica calls.
 *
 * Grain: the table is unique per `external_key` = `project_code|PROJECT|cost_code|TYPE|accountGroup|desc`,
 * so there are multiple rows per cost code (one per cost type L/E/M/S/X, plus
 * empty-type rollup rows). We key by project + cost code + cost-type letter and
 * skip the empty-type rollups to avoid double counting.
 */

import "server-only";

import { serviceDb } from "@/lib/supabase/service-db";
import type { AcumaticaActuals } from "./reconciliation";

const PAGE_SIZE = 1000;

export async function loadAcumaticaActuals(): Promise<AcumaticaActuals> {
  const byKey = new Map<string, number>();
  const knownProjectCodes = new Set<string>();

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await serviceDb
      .from("acumatica_project_budgets")
      .select("project_code, cost_code, external_key, actual_amount")
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      throw new Error(`acumatica_project_budgets read failed: ${error.message}`);
    }
    if (!data || data.length === 0) break;

    for (const row of data) {
      const projectCode = row.project_code?.trim();
      if (!projectCode) continue;
      knownProjectCodes.add(projectCode);

      const costType = (row.external_key?.split("|")[3] ?? "").trim();
      if (!costType || !row.cost_code) continue; // skip rollup rows

      const key = `${projectCode}|${row.cost_code}|${costType}`;
      const cents = Math.round(Number(row.actual_amount ?? 0) * 100);
      byKey.set(key, (byKey.get(key) ?? 0) + cents);
    }

    if (data.length < PAGE_SIZE) break;
  }

  return { byKey, knownProjectCodes };
}
