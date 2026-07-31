import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { NextResponse } from "next/server";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { buildRequestProjectCreationAttribution } from "@/lib/projects/creation-attribution";
import {
  provisionProjectCreatorAccess,
  resolveProjectCreatorAccess,
} from "@/lib/projects/project-creator-access";
import { buildBootstrapProjectIdentity } from "./bootstrap-identity";

/**
 * Project Bootstrap API
 *
 * Creates a fully populated test project with:
 * - Project
 * - Prime Contract
 * - Budget Codes + Line Items
 * - Commitment (Subcontractor)
 * - Change Event
 * - Change Order
 * - Budget Modification
 *
 * Usage: POST /api/projects/bootstrap
 * Payload: { name?: string, template?: 'warehouse' | 'commercial' }
 */

interface BootstrapResponse {
  project: any;
  contract: any;
  budgetCodes: any[];
  budgetLineItems: any[];
  commitment: any;
  changeEvent: any;
  changeOrder: any;
  budgetModification: any;
}

const WAREHOUSE_TEMPLATE = {
  name: "Test Warehouse Project",
  projectNumber: "WH-2025-001",
  description: "Auto-generated warehouse construction project for testing",
  state: "California",
  city: "San Francisco",
  address: "123 Test St",
  zip: "94102",
  estimatedValue: 2500000,

  contract: {
    contractNumber: "PC-001",
    title: "Prime Contract - Warehouse Construction",
    originalAmount: 2500000,
    retentionPercentage: 10,
    scopeOfWork:
      "Complete construction of 50,000 sq ft warehouse facility including foundation, structure, MEP systems, and finishes.",
  },

  costCodes: [
    { id: "01-100", description: "General Requirements", amount: 125000 },
    { id: "02-200", description: "Site Work", amount: 200000 },
    { id: "03-300", description: "Concrete", amount: 450000 },
    { id: "04-400", description: "Masonry", amount: 150000 },
    { id: "05-500", description: "Metals", amount: 300000 },
    { id: "06-600", description: "Wood & Plastics", amount: 100000 },
    { id: "07-700", description: "Thermal & Moisture", amount: 175000 },
    { id: "08-800", description: "Doors & Windows", amount: 125000 },
    { id: "09-900", description: "Finishes", amount: 225000 },
    { id: "21-000", description: "Fire Suppression", amount: 150000 },
    { id: "22-000", description: "Plumbing", amount: 175000 },
    { id: "23-000", description: "HVAC", amount: 200000 },
    { id: "26-000", description: "Electrical", amount: 225000 },
  ],

  commitment: {
    commitmentNumber: "COM-001",
    title: "Concrete Subcontractor",
    originalAmount: 450000,
    scopeOfWork:
      "Supply and install all concrete work including slab-on-grade, walls, and elevated decks.",
  },

  changeEvent: {
    title: "Owner Requested Storage Expansion",
    description:
      "Owner requests additional 5,000 sq ft storage area in northwest corner",
    romCostImpact: 125000,
    romScheduleImpact: 14, // days
  },

  changeOrder: {
    title: "PCO-001 - Storage Expansion",
    description:
      "Additional structural steel, concrete, and roofing for 5,000 sq ft expansion",
    amount: 125000,
  },
};

export const POST = withApiGuardrails(
  "projects/bootstrap#POST",
  async ({ request, requestId }) => {
    const supabase = await createClient();
    const serviceClient = createServiceClient();
    const body = await request.json().catch(() => ({}));

    const template = body.template || "warehouse";
    const customName = body.name;

    // Get current user
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "projects/bootstrap#POST",
        message: "Authentication required.",
      });
    }

    // Use warehouse template (only one for now)
    const projectTemplate = WAREHOUSE_TEMPLATE;
    const creatorAccess = await resolveProjectCreatorAccess({
      serviceClient,
      authUserId: user.id,
      where: "projects/bootstrap#POST",
    });

    const { projectName, projectNumber } = buildBootstrapProjectIdentity({
      templateName: projectTemplate.name,
      templateProjectNumber: projectTemplate.projectNumber,
      customName,
      requestId,
    });

    // ============================================
    // 1. CREATE PROJECT
    // ============================================
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .insert({
        name: projectName,
        project_number: projectNumber,
        summary: projectTemplate.description,
        state: projectTemplate.state,
        address: projectTemplate.address,
        budget: projectTemplate.estimatedValue,
        ...buildRequestProjectCreationAttribution({
          source: "test_bootstrap",
          actorUserId: user.id,
          requestId,
        }),
      })
      .select()
      .single();

    if (projectError) {
      return NextResponse.json(
        { error: `Failed to create project: ${projectError.message}` },
        { status: 500 },
      );
    }

    const membershipError = await provisionProjectCreatorAccess({
      serviceClient,
      projectId: project.id,
      access: creatorAccess,
    });

    if (membershipError) {
      const { error: cleanupError } = await serviceClient
        .from("projects")
        .delete()
        .eq("id", project.id);

      throw new GuardrailError({
        code: "INTERNAL_ERROR",
        where: "projects/bootstrap#POST",
        message:
          "Bootstrap project was not created because creator access could not be assigned.",
        status: 500,
        severity: "high",
        details: {
          projectId: project.id,
          membershipReason: membershipError.message,
          cleanupReason: cleanupError?.message ?? null,
        },
        cause: membershipError,
      });
    }

    // ============================================
    // 2. CREATE CLIENT (OWNER)
    // ============================================
    const { data: client, error: clientError } = await supabase
      .from("companies")
      .insert({
        name: "Test Owner LLC",
        type: "client",
        status: "active",
      })
      .select()
      .single();

    // ============================================
    // 3. CREATE PRIME CONTRACT
    // ============================================
    let contract = null;
    if (!clientError && client) {
      const { data: contractData, error: contractError } = await supabase
        .from("prime_contracts")
        .insert({
          contract_number: `${projectTemplate.contract.contractNumber}-${Date.now()}`,
          title: projectTemplate.contract.title,
          client_id: client.id,
          project_id: project.id,
          status: "approved",
          original_contract_value: projectTemplate.contract.originalAmount,
          revised_contract_value: projectTemplate.contract.originalAmount,
          retention_percentage: projectTemplate.contract.retentionPercentage,
          executed: true,
          description: projectTemplate.contract.scopeOfWork,
        })
        .select()
        .single();

      if (!contractError) {
        contract = contractData;
      }
    }

    // ============================================
    // 4. ENSURE COST CODES EXIST
    // ============================================
    const { data: existingCostCodes, error: costCodeError } = await supabase
      .from("cost_codes")
      .select("id, title, division_title")
      .eq("status", "Active")
      .limit(10);

    if (costCodeError || !existingCostCodes || existingCostCodes.length === 0) {
      return NextResponse.json(
        { error: "Failed to load cost codes for bootstrap project" },
        { status: 500 },
      );
    }

    const { data: costTypes } = await supabase
      .from("cost_code_types")
      .select("id, code")
      .order("code", { ascending: true });

    const defaultCostTypeId =
      costTypes?.find((type) => type.code === "R")?.id || costTypes?.[0]?.id;

    if (!defaultCostTypeId) {
      return NextResponse.json(
        { error: "Failed to load cost types for bootstrap project" },
        { status: 500 },
      );
    }

    // ============================================
    // 5. CREATE BUDGET CODES + LINE ITEMS
    // ============================================
    const budgetCodes = [];
    const budgetLineItems = [];

    for (const costCode of existingCostCodes) {
      // Create budget_code
      const { data: budgetCode, error: bcError } = await supabase
        .from("project_budget_codes")
        .insert({
          project_id: project.id,
          cost_code_id: costCode.id,
          sub_job_id: null,
          cost_type_id: defaultCostTypeId,
          description: costCode.title || costCode.id,
          created_by: user.id,
        })
        .select()
        .single();

      if (bcError) {
        continue; // Skip if duplicate
      }

      budgetCodes.push(budgetCode);

      // Create budget_line_item
      const { data: lineItem, error: liError } = await supabase
        .from("budget_lines")
        .insert({
          project_id: project.id,
          project_budget_code_id: budgetCode.id,
          cost_code_id: costCode.id,
          cost_type_id: defaultCostTypeId,
          description: costCode.title || costCode.id,
          original_amount: 100000,
          forecasting_enabled: true,
          created_by: user.id,
        })
        .select()
        .single();

      if (liError) {
        continue;
      }

      budgetLineItems.push(lineItem);
    }

    // Refresh materialized view
    await supabase.rpc("refresh_budget_rollup", { p_project_id: project.id });

    // ============================================
    // 6-9. OPTIONAL FINANCIAL OBJECTS (SKIPPED)
    // ============================================
    // These require additional schema-specific setup and are not necessary for
    // budget-focused tests. Keep them as null placeholders for now.
    const commitment = null;
    const changeEvent = null;
    const changeOrder = null;

    // ============================================
    // 10. CREATE BUDGET MODIFICATION (PLACEHOLDER)
    // ============================================
    // Budget modifications typically require more complex logic
    // For now, we'll return null
    const budgetModification = null;

    // ============================================
    // RESPONSE
    // ============================================
    const response: BootstrapResponse = {
      project,
      contract,
      budgetCodes,
      budgetLineItems,
      commitment,
      changeEvent,
      changeOrder,
      budgetModification,
    };

    return NextResponse.json(response, { status: 201 });
  },
);
