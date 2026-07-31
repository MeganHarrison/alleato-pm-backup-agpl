# Authenticated production readback

Route: `/1144/prime-contracts/aac4b9dd-4a8b-4e91-b1bf-19fa01bc0037`

## Feedback routing

- Prompt: `Yes please log it as a feature that is missed and have it fixed.`
- Result: Alleato AI ran the feature-request workflow and returned `Logged.` with a Nexcom feature-request packet.
- Negative assertion: The response did not return the unrelated Nexcom operating briefing.
- Evidence: `feedback-routing-preview.png`.

## Prime Contract SOV preview

- Initial prompt: `Preview changing cost code 01-3120 on this Prime Contract SOV from $5,000 to $5,100. Do not apply it.`
- Initial result: Production returned the project briefing because the intent matcher accepted `change` but not the preview-scoped gerund `changing`.
- Corrective action: Added a preview-scoped gerund route plus read-only change-order regressions in commit `8cb8cc71994fd59b7acf9ceff0f716ea6355d795`.
- Safe-disambiguation readback: An imperative preview request invoked `Edit Prime Contract Sov` and correctly refused the ambiguous `01-3120` code until a cost type or exact project budget-code ID was supplied.
- Final prompt: `Preview changing cost code 01-3120 with cost type Labor on this Prime Contract SOV from $5,000 to $5,100. Do not apply it.`
- Final result: PASS on production deployment `23188d0b7787bd02b2a84a8a94d9cd10491d5156`. The tool trace showed `Get Project Details` and `Edit Prime Contract Sov Completed`; the response previewed row action `update`, cost code `01-3120`, cost type `Labor`, description `Vice President`, row amount `$5,100`, and SOV total `$47,550 -> $47,650`.
- Confirmation boundary: The assistant said nothing had been applied and offered to apply the exact preview only after confirmation.
- Safety boundary: No confirmation was submitted. The SOV page still displayed the `01-3120 / Labor` row at `$5,000.00` beside the preview.
- Evidence: `prime-contract-sov-preview.png`.
