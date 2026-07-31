/**
 * Regression tests for the FM Global form <-> database vocabulary mapping.
 *
 * These exist because the production form returned no sprinkler matches for nine
 * months: it passed the Zod label "Shuttle" to a column storing "shuttle". The RPC
 * filters on exact equality, so the mismatch produced an empty result rather than
 * an error, and nothing failed loudly enough to notice.
 *
 * The contract these lock down: every value the public schema can emit maps to a
 * DB token that exists in the corpus, or to null (no filter) -- never to a
 * label-cased string that silently matches nothing.
 */

import {
  ASRS_TYPES_WITH_DATA,
  isUnsupportedAsrsType,
  toDbAsrsType,
  toDbSystemType,
} from "./fm-global-vocabulary";
import { fmGlobalSpecInputSchema } from "./fm-global-schemas";

// The DB vocabulary, verified against the ASRS project on 2026-07-20.
// If a migration changes these, this list must change with it.
const DB_ASRS_TYPES = ["shuttle", "mini_load", "top_loading"];
const DB_SYSTEM_TYPES = ["wet", "dry", "wet_or_dry", "both"];

describe("FM Global vocabulary mapping", () => {
  describe("asrs_type", () => {
    it("maps every form label to lowercase snake_case, never the label itself", () => {
      // The exact bug: "Shuttle" reaching the DB unchanged.
      expect(toDbAsrsType("Shuttle")).toBe("shuttle");
      expect(toDbAsrsType("Mini-Load")).toBe("mini_load");
      expect(toDbAsrsType("Top-Loading")).toBe("top_loading");
    });

    it("maps All to null so the RPC applies no filter", () => {
      expect(toDbAsrsType("All")).toBeNull();
    });

    it("never emits a value containing uppercase or hyphens", () => {
      const labels = [
        "Shuttle",
        "Mini-Load",
        "Top-Loading",
        "Vertically-Enclosed",
        "All",
      ] as const;

      for (const label of labels) {
        const mapped = toDbAsrsType(label);
        if (mapped !== null) {
          expect(mapped).toBe(mapped.toLowerCase());
          expect(mapped).not.toContain("-");
        }
      }
    });

    it("flags ASRS types with no corpus data instead of silently widening", () => {
      expect(isUnsupportedAsrsType("Vertically-Enclosed")).toBe(true);
      expect(isUnsupportedAsrsType("Shuttle")).toBe(false);
      // All means "no filter", not "unsupported".
      expect(isUnsupportedAsrsType("All")).toBe(false);
    });

    it("only claims data exists for types actually present in the corpus", () => {
      expect([...ASRS_TYPES_WITH_DATA].sort()).toEqual([...DB_ASRS_TYPES].sort());
    });
  });

  describe("system_type", () => {
    it("maps both to null (no filter), NOT to the corpus token wet_or_dry", () => {
      // These mean opposite things. As a form answer "both" is the user saying
      // "either system works for me" -- wet, dry, and dual-system tables should all
      // match. As a column value 'wet_or_dry' is a table saying "I cover either",
      // and filtering on it excludes every wet-only and dry-only table.
      // Mapping it that way made Shuttle + "both" return 0 while Shuttle + "wet"
      // returned 143.
      expect(toDbSystemType("both")).toBeNull();
    });

    it("passes through the values the corpus already stores verbatim", () => {
      expect(toDbSystemType("wet")).toBe("wet");
      expect(toDbSystemType("dry")).toBe("dry");
    });
  });

  describe("schema contract coverage", () => {
    it("maps every asrs_type the public schema accepts", () => {
      // Guards against an enum gaining a member without a mapping, which would
      // reintroduce the silent-no-match failure for that value.
      const shape = fmGlobalSpecInputSchema.shape.asrs_type;
      const options = shape.options as readonly string[];

      for (const option of options) {
        const mapped = toDbAsrsType(
          option as Parameters<typeof toDbAsrsType>[0],
        );
        // undefined means "no mapping entry"; null is a deliberate no-filter.
        expect(mapped).not.toBeUndefined();
      }
    });

    it("maps every system_type the public schema accepts", () => {
      const shape = fmGlobalSpecInputSchema.shape.system_type;
      const options = shape.options as readonly string[];

      for (const option of options) {
        const mapped = toDbSystemType(
          option as Parameters<typeof toDbSystemType>[0],
        );
        // undefined means "no mapping entry"; null is a deliberate no-filter.
        expect(mapped).not.toBeUndefined();
        if (mapped !== null) {
          expect(mapped).toBe(mapped.toLowerCase());
        }
      }
    });

    it("maps the constraining system types onto tokens the corpus contains", () => {
      // 'both' is excluded deliberately -- it is a no-filter, not a token.
      // preaction is knowingly absent from the corpus.
      for (const option of ["wet", "dry"] as const) {
        expect(DB_SYSTEM_TYPES).toContain(toDbSystemType(option));
      }
    });
  });
});
