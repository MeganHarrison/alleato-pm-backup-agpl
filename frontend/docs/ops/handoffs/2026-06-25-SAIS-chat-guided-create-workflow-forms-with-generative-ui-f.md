# Claude Code Handoff: Chat-guided create workflow forms with generative UI field completion

## Intake
Requester: Brandon
Source: ais_chat
AIS request id: ae2f04b2-f173-4ef1-ab88-720cf6610a0c
Linear issue: Draft required

## Stakeholder Goal
I'm not going to confirm it because We definitely need to improve this process So essentially Anything that you would create in an application just comes down to filling out a form and so as long as we have the documentation Available to you about where you can find the form where the form fields and you know what the purpose of it is and The fields that need to be included I don't think it'll be any problem and you can just guide the user By asking any additional questions That are needed in order to Successfully finish creating whatever it is if it's a change of event commitment etc. I was thinking It would definitely be best to have a visual that can go along with each of them too and probably an actual like generative UI react component that's a form kind of like a model and so You can automatically go ahead and fill in the fields that they've already provided to you and then just do a quick summary like awesome There's a few more things we need in order to create the change event You can either fill it out here or we can talk through it And then kinda like maybe just do a Quick summary of what else is needed but not in a way that's gonna overwhelm them I'm gonna link to the change event form so you can review that... http://localhost:3001/67/change-events/new

## Current Understanding
Add a chat-guided creation pattern for app records where the assistant opens a generative UI form/modal for the target workflow, pre-fills any fields already provided in chat, identifies missing required fields from form/documentation metadata, and lets the user either complete the form directly or answer follow-up questions conversationally before submission.

## Acceptance Criteria
- [ ] Supported create workflows can be initiated from chat and open a visual workflow component rather than only a text preview.
- [ ] Known values from the user request are prefilled automatically.
- [ ] Only missing required fields are surfaced in the summary shown to the user.
- [ ] Users can complete missing values either directly in the form or by answering follow-up questions in chat, and both paths stay synchronized.
- [ ] Final submission requires explicit user action and uses the existing durable write guardrails.
- [ ] Unsupported workflows clearly route to the correct page with a concise explanation.
- [ ] Initial pilot works end-to-end for change event creation on a project page.

## Implementation Plan
1. Define a versioned workflow registry file seeded from the draft CSV and convert repeated pipe-delimited field lists into structured arrays or JSON where needed for runtime use.
2. Build a registry access layer in the assistant UI/backend that resolves a requested workflow from user intent and selected project context.
3. Create a generative UI create-workflow component (modal or inline card) that renders workflow metadata, pre-fills known values from chat, and highlights only missing required fields.
4. Implement chat-to-form synchronization so user answers in chat update the active workflow form state, and form edits remain the source of truth for final submission.
5. Add concise missing-fields summarization logic that groups only the next few required inputs instead of dumping the full schema.
6. Wire submission through existing create tools with confirmed=false during drafting and explicit confirmed=true only from user action in the UI.
7. Define fallback behavior for unsupported workflows or unresolved dependencies such as missing contractId on prime contract change orders.
8. Pilot on change events first, then expand to commitments, submittals, RFIs, tasks, and directory workflows after validation.
9. Add instrumentation/logging for workflow starts, completions, abandonment, validation failures, and unsupported-intent fallbacks so launch quality can be measured.

## Likely Files
- frontend route: /ai-assistant
- frontend route: /:projectId/change-events/new
- frontend route: /:projectId/commitments/new
- frontend route: /:projectId/submittals/new
- frontend route: /:projectId/rfis/new
- frontend route: /:projectId/tasks
- frontend route: /:projectId/directory
- frontend route: /:projectId/change-orders/new
- AI assistant chat panel
- Generative create workflow card/modal
- Workflow registry loader
- Form prefill mapper
- Missing-required-fields summary component
- Chat-to-form synchronization layer
- Confirmation/submit adapter for existing create tools
- database table: feature_request_packets
- database table: feature_request_implementation_plans

## Data Requirements
- Machine-readable workflow registry covering workflow key, route, backing tool, required/optional fields, labels, field types, defaults, validation notes, lookup dependencies, confirmation behavior, fallback route, and launch-scope flag.
- Support initial workflows: change event, commitment, submittal, RFI, task, project contact, project company, project status update, prime contract change order, meeting note, daily report, risk flag.
- Ability to resolve route context such as projectId from chat context or selected project.
- Mapping layer from normalized registry fields to existing tool payloads.
- Storage location for seed CSV / registry file that engineering can version and extend.

## Verification Plan
- From a project context, request a change event with only project and title; verify the workflow component opens with project/title prefilled and asks only for remaining required fields.
- Answer a missing field in chat; verify the corresponding form field updates immediately.
- Edit another missing field in the form UI; verify the assistant no longer asks for it.
- Submit the form; verify the existing create tool is called only after explicit user action.
- Attempt an unsupported workflow such as prime contract creation; verify the assistant explains the limitation and routes to the native page.
- Repeat the flow for at least one commitment and one submittal after the pilot pattern is implemented.

## Open Questions / Assumptions
- Should the workflow component render inline in chat, in a side panel, or as a modal?
- What is the source of truth for workflow metadata: generated from form schemas, maintained in code, or authored from help docs plus code review?
- How should complex nested workflows like commitment line items be handled in the first release?
- Do we want a universal registry-driven renderer for all fields or workflow-specific overrides for better UX?
- Which workflows are officially in Friday launch scope versus post-launch expansion?
- Assumption: Each native create workflow is fundamentally a form with identifiable required and optional fields.
- Assumption: The application can expose enough metadata about routes/forms for the assistant to reason about required fields and labels.
- Assumption: Preview-first writes remain desirable, but the preview should be embodied as a form experience rather than plain text confirmation.

## Readiness Gate
This is not ready for build yet.

Missing:
- Claude Code handoff

Recommended next action:
Where should the assistant get authoritative workflow metadata: route inventory, hand-authored help docs, form schema, or a generated registry from the React forms?

## Guardrails
- No silent failures.
- No generic errors.
- Use shared primitives.
- Run route checks if routes change.
- Verify migration ledger if schema changes.
- Attach browser evidence for frontend flows.
