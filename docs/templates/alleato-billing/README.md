# Alleato Group Billing Forms

*Your partner from the ground up.* · www.alleatogroup.com

Alleato Group's standard billing package, in two directions — owner billing (contractor → owner)
and subcontractor billing (subcontractor → contractor) — plus the CSV templates for loading the
result into the PM platform.

| Form | Title | Orientation |
|------|-------|-------------|
| **APP** | Application and Certificate for Payment | Landscape |
| **CS** | Continuation Sheet | Landscape |
| **CO** | Change Order | Portrait |

## What's here

| Path | What it is |
|---|---|
| `Alleato-Billing-Template-OWNER.xlsx` | Working billing workbook, prime contract. Live formulas, includes the transmittal Continuation Sheet. |
| `Alleato-Billing-Template-SUBCONTRACTOR.xlsx` | Same, for subcontract / commitment billing. |
| `pdf/Form-APP-*.pdf` `pdf/Form-CS-*.pdf` `pdf/Form-CO-*.pdf` | Fillable AcroForm PDFs for signature and notarization. |
| `csv/01-…` through `csv/12-…` | Import templates, one per platform table, with example rows. |
| `CSV-IMPORT-SPEC.md` | Column mapping, generated-column rules, validation checklist. **Read before importing.** |

Generators live in `scripts/alleato-billing/`. Re-run any of them to regenerate:

```bash
python3 scripts/alleato-billing/build_workbook.py docs/templates/alleato-billing
python3 scripts/alleato-billing/build_pdfs.py     docs/templates/alleato-billing/pdf
python3 scripts/alleato-billing/build_csv.py      docs/templates/alleato-billing/csv
```

`verify_workbook.py` populates a workbook with a worked example so the formulas can be recalculated
and checked (see *Verification* below).

## Workbook sheets, in the order you use them

1. **Setup** — project, parties, contract sum, retainage rates, application period. The only sheet
   where project data is typed. Everything else reads from it through named ranges, so inserting a
   row here cannot break the other sheets.
2. **CO Log** — one row per change order. `Status` must read `Approved` or `Executed` to be counted.
   The `In Prior Application` Y/N flag splits the change order summary between prior applications
   and this one.
3. **Schedule of Values** — the working sheet and the monthly data entry. Type Scheduled Value
   (col D), From Previous Application (col E), This Period (col F), Materials Presently Stored
   (col G), and the prior/released retainage columns. Everything else calculates. It is wider than
   the Continuation Sheet because it carries the retainage detail the platform needs.
4. **Continuation Sheet** — Form CS. The same schedule of values in the standard columns A through I.
   Every cell is a formula from the Schedule of Values sheet; nothing is typed here. **This is the
   copy you send out.**
5. **Payment Application** — Form APP. Reads entirely from the Schedule of Values and CO Log. The
   only typed cell is Line 7, Less Previous Certificates for Payment.
6. **Change Order** — Form CO. One change order per sheet; duplicate the sheet as needed.

## Two conventions that matter

**Percentages are entered out of 100, never as fractions.** Type `10` for ten percent. This matches
the platform's `retainage_pct`, `materials_retainage_pct` and `work_completed_pct` columns, so values
copy straight into the CSV with no conversion.

**Retainage is tracked in three parts per line**, matching how the platform stores it: PRIOR
(withheld on earlier applications), THIS PERIOD (calculated from the rate), and RELEASED — separately
for completed work and for stored materials. That is what produces Lines 5a and 5b:

```
Line 5a = Σ (work prior      + work this period      − work released)        → SOV cols L + M − N
Line 5b = Σ (materials prior + materials this period − materials released)   → SOV cols P + Q − R
Line 5  = Σ column S
```

## Built-in checks

- **Tie-out** — the Scheduled Value grand total must equal Line 3, Contract Sum to Date. The cell
  below the grand total reports `OK — ties` or the exact variance.
- **Change order tie** — the CO summary net must equal Line 2, or the sheet warns.
- **Retainage tie** — Lines 5a + 5b must foot to column S, or the sheet warns.

Do not send or import a workbook that is showing any of those warnings.

## Monthly rollover

1. Copy the workbook, named for the new application number.
2. On **Setup**, bump Application No. and set the new Period From / Period To.
3. On the **Schedule of Values**, paste column H (Total Completed and Stored) into column E (From
   Previous Application) as **values**, then clear columns F and G.
4. Also on the Schedule of Values, paste last month's held retainage into columns L and P as values
   (work: `L + M − N`; materials: `P + Q − R`), then clear columns N and R.
5. On the **Payment Application**, set Line 7 to last month's Line 6.
6. On the **CO Log**, flip `In Prior Application` to `Y` for change orders that were on the last
   application.

## Branding

Both workbooks and all six PDFs carry Alleato Group branding, per the brand skill:

- **Masthead** — dark grey (`#454545`) banner with the reversed Alleato logo, both office addresses,
  and the website in Primary Orange; an orange accent rule sits directly beneath it.
- **Palette** — Primary Orange `#FD5602` for accents, rules and total-row tints; Secondary Orange
  `#DB802E` for the tagline; Dark Grey `#454545` for header bands; Light Grey `#9C9998` for dot
  leaders and fine print.
- **Type** — Lato throughout. **Lato Black in caps stands in for Work Sans** on headlines, since Work
  Sans is not installed; Lato Light carries body text. To switch, change the `Head` entry in `FONTS`
  in `scripts/alleato-billing/build_pdfs.py`.
- **Footer** — orange accent bar with the tagline left and website right. The workbooks also set an
  Excel page footer, so branding prints on every page of every sheet.
- **Logo assets** — `scripts/alleato-billing/brand/`. `Alleato-Logo-Dark.png` is the supplied logo
  cropped tight; `Alleato-Logo-Reversed.png` is a **derived** white-wordmark version for the dark
  banner (the brand guide calls for a reversed logo but only the grey version shipped, so the
  wordmark was recoloured to white with the orange triangles and tagline preserved). If an official
  reversed asset exists, drop it in at that filename and rebuild.

**One deliberate exception:** PDF *form field* text stays Helvetica. AcroForm field fonts must be one
of the PDF standard 14, so typed values render identically in Acrobat, Preview and browsers. All
static form text is Lato.

## Form structure

These are Alleato Group forms. They follow the standard construction-industry application-for-payment
structure, so any owner, lender or subcontractor reads them without friction:

- **Form APP** — nine summary lines (Original Contract Sum → Balance to Finish Including Retainage),
  Line 5 split into 5a (% of Completed Work) and 5b (% of Stored Material) with a Total Retainage
  line, Line 8 boxed, a Change Order Summary table with Additions / Deductions and a Net Changes row,
  the payee's certification with a full notary block, and the certifier's certificate with AMOUNT
  CERTIFIED and the initial-all-changed-figures instruction. Header fields include Application No,
  Period To, Contract For, Contract Date, Project Nos, and Distribution-to checkboxes.
- **Form CS** — columns A, B, C, D, E, F, G, H, I with D and E grouped under a merged WORK COMPLETED
  band and the `% (G ÷ C)` column left unlettered inside G's span. Column parentheticals `(D + E)`,
  `(Not in D or E)`, `(D+E+F)`, `(C – G)` and `(If variable rate)` are all carried. Header fields are
  Application No, Application Date, Period To and the third party's Project No — a continuation sheet
  carries no project or contractor fields, it relies on the attached application.
- **Form CO** — five-line contract sum reconciliation, contract time adjustment, revised Substantial
  Completion date, the Construction Change Directive note, and signature blocks for every party.

Certification language is Alleato Group's own. Where a contract specifies submission on a particular
third-party form, obtain that form from its publisher and key the figures across from this workbook —
the sheets are ordered so you read straight down.

## Verification

Last verified 2026-07-30 against a worked example (Morrisville, $1,000,000 base + $75,000 approved
change orders, Application No. 4):

| Check | Result |
|---|---|
| Continuation Sheet mirrors Schedule of Values, all 8 columns | tie |
| Line 3 Contract Sum to Date | 1,075,000.00 |
| Line 4 Total Completed and Stored | 485,000.00 |
| Line 5a / 5b / Total Retainage | 43,500.00 / 5,000.00 / 48,500.00 |
| Line 6 Total Earned Less Retainage | 436,500.00 |
| Line 8 Current Payment Due · Amount Certified | 196,500.00 · 196,500.00 |
| Line 9 Balance to Finish | 638,500.00 |
| All three built-in tie checks | pass |
| CSV headers vs live database columns | 12/12 files, 0 unknown columns |

Reproduce with:

```bash
python3 scripts/alleato-billing/verify_workbook.py \
  docs/templates/alleato-billing/Alleato-Billing-Template-OWNER.xlsx /tmp/worked.xlsx
```

then open `/tmp/worked.xlsx` and read the totals.
