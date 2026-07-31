import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";

import { buildCommitmentCoPdfHtml } from "@/lib/commitment-co-pdf";
import type { Database } from "@/types/database.types";

type TypedSupabaseClient = SupabaseClient<Database>;

type CommitmentTotalsRow = {
  id: string | null;
  contract_number: string | null;
  title: string | null;
  company_name: string | null;
  contract_company_id: string | null;
  total_sov_amount: number | null;
  accounting_method: string | null;
};

type PersonRow = {
  id: string;
  auth_user_id: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
};

function buildPersonName(person: PersonRow | null | undefined): string | null {
  if (!person) return null;
  const fullName = [person.first_name, person.last_name].filter(Boolean).join(" ").trim();
  return fullName || person.email || null;
}

function formatCompanyAddress(company: {
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip_code?: string | null;
} | null): string[] {
  if (!company) return [];
  const cityStateZip = [company.city, company.state, company.zip_code]
    .filter(Boolean)
    .join(", ")
    .replace(", ,", ",");
  return [company.address, cityStateZip].filter((value): value is string => Boolean(value?.trim()));
}

type ProjectAddressRow = {
  address?: string | null;
  state?: string | null;
  summary_metadata?: { city?: string | null; postal_code?: string | null } | null;
};

function formatProjectAddress(project: ProjectAddressRow | null): string[] {
  if (!project) return [];
  const cityStateZip = [project.summary_metadata?.city, project.state, project.summary_metadata?.postal_code]
    .filter(Boolean)
    .join(", ")
    .replace(", ,", ",");
  return [project.address, cityStateZip].filter((value): value is string => Boolean(value?.trim()));
}

function buildSafeFilename(changeOrderNumber: string | null, title: string | null, description: string | null) {
  const safeNumber = changeOrderNumber || "CCO";
  const safeTitle = (title || description || "commitment-change-order")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return `${safeNumber}-${safeTitle || "commitment-change-order"}.pdf`;
}

export async function buildCommitmentChangeOrderPdfArtifact(
  supabase: TypedSupabaseClient,
  projectId: number,
  commitmentCoId: string,
) {
  const { data: scoped, error: scopedError } = await supabase
    .from("commitment_change_orders_with_scope")
    .select("*")
    .eq("id", commitmentCoId)
    .eq("project_id", projectId)
    .maybeSingle();

  if (scopedError) {
    throw new Error(scopedError.message);
  }

  if (!scoped) {
    throw new Error("Commitment change order not found.");
  }

  if (!scoped.contract_id) {
    throw new Error("Commitment change order is missing its linked commitment.");
  }
  // Captured in a local so the non-null narrowing survives inside the async
  // IIFE closure below (TS drops property narrowing across closures).
  const contractId = scoped.contract_id;

  // Query each possible totals view with its own literal table name rather
  // than a union-typed variable — Supabase's generated types cannot resolve
  // a `.select()` column list against a union of two views with different
  // columns (accounting_method only exists on purchase_orders_with_totals).
  // The IIFE's explicit return type also sidesteps a TS quirk where a
  // ternary between two differently-typed PostgrestFilterBuilder instances
  // collapses to their common shape instead of a real union.
  const commitmentQuery: Promise<{
    data: CommitmentTotalsRow | null;
    error: PostgrestError | null;
  }> = (async () => {
    if (scoped.commitment_type === "purchase_order") {
      const { data, error } = await supabase
        .from("purchase_orders_with_totals")
        .select(
          "id, contract_number, title, company_name, contract_company_id, total_sov_amount, accounting_method",
        )
        .eq("id", contractId)
        .maybeSingle();
      return { data, error };
    }

    const { data, error } = await supabase
      .from("subcontracts_with_totals")
      .select(
        "id, contract_number, title, company_name, contract_company_id, total_sov_amount",
      )
      .eq("id", contractId)
      .maybeSingle();
    return { data: data ? { ...data, accounting_method: null } : null, error };
  })();

  const [
    lineItemsResult,
    projectResult,
    commitmentResult,
    authorizedCosResult,
    attachmentsResult,
  ] = await Promise.all([
    supabase
      .from("commitment_change_order_lines")
      .select("id, description, amount, cost_code_id, cost_type_id, budget_line_id, created_at")
      .eq("commitment_change_order_id", commitmentCoId)
      .order("created_at", { ascending: true }),
    supabase
      .from("projects")
      .select("name, project_number, address, state, summary_metadata")
      .eq("id", projectId)
      .single(),
    commitmentQuery,
    supabase
      .from("contract_change_orders")
      .select("id, amount")
      .eq("contract_id", scoped.contract_id)
      .in("status", ["approved", "executed"])
      .neq("id", commitmentCoId),
    supabase
      .from("commitment_change_order_documents")
      .select("attached_at, document_metadata:document_metadata_id(title, file_name)")
      .eq("commitment_change_order_id", commitmentCoId)
      .order("attached_at", { ascending: true }),
  ]);

  if (lineItemsResult.error) throw new Error(lineItemsResult.error.message);
  if (projectResult.error) throw new Error(projectResult.error.message);
  if (commitmentResult.error) throw new Error(commitmentResult.error.message);
  if (authorizedCosResult.error) throw new Error(authorizedCosResult.error.message);
  if (attachmentsResult.error) throw new Error(attachmentsResult.error.message);

  if (!commitmentResult.data) {
    throw new Error("The linked commitment for this change order could not be loaded.");
  }

  const lineItems = lineItemsResult.data ?? [];
  const costCodeIds = [
    ...new Set(lineItems.map((item) => item.cost_code_id).filter((id): id is string => Boolean(id))),
  ];
  const costTypeIds = [
    ...new Set(lineItems.map((item) => item.cost_type_id).filter((id): id is string => Boolean(id))),
  ];

  const identifierCandidates = [scoped.created_by, scoped.approved_by].filter(
    (value): value is string => Boolean(value),
  );

  const [companyResult, costCodesResult, costTypesResult, peopleByIdResult, peopleByAuthResult] =
    await Promise.all([
      commitmentResult.data.contract_company_id
        ? supabase
            .from("companies")
            .select("name, address, city, state, zip_code")
            .eq("id", commitmentResult.data.contract_company_id)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      costCodeIds.length > 0
        ? supabase.from("cost_codes").select("id, division_title, title").in("id", costCodeIds)
        : Promise.resolve({ data: [], error: null }),
      costTypeIds.length > 0
        ? supabase.from("cost_code_types").select("id, code, description").in("id", costTypeIds)
        : Promise.resolve({ data: [], error: null }),
      identifierCandidates.length > 0
        ? supabase
            .from("people")
            .select("id, auth_user_id, first_name, last_name, email")
            .in("id", identifierCandidates)
        : Promise.resolve({ data: [], error: null }),
      identifierCandidates.length > 0
        ? supabase
            .from("people")
            .select("id, auth_user_id, first_name, last_name, email")
            .in("auth_user_id", identifierCandidates)
        : Promise.resolve({ data: [], error: null }),
    ]);

  if (companyResult && "error" in companyResult && companyResult.error) {
    throw new Error(companyResult.error.message);
  }
  if (costCodesResult && "error" in costCodesResult && costCodesResult.error) {
    throw new Error(costCodesResult.error.message);
  }
  if (costTypesResult && "error" in costTypesResult && costTypesResult.error) {
    throw new Error(costTypesResult.error.message);
  }
  if (peopleByIdResult && "error" in peopleByIdResult && peopleByIdResult.error) {
    throw new Error(peopleByIdResult.error.message);
  }
  if (peopleByAuthResult && "error" in peopleByAuthResult && peopleByAuthResult.error) {
    throw new Error(peopleByAuthResult.error.message);
  }

  const company = companyResult && "data" in companyResult ? companyResult.data : null;
  const people = [
    ...((peopleByIdResult && "data" in peopleByIdResult ? peopleByIdResult.data : []) ?? []),
    ...((peopleByAuthResult && "data" in peopleByAuthResult ? peopleByAuthResult.data : []) ?? []),
  ] as PersonRow[];
  const peopleByIdentifier = new Map<string, PersonRow>();
  for (const person of people) {
    peopleByIdentifier.set(person.id, person);
    if (person.auth_user_id) {
      peopleByIdentifier.set(person.auth_user_id, person);
    }
  }

  const costCodeById = new Map(
    ((costCodesResult && "data" in costCodesResult ? costCodesResult.data : []) ?? []).map((row) => [row.id, row]),
  );
  const costTypeById = new Map(
    ((costTypesResult && "data" in costTypesResult ? costTypesResult.data : []) ?? []).map((row) => [row.id, row]),
  );

  const html = buildCommitmentCoPdfHtml({
    changeOrderNumber: scoped.change_order_number,
    title: scoped.title,
    description: scoped.description,
    status: scoped.status,
    amount: scoped.amount,
    requestedDate: scoped.requested_date,
    approvedDate: scoped.approved_date,
    createdAt: scoped.created_at,
    createdByName: buildPersonName(peopleByIdentifier.get(scoped.created_by ?? "")),
    approvedByName: buildPersonName(peopleByIdentifier.get(scoped.approved_by ?? "")),
    designatedReviewer: scoped.designated_reviewer,
    requestReceivedFrom: scoped.request_received_from ?? scoped.requested_by,
    revision: scoped.revision,
    dueDate: scoped.due_date,
    invoicedDate: scoped.invoiced_date,
    paidDate: scoped.paid_date,
    location: scoped.location,
    reference: scoped.reference,
    changeReason: scoped.change_reason,
    paidInFull: scoped.paid_in_full,
    executed: scoped.executed,
    accountingMethod: commitmentResult.data.accounting_method ?? "Amount Based",
    scheduleImpact: scoped.schedule_impact,
    fieldChange: scoped.field_change,
    signedChangeOrderReceivedDate: scoped.signed_co_received_date,
    commitmentNumber: commitmentResult.data.contract_number ?? scoped.commitment_number,
    commitmentTitle: commitmentResult.data.title ?? scoped.commitment_title,
    projectName: projectResult.data?.name ?? null,
    projectNumber: projectResult.data?.project_number ?? null,
    projectAddressLines: formatProjectAddress(
      projectResult.data as ProjectAddressRow | null,
    ),
    contractorName: "Alleato Group",
    contractorAddressLines: [
      "8383 Craig St, Suite 150",
      "Indianapolis, Indiana 46250",
      "Phone: +13177600088",
    ],
    vendorName: company?.name ?? commitmentResult.data.company_name ?? scoped.contract_company,
    vendorAddressLines: formatCompanyAddress(company),
    attachments: ((attachmentsResult.data ?? []) as Array<{
      attached_at: string | null;
      document_metadata: { title: string | null; file_name: string | null } | null;
    }>).map((attachment) => ({
      fileName:
        attachment.document_metadata?.title ||
        attachment.document_metadata?.file_name ||
        "Attachment",
      attachedAt: attachment.attached_at,
    })),
    lineItems: lineItems.map((item) => {
      const costCode = item.cost_code_id ? costCodeById.get(item.cost_code_id) : null;
      const costType = item.cost_type_id ? costTypeById.get(item.cost_type_id) : null;
      const budgetCodeLabel =
        [
          costCode?.division_title,
          costCode?.title,
          costType?.code ? `.${costType.code}` : null,
        ]
          .filter(Boolean)
          .join(" ")
          .trim() || item.cost_code_id || "Unmapped";

      return {
        budgetCodeLabel,
        description: item.description,
        amount: item.amount,
      };
    }),
    originalContractSum: Number(commitmentResult.data.total_sov_amount) || 0,
    priorAuthorizedChangeOrders: (authorizedCosResult.data ?? []).reduce(
      (sum, item) => sum + (Number(item.amount) || 0),
      0,
    ),
  });

  return {
    html,
    filename: buildSafeFilename(scoped.change_order_number, scoped.title, scoped.description),
    scoped,
  };
}
