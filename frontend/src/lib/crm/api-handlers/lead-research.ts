import { NextResponse } from "next/server";
import { z } from "zod";

import { apiErrorResponse } from "@/lib/api-error";
import {
  researchLead,
  type LeadResearchPayload,
} from "@/lib/crm/lead-research";
import { assertCrmOwnerOrAdmin, requireCrmAccess } from "@/lib/crm/server";
import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { createClient } from "@/lib/supabase/server";

function serializeArtifact(artifact: Record<string, unknown>) {
  return {
    id: artifact.id,
    artifactType: artifact.artifact_type,
    companyId: artifact.company_id,
    leadId: artifact.lead_id,
    dealId: artifact.deal_id,
    title: artifact.title,
    content: artifact.content,
    citations: artifact.citations,
    suggestions: artifact.suggestions,
    explanation: artifact.explanation,
    reviewStatus: artifact.review_status,
    createdAt: artifact.created_at,
  };
}

export const GET = withApiGuardrails(
  "crm/leads/[leadId]/research#GET",
  async ({ params }) => {
    const { leadId } = await params;
    if (!z.string().uuid().safeParse(leadId).success) {
      throw new GuardrailError({
        code: "VALIDATION_ERROR",
        where: "crm/leads/[leadId]/research#GET",
        message: "A valid CRM lead is required.",
        status: 400,
      });
    }
    const { db, personId, isAdmin } = await requireCrmAccess("read");
    const { data: lead, error: leadError } = await db
      .from("crm_leads")
      .select("owner_person_id")
      .eq("id", leadId)
      .is("archived_at", null)
      .maybeSingle();
    if (leadError) return apiErrorResponse(leadError);
    if (!lead)
      return NextResponse.json({ message: "Lead not found." }, { status: 404 });
    assertCrmOwnerOrAdmin({
      ownerPersonId: lead.owner_person_id,
      personId,
      isAdmin,
      action: "crm/leads/[leadId]/research#GET",
    });
    const { data, error } = await db
      .from("crm_ai_artifacts")
      .select("*")
      .eq("lead_id", leadId)
      .eq("artifact_type", "lead_research")
      .order("created_at", { ascending: false })
      .limit(10);
    if (error) return apiErrorResponse(error);
    return NextResponse.json({
      data: (data ?? []).map((artifact) =>
        serializeArtifact(artifact as Record<string, unknown>),
      ),
    });
  },
);

export const POST = withApiGuardrails(
  "crm/leads/[leadId]/research#POST",
  async ({ params }) => {
    const { leadId } = await params;
    if (!z.string().uuid().safeParse(leadId).success) {
      throw new GuardrailError({
        code: "VALIDATION_ERROR",
        where: "crm/leads/[leadId]/research#POST",
        message: "A valid CRM lead is required.",
        status: 400,
      });
    }
    const { db, personId, isAdmin } = await requireCrmAccess("write");
    const { data: lead, error } = await db
      .from("crm_leads")
      .select(
        "id, full_name, prospect_company_name, job_title, website_url, owner_person_id",
      )
      .eq("id", leadId)
      .is("archived_at", null)
      .maybeSingle();
    if (error) return apiErrorResponse(error);
    if (!lead)
      return NextResponse.json({ message: "Lead not found." }, { status: 404 });
    assertCrmOwnerOrAdmin({
      ownerPersonId: lead.owner_person_id,
      personId,
      isAdmin,
      action: "crm/leads/[leadId]/research#POST",
    });
    const sessionClient = await createClient();
    const { error: reservationError } = await sessionClient.rpc(
      "crm_reserve_lead_research",
      { p_lead_id: lead.id },
    );
    if (reservationError) {
      if (reservationError.message.includes("Wait five minutes")) {
        return NextResponse.json(
          { message: "Wait five minutes before researching this lead again." },
          { status: 429 },
        );
      }
      return apiErrorResponse(reservationError);
    }
    let result: LeadResearchPayload;
    try {
      result = await researchLead({
        fullName: lead.full_name,
        prospectCompanyName: lead.prospect_company_name,
        jobTitle: lead.job_title,
        websiteUrl: lead.website_url,
      });
    } catch (cause) {
      console.error("CRM lead research provider failed", { leadId, cause });
      throw new GuardrailError({
        code: "UPSTREAM_FAILURE",
        where: "crm/leads/[leadId]/research#POST",
        message:
          "Public-web research is temporarily unavailable. Try again later.",
        status: 503,
        cause,
      });
    }
    const { data, error: insertError } = await db
      .from("crm_ai_artifacts")
      .insert({
        artifact_type: "lead_research",
        lead_id: lead.id,
        title: `Public-web research for ${lead.full_name}`,
        content: result.summary,
        citations: result.citations,
        suggestions: result.suggestions,
        explanation:
          "Drafted from public web sources. Review every suggestion and citation before applying it to the lead.",
        review_status: "draft",
        created_by_person_id: personId,
      })
      .select()
      .single();
    if (insertError) return apiErrorResponse(insertError);
    return NextResponse.json(
      { data: serializeArtifact(data as Record<string, unknown>) },
      { status: 201 },
    );
  },
);
