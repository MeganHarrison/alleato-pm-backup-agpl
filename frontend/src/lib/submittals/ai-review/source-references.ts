import {
  type SubmittalAIReviewSourceReference,
  SubmittalAIReviewSourceReferenceSchema,
} from "./schemas";

type BuildSourceReferenceInput = Omit<
  SubmittalAIReviewSourceReference,
  "sourceKey"
> & {
  sourceKey?: string;
};

export type PromptSourceEntry = {
  key: string;
  reference: SubmittalAIReviewSourceReference;
  promptBlock: string;
};

function compactExcerpt(value: string | null, maxLength = 400) {
  const text = value?.trim() ?? "";
  if (!text) return null;
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
}

export function buildSourceReference(
  input: BuildSourceReferenceInput,
): SubmittalAIReviewSourceReference {
  return SubmittalAIReviewSourceReferenceSchema.parse({
    ...input,
    sourceKey: input.sourceKey ?? "",
    excerpt: compactExcerpt(input.excerpt),
  });
}

export function buildPromptSourceCatalog(
  items: BuildSourceReferenceInput[],
): PromptSourceEntry[] {
  return items.map((item, index) => {
    const key = item.sourceKey?.trim() || `SRC-${index + 1}`;
    const reference = buildSourceReference({ ...item, sourceKey: key });
    const promptBlock = [
      `${key}: ${reference.label}`,
      reference.excerpt ? `Excerpt: ${reference.excerpt}` : null,
      reference.drawingNumber ? `Drawing: ${reference.drawingNumber}` : null,
      reference.pageNumber !== null ? `Page: ${reference.pageNumber}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    return { key, reference, promptBlock };
  });
}

export function resolvePromptSourceKeys(
  keys: string[],
  catalog: PromptSourceEntry[],
): SubmittalAIReviewSourceReference[] {
  const byKey = new Map(catalog.map((entry) => [entry.key, entry.reference]));
  return keys
    .map((key) => byKey.get(key))
    .filter((value): value is SubmittalAIReviewSourceReference =>
      Boolean(value),
    );
}
