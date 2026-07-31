# AAI-1150 evidence summary

The security boundary passed in the authenticated running application. A signed approval created exactly one row with the exact signed input; denial and both Ask Alleato write attempts created zero rows. The approved test row was removed by exact id and read back as absent.

The browser failure discovered during verification was caused by a stale split AI SDK runtime: the server used `ai@7.0.31`, while `@ai-sdk/react` resolved `ai@7.0.15`, whose approval response implementation discarded the signature. The checked-in frozen lock resolves both runtimes to `7.0.31`. A predeploy architecture check now fails on any installed runtime mismatch.

Vercel readback confirms `TOOL_APPROVAL_SECRET` exists as an encrypted value in Production, Preview, and Development. No value was printed or stored.

AAI-1264 separately owns removal of the legacy preview-plus-confirm interaction. Workflow is not part of this repair and is not recommended for the interactive Assistant boundary.
