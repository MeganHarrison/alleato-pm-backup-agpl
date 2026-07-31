/**
 * /api/testing/cases/[caseId]
 * PATCH — update editable fields of a test case
 * DELETE — remove a test case
 */
import { withApiGuardrails } from "@/lib/guardrails/api";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { z } from "zod";

const relativePathPattern = /^\/[^\s]*$/;

const patchSchema = z.object({
  test_number: z.string().trim().min(1).max(20).optional(),
  category: z.string().trim().min(1).max(100).optional(),
  subcategory: z.string().trim().max(100).nullable().optional(),
  test_name: z.string().trim().min(1).max(300).optional(),
  priority: z.enum(["HIGH", "MEDIUM", "LOW"]).optional(),
  test_type: z.string().trim().min(1).max(50).optional(),
  suite_id: z.string().trim().min(1).max(100).optional(),
  steps: z.string().nullable().optional(),
  setup_steps: z.string().nullable().optional(),
  context_note: z.string().nullable().optional(),
  expected_result: z.string().nullable().optional(),
  start_url: z.string().trim().max(500).nullable().optional(),
});

// Normalizes optional text fields so blank strings do not get persisted as content.
function normalizeOptionalText(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export const PATCH = withApiGuardrails<{ caseId: string }>(
  "testing/cases/[caseId]#PATCH",
  async ({ request, params }) => {
    const { caseId } = params;
    const body = await request.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.message, code: "VALIDATION_FAILED", where: "testing/cases PATCH" },
        { status: 400 }
      );
    }

    const payload = {
      ...parsed.data,
      subcategory: normalizeOptionalText(parsed.data.subcategory),
      steps: normalizeOptionalText(parsed.data.steps),
      setup_steps: normalizeOptionalText(parsed.data.setup_steps),
      context_note: normalizeOptionalText(parsed.data.context_note),
      expected_result: normalizeOptionalText(parsed.data.expected_result),
      start_url: normalizeOptionalText(parsed.data.start_url),
    };

    const supabase = await createClient();
    const { data: existing, error: existingError } = await supabase
      .from("test_cases")
      .select("test_type, steps, setup_steps, expected_result, start_url")
      .eq("id", caseId)
      .single();

    if (existingError || !existing) {
      return NextResponse.json(
        { error: existingError?.message ?? "Case not found", code: "NOT_FOUND", where: "testing/cases PATCH" },
        { status: 404 }
      );
    }

    const nextValues = {
      test_type: payload.test_type ?? existing.test_type,
      steps: payload.steps ?? existing.steps,
      setup_steps: payload.setup_steps ?? existing.setup_steps,
      expected_result: payload.expected_result ?? existing.expected_result,
      start_url: payload.start_url ?? existing.start_url,
    };

    if (nextValues.test_type === "scenario") {
      if (!nextValues.steps?.trim()) {
        return NextResponse.json(
          { error: "Scenario test cases require non-empty steps.", code: "VALIDATION_FAILED", where: "testing/cases PATCH" },
          { status: 400 }
        );
      }
      if (!nextValues.expected_result?.trim()) {
        return NextResponse.json(
          { error: "Scenario test cases require an expected result.", code: "VALIDATION_FAILED", where: "testing/cases PATCH" },
          { status: 400 }
        );
      }
      if (!nextValues.start_url?.trim()) {
        return NextResponse.json(
          { error: "Scenario test cases require a start URL.", code: "VALIDATION_FAILED", where: "testing/cases PATCH" },
          { status: 400 }
        );
      }
      if (!relativePathPattern.test(nextValues.start_url.trim())) {
        return NextResponse.json(
          { error: "Scenario start URL must be a relative path beginning with '/'.", code: "VALIDATION_FAILED", where: "testing/cases PATCH" },
          { status: 400 }
        );
      }
    }

    const { data, error } = await supabase
      .from("test_cases")
      .update(payload)
      .eq("id", caseId)
      .select("*")
      .single();

    if (error) {
      return NextResponse.json(
        { error: error.message, code: "DB_ERROR", where: "testing/cases PATCH" },
        { status: 500 }
      );
    }

    return NextResponse.json({ case: data });
  }
);

export const DELETE = withApiGuardrails<{ caseId: string }>(
  "testing/cases/[caseId]#DELETE",
  async ({ params }) => {
    const { caseId } = params;
    const supabase = await createClient();
    const { error } = await supabase
      .from("test_cases")
      .delete()
      .eq("id", caseId);

    if (error) {
      return NextResponse.json(
        { error: error.message, code: "DB_ERROR", where: "testing/cases DELETE" },
        { status: 500 }
      );
    }

    return NextResponse.json({ deleted: true });
  }
);
