import assert from "node:assert/strict";
import test from "node:test";

import { windowsDevRuntime } from "./dev-launcher.mjs";

test("Windows dev runtime isolates the default port", () => {
  assert.deepEqual(windowsDevRuntime({}), {
    port: "3000",
    nextDistDir: ".next-dev-3000",
    nextTsconfigPath: ".tsconfig-dev-3000.json",
  });
});

test("Windows dev runtime isolates an explicit QA port", () => {
  assert.deepEqual(windowsDevRuntime({ PORT: "3100" }), {
    port: "3100",
    nextDistDir: ".next-dev-3100",
    nextTsconfigPath: ".tsconfig-dev-3100.json",
  });
});

test("Windows dev runtime rejects shared or unsafe output paths", () => {
  assert.throws(
    () => windowsDevRuntime({ PORT: "3100", NEXT_DIST_DIR: ".next" }),
    /Refusing unsafe NEXT_DIST_DIR/,
  );
  assert.throws(
    () =>
      windowsDevRuntime({
        PORT: "3100",
        NEXT_TSCONFIG_PATH: "tsconfig.json",
      }),
    /Refusing unsafe NEXT_TSCONFIG_PATH/,
  );
});
