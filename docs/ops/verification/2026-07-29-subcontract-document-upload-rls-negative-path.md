# Negative-Path Verification

- Anonymous identity: `user_can_access_entity('commitment', SC-001)` returned `false`.
- Authenticated identity with no person/project membership: returned `false`.
- Policies apply only to `authenticated`; no anonymous policy or permissive fallback was added.
- Unknown `subcontract` discriminator remains unsupported and was removed from the junction policies rather than added as a broad new helper branch.

Result: PASS. The fix restores project-member access without widening the authorization boundary.
