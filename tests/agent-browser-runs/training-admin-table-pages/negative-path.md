# Negative Path

A signed-in non-owner session attempted the training-data route and was denied.
The captured screenshot records the explicit access-denied outcome. The page
now calls `requireOwner`, and the API independently checks `isOwnerEmail` and
returns a specific 403 error.
