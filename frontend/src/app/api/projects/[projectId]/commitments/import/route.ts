import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { NextResponse } from "next/server";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import * as XLSX from "xlsx";
import { normalizeSubcontractStatus } from "@/lib/db/subcontracts";
import {
  buildPurchaseOrderInsert,
  buildSubcontractInsert,
  isPlaceholderCompanyId,
  isPurchaseOrder,
  normalizeCompanyName,
  normalizeHeader,
  parseRow,
  resolveCompanyId,
  type CompanyRef,
} from "@/lib/db/commitment-import";
import { logger } from "@/lib/logger";

export const POST = withApiGuardrails<{ projectId: string }>(
  "projects/[projectId]/commitments/import#POST",
  async ({ request, params }) => {
    const { projectId } = await params;
    const projectIdNum = parseInt(projectId, 10);

    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "projects/[projectId]/commitments/import#POST",
        message: "Authentication required.",
      });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "No file uploaded." }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: "buffer", cellDates: false });

    // Find the right sheet — prefer "Commitments", fall back to first sheet
    const sheetName =
      workbook.SheetNames.find((n) => n.toLowerCase().includes("commitment")) ??
      workbook.SheetNames[0];

    if (!sheetName) {
      return NextResponse.json({ error: "No sheet found in file." }, { status: 400 });
    }

    const sheet = workbook.Sheets[sheetName];
    const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      defval: "",
      raw: true,
    });

    if (rawRows.length === 0) {
      return NextResponse.json({ error: "Sheet has no data rows." }, { status: 400 });
    }

    // Normalize all header keys to lowercase
    const normalizedRows = rawRows.map((row) => {
      const normalized: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(row)) {
        normalized[normalizeHeader(key)] = val;
      }
      return normalized;
    });

    const rows = normalizedRows.map(parseRow).filter((r): r is NonNullable<typeof r> => r !== null);
    if (rows.length === 0) {
      return NextResponse.json({ error: "No valid commitment rows found." }, { status: 400 });
    }

    const supabase = await createClient();

    // Load existing companies for name → id resolution.
    const { data: companyRows, error: companyError } = await supabase
      .from("companies")
      .select("id, name");
    if (companyError) {
      throw new GuardrailError({
        code: "DB_ERROR",
        where: "projects/[projectId]/commitments/import#POST",
        message: `Failed to load companies: ${companyError.message}`,
      });
    }
    const companies: CompanyRef[] = companyRows ?? [];

    // Auto-create companies named in the file that don't exist yet. Procore /
    // Job Planner exports carry company NAMES, not ids — without this the import
    // silently drops every row whose vendor isn't already in the directory.
    const namesNeedingCreate = new Map<string, string>(); // normalized -> display name
    for (const row of rows) {
      const hasExplicitId = row.companyId && !isPlaceholderCompanyId(row.companyId);
      if (hasExplicitId) continue;
      if (!row.companyName) continue;
      if (resolveCompanyId(row, companies)) continue;
      const key = normalizeCompanyName(row.companyName);
      if (key && !namesNeedingCreate.has(key)) {
        namesNeedingCreate.set(key, row.companyName);
      }
    }

    const createdCompanies: string[] = [];
    if (namesNeedingCreate.size > 0) {
      const { data: inserted, error: insertCompaniesError } = await supabase
        .from("companies")
        .insert(
          Array.from(namesNeedingCreate.values()).map((name) => ({
            name,
            status: "active",
            is_vendor: true,
            type: "vendor",
          })),
        )
        .select("id, name");
      if (insertCompaniesError) {
        throw new GuardrailError({
          code: "DB_ERROR",
          where: "projects/[projectId]/commitments/import#POST",
          message: `Failed to create companies: ${insertCompaniesError.message}`,
        });
      }
      for (const c of inserted ?? []) {
        companies.push(c);
        createdCompanies.push(c.name);
      }
    }

    const results = { imported: 0, failed: 0, errors: [] as string[] };

    for (const row of rows) {
      const companyId = resolveCompanyId(row, companies);
      if (!companyId) {
        results.failed++;
        results.errors.push(
          `${row.number}: could not resolve company "${row.companyName || row.companyId}" — skipped`,
        );
        continue;
      }

      const status = normalizeSubcontractStatus(row.status);
      const isPO = isPurchaseOrder(row.type);

      const { data: created, error: insertError } = isPO
        ? await supabase
            .from("purchase_orders")
            .insert(buildPurchaseOrderInsert(row, companyId, status, projectIdNum, user.id))
            .select("id")
            .single()
        : await supabase
            .from("subcontracts")
            .insert(buildSubcontractInsert(row, companyId, status, projectIdNum, user.id))
            .select("id")
            .single();

      if (insertError || !created) {
        const msg = insertError?.message ?? "unknown error";
        logger.error({ msg: `[commitments/import] failed to insert ${row.number}`, error: msg });
        results.failed++;
        results.errors.push(`${row.number}: ${msg}`);
        continue;
      }

      // Create a single SOV item for the original amount.
      if (row.originalAmount > 0) {
        const sovDescription = row.costCodeDescription || row.description || row.title || row.number;
        const sovError = isPO
          ? (
              await supabase.from("purchase_order_sov_items").insert({
                purchase_order_id: created.id,
                line_number: 1,
                description: sovDescription,
                amount: row.originalAmount,
                ...(row.costCode ? { budget_code: row.costCode } : {}),
              })
            ).error
          : (
              await supabase.from("subcontract_sov_items").insert({
                subcontract_id: created.id,
                line_number: 1,
                description: sovDescription,
                amount: row.originalAmount,
                ...(row.costCode ? { budget_code: row.costCode } : {}),
              })
            ).error;

        if (sovError) {
          logger.error({
            msg: `[commitments/import] SOV insert failed for ${row.number}`,
            error: sovError.message,
          });
          // Non-fatal — commitment was created, just without SOV.
        }
      }

      results.imported++;
    }

    logger.info({
      msg: `[commitments/import] project ${projectId}: imported=${results.imported} failed=${results.failed} companiesCreated=${createdCompanies.length}`,
    });

    const parts: string[] = [];
    parts.push(
      results.failed > 0
        ? `Imported ${results.imported} commitments. ${results.failed} failed.`
        : `Successfully imported ${results.imported} commitments.`,
    );
    if (createdCompanies.length > 0) {
      parts.push(
        `Created ${createdCompanies.length} new ${createdCompanies.length === 1 ? "company" : "companies"}.`,
      );
    }

    return NextResponse.json({
      success: results.imported > 0,
      imported: results.imported,
      failed: results.failed,
      errors: results.errors,
      createdCompanies,
      message: parts.join(" "),
    });
  },
);
