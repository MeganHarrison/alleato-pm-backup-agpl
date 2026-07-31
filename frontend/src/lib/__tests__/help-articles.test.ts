import {
  getHelpArticleBySlug,
  getHelpArticles,
  HELP_ARTICLES_ROOT,
  validateHelpArticles,
} from "../help-articles";

describe("canonical runtime help articles", () => {
  it("loads a non-empty catalog from the app-expert runtime owner", async () => {
    const result = await validateHelpArticles();

    expect(HELP_ARTICLES_ROOT).toContain(
      "backend",
    );
    expect(result.errors).toEqual([]);
    expect(result.articles.length).toBeGreaterThanOrEqual(10);
    await expect(
      getHelpArticleBySlug("ai-assistant-actions"),
    ).resolves.not.toBeNull();
  });

  it("applies visibility filters instead of returning the full catalog", async () => {
    const all = await getHelpArticles({ includeDrafts: true });
    const clientVisible = await getHelpArticles({
      clientVisibleOnly: true,
    });
    const aiVisible = await getHelpArticles({
      aiVisibleOnly: true,
    });

    expect(clientVisible.every((article) =>
      article.frontmatter.client_visible
    )).toBe(true);
    expect(aiVisible.every((article) =>
      article.frontmatter.ai_visible
    )).toBe(true);
    expect(clientVisible.length).toBeLessThanOrEqual(all.length);
    expect(aiVisible.length).toBeLessThanOrEqual(all.length);
  });
});
