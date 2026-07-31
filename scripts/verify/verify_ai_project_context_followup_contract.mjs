#!/usr/bin/env node

// Compatibility entrypoint for older local/CI invocations. The deleted
// frontend generator no longer owns this contract; the canonical verifier now
// checks Eve's governed action boundary.
await import("./verify_ai_feature_request_fast_path.mjs");
