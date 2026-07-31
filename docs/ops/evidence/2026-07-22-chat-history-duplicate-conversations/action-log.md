# Chat History Duplicate-Conversation Verification

Date: 2026-07-22
Route: `http://localhost:3000/ai`
Session: `chat-dupe-proof-0722`
Identity: authenticated test account

1. Opened the current local `/ai` implementation with refreshed test authentication.
2. Opened Chat history and read the authenticated conversation API: 360 active Alleato AI conversations.
3. Clicked New chat once.
4. Confirmed the route returned to `/ai`, the composer reset, and the active conversation count remained 360. No placeholder conversation was written.
5. Submitted `Reply with only OK. Verification token chat-dupe-20260722-1730.`
6. Confirmed the active conversation count became 361 and the route selected one new session.
7. Read the database for that exact session: one conversation, one matching user message, and one assistant response.
8. Archived the controlled test session through the authenticated DELETE route and confirmed the active count returned to 360.

Result: PASS.
