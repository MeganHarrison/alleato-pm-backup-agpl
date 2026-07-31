-- Catalog the user-facing records that can be drafted or created through Alleato AI.
-- The `status` column remains the implementation source of truth. `ai_chat_workflow`
-- makes the approval boundary inspectable, while `ai_chat_screenshot_url` points to
-- a rendered assistant reference instead of a stale or unverifiable screenshot id.

begin;

alter table public.procore_features
  add column if not exists ai_chat_screenshot_url text,
  add column if not exists ai_chat_workflow jsonb not null default '{}'::jsonb;

alter table public.procore_features
  drop constraint if exists procore_features_ai_chat_workflow_object;

alter table public.procore_features
  add constraint procore_features_ai_chat_workflow_object
  check (jsonb_typeof(ai_chat_workflow) = 'object');

comment on column public.procore_features.ai_chat_screenshot_url is
  'Repository-relative path or durable URL for a current assistant UI screenshot. Empty means capture is still required; do not substitute a mock.';

comment on column public.procore_features.ai_chat_workflow is
  'Assistant creation contract: prompt, preview, explicit approval, execution owner, audit behavior, and supported/unsupported state.';

with catalog (
  name,
  slug,
  description,
  status,
  category,
  priority,
  complexity,
  ai_enhancement_possible,
  ai_enhancement_notes,
  ai_chat_screenshot_url,
  ai_chat_workflow
) as (
  values
    (
      'AI: Draft Prime Contract', 'ai-create-prime-contract',
      'Drafts a project Prime Contract, including owner resolution and Schedule of Values rows.',
      'implemented', 'AI content creation', 'high', 'hard', true,
      'Implemented by createPrimeContract. Project access, preview, explicit confirmation, idempotency, and ai_tool_write_audits are enforced.',
      'docs/ops/evidence/2026-07-22-chat-history-duplicate-conversations/production-after-new-chat.png',
      jsonb_build_object('tool', 'createPrimeContract', 'surface', '/ai-assistant', 'prompt', 'Draft a Prime Contract for the selected project.', 'stages', jsonb_build_array('collect required fields and resolve the project/owner', 'show contract and Schedule of Values preview', 'require explicit user confirmation', 'create the record and write an audit receipt'), 'approvalRequired', true, 'auditTable', 'ai_tool_write_audits')
    ),
    (
      'AI: Edit Prime Contract Schedule of Values', 'ai-edit-prime-contract-sov',
      'Adds or updates Schedule of Values rows for an existing draft Prime Contract.',
      'implemented', 'AI content creation', 'high', 'hard', true,
      'Implemented by editPrimeContractSov. Only active project budget codes may be used; every changed row and revised total is previewed before approval.',
      'docs/ops/evidence/2026-07-22-chat-history-duplicate-conversations/production-after-new-chat.png',
      jsonb_build_object('tool', 'editPrimeContractSov', 'surface', '/ai-assistant', 'prompt', 'Add or update SOV rows on my draft Prime Contract.', 'stages', jsonb_build_array('resolve draft contract and active budget codes', 'show changed rows and revised total', 'require explicit user confirmation', 'persist rows and write an audit receipt'), 'approvalRequired', true, 'auditTable', 'ai_tool_write_audits')
    ),
    (
      'AI: Draft RFI', 'ai-create-rfi',
      'Collects required information and drafts a Request for Information for a project.',
      'implemented', 'AI content creation', 'high', 'medium', true,
      'Implemented by createRFI with a preview-before-write contract, project authorization, idempotency, and write audit.',
      'docs/ops/evidence/2026-07-22-chat-history-duplicate-conversations/production-after-new-chat.png',
      jsonb_build_object('tool', 'createRFI', 'surface', '/ai-assistant', 'prompt', 'Draft an RFI for the selected project.', 'stages', jsonb_build_array('collect question, assignee, due date, and impacts', 'show RFI preview', 'require explicit user confirmation', 'create the RFI and write an audit receipt'), 'approvalRequired', true, 'auditTable', 'ai_tool_write_audits')
    ),
    (
      'AI: Draft Change Event', 'ai-create-change-event',
      'Guides a Change Event draft from project evidence through a review card and confirmed creation.',
      'implemented', 'AI content creation', 'high', 'hard', true,
      'Implemented by createChangeEvent. The persisted draft workflow surfaces missing fields and a review card before the confirmed write.',
      'docs/ops/evidence/2026-07-22-chat-history-duplicate-conversations/production-after-new-chat.png',
      jsonb_build_object('tool', 'createChangeEvent', 'surface', '/ai-assistant', 'prompt', 'Create a change request for the selected project.', 'stages', jsonb_build_array('collect scope, reason, cost, schedule, and owner-change details', 'show the change-event draft and missing-field checklist', 'show the review preview and require explicit confirmation', 'create the event and write an audit receipt'), 'approvalRequired', true, 'auditTable', 'ai_tool_write_audits')
    ),
    (
      'AI: Draft Prime Contract Change Order', 'ai-create-prime-contract-change-order',
      'Drafts a Prime Contract Change Order from the selected project and contract context.',
      'implemented', 'AI content creation', 'high', 'medium', true,
      'Implemented by createChangeOrder with preview/confirmation, project authorization, idempotency, and write audit.',
      'docs/ops/evidence/2026-07-22-chat-history-duplicate-conversations/production-after-new-chat.png',
      jsonb_build_object('tool', 'createChangeOrder', 'surface', '/ai-assistant', 'prompt', 'Draft a Prime Contract Change Order.', 'stages', jsonb_build_array('resolve project and contract', 'show change-order preview', 'require explicit user confirmation', 'create the change order and write an audit receipt'), 'approvalRequired', true, 'auditTable', 'ai_tool_write_audits')
    ),
    (
      'AI: Draft Commitment', 'ai-create-commitment',
      'Drafts a subcontract or purchase order, including vendor, dates, and line items.',
      'implemented', 'AI content creation', 'high', 'hard', true,
      'Implemented by createCommitment. Active project budget codes are resolved before a confirmed write; invalid or ambiguous codes fail before a commitment shell is inserted.',
      'docs/ops/evidence/2026-07-22-chat-history-duplicate-conversations/production-after-new-chat.png',
      jsonb_build_object('tool', 'createCommitment', 'surface', '/ai-assistant', 'prompt', 'Draft a commitment for the selected project.', 'stages', jsonb_build_array('collect vendor, commitment type, dates, and line items', 'resolve active project budget codes', 'show preview and require explicit confirmation', 'create the commitment and write an audit receipt'), 'approvalRequired', true, 'auditTable', 'ai_tool_write_audits')
    ),
    (
      'AI: Draft Submittal', 'ai-create-submittal',
      'Drafts a project submittal for review before creation.',
      'implemented', 'AI content creation', 'medium', 'medium', true,
      'Implemented by createSubmittal with preview/confirmation, project authorization, idempotency, and write audit.',
      'docs/ops/evidence/2026-07-22-chat-history-duplicate-conversations/production-after-new-chat.png',
      jsonb_build_object('tool', 'createSubmittal', 'surface', '/ai-assistant', 'prompt', 'Draft a submittal for the selected project.', 'stages', jsonb_build_array('collect required submittal details', 'show submittal preview', 'require explicit user confirmation', 'create the submittal and write an audit receipt'), 'approvalRequired', true, 'auditTable', 'ai_tool_write_audits')
    ),
    (
      'AI: Create Meeting Note', 'ai-create-meeting-note',
      'Creates a project-scoped meeting note from conversation context.',
      'implemented', 'AI content creation', 'medium', 'easy', true,
      'Implemented by createMeetingNote with project authorization and audit protection.',
      'docs/ops/evidence/2026-07-22-chat-history-duplicate-conversations/production-after-new-chat.png',
      jsonb_build_object('tool', 'createMeetingNote', 'surface', '/ai-assistant', 'prompt', 'Create a meeting note from this discussion.', 'stages', jsonb_build_array('collect title and meeting content', 'show note preview', 'require explicit user confirmation', 'create the note and write an audit receipt'), 'approvalRequired', true, 'auditTable', 'ai_tool_write_audits')
    ),
    (
      'AI: Log Daily Report', 'ai-log-daily-report',
      'Creates a project Daily Log entry from reviewed assistant input.',
      'implemented', 'AI content creation', 'medium', 'medium', true,
      'Implemented by logDailyReport with preview/confirmation, project authorization, and write audit.',
      'docs/ops/evidence/2026-07-22-chat-history-duplicate-conversations/production-after-new-chat.png',
      jsonb_build_object('tool', 'logDailyReport', 'surface', '/ai-assistant', 'prompt', 'Log today''s daily report for the selected project.', 'stages', jsonb_build_array('collect date, work, conditions, and notes', 'show daily-log preview', 'require explicit user confirmation', 'create the log and write an audit receipt'), 'approvalRequired', true, 'auditTable', 'ai_tool_write_audits')
    ),
    (
      'AI: Create Task', 'ai-create-task',
      'Creates a project task or follow-up after the user reviews the proposed owner and due date.',
      'implemented', 'AI content creation', 'medium', 'easy', true,
      'Implemented by createTask and createGeneratedTask with project authorization, idempotency, and audit behavior.',
      'docs/ops/evidence/2026-07-22-chat-history-duplicate-conversations/production-after-new-chat.png',
      jsonb_build_object('tool', 'createTask', 'surface', '/ai-assistant', 'prompt', 'Create a task from this follow-up.', 'stages', jsonb_build_array('collect task title, owner, and due date', 'show task preview', 'require explicit user confirmation', 'create the task and write an audit receipt'), 'approvalRequired', true, 'auditTable', 'ai_tool_write_audits')
    ),
    (
      'AI: Create Project Company', 'ai-create-project-company',
      'Adds a company to the project directory from reviewed assistant input.',
      'implemented', 'AI content creation', 'medium', 'easy', true,
      'Implemented by createProjectCompany with project authorization and audit protection.',
      'docs/ops/evidence/2026-07-22-chat-history-duplicate-conversations/production-after-new-chat.png',
      jsonb_build_object('tool', 'createProjectCompany', 'surface', '/ai-assistant', 'prompt', 'Add this company to the project directory.', 'stages', jsonb_build_array('collect company identity and project scope', 'show company preview', 'require explicit user confirmation', 'create the company link and write an audit receipt'), 'approvalRequired', true, 'auditTable', 'ai_tool_write_audits')
    ),
    (
      'AI: Create Project Contact', 'ai-create-project-contact',
      'Adds a project contact from reviewed assistant input.',
      'implemented', 'AI content creation', 'medium', 'easy', true,
      'Implemented by createProjectContact with project authorization and audit protection.',
      'docs/ops/evidence/2026-07-22-chat-history-duplicate-conversations/production-after-new-chat.png',
      jsonb_build_object('tool', 'createProjectContact', 'surface', '/ai-assistant', 'prompt', 'Add this contact to the project.', 'stages', jsonb_build_array('collect name, company, and contact details', 'show contact preview', 'require explicit user confirmation', 'create the contact and write an audit receipt'), 'approvalRequired', true, 'auditTable', 'ai_tool_write_audits')
    ),
    (
      'AI: Create Budget Line', 'ai-create-budget-line',
      'AI-assisted creation of project budget line items.',
      'not_implemented', 'AI content creation', 'high', 'medium', true,
      'The standard budget form exists, but no registered assistant write tool creates budget line items. Do not advertise this action in chat until a preview-first tool and audit contract are added.',
      null,
      jsonb_build_object('tool', null, 'surface', '/ai-assistant', 'prompt', 'Create budget line items.', 'stages', jsonb_build_array('not available'), 'approvalRequired', true, 'unavailableReason', 'No registered AI write tool for budget line creation.')
    ),
    (
      'AI: Create Direct Cost', 'ai-create-direct-cost',
      'AI-assisted creation of project direct costs.',
      'not_implemented', 'AI content creation', 'high', 'medium', true,
      'The standard Direct Costs form exists, but no registered assistant write tool creates direct costs.',
      null,
      jsonb_build_object('tool', null, 'surface', '/ai-assistant', 'prompt', 'Create a direct cost.', 'stages', jsonb_build_array('not available'), 'approvalRequired', true, 'unavailableReason', 'No registered AI write tool for direct cost creation.')
    ),
    (
      'AI: Create Invoice', 'ai-create-invoice',
      'AI-assisted creation of owner or subcontractor invoices.',
      'not_implemented', 'AI content creation', 'high', 'hard', true,
      'Standard invoice forms exist, but no registered assistant write tool creates invoices.',
      null,
      jsonb_build_object('tool', null, 'surface', '/ai-assistant', 'prompt', 'Create an invoice.', 'stages', jsonb_build_array('not available'), 'approvalRequired', true, 'unavailableReason', 'No registered AI write tool for invoice creation.')
    ),
    (
      'AI: Create Meeting', 'ai-create-meeting',
      'AI-assisted creation of a project meeting record.',
      'not_implemented', 'AI content creation', 'medium', 'medium', true,
      'The assistant can create a meeting note and an Outlook calendar invite, but it cannot create the native project meeting record.',
      null,
      jsonb_build_object('tool', null, 'surface', '/ai-assistant', 'prompt', 'Create a project meeting.', 'stages', jsonb_build_array('not available'), 'approvalRequired', true, 'unavailableReason', 'No registered AI write tool for native meeting creation.')
    ),
    (
      'AI: Create Punch Item', 'ai-create-punch-item',
      'AI-assisted creation of a project punch-list item.',
      'not_implemented', 'AI content creation', 'medium', 'medium', true,
      'The standard punch-item form exists, but no registered assistant write tool creates punch items.',
      null,
      jsonb_build_object('tool', null, 'surface', '/ai-assistant', 'prompt', 'Create a punch item.', 'stages', jsonb_build_array('not available'), 'approvalRequired', true, 'unavailableReason', 'No registered AI write tool for punch-item creation.')
    ),
    (
      'AI: Create Drawing Set', 'ai-create-drawing-set',
      'AI-assisted creation of a drawing set and upload workflow.',
      'not_implemented', 'AI content creation', 'medium', 'medium', true,
      'The standard drawing upload flow exists, but no registered assistant write tool creates drawing sets or uploads drawings.',
      null,
      jsonb_build_object('tool', null, 'surface', '/ai-assistant', 'prompt', 'Create a drawing set.', 'stages', jsonb_build_array('not available'), 'approvalRequired', true, 'unavailableReason', 'No registered AI write tool for drawing-set creation.')
    ),
    (
      'AI: Create Estimate', 'ai-create-estimate',
      'AI-assisted creation of a project estimate.',
      'not_implemented', 'AI content creation', 'medium', 'hard', true,
      'The standard estimate form exists, but no registered assistant write tool creates estimates.',
      null,
      jsonb_build_object('tool', null, 'surface', '/ai-assistant', 'prompt', 'Create an estimate.', 'stages', jsonb_build_array('not available'), 'approvalRequired', true, 'unavailableReason', 'No registered AI write tool for estimate creation.')
    )
), updated as (
  update public.procore_features feature
  set
    name = catalog.name,
    description = catalog.description,
    status = catalog.status,
    category = catalog.category,
    priority = catalog.priority,
    complexity = catalog.complexity,
    ai_enhancement_possible = catalog.ai_enhancement_possible,
    ai_enhancement_notes = catalog.ai_enhancement_notes,
    ai_chat_screenshot_url = catalog.ai_chat_screenshot_url,
    ai_chat_workflow = catalog.ai_chat_workflow,
    updated_at = now()
  from catalog
  where feature.slug = catalog.slug
  returning feature.slug
)
insert into public.procore_features (
  name, slug, description, status, category, priority, complexity,
  ai_enhancement_possible, ai_enhancement_notes, ai_chat_screenshot_url,
  ai_chat_workflow
)
select
  catalog.name, catalog.slug, catalog.description, catalog.status, catalog.category,
  catalog.priority, catalog.complexity, catalog.ai_enhancement_possible,
  catalog.ai_enhancement_notes, catalog.ai_chat_screenshot_url, catalog.ai_chat_workflow
from catalog
where not exists (
  select 1 from public.procore_features feature where feature.slug = catalog.slug
);

commit;
