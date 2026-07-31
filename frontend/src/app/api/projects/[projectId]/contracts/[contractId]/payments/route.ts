import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * GET /api/projects/[projectId]/contracts/[contractId]/payments
 * Returns all payments received for a prime contract
 */
export const GET = withApiGuardrails(
  "projects/[projectId]/contracts/[contractId]/payments#GET",
  async ({ request, params }) => {
  
    const { projectId, contractId } = await params;
    const supabase = await createClient();
    const projectIdNum = parseInt(projectId, 10);

    const { data: contract, error: contractError } = await supabase
      .from("prime_contracts")
      .select("id")
      .eq("id", contractId)
      .eq("project_id", projectIdNum)
      .maybeSingle();

    // PGRST116 = "Cannot coerce the result to a single JSON object" — the
    // contract row does not exist (or is not visible under RLS). That is a
    // not-found condition, not a malformed request, so it must return 404 the
    // same way the contract detail route does. Only genuine DB errors are 400.
    if (contractError && contractError.code !== "PGRST116") {
      return NextResponse.json(
        { error: "Failed to verify contract before fetching payments", details: contractError.message },
        { status: 400 },
      );
    }

    if (!contract) {
      return NextResponse.json(
        { error: "Contract not found" },
        { status: 404 },
      );
    }

    const { data, error } = await supabase
      .from("prime_contract_payments")
      .select(
        `
        *,
        payment_application:prime_contract_payment_applications(
          id,
          application_number,
          amount,
          status
        )
      `,
      )
      .eq("contract_id", contractId)
      .eq("project_id", projectIdNum)
      .order("payment_date", { ascending: false });

    if (error) {
      return NextResponse.json(
        { error: "Failed to fetch payments", details: error.message },
        { status: 400 },
      );
    }

    // `contract_id` is the canonical relationship. Acumatica payment notes are
    // not guaranteed to contain a contract number and cannot safely override a
    // resolved foreign key on multi-contract projects.
    return NextResponse.json(data ?? []);
    },
);

/**
 * POST /api/projects/[projectId]/contracts/[contractId]/payments
 * Prime contract payments are read-only Acumatica inbound records.
 */
export const POST = withApiGuardrails(
  "projects/[projectId]/contracts/[contractId]/payments#POST",
  async () => {
    throw new GuardrailError({
      code: "READ_ONLY_RESOURCE",
      where: "projects/[projectId]/contracts/[contractId]/payments#POST",
      message:
        "Prime contract payments are synced from Acumatica and cannot be created in Alleato.",
      status: 405,
      severity: "low",
    });
  },
);
