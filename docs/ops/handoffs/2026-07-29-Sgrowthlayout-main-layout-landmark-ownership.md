# Sgrowthlayout Handoff: Main Layout Landmark Ownership

## Root Cause

The shared sidebar inset incorrectly owned the `main` landmark. Correcting it to a layout-only element would leave the immersive `/team-chat` and `/comments` branch without a main landmark because that branch renders route content directly.

## Change

The immersive branch now wraps route content in the canonical `app-main-content` landmark and attaches the normal feedback target metadata.

## Verification

Pending targeted Jest, integrated browser evidence, and publication.
