import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { NextResponse } from "next/server";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { apiErrorResponse } from "@/lib/api-error";
import {
  renderPrimeCoPdfBuffer,
  type PrimeCoPdfData,
  type PrimeCoPdfLineItem,
} from "@/lib/prime-co-pdf";

// @react-pdf/renderer requires Node runtime
export const runtime = "nodejs";

export const GET = withApiGuardrails<{ projectId: string; primeCoId: string }>(
  "projects/[projectId]/prime-contract-change-orders/[primeCoId]/pdf#GET",
  async ({ request, params }) => {
    const supabase = await createClient();
    const { projectId, primeCoId } = params;

    const user = await getApiRouteUser();

    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "projects/[projectId]/prime-contract-change-orders/[primeCoId]/pdf#GET",
        message: "Authentication required.",
      });
    }

    const projectIdNum = parseInt(projectId, 10);
    const primeCoIdNum = parseInt(primeCoId, 10);

    if (!Number.isFinite(primeCoIdNum) || primeCoIdNum <= 0) {
      return NextResponse.json({ error: "Invalid change order ID" }, { status: 400 });
    }

    // ── 1. Fetch the PCCO ──
    const { data: pcco, error: pccoError } = await supabase
      .from("prime_contract_change_orders")
      .select("*")
      .eq("id", primeCoIdNum)
      .eq("project_id", projectIdNum)
      .single();

    if (pccoError || !pcco) {
      if (pccoError?.code === "PGRST116") {
        return NextResponse.json({ error: "Change order not found" }, { status: 404 });
      }
      return apiErrorResponse(pccoError ?? new Error("Not found"));
    }

    // ── 2. Fetch line items ──
    const { data: lineItemRows } = await supabase
      .from("pcco_line_items")
      .select("id, cost_code, description, line_amount")
      .eq("pcco_id", primeCoIdNum)
      .order("id", { ascending: true });

    const lineItems: PrimeCoPdfLineItem[] = (lineItemRows ?? []).map((li) => ({
      id: li.id,
      cost_code: li.cost_code ?? null,
      description: li.description ?? null,
      line_amount: li.line_amount ?? null,
    }));

    // ── 3. Fetch project info ──
    const { data: project } = await supabase
      .from("projects")
      .select("id, name, project_number, address, state, company_id")
      .eq("id", projectIdNum)
      .single();

    // ── 4. Fetch prime contract (for contract number + owner company) ──
    let contractNumber: string | null = null;
    let contractTitle: string | null = null;
    let ownerCompanyId: string | null = null;

    if (pcco.prime_contract_id || pcco.contract_id) {
      const contractId = pcco.prime_contract_id ?? pcco.contract_id;
      const { data: contract } = await supabase
        .from("prime_contracts")
        .select("id, contract_number, title, client_id")
        .eq("id", contractId as string)
        .single();
      if (contract) {
        contractNumber = contract.contract_number ?? null;
        contractTitle = contract.title ?? null;
        ownerCompanyId = contract.client_id ?? null;
      }
    }

    // Fall back to project's company_id if not found on contract
    if (!ownerCompanyId && project?.company_id) {
      ownerCompanyId = project.company_id;
    }

    // ── 5. Fetch owner (client) company ──
    let ownerName: string | null = null;
    let ownerAddress: string | null = null;
    let ownerCity: string | null = null;
    let ownerState: string | null = null;
    let ownerZip: string | null = null;

    if (ownerCompanyId) {
      const { data: ownerCompany } = await supabase
        .from("companies")
        .select("name, address, city, state, zip_code")
        .eq("id", ownerCompanyId)
        .single();
      if (ownerCompany) {
        ownerName = ownerCompany.name ?? null;
        ownerAddress = ownerCompany.address ?? null;
        ownerCity = ownerCompany.city ?? null;
        ownerState = ownerCompany.state ?? null;
        ownerZip = ownerCompany.zip_code ?? null;
      }
    }

    // ── 6. Assemble PDF data ──
    const pdfData: PrimeCoPdfData = {
      id: pcco.id,
      pcco_number: pcco.pcco_number ?? null,
      revision: pcco.revision ?? null,
      title: pcco.title,
      description: pcco.description ?? null,
      change_reason: pcco.change_reason ?? null,
      status: pcco.status ?? null,
      total_amount: pcco.total_amount ?? null,
      executed: pcco.executed ?? null,
      paid_in_full: pcco.paid_in_full ?? null,
      field_change: pcco.field_change ?? null,
      schedule_impact: pcco.schedule_impact ?? null,
      location: pcco.location ?? null,
      reference: pcco.reference ?? null,
      request_received_from: pcco.request_received_from ?? null,
      signed_co_received_date: pcco.signed_co_received_date ?? null,
      created_at: pcco.created_at ?? null,
      created_by: pcco.created_by ?? null,
      line_items: lineItems,
      // Contract
      contract_number: contractNumber,
      contract_title: contractTitle,
      linked_change_order: null,
      accounting_method: "Amount Based",
      // Project
      project_name: project?.name ?? null,
      project_number: project?.project_number ?? null,
      project_address: project?.address ?? null,
      project_city: null,
      project_state: project?.state ?? null,
      project_zip: null,
      // Owner
      owner_name: ownerName,
      owner_address: ownerAddress,
      owner_city: ownerCity,
      owner_state: ownerState,
      owner_zip: ownerZip,
    };

    // ── 7. Render PDF ──
    const pdfBuffer = await renderPrimeCoPdfBuffer(pdfData);
    const filename = `PCO-${pcco.pcco_number ?? primeCoIdNum}-${pcco.title.replace(/[^a-zA-Z0-9]/g, "-").slice(0, 40)}.pdf`;

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-store",
      },
    });
  },
);
