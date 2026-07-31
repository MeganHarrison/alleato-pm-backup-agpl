/**
 * Loads synced Acumatica AP bills (`acumatica_ap_bills`) for the duplicate-billing
 * and on-hold detectors, plus a project code -> name map for readable labels.
 * No live Acumatica calls — reads the table refreshed by the Render sync.
 */

import "server-only";

import { serviceDb } from "@/lib/supabase/service-db";
import type { AcuApBill } from "./reconciliation";

const PAGE_SIZE = 1000;

export async function loadApBills(): Promise<{
  bills: AcuApBill[];
  projectNameByCode: Map<string, string>;
}> {
  const bills: AcuApBill[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await serviceDb
      .from("acumatica_ap_bills")
      .select(
        "external_key, vendor_id, vendor_ref, amount, balance, project_code, status, hold, post_period, date, reference_nbr, document_type",
      )
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`acumatica_ap_bills read failed: ${error.message}`);
    if (!data || data.length === 0) break;
    for (const row of data) {
      bills.push({
        externalKey: row.external_key,
        vendorId: row.vendor_id,
        vendorRef: row.vendor_ref,
        amount: Number(row.amount ?? 0),
        balance: row.balance == null ? null : Number(row.balance),
        projectCode: row.project_code,
        status: row.status,
        hold: row.hold === true,
        postPeriod: row.post_period,
        date: row.date,
        referenceNbr: row.reference_nbr,
        documentType: row.document_type,
      });
    }
    if (data.length < PAGE_SIZE) break;
  }

  const projectNameByCode = new Map<string, string>();
  const { data: projects } = await serviceDb
    .from("acumatica_projects")
    .select("project_id, description");
  for (const p of projects ?? []) {
    if (p.project_id && p.description) projectNameByCode.set(p.project_id, p.description);
  }

  return { bills, projectNameByCode };
}
