import assert from "node:assert/strict";
import test from "node:test";

import {
  BRIEF_V3_RESPONSE_FORMAT,
  BRIEF_V3_RESPONSE_SCHEMA,
} from "../brief-v3-response-schema.mjs";

test("Project Intelligence structured output uses the AI Gateway JSON Schema contract", () => {
  assert.equal(BRIEF_V3_RESPONSE_FORMAT.type, "json_schema");
  assert.equal(BRIEF_V3_RESPONSE_FORMAT.json_schema.name, "daily_executive_brief_v3");
  assert.equal(BRIEF_V3_RESPONSE_FORMAT.json_schema.strict, true);
  assert.equal(BRIEF_V3_RESPONSE_FORMAT.json_schema.schema, BRIEF_V3_RESPONSE_SCHEMA);
  assert.deepEqual(BRIEF_V3_RESPONSE_SCHEMA.required, [
    "executiveSignal",
    "callsToday",
    "projects",
    "looseEnds",
    "preventionFindings",
    "executiveSynthesis",
    "sourceCoverage",
  ]);
  assert.equal(BRIEF_V3_RESPONSE_SCHEMA.additionalProperties, false);
  assert.equal(
    BRIEF_V3_RESPONSE_SCHEMA.properties.executiveSynthesis.properties.patterns.items.properties.id.pattern,
    "^[a-z0-9]+(?:-[a-z0-9]+)*$",
  );
  assert.equal(
    BRIEF_V3_RESPONSE_SCHEMA.properties.preventionFindings.items.properties.title.minLength,
    1,
  );
});
