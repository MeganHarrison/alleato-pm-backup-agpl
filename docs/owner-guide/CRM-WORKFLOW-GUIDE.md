# Alleato CRM Workflow and Function Guide

**Audience:** Business development, project leadership, and CRM administrators
**System:** Alleato Project Management CRM
**Last updated:** July 29, 2026

## 1. Purpose

The CRM is the relationship and opportunity layer inside the existing Alleato Project Management application. It uses the company directory as the source of truth for companies, the existing Tasks system for follow-ups, and the existing document and project records for supporting context. It does not create a second company list or a separate task application.

## 2. Core workflow

1. Open a company in the Company Directory.
2. Select **Add to CRM** to enroll the existing company as a relationship.
3. Review the relationship owner, lifecycle stage, health status, activity, open deals, and next follow-up.
4. Record calls, emails, meetings, and notes in the relationship activity history.
5. Create a deal for a qualified opportunity and move it through the sales pipeline.
6. Create follow-ups from the deal. These are ordinary records in the existing Tasks system and also appear on the CRM deal.
7. Review communication matching suggestions before accepting them into CRM history.
8. When a deal is won, create the project from the deal. The system records the project link and reconciles Acumatica status when the project receives its Acumatica project identifier.

## 3. CRM workspace

| Area | Purpose | Expected behavior |
| --- | --- | --- |
| Relationships | Daily relationship work queue | Search and filter enrolled companies, review health and attention reasons, open a company, archive or restore a relationship. |
| Pipeline | Stage-based opportunity view | Scan deals by stage and move an opportunity to another valid stage. |
| Deals | Detailed opportunity list | Create deals, filter by owner or status, open a deal, edit opportunity fields, archive or restore. |
| Activity | Relationship history | Log, edit, and delete manual activity. Accepted communication suggestions also appear here. |
| Matching | Communication review queue | Accept or reject suggested company matches before they become relationship activity. |
| Settings | CRM operating rules | Manage relationship health thresholds, stale-deal timing, reporting timezone, free-email-domain rules, and matching behavior. |

## 4. Company enrollment and ownership

The Company Directory remains authoritative for the company name and ERP-owned company data. Adding a company to CRM creates only a CRM relationship profile. The relationship profile contains the CRM owner, lifecycle stage, health status, health reason, last meaningful activity date, and archive state.

Owners and administrators can update relationship records. CRM access is controlled by the CRM permission module. Application administrators have administrative CRM access.

## 5. Relationship health

Relationship health is derived from meaningful activity and the configured thresholds:

- **Healthy:** recent meaningful activity is inside the active threshold.
- **Watch:** activity is older than the active threshold but inside the watch threshold.
- **Attention:** activity is older than the watch threshold or a follow-up/deal condition needs attention.

Health is decision support, not a replacement for judgment. The reason shown beside the status explains why the relationship received that state.

## 6. Deals and pipeline

A deal belongs to one enrolled company, one owner, one pipeline, and one stage. Deal value, probability, expected close date, source, and status drive the opportunity workflow.

The standard stage flow is:

`Lead -> Qualified -> Proposal / Bid -> Negotiation -> Won or Lost`

Stage changes use the saved row version to prevent one user from overwriting another user's newer change. Lost opportunities require a reason. A won deal with a linked project cannot be reopened until the project link is deliberately removed with a change reason.

## 7. Follow-ups and the existing Tasks system

CRM follow-ups are stored in the existing `tasks` table. They are not a separate CRM-only task list.

When a follow-up is created from a deal:

- it is linked to the company and deal;
- it is assigned to the relationship owner;
- it appears in the existing Tasks experience;
- its source is labeled CRM and links back to the CRM record;
- completing it in either place updates the same task record.

Recommended daily practice is to open the existing Tasks list first, complete due calls and outreach, then return to CRM to record the outcome and advance the opportunity if appropriate.

## 8. Communication matching and email behavior

The CRM does not directly send, delete, or modify email. It reviews communication records already ingested by the application's Outlook, Teams, and Fireflies source pipelines.

The daily matching job:

1. reads recent eligible communication metadata;
2. excludes private, restricted, and leadership-only sources;
3. compares an exact business email domain or a company-name signal with enrolled CRM companies;
4. creates a pending suggestion with a confidence score;
5. waits for a user to accept or reject the suggestion.

Accepted suggestions become CRM activity. Rejected suggestions remain feedback for future matching review. Source systems remain read-only through this process.

## 9. AI status

The current release includes automated, confidence-based communication matching and a review queue. It is deterministic and human-approved. It does not autonomously send messages, change deals, or complete tasks.

A generative CRM assistant can be added later using the application's existing AI framework, but it should remain permission-aware, source-cited, and confirmation-gated for any write action.

## 10. Documents

A deal can link to an existing document record. Linking does not copy the file or change its source permissions. Removing the CRM link does not delete the underlying document.

## 11. Won-deal project conversion

For a won deal without a project:

1. Select **Create project**.
2. The CRM calls the existing project creation workflow with an idempotency key.
3. The new project is linked to the deal.
4. The conversion is recorded as waiting for ERP reconciliation.
5. The scheduled CRM health job checks the linked project.
6. When the project has an Acumatica project identifier, the conversion is marked synchronized.

The CRM never fabricates an Acumatica success state. If project creation or reconciliation fails, the recorded attempt remains available for diagnosis and retry.

## 12. Archive and recovery behavior

Archiving is reversible and requires a reason. Open dependencies may prevent an account or deal from being archived. Project links require an explicit removal reason. Archived relationships and deals can be restored.

Failures are shown with the returned cause. If an action fails, refresh the page, confirm permissions and current record state, then retry. The application does not display a success message until the server confirms the write.

## 13. Suggested daily operating rhythm

1. Review **Tasks** for due and overdue CRM follow-ups.
2. Open **CRM > Relationships** and filter for Attention or Watch.
3. Complete outreach and log the result.
4. Review **CRM > Matching** and accept or reject communication suggestions.
5. Open **CRM > Pipeline** and advance opportunities whose next step is complete.
6. Review won deals that are ready for project creation.
7. Use **CRM > Settings** only when operating thresholds or matching rules need administrative adjustment.

## 14. Data ownership summary

| Record | System of record |
| --- | --- |
| Company identity and ERP company data | Company Directory / ERP integration |
| CRM lifecycle, owner, health, deals, and activity | CRM tables |
| Follow-up work | Existing Tasks system |
| Files and source permissions | Existing document system |
| Created project | Existing Projects system |
| Acumatica synchronization state | Existing project integration and CRM conversion record |
| Outlook, Teams, and Fireflies content | Existing source-ingestion pipelines; CRM reads eligible metadata only |
