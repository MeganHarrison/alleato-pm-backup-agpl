#!/usr/bin/env tsx
import * as helpArticleModule from "../../frontend/src/lib/help-articles";

const helpArticles =
  "default" in helpArticleModule
    ? (helpArticleModule.default as typeof import("../../frontend/src/lib/help-articles"))
    : helpArticleModule;

const { getHelpArticles, validateHelpArticles } = helpArticles;

async function main() {
  const result = await validateHelpArticles();

  if (!result.valid) {
    console.error("Help article validation failed:");
    for (const error of result.errors) {
      console.error(`- ${error}`);
    }
    process.exit(1);
  }

  const clientVisible = await getHelpArticles({ clientVisibleOnly: true });
  const aiVisible = await getHelpArticles({ aiVisibleOnly: true });
  const featured = await getHelpArticles({ featuredOnly: true, clientVisibleOnly: true });

  console.log(`Help articles valid: ${result.articles.length}`);
  console.log(`Client-visible articles: ${clientVisible.length}`);
  console.log(`AI-visible articles: ${aiVisible.length}`);
  console.log(`Featured client-visible articles: ${featured.length}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
