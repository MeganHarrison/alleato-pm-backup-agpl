# Authenticated browser action log

Route: `http://localhost:3024/training/growth`

1. Opened the guarded route and observed the expected redirect to
   `/auth/login?callbackUrl=%2Ftraining%2Fgrowth`.
2. Signed in with the repository's allowlisted Playwright test account.
3. Confirmed the authenticated app shell, sidebar `Training` link, `My Growth`
   heading, shared Training tabs, and profile-resolved `Project Engineer` role.
4. Confirmed eight canonical Project Engineer skills, current and target
   inputs, evidence fields, accessible Skill Wheel, top-four focus plan,
   feedback fields, and 60-day next-check-in calculation.
5. Filled evidence for all eight scores, the required action/frequency/measure
   for all four focus skills, a make-time commitment, and feedback cadence.
6. Confirmed `Save check-in` changed from disabled to enabled.
7. Saved once. The browser observed `POST /api/training/growth` return HTTP 200
   and displayed `Check-in saved for Jul 26, 2026`.
8. Confirmed history showed `Jul 26, 2026`, `Project Engineer`, and `Average 50`.
9. Performed a full navigation reload and reconfirmed the same history entry.
10. Created a second dated check-in with one changed score.
11. Confirmed history showed both entries and calculated
    `Average 50 · +1 · 1 skills changed` against the earlier `Average 49`.
12. Reloaded again and reconfirmed both history rows and the calculated trend.

The committed Playwright regression independently repeated an authenticated
fill/save/readback/reload cycle, switched to a 390 x 844 viewport, and asserted
zero document overflow. It passed after its auth setup created a local storage
state; no credentials were written to the repository.

The unrelated local collaboration widget logged missing Velt credentials in
development. It did not affect the Training route or its successful save.
