# Brandon Decision Log: Phase 1 ASRS Estimator

**Domain owner:** Brandon  
**Handoff:** [`2026-07-21-brandon-asrs-estimator-codex-handoff.md`](./2026-07-21-brandon-asrs-estimator-codex-handoff.md)  
**Progress tracker:** [GitHub issue #74](https://github.com/The-Alleato-Group/project-management/issues/74)

**Linear access required:** No

This is the durable source for decisions Brandon makes directly with Codex. Codex must update it as answers are given. Linear may be mirrored later when a configured connector is available, but lack of Linear access must never pause the work.

## Operating rule

Ask Brandon one question at a time. For every answer, record:

- date;
- question;
- Codex recommendation and reason;
- Brandon's answer;
- resulting product/calculation contract change;
- affected implementation or test evidence; and
- whether the answer resolves the milestone or leaves a follow-up.

Do not infer an answer from silence. Do not ask Megan to decide for Brandon.

After every session, Codex must commit and push this log when it changed, then comment on [GitHub issue #74](https://github.com/The-Alleato-Group/project-management/issues/74) with decisions, changes, commit SHA, verification, blockers, remaining work, and the exact next step. A session with no repository changes still requires a tracker comment that says so.

## Milestone 1: Prototype review

**Status:** Awaiting Brandon response on GitHub issue #74

### Decision 1 — Manual configuration completeness

- Question: Does the proposed manual configuration capture the information available when estimating a real ASRS job?
- Codex recommendation: Accept system/rack family, top condition, wet/dry class, protected-run reference/start/end, rack-row count, protected levels, horizontal lines per level, qualifying-flue first station/pitch/count, first protected flue/alternating phase, pipe diameter/schedule/material, usable fabricated-piece length, and joint/end keepout distance as the minimum manual Phase 1 contract. Every field controls rule applicability, coordinate generation, multiplication, or outlet ownership; omitting one would require an invented assumption.
- Brandon's answer:
- Contract change:
- Implementation/test effect:
- Status: Asked 2026-07-22 in GitHub issue #74 comment `5040519553`; awaiting Brandon.

### Decision 2 — Geometry vocabulary

- Question: Are rack row, ASRS level, horizontal sprinkler line, qualifying transverse flue, first protected flue, and protected-run endpoints defined correctly?
- Codex recommendation:
- Brandon's answer:
- Contract change:
- Implementation/test effect:
- Status: Open

### Decision 3 — Multiplication model

- Question: Is an explicit per-line coordinate set multiplied across entered rows, levels, and horizontal lines, or is another dimension required?
- Codex recommendation:
- Brandon's answer:
- Contract change:
- Implementation/test effect:
- Status: Open

### Decision 4 — Spacing explanation

- Question: Does the 2.5 ft every-other-flue pass versus 2.75 ft failure explanation match field practice and the governing reviewed rule?
- Codex recommendation:
- Brandon's answer:
- Contract change:
- Implementation/test effect:
- Status: Open

### Decision 5 — Outlets per fabricated piece

- Question: For the illustrated inputs, is coordinate ownership correct when it produces four outlets per 20 ft piece instead of assuming ten?
- Codex recommendation:
- Brandon's answer:
- Contract change:
- Implementation/test effect:
- Status: Open

### Decision 6 — BOM contents

- Question: Does the proposed BOM contain the required material categories, and which items are geometry-derived versus explicitly manual?
- Codex recommendation:
- Brandon's answer:
- Contract change:
- Implementation/test effect:
- Status: Open

### Decision 7 — Supplier comparison

- Question: Are separate quote scenarios and explicit line-level supplier choices the right comparison model without silently mixing vendors?
- Codex recommendation:
- Brandon's answer:
- Contract change:
- Implementation/test effect:
- Status: Open

### Decision 8 — Result-page journey

- Question: Should evaluation open a dedicated result page, with Edit inputs returning to the preserved manual form?
- Codex recommendation: Yes. The result needs enough room for the calculation chain, BOM, source status, and pricing without turning the input form into a dashboard.
- Brandon's answer:
- Contract change:
- Implementation/test effect:
- Status: Open

### Decision 9 — Blocked-result wording

- Question: What language makes an unreviewed or insufficient-evidence result clear without implying an engineering determination?
- Codex recommendation:
- Brandon's answer:
- Contract change:
- Implementation/test effect:
- Status: Open

## Milestone 2: Implementation sequence and acceptance evidence

**Status:** Blocked until Milestone 1 is accepted

After Milestone 1, Codex records the agreed implementation slices, dependencies, owners, deterministic fixtures, source-review prerequisites, browser evidence, migration evidence, and release criteria here before product implementation begins.

## Final accepted Phase 1 contract changes

None yet. Add only decisions explicitly accepted by Brandon.
