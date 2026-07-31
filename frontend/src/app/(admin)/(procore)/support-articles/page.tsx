import { createClient } from "@/lib/supabase/server";
import { SupportArticlesClient } from "./support-articles-client";

export default async function SupportArticlesPage() {
  const supabase = await createClient();

  const { data: articles, error } = await supabase
    .from("support_articles")
    .select(
      "id, url, slug, title, description, category, subcategory, breadcrumb, tags, word_count, last_crawled_at, source_updated_at, created_at, updated_at"
    )
    .order("title", { ascending: true });

  // Get chunk counts per article
  const { data: chunkStats } = await supabase
    .from("support_article_chunks")
    .select("article_id, id, embedding");

  // Aggregate chunk counts and embedding coverage per article
  const chunkMap = new Map<number, { total: number; embedded: number }>();
  if (chunkStats) {
    for (const chunk of chunkStats) {
      const existing = chunkMap.get(chunk.article_id) ?? {
        total: 0,
        embedded: 0,
      };
      existing.total++;
      if (chunk.embedding) existing.embedded++;
      chunkMap.set(chunk.article_id, existing);
    }
  }

  const enrichedArticles = (articles ?? []).map((article) => {
    const stats = chunkMap.get(article.id) ?? { total: 0, embedded: 0 };
    return {
      ...article,
      chunk_count: stats.total,
      embedded_count: stats.embedded,
    };
  });

  return (
    <SupportArticlesClient
      articles={enrichedArticles}
      errorMessage={error?.message ?? null}
    />
  );
}
