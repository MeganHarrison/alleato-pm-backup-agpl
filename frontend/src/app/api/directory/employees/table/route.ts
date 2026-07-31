import { NextResponse } from "next/server";

import { apiErrorResponse } from "@/lib/api-error";
import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import {
  ALLEATO_COMPANY,
  type EmployeeRow,
} from "@/features/employees/directory-employees-table-definition";

const EMPLOYEE_SELECT = `
  id,
  first_name,
  last_name,
  email,
  job_title,
  business_unit,
  phone_business,
  phone_mobile,
  status,
  person_type,
  created_at,
  company
`;

const SORT_FIELD_MAP: Record<string, string> = {
  full_name: "last_name",
  job_title: "job_title",
  business_unit: "business_unit",
  email: "email",
  phone: "phone_business",
  status: "status",
  person_type: "person_type",
  created_at: "created_at",
};

type EmployeePersonRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  job_title: string | null;
  business_unit: string | null;
  phone_business: string | null;
  phone_mobile: string | null;
  status: string | null;
  person_type: string | null;
  created_at: string | null;
  company: string | null;
};

function mapEmployeeRow(person: EmployeePersonRow): EmployeeRow {
  const fullName = `${person.first_name ?? ""} ${person.last_name ?? ""}`.trim();

  return {
    id: person.id,
    first_name: person.first_name || "",
    last_name: person.last_name || "",
    full_name: fullName || "Unnamed",
    email: person.email || "",
    job_title: person.job_title || "",
    business_unit: person.business_unit || "",
    phone: person.phone_business || person.phone_mobile || "",
    status: person.status || "",
    person_type: person.person_type || "",
    created_at: person.created_at,
  };
}

export const GET = withApiGuardrails(
  "directory/employees/table#GET",
  async ({ request }) => {
    const supabase = await createClient();
    const user = await getApiRouteUser();

    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "directory/employees/table#GET",
        message: "Authentication required.",
      });
    }

    const searchParams = request.nextUrl.searchParams;
    const page = Math.max(1, Number.parseInt(searchParams.get("page") || "1", 10));
    const perPage = Math.min(
      Math.max(1, Number.parseInt(searchParams.get("per_page") || "50", 10)),
      150,
    );
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || "active";
    const businessUnit = searchParams.get("business_unit") || "";
    const sort = searchParams.get("sort") || "full_name:asc";

    const [sortField, sortDirection = "asc"] = sort.split(":");
    const normalizedSortField = SORT_FIELD_MAP[sortField] ?? "last_name";
    const ascending = sortDirection !== "desc";

    let query = supabase
      .from("people")
      .select(EMPLOYEE_SELECT, { count: "exact" })
      .ilike("company", `%${ALLEATO_COMPANY}%`);

    query = query.eq("status", status);

    if (businessUnit) {
      query = query.eq("business_unit", businessUnit);
    }

    if (search) {
      query = query.or(
        `first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%,job_title.ilike.%${search}%,business_unit.ilike.%${search}%`,
      );
    }

    query = query.order(normalizedSortField, {
      ascending,
      nullsFirst: false,
    });

    if (normalizedSortField === "last_name") {
      query = query.order("first_name", {
        ascending,
        nullsFirst: false,
      });
    }

    const from = (page - 1) * perPage;
    const to = from + perPage - 1;
    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) {
      return apiErrorResponse(error);
    }

    const rows = ((data ?? []) as EmployeePersonRow[]).map(mapEmployeeRow);

    return NextResponse.json({
      data: rows,
      pagination: {
        page,
        per_page: perPage,
        total: count || 0,
        total_pages: Math.max(1, Math.ceil((count || 0) / perPage)),
      },
    });
  },
);
