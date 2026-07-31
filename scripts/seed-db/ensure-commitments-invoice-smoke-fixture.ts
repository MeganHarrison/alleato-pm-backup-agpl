import { config as loadEnv } from "dotenv";
import { Pool } from "pg";

const PROJECT_ID = 767;
const TARGET_SUBCONTRACT_NUMBER = "SC-2025-005";
const FIXTURE_BILLING_PERIOD_NUMBER = 901;
const FIXTURE_BILLING_PERIOD_NAME = "Smoke Test Commitments Invoice";
const FIXTURE_INVOICE_NUMBER = "SMOKE-COMM-767-001";
const FIXTURE_NOTES =
  "Deterministic smoke-test fixture for commitments invoice detail coverage.";

interface BillingPeriodRow {
  id: string;
  start_date: string;
  end_date: string;
}

interface SubcontractRow {
  id: string;
  contract_number: string;
  default_retainage_percent: number | null;
}

interface SovItemRow {
  id: string;
  amount: string | number | null;
  budget_code: string | null;
  description: string | null;
  sort_order: number | null;
}

function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function resolveDatabaseUrl(): string {
  loadEnv({ path: ".env.local", override: false });
  loadEnv({ path: ".env", override: false });
  loadEnv({ path: "frontend/.env.local", override: false });
  loadEnv({ path: "frontend/.env", override: false });

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("Missing DATABASE_URL in .env or frontend/.env.local");
  }
  return databaseUrl.replace(/[?&]sslmode=require\b/, "");
}

async function main() {
  const pool = new Pool({
    connectionString: resolveDatabaseUrl(),
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
  });

  const client = await pool.connect();

  try {
    await client.query("begin");

    const subcontractResult = await client.query<SubcontractRow>(
      `
        select id, contract_number, default_retainage_percent
        from public.subcontracts
        where project_id = $1
          and contract_number = $2
        limit 1
      `,
      [PROJECT_ID, TARGET_SUBCONTRACT_NUMBER],
    );

    const subcontract = subcontractResult.rows[0];
    if (!subcontract) {
      throw new Error(
        `Seed prerequisite missing: subcontract ${TARGET_SUBCONTRACT_NUMBER} was not found in project ${PROJECT_ID}.`,
      );
    }

    const sovResult = await client.query<SovItemRow>(
      `
        select id, amount, budget_code, description, sort_order
        from public.subcontract_sov_items
        where subcontract_id = $1
        order by sort_order asc nulls last, created_at asc
      `,
      [subcontract.id],
    );

    if (sovResult.rows.length === 0) {
      throw new Error(
        `Seed prerequisite missing: subcontract ${subcontract.id} has no SOV items to derive invoice lines from.`,
      );
    }

    const billingPeriodResult = await client.query<BillingPeriodRow>(
      `
        insert into public.billing_periods (
          project_id,
          period_number,
          name,
          start_date,
          end_date,
          due_date,
          is_closed
        )
        values ($1, $2, $3, $4, $5, $6, false)
        on conflict (project_id, period_number)
        do update set
          name = excluded.name,
          start_date = excluded.start_date,
          end_date = excluded.end_date,
          due_date = excluded.due_date,
          is_closed = false,
          updated_at = now()
        returning id, start_date::text, end_date::text
      `,
      [
        PROJECT_ID,
        FIXTURE_BILLING_PERIOD_NUMBER,
        FIXTURE_BILLING_PERIOD_NAME,
        "2026-04-01",
        "2026-04-30",
        "2026-05-15",
      ],
    );

    const billingPeriod = billingPeriodResult.rows[0];
    if (!billingPeriod) {
      throw new Error("Failed to create or update billing period fixture.");
    }

    const existingFixtureResult = await client.query<{ id: number }>(
      `
        select id
        from public.subcontractor_invoices
        where project_id = $1
          and subcontract_id = $2
          and invoice_number = $3
        order by id asc
      `,
      [PROJECT_ID, subcontract.id, FIXTURE_INVOICE_NUMBER],
    );

    const existingFixtureIds = existingFixtureResult.rows.map((row) => row.id);
    const primaryExistingId = existingFixtureIds[0];
    let invoiceId: number;

    if (primaryExistingId) {
      invoiceId = primaryExistingId;
      await client.query(
        `
          update public.subcontractor_invoices
          set billing_period_id = $2,
              period_start = $3,
              period_end = $4,
              billing_date = $5,
              status = 'approved',
              notes = $6,
              submitted_at = $7,
              approved_at = $8,
              is_retainage_release = false,
              updated_at = now()
          where id = $1
        `,
        [
          invoiceId,
          billingPeriod.id,
          billingPeriod.start_date,
          billingPeriod.end_date,
          "2026-05-01",
          FIXTURE_NOTES,
          "2026-05-02T12:00:00.000Z",
          "2026-05-05T12:00:00.000Z",
        ],
      );
    } else {
      const insertResult = await client.query<{ id: number }>(
        `
          insert into public.subcontractor_invoices (
            project_id,
            subcontract_id,
            billing_period_id,
            invoice_number,
            period_start,
            period_end,
            billing_date,
            status,
            notes,
            submitted_at,
            approved_at,
            is_retainage_release
          )
          values ($1, $2, $3, $4, $5, $6, $7, 'approved', $8, $9, $10, false)
          returning id
        `,
        [
          PROJECT_ID,
          subcontract.id,
          billingPeriod.id,
          FIXTURE_INVOICE_NUMBER,
          billingPeriod.start_date,
          billingPeriod.end_date,
          "2026-05-01",
          FIXTURE_NOTES,
          "2026-05-02T12:00:00.000Z",
          "2026-05-05T12:00:00.000Z",
        ],
      );
      invoiceId = insertResult.rows[0]?.id ?? 0;
      if (!invoiceId) {
        throw new Error("Failed to create the commitments invoice fixture.");
      }
    }

    const duplicateIds = existingFixtureIds.filter((id) => id !== invoiceId);
    if (duplicateIds.length > 0) {
      await client.query(
        `
          delete from public.subcontractor_invoices
          where id = any($1::bigint[])
        `,
        [duplicateIds],
      );
    }

    await client.query(
      "delete from public.subcontractor_invoice_line_items where invoice_id = $1",
      [invoiceId],
    );

    const retainagePercent =
      Number(subcontract.default_retainage_percent ?? 10) || 10;

    for (const [index, item] of sovResult.rows.entries()) {
      const scheduledValue = roundCurrency(Number(item.amount ?? 0));
      const workCompletedPeriod = roundCurrency(
        scheduledValue > 0 ? Math.min(scheduledValue, scheduledValue * 0.25) : 0,
      );
      const retainageAmount = roundCurrency(
        workCompletedPeriod * (retainagePercent / 100),
      );
      const workCompletedPct =
        scheduledValue > 0 ? (workCompletedPeriod / scheduledValue) * 100 : 0;

      await client.query(
        `
          insert into public.subcontractor_invoice_line_items (
            invoice_id,
            description,
            scheduled_value,
            work_completed_previous,
            work_completed_period,
            materials_stored,
            retainage_pct,
            retainage_amount,
            materials_retainage_pct,
            materials_retainage_amount,
            previous_work_retainage,
            previous_materials_retainage,
            retainage_released,
            work_completed_pct,
            sort_order
          )
          values (
            $1, $2, $3, 0, $4, 0, $5, $6, 0, 0, 0, 0, 0, $7, $8
          )
        `,
        [
          invoiceId,
          item.description ??
            item.budget_code ??
            `Commitments smoke fixture line ${index + 1}`,
          scheduledValue,
          workCompletedPeriod,
          retainagePercent,
          retainageAmount,
          roundCurrency(workCompletedPct),
          item.sort_order ?? index + 1,
        ],
      );
    }

    await client.query("commit");

    console.log("Commitments invoice smoke fixture is ready.");
    console.log(`Project: ${PROJECT_ID}`);
    console.log(`Subcontract: ${subcontract.contract_number} (${subcontract.id})`);
    console.log(`Invoice: ${FIXTURE_INVOICE_NUMBER} (#${invoiceId})`);
    console.log(`Route: /${PROJECT_ID}/commitments/${subcontract.id}/invoices/${invoiceId}`);
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error("Failed to ensure commitments invoice smoke fixture.");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
