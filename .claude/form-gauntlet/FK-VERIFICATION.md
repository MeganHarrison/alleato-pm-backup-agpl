# FK Dropdown Pre-fill Verification

Independent verification of whether EDIT forms pre-fill their FK-backed dropdowns with the saved value (vs. an empty "Select…" placeholder). Verified via agent-browser against http://localhost:3001, with DB cross-checks against project `lgveqfnpkxvzbnnwuled`.

| Suspect | Verdict | Evidence |
|---------|---------|----------|
| 1. Change-Events line-item Vendor + Budget Code | **MET** | Project 67 had only an empty test line item (vendor/budget/commitment all NULL in DB), so used a fully-populated record: CE `7ddf2da3` (proj 1034), line item `d831ea6b`. Edit Line Item dialog pre-filled Budget Code = "09-6200.S – Specialty Flooring – Subcontract", Vendor = "L&R Flooring, LLC", Commitment = "SC-001 - 09-Flooring & Tile". All three FK dropdowns showed saved values. /tmp/fk-verify-1.png |
| 2. Submittals Responsible Contractor | **NOT MET** | No submittal in the entire DB has `responsible_contractor_id` set. Actively tested: opened edit (submittal `9585c5a9`, proj 67), selected "Hillsdale Holdings", clicked Update Submittal → DB still NULL, `updated_at` unchanged. Root cause confirmed in `frontend/src/app/api/projects/[projectId]/submittals/[submittalId]/route.ts:26` — schema is `responsible_contractor_id: z.coerce.number().int()` but the column is UUID and the form sends a UUID company id; coercion to number yields NaN so the value is silently dropped. WRITE path broken → field can never persist or pre-fill. /tmp/fk-verify-2.png |
| 3. Commitments Purchase Order Vendor | **MET** | PO `000080` (id `b0a197d8`, proj 67), `contract_company_id` set. "Edit Purchase Order" form pre-filled Contract Company = "Steel Services, Inc." /tmp/fk-verify-3.png |
| 4. Prime-Contracts SOV line Budget Code | **MET** | No existing SOV line had a budget code, so actively tested: added a SOV line on PC-TEST-001 (id `66626f40`, proj 67), set Budget Code = "01-3120.O – Vice President – Other", saved, then **full page reload** → SOV line re-fetched from server and the Budget Code dropdown pre-filled the saved value correctly. Test line removed afterward. /tmp/fk-verify-4.png |

## Bug found (Suspect 2)
`updateSubmittalSchema.responsible_contractor_id: z.coerce.number().int().nullable().optional()` in
`frontend/src/app/api/projects/[projectId]/submittals/[submittalId]/route.ts:26`.
Column type is UUID. `z.coerce.number()` on a UUID → NaN → field dropped. The same coercion exists in the lookup at line 117 (`.eq("id", String(data.responsible_contractor_id))`). Fix: change schema to `z.string().uuid()`. This is the classic FK/type-mismatch class and is invisible at creation (silently saves nothing) and on edit.
