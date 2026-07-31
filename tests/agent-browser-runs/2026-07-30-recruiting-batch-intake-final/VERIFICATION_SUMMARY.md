# ALL-44 authenticated verification summary

Status: PASS

Route: `http://localhost:3000/recruiting`

Viewport coverage:

- Desktop: 1440x1000
- Mobile: 390x844

Verified:

- Two approved synthetic resumes uploaded in one batch.
- Both filenames and individual success results were visible.
- Replaying the identical batch key returned the same candidate IDs.
- The original PDF opened through a short-lived signed URL without a forced
  download parameter.
- One unassigned resume was assigned to the UAT requisition.
- The assigned application was marked Not Qualified with a required,
  human-entered reason.
- A direct Not Qualified table update was rejected; the final browser outcome
  succeeded through the audited disposition RPC.
- Focused storage recovery tests proved that a committed database record with
  a missing object is repaired on retry.
- The mobile inbox had no document-level horizontal overflow.
- Both synthetic records and storage objects were removed through the
  supported cleanup API.
- Final database readback showed zero remaining final-run candidates or
  submissions, five cleanup audit rows, five rate attempts, and zero stale
  app-admin recruiting-role snapshots.

Evidence:

- actions log
- database readback
- desktop resume inbox screenshot
- desktop Not Qualified screenshot
- mobile resume inbox screenshot
- final browser video

Local-only console noise from the optional feedback toolbar health probe and
the unrelated project-list backend was excluded from the recruiting assertion.
No recruiting API or page error remained in the final workflow.
