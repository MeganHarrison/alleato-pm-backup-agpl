-- =============================================================================
-- Cleanup: Remove schedule_tasks rows whose names are raw PDF binary objects.
-- =============================================================================
--
-- Root cause: An MS Project .mpp file that was wrapped inside a PDF was
-- imported before the PDF-token filter existed in the parser.  The resulting
-- rows have names like "/TilingType 1", "/Matrix[0", "/PatternType 1",
-- "/Resources<<", etc. — all PDF internal-object tokens, not real tasks.
--
-- Matching criteria (matches the same patterns as _is_pdf_token() in the
-- Python parser and looksLikePdfToken() in the frontend import page):
--   1. Name starts with "/" followed by a letter  → PDF name object
--   2. Name contains "<<"                          → PDF dictionary open
--   3. Name contains ">>"                          → PDF dictionary close
--
-- Bare floating-point strings (e.g. "751.439") are deliberately excluded
-- because section numbers like "100" or "1.5" are valid construction
-- schedule task names.
-- =============================================================================

DELETE FROM schedule_tasks
WHERE
  name ~ '^/[A-Za-z]'
  OR name LIKE '%<<%'
  OR name LIKE '%>>%';
