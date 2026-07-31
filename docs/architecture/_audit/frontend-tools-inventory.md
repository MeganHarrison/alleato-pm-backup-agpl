# Frontend AI Tools Inventory — `frontend/src/lib/ai/tools/`

**Audit pass:** 1a of 4 (fact-gathering)
**Date collected:** 2026-05-19
**Scope:** All `.ts` files in `/Users/meganharrison/Documents/alleato-pm/frontend/src/lib/ai/tools/` (excluding `__tests__/`)

> **Note on completeness:** The codebase-analyzer agent that produced this inventory was unable to persist its full per-tool deep-dive sections to disk (no Write tool in its tool set). The flat reference table and summary below are complete. Per-file deep-dive sections need to be reconstructed during the synthesis pass (Pass 2) by reading the source files directly. The flat table contains the comparable data (tool, file, data source, caller, test coverage) needed to drive the synthesis recommendations.

---

## Headline numbers

- **133 discrete `tool({...})` instances across 24 files**
- **`project-tools.ts`** is a pure barrel: spreads 7 sub-factories plus defines 12 own tools
- **`operational.ts`** is the largest single file (142KB) and includes 22 tools plus a spread of 6 structured-query tools
- Test coverage is concentrated in `action-tools.ts` (every write tool has a test); the rest of the surface has minimal coverage

---

## Flat Reference Table

| Tool | File | Source | Caller | Has test |
|---|---|---|---|---|
| createChangeOrder | action-tools.ts | `supabase_table:prime_contract_change_orders` | orchestrator via createActionTools | yes |
| createChangeEvent | action-tools.ts | `supabase_table:change_events` | orchestrator via createActionTools | yes |
| updateProjectStatus | action-tools.ts | `supabase_table:projects` | orchestrator via createActionTools | yes |
| createRFI | action-tools.ts | `supabase_table:rfis` | orchestrator via createActionTools | yes |
| createTask | action-tools.ts | `multiple` | orchestrator via createActionTools | yes |
| createGeneratedTask | action-tools.ts | `supabase_rpc:create_ai_generated_task` | orchestrator via createActionTools | yes |
| updateGeneratedTask | action-tools.ts | `supabase_table:tasks` | orchestrator via createActionTools | yes |
| deleteGeneratedTask | action-tools.ts | `supabase_table:tasks` | orchestrator via createActionTools | yes |
| flagProjectRisk | action-tools.ts | `multiple` | orchestrator via createActionTools | yes |
| updateRFIStatus | action-tools.ts | `supabase_table:rfis` | orchestrator via createActionTools | yes |
| createMeetingNote | action-tools.ts | `supabase_table:document_metadata` | orchestrator via createActionTools | yes |
| createSubmittal | action-tools.ts | `supabase_table:submittals` | orchestrator via createActionTools | yes |
| logDailyReport | action-tools.ts | `supabase_table:daily_logs` | orchestrator via createActionTools | yes |
| generateProjectSummary | action-tools.ts | `multiple` | orchestrator via createActionTools | yes |
| createInitiativeCard | action-tools.ts | `supabase_table:initiative_cards` | orchestrator via createActionTools | yes |
| createCommitment | action-tools.ts | `multiple` | orchestrator via createActionTools | yes |
| createProjectCompany | action-tools.ts | `multiple` | orchestrator via createActionTools | yes |
| createProjectContact | action-tools.ts | `multiple` | orchestrator via createActionTools | yes |
| submitFeedback | action-tools.ts | `multiple` | orchestrator via createActionTools | yes |
| addBoardItem | action-tools.ts | `supabase_table:admin_feedback_items` | orchestrator via createActionTools | yes |
| createOutlookCalendarInvite | action-tools.ts | **`microsoft_graph_live`** | orchestrator via createActionTools | yes |
| draftOutlookEmail | action-tools.ts | **`microsoft_graph_live`** | orchestrator via createActionTools | yes |
| sendTeamsMessage | action-tools.ts | `multiple` | orchestrator via createActionTools | yes |
| getAPAgingReport | acumatica.ts | `acumatica_live` | project-tools via createAcumaticaTools | no |
| getARAgingReport | acumatica.ts | `acumatica_live` | project-tools via createAcumaticaTools | no |
| getCashPositionReport | acumatica.ts | `acumatica_live` | project-tools via createAcumaticaTools | no |
| getVendorSpendReport | acumatica.ts | `acumatica_live` | project-tools via createAcumaticaTools | no |
| getRecentBills | acumatica.ts | `acumatica_live` | project-tools via createAcumaticaTools | no |
| getRecentInvoices | acumatica.ts | `acumatica_live` | project-tools via createAcumaticaTools | no |
| getAcumaticaProjectBudget | acumatica.ts | `acumatica_live` | project-tools via createAcumaticaTools | no |
| getAcumaticaProjectList | acumatica.ts | `acumatica_live` | project-tools via createAcumaticaTools | no |
| getPurchaseOrderSummary | acumatica.ts | `acumatica_live` | project-tools via createAcumaticaTools | no |
| searchAppHelp | app-help-tools.ts | `internal_state` | project-tools via createAppHelpTools | no |
| createDocument | create-document.ts | `internal_state` | chat API route (injected) | no |
| getSubmittalLog | document-intelligence.ts | `supabase_table:submittals` | orchestrator via createDocumentIntelligenceTools | no |
| getSpecRequirements | document-intelligence.ts | `document_chunks_rag` | orchestrator via createDocumentIntelligenceTools | no |
| detectMissingSubmittals | document-intelligence.ts | `supabase_table:submittals` | orchestrator via createDocumentIntelligenceTools | no |
| logFeedback | document-intelligence.ts | `supabase_table:ai_review_feedback` | orchestrator via createDocumentIntelligenceTools | no |
| reviewDocument | document-intelligence.ts | `document_chunks_rag` | orchestrator via createDocumentIntelligenceTools | no |
| findRelatedFeatureRequests | feature-request-tools.ts | UNKNOWN | orchestrator via createFeatureRequestTools | no |
| captureFeatureRequestPacket | feature-request-tools.ts | UNKNOWN | orchestrator via createFeatureRequestTools | no |
| updateFeatureRequestPacket | feature-request-tools.ts | UNKNOWN | orchestrator via createFeatureRequestTools | no |
| scoreFeatureRequestReadiness | feature-request-tools.ts | UNKNOWN | orchestrator via createFeatureRequestTools | no |
| generateImplementationPlan | feature-request-tools.ts | UNKNOWN | orchestrator via createFeatureRequestTools | no |
| generateClaudeCodeHandoff | feature-request-tools.ts | UNKNOWN | orchestrator via createFeatureRequestTools | no |
| draftLinearIssueFromFeatureRequest | feature-request-tools.ts | UNKNOWN | orchestrator via createFeatureRequestTools | no |
| draftLinearSubIssuesFromImplementationPlan | feature-request-tools.ts | UNKNOWN | orchestrator via createFeatureRequestTools | no |
| attachLinearIssueToFeatureRequest | feature-request-tools.ts | UNKNOWN | orchestrator via createFeatureRequestTools | no |
| attachLinearSubIssueToFeatureRequest | feature-request-tools.ts | UNKNOWN | orchestrator via createFeatureRequestTools | no |
| recordLinearStatusUpdateForFeatureRequest | feature-request-tools.ts | UNKNOWN | orchestrator via createFeatureRequestTools | no |
| getCommitmentsOverview | financial.ts | `multiple` | project-tools via createFinancialTools | no |
| getChangeOrderDetails | financial.ts | `multiple` | project-tools via createFinancialTools | no |
| getDirectCostsSummary | financial.ts | `multiple` | project-tools via createFinancialTools | no |
| getBudgetLineItems | financial.ts | `multiple` | project-tools via createFinancialTools | no |
| getCostTrends | financial.ts | `multiple` | project-tools via createFinancialTools | no |
| getMarginAnalysis | financial.ts | `multiple` | project-tools via createFinancialTools | no |
| getForecastComparison | forecast-tools.ts | `supabase_table:v_budget_lines` | project-tools via createForecastTools | no |
| getWeather | get-weather.ts | `external_api:open-meteo` | **UNKNOWN — not wired in orchestrator** | no |
| listDomainIntelligence | intelligence-tools.ts | `supabase_table:intelligence_targets` | orchestrator via createIntelligenceTools | no |
| getDomainIntelligence | intelligence-tools.ts | `multiple` | orchestrator via createIntelligenceTools | no |
| findMarketingSourceCandidates | marketing.ts | UNKNOWN | orchestrator via createMarketingTools | no |
| createMarketingIntelligenceItem | marketing.ts | UNKNOWN | orchestrator via createMarketingTools | no |
| createMarketingIntelligenceFromCandidate | marketing.ts | UNKNOWN | orchestrator via createMarketingTools | no |
| createContentCalendarDraft | marketing.ts | UNKNOWN | orchestrator via createMarketingTools | no |
| createMarketingContentAsset | marketing.ts | UNKNOWN | orchestrator via createMarketingTools | no |
| getMarketingCalendar | marketing.ts | UNKNOWN | orchestrator via createMarketingTools | no |
| getPeopleAndRoles | operational.ts | `supabase_table:project_directory_memberships` | project-tools via createOperationalTools | no |
| getVendorPerformance | operational.ts | `multiple` | project-tools via createOperationalTools | no |
| getRFIStatus | operational.ts | `supabase_table:rfis` | project-tools via createOperationalTools | no |
| getSubmittalStatus | operational.ts | `supabase_table:submittals` | project-tools via createOperationalTools | no |
| getCrossProjectComparison | operational.ts | `multiple` | project-tools via createOperationalTools | no |
| getHistoricalTrends | operational.ts | `multiple` | project-tools via createOperationalTools | no |
| semanticSearch | operational.ts | `multiple` | project-tools via createOperationalTools | no |
| getCompanyKnowledge | operational.ts | `supabase_table:company_context` | project-tools via createOperationalTools | no |
| recallPastConversations | operational.ts | `supabase_rpc:search_conversation_memories` | project-tools via createOperationalTools | no |
| searchMeetingsByTopic | operational.ts | `multiple` | project-tools via createOperationalTools | no |
| getMeetingDetails | operational.ts | `multiple` | project-tools via createOperationalTools | no |
| saveToKnowledgeBase | operational.ts | `internal_state` | project-tools via createOperationalTools | no |
| saveInsight | operational.ts | `multiple` | project-tools via createOperationalTools | no |
| searchMemories | operational.ts | `supabase_rpc:search_conversation_memories` | project-tools via createOperationalTools | no |
| writeMemory | operational.ts | `supabase_table:memories` | project-tools via createOperationalTools | no |
| findProject | operational.ts | `multiple` | project-tools via createOperationalTools | no |
| **getRecentEmails** | operational.ts | `multiple` (live Graph → outlook_email_intake fallback per recent fix) | project-tools via createOperationalTools | no |
| searchEmails | operational.ts | `document_chunks_rag` | project-tools via createOperationalTools | no |
| searchTeamsMessages | operational.ts | `document_chunks_rag` | project-tools via createOperationalTools | no |
| searchExternalDocuments | operational.ts | `document_chunks_rag` | project-tools via createOperationalTools | no |
| getRecentOutlookEmails | outlook-operations.ts | **`outlook_email_intake_synced`** | project-tools via createOutlookOperationsTools | no |
| readOutlookEmailThread | outlook-operations.ts | **`outlook_email_intake_synced`** | project-tools via createOutlookOperationsTools | no |
| getOutlookOperationsStatus | outlook-operations.ts | `multiple` | project-tools via createOutlookOperationsTools | no |
| getOutlookCalendarEvents | outlook-operations.ts | **`microsoft_graph_live`** | project-tools via createOutlookOperationsTools | no |
| createWeeklyProgressReportDraft | progress-report-tools.ts | UNKNOWN | orchestrator via createProgressReportTools | no |
| updateProgressReportSections | progress-report-tools.ts | UNKNOWN | orchestrator via createProgressReportTools | no |
| listProgressReportPhotos | progress-report-tools.ts | UNKNOWN | orchestrator via createProgressReportTools | no |
| selectProgressReportPhotos | progress-report-tools.ts | UNKNOWN | orchestrator via createProgressReportTools | no |
| generateProgressReportPdf | progress-report-tools.ts | UNKNOWN | orchestrator via createProgressReportTools | no |
| getMeetingIntelligence | project-tools.ts | `multiple` | orchestrator via createProjectTools | yes |
| getProjectBriefingSnapshot | project-tools.ts | `multiple` | orchestrator via createProjectTools | yes |
| getPortfolioOverview | project-tools.ts | `multiple` | orchestrator via createProjectTools | yes |
| getProjectsWithRisks | project-tools.ts | `multiple` | orchestrator via createProjectTools | yes |
| getProjectRiskAnalysis | project-tools.ts | `multiple` | orchestrator via createProjectTools | yes |
| getFinancialAnalysis | project-tools.ts | `multiple` | orchestrator via createProjectTools | yes |
| getProjectBudgetSummary | project-tools.ts | `multiple` | orchestrator via createProjectTools | yes |
| getActionItemsAndInsights | project-tools.ts | `multiple` | orchestrator via createProjectTools | yes |
| getMeetingsByDate | project-tools.ts | `supabase_table:document_metadata` | orchestrator via createProjectTools | yes |
| findProjectDocuments | project-tools.ts | `supabase_table:document_metadata` | orchestrator via createProjectTools | yes |
| searchDocuments | project-tools.ts | `supabase_table:document_metadata` | orchestrator via createProjectTools | yes |
| getProjectDetails | project-tools.ts | `multiple` | orchestrator via createProjectTools | yes |
| requestSuggestions | request-suggestions.ts | `internal_state` | chat API route (injected) | no |
| getScheduleAnalysis | schedule-tools.ts | `multiple` | project-tools via createScheduleTools | no |
| extractStructuredActionBrief | structured-output.ts | `internal_state` | orchestrator via createStructuredOutputTools | no |
| queryBudgetData | structured-queries.ts | `supabase_table:budget_lines` | operational.ts spread | no |
| queryChangeOrders | structured-queries.ts | `multiple` | operational.ts spread | no |
| queryCommitments | structured-queries.ts | `supabase_table:commitments_unified` | operational.ts spread | no |
| queryDirectCosts | structured-queries.ts | `supabase_table:direct_costs` | operational.ts spread | no |
| queryScheduleTasks | structured-queries.ts | `supabase_table:schedule_tasks` | operational.ts spread | no |
| queryDocumentRows | structured-queries.ts | `multiple` | operational.ts spread | no |
| searchStructuredFinancialRows | structured-queries.ts | `multiple` | operational.ts spread | no |
| updateDocument | update-document.ts | `internal_state` | chat API route (injected) | no |
| searchWeb | web-search.ts | `external_api:tavily` | orchestrator via createWebSearchTools | no |
| researchCompany | web-search.ts | `external_api:tavily` | orchestrator via createWebSearchTools | no |
| searchConstructionMarket | web-search.ts | `external_api:tavily` | orchestrator via createWebSearchTools | no |
| listWorkspaceArtifacts | workspace-tools.ts | UNKNOWN (delegates to workspace-artifact-service) | orchestrator via createWorkspaceTools | no |
| getDraftArtifact | workspace-tools.ts | UNKNOWN (delegates to workspace-artifact-service) | orchestrator via createWorkspaceTools | no |
| saveWorkspaceArtifact | workspace-tools.ts | UNKNOWN (delegates to workspace-artifact-service) | orchestrator via createWorkspaceTools | no |
| promoteWorkspaceArtifact | workspace-tools.ts | UNKNOWN (delegates to workspace-artifact-service) | orchestrator via createWorkspaceTools | no |

---

## Key findings from the audit pass

1. **`project-tools.ts` is a pure barrel** — it spreads 7 sub-factories (`createFinancialTools`, `createAcumaticaTools`, `createOperationalTools`, `createScheduleTools`, `createAppHelpTools`, `createForecastTools`, `createOutlookOperationsTools`) plus defines 12 own tools. Nearly every tool in `financial.ts`, `acumatica.ts`, `operational.ts`, `schedule-tools.ts`, `app-help-tools.ts`, `forecast-tools.ts`, and `outlook-operations.ts` is accessible through `createProjectTools`.

2. **`structured-queries.ts` (7 tools) is not wired to the orchestrator directly** — it is spread inside `createOperationalTools` at line 3539 of `operational.ts`.

3. **`saveToKnowledgeBase` in `operational.ts` is a dead stub** that always returns an error (underlying table dropped). Synthesis pass should flag for removal.

4. **`getWeather` has no wiring** in `orchestrator.ts` or any tool composition file; it exports directly with `needsApproval: true` (literal boolean). It's defined but never reachable through the active assistant.

5. **UNKNOWN data sources concentrated in 4 files** (28 tools total): `feature-request-tools.ts` (11), `progress-report-tools.ts` (5), `workspace-tools.ts` (4), `marketing.ts` (6). All four delegate entirely to service-layer functions in `@/lib/feature-requests/server`, `@/lib/progress-reports/server`, `@/lib/ai/services/workspace-artifact-service`, and `@/lib/ai/services/marketing-service` respectively. Synthesis pass needs to read those service files to classify the underlying data sources.

6. **Test coverage is concentrated in `action-tools.ts`** — `__tests__/action-tools.test.ts` covers every write tool. `project-tools-barrel.test.ts` only verifies tool names are present on the barrel; does not exercise execution. The 110 non-action tools have no execution-level tests.

7. **Source-of-truth conflict for Outlook reads (the issue that started this audit):**
   - `getRecentEmails` in `operational.ts` — recently patched to prefer `microsoft_graph_live` with fallback to `outlook_email_intake_synced` (per prior conversation)
   - `getRecentOutlookEmails` and `readOutlookEmailThread` in `outlook-operations.ts` — still read `outlook_email_intake_synced` (synced cache only)
   - `getOutlookCalendarEvents` in `outlook-operations.ts` — uses `microsoft_graph_live`
   - **Inconsistency:** within the same `outlook-operations.ts` file, calendar reads use live Graph while email/thread reads use synced cache. This is the exact pattern the prior conversation flagged.

8. **Tool-source map by data source (counts):**
   - `microsoft_graph_live`: 4 tools (createOutlookCalendarInvite, draftOutlookEmail, getOutlookCalendarEvents, partial getRecentEmails)
   - `outlook_email_intake_synced`: 2 tools (getRecentOutlookEmails, readOutlookEmailThread, partial getRecentEmails fallback)
   - `document_chunks_rag`: 6 tools (searchEmails, searchTeamsMessages, searchExternalDocuments, getSpecRequirements, reviewDocument, plus partial semanticSearch)
   - `acumatica_live`: 9 tools (all Acumatica reports)
   - `external_api:tavily`: 3 tools (web search)
   - `external_api:open-meteo`: 1 unwired tool (getWeather)
   - `supabase_table:*`: ~40 tools (direct PM APP queries)
   - `supabase_rpc:*`: 3 tools
   - `internal_state` / config-only: ~7 tools
   - UNKNOWN (delegates to services): 26 tools

---

## Files inventoried

- `frontend/src/lib/ai/tools/action-tools.ts` — 144KB, 23 write/action tools
- `frontend/src/lib/ai/tools/acumatica.ts` — 22KB, 9 Acumatica live tools
- `frontend/src/lib/ai/tools/app-help-tools.ts` — 3KB, 1 tool
- `frontend/src/lib/ai/tools/create-document.ts` — 2KB, 1 tool
- `frontend/src/lib/ai/tools/document-intelligence.ts` — 24KB, 5 tools
- `frontend/src/lib/ai/tools/feature-request-tools.ts` — 18KB, 11 tools (all delegate to services)
- `frontend/src/lib/ai/tools/financial.ts` — 54KB, 6 tools
- `frontend/src/lib/ai/tools/forecast-tools.ts` — 6KB, 1 tool
- `frontend/src/lib/ai/tools/get-weather.ts` — 2KB, 1 tool (UNWIRED)
- `frontend/src/lib/ai/tools/guardrails.ts` — 5KB, utilities only (no tools)
- `frontend/src/lib/ai/tools/intelligence-tools.ts` — 8KB, 2 tools
- `frontend/src/lib/ai/tools/marketing.ts` — 10KB, 6 tools (all delegate to services)
- `frontend/src/lib/ai/tools/mcp-tools.ts` — 7KB, MCP integration (no direct tools)
- `frontend/src/lib/ai/tools/operational.ts` — 142KB, 22 tools + 7 structured-query tools spread in
- `frontend/src/lib/ai/tools/outlook-operations.ts` — 25KB, 4 tools (3 synced, 1 live)
- `frontend/src/lib/ai/tools/progress-report-tools.ts` — 15KB, 5 tools (all delegate to services)
- `frontend/src/lib/ai/tools/project-tools.ts` — 120KB, 12 own tools + 7 sub-factory spreads (pure barrel)
- `frontend/src/lib/ai/tools/request-suggestions.ts` — 4KB, 1 tool
- `frontend/src/lib/ai/tools/schedule-tools.ts` — 7KB, 1 tool
- `frontend/src/lib/ai/tools/structured-output.ts` — 4KB, 1 tool
- `frontend/src/lib/ai/tools/structured-queries.ts` — 25KB, 7 tools (spread into operational.ts)
- `frontend/src/lib/ai/tools/tool-utils.ts` — 14KB, utilities only (no tools)
- `frontend/src/lib/ai/tools/update-document.ts` — 2KB, 1 tool
- `frontend/src/lib/ai/tools/web-search.ts` — 12KB, 3 tools
- `frontend/src/lib/ai/tools/workspace-tools.ts` — 12KB, 4 tools (all delegate to services)

---

## Open items for synthesis pass (Pass 2)

1. **Classify the 26 UNKNOWN data sources** by reading the service layer files:
   - `frontend/src/lib/feature-requests/server/*`
   - `frontend/src/lib/progress-reports/server/*`
   - `frontend/src/lib/ai/services/workspace-artifact-service.ts`
   - `frontend/src/lib/ai/services/marketing-service.ts`
2. **Resolve `multiple` entries** for the high-traffic tools (`getRecentEmails`, `searchMeetingsByTopic`, `semanticSearch`, `getFinancialAnalysis`, etc.) by reading the source to enumerate exactly which sources each touches and in what priority order.
3. **Confirm the `getRecentEmails` patch status** — the prior conversation's fix should now have it preferring `microsoft_graph_live`. Verify and document the current behaviour vs the fallback chain.
4. **Decide on the unwired `getWeather`** — delete or wire.
5. **Decide on the dead `saveToKnowledgeBase` stub** — delete.
6. **Recommend a consistency fix for `outlook-operations.ts`** — currently mixes live and synced sources within one file.
