import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { NextResponse } from "next/server";

import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import {
  getDocumentBundle,
  type DocumentRecordType,
} from "@/lib/documents/record-documents";

interface RouteParams {
  params: Promise<{
    recordType: string;
    recordId: string;
  }>;
}

function isDocumentRecordType(value: string): value is DocumentRecordType {
  return (
    value === "prime-contract" ||
    value === "commitment" ||
    value === "change-order" ||
    value === "prime-contract-change-order"
  );
}

export const GET = withApiGuardrails(
  "document-center/[recordType]/[recordId]/recipients#GET",
  async ({ request, params }) => {
  
    const { recordType, recordId } = await params;
    if (!isDocumentRecordType(recordType)) {
      return NextResponse.json({ error: "Unsupported record type" }, { status: 400 });
    }

    const supabase = await createClient();
    const user = await getApiRouteUser();

    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "document-center/[recordType]/[recordId]/recipients#GET", message: "Authentication required." });
    }

    const bundle = await getDocumentBundle(supabase, recordType, recordId);

    return NextResponse.json({
      defaultSubject: bundle.defaultSubject,
      filename: bundle.filename,
      recordLabel: bundle.label,
      recipients: bundle.recipients,
    });
    },
);
