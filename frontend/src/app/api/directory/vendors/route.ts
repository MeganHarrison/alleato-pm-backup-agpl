import { withApiGuardrails } from "@/lib/guardrails/api";
import { apiErrorResponse } from "@/lib/api-error";
import { GuardrailError } from "@/lib/guardrails/errors";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

const SEARCHABLE_COLUMNS = [
  "name",
  "legal_name",
  "contact_name",
  "contact_email",
  "contact_phone",
  "city",
  "state",
  "address",
  "zip_code",
  "vendor_class",
  "payment_method",
  "terms",
  "tax_id",
  "acumatica_vendor_id",
];

const SORTABLE_COLUMNS = new Set([
  "name",
  "legal_name",
  "contact_name",
  "contact_email",
  "contact_phone",
  "city",
  "state",
  "status",
  "vendor_class",
  "payment_method",
  "terms",
  "is_1099_vendor",
  "acumatica_vendor_id",
  "created_at",
  "updated_at",
]);

const VENDOR_SELECT_COLUMNS = [
  "id",
  "name",
  "legal_name",
  "contact_name",
  "contact_email",
  "contact_phone",
  "address",
  "city",
  "state",
  "zip_code",
  "status",
  "vendor_class",
  "payment_method",
  "terms",
  "is_1099_vendor",
  "acumatica_vendor_id",
  "acumatica_sync_at",
  "tax_id",
  "notes",
  "created_at",
  "updated_at",
].join(", ");

function parsePositiveInteger(value: string | null, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function resolveSort(searchParams: URLSearchParams): {
  sortBy: string;
  ascending: boolean;
} {
  const sortParam = searchParams.get("sort");
  const [sortFieldFromCombined, directionFromCombined] =
    sortParam?.split(":") ?? [];
  const requestedSortBy =
    searchParams.get("sort_by") || sortFieldFromCombined || "name";
  const sortBy = SORTABLE_COLUMNS.has(requestedSortBy)
    ? requestedSortBy
    : "name";
  const requestedDirection =
    searchParams.get("sort_order") ||
    searchParams.get("sort_dir") ||
    directionFromCombined;

  return {
    sortBy,
    ascending: requestedDirection !== "desc",
  };
}

export const GET = withApiGuardrails(
  "directory/vendors#GET",
  async ({ request }) => {
    const supabase = await createClient();
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "directory/vendors#GET",
        message: "Authentication required.",
      });
    }
    const { searchParams } = new URL(request.url);

    const page = parsePositiveInteger(searchParams.get("page"), 1);
    const perPage = Math.min(
      parsePositiveInteger(searchParams.get("per_page"), 50),
      150,
    );
    const search = searchParams.get("search") ?? "";
    const status = searchParams.get("status");
    const isActive = searchParams.get("is_active");
    const vendorClass = searchParams.get("vendor_class");
    const paymentMethod = searchParams.get("payment_method");
    const { sortBy, ascending } = resolveSort(searchParams);

    const offset = (page - 1) * perPage;

    let query = supabase
      .from("companies")
      .select(VENDOR_SELECT_COLUMNS, { count: "exact" })
      .eq("is_vendor", true);

    if (search) {
      query = query.or(
        SEARCHABLE_COLUMNS.map((col) => `${col}.ilike.%${search}%`).join(","),
      );
    }

    if (status) {
      query = query.eq("status", status);
    } else if (isActive !== null && isActive !== "") {
      query = query.eq("status", isActive === "true" ? "active" : "inactive");
    }
    if (vendorClass) {
      query = query.eq("vendor_class", vendorClass);
    }
    if (paymentMethod) {
      query = query.eq("payment_method", paymentMethod);
    }

    query = query
      .order(sortBy, { ascending })
      .range(offset, offset + perPage - 1);

    const { data, error, count } = await query;

    if (error) {
      return apiErrorResponse(error);
    }

    return NextResponse.json({
      data,
      pagination: {
        page,
        per_page: perPage,
        total: count ?? 0,
        total_pages: Math.ceil((count ?? 0) / perPage),
      },
    });
  },
);
