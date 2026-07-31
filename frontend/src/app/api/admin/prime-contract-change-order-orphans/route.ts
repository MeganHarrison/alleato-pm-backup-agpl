import { z } from "zod";

import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { serviceDb } from "@/lib/supabase/service-db";
import { requireAdmin } from "../_shared";

type PrimeContractRow = {
  id: string;
  project_id: number;
  contract_number: string | null;
  title: string | null;
  created_at: string;
};

type OrphanPrimeContractRow = {
  id: number;
  project_id: number;
  pcco_number: string | null;
  title: string | null;
  status: string | null;
  total_amount: number | null;
  created_at: string;
  created_by: string | null;
  acumatica_external_key: string | null;
};

type OrphanPrimeContractProjectRow = {
  id: number;
  name: string | null;
  project_number: string | null;
};

type OrphanResolutionCategory = "ambiguous" | "no_prime_contract";

type PrimeContractCandidate = {
  id: string;
  contractNumber: string | null;
  title: string | null;
  createdAt: string;
};

type OrphanItem = {
  id: number;
  projectId: number;
  projectName: string | null;
  projectNumber: string | null;
  pccoNumber: string | null;
  title: string | null;
  status: string | null;
  totalAmount: number | null;
  createdAt: string;
  createdBy: string | null;
  acumaticaExternalKey: string | null;
  candidates: PrimeContractCandidate[];
  category: OrphanResolutionCategory;
};

type OrphanResponse = {
  items: OrphanItem[];
  total: number;
  totalByCategory: {
    ambiguous: number;
    no_prime_contract: number;
  };
  page: number;
  perPage: number;
};

const CATEGORY_FILTER = z
  .union([z.literal("all"), z.literal("ambiguous"), z.literal("no_prime_contract")])
  .default("all");

const GET_QUERY_SCHEMA = z.object({
  page: z.coerce.number().int().positive().max(1000).default(1),
  perPage: z.coerce.number().int().positive().max(200).default(50),
  search: z.string().trim().optional(),
  category: CATEGORY_FILTER,
});

const PATCH_SCHEMA = z.object({
  action: z.literal("assign_prime_contract"),
  ids: z
    .array(z.number().int().positive())
    .min(1, "At least one PCCO id is required.")
    .max(1000, "Too many PCCOs selected."),
  primeContractId: z.string().uuid("primeContractId must be a valid UUID."),
});

function normalizeSearch(value?: string): string {
  return (value ?? "").trim().toLowerCase();
}

function buildResponse(itemRows: OrphanItem[], page: number, perPage: number): OrphanResponse {
  const start = (page - 1) * perPage;
  const end = start + perPage;
  const paged = itemRows.slice(start, end);

  return {
    items: paged,
    total: itemRows.length,
    totalByCategory: {
      ambiguous: itemRows.filter((row) => row.category === "ambiguous").length,
      no_prime_contract: itemRows.filter((row) => row.category === "no_prime_contract").length,
    },
    page,
    perPage,
  };
}

function buildOrphanItems(
  rows: OrphanPrimeContractRow[],
  projectsById: Map<number, OrphanPrimeContractProjectRow>,
  candidatesByProjectId: Map<number, PrimeContractRow[]>,
): OrphanItem[] {
  return rows
    .map((row) => {
      const project = projectsById.get(row.project_id);
      const candidates = candidatesByProjectId.get(row.project_id) ?? [];
      let category: OrphanResolutionCategory;

      if (candidates.length > 1) {
        category = "ambiguous";
      } else {
        category = "no_prime_contract";
      }

      const candidateRows = candidates.map((candidate): PrimeContractCandidate => ({
        id: candidate.id,
        contractNumber: candidate.contract_number,
        title: candidate.title,
        createdAt: candidate.created_at,
      }));

      return {
        id: row.id,
        projectId: row.project_id,
        projectName: project?.name ?? null,
        projectNumber: project?.project_number ?? null,
        pccoNumber: row.pcco_number,
        title: row.title,
        status: row.status,
        totalAmount: row.total_amount,
        createdAt: row.created_at,
        createdBy: row.created_by,
        acumaticaExternalKey: row.acumatica_external_key,
        candidates: candidateRows,
        category,
      };
    })
    .sort((a, b) =>
      a.category.localeCompare(b.category) ||
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
}

function filterBySearch(items: OrphanItem[], search: string): OrphanItem[] {
  if (!search) return items;
  return items.filter((item) => {
    const haystack = [
      String(item.id),
      item.projectName ?? "",
      item.projectNumber ?? "",
      item.pccoNumber ?? "",
      item.title ?? "",
      item.status ?? "",
      item.acumaticaExternalKey ?? "",
      item.createdBy ?? "",
      item.candidates.map((candidate) => [candidate.contractNumber ?? "", candidate.title ?? ""]).join(" "),
    ]
      .join(" ")
      .toLowerCase();

    return haystack.includes(search);
  });
}

export const GET = withApiGuardrails(
  "api/admin/prime-contract-change-order-orphans#GET",
  async ({ request }) => {
    await requireAdmin("api/admin/prime-contract-change-order-orphans#GET");

        const url = new URL(request.url);

    const parsed = GET_QUERY_SCHEMA.parse({
      page: url.searchParams.get("page") ?? undefined,
      perPage: url.searchParams.get("perPage") ?? undefined,
      search: url.searchParams.get("search") ?? undefined,
      category: url.searchParams.get("category") ?? "all",
    });

    const { data: orphanRows, error: orphanError } = await serviceDb.from("prime_contract_change_orders")
      .select("id, project_id, pcco_number, title, status, total_amount, created_at, created_by, acumatica_external_key")
      .is("prime_contract_id", null)
      .is("contract_id", null)
      .order("created_at", { ascending: false });

    if (orphanError) {
      throw new GuardrailError({
        code: "DB_ERROR",
        where: "api/admin/prime-contract-change-order-orphans#GET",
        message: "Failed to load prime-contract change order orphans.",
        details: orphanError.message,
        cause: orphanError,
        status: 502,
      });
    }

    const safeOrphans = (orphanRows ?? []) as OrphanPrimeContractRow[];
    const projectIds = [...new Set(safeOrphans.map((row) => row.project_id).filter(Boolean))];

    let projectsById = new Map<number, OrphanPrimeContractProjectRow>();
    let candidatesByProjectId = new Map<number, PrimeContractRow[]>();

    if (projectIds.length > 0) {
      const [projectsResult, contractsResult] = await Promise.all([
        serviceDb.from("projects").select("id, name, project_number").in("id", projectIds),
        serviceDb.from("prime_contracts")
          .select("id, project_id, contract_number, title, created_at")
          .in("project_id", projectIds)
          .order("created_at", { ascending: true }),
      ]);

      if (projectsResult.error) {
        throw new GuardrailError({
          code: "DB_ERROR",
          where: "api/admin/prime-contract-change-order-orphans#GET",
          message: "Failed to load project context for orphan PCCOs.",
          details: projectsResult.error.message,
          cause: projectsResult.error,
          status: 502,
        });
      }

      if (contractsResult.error) {
        throw new GuardrailError({
          code: "DB_ERROR",
          where: "api/admin/prime-contract-change-order-orphans#GET",
          message: "Failed to load project prime-contract candidates for orphan PCCOs.",
          details: contractsResult.error.message,
          cause: contractsResult.error,
          status: 502,
        });
      }

      projectsById = new Map(
        (projectsResult.data ?? []).map((project: OrphanPrimeContractProjectRow) => [
          project.id,
          project,
        ]),
      );

      candidatesByProjectId = (contractsResult.data ?? []).reduce(
        (acc, contract: PrimeContractRow) => {
          const list = acc.get(contract.project_id) ?? [];
          list.push(contract);
          acc.set(contract.project_id, list);
          return acc;
        },
        new Map<number, PrimeContractRow[]>(),
      );
    }

    const allItems = buildOrphanItems(safeOrphans, projectsById, candidatesByProjectId);
    const categoryFiltered =
      parsed.category === "all"
        ? allItems
        : allItems.filter((item) => item.category === parsed.category);
    const searchNormalized = normalizeSearch(parsed.search);
    const searched = searchNormalized
      ? filterBySearch(categoryFiltered, searchNormalized)
      : categoryFiltered;

    return new Response(JSON.stringify(buildResponse(searched, parsed.page, parsed.perPage)), {
      headers: { "Content-Type": "application/json" },
    });
  },
);

export const PATCH = withApiGuardrails(
  "api/admin/prime-contract-change-order-orphans#PATCH",
  async ({ request }) => {
    await requireAdmin("api/admin/prime-contract-change-order-orphans#PATCH");

        const payload = await request.json().catch(() => {
      throw new GuardrailError({
        code: "INVALID_PAYLOAD",
        where: "api/admin/prime-contract-change-order-orphans#PATCH",
        message: "Invalid JSON payload.",
      });
    });

    const parsed = PATCH_SCHEMA.safeParse(payload);
    if (!parsed.success) {
      throw new GuardrailError({
        code: "INVALID_PAYLOAD",
        where: "api/admin/prime-contract-change-order-orphans#PATCH",
        message: "Invalid request payload for orphan assignment.",
        details: parsed.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      });
    }

    const dedupedIds = [...new Set(parsed.data.ids)];

    const { data: contractRows, error: contractError } = await serviceDb.from("prime_contracts")
      .select("id, project_id")
      .in("id", [parsed.data.primeContractId])
      .single();

    if (contractError || !contractRows) {
      throw new GuardrailError({
        code: "NOT_FOUND",
        where: "api/admin/prime-contract-change-order-orphans#PATCH",
        message: "Selected prime contract was not found.",
        details: contractError?.message,
        cause: contractError,
        status: 404,
      });
    }

    const { data: targetRows, error: targetError } = await serviceDb.from("prime_contract_change_orders")
      .select("id, project_id")
      .in("id", dedupedIds)
      .eq("project_id", contractRows.project_id)
      .is("prime_contract_id", null)
      .is("contract_id", null);

    if (targetError) {
      throw new GuardrailError({
        code: "DB_ERROR",
        where: "api/admin/prime-contract-change-order-orphans#PATCH",
        message: "Failed to load selected orphan prime contract change orders.",
        details: targetError.message,
        cause: targetError,
        status: 502,
      });
    }

    const foundIds = new Set((targetRows ?? []).map((row) => row.id));
    const unresolvedIds = dedupedIds.filter((id) => !foundIds.has(id));
    if (unresolvedIds.length > 0) {
      throw new GuardrailError({
        code: "INVALID_PAYLOAD",
        where: "api/admin/prime-contract-change-order-orphans#PATCH",
        message:
          "Some selected PCCOs are not currently orphaned in the same project as the selected contract.",
        details: { unresolvedIds },
      });
    }

    const { data: updatedRows, error: updateError } = await serviceDb.from("prime_contract_change_orders")
      .update({ prime_contract_id: parsed.data.primeContractId, contract_id: null })
      .in("id", dedupedIds)
      .is("prime_contract_id", null)
      .is("contract_id", null)
      .eq("project_id", contractRows.project_id)
      .select("id");

    if (updateError) {
      throw new GuardrailError({
        code: "DB_ERROR",
        where: "api/admin/prime-contract-change-order-orphans#PATCH",
        message: "Failed to assign the selected prime contract to orphan rows.",
        details: updateError.message,
        cause: updateError,
        status: 502,
      });
    }

    return Response.json({
      success: true,
      message: `Assigned ${updatedRows?.length ?? 0} orphan(s) to prime contract ${parsed.data.primeContractId}.`,
      assigned_ids: (updatedRows ?? []).map((row) => row.id),
      project_id: contractRows.project_id,
      total: dedupedIds.length,
    });
  },
);
