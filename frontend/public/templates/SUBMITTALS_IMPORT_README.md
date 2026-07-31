# Submittals Import Template

Use `submittals-import-template.xlsx` or `submittals-import-template.csv` to
prepare bulk submittal rows for import.

## Required Columns

- `submittal_number` - unique with `revision` inside a project.
- `revision` - use `0` for the first issue.
- `title` - short submittal title.
- `status` - one of `Draft`, `Open`, `Distributed`, or `Closed`.

## Recommended Columns

- `submittal_type` - canonical type such as `Product Information`, `Product Manual`, `Drawings`, `Material Samples`, `Specification`, or `Other`.
- `specification_section` - CSI section code/name, for example `03 30 00 Cast-in-Place Concrete`.
- `division` - CSI division label, for example `03 - Concrete`.
- `final_due_date` - `YYYY-MM-DD`.
- `lead_time_days` and `required_on_site_date` - when `final_due_date` is blank, an importer can compute the due date from these two values.
- `responsible_contractor_name`, `received_from_name`, and `submittal_manager_email` - human-readable resolver inputs.

## Optional Import Helpers

- `external_source_id` can be used for idempotent re-imports from another system.
- `attachment_file_names` is a semicolon-separated list of expected attachment filenames.
- `initial_workflow_steps` uses `email|role|required` entries separated by semicolons.
  Example: `reviewer@example.com|Reviewer|TRUE; architect@example.com|Approver|TRUE`

## Failure-Loudly Rules For The Importer

The importer should reject rows with exact row/column errors for:

- Missing required values.
- Invalid date formats.
- Duplicate `submittal_number` + `revision` pairs in the file or project.
- Unknown `status`, `submittal_type`, boolean, or priority values.
- Unresolved company, person, user, package, location, or cost-code references.

## Current Gap

These files provide the fillable template only. The app still needs a bulk
upload/import route that validates the completed file, previews row-level
issues, and creates submittals in one transaction-safe workflow.
