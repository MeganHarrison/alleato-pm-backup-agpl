import assert from "node:assert/strict";
import test from "node:test";

import { extractWindowAssignedObject } from "../parse-source-library.mjs";

test("extractWindowAssignedObject parses a simple window-global JSON assignment", () => {
  const source = 'window.FOO_BAR = {"a": 1, "b": [1, 2, 3]};\n';
  assert.deepEqual(extractWindowAssignedObject(source, "FOO_BAR"), { a: 1, b: [1, 2, 3] });
});

test("extractWindowAssignedObject handles nested braces inside string values", () => {
  const source = 'window.FOO = {"note": "has a { brace } inside"};';
  assert.deepEqual(extractWindowAssignedObject(source, "FOO"), { note: "has a { brace } inside" });
});

test("extractWindowAssignedObject ignores a leading comment block", () => {
  const source = "/* header comment with { braces } */\nwindow.FOO = {\"x\": 1};\n";
  assert.deepEqual(extractWindowAssignedObject(source, "FOO"), { x: 1 });
});

test("extractWindowAssignedObject throws a specific error when the global name is not found", () => {
  const source = "window.OTHER = {};";
  assert.throws(() => extractWindowAssignedObject(source, "MISSING"), /MISSING.*not found/i);
});
