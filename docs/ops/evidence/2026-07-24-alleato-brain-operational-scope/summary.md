# Alleato Brain operational-scope verification

Phase 1B is live in PM APP and the Supabase migration ledger contains
`20260724061000_add_business_area_operational_scope`.

The live verifier passed exact column, nullability, foreign-key, check
constraint, partial-index, policy, policy-role, policy-mode, `WITH CHECK`, and
table-ACL assertions. It found zero invalid active rule targets, zero orphan
Business Area scopes, and zero mapped-scope mismatches.

The rolled-back negative path proved that restricted Finance records and both
migration-ledger tables are hidden from a synthetic authenticated nonmember,
while unrestricted records remain visible. Anonymous operational reads are
revoked.

The generated type contract includes both migration ledgers, the four new
Business Area scope columns, and nullable legacy project targets. The live
generator also exposed unrelated schema drift: it omitted the legacy
`prospects` relation even though active application routes still reference it.
The last generated `prospects` shape is retained with an explicit compatibility
comment; retiring or restoring that feature is outside this migration.

The first verifier request received a transient Supabase Management API HTTP
502 at 2026-07-24 06:34 UTC. An unchanged retry passed immediately. This is
preserved as provider availability evidence rather than misclassified as a
schema failure.

Phase 2 remains intentionally gated: no branch owner or Finance membership will
be invented. The exact live source counts are 347 meetings, 258 tasks, and 57
attribution rules on mapped legacy projects; `public.files` currently has zero
mapped rows.
