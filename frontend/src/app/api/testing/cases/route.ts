/**
 * /api/testing/cases
 * POST — create a new test case in a suite
 */
import { withApiGuardrails } from "@/lib/guardrails/api";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { z } from "zod";

const relativePathPattern = /^\/[^\s]*$/;

const schema = z.object({
  suite_id: z.string().uuid(),
  test_number: z.string().trim().min(1).max(20),
  category: z.string().trim().min(1).max(100),
  subcategory: z.string().trim().max(100).nullable().optional(),
  test_name: z.string().trim().min(1).max(300),
  priority: z.enum(["HIGH", "MEDIUM", "LOW"]).default("MEDIUM"),
  test_type: z.enum(["scenario", "feature"]).default("scenario"),
  steps: z.string().nullable().optional(),
  setup_steps: z.string().nullable().optional(),
  context_note: z.string().nullable().optional(),
  expected_result: z.string().nullable().optional(),
  start_url: z.string().trim().max(500).nullable().optional(),
}).superRefine((data, ctx) => {
  if (data.test_type !== "scenario") return;

  if (!data.steps?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Scenario test cases require non-empty steps.",
      path: ["steps"],
    });
  }
  if (!data.expected_result?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Scenario test cases require an expected result.",
      path: ["expected_result"],
    });
  }
  if (!data.start_url?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Scenario test cases require a start URL.",
      path: ["start_url"],
    });
  } else if (!relativePathPattern.test(data.start_url.trim())) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Scenario start URL must be a relative path beginning with '/'.",
      path: ["start_url"],
    });
  }
});

// Normalizes optional text fields so blank strings do not get persisted as content.
function normalizeOptionalText(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export const POST = withApiGuardrails(
  "testing/cases#POST",
  async ({ request }) => {
    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.message, code: "VALIDATION_FAILED" },
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
    const { data, error } = await supabase
      .from("test_cases")
      .insert(payload)
      .select(
        "id, test_number, category, subcategory, test_name, context_note, setup_steps, steps, expected_result, priority, start_url, test_type"
      )
      .single();

    if (error) {
      return NextResponse.json(
        { error: error.message, code: "DB_ERROR" },
        { status: 500 }
      );
    }

    return NextResponse.json({ case: data }, { status: 201 });
  }
);
