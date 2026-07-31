# AI Assistant App Expert Structure

**Date:** 2026-05-21
**Status:** Initial implementation added
**Scope:** Alleato AI assistant subagents, skills, and tools needed for accurate questions about the web application itself.

## Purpose

The AI assistant needs a dedicated way to answer questions about the Alleato PM web application: where features live, how workflows behave, which permissions apply, what data backs a page, what actions the assistant can perform, and what is currently implemented versus planned.

The recommended structure is not to keep adding more general tools to the main strategist. The main strategist should route. A dedicated App Expert subagent should answer application-knowledge questions using validated documentation, generated inventories, and read-only lookup tools.

## Recommended Routing Model

| Layer | Responsibility | Status | Why it belongs here |
|---|---|---|---|
| Main strategist / orchestrator | Classify the user request, preserve conversation context, enforce user/project scope, and delegate to the correct specialist. | Implemented, needs App Expert route | Keeps the main assistant from becoming an unstructured tool pile. |
| App Expert subagent | Answer questions about the web app itself: features, routes, workflows, permissions, UI behavior, data backing, known limitations, and troubleshooting. | Implemented as backend endpoint and wired into `app_help` chat retrieval | App knowledge has different evidence rules than project/business synthesis. |
| Module skills | Load detailed module-specific playbooks only when relevant. | Initial navigation, feature-status, and permissions skills implemented | Prevents the App Expert prompt from becoming too large while preserving depth. |
| Read-only app knowledge tools | Retrieve current sitemap, feature registry, help articles, route inventory, source map, API contracts, schema, and code pointers. | Initial generated sitemap and feature-registry tools implemented | Accuracy depends on generated and validated source-of-truth artifacts, not memory alone. |
| Evals and freshness checks | Verify that app-help answers remain correct as routes, tools, and docs change. | Implemented initial 50-case strict eval suite; needs CI/prod gate | Prevents the assistant from confidently explaining stale UI behavior. |

## Subagent Table

| Subagent | Status | What it does | How the orchestrator knows to use it | Description the agent receives |
|---|---|---|---|---|
| `strategist` | Implemented | Primary assistant persona. Synthesizes answers, routes to specialists, and handles natural conversation. | Default entry point for `/ai-assistant`; handles broad questions unless a narrower route is detected. | "You are Alleato's chief strategist. Answer with a point of view, evidence, and a recommended next action. Delegate to specialists when a narrower expert can answer more accurately." |
| `financial-analyst` | Implemented in backend Deep Agents; related CFO specialist exists in frontend | Investigates budgets, commitments, change orders, pay applications, margin, cash, and Acumatica financial data. | Financial intent: budget, cost, margin, cash, AP/AR, commitments, invoices, pay apps, change-order exposure. | "Delegate financial questions: budget vs. actuals, commitments, change orders, pay applications, cash position, Acumatica data. Give one focused question at a time." |
| `schedule-analyst` | Implemented in backend Deep Agents | Investigates milestones, schedule health, delays, float, baseline variance, and recent schedule-related communications. | Schedule intent: delay, milestone, critical path, slippage, schedule risk, dates, lookahead. | "Delegate schedule questions: status vs. baseline, float, critical path, milestones, delays. Give one focused question at a time." |
| `risk-analyst` | Implemented in backend Deep Agents; related CRO specialist exists in frontend | Surfaces project, financial, contractual, communication, and operational risk. | Risk intent: red flags, exposure, overdue items, unanswered RFIs/submittals, claim signals, recurring issues. | "Delegate risk-surfacing: aged RFIs, late submittals, unanswered communications, approaching deadlines, contractual exposure. Give one focused question at a time." |
| `communications-analyst` | Implemented in backend Deep Agents | Reviews meeting transcripts, Teams messages, emails, stakeholder tone, sentiment, and communication history. | Communication-source intent: "who said", "what did we decide", emails, Teams, meetings, client tone, unanswered messages. | "Delegate stakeholder-communication investigation: meeting discussions, Teams threads, email tone, sentiment. Give one focused question at a time." |
| `business-development-analyst` | Implemented in backend Deep Agents | Investigates pipeline, pursuits, estimating handoffs, client relationship risk, proposals, and stuck deals. | Business-development intent: pursuit, client follow-up, estimate, proposal, quote, lead, deal, relationship risk. | "Delegate pipeline and client-development questions: pursuits, estimating handoffs, proposal or quote follow-up, client relationship risk, and stuck deals. Give one focused question at a time." |
| `microsoft-executive-assistant` | Implemented as dedicated backend service, production-gated | Handles Microsoft-native inbox, calendar, Teams, and drafting workflows where live Microsoft data matters more than RAG. | Microsoft operator intent: today's emails, inbox triage, calendar, draft reply, Teams send, live mailbox state. | "Use live Microsoft sources for inbox, calendar, Teams, and drafting tasks. Prefer direct source reads over stale synced approximations. Require approval for sends or sensitive write actions." |
| `research-agent` | Implemented as backend Deep Agent | Combines public web research with internal Alleato project/RAG context. | External research intent: public web, market, company research, trend, third-party source verification. | "Research public web and Alleato internal context separately, cite sources, and distinguish public evidence from internal project evidence." |
| `content-builder` | Implemented as backend Deep Agent | Produces marketing/content artifacts with optional research and images. | Content creation intent: blog, LinkedIn, X thread, campaign asset, marketing content package. | "Create requested content artifacts in the workspace, use research when needed, and return artifact paths and concise production notes." |
| `app-expert` | Implemented as `/api/intelligence/app-expert` and wired into `app_help` retrieval | Answers questions about the Alleato web app itself: routes, features, permissions, workflows, UI behavior, data model, assistant actions, known gaps, and troubleshooting. | App-help or app-knowledge intent: "where do I", "how does this page work", "what does this button do", "what table powers this", "is this implemented", "what can the assistant do", "why can't I see". | "You are the Alleato PM application expert. Answer from curated app docs first, generated sitemap and feature registry second, source/schema/code lookup third. Include exact routes or source references. If evidence conflicts or is missing, say what was checked and what remains uncertain." |
| `app-diagnostics` | Recommended later | Investigates "this page looks broken" or "why is this feature not working" with route, console, API, permission, and source-health evidence. | Runtime troubleshooting intent: broken page, missing data, 404/500, empty dropdown, hidden button, permission surprise. | "Diagnose application behavior from route metadata, user role, source health, API contracts, logs, and browser evidence. Report cause, detection gap, and prevention step." |
| `implementation-planner` | Recommended later | Converts accepted feature requests or app gaps into implementation plans, Linear issues, and Codex handoffs. | Build-planning intent: "what needs to be built", "create a plan", "turn this into issues", "handoff to Codex". | "Translate product intent into scoped engineering work with owner files, validation steps, risk, and acceptance criteria. Do not perform writes without an explicit approval path." |

## Skill Table

Skills are the right place for deeper module playbooks because they use progressive disclosure. The App Expert can load only the skill that matches the user question instead of carrying every module's instructions in the main prompt.

| Skill | Status | What it contains | When App Expert loads it | Description the agent receives |
|---|---|---|---|---|
| `app-navigation-and-sitemap` | Implemented in App Expert runtime | Route groups, project-scoped vs global pages, sidebar/nav entry points, page ownership, route aliases, hidden/admin routes. | User asks where something lives, how to navigate, why a page exists, or what route maps to a feature. | "Use this skill for questions about navigating Alleato PM, page locations, route structure, and sitemap interpretation." |
| `feature-status-and-limitations` | Implemented in App Expert runtime | Feature status, implemented versus planned behavior, known limitations, related actions, and assistant capability boundaries. | User asks whether a feature exists, what it does, or what is planned versus live. | "Use this skill to explain implemented and planned application features with route, tool, data, and status evidence." |
| `permissions-and-visibility` | Implemented in App Expert runtime | Role/access matrix, admin-only surfaces, project membership rules, client/subcontractor visibility, email privacy boundaries. | User asks why they can or cannot see a page, record, button, company, project, or employee data. | "Use this skill for access-control, visibility, role, privacy, and permission questions." |
| `workflow-create-project` | Needs to be built | Create-project flow, required fields, bootstrap behavior, post-create modal, generated defaults, validation rules. | User asks about creating projects or project setup. | "Use this skill for project creation, setup, bootstrap records, and first-step workflows." |
| `workflow-budget` | Needs to be built | Budget overview, line items, cost codes, import behavior, markup, forecast, direct-cost relationship, table parity expectations. | User asks about budgets, cost lines, cost codes, forecast, markup, or budget import. | "Use this skill for budget and cost-code behavior, user workflows, and data-backed explanations." |
| `workflow-prime-contracts` | Needs to be built | Prime contract creation, SOV, owner change orders, retainage, invoice linkage, PDF/doc behavior. | User asks about prime contracts, owner contracts, SOVs, or owner billing. | "Use this skill for owner contract workflows, SOV behavior, change-order linkage, and billing relationships." |
| `workflow-commitments` | Needs to be built | Commitment/subcontract/PO creation, subcontractor SOV, commitment change orders, vendor links, document center. | User asks about commitments, subcontractors, POs, vendor contracts, or subcontractor billing. | "Use this skill for commitment and vendor-contract workflows, including SOVs, changes, and document behavior." |
| `workflow-change-management` | Needs to be built | Change Event to PCO/CO/commitment adjustment lifecycle, status logic, source lineage, Procore parity gaps. | User asks about change events, PCOs, owner COs, commitment COs, or exposure tracking. | "Use this skill for change-management lifecycle questions and source-lineage explanations." |
| `workflow-rfis` | Needs to be built | RFI list/detail/create/edit/status, ball-in-court, attachments, action tools, source tables. | User asks about RFIs or assistant-created RFIs. | "Use this skill for RFI workflow, permissions, statuses, and assistant action behavior." |
| `workflow-submittals` | Needs to be built | Submittal log, packages, spec sections, status flow, attachments, Procore parity, tests. | User asks about submittals, packages, spec-driven requirements, or review statuses. | "Use this skill for submittal workflows, package/spec relationships, and status behavior." |
| `workflow-documents-and-rag` | Needs to be built | Documents UI, storage bucket, document metadata, RAG split DB, document search, source attribution, app docs versus company knowledge. | User asks where files live, how document search works, or why app docs are different from company knowledge/RAG. | "Use this skill for document storage, document metadata, RAG retrieval, and source-attribution questions." |
| `workflow-directory-and-companies` | Needs to be built | Company directory, project directory, contacts, vendors, memberships, duplicate prevention, role assignment. | User asks about companies, contacts, vendors, project teams, or directory cleanup. | "Use this skill for company, contact, vendor, and project-directory workflows." |
| `workflow-invoicing-and-pay-apps` | Needs to be built | Owner invoices, subcontractor pay apps, G702/G703, retainage, billing periods, PDF/email behavior. | User asks about invoices, pay apps, billing, retainage, or PDF outputs. | "Use this skill for invoicing, payment applications, retainage, billing periods, and generated billing documents." |
| `workflow-schedule` | Needs to be built | Schedule task lists, activity data, dependencies, lookahead, source systems, schedule analysis. | User asks about schedule pages, tasks, milestones, or slipping dates. | "Use this skill for schedule workflows, source data, and schedule-risk interpretation." |
| `workflow-ai-assistant` | Needs to be built | Assistant capabilities, model selector, memory, widgets, write previews, tool limitations, current disabled/tool-calling constraints. | User asks what the assistant can do, how it decides sources, or whether actions are live. | "Use this skill for AI assistant capability, routing, source, memory, widget, and action-tool questions." |
| `workflow-admin-and-user-management` | Needs to be built | User creation, invites, profile permissions, admin pages, employee visibility, user deactivation, auth source of truth. | User asks about users, roles, invitations, admin settings, or profile access. | "Use this skill for admin, user, invite, and employee-permission workflows." |
| `workflow-feedback-and-agentation` | Needs to be built | Feedback inbox, issue/feature tabs, dispatch controls, annotation inbox, Agentation overlay behavior. | User asks about feedback, annotation, issue dispatch, or why feedback moved status. | "Use this skill for feedback, annotation, issue triage, and Codex/Claude dispatch behavior." |
| `technical-source-map` | Needs to be built | Feature-to-files map, API route map, component entry points, service/hook ownership, tests, generated graphs. | User asks what code powers a feature or how implementation is structured. | "Use this skill for codebase-backed application explanations. Prefer generated source maps and exact file references before broad code search." |
| `known-limitations-and-roadmap` | Needs to be built | Implemented vs planned matrix, gaps, feature flags, intentionally deferred work, broken/stale routes, disabled actions. | User asks "can it do X", "is this done", "what remains", or "why is this not live". | "Use this skill to answer status questions truthfully, distinguishing live, partially implemented, planned, blocked, and deprecated behavior." |
| `help-authoring-and-validation` | Not currently backed by a tracked help corpus | Help article schema, `ai_visible`, `client_visible`, related actions, validation command, action registry rules. | Maintainers add or update app-help articles. | "Use this skill for writing safe app-help articles that can be retrieved by the AI assistant and validated against registered actions." |

## Tool Table

Tools should be read-only by default for App Expert. Write-capable actions should stay in existing preview/approval flows and should not be mixed into app-help lookup unless the user explicitly asks to perform an action.

| Tool or tool group | Status | What it does | How the agent knows to use it | Description the agent receives |
|---|---|---|---|---|
| `searchAppHelp` | Implemented | Searches curated help articles intended for Help Center and AI app-help retrieval. | First retrieval step for "how do I use the app" questions. | "Search curated app-help articles. Use this before code search for user-facing feature and workflow explanations." |
| `describeAssistantCapabilities` | Implemented | Explains assistant capability groups and retrieval order. | User asks what the assistant can do or how it decides sources. | "Describe available AI assistant capabilities and retrieval behavior using current capability metadata." |
| `explainAssistantRetrievalOrder` | Implemented | Explains the canonical retrieval pipeline. | User asks why the assistant used a source or what order it checks. | "Explain the assistant's source order and routing policy in plain English." |
| `explainLastAnswerSources` | Implemented | Reads prior answer metadata from `chat_history` and explains sources/tools used. | User asks "where did that answer come from" or challenges an assistant response. | "Explain the previous answer's source trace using persisted metadata. Do not invent missing traces." |
| `getAppSitemap` | Implemented | Returns generated route inventory with page title, route group, nav location, auth scope, feature owner, and related docs. | User asks where a page lives, what route owns a feature, or what pages exist. | "Return current generated sitemap entries. Include route, page label, scope, and related docs/actions." |
| `lookupRoute` | Implemented as `lookup_app_route` | Looks up one route and returns page file, layout group, params, components, API calls, auth requirements, and related feature. | User gives a route or asks about a specific page. | "Inspect a single route from generated route metadata and return exact ownership, scope, and linked implementation references." |
| `searchFeatureRegistry` | Implemented | Searches feature registry by module, alias, user wording, route, source table, or action. | User asks whether a feature exists, what it does, or what supports it. | "Search the generated feature registry for live/planned/deprecated features and return status plus evidence." |
| `getFeatureDetails` | Implemented | Returns one feature packet: routes, workflows, data sources, permissions, tools, tests, known limitations. | User asks a detailed question about a specific feature. | "Return the canonical feature detail packet with routes, data, actions, permissions, tests, and limitations." |
| `getHelpArticle` | Implemented as `get_help_article` | Reads one curated help article by slug or a current configured article path. | Feature registry returns a `helpArticle` path or the user asks for exact documented workflow behavior. | "Read the linked app-help article before claiming workflow behavior is uncertain. Return article path and bounded content only." |
| `lookupRelatedActions` | Partially implemented through help-action registry | Maps current help metadata to assistant actions and execution status. | User asks whether the assistant can perform a workflow. | "Return related action IDs, execution status, safety level, related routes, tool name, and unavailable reason." |
| `lookupPermissionRule` | Needs to be built | Answers role and visibility questions from a generated permissions matrix. | User asks why data/page/button is visible or hidden. | "Return permission and visibility rules for a module, route, action, or record type. Include role and project-scope assumptions." |
| `lookupDataModel` | Needs to be built | Maps features/routes to Supabase tables, views, RPCs, key columns, source-of-truth notes, and RAG/app DB split. | User asks what data powers a page or why a value appears. | "Return data-model references for a feature or route. Distinguish PM APP tables from AI/RAG database tables." |
| `lookupApiContract` | Needs to be built | Maps pages/actions to API routes, request/response shapes, auth, guardrails, and error codes. | User asks what endpoint backs a workflow or why a request failed. | "Return API route contracts and guardrail expectations for app workflows." |
| `lookupComponentMap` | Needs to be built | Maps feature pages to React component entry points and shared primitives. | User asks how a UI surface is built or what component owns a pattern. | "Return component ownership and shared primitive references from generated source maps." |
| `lookupTestsForFeature` | Needs to be built | Returns unit, Playwright, agent-browser, and eval coverage for a route/feature. | User asks how a feature is verified or why a regression was not caught. | "Return known test and eval coverage for a feature, including missing coverage." |
| `searchCodeSymbols` | Needs to be built for production-safe App Expert; shell `rg` exists for Codex only | Read-only symbol/code search across selected allowlisted paths. | Last resort when docs/registry/source maps are insufficient or conflict. | "Search code symbols only after app docs and generated maps are checked. Return file references and say if results are implementation evidence rather than user-facing documentation." |
| `getKnownLimitations` | Needs to be built | Returns open gaps, disabled feature flags, partial implementations, and deprecated paths. | User asks if something is complete, blocked, planned, or stale. | "Return current limitations and status notes with source references. Separate live, partial, planned, blocked, and deprecated behavior." |
| `getSourceHealthForAppQuestion` | Partially implemented through source-health helpers | Returns freshness and sync health for data sources relevant to an answer. | User asks why data is stale, missing, or conflicting. | "Return source freshness and sync health for relevant app/RAG/Microsoft/Acumatica sources." |
| `getCurrentPageContext` | Needs to be built | Reads current route, selected project, visible page state, user role, and optionally page metadata from the UI. | User asks from inside a page: "what is this", "why can't I", "what should I do here". | "Use current UI context to ground app-help answers in the page the user is looking at." |
| `capturePageSnapshot` | Recommended later | Captures DOM/browser evidence for troubleshooting app behavior. | User reports visible UI breakage or asks why something is not showing. | "Capture browser/page evidence for diagnostics. Use only for troubleshooting, not normal app-help answers." |
| `validateHelpDocs` | Needs to be built as agent-callable wrapper around existing validation | Runs help article/schema validation and related-action checks. | Maintainer asks to publish/update docs or after docs change. | "Validate app-help docs and fail loudly on missing metadata, unsupported values, or unregistered related actions." |
| `validateSitemapFreshness` | Needs to be built | Checks generated sitemap/feature registry against current route files and nav config. | After route/nav changes or before publishing App Expert docs. | "Validate generated app knowledge against current source files and report stale or missing entries." |
| Existing project tools | Implemented | Project, finance, operational, schedule, document, Acumatica, Outlook, marketing, workspace, and action tools. | Used by strategist/business specialists for project/business answers, not as the first source for app-help explanations. | "Use domain tools when the question asks about live project/business data or action execution, not for general explanations of how the app works." |
| Existing action tools | Implemented with preview/approval semantics | Create/update records such as RFIs, change events, tasks, commitments, Outlook drafts, Teams messages, and feedback items. | User asks the assistant to do something, not just explain the app. | "Prepare preview-first write actions. Require confirmation for sensitive writes and preserve audit/idempotency behavior." |
| Existing backend Deep Agents tools | Implemented | SQL read tools, PM snapshots, RAG search, recent activity, Acumatica reads, draft previews, resolvers. | Backend Deep Agents project/executive workflows and analyst subagents. | "Use scoped read and preview tools to investigate project/executive questions. Do not write directly to production data." |

## Required Generated Artifacts

| Artifact | Status | Source inputs | Used by |
|---|---|---|---|
| `app-sitemap.generated.json` | Implemented | `frontend/src/app/**`, route groups, nav/sidebar config, page metadata, auth helpers | `getAppSitemap`, `lookupRoute` |
| `feature-registry.generated.json` | Implemented | Help docs, action registry, route inventory, module config, source maps | `searchFeatureRegistry`, `getFeatureDetails` |
| `permissions-matrix.generated.json` | Needs to be built | permission helpers, route guards, RLS docs, admin role config | `lookupPermissionRule` |
| `source-map.generated.json` | Needs to be built | route files, component imports, API handlers, service/hook usage, tests | `lookupComponentMap`, `lookupApiContract`, `lookupTestsForFeature` |
| `known-limitations.generated.json` | Needs to be built | feature flags, TODO inventory, disabled routes/actions, roadmap docs, eval failures | `getKnownLimitations` |
| `app-expert-eval-suite.json` | Implemented with 50 cases | Golden questions and expected evidence requirements | App Expert quality gate |

## Evidence Priority For App Expert Answers

1. Curated app-help docs with `ai_visible: true`.
2. Generated sitemap and feature registry.
3. Generated permission, source-map, data-model, and API-contract artifacts.
4. Current source code lookup.
5. Runtime/browser evidence for troubleshooting questions.

If the evidence conflicts, the App Expert should say what conflicts and avoid presenting uncertain behavior as confirmed.

## Implementation Notes

- Keep App Expert read-only by default.
- Do not expose broad filesystem or SQL access directly to client-facing users.
- Generate structured artifacts from source and validate them in CI or the finish flow.
- Use skills for module depth, not always-loaded prompt bulk.
- Keep existing project/business specialists for business answers; App Expert owns application-behavior answers.
- Add evals before production routing so the assistant cannot pass with vague answers.

## Current Baseline

- Generated artifacts: 283 routes, 290 features, 58 help articles, 51 documented routes.
- Strict App Expert eval: 50/50 passed against production backend on 2026-05-21.
- Production eval artifact was local-only and has been retired; the recorded 50/50 result remains the historical evidence.
- Production latency baseline: p50 4.3s, p90 7.9s, max 12.0s.
- Production smoke gate: `npm run rag:verify:app-expert-smoke:prod` checks active backend health, OpenAPI exposure, Render flags, and one grounded App Expert answer.
- Full production quality gate: `npm run rag:verify:app-expert-evals:prod`.
- Production requirement: keep `DEEP_AGENTS_APP_EXPERT_ENABLED=true` and `DEEP_AGENTS_APP_EXPERT_MODEL=gpt-5.4-mini` configured on the active Render backend service before relying on production chat routing.

## Definition Of Done

The App Expert is ready when:

1. It can answer app-navigation, feature-status, permission, workflow, and data-source questions with route/source references.
2. It refuses to guess when docs and code disagree.
3. Its generated sitemap and feature registry are checked for freshness.
4. It passes a golden app-help eval suite.
5. User-facing answers distinguish implemented, partially implemented, planned, blocked, and deprecated behavior.
