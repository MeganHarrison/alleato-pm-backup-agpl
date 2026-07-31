# Alleato Brain search-scope verification

The AI Database now filters branch searches inside the canonical vector RPC
before candidate limiting. The new filter is the optional eleventh argument,
so all existing positional callers retain their original argument order.

Authorization remains layered:

- the tool scope resolves exact Business Area membership;
- semantic and category callers reject unauthorized or mixed scope;
- the RPC filters exact numeric Business Area metadata;
- application post-filtering rejects mismatched or malformed rows;
- the RPC remains executable only by `service_role`.

The deployment also removed 133 explicit JSON null keys. Those rows were not
branch-labeled; removing the null key preserves their existing project/unscoped
semantics and prevents them from being misclassified as malformed branch data.

The live migration ledger, ACLs, single signature, exact-filter result set,
negative paths, focused tests, changed-file quality checks, and independent
review all pass.
