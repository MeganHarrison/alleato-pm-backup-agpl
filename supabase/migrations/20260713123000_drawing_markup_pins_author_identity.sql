-- Keep drawing pin ownership compatible with the app identity used by
-- verifyProjectAccess. SSO-backed project users need not have auth.users rows.
ALTER TABLE drawing_markup_pins
  DROP CONSTRAINT IF EXISTS drawing_markup_pins_created_by_fkey;
