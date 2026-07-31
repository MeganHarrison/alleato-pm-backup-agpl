/**
 * Generate AI progress reports for active projects.
 * Usage: cd frontend && npx tsx --tsconfig tsconfig.json scripts/gen-reports.ts
 */
import { createClient } from "@supabase/supabase-js";
import { generateProgressReportSections } from "@/lib/progress-reports/ai-generate";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const PROJECTS = [
  { id: 31, name: "Uniqlo Phillipsburg NJ" },
  { id: 25125, name: "Goodwill Noblesville" },
  { id: 60, name: "Alleato Finance" },
];

const weekStart = "2026-04-28";
const weekEnd = "2026-05-04";

async function main() {
  const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

  const { data: profiles } = await db.from("profiles").select("id").limit(1);
  const userId = profiles?.[0]?.id ?? null;

  for (const project of PROJECTS) {
    console.log(`\n── ${project.name} (${project.id}) ──`);
    
    const { data: existing } = await db
      .from("project_progress_reports")
      .select("id")
      .eq("project_id", project.id)
      .eq("week_start", weekStart)
      .maybeSingle();
    
    let reportId: string;
    if (existing) {
      reportId = existing.id;
      console.log(`  (existing report ${reportId} — regenerating AI content)`);
    } else {
      const { data: inserted, error: insertErr } = await db
        .from("project_progress_reports")
        .insert({
          project_id: project.id,
          title: `Week of ${weekStart}`,
          week_start: weekStart,
          week_end: weekEnd,
          status: "draft",
          created_by: userId,
          updated_by: userId,
          client_recipients: [],
        })
        .select("id")
        .single();
      
      if (insertErr || !inserted) {
        console.error(`  ✗ Insert failed: ${insertErr?.message}`);
        continue;
      }
      reportId = inserted.id;
      console.log(`  Created report ${reportId}`);
    }
    
    console.log(`  Generating AI sections...`);
    try {
      const sections = await generateProgressReportSections({ projectId: project.id, weekStart, weekEnd });
      
      await db
        .from("project_progress_reports")
        .update({
          past_week_highlights: sections.past_week_highlights,
          upcoming_week_activities: sections.upcoming_week_activities,
          open_items: sections.open_items,
          updated_by: userId,
          updated_at: new Date().toISOString(),
        })
        .eq("id", reportId);
      
      console.log(`\n  Past week highlights:`);
      sections.past_week_highlights.split('\n').forEach(l => console.log('    ' + l));
      console.log(`\n  Upcoming week:`);
      sections.upcoming_week_activities.split('\n').forEach(l => console.log('    ' + l));
      console.log(`\n  Open items:`);
      sections.open_items.split('\n').forEach(l => console.log('    ' + l));
    } catch (err) {
      console.error(`  ✗ AI failed: ${err instanceof Error ? err.message : err}`);
    }
  }
  
  console.log('\n✓ Done');
}

main().catch(err => { console.error(err); process.exit(1); });
