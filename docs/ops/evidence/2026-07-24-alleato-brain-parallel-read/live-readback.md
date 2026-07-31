# Live readback

## Migration

- Version: `20260724090000`
- Compile against linked database: PASS, transaction rolled back.
- Exact application: PASS.
- Remote ledger verification: PASS.

## Authorization fixture

Command:

```text
ALLEATO_ENV_FILE=/home/friday/code/project-management/.env node scripts/database/verify-alleato-brain-parallel-read.mjs
```

Observed result:

```text
Alleato Brain parallel-read verifier passed: policy/helper contracts match; a rolled-back active internal Finance project member could read unrestricted legacy rows, could not read Finance or mismatched rows, and lost company-wide access when changed to an external contact.
```

The fixture data and temporary membership were rolled back.
