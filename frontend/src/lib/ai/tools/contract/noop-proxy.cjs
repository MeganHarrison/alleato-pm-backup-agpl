/**
 * Universal no-op stub for modules that pull in server-only ESM chains
 * (Teams bot, Microsoft Graph send paths, notifications) which are irrelevant
 * to a DB write-and-read-back contract. Any named/default import resolves to an
 * async no-op. External-send tools are exercised in PREVIEW-only mode in the
 * harness, so their real send path is intentionally out of scope here.
 */
const handler = {
  get: (_t, prop) => {
    if (prop === "__esModule") return true;
    if (prop === "default") return new Proxy(function () {}, handler);
    return async () => ({});
  },
};
module.exports = new Proxy(function () {}, handler);
