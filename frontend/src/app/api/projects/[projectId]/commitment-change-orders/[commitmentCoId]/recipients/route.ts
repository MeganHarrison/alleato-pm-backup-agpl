import { NextResponse } from "next/server";

import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";

interface RecipientOption {
  id: string;
  email: string;
  name: string;
  source: string;
  defaultSelected: boolean;
}

function dedupeRecipients(recipients: RecipientOption[]) {
  const merged = new Map<string, RecipientOption>();
  for (const recipient of recipients) {
    const key = recipient.email.trim().toLowerCase();
    if (!key) continue;
    const existing = merged.get(key);
    if (!existing || recipient.defaultSelected) {
      merged.set(key, recipient);
    }
  }
  return Array.from(merged.values()).sort((left, right) => {
    if (left.defaultSelected !== right.defaultSelected) {
      return left.defaultSelected ? -1 : 1;
    }
    return left.name.localeCompare(right.name);
  });
}

export const GET = withApiGuardrails<{
  projectId: string;
  commitmentCoId: string;
}>(
  "projects/[projectId]/commitment-change-orders/[commitmentCoId]/recipients#GET",
  async ({ params }) => {
    const { projectId, commitmentCoId } = await params;
    const parsedProjectId = Number.parseInt(projectId, 10);

    if (!Number.isFinite(parsedProjectId)) {
      throw new GuardrailError({
        code: "BAD_REQUEST",
        where: "projects/[projectId]/commitment-change-orders/[commitmentCoId]/recipients#GET",
        message: "Invalid project id.",
        status: 400,
      });
    }

    const supabase = await createClient();
    const user = await getApiRouteUser();

    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "projects/[projectId]/commitment-change-orders/[commitmentCoId]/recipients#GET",
        message: "Authentication required.",
      });
    }

    const { data: scoped, error: scopedError } = await supabase
      .from("commitment_change_orders_with_scope")
      .select("id, project_id, contract_id, commitment_type, change_order_number, title, description")
      .eq("id", commitmentCoId)
      .eq("project_id", parsedProjectId)
      .maybeSingle();

    if (scopedError) {
      return NextResponse.json({ error: scopedError.message }, { status: 500 });
    }

    if (!scoped?.contract_id) {
      throw new GuardrailError({
        code: "ROUTE_BINDING_MISSING",
        where: "projects/[projectId]/commitment-change-orders/[commitmentCoId]/recipients#GET",
        message: "Commitment change order not found.",
        status: 404,
      });
    }

    const totalsTable =
      scoped.commitment_type === "purchase_order"
        ? "purchase_orders_with_totals"
        : "subcontracts_with_totals";

    const { data: commitment, error: commitmentError } = await supabase
      .from(totalsTable)
      .select("contract_number, title, company_name, contract_company_id, invoice_contact_ids")
      .eq("id", scoped.contract_id)
      .maybeSingle();

    if (commitmentError) {
      return NextResponse.json({ error: commitmentError.message }, { status: 500 });
    }

    if (!commitment) {
      throw new GuardrailError({
        code: "ROUTE_BINDING_MISSING",
        where: "projects/[projectId]/commitment-change-orders/[commitmentCoId]/recipients#GET",
        message: "The linked commitment for this change order could not be loaded.",
        status: 404,
      });
    }

    const peopleQueries = [];
    if (commitment.contract_company_id) {
      peopleQueries.push(
        supabase
          .from("people")
          .select("id, first_name, last_name, email")
          .eq("company_id", commitment.contract_company_id)
          .not("email", "is", null)
          .order("created_at", { ascending: true })
          .limit(20),
      );
    }
    if ((commitment.invoice_contact_ids ?? []).length > 0) {
      peopleQueries.push(
        supabase
          .from("people")
          .select("id, first_name, last_name, email")
          .in("id", commitment.invoice_contact_ids ?? []),
      );
    }

    const peopleResults = await Promise.all(peopleQueries);
    for (const result of peopleResults) {
      if (result.error) {
        return NextResponse.json({ error: result.error.message }, { status: 500 });
      }
    }

    const recipients = dedupeRecipients(
      peopleResults.flatMap((result) =>
        (result.data ?? [])
          .filter((person) => Boolean(person.email))
          .map((person) => ({
            id: person.id,
            email: person.email as string,
            name:
              [person.first_name, person.last_name].filter(Boolean).join(" ").trim() ||
              (person.email as string),
            source:
              (commitment.invoice_contact_ids ?? []).includes(person.id)
                ? "Invoice contact"
                : scoped.commitment_type === "purchase_order"
                  ? "Vendor contact"
                  : "Subcontractor contact",
            defaultSelected: (commitment.invoice_contact_ids ?? []).includes(person.id),
          })),
      ),
    );

    const defaultNumber = scoped.change_order_number || "CCO";
    const defaultTitle = scoped.title || scoped.description || commitment.title || "Commitment Change Order";

    return NextResponse.json({
      defaultSubject: `${defaultNumber} - ${defaultTitle}`,
      recipients,
    });
  },
);
