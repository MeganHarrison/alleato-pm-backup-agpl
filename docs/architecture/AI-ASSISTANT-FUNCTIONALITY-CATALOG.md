# AI Assistant Functionality Catalog

**Purpose:** One readable source of truth for what Alleato AI can do, where each
function lives, what data it uses, and whether Eve can perform it today.

**Last audited:** 2026-07-30

**Canonical assistant:** Eve under `agents/alleato-assistant`

**Canonical interactive route:** `/ai`

## Read this status note first

The Eve-only assistant cutover and the durable RAG cutover are published.
`/ai` and Ask Alleato use the authenticated Eve proxy. Canonical Vercel
deployment `dpl_kF3Cp1hELMMzet6r8cuuzbR8LKyb` is `READY` on commit
`17c7b78eac63d81a004ce671da800d898d364f4a`, and live Render exposes the
authenticated single-stage adapters.

Production run `wrun_01KYR3MKXQEHC80QFCB56TSD5F` completed `load`, `parse`,
`vision`, `embed`, and `extract` in order. The controlled URL document produced
five embedded chunks, and project-scoped vector retrieval returned its own
chunk at similarity `1.0` with the source title and URL intact.

The common RAG workflow is production-proven, but source operations are
currently degraded. A live recompute on 2026-07-30 reports five active issues:
57 SharePoint project folders awaiting initial inventory; 2,036 sampled
documents without chunks; one Graph subscription outside the configured target
set; 282 searchable SharePoint documents missing project-Documents promotion;
and Acumatica historical AR payment applications blocked on a missing provider
GI/endpoint. The earlier 77 retired teams_chat alerts and false stale Graph
aggregate were repaired in canonical production.

This catalog describes the canonical Eve-only functionality and labels
capabilities that are not currently exposed through Eve.

Status terms:

| Status | Meaning |
| --- | --- |
| Available | Eve can currently use the capability through its authenticated production bridge. |
| UI available | The user-facing management surface exists, but it is not necessarily an Eve-callable tool. |
| Registered, blocked | A production tool implementation exists, but the read-only Eve bridge excludes it. |
| Separate runtime | Active product functionality owned outside the interactive Eve assistant. |
| Production unverified | Code exists, but deployed production behavior has not been proven. |

## What Eve is

Eve is one authenticated assistant identity. It is not a collection of
frontend CFO, COO, CRO, CHRO, CMO, Strategist, or VP-BD agents.

Eve loads one or more domain skills:

- financial analysis
- operations review
- risk review
- people capacity
- business development
- marketing strategy

Skills change the instructions and analysis lens used by the same Eve runtime.
They do not create separate conversations, models, permissions, or data access.

## End-to-end request path

```text
User opens /ai or Ask Alleato
  → browser sends authenticated request
  → Next.js Eve proxy
  → durable AssistantTurn
  → Eve generation runtime
  → Eve loads relevant skill(s)
  → Eve requests an authenticated tool catalog
  → application verifies user, surface, project, turn, and effect
  → approved read tool executes
  → result and source evidence return to Eve
  → Eve synthesizes and streams the answer
  → application persists the completed conversation
```

Eve does not own document ingestion, OCR, parsing, embeddings, extraction,
project attribution, or intelligence packet compilation.

## Capability totals

The canonical production registry contains 131 tool definitions:

| Capability class | Count | Eve exposure |
| --- | ---: | --- |
| Read | 79 | Available to the full AI Assistant when user/project scope permits |
| Write | 49 | Registered, blocked by the current read-only Eve bridge |
| External delivery | 3 | Registered, blocked by the current read-only Eve bridge |
| Ask Alleato read subset | 17 | Available on the smaller Ask Alleato surface |
| ASRS-only tools | 2 | Separate runtime; intentionally excluded from Eve |

The application bridge fails if a write, delivery, or approval-requiring tool
crosses the read-only Eve boundary.

## 1. Conversation and session functionality

### Start a conversation

**Status:** Available and production-verified on the deployed backup path.

The user opens `/ai`, submits a message, and receives a streamed Eve response.
The browser does not select between runtimes and cannot fall back to the deleted
frontend generator.

### Continue a conversation

**Status:** Available and production-verified on the deployed backup path.

Follow-up messages continue the same Eve session after the prior durable turn
reaches a terminal state.

### Conversation history

**Status:** UI available.

Users can list, create, rename, open, and delete their conversation sessions.
Messages are reloadable from application history rather than relying only on
the in-memory Eve session.

### Refresh and resume

**Status:** Available and production-verified on the deployed backup path.

Reloading a conversation restores persisted messages and reconnects using the
verified Eve session and durable-turn contract.

### Streaming

**Status:** Available.

Eve responses stream incrementally. Protocol events and application message
persistence are separate so a refresh does not make the browser the state
owner.

### Stop an active response

**Status:** Available for the connected stream. Durable cancellation after a
disconnect remains unsupported, as documented below.

The `/ai` and Ask Alleato surfaces expose an active Stop control for the current
stream.

### Cancel after disconnect

**Status:** Not supported by Eve 0.22.6.

Eve does not currently provide the required out-of-band durable cancellation
protocol. The system returns `EVE_DURABLE_CANCEL_UNAVAILABLE` instead of falsely
marking a turn canceled.

### Project context

**Status:** Available.

The browser may send one project ID. The server accepts it only when it is a
positive integer and Supabase RLS proves that the signed-in user can read the
project. Browser input cannot grant access.

### Structured errors

**Status:** Available.

Startup, authentication, project access, tool-catalog, tool-execution,
streaming, and persistence failures name the boundary that failed. Failures do
not route to another generator.

## 2. User-facing AI surfaces

| Surface | Route | Functionality | Status |
| --- | --- | --- | --- |
| Full assistant | `/ai` | Full Eve conversation, project context, skills, production read catalog | Deployed and production-verified on the backup path |
| Ask Alleato | Global panel/pill | Smaller read-only assistant for common project and source questions | Deployed through the same authenticated Eve transport |
| Conversation history | `/ai` sidebar | Open, resume, rename, and delete sessions | UI available |
| Approvals | `/ai/approvals` | Review assistant action approvals and receipts | UI available; Eve writes blocked |
| Feature requests | `/ai/feature-requests` | Browse feature requests and open request details | UI available |
| Marketing workspace | `/ai/marketing` | Review marketing assets and calendar records | UI available |
| AI profile | `/ai/profile` | View and manage assistant profile/preferences | UI available |
| Skills | `/ai/skills` | Browse skills and submit skill feedback | UI available |
| Teach Alleato | `/ai/teach` | Submit corrections, examples, and teaching material | UI available |
| Memory center | `/ai/features/memory-center` | Review memory functionality and controls | UI available |
| Feature catalog | `/ai/features` | Browse AI-related product capabilities | UI available |
| Diagnostics | `/ai-assistant-debug` | Administrative diagnostics; not a second assistant runtime | Separate admin surface |

## 3. Project and portfolio intelligence

### Find and resolve a project

**Available tools:** findProject, getProjectDetails

Resolves project names and identifiers, then reads the verified project record.
Project-specific reads require access to the resolved project.

### Project briefing

**Available tools:** getProjectBriefingSnapshot, getProjectBudgetSummary,
getActionItemsAndInsights

Returns structured project status, financial position, open actions, and
intelligence evidence. Project briefings should prefer current structured
project and packet data over raw vector snippets.

### Portfolio overview

**Available tools:** getPortfolioOverview, getCrossProjectComparison,
getHistoricalTrends

Compares projects across the portfolio and summarizes current conditions,
trends, and outliers.

### Projects at risk

**Available tools:** getProjectsWithRisks, getProjectRiskAnalysis

Identifies projects with risk indicators, then provides project-specific risk
evidence. This flow was validated with real project data in AAI-1265.

### Current daily executive brief

**Available tool:** readCurrentDailyExecutiveBrief

Reads the canonical current executive intelligence packet. It does not generate
or overwrite the packet.

### Domain intelligence

**Available tools:** listDomainIntelligence, getDomainIntelligence

Lists and reads compiled intelligence for a defined domain or target.

### Implementation status

**Available tool:** getImplementationStatus

Reads the status of previously dispatched implementation requests from their
audit and repository evidence. Eve cannot dispatch a new implementation request
through the current read-only bridge.

## 4. Financial functionality

Eve loads the financial-analysis skill for questions involving budgets,
contracts, commitments, cost, margin, billing, cash, AP/AR, vendor spend, and
forecasting.

### Project financials

**Available tools:**

- getCommitmentsOverview
- getChangeOrderDetails
- getDirectCostsSummary
- getBudgetLineItems
- getCostTrends
- getMarginAnalysis
- getFinancialAnalysis
- getProjectBudgetSummary
- getForecastComparison

These tools read structured financial rows. Numeric financial questions should
use structured data rather than semantically similar document text.

### Structured financial queries

**Available tools:**

- queryBudgetData
- queryChangeOrders
- queryCommitments
- queryDirectCosts
- searchStructuredFinancialRows

These provide narrower row-level evidence for calculations, reconciliation,
and follow-up questions.

### Acumatica accounting

**Available tools:**

- getAPAgingReport
- getARAgingReport
- getCashPositionReport
- getVendorSpendReport
- getRecentBills
- getRecentInvoices
- getAcumaticaProjectBudget
- getAcumaticaProjectList
- getPurchaseOrderSummary
- getFinanceSpendRollup

Acumatica reads depend on live integration availability. Eve must disclose a
provider or source failure rather than substitute an estimate.

### SOP backlog

**Available tool:** getSopBacklog

Reads missing or incomplete accounting/finance SOP requirements.

## 5. Operations, schedule, people, and risk

### Schedule analysis

**Available tools:** getScheduleAnalysis, queryScheduleTasks

Reads schedule tasks, status, delays, and available critical-path information.

### People and project roles

**Available tool:** getPeopleAndRoles

Reads project participants, roles, and available assignment information.

### Vendor performance

**Available tool:** getVendorPerformance

Reads vendor/subcontractor performance signals available to the selected
project.

### RFIs

**Available tool:** getRFIStatus

Reads RFI status, aging, and available responsibility information.

### Submittals

**Available tools:** getSubmittalStatus, getSubmittalLog

Reads submittal status and document-intelligence evidence.

### Risks and insights

**Available tools:** getProjectRiskAnalysis, getProjectsWithRisks,
getActionItemsAndInsights

Uses structured risk and intelligence records. It does not create risk records
through the read-only bridge.

## 6. Meetings and communications

### Meeting discovery

**Available tools:**

- searchMeetingsByTopic
- getMeetingDetails
- getMeetingsByDate

Finds meetings by topic/date and returns meeting metadata, transcript evidence,
decisions, risks, or actions when available.

### Email search

**Available tools:**

- getRecentEmails
- searchEmails

Reads permitted email evidence. Results depend on Microsoft Graph/source-sync
health and project attribution.

### Teams search

**Available tool:** searchTeamsMessages

Searches permitted Teams evidence. It does not send a Teams message through the
current Eve bridge.

### Outlook operational status and calendar

**Available tools:**

- getOutlookOperationsStatus
- getOutlookCalendarEvents

Reports source/subscription readiness and reads available calendar events.

### Cross-source timeline

**Status:** UI/API available.

The assistant timeline endpoint aggregates meetings, email, Teams, and document
events for the current user/project scope.

## 7. Documents, RAG, and knowledge

### Semantic search

**Available tool:** semanticSearch

Embeds the query and searches permitted document chunks. Raw vector search is
supporting evidence, not the preferred answer source when structured project
data or a current intelligence packet exists.

### Project document discovery

**Available tools:**

- findProjectDocuments
- searchDocuments
- searchExternalDocuments
- queryDocumentRows

Finds documents and structured document rows associated with accessible
projects and sources.

### Company knowledge

**Available tool:** getCompanyKnowledge

Reads approved company knowledge records.

### Specifications and submittal intelligence

**Available tools:**

- getSpecRequirements
- detectMissingSubmittals
- reviewSubmittalAgainstDrawings
- identifySubmittalPackages

These tools inspect specifications, drawings, submittals, and their extracted
content. Results depend on successful OCR, document processing, and project
attribution.

### App help

**Available tools:** searchAppHelp, findAppPage

Searches curated App Expert help articles, the generated sitemap, and feature
registry. It should answer current route/feature questions without inventing
functionality.

## 8. Memory and prior conversations

### Search past conversations

**Available tools:** recallPastConversations, searchPastConversations

Finds prior conversation evidence available to the signed-in user.

### Search memory

**Available tool:** searchMemories

Reads permitted persisted memory records.

### Manage memories

**Status:** UI/API available.

Users can list, create, update, delete, and give feedback on memory records.

### Write memory from Eve

**Registered tool:** writeMemory

**Status:** Registered, blocked.

The implementation exists, but Eve cannot call it through the current read-only
bridge.

## 9. Research and external information

### App-owned web research

**Available tools:**

- searchWeb
- researchCompany
- searchConstructionMarket

Eve's arbitrary-network and built-in web-search capabilities are disabled.
These three bounded application-owned tools are the permitted web-research
path when provider configuration allows them.

### Structured action brief

**Available tool:** extractStructuredActionBrief

Converts supplied evidence into a structured action-brief shape. It is a read
or transformation operation and does not execute the proposed actions.

## 10. Marketing functionality

### Marketing reads

**Available tools:**

- findMarketingSourceCandidates
- getMarketingCalendar

Reads source candidates and existing marketing calendar records.

### Marketing creation

**Registered, blocked tools:**

- createMarketingIntelligenceItem
- createMarketingIntelligenceFromCandidate
- createContentCalendarDraft
- createMarketingContentAsset

The UI and implementations exist, but Eve cannot perform these writes through
the current bridge.

### Marketing management APIs

**Status:** UI/API available.

Users can manage marketing assets and calendar items through dedicated
application pages and APIs independently of Eve tool execution.

## 11. Feature-request and implementation planning

### Feature-request reads

**Available tools:**

- findRelatedFeatureRequests
- scoreFeatureRequestReadiness

Finds related requests and evaluates whether a request contains enough
information to proceed.

### Feature-request writes

**Registered, blocked tools:**

- captureFeatureRequestPacket
- captureIdeaItem
- updateFeatureRequestPacket
- generateImplementationPlan
- generateClaudeCodeHandoff
- draftLinearIssueFromFeatureRequest
- draftLinearSubIssuesFromImplementationPlan
- attachLinearIssueToFeatureRequest
- attachLinearSubIssueToFeatureRequest
- recordLinearStatusUpdateForFeatureRequest

These implementations are retained by the application but are not exposed to
Eve until an authenticated approval/write contract is enabled.

## 12. Progress reports and workspace artifacts

### Progress-report reads

**Available tool:** listProgressReportPhotos

Lists photos eligible for an accessible project report.

### Progress-report writes

**Registered, blocked tools:**

- createWeeklyProgressReportDraft
- updateProgressReportSections
- selectProgressReportPhotos
- generateProgressReportPdf

### Workspace reads

**Available tools:**

- listWorkspaceArtifacts
- getDraftArtifact

### Workspace writes

**Registered, blocked tools:**

- saveWorkspaceArtifact
- promoteWorkspaceArtifact

## 13. Assistant actions registered but unavailable to Eve

The following action implementations exist in the shared application tool
layer. The current Eve bridge excludes all of them because they modify
application state or deliver externally.

### Construction and project writes

**Registered, blocked:**

- createChangeOrder
- createChangeEvent
- updateProjectStatus
- createRFI
- createTask
- createGeneratedTask
- createProjectCompany
- createProjectContact
- createContact
- updateGeneratedTask
- deleteGeneratedTask
- flagProjectRisk
- updateRFIStatus
- createMeetingNote
- createSubmittal
- logDailyReport
- generateProjectSummary
- createInitiativeCard
- createCommitment
- createPrimeContract
- editPrimeContractSov
- submitFeedback
- addBoardItem
- dispatchImplementationRequest

### External delivery

**Registered, blocked:**

- createOutlookCalendarInvite
- draftOutlookEmail
- sendTeamsMessage

### Knowledge and document writes

**Registered, blocked:**

- saveToKnowledgeBase
- saveInsight
- writeMemory
- logFeedback
- reviewDocument

No UI approval click can make these tools appear in Eve today; the bridge must
first implement and verify a write/delivery authorization contract.

## 14. Feedback, teaching, skills, and personalization

### Response feedback

**Status:** UI/API available.

Users can provide thumbs/reason feedback on assistant responses and view their
own submitted feedback.

### Task feedback

**Status:** UI/API available.

Users can provide categorized feedback on AI-extracted tasks.

### Packet-card feedback

**Status:** UI/API available.

Users can mark intelligence packet cards useful, not useful, or wrong.

### Email feedback

**Status:** UI/API available.

The application accepts email-draft and email-importance feedback for its
learning and review systems.

### Teach Alleato

**Status:** UI/API available.

Users can submit teaching examples and corrections through `/ai/teach`.
Promotion into active behavior remains controlled by the application learning
and review process.

### Skill library and skill feedback

**Status:** UI/API available.

Users can browse skills and provide feedback. Eve skill execution itself is
owned by the six Markdown skills in the canonical agent package.

### AI profile

**Status:** UI available.

Provides user-facing assistant profile and preference management.

## 15. Voice, avatar, widgets, and presentation

### Speech

**Status:** API/UI available.

The speech endpoint supports configured speech-to-text and text-to-speech
operations. Provider availability must be reported explicitly.

### Avatar

**Status:** Separate UI/API feature.

The Tavus avatar surface can create an avatar conversation when configured. It
is not a second assistant generation owner.

### Global Ask Alleato widget

**Status:** Available and production-verified on the deployed Eve path.

Provides assistant access without leaving the current application page.

### Generative widgets and review cards

**Status:** Renderer/UI available.

The application can render typed assistant payloads such as task summaries,
project selectors, financial information, daily updates, action previews, and
review cards. A renderer existing does not mean Eve can currently execute the
associated write.

### Citations and formatting

**Status:** UI available.

Assistant messages support formatted content, source links, skill-use
disclosure, memory-use disclosure, and persisted tool/action parts.

## 16. Administration and observability

### Durable turn inspection

**Status:** API available.

Turn APIs expose authenticated receipt/state operations for accepted,
running, completed, failed, and supported cancellation behavior.

### Usage statistics

**Status:** API available.

Provides aggregated assistant usage information for authorized administrative
surfaces.

### Trace and evidence presentation

**Status:** UI components exist.

Trace panels and menus can display tool, source, and timing evidence when the
runtime supplies it. Current production verification must use Eve turn events
and source receipts, not legacy handler traces.

### Sole-runtime guard

**Status:** Implemented and published in AAI-1265.

`verify_eve_only_runtime.mjs` rejects reintroduction of the legacy chat route,
handler, frontend orchestrator, bot core, runtime selector, canary/parity
scaffolding, duplicate Eve lab, or old assistant UI namespace.

## 17. Ask Alleato capability subset

Ask Alleato deliberately receives only these 17 read tools:

- findProject
- getProjectDetails
- getProjectBriefingSnapshot
- getPortfolioOverview
- getProjectsWithRisks
- getProjectRiskAnalysis
- getFinancialAnalysis
- getScheduleAnalysis
- getPeopleAndRoles
- getRFIStatus
- getSubmittalStatus
- semanticSearch
- getCompanyKnowledge
- searchMeetingsByTopic
- getMeetingDetails
- findProjectDocuments
- searchDocuments

Ask Alleato cannot receive write, approval, delivery, workspace, marketing, or
feature-request mutation tools.

## 18. Separate AI systems that Eve does not own

### RAG ingestion and processing

**Owner:** Source adapters, Vercel Workflow, FastAPI stages, and Supabase.

Eve reads the results. It does not poll sources, OCR files, create embeddings,
or compile intelligence packets.

### ASRS

**Status:** Separate runtime.

ASRS owns:

- searchFmds2026Evidence
- evaluateFmds2026Configuration

These tools must not be added to Eve through a broad registry import.

### Backend scheduled and specialist services

Backend services may acquire Microsoft/Fireflies data, compile intelligence,
perform OCR, or implement bounded specialist reads. They are data/service
owners, not competing `/ai` conversation runtimes.

## 19. Known limitations and unverified areas

- The AAI-1265 Eve-only deletion is published in this backup repository.
- The production alias completed an authenticated app-to-Eve lifecycle:
  start `202`, stream `200`, terminal turn `completed`, followed by temporary
  data cleanup.
- Workflow ingress authorization is live and creates durable runs.
- Controlled durable run `wrun_01KYR3MKXQEHC80QFCB56TSD5F` completed all five
  production stages on the first attempt and persisted five embedded chunks.
- URL ingestion and project-scoped source-to-retrieval are production-proven.
- Production source health was recomputed after the 2026-07-30 owner repair:
  61 current sources, five actionable alerts, zero retired teams_chat sources,
  and a healthy Microsoft Graph aggregate with a nine-minute freshness receipt.
- The Eve bridge is read-only; all registered writes and deliveries are blocked.
- Durable out-of-band cancellation is unavailable in Eve 0.22.6.
- Current operational gaps are the SharePoint bootstrap and promotion queues,
  the sampled vectorization backlog, one unconfigured Graph subscription, and
  the Acumatica provider GI.
- Fresh one-record production traces have not yet been repeated for every
  source class. Fireflies, Graph, drawing OCR, and manual uploads share the
  verified workflow and have focused caller/stage coverage, while their
  acquisition freshness remains independently monitored.

## 20. Functionality verification checklist

A capability should be described as production-verified only when:

- the correct user can discover it;
- an unauthorized user/project cannot discover it;
- the tool receives the verified project scope;
- the expected source or structured rows are returned;
- a source failure is visible rather than silently replaced;
- the final answer cites or identifies its evidence;
- refresh restores the answer and its relevant metadata;
- writes/deliveries require the approved contract before execution;
- the same test fails if the capability or authorization boundary regresses.

## Canonical supporting documents

- `docs/architecture/AI-ASSISTANT-ARCHITECTURE-REFERENCE.md`
- `docs/architecture/AI-ASSISTANT-GENERATION-OWNERSHIP-AUDIT.md`
- `docs/architecture/AI-ASSISTANT-FUNCTIONALITY.md`
- `docs/architecture/RAG-PIPELINE-OWNERSHIP.md`
- `docs/architecture/AI-RAG-ARCHITECTURE.md`
- `docs/ops/tasks/AAI-1265-EVE-ONLY.md`
- `agents/alleato-assistant/README.md`
- `frontend/src/lib/ai/eve-runtime/production-tool-registry.ts`

## Final interpretation rule

Use this hierarchy when documentation conflicts:

1. Authenticated runtime behavior and tests
2. Canonical Eve registry and bridge policy
3. This functionality catalog
4. Architecture reference
5. Historical audit/change-log documents

Never infer that Eve can perform a write merely because a shared tool
implementation or UI component exists.
