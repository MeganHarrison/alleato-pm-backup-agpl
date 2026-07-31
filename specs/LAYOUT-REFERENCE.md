# Layout Reference — Training Module must match the standalone "Own Your Growth" hub

**Owner decision (2026-07-26):** the `/training` module must **look like the standalone Alleato training hub** we approved — bold, Alleato-branded — **not** re-skinned into the app's default "operator-grade / quiet" design system. This is an intentional, owner-approved exception to `DESIGN-SYSTEM-GATE.md`, **scoped to the `/training` routes only** (must not change the look of the rest of Alleato-PM).

**Canonical source of truth (in `training-source/`):** `index.html` (structure/section order), `app/styles.v2.css` (all styling), `app/app.v2.js` (render + Skill Wheel logic), `data/data.js` (content). Reproduce these faithfully — ideally port `styles.v2.css` scoped under a `.training` wrapper/route rather than rebuilding with default app components.

## Design tokens (from styles.v2.css — use exactly)
```
--orange:  #FD5602   (primary: CTAs, kickers, accents, active states)
--orange2: #DB802E   (secondary: tagline italic, hover, gradient end)
--black:   #0D0D0D   (nav bar, hero bg, dark panels, headings)
--dgrey:   #454545   (body-on-light secondary)
--lgrey:   #9C9998   (muted)
--tint:    #FCE3D4   (soft orange chips/callouts; high-importance pill)
--paper:   #FAFAF8   (page background, alt rows)
--card:    #FFFFFF    --line:#ececec (borders)
```
- **Fonts:** headings/labels = **Work Sans** (700–800, often UPPERCASE with letter-spacing); body = **Lato** (fallback Calibri/Arial). Load from Google Fonts.
- **Shape language:** cards radius 14px with soft shadow `0 6px 18px rgba(13,13,13,.06)` and a −3px hover lift; pill buttons/tabs; orange outline buttons, filled-orange primary.

## Section order (top → bottom, from index.html)
1. **Sticky black nav** — logo (42px) left; right links: Training Library · The Method · Start Here · AI Prompts · My Growth · Ask the Library (AI) (light-grey → orange hover).
2. **Hero** (black bg, orange radial glow top-right): orange kicker "ALLEATO TRAINING LIBRARY" → **H1 "OWN YOUR GROWTH"** (clamp 34–58px, weight 800) → light-grey subhead (≤640px) → filled-orange CTA "Take the Assessment →" → italic orange tagline.
3. **Training Library** — `sec-kick` + `sec-h`, then a responsive grid of **course tiles** (`.card`): orange `.mod` label, H3 title, dgrey copy, action buttons (primary + outline). Tiles come from `data.js` `modules`.
4. **The Method** — 4 `.principle` cards (orange left border) + 6 numbered `.steps` (orange 30px circle numerals).
5. **Start Here** — role skill libraries: an Alleato Core block (orange top border) + role **pill tabs** (`.roletab`, orange when active) + a skill table (black header row, alternating rows, importance pills H/M/L).
6. **Rubric** — alternating rows, orange band number (~74px) + uppercase label + text.
7. **AI Prompts** — `.prompt` cards (paper) each with a **Copy** button (orange, turns filled "Copied ✓").
8. **Quick Toolkit** — tool cards + a black **Proficiency** panel with orange ✓ checklist bullets.
9. **My Growth — Skill Wheel dashboard** (`.dash`, white rounded card): role selector + quarter input + Save/Reset; left = **canvas Skill Wheel** with legend (solid orange = current, dashed black ring = target, orange = high-importance); right = editable score/target table (sliders + number inputs) and an auto-ranked **Focus** list (black rank circles, orange→orange2 gradient bars, impact×gap). Port the math + canvas from `app.v2.js`.
10. **Footer** — black, "ALLEATO GROUP — Training & Development" + tagline.

## Rules for the port
- Match the above **exactly** in structure, spacing, color, and type. When in doubt, open the source files and mirror them.
- **Scope all of it to `/training`** (e.g. a `training-theme` wrapper or route-level CSS) so no global/app styles change.
- Keep the data-driven approach: tiles, method, rubric, prompts, roles, and skills all render from data (now Supabase per the spec), not hard-coded.
- If `DESIGN-SYSTEM-GATE.md` blocks the branded styles, treat this doc as the explicit override for the training module and note it in the gate doc — do not silently convert the hub to the muted design system.
