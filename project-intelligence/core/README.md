# Core

Synthesis, typed report validation, publication policy, and ownership contracts
belong here. `compile-daily-executive-brief.mjs` is the only Daily Brief
compiler. It may call ingestion and projection interfaces, but it does not own
schedule/retry policy.
