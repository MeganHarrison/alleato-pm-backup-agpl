## Guardrail Checklist

- [ ] Root cause is stated clearly.
- [ ] Detection gap is documented.
- [ ] Prevention step is documented.
- [ ] The fix avoids silent failures and generic errors.
- [ ] At least one recurrence guardrail was added.
- [ ] `docs/ops/memory/current-state.md` updated for status/scope changes.
- [ ] Weekly progress entry added in `docs/ops/logs/`.
- [ ] Repeated-issue fixes recorded in `docs/ops/lessons/recurring-failures.md` (if applicable).

## Validation

- [x] `pnpm --dir frontend run quality`
- [x] `pnpm run check:routes`
