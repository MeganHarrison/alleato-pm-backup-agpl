import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { type NextRequest, NextResponse } from "next/server";

import { apiErrorResponse } from "@/lib/api-error";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";

const SORT_FIELD_MAP: Record<string, string> = {
  company_name: "name",
  company_type: "type",
  status: "status",
  business_phone: "contact_phone",
  website: "website",
  email_address: "contact_email",
  erp_vendor_id: "acumatica_vendor_id",
  created_at: "created_at",
  updated_at: "updated_at",
};

function parseMinimumCount(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return parsed;
}

function applyTextFilter<T>(
  query: T,
  column: string,
  value: string | null,
): T {
  if (!value?.trim()) return query;
  return (query as { ilike: (column: string, pattern: string) => T }).ilike(
    column,
    `%${value.trim()}%`,
  );
}

type AppClient = Awaited<ReturnType<typeof createClient>>;

/**
 * Returns the set of company ids that have a W-9 attached — where "has a W-9"
 * means any linked `company_documents` row is typed `w9` on the junction row OR
 * on the underlying `document_metadata`. Every read is paginated so a large
 * W-9 corpus can never silently truncate at PostgREST's default max rows.
 * Throws on any query error so failures surface loudly instead of undercounting.
 */
async function loadW9CompanyIds(client: AppClient): Promise<Set<string>> {
  const ids = new Set<string>();
  const PAGE = 1000;

  // 1) Junction rows explicitly typed 'w9'.
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await client
      .from("company_documents")
      .select("company_id")
      .eq("document_type", "w9")
      .range(offset, offset + PAGE - 1);
    if (error) throw new Error(`W-9 junction lookup failed: ${error.message}`);
    for (const row of data ?? []) {
      if (row.company_id) ids.add(row.company_id);
    }
    if (!data || data.length < PAGE) break;
  }

  // 2) Files typed 'w9' in document_metadata -> their company links.
  const w9DocIds: string[] = [];
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await client
      .from("document_metadata")
      .select("id")
      .eq("document_type", "w9")
      .range(offset, offset + PAGE - 1);
    if (error) throw new Error(`W-9 metadata lookup failed: ${error.message}`);
    for (const row of data ?? []) w9DocIds.push(row.id);
    if (!data || data.length < PAGE) break;
  }

  for (let i = 0; i < w9DocIds.length; i += 200) {
    const chunk = w9DocIds.slice(i, i + 200);
    if (!chunk.length) continue;
    const { data, error } = await client
      .from("company_documents")
      .select("company_id")
      .in("document_metadata_id", chunk);
    if (error) throw new Error(`W-9 link lookup failed: ${error.message}`);
    for (const row of data ?? []) {
      if (row.company_id) ids.add(row.company_id);
    }
  }

  return ids;
}

/**
 * W-9 presence for a bounded set of company ids (the current page). Used for
 * badge rendering when the W-9 filter is off, so an ordinary directory load
 * does not scan the whole document corpus.
 */
async function pageW9CompanyIds(
  client: AppClient,
  companyIds: string[],
): Promise<Set<string>> {
  const ids = new Set<string>();
  if (companyIds.length === 0) return ids;

  const { data: companyDocs, error } = await client
    .from("company_documents")
    .select("company_id, document_type, document_metadata_id")
    .in("company_id", companyIds);
  if (error) throw new Error(`W-9 page lookup failed: ${error.message}`);

  const docRows = companyDocs ?? [];
  const metaIdsToCheck: string[] = [];
  for (const row of docRows) {
    if (!row.company_id) continue;
    if (row.document_type === "w9") {
      ids.add(row.company_id);
    } else if (row.document_metadata_id) {
      metaIdsToCheck.push(row.document_metadata_id);
    }
  }

  if (metaIdsToCheck.length > 0) {
    const { data: metaRows, error: metaError } = await client
      .from("document_metadata")
      .select("id")
      .in("id", metaIdsToCheck)
      .eq("document_type", "w9");
    if (metaError) {
      throw new Error(`W-9 page metadata lookup failed: ${metaError.message}`);
    }
    const w9MetaIds = new Set((metaRows ?? []).map((m) => m.id));
    for (const row of docRows) {
      if (
        row.company_id &&
        row.document_metadata_id &&
        w9MetaIds.has(row.document_metadata_id)
      ) {
        ids.add(row.company_id);
      }
    }
  }

  return ids;
}

export const GET = withApiGuardrails(
  "directory/project-companies#GET",
  async ({ request }) => {
  
    const supabase = await createClient();

    const user = await getApiRouteUser();

    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "directory/project-companies#GET", message: "Authentication required." });
    }

    const searchParams = request.nextUrl.searchParams;
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const per_page = Math.min(
      Math.max(1, parseInt(searchParams.get("per_page") || "25", 10)),
      150,
    );
    const search = searchParams.get("search") || "";
    // Status semantics — archived companies are a soft delete, so they are
    // hidden unless asked for:
    //   (absent)   -> every status EXCEPT archived  (the default view)
    //   "all"      -> every status, archived included (explicit opt-in)
    //   "archived" -> only archived
    //   <other>    -> that status only (matched case-insensitively)
    const status = searchParams.get("status") || "";
    const company_type = searchParams.get("company_type") || "";
    const source = searchParams.get("source") || ""; // "erp" | "other" | ""
    const w9Filter = searchParams.get("has_w9") || ""; // "yes" | "no" | ""
    const sort = searchParams.get("sort") || "updated_at:desc";
    const companyName = searchParams.get("company_name");
    const businessPhone = searchParams.get("business_phone");
    const website = searchParams.get("website");
    const emailAddress = searchParams.get("email_address");
    const erpVendorId = searchParams.get("erp_vendor_id");
    const primaryContactId = searchParams.get("primary_contact_id");
    const logoUrl = searchParams.get("logo_url");
    const createdAtFrom = searchParams.get("created_at_from");
    const createdAtTo = searchParams.get("created_at_to");
    const updatedAtFrom = searchParams.get("updated_at_from");
    const updatedAtTo = searchParams.get("updated_at_to");
    const contactCountMin = parseMinimumCount(
      searchParams.get("contact_count_min"),
    );
    const projectCountMin = parseMinimumCount(
      searchParams.get("project_count_min"),
    );

    // When the W-9 filter is active we resolve the full set of companies that
    // have a W-9 (paginated), so filtering can happen server-side below and keep
    // pagination + exact count correct. When it is NOT active we skip that
    // corpus-wide scan entirely and resolve W-9 presence only for the current
    // page's rows (badge rendering) further down.
    const w9FilterActive = w9Filter === "yes" || w9Filter === "no";
    const w9FilterSet = w9FilterActive
      ? await loadW9CompanyIds(supabase)
      : null;

    // Query companies directly using the type column
    let query = supabase
      .from("companies")
      .select("id, name, website, type, status, contact_phone, contact_email, acumatica_vendor_id, customer_id, primary_contact_id, logo_url, tax_id, legal_name, vendor_class, terms, payment_method, ap_account, cash_account, is_1099_vendor, is_foreign_entity, is_labor_union, is_tax_agency, acumatica_sync_at, license_number, created_at, updated_at", { count: "exact" });

    // Status values are stored inconsistently cased ('active' and 'ACTIVE' both
    // exist), so every status comparison is case-insensitive — an exact `eq`
    // would silently drop rows.
    if (!status) {
      // Default view: hide the soft-deleted. `status IS NULL` must be kept
      // explicitly, since `NOT (NULL ILIKE 'archived')` is NULL, not true.
      query = query.or("status.is.null,status.not.ilike.archived");
    } else if (status !== "all") {
      query = query.ilike("status", status);
    }

    if (company_type) {
      query = query.ilike("type", company_type);
    }

    // Sync source. Acumatica holds vendors AND customers, and a company is
    // ERP-backed if it carries EITHER id — `acumatica_vendor_id` alone is not
    // the test. Deriving source from the vendor id only made every Acumatica
    // *customer* (Ulta, Uniqlo, Niemann Holdings, ...) read as non-ERP, which
    // in turn made them look like cleanup candidates.
    if (source === "erp") {
      query = query.or("acumatica_vendor_id.not.is.null,customer_id.not.is.null");
    } else if (source === "other") {
      query = query.is("acumatica_vendor_id", null).is("customer_id", null);
    }

    // W-9 filter applied at the DB level so range() + exact count still hold.
    // The embedded id set is always the (small) set of companies that HAVE a
    // W-9 — for "yes" we include it, for "no" we exclude it — so the query
    // string stays bounded even as the missing-W-9 bucket grows.
    if (w9Filter === "yes") {
      const w9List = w9FilterSet ? [...w9FilterSet] : [];
      // Empty set -> no company qualifies; force an impossible id.
      query = query.in(
        "id",
        w9List.length ? w9List : ["00000000-0000-0000-0000-000000000000"],
      );
    } else if (w9Filter === "no" && w9FilterSet && w9FilterSet.size > 0) {
      query = query.not("id", "in", `(${[...w9FilterSet].join(",")})`);
    }

    query = applyTextFilter(query, "name", companyName);
    query = applyTextFilter(query, "contact_phone", businessPhone);
    query = applyTextFilter(query, "website", website);
    query = applyTextFilter(query, "contact_email", emailAddress);
    query = applyTextFilter(query, "acumatica_vendor_id", erpVendorId);
    query = applyTextFilter(query, "primary_contact_id", primaryContactId);
    query = applyTextFilter(query, "logo_url", logoUrl);

    if (createdAtFrom) {
      query = query.gte("created_at", `${createdAtFrom}T00:00:00.000Z`);
    }

    if (createdAtTo) {
      query = query.lte("created_at", `${createdAtTo}T23:59:59.999Z`);
    }

    if (updatedAtFrom) {
      query = query.gte("updated_at", `${updatedAtFrom}T00:00:00.000Z`);
    }

    if (updatedAtTo) {
      query = query.lte("updated_at", `${updatedAtTo}T23:59:59.999Z`);
    }

    if (search) {
      query = query.or(
        `name.ilike.%${search}%,contact_phone.ilike.%${search}%,contact_email.ilike.%${search}%,acumatica_vendor_id.ilike.%${search}%`,
      );
    }

    const [sortField, sortDirection] = sort.split(":");
    const normalizedSortField = SORT_FIELD_MAP[sortField] ?? "updated_at";

    query = query.order(normalizedSortField, {
      ascending: sortDirection !== "desc",
      nullsFirst: false,
    });

    const from = (page - 1) * per_page;
    const to = from + per_page - 1;
    // The contact/project count filters are still computed in-memory after the
    // base query, so when active we fetch the full result set (no range) and
    // paginate ourselves. (The W-9 and source filters are applied server-side
    // above, so they keep normal ranged pagination + exact count.)
    const hasDerivedFilter =
      contactCountMin !== null || projectCountMin !== null;
    if (!hasDerivedFilter) {
      query = query.range(from, to);
    }

    const { data: companies, error, count } = await query;

    if (error) {
      return apiErrorResponse(error);
    }

    const companyIds = (companies || []).map((c) => c.id);

    const contactCountMap = new Map<string, number>();
    const projectCountMap = new Map<string, number>();

    if (companyIds.length > 0) {
      const [contactsResult, projectsResult] = await Promise.all([
        supabase.from("people").select("company_id").in("company_id", companyIds),
        supabase.from("project_companies").select("company_id, project_id").in("company_id", companyIds),
      ]);

      for (const row of contactsResult.data || []) {
        if (row.company_id) {
          contactCountMap.set(row.company_id, (contactCountMap.get(row.company_id) || 0) + 1);
        }
      }

      const projectSets = new Map<string, Set<number>>();
      for (const row of projectsResult.data || []) {
        if (row.company_id) {
          const existing = projectSets.get(row.company_id);
          if (existing) {
            existing.add(row.project_id);
          } else {
            projectSets.set(row.company_id, new Set([row.project_id]));
          }
        }
      }
      for (const [cid, projects] of projectSets) {
        projectCountMap.set(cid, projects.size);
      }
    }

    // W-9 presence for the current page's badges. Reuse the global set when the
    // filter is active; otherwise a bounded, page-scoped lookup so an unfiltered
    // directory load never scans the whole document corpus.
    const w9BadgeIds =
      w9FilterSet ?? (await pageW9CompanyIds(supabase, companyIds));

    const rows = (companies || [])
      .map((company) => ({
      id: company.id,
      project_id: 0,
      company_id: company.id,
      business_phone: company.contact_phone ?? null,
      email_address: company.contact_email ?? null,
      primary_contact_id: company.primary_contact_id ?? null,
      erp_vendor_id: company.acumatica_vendor_id ?? null,
      erp_customer_id: company.customer_id ?? null,
      tax_id: company.tax_id ?? null,
      legal_name: company.legal_name ?? null,
      vendor_class: company.vendor_class ?? null,
      terms: company.terms ?? null,
      payment_method: company.payment_method ?? null,
      ap_account: company.ap_account ?? null,
      cash_account: company.cash_account ?? null,
      is_1099_vendor: company.is_1099_vendor ?? null,
      is_foreign_entity: company.is_foreign_entity ?? null,
      is_labor_union: company.is_labor_union ?? null,
      is_tax_agency: company.is_tax_agency ?? null,
      acumatica_sync_at: company.acumatica_sync_at ?? null,
      license_number: company.license_number ?? null,
      company_type: company.type ?? null,
      status: company.status ?? null,
      logo_url: company.logo_url ?? null,
      created_at: company.created_at ?? null,
      updated_at: company.updated_at ?? null,
      company_name: company.name ?? null,
      website: company.website ?? null,
      contact_count: contactCountMap.get(company.id) ?? 0,
      project_count: projectCountMap.get(company.id) ?? 0,
      has_w9: w9BadgeIds.has(company.id),
      }))
      .filter((company) => {
        if (
          contactCountMin !== null &&
          company.contact_count < contactCountMin
        ) {
          return false;
        }
        if (
          projectCountMin !== null &&
          company.project_count < projectCountMin
        ) {
          return false;
        }
        return true;
      });

    const pagedRows = hasDerivedFilter ? rows.slice(from, to + 1) : rows;
    const total = hasDerivedFilter ? rows.length : count || 0;
    const total_pages = Math.ceil(total / per_page);

    return NextResponse.json({
      data: pagedRows,
      pagination: {
        page,
        per_page,
        total,
        total_pages,
      },
    });
    },
);
