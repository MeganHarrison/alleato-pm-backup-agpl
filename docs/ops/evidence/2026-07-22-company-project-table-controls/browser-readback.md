# Browser readback

Route: `http://localhost:3001/` with the authenticated `alleato-test-3001` browser profile.

- 1440px: scope tabs appear left and all table controls appear on the same row at right. The `New Project` button is fully visible in the header.
- 375px: the create action is an icon-sized touch target and the table controls use the shared `Open table settings` trigger.
- Width checks at 375px, 414px, 768px, 1024px, and 1440px returned `horizontalOverflow: false`.
