import { NextResponse } from "next/server";

import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { apiErrorResponse } from "@/lib/api-error";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import type { ContactTableRow } from "@/features/contacts/directory-contacts-table-definition";

const CONTACT_SELECT = `
  id,
  first_name,
  last_name,
  email,
  person_type,
  company_id,
  phone_business,
  phone_mobile,
  created_at,
  company:companies!people_company_id_fkey(id, name)
`;

const SORT_FIELD_MAP: Record<string, string> = {
  full_name: "last_name",
  email: "email",
  type: "person_type",
  company: "company_id",
  phone: "phone_business",
  is_admin: "created_at",
  created_at: "created_at",
};

type ContactPersonRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  person_type: string | null;
  company_id: string | null;
  phone_business: string | null;
  phone_mobile: string | null;
  created_at: string | null;
  company:
    | {
        id: string | null;
        name: string | null;
      }
    | {
        id: string | null;
        name: string | null;
      }[]
    | null;
};

function mapPeopleToRows(
  people: ContactPersonRow[],
  adminMap: Map<string, boolean>,
): ContactTableRow[] {
  return people.map((person) => {
    const fullName = `${person.first_name ?? ""} ${person.last_name ?? ""}`.trim();
    const looksLikeEmail = fullName.includes("@") && !fullName.includes(" ");
    return {
      id: person.id,
      first_name: person.first_name || "",
      last_name: person.last_name || "",
      full_name: !fullName || looksLikeEmail ? "Unnamed Contact" : fullName,
      email: person.email || "",
      type: person.person_type || "",
      company:
        person.company && !Array.isArray(person.company)
          ? person.company.name || ""
          : "",
      company_id:
        person.company && !Array.isArray(person.company)
          ? person.company.id || null
          : person.company_id || null,
      phone: person.phone_business || person.phone_mobile || "",
      is_admin: adminMap.get(person.id) ?? false,
      created_at: person.created_at,
    };
  });
}

async function buildAdminMap(
  supabase: Awaited<ReturnType<typeof createClient>>,
  personIds: string[],
) {
  const adminMap = new Map<string, boolean>();

  if (personIds.length === 0) {
    return adminMap;
  }

  const { data: authLinks, error: authLinksError } = await supabase
    .from("users_auth")
    .select("person_id, auth_user_id")
    .in("person_id", personIds);

  if (authLinksError) {
    throw authLinksError;
  }

  const authUserIds = (authLinks ?? [])
    .map((link) => link.auth_user_id)
    .filter((id): id is string => typeof id === "string" && id.length > 0);

  if (authUserIds.length === 0) {
    return adminMap;
  }

  const { data: profiles, error: profilesError } = await supabase
    .from("user_profiles")
    .select("id, is_admin")
    .in("id", authUserIds);

  if (profilesError) {
    throw profilesError;
  }

  const profileMap = new Map(
    (profiles ?? []).map((profile) => [profile.id, Boolean(profile.is_admin)]),
  );

  for (const link of authLinks ?? []) {
    if (!link.person_id || !link.auth_user_id) continue;
    adminMap.set(link.person_id, profileMap.get(link.auth_user_id) ?? false);
  }

  return adminMap;
}

function sortRows(
  rows: ContactTableRow[],
  sortField: string,
  sortDirection: string,
) {
  const factor = sortDirection === "desc" ? -1 : 1;

  return [...rows].sort((left, right) => {
    switch (sortField) {
      case "full_name":
        return left.full_name.localeCompare(right.full_name) * factor;
      case "company":
        return left.company.localeCompare(right.company) * factor;
      case "phone":
        return left.phone.localeCompare(right.phone) * factor;
      case "is_admin":
        return (Number(left.is_admin) - Number(right.is_admin)) * factor;
      default:
        return 0;
    }
  });
}

export const GET = withApiGuardrails(
  "directory/contacts/table#GET",
  async ({ request }) => {
    const supabase = await createClient();
    const user = await getApiRouteUser();

    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "directory/contacts/table#GET",
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
    const type = searchParams.get("type") || "";
    const isAdmin = searchParams.get("is_admin") || "";
    const sort = searchParams.get("sort") || "full_name:asc";
    const [sortField, sortDirection] = sort.split(":");
    const normalizedSortField = SORT_FIELD_MAP[sortField] ?? "last_name";
    const ascending = sortDirection !== "desc";

    let rows: ContactTableRow[] = [];
    let total = 0;

    if (isAdmin) {
      let fullQuery = supabase.from("people").select(CONTACT_SELECT);

      if (type) {
        fullQuery = fullQuery.eq("person_type", type);
      }

      if (search) {
        fullQuery = fullQuery.or(
          `first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%,phone_business.ilike.%${search}%,phone_mobile.ilike.%${search}%`,
        );
      }

      fullQuery = fullQuery.order(normalizedSortField, {
        ascending,
        nullsFirst: false,
        ...(sortField === "company" ? { foreignTable: "companies" } : {}),
      });

      if (normalizedSortField === "last_name") {
        fullQuery = fullQuery.order("first_name", {
          ascending,
          nullsFirst: false,
        });
      }

      const { data: people, error } = await fullQuery;

      if (error) {
        return apiErrorResponse(error);
      }

      const adminMap = await buildAdminMap(
        supabase,
        (people ?? []).map((person) => person.id),
      );

      rows = mapPeopleToRows((people ?? []) as ContactPersonRow[], adminMap).filter(
        (row) => row.is_admin === (isAdmin === "true"),
      );

      if (sortField === "full_name" || sortField === "company" || sortField === "phone" || sortField === "is_admin") {
        rows = sortRows(rows, sortField, sortDirection);
      }

      total = rows.length;
      const from = (page - 1) * perPage;
      rows = rows.slice(from, from + perPage);
    } else {
      let query = supabase.from("people").select(CONTACT_SELECT, { count: "exact" });

      if (type) {
        query = query.eq("person_type", type);
      }

      if (search) {
        query = query.or(
          `first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%,phone_business.ilike.%${search}%,phone_mobile.ilike.%${search}%`,
        );
      }

      query = query.order(normalizedSortField, {
        ascending,
        nullsFirst: false,
        ...(sortField === "company" ? { foreignTable: "companies" } : {}),
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

      const { data: people, error, count } = await query;

      if (error) {
        return apiErrorResponse(error);
      }

      const adminMap = await buildAdminMap(
        supabase,
        (people ?? []).map((person) => person.id),
      );

      rows = mapPeopleToRows((people ?? []) as ContactPersonRow[], adminMap);

      if (sortField === "full_name" || sortField === "company" || sortField === "phone" || sortField === "is_admin") {
        rows = sortRows(rows, sortField, sortDirection);
      }

      total = count || 0;
    }

    const totalPages = Math.max(1, Math.ceil(total / perPage));

    return NextResponse.json({
      data: rows,
      pagination: {
        page,
        per_page: perPage,
        total,
        total_pages: totalPages,
      },
    });
  },
);
