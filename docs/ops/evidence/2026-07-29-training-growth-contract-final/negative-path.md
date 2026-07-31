# Training Growth Negative Path

Date: 2026-07-29
Task ID: local-training-growth-contract-final

Verified failure paths:

1. Invalid payload is rejected before mutation.
   - Coverage:
     `frontend/src/app/api/training/growth/__tests__/route.test.ts`
   - Behavior:
     out-of-range scores return `INVALID_PAYLOAD` with a specific 400 response.

2. Expired authentication is rejected with a recovery action.
   - Coverage:
     `frontend/src/app/api/training/growth/__tests__/route.test.ts`
   - Behavior:
     unauthenticated save returns `AUTH_EXPIRED` with the message
     `Sign in again before saving your Skill Wheel check-in.`

3. Invalid focus and incomplete phased plans fail closed.
   - Coverage:
     `frontend/src/features/training/__tests__/skill-growth-server.test.ts`
   - Behavior:
     non-positive-gap focus selections and incomplete 30/60/90 plans are
     rejected before persistence.
