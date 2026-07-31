# Production Deployment Receipt

Date: 2026-07-23

## Publication

- Source commit: `c6756d1ebd8cf8a87a0192c3d4bc657350ad2931`
- Source branch: `origin/main`
- Vercel project: `project-management-agent`
- Deployment: `dpl_96QFMtGAujJH2GMefd6RXweSbjJL`
- Deployment URL:
  `https://project-management-agent-399sm9y6u-the-alleato-group.vercel.app`
- Production alias: `https://projects.alleatogroup.com`
- Read-back: deployment `READY`; the production alias resolved to the same
  deployment ID.

## No-write production proof

The production assistant was exercised with a synthetic PNG containing:

- `ALPHA-001 | Safety Review | 2,345`
- `BETA-002 | Permit Fees | 78`
- `IMAGE_CHAIN_723`

The first response reproduced both rows and the token. A same-conversation
follow-up using the observed failure wording, without re-uploading the image,
reproduced the same rows and token again.

Persisted response metadata recorded:

- `retrieval_plan.reason: user_attachments_present`
- initial intent: `general_conversation`
- follow-up intent: `financial_analysis`
- `finish_reason: stop`
- `stream_error: null`
- response-quality reason: `no successful tool calls`

The only trace entries were read-only MCP capability-discovery calls. No project
was selected, no Prime Contract tool was called, no confirmation was issued,
and no financial record was changed.

## Evidence

- Screenshot: `production-live-followup.png`
- Synthetic conversation:
  `5c6049c7-ba7d-4314-8774-403699bed207`

The screenshot was captured after a canonical message reload and visibly shows
the initial image answer and the attachment-aware follow-up answer.
