import type { TimelineEventKind } from './timeline-types';

const KIND_TO_PATH: Partial<Record<TimelineEventKind, string>> = {
  meeting:                   'meetings',
  rfi:                       'rfis',
  submittal:                 'submittals',
  commitment:                'commitments',
  commitment_executed:       'commitments',
  change_event:              'change-events',
  change_order:              'change-orders',
  prime_contract:            'prime-contracts',
  prime_contract_executed:   'prime-contracts',
  // project_created and project_start have no detail page
};

export function resolveTimelineLink(
  projectId: number,
  kind: TimelineEventKind,
  entityId: string,
): string | null {
  const path = KIND_TO_PATH[kind];
  if (!path) return null;
  return `/${projectId}/${path}/${entityId}`;
}
