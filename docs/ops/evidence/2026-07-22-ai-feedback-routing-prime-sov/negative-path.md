# Negative-path verification

Automated coverage proves the edit tool rejects or stops before mutation when any of the following is true:

- the user lacks project access or `contracts:write`;
- the contract is not draft, is executed, or is private without explicit visibility;
- the budget code is missing, inactive, ambiguous, duplicated, or not linked to the project;
- an amount exceeds database precision or bounds;
- the confirmation omits the exact preview token or changes the previewed payload;
- the contract or SOV state changes between preview and confirmation;
- the audit/idempotency reservation fails;
- a delete is requested or an omitted row would otherwise be interpreted as deletion.

The authenticated production check submitted preview wording only. It did not approve or confirm the proposed $5,000 to $5,100 change.
