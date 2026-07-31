# T3 (ALL-17) — Regression Test Evidence

Command: `node --test scripts/training/source/__tests__/*.test.mjs`

```
tests 24
suites 0
pass 24
fail 0
cancelled 0
skipped 0
todo 0
```

24 seam-scoped tests covering: `extractWindowAssignedObject` (parsing the
`window.ALLEATO_RESOURCES` browser-global), `mapResourceType` /
`mapResourceLevel` (enum mapping incl. throw-on-unrecognized),
`buildNormalizedLibrary` (slug/name carry-through, DB-shape mapping,
`publishedAt` derivation, count preservation, **dedupe-by-url with
`meta.duplicatesDropped` reporting**, empty-input handling), and
`validateResourceLibrary` (URL uniqueness, topic/role referential
integrity, count-mismatch detection) and `buildSeedMigrationSql`
(transaction shape, embedded enum casts, resolved-not-raw type/level
values, rejects an invalid library instead of emitting broken SQL).

All tests written test-first (red confirmed before each green
implementation), per the `tdd` skill's rules of the loop.
