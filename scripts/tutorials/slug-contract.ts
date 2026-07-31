const TUTORIAL_DOC_SLUG_ALIASES: Record<string, string> = {
  "create-commitment": "create-a-commitment",
};

export function resolveTutorialDocSlug(value: string): string {
  return TUTORIAL_DOC_SLUG_ALIASES[value] ?? value;
}
