# Production Verification: APP-01 Return to Draft

Verified: 2026-07-30 (America/Indianapolis)

Production source:

- Git commit: `5de6d94ea363bc0ea99b532efd2e157fdf602d30`
- Vercel deployment: `dpl_4zyjstrXMwpsHxBAB5WiQawpQMDN`
- Production alias: `https://projects.alleatogroup.com`

Authenticated browser flow:

1. Opened APP-01 for Aviata at Bradenton while its status was **Under Review** and its ERP Link was **Not linked**.
2. Confirmed **Actions > Return to Draft & Edit** was visible.
3. Selected the action.
4. Confirmed the status changed to **Draft**, the Summary editor opened with Cancel and Save controls, and a success notification appeared.
5. Opened the Detail tab and confirmed **Edit SOV** exposed the guarded SOV editing controls.
6. Made no field-value changes and saved no edits.

Database readback:

- Invoice ID: `8268`
- Invoice number: `APP-01`
- Status: `draft`
- All four Acumatica sync markers remain empty.
- Latest `status.changed` audit event records `under_review` to `draft`.
- Both the authenticated actor user ID and actor email were recorded by the database trigger.

Artifacts:

- `01-under-review-action.png`
- `02-draft-editable.png`
- `03-draft-sov-editable.png`
