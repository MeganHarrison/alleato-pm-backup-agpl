import { defineEvalConfig } from "eve/evals";

export default defineEvalConfig({
  timeoutMs: 120000,
  maxConcurrency: 2,
});
