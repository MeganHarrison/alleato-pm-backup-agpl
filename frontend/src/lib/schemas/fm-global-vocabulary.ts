/**
 * Vocabulary mapping between the FM Global public form contract and the database.
 *
 * The public form and its Zod schema speak human labels ("Shuttle", "Mini-Load",
 * "both"). `fm_global_tables` stores machine tokens ("shuttle", "mini_load",
 * "wet_or_dry"). `find_sprinkler_requirements` filters on exact equality, so any
 * unmapped value silently matches nothing -- no error, just an empty result.
 *
 * That is precisely what happened in production: from 2025-09 to 2026-05 the form
 * collected 19 submissions and returned a match on 3, because every lookup passed
 * "Shuttle" against rows storing "shuttle". Route every DB-bound value through here.
 *
 * Verified against the ASRS project 2026-07-20 -- the DB vocabulary is:
 *   asrs_type   : shuttle | mini_load | top_loading
 *   system_type : wet | dry | wet_or_dry | both
 */

import type { FmGlobalSpecInput } from "@/types/fm-global";

/**
 * ASRS type: form label -> DB token.
 *
 * `All` maps to null, which the RPC treats as "no filter on this column".
 *
 * `Vertically-Enclosed` has no corresponding rows in the corpus today. It maps to
 * its token form rather than null so the query stays honest and returns nothing,
 * instead of silently widening to every ASRS type and handing back matches for
 * hardware the user did not ask about.
 */
const ASRS_TYPE_TO_DB = {
  Shuttle: "shuttle",
  "Mini-Load": "mini_load",
  "Top-Loading": "top_loading",
  "Vertically-Enclosed": "vertically_enclosed",
  All: null,
} as const satisfies Record<FmGlobalSpecInput["asrs_type"], string | null>;

/**
 * System type: form label -> DB token.
 *
 * `both` maps to null (no filter), NOT to the corpus token `wet_or_dry`. The two mean
 * different things and conflating them returns nothing:
 *   - as a form answer, "both" is the USER saying "either system works for me", so the
 *     result should include wet tables AND dry tables AND dual-system tables;
 *   - as a column value, `wet_or_dry` is a TABLE saying "I cover either system".
 * Filtering on `system_type = 'wet_or_dry'` therefore excludes every wet-only and
 * dry-only table -- e.g. Shuttle + "both" returned 0 matches while Shuttle + "wet"
 * returned 143. Same shape as `All` for asrs_type: the user is not constraining.
 *
 * `preaction` has no rows in the corpus today; it maps to its token so the query stays
 * honest and returns nothing rather than silently widening.
 */
const SYSTEM_TYPE_TO_DB = {
  wet: "wet",
  dry: "dry",
  preaction: "preaction",
  both: null,
} as const satisfies Record<FmGlobalSpecInput["system_type"], string | null>;

/**
 * Container type: submitted value -> corpus token.
 *
 * container_type is free text on the form (the schema allows "Other -> specify"), so
 * this maps the known shorthands and passes anything else through untouched. Real
 * submissions use "Open-Top"/"Closed-Top"; `fm_global_tables.container_type` spells
 * the same things "Open-Top Combustible"/"Closed-Top Combustible".
 */
const CONTAINER_TYPE_TO_DB: Record<string, string> = {
  "Open-Top": "Open-Top Combustible",
  "Closed-Top": "Closed-Top Combustible",
  // Already-canonical values map to themselves so double-mapping is safe.
  "Open-Top Combustible": "Open-Top Combustible",
  "Closed-Top Combustible": "Closed-Top Combustible",
  "Direct on Rails": "Direct on Rails",
};

/**
 * Map a submitted container type onto the corpus vocabulary.
 * Unknown values pass through unchanged -- the field is free text by design, and a
 * pass-through matches nothing rather than guessing at the user's intent.
 */
export function toDbContainerType(
  value: string | null | undefined,
): string | undefined {
  if (!value) return undefined;
  return CONTAINER_TYPE_TO_DB[value] ?? value;
}

/** ASRS type values that exist in the corpus. Anything else legitimately returns no matches. */
export const ASRS_TYPES_WITH_DATA: readonly string[] = [
  "shuttle",
  "mini_load",
  "top_loading",
];

export function toDbAsrsType(
  value: FmGlobalSpecInput["asrs_type"],
): string | null {
  return ASRS_TYPE_TO_DB[value];
}

export function toDbSystemType(
  value: FmGlobalSpecInput["system_type"],
): string | null {
  return SYSTEM_TYPE_TO_DB[value];
}

/**
 * True when the mapped ASRS type has no rows in the corpus, so an empty result is
 * expected rather than a fault. Lets the caller tell "nothing matched your specs"
 * apart from "we hold no data for this ASRS type at all".
 */
export function isUnsupportedAsrsType(
  value: FmGlobalSpecInput["asrs_type"],
): boolean {
  const mapped = toDbAsrsType(value);
  return mapped !== null && !ASRS_TYPES_WITH_DATA.includes(mapped);
}
