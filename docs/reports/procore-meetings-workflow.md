# Procore Research: Meetings Tool (creation, templates, agenda, minutes)

**Date:** 2026-07-01
**Question:** Meeting creation fields, meeting templates, agenda categories/items, statuses (draft/agenda/minutes), convert to minutes, item numbering — ground truth before building the Meetings tool.
**Sources used:** Tier 1 (RAG) + Tier 3 (WebFetch). No Tier 2 manifest exists for meetings (not in the crawled tool list).

## Findings

### Meeting lifecycle — modes, not free-form statuses
- A meeting is created in **Agenda mode** automatically. In agenda mode you set up details, categories, and items.
- **Convert a Meeting from Agenda to Minutes Mode** is the top-level action (the orange "Convert to Minutes" CTA). In minutes mode you record official minutes per item.
- **Revert a Meeting from Minutes to Agenda Mode** exists — the conversion must be reversible.
- **Draft Meeting** is a separate boolean on the create form (preliminary/unpublished), orthogonal to agenda/minutes mode. The list view renders these as `Draft`, `Awaiting Minutes` (agenda mode, published), and `Minutes`.
- After converting to minutes, minutes are **distributed by email** to the people/distribution groups in the meeting's "Scheduled Attendees" list. Redistribution is supported.

### Create Meeting form — exact fields (from tutorial)
Meeting #, Meeting Name, Meeting Link, Private Meeting (bool), Draft Meeting (bool), Meeting Date, Timezone, Start Time, End Time, Meeting Location, Overview (rich text), Attachments, Add Attendees.
- If no Start/End Time selected, Procore defaults both to 12:00 AM.
- Attendees must have Read Only+ permission on the Meetings tool to appear in the picker.
- Attachment sources: computer, Photos, Drawings, Forms, Documents.
- Create flow: "+ Create Meeting" → choose "+ New" or a template → fill fields → "Create and Proceed to Agenda".

### Automatic behaviors
- Procore auto-adds one category named **"Uncategorized Items"** to every new meeting; it can be renamed inline.
- Items carry a **Meeting Origin** column reflecting the meeting in which the item was first created (carryover tracking across a recurring series).
- Agenda items are auto-numbered by category position: 1.1, 1.2, 2.1, …

### Meeting items (agenda items)
- Fields: Title, Description, Priority (Low/Medium/High), Attachments, Category, plus assignee/due date/status in the item table. Items can be edited at any time in either agenda or minutes mode.
- Granular permission "Manage Meeting Items" allows non-admins to add/edit items.

### Company-level meeting templates (Admin tool)
- Template fields: **Meeting Name (required), Private Meeting, Overview, Attachments** + pre-populated **Categories** (name; default "1-Uncategorized Items") each containing **Items** (Agenda #, Title, Description, Priority Low/Medium/High, Attachments, Category).
- Templates must NOT contain project-specific info — they are offered across all company projects.
- Saved templates appear as a **dropdown selection** in the project Meetings tool create flow ("New Meeting: No Template" → select template).
- Editing a company template only affects **new** meetings created from it afterward.
- Requires Admin on the company Admin tool.

### Permissions
- Read Only+ to view/configure list view; Admin (or Read Only+ with "Manage Meeting Items" granular permission) to add/edit items; Admin to convert/record minutes.

## Sources
- https://v2.support.procore.com/product-manuals/meetings-project/tutorials/create-a-meeting
- https://v2.support.procore.com/product-manuals/admin-company/tutorials/create-a-meeting-template
- https://v2.support.procore.com/product-manuals/meetings-project/tutorials/create-a-meeting-from-a-template
- https://v2.support.procore.com/product-manuals/meetings-project/tutorials/add-a-meeting-item
- https://v2.support.procore.com/product-manuals/meetings-project/tutorials/convert-a-meeting-to-minutes-mode
- https://v2.support.procore.com/product-manuals/meetings-project/tutorials/revert-a-meeting-from-minutes-to-agenda-mode
- https://v2.support.procore.com/product-manuals/meetings-project/tutorials/add-meeting-minutes
- https://v2.support.procore.com/product-manuals/meetings-project/tutorials/distribute-and-redistribute-meeting-minutes
