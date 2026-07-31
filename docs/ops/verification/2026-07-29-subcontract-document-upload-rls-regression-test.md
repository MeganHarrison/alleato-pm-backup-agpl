# Regression Test

Command:

`cd frontend && pnpm.cmd exec jest src/lib/documents/__tests__/subcontract-documents-rls-migration.test.ts --runInBand`

Result: PASS, 1 suite and 1 test.

The test reads the canonical migration and proves:

- SELECT, INSERT, UPDATE, and DELETE are each dropped before recreation.
- Every policy targets `authenticated`.
- Each operation retains its required `USING` and/or `WITH CHECK` guard.
- Every guard calls the supported `commitment` access path.
- The unsupported `subcontract` discriminator cannot return.
