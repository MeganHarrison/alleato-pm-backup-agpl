# Negative-path verification

The focused contract tests prove that PDF generation throws specific errors when:

- the commitment Contract Company/Subcontractor is missing;
- the Original Amount is missing;
- retainage is missing; or
- any required payment, recitals, clauses, signature, or Exhibit A template marker cannot be replaced.

The project Client/Owner is intentionally different: commitments may be drafted before the Client is known. A missing Owner renders as a clearly visible blank legal underline, never `Not set` and never an inferred company. The current Avita fixture renders and downloads under that condition while all other required-input guards remain active.
