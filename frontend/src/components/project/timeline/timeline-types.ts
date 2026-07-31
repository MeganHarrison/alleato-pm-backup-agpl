export const KIND_LABEL: Record<string, string> = {
  project_created:          'Project Created',
  project_start:            'Construction Start',
  meeting:                  'Meeting',
  rfi:                      'RFI',
  submittal:                'Submittal',
  commitment:               'Commitment',
  commitment_executed:      'Commitment Executed',
  change_event:             'Change Event',
  change_order:             'Change Order',
  prime_contract:           'Contract Created',
  prime_contract_executed:  'Contract Executed',
};

export const TIMELINE_EVENT_KINDS = [
  'project_created',
  'project_start',
  'meeting',
  'rfi',
  'submittal',
  'commitment',
  'commitment_executed',
  'change_event',
  'change_order',
  'prime_contract',
  'prime_contract_executed',
] as const;

export type TimelineEventKind = (typeof TIMELINE_EVENT_KINDS)[number];

export interface TimelineEvent {
  occurred_at: string;
  kind: TimelineEventKind;
  title: string;
  summary: string | null;
  status: string | null;
  entity_id: string;
  project_id: number;
}

export interface TimelineMonthGroup {
  /** "May 2026" */
  label: string;
  /** "YYYY-MM" — used for sort key */
  monthKey: string;
  events: TimelineEvent[];
}
