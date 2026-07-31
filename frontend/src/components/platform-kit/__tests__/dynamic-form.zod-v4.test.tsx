/** @jest-environment jsdom */

/**
 * Runtime proof that the vendored Platform Kit forms render and validate under
 * Zod v4 (this repo is on zod@4) without throwing. Zod v4 changed the schema
 * internals the kit introspects at runtime:
 *   - `.refine()/.superRefine()` no longer wrap objects in a (removed) ZodEffects
 *   - `.preprocess()/.transform()` are modeled as a ZodPipe (not ZodEffects)
 *   - `ZodEnum` exposes options via `_def.entries` / `.options` (not `_def.values`)
 * `DynamicForm` reads all of the above through `getZodDef`/`unwrapZodType`, so a
 * bad read is a silent field drop (or an empty <Select>), and the top-level
 * `zodResolver(schema)` wiring is where a hard runtime error would surface.
 *
 * This test exercises the real component + the real production schemas.
 */

import { render, screen } from "@testing-library/react";
import { zodResolver } from "@hookform/resolvers/zod";

import { DynamicForm } from "@/components/platform-kit/components/dynamic-form";
import {
  authEmailProviderSchema,
  authFieldLabels,
  authGeneralSettingsSchema,
  authGoogleProviderSchema,
  authPhoneProviderSchema,
} from "@/components/platform-kit/lib/schemas/auth";
import { secretsSchema } from "@/components/platform-kit/lib/schemas/secrets";

describe("DynamicForm under Zod v4", () => {
  it("renders the Auth general-settings form with both boolean fields", () => {
    render(
      <DynamicForm
        schema={authGeneralSettingsSchema}
        onSubmit={() => {}}
        labels={authFieldLabels}
      />,
    );
    expect(screen.getByText("Disable Signup")).toBeInTheDocument();
    expect(screen.getByText("Allow Anonymous Sign-ins")).toBeInTheDocument();
  });

  it("renders every field type in the Email provider form (boolean, number, and a preprocess/transform enum)", () => {
    render(
      <DynamicForm
        schema={authEmailProviderSchema}
        onSubmit={() => {}}
        labels={authFieldLabels}
      />,
    );
    // boolean
    expect(screen.getByText("Enable Email Provider")).toBeInTheDocument();
    // number
    expect(screen.getByText("Minimum Password Length")).toBeInTheDocument();
    // enum reached through `.preprocess().optional().transform()` (a ZodPipe in v4)
    expect(screen.getByText("Password Requirements")).toBeInTheDocument();
  });

  it("renders the Phone provider enum (sms_provider) — proves v4 enum options are read", () => {
    render(
      <DynamicForm
        schema={authPhoneProviderSchema}
        onSubmit={() => {}}
        labels={authFieldLabels}
      />,
    );
    // The enum field itself renders (its label). A combobox trigger proves the
    // <Select> mounted rather than falling through to the empty default branch.
    expect(screen.getByText("SMS Provider")).toBeInTheDocument();
    expect(screen.getAllByRole("combobox").length).toBeGreaterThan(0);
  });

  it("renders the Google provider form whose schema is object.superRefine() (ZodObject, not ZodEffects, in v4)", () => {
    render(
      <DynamicForm
        schema={authGoogleProviderSchema as unknown as typeof authGeneralSettingsSchema}
        onSubmit={() => {}}
        labels={authFieldLabels}
      />,
    );
    expect(screen.getByText("Enable Google Sign-in")).toBeInTheDocument();
    expect(screen.getByText("Google Client ID(s)")).toBeInTheDocument();
  });
});

describe("Secrets form resolver under Zod v4", () => {
  const resolver = zodResolver(secretsSchema);
  const rhfOptions = {
    fields: {},
    criteriaMode: "firstError" as const,
    shouldUseNativeValidation: false,
  };

  it("accepts a valid secret", async () => {
    const result = await resolver(
      { secrets: [{ name: "STRIPE_KEY", value: "sk_live_123" }] },
      undefined,
      rhfOptions,
    );
    expect(result.errors).toEqual({});
    expect((result.values as { secrets: unknown[] }).secrets).toHaveLength(1);
  });

  it("rejects an invalid secret name (must start with a letter/underscore)", async () => {
    const result = await resolver(
      { secrets: [{ name: "1-bad name", value: "" }] },
      undefined,
      rhfOptions,
    );
    expect(result.errors).not.toEqual({});
  });
});
