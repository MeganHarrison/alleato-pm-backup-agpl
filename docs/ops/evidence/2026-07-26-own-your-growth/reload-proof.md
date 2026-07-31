# Reload proof

After the authenticated browser saved the Jul 26, 2026 Project Engineer
check-in:

- the success notice appeared only after the POST returned HTTP 200;
- history displayed the role and `Average 50`;
- a full navigation to `/training/growth` was performed;
- the transient success notice correctly disappeared;
- the saved `Jul 26, 2026 Project Engineer` history entry and `Average 50`
  remained visible.

Screenshot: `growth-reload-history.png`.

A second Jul 25, 2026 check-in was then saved with one changed score. After
another full reload, history showed both rows plus
`Average 50 · +1 · 1 skills changed` for the latest row and `Average 49` for
the earlier row. Screenshot: `growth-trend-history.png`.
