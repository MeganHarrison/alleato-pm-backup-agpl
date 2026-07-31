# AI route scroll boundary

Delivery lane: Standard

## Acceptance contract

- `/ai/features/assistant` scrolls through its full narrative in the normal application scroll container.
- `/ai` retains its page-owned fixed-height chat pane.
- No route under `/ai/*` is clipped by a non-scrolling shared layout ancestor.

## Localization evidence

- The live route compiled and returned `200` from the local Next.js server.
- The user-visible detail page still could not scroll.
- `frontend/src/app/(main)/ai/layout.tsx` wrapped every `/ai/*` child in `overflow-hidden` without an `overflow-y-auto` owner. This is the first layout boundary that clips descendant content before the application shell can scroll it.

## Fix and guardrail

- Remove the clipping overflow from the shared AI route layout; fixed-height chat behavior stays owned by `/ai/page.tsx`.
- This makes future non-chat AI routes scroll by default rather than requiring route-specific exceptions.
