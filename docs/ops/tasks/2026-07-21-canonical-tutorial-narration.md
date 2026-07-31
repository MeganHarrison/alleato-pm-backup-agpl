# Task: Consolidate Prime Contract Narration into the Canonical Tutorial Pipeline

Status: In Progress
Owner: Codex S213
Created: 2026-07-21
Task ID: AAI-1238
Linear Issue: [AAI-1238](https://linear.app/megankharrison/issue/AAI-1238/consolidate-prime-contract-narration-into-the-canonical-tutorial)
Related Handoff: `docs/ops/handoffs/2026-07-21-S213-canonical-tutorial-narration.md`

## Objective

Render ElevenLabs narration from the same manifest that owns an Alleato tutorial's screenshots and walkthrough video, and prevent manifests from referring to non-playable videos.

## Scope

- Shared recorder, packet validator, narration renderer, Prime Contract workflow, targeted tests, and the canonical tutorial artifact packet.
- No separate application, database, documentation pipeline, or public-doc release until the complete packet passes its live capture gates.

## Source of Truth

- Canonical runtime/data owner: `scripts/tutorials/`
- Existing shared primitives/services: `tutorial-recorder.ts`, `run-tutorial.ts`, `validate-training-packet.mjs`
- Deprecated or parallel paths: standalone narration apps, raw video files not referenced by the manifest, and manual screenshot/video assembly.

Verification contract: Required

## Acceptance Criteria

- [x] A workflow can express narration within its existing tutorial steps.
- [x] The shared recorder persists narration cues and capture timing in the manifest.
- [x] A single renderer produces narrated audio from a valid manifest using ElevenLabs.
- [x] Video finalization fails before a manifest can reference an unplayable asset.
- [ ] The Prime Contract packet is recaptured and validated end to end.

## Implementation Checklist

- [x] Existing tutorial owner files are identified before edits.
- [x] Shared recorder owns narration metadata and video-finalization behavior.
- [x] Provider errors are specific and actionable.
- [ ] ElevenLabs credentials remain runtime-only and are never written to source, artifacts, or logs.

## Integration and Verification

- [x] Targeted recorder, renderer, and packet-validator tests pass.
- [ ] A live ElevenLabs render is read back without exposing the credential.
- [ ] An authenticated canonical Prime Contract capture produces a playable manifest-owned video.
- [ ] Packet validation passes with narration artifacts.
- [ ] Screenshot/video evidence is recorded.
- [ ] Task-owned files are published and local `HEAD` equals `origin/main`.

## Failure-Loudly Contract

- Cause surfaced as: missing narration, inaccessible ElevenLabs credential, failed provider response, or non-playable video.
- Detection path: renderer preflight, targeted tests, `ffprobe`, and packet validation.
- Recovery path: add narration to the workflow, correct the named runtime credential, or recapture before rendering/publishing.

## Incident Learning

- Failure fingerprint: `process.claimed-verification-without-runtime-evidence`
- Root cause: a manifest was written with a video reference before playability was proven.
- Detection gap: packet validation only ran after the invalid artifact was published to the packet.
- Prevention: verify video duration in the recorder before writing the manifest, then validate narration artifacts from the same manifest.
- Guardrail evidence: targeted recorder and packet-validator tests.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Provider authentication | ElevenLabs `/v1/user` read-back | Pass | Account authentication succeeded; credential was not persisted. |
| Existing packet diagnosis | `ffprobe .../session.webm` | Fail loudly | Manifest-owned video has no duration; raw Playwright video is separately playable. |
| Task setup | This task file | Pass | Scope and integration gates recorded before implementation. |
| Focused tests | `tsx --test tutorial-recorder.contract.test.mts`; packet-validator tests | Pass | 12 tests pass, including video-finalization and narration-cue failures. |
| Narration preflight | `renderNarratedTutorial` against the original manifest | Pass — failure path | Refuses the invalid manifest-owned `session.webm` before an ElevenLabs request. |
| Isolated auth refresh | Playwright auth setup with `AUTH_STORAGE_STATE_PATH=/tmp/aai-1238-prime-contract-auth.json` | Pass | A fresh localhost auth cookie was created with a valid expiry; the shared state file was not overwritten. |
| Local route retry | `agent-browser` plus direct HTTP checks after a clean Next cache restart | Blocked | Next listens on port 3000 but `/auth/login` and the Prime Contract route time out without an HTTP response. This is a local frontend runtime boundary, not an ElevenLabs or auth-cookie failure. |

## Remaining Risk

- The isolated capture session is valid, but the local Next process currently accepts connections without serving `/auth/login` or the Prime Contract route. Restore a responsive local frontend before end-to-end recapture.

## Final Status

- [ ] All required checklist items are complete.
- [ ] Evidence is filled in.
- [x] Incident learning is linked.
- [ ] Any deferred work has cause, detection gap, prevention step, owner, and next action.
