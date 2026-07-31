# Create a Change Event

Document a potential scope, cost, or schedule change as a change event with priced line items, recording the workflow as screenshots, Markdown, and manifest data.

## Before You Start

- Use the captured Alleato change-event form as the source of truth for the step order and visible fields.
- Confirm the change event is complete enough for pricing review before saving it in Open status.
- Attach only supporting records that help explain scope, cost, or schedule impact for this change.

## Steps

### Step 1: Open the new change event form

Select the project, open Change Events from the sidebar, and start a new change event to open the Create Change Event form.

![Open the new change event form](screenshots/01-open-the-new-change-event-form.png)

Expected result: The Create Change Event form opens.

### Step 2: Fill in the general information

Under General Information, leave Number to auto-generate (or set it), then enter a Title and Description that clearly identify the change. Set the Type, Change Reason, and Scope.

![Fill in the general information](screenshots/02-fill-in-the-general-information.png)

Expected result: The change event is identified with a title, description, type, reason, and scope.

### Step 3: Set the origin

Choose the Origin and, if applicable, the Origin Record to tie the change event back to its source (for example a related record).

![Set the origin](screenshots/03-set-the-origin.png)

Expected result: The change event records where the change originated.

### Step 4: Set revenue handling

Set Expecting Revenue and, when revenue is expected, the Line Item Revenue Source. If you are using markup, set the Prime Contract (markup basis) so markup is calculated against the right contract.

![Set revenue handling](screenshots/04-set-revenue-handling.png)

Expected result: Revenue handling and markup basis are configured for the line items.

### Step 5: Add cost line items

In the Line Items section, add a row for each change. Select the Budget Code, enter a Description, and enter the quantity and unit cost (and revenue values where applicable).

![Add cost line items](screenshots/05-add-cost-line-items.png)

Expected result: Each line item has a budget code and pricing, and the total estimated value rolls up to the change event header.

### Step 6: Attach supporting documents

In the Attachments section, upload supporting files such as drawings, RFIs, or photos.

![Attach supporting documents](screenshots/06-attach-supporting-documents.png)

Expected result: Supporting documents are attached to the change event.

### Step 7: Save the change event

Select Create Change Event to save. The change event is created in Open status, ready for pricing review and approval. Tutorial runs default to preview mode unless submitWorkflow is true.

![Save the change event](screenshots/07-save-the-change-event.png)

Expected result: The completed draft is ready to save without creating demo data.

## Quality Check

- Confirm the final state in the app matches the expected result for each step.
- Remove any environment-specific or seeded-data references before publishing.
