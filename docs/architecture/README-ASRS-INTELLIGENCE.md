# ASRS Estimator: Phase 1 Functional Direction

## Purpose

Phase 1 is a focused ASRS takeoff and quote-backed estimating tool based on
Brandon's July 20, 2026 instructions. An authorized Alleato project user enters
one uniform ASRS rack-run configuration. The estimator then applies reviewed,
revision-locked FMDS evidence to calculate supported material quantities and
prices those quantities from reviewed supplier quotes.

The estimator must say exactly why a quantity is supported or blocked. It must
never turn vector search, OCR text, an unreviewed figure, or an assumed layout
convention into an engineering calculation.

## Phase 1 workflow

1. Enter one uniform rack-run configuration.
2. Resolve the applicable reviewed FMDS table, figure, and rule card.
3. Generate explicit sprinkler and outlet coordinates.
4. Count heads, outlets, pipe segments, and fabricated pieces from those
   coordinates.
5. Apply reviewed material recipes.
6. Price eligible quantities from source-linked supplier quote lines.
7. Show citations, assumptions, calculation details, and any blocked outputs.

A geometry change is handled as a separate estimate in Phase 1.

## Required configuration model

The model is manufacturer-extensible and must not hard-code Exotec. It records:

- manufacturer and ASRS system/product identity;
- ASRS family/loading method;
- container or tray construction and top/wall condition;
- commodity hazard;
- overall rack-row depth and applicable aisle/height dimensions;
- wet or dry-equivalent in-rack sprinkler system class;
- actual in-rack sprinkler level elevations and horizontal sprinkler lines;
- protected run start, end, and length;
- ordered qualifying transverse-flue centerlines, entered directly or as first
  station plus uniform pitch and count;
- selected FMDS revision, table, figure, and reviewed arrangement template; and
- pipe-line bounds, fabricated-stick length, joint policy, outlet keepouts, and
  partial-stick policy.

Run length plus flue spacing is not sufficient by itself because it does not
define the first station, number of stations, or endpoint ownership.

## FMDS evidence boundary

The governing source currently under review is FMDS 8-34, April 2026, source
SHA-256:

`c6f78457ac452c1c4c95b8d195ab5f33a5a772a4ebaf7d0e5ff28c055d8411ed`

For open-top combustible containers, the relevant horizontal-arrangement
evidence includes:

- Shuttle ASRS: Table and Figures 2.2.4.2.1(a-e), PDF pages 51-53.
- Mini-load ASRS: Table and Figures 2.2.7.2.1(a-e), PDF pages 80-82.

Those figures require applicable in-rack sprinklers to be located within 3 in.
of every other transverse flue while actual on-line spacing does not exceed
5 ft. Therefore, a uniform 2.5 ft flue pitch reaches exactly 5 ft at every
other station, while a 2.75 ft pitch reaches 5.5 ft and fails that boundary.

The source does not, by that statement alone, define a universal "otherwise
use every flue" fallback, endpoint rounding rule, or alternating start phase.
Those behaviors remain unavailable until the applicable figures are visually
reviewed and encoded into approved rule cards.

## Deterministic takeoff contract

The estimator uses a coordinate-first calculation:

1. Expand the entered run geometry into explicit flue stations.
2. Apply the reviewed arrangement template to generate sprinkler coordinates
   by rack row, horizontal line, elevation, and ordinary/end/face/corner role.
3. Count approved sprinkler positions rather than dividing and rounding.
4. Map sprinkler positions to outlets only through a reviewed material recipe.
5. Partition explicit pipe segments using the selected fabrication policy.
6. Assign each outlet to exactly one fabricated piece and validate joint/end
   keepouts.
7. Generate fittings from explicit connection topology rather than a percentage
   allowance.

Twenty-foot sticks, ten outlets per stick, waste percentages, spare-head
factors, and fitting allowances are not defaults. Each must come from an
explicit reviewed fabrication or material policy.

## Quote-backed pricing

Supplier quote lines are price-eligible only when the immutable source artifact,
supplier, revision/date window, product identity, unit of measure, pack basis,
and line price have been extracted and reviewed. Required takeoff quantity and
ordered/pack-rounded quantity remain separate.

Freight, tax, discounts, terms, and lump-sum-only proposals remain quote-level
information until an allocation policy is approved. The estimator must not
invent unit prices from a lump sum or an opaque attachment.

## Fail-loud behavior

If the source revision is inactive, a governing table or figure is unreviewed,
the geometry is incomplete, more than one rule matches, evidence conflicts, or
a material/price recipe is missing, the dependent result remains nonnumeric.
The estimator identifies the exact missing input or evidence item and preserves
the user's inputs for recalculation.

Supported independent quantities may still be shown, but a blocked head count
must not produce fabricated-pipe, outlet, or dependent priced BOM quantities.

## Explicitly outside Phase 1

- Automated DWG parsing, takeoff, or layout generation.
- Multiple geometry configurations inside one estimate.
- Permissions, approval workflows, downstream Alleato workflow integrations,
  and general estimate lifecycle work.
- Engineering-rule overrides that force unreviewed evidence to produce a
  number.
- Autonomous or sealed engineering design.
- ASRS chat and RAG remain a parallel evidence-discovery layer, not part of the
  Phase 1 deterministic estimator solver or its calculation authority.

## Revision-scoped RAG status

FMDS0834 April 2026 now has two retrieval layers in the dedicated ASRS
Supabase project:

- 225 native PDF text chunks, all embedded at 3072 dimensions; and
- one structured chunk for each human-reviewed table or figure, also embedded
  at 3072 dimensions with its exact source row, page, approved candidate, and
  attributed review event.

The structured writer rejects unreviewed sources and non-approved candidates.
The combined staging matcher returns native text and reviewed structured
evidence through one revision-scoped contract, including `source_type`,
`source_id`, `source_identifier`, `review_event_id`, and `candidate_id`.
Alleato AI routes FMDS engineering questions only through that dedicated source
and the reviewed deterministic evaluator; it does not fall back to meeting
collections, generic project RAG, legacy FM Global tables, or web search.

At the current review state, 2 reviewed tables and 7 reviewed figures are
embedded. The remaining 56 tables and 54 figures are intentionally absent from
structured retrieval until their visual reviews are approved. Native text may
locate a pending item, but it cannot promote that item into calculation
authority.

## Current state and next gate

The dedicated FMDS 8-34 April 2026 native corpus is fully vectorized, and every
currently reviewed table and figure has a separate approved structured vector.
The remaining horizontal-arrangement evidence is still review-gated and no
approved head-count rule card exists. The correct current product behavior is
therefore Pending Review for head count and dependent fabrication quantities.

The next gate is to visually approve the applicable horizontal IRAS tables and
figures, encode revision-scoped rule cards, and add boundary tests before the
coordinate-based takeoff solver is implemented.

Planning source: [Wayfind Phase 1 ASRS takeoff and quote-backed estimating](https://linear.app/megankharrison/issue/AAI-1215/wayfind-phase-1-asrs-takeoff-and-quote-backed-estimating).
