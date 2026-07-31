# ADR-0001: CRM-native lead identity

Status: Accepted

Date: 2026-07-30

## Context

The CRM originally treated `companies` as the identity for every relationship.
That works for existing customers and vendors, but a sales lead often predates any
Acumatica record. Creating a placeholder `companies` row would leak prospects into
project, vendor, accounting, and directory selectors.

## Decision

Create a dedicated `crm_leads` aggregate for pre-customer relationships. Deals,
activities, and CRM follow-up tasks may reference either one CRM lead or one existing
company-backed CRM account. Database constraints enforce exactly one relationship
target for deals and activities.

A lead may later link to a real `companies` row through an explicit conversion
workflow. Lead creation itself never creates or mutates a company record.

## Consequences

- Sales can record a prospect before Acumatica knows about it.
- Existing company-backed CRM accounts remain compatible.
- Shared tasks continue to power calls and follow-ups.
- Project conversion must reject an unlinked lead with an actionable message.
- Queries and UI labels must describe the broader concept as a relationship, not
  assume every row is a company.
