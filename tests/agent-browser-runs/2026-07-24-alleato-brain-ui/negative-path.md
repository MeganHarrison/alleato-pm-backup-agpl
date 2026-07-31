# Alleato Brain UI negative paths

- The route calls `loadBusinessAreaAccess` before
  `loadBrainResourcePage`; a focused route test proves a denied Finance branch
  never queries content.
- Every Brain route calls `current_is_active_internal_employee` after
  authentication and before branch queries. RPC failure raises
  `BrainDataError`; a false result redirects to
  `/access-denied?reason=brain-internal-only`.
- Authenticated browser proof shows an existing external contact redirected
  from `/brain`, and an existing internal Finance nonmember receiving the
  route-owned denial without content rows or resource tabs.
- Administrator and exact Business Area membership RPC errors raise
  `BrainDataError` rather than silently granting access.
- Live migration verifier `20260724100000` proves Business Area documents deny
  external CRUD and Finance nonmember/inactive-member access while preserving
  active-member and app-admin authorization.
- Direct source targets reject `javascript:`, protocol-relative, and malformed
  URLs.
- The signed source endpoint returns 404 for RLS-hidden documents and non-HTTP
  source URLs.
- Invalid or missing Business Area upload scope is rejected before Storage is
  mutated; a failed metadata insert removes the uploaded object.
