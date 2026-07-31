# Negative-path proof

Status: PASS

Command:

```bash
ALLEATO_ENV_FILE=/home/friday/code/project-management/.env \
  node scripts/database/verify-alleato-brain-operational-scope.mjs --negative-path
```

Observed result:

- The exact `project_attribution_rules_active_typed_target` constraint rejected
  an active rule with both targets and an active rule with neither target.
- A valid Business Area-only rule persisted inside the test transaction.
- A synthetic authenticated nonmember could not read Finance files, meetings,
  tasks, migration runs, or migration items.
- The same principal could read unrestricted Business Area fixtures.
- Anonymous file, meeting, and task reads failed with insufficient privilege.
- The entire fixture transaction rolled back.

The first task fixture attempts failed loudly before the authorization assertions
because the production task-quality trigger requires a title and disallows raw
Fireflies-style inserts without extraction provenance. The fixture was corrected
to use explicit imperative titles and a synthetic non-AI source; no production
guardrail was weakened.
