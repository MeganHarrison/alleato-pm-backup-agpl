export const dynamic = "force-dynamic";

import { DEFAULT_PROJECT_PHASE_FILTER } from "@/lib/portfolio/projects-page-filters";
import { createClient } from "@/lib/supabase/server";
import { DocumentMetadataClient } from "./document-metadata-client";

const INITIAL_DOCUMENT_METADATA_LIMIT = 5000;

export default async function DocumentMetadataPage() {
  const supabase = await createClient();

  const [{ data, error }, { data: projectRows }] = await Promise.all([
    supabase
      .from("document_metadata")
      .select(
        "id, title, type, source, source_system, summary, date, created_at, status, participants, project_id, project, phase, category, division, duration_minutes, meeting_type, host_email, organizer_email, url, fireflies_link, tags, file_name, file_path, source_web_url, keywords, source_metadata",
      )
      .order("date", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(INITIAL_DOCUMENT_METADATA_LIMIT),
    supabase
      .from("projects")
      .select("id, name")
      .ilike("phase", DEFAULT_PROJECT_PHASE_FILTER)
      .eq("archived", false)
      .order("name", { ascending: true }),
  ]);

  const allProjects = (projectRows ?? []).map((p) => ({ id: p.id as number, name: p.name as string }));
  const items = (data ?? []).map((item) => ({ ...item, content: null }));

  return (
    <DocumentMetadataClient
      items={items}
      errorMessage={error?.message ?? null}
      allProjects={allProjects}
    />
  );
}
