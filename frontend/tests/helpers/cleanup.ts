import {
  deleteChangeOrdersByProject,
  deleteMeetingsByProject,
  deleteProject,
  deleteProjectMembers,
} from "./db";

export async function cleanupProjectArtifacts(projectId: number) {
  await deleteMeetingsByProject(projectId);
  await deleteChangeOrdersByProject(projectId);
  await deleteProjectMembers(projectId);
  await deleteProject(projectId);
}

import { getAdminClient } from './db';

export async function cleanupChangeEvents(changeEventIds: string[]) {
  if (changeEventIds.length === 0) {
    return;
  }

  const supabase = getAdminClient();

  await supabase
    .from('change_event_line_items')
    .delete()
    .in('change_event_id', changeEventIds);

  await supabase
    .from('change_event_attachments')
    .delete()
    .in('change_event_id', changeEventIds);

  await supabase
    .from('change_event_history')
    .delete()
    .in('change_event_id', changeEventIds);

  await supabase
    .from('change_events')
    .delete()
    .in('id', changeEventIds);
}
