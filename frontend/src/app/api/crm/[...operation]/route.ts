import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import {
  GET as getAccount,
  PATCH as patchAccount,
} from "@/lib/crm/api-handlers/account-detail";
import { POST as deactivateAccount } from "@/lib/crm/api-handlers/account-deactivate";
import { POST as unarchiveAccount } from "@/lib/crm/api-handlers/account-unarchive";
import {
  DELETE as deleteActivity,
  PATCH as patchActivity,
} from "@/lib/crm/api-handlers/activity-detail";
import { POST as decideCandidate } from "@/lib/crm/api-handlers/candidate-decision";
import {
  GET as getDeal,
  PATCH as patchDeal,
} from "@/lib/crm/api-handlers/deal-detail";
import { POST as deactivateDeal } from "@/lib/crm/api-handlers/deal-deactivate";
import {
  DELETE as unlinkDealDocument,
  POST as linkDealDocument,
} from "@/lib/crm/api-handlers/deal-documents";
import { POST as convertDeal } from "@/lib/crm/api-handlers/deal-conversion";
import { POST as severDealProjectLink } from "@/lib/crm/api-handlers/deal-sever-project-link";
import { POST as transitionDeal } from "@/lib/crm/api-handlers/deal-transition";
import { POST as unarchiveDeal } from "@/lib/crm/api-handlers/deal-unarchive";
import { GET as getLeadEmailHistory } from "@/lib/crm/api-handlers/lead-email-history";
import {
  GET as getLeadPhoto,
  POST as uploadLeadPhoto,
} from "@/lib/crm/api-handlers/lead-photo";
import { PATCH as patchLead } from "@/lib/crm/api-handlers/lead-profile";
import {
  GET as getLeadResearch,
  POST as createLeadResearch,
} from "@/lib/crm/api-handlers/lead-research";
import { POST as decideLeadResearch } from "@/lib/crm/api-handlers/lead-research-decision";
import {
  GET as getOperatingSystem,
  POST as postOperatingSystem,
} from "@/lib/crm/api-handlers/operating-system";
import { withApiGuardrails } from "@/lib/guardrails/api";

type CatchAllParams = { operation: string[] };
type RouteContext = { params: Promise<CatchAllParams> };

function notFound() {
  return NextResponse.json(
    { success: false, error: "CRM operation was not found." },
    { status: 404 },
  );
}

export async function dispatch(
  request: NextRequest,
  context: RouteContext,
): Promise<Response> {
  const { operation } = await context.params;
  const [resource, id, action, detail, ...rest] = operation;
  if (!resource || !id) return notFound();
  if (resource !== "leads" && rest.length > 0) return notFound();

  if (resource === "operating-system" && id === "workspace" && !action) {
    if (request.method === "GET") return getOperatingSystem();
    if (request.method === "POST") return postOperatingSystem(request);
  }

  if (resource === "accounts") {
    const params = { params: Promise.resolve({ companyId: id }) };
    if (!action && request.method === "GET") return getAccount(request, params);
    if (!action && request.method === "PATCH")
      return patchAccount(request, params);
    if (action === "deactivate" && request.method === "POST") {
      return deactivateAccount(request, params);
    }
    if (action === "unarchive" && request.method === "POST") {
      return unarchiveAccount(request, params);
    }
  }

  if (resource === "activities" && !action) {
    const params = { params: Promise.resolve({ activityId: id }) };
    if (request.method === "PATCH") return patchActivity(request, params);
    if (request.method === "DELETE") return deleteActivity(request, params);
  }

  if (resource === "leads") {
    const params = { params: Promise.resolve({ leadId: id }) };
    if (!action && !detail && rest.length === 0 && request.method === "PATCH")
      return patchLead(request, params);
    if (action === "photo" && !detail && rest.length === 0) {
      if (request.method === "GET") return getLeadPhoto(request, params);
      if (request.method === "POST") return uploadLeadPhoto(request, params);
    }
    if (
      action === "email-history" &&
      !detail &&
      rest.length === 0 &&
      request.method === "GET"
    ) {
      return getLeadEmailHistory(request, params);
    }
    if (action === "research" && !detail && rest.length === 0) {
      if (request.method === "GET") return getLeadResearch(request, params);
      if (request.method === "POST") return createLeadResearch(request, params);
    }
    if (
      action === "research" &&
      detail &&
      rest[0] === "decision" &&
      rest.length === 1 &&
      request.method === "POST"
    ) {
      return decideLeadResearch(request, {
        params: Promise.resolve({ leadId: id, artifactId: detail }),
      });
    }
  }

  if (
    resource === "activity-candidates" &&
    action === "decision" &&
    request.method === "POST"
  ) {
    return decideCandidate(request, {
      params: Promise.resolve({ candidateId: id }),
    });
  }

  if (resource === "deals") {
    const params = { params: Promise.resolve({ dealId: id }) };
    if (!action && request.method === "GET") return getDeal(request, params);
    if (!action && request.method === "PATCH")
      return patchDeal(request, params);
    if (action === "deactivate" && request.method === "POST") {
      return deactivateDeal(request, params);
    }
    if (action === "unarchive" && request.method === "POST") {
      return unarchiveDeal(request, params);
    }
    if (action === "documents" && !detail && request.method === "POST") {
      return linkDealDocument(request, params);
    }
    if (action === "documents" && detail && request.method === "DELETE") {
      return unlinkDealDocument(request, {
        params: Promise.resolve({ dealId: id, documentId: detail }),
      });
    }
    if (action === "conversion" && request.method === "POST") {
      return convertDeal(request, params);
    }
    if (action === "sever-project-link" && request.method === "POST") {
      return severDealProjectLink(request, params);
    }
    if (action === "transition" && request.method === "POST") {
      return transitionDeal(request, params);
    }
  }

  return notFound();
}

function guardedDispatch(method: "GET" | "PATCH" | "POST" | "DELETE") {
  return withApiGuardrails<CatchAllParams>(
    `crm/[...operation]#${method}`,
    ({ request, params }) =>
      dispatch(request, { params: Promise.resolve(params) }),
  );
}

export const GET = guardedDispatch("GET");
export const PATCH = guardedDispatch("PATCH");
export const POST = guardedDispatch("POST");
export const DELETE = guardedDispatch("DELETE");
