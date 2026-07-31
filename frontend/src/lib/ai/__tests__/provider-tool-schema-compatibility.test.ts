import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import {
  assistantActionToolDescriptors,
  assistantSourceReadToolDescriptors,
} from "../tool-descriptors";
import {
  createCommitmentInputSchema,
  createContactInputSchema,
} from "../tool-schemas/action-schemas";
import {
  providerCompatibleEmailSchema,
  providerCompatibleIsoDateSchema,
  providerCompatibleOptionalIsoDateSchema,
} from "../tool-schemas/provider-compatible";

function unsupportedLookaroundPatterns(
  value: unknown,
  currentPath = "$",
): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((entry, index) =>
      unsupportedLookaroundPatterns(entry, `${currentPath}[${index}]`),
    );
  }
  if (!value || typeof value !== "object") return [];

  return Object.entries(value).flatMap(([key, entry]) => {
    const entryPath = `${currentPath}.${key}`;
    if (
      key === "pattern" &&
      typeof entry === "string" &&
      entry.includes("(?")
    ) {
      return [`${entryPath}: ${entry}`];
    }
    return unsupportedLookaroundPatterns(entry, entryPath);
  });
}

function typeScriptFilesUnder(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) return typeScriptFilesUnder(absolutePath);
    return entry.isFile() && /\.tsx?$/.test(entry.name) ? [absolutePath] : [];
  });
}

describe("AI provider tool-schema compatibility", () => {
  it("keeps the shared email validator provider-safe and runtime-valid", () => {
    expect(
      providerCompatibleEmailSchema.safeParse("pm@example.com").success,
    ).toBe(true);
    expect(
      providerCompatibleEmailSchema.safeParse("not-an-email").success,
    ).toBe(false);

    expect(
      unsupportedLookaroundPatterns(
        z.toJSONSchema(providerCompatibleEmailSchema),
      ),
    ).toEqual([]);
  });

  it("keeps the shared ISO date validator provider-safe and calendar-valid", () => {
    expect(
      providerCompatibleIsoDateSchema.safeParse("2026-07-30").success,
    ).toBe(true);
    expect(
      providerCompatibleIsoDateSchema.safeParse("2026-02-30").success,
    ).toBe(false);

    expect(
      unsupportedLookaroundPatterns(
        z.toJSONSchema(providerCompatibleIsoDateSchema),
      ),
    ).toEqual([]);
  });

  it("allows blank commitment dates but rejects malformed nonblank dates", () => {
    const baseInput = {
      projectId: 767,
      type: "subcontract" as const,
      title: "Electrical subcontract",
    };

    expect(
      createCommitmentInputSchema.safeParse({
        ...baseInput,
        startDate: "",
        estimatedCompletionDate: "",
      }).success,
    ).toBe(true);
    expect(
      createCommitmentInputSchema.safeParse({
        ...baseInput,
        startDate: "2026-02-30",
      }).success,
    ).toBe(false);
    expect(
      createCommitmentInputSchema.safeParse({
        ...baseInput,
        estimatedCompletionDate: "not-a-date",
      }).success,
    ).toBe(false);
    expect(
      unsupportedLookaroundPatterns(
        z.toJSONSchema(providerCompatibleOptionalIsoDateSchema),
      ),
    ).toEqual([]);
  });

  it("keeps registered descriptor schemas free of unsupported regex lookarounds", () => {
    const descriptors = [
      ...assistantSourceReadToolDescriptors,
      ...assistantActionToolDescriptors,
      {
        name: "createContact",
        inputSchema: createContactInputSchema,
      },
    ];

    const failures = descriptors.flatMap((descriptor) =>
      unsupportedLookaroundPatterns(z.toJSONSchema(descriptor.inputSchema)).map(
        (failure) => `${descriptor.name} ${failure}`,
      ),
    );

    expect(failures).toEqual([]);
  });

  it("prevents Zod's provider-incompatible built-in email schema in AI sources", () => {
    const aiRoot = path.resolve(process.cwd(), "src/lib/ai");
    const offenders = typeScriptFilesUnder(aiRoot)
      .filter(
        (filePath) =>
          !filePath.endsWith("provider-tool-schema-compatibility.test.ts"),
      )
      .filter((filePath) =>
        /\.email\(\)/.test(fs.readFileSync(filePath, "utf8")),
      )
      .map((filePath) => path.relative(process.cwd(), filePath));

    expect(offenders).toEqual([]);
  });
});
