import test from "node:test";
import assert from "node:assert/strict";

import {
  buildFallbackDraft,
  sanitizeDraftMarkdown,
  sanitizeSupportText,
  validateNoForbiddenContent,
} from "../compose-training-doc.mjs";

test("sanitizeSupportText strips external links and brand mentions", () => {
  const result = sanitizeSupportText(
    "Read [this guide](https://support.procore.com/example) in Procore before you continue.",
  );

  assert.equal(result.includes("support.procore.com"), false);
  assert.equal(/\bprocore\b/i.test(result), false);
  assert.equal(result.includes("Alleato"), true);
});

test("validateNoForbiddenContent rejects source-brand leakage", () => {
  assert.throws(
    () =>
      validateNoForbiddenContent(
        "This draft still mentions Procore and https://support.procore.com/example",
      ),
    /forbidden source content/i,
  );
});

test("buildFallbackDraft creates an Alleato-only step-by-step draft", () => {
  const draft = buildFallbackDraft({
    manifest: {
      title: "Create a Commitment",
      description: "Create the record in Procore-style order.",
      steps: [
        {
          title: "Open Commitments",
          instruction: "Open the Commitments tool.",
          expected: "The list is visible.",
          screenshot: "screenshots/01-open-commitments.png",
        },
      ],
    },
    sourceNotes: [
      "Use the correct contract type for the record.",
      "Review required fields before saving.",
    ],
    title: "Create a Commitment",
    audience: "internal",
    docType: "how-to",
  });

  const sanitized = sanitizeDraftMarkdown(draft);
  validateNoForbiddenContent(sanitized);

  assert.match(sanitized, /^# Create a Commitment/m);
  assert.match(sanitized, /## Steps/);
  assert.match(sanitized, /### Step 1: Open Commitments/);
  assert.equal(/\bprocore\b/i.test(sanitized), false);
});
