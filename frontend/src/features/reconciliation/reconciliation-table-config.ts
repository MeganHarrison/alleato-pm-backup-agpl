import type { FilterConfig } from "@/components/tables/unified";
import type { FindingKind, FindingTier } from "@/lib/accounting/reconciliation";

export const tierLabels: Record<FindingTier, string> = {
  HIGH: "High",
  MED: "Medium",
  INFO: "Info",
};

export const kindLabels: Record<FindingKind, string> = {
  "unlinked-budget-line": "Unlinked budget line",
  "drift-budget-line": "Post-sync drift",
  "value-mismatch-actuals": "Value mismatch",
  "unlinked-cco": "Unlinked commitment CO",
  "unlinked-pcco": "Unlinked prime CO",
  "underwater-budget": "Underwater budget",
  "thin-margin": "Thin margin",
  "billed-over-contract": "Billed over contract",
  "duplicate-ap-bill": "Duplicate bill",
  "stale-on-hold-bill": "On-hold bill",
};

/** Plain-English explanation of what each finding type means and why it matters. */
export const kindMeaning: Record<FindingKind, string> = {
  "unlinked-budget-line":
    "This budget line exists in Job Planner but was never pushed to Acumatica. Acumatica has no record of it, so its cost is missing from the financials.",
  "drift-budget-line":
    "This budget line was edited in Job Planner after the last time it synced to Acumatica. Acumatica is showing an outdated value until it re-syncs.",
  "value-mismatch-actuals":
    "The actual cost in Job Planner differs from the amount Acumatica last received. One of the two systems is wrong. Medium confidence — this compares against Job Planner's snapshot of Acumatica, so confirm the live Acumatica value before acting.",
  "unlinked-cco":
    "This commitment (subcontract) change order exists in Job Planner with no link to Acumatica, so the change in committed cost is not reflected in the books.",
  "unlinked-pcco":
    "This prime-contract change order exists in Job Planner with no link to Acumatica, so the change in contract revenue is not reflected in the books.",
  "underwater-budget":
    "Budgeted cost exceeds the revised budget — the job is projected to spend more than it is budgeted to.",
  "thin-margin":
    "Projected profit is under 3% of the contract value.",
  "billed-over-contract":
    "Billed-to-date exceeds the contract amount — the project has billed more than the contract allows.",
  "duplicate-ap-bill":
    "The same vendor was billed the same amount on the same job more than once — likely a duplicate billing that inflates AP, cash flow, and the retainage report. Reference numbers differ because Job Planner regenerates them, so they're matched by vendor + amount + project.",
  "stale-on-hold-bill":
    "A subcontractor bill synced from Job Planner but never reviewed/released in Acumatica. The on-hold pile hides real costs and possible duplicates from cash flow until it's worked down.",
};

export const reconciliationFilters: FilterConfig[] = [
  {
    id: "tier",
    label: "Confidence",
    type: "select",
    options: [
      { value: "HIGH", label: "High" },
      { value: "MED", label: "Medium" },
      { value: "INFO", label: "Info" },
    ],
  },
  {
    id: "kind",
    label: "Finding type",
    type: "select",
    options: (Object.keys(kindLabels) as FindingKind[]).map((value) => ({
      value,
      label: kindLabels[value],
    })),
  },
];
