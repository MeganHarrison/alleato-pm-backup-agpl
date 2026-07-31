import { readFileSync } from "fs";
import { join } from "path";

const migrationSql = readFileSync(
  join(
    process.cwd(),
    "..",
    "supabase",
    "migrations",
    "20260619210000_search_chat_history.sql",
  ),
  "utf8",
);

describe("search_chat_history migration contract", () => {
  it("uses chat_history full-text and trigram search instead of document RAG tables", () => {
    expect(migrationSql).toContain("to_tsvector('english', coalesce(content, ''))");
    expect(migrationSql).toContain("gin_trgm_ops");
    expect(migrationSql).toContain("from public.chat_history h");
    expect(migrationSql).not.toContain("document_chunks");
  });

  it("keeps scoped authorization, lineage dedupe, anchored windows, and loud-empty output", () => {
    expect(migrationSql).toContain("p_user_id uuid default auth.uid()");
    expect(migrationSql).toContain("search_chat_history user scope does not match");
    expect(migrationSql).toContain("partition by mm.lineage_root_session_id");
    expect(migrationSql).toContain("between sm.message_ordinal - v_window_size");
    expect(migrationSql).toContain("'empty'::text");
    expect(migrationSql).toContain("bookend_start");
    expect(migrationSql).toContain("bookend_end");
  });
});
