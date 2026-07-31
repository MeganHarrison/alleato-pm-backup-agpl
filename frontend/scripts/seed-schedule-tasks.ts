#!/usr/bin/env tsx
/**
 * Seed schedule_tasks for E2E tests
 * Run with: npx tsx scripts/seed-schedule-tasks.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(__dirname, '../.env.local') });
dotenv.config({ path: resolve(__dirname, '../.env') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);
const PROJECT_ID = 67;

async function seed() {
  console.log('🧹 Clearing existing tasks for project', PROJECT_ID);

  await supabase.from('schedule_dependencies').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('schedule_tasks').delete().eq('project_id', PROJECT_ID);

  console.log('📝 Inserting tasks...');

  // Insert parent tasks first
  const { data: parents } = await supabase.from('schedule_tasks').insert([
    { project_id: PROJECT_ID, name: 'Phase 1: Planning', start_date: '2026-02-01', finish_date: '2026-02-15', status: 'complete', percent_complete: 100, sort_order: 1 },
    { project_id: PROJECT_ID, name: 'Phase 2: Foundation', start_date: '2026-02-16', finish_date: '2026-03-15', status: 'in_progress', percent_complete: 75, sort_order: 5 },
    { project_id: PROJECT_ID, name: 'Phase 3: Framing', start_date: '2026-03-16', finish_date: '2026-04-15', status: 'not_started', percent_complete: 0, sort_order: 10 },
  ]).select();

  if (!parents) {
    console.error('Failed to insert parent tasks');
    return;
  }

  const [phase1, phase2, phase3] = parents;

  // Insert child tasks
  await supabase.from('schedule_tasks').insert([
    // Phase 1 children
    { project_id: PROJECT_ID, parent_task_id: phase1.id, name: 'Site Survey', start_date: '2026-02-01', finish_date: '2026-02-05', status: 'complete', percent_complete: 100, sort_order: 2 },
    { project_id: PROJECT_ID, parent_task_id: phase1.id, name: 'Design Review', start_date: '2026-02-06', finish_date: '2026-02-12', status: 'complete', percent_complete: 100, sort_order: 3 },
    { project_id: PROJECT_ID, parent_task_id: phase1.id, name: 'Planning Complete', start_date: '2026-02-15', finish_date: '2026-02-15', status: 'complete', percent_complete: 100, is_milestone: true, sort_order: 4 },

    // Phase 2 children
    { project_id: PROJECT_ID, parent_task_id: phase2.id, name: 'Excavation', start_date: '2026-02-16', finish_date: '2026-02-23', status: 'complete', percent_complete: 100, sort_order: 6 },
    { project_id: PROJECT_ID, parent_task_id: phase2.id, name: 'Pour Concrete', start_date: '2026-02-24', finish_date: '2026-03-05', status: 'in_progress', percent_complete: 80, sort_order: 7 },
    { project_id: PROJECT_ID, parent_task_id: phase2.id, name: 'Foundation Inspection', start_date: '2026-03-06', finish_date: '2026-03-08', status: 'not_started', percent_complete: 0, sort_order: 8 },

    // Phase 3 children
    { project_id: PROJECT_ID, parent_task_id: phase3.id, name: 'Floor Framing', start_date: '2026-03-16', finish_date: '2026-03-25', status: 'not_started', percent_complete: 0, sort_order: 11 },
    { project_id: PROJECT_ID, parent_task_id: phase3.id, name: 'Wall Framing', start_date: '2026-03-26', finish_date: '2026-04-05', status: 'not_started', percent_complete: 0, sort_order: 12 },
    { project_id: PROJECT_ID, parent_task_id: phase3.id, name: 'Roof Framing', start_date: '2026-04-06', finish_date: '2026-04-15', status: 'not_started', percent_complete: 0, sort_order: 13 },
  ]);

  // Count results
  const { count } = await supabase.from('schedule_tasks').select('*', { count: 'exact' }).eq('project_id', PROJECT_ID);

  console.log(`✅ Seeded ${count} tasks`);
  console.log('🧪 Run tests: npx playwright test tests/e2e/schedule-page.spec.ts');
}

seed();
