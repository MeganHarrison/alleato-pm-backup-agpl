import test from "node:test";
import assert from "node:assert/strict";

import { implementationFilesWithoutTask, isImplementationFile, taskFilesFromStagedFiles } from "../verification-closeout-policy.mjs";

test("implementation changes cannot bypass task metadata", () => {
  assert.deepEqual(
    implementationFilesWithoutTask(["frontend/src/app/page.tsx", "package.json"], []),
    ["frontend/src/app/page.tsx", "package.json"],
  );
  assert.deepEqual(implementationFilesWithoutTask(["scripts/ops/check.mjs"], []), ["scripts/ops/check.mjs"]);
  assert.deepEqual(implementationFilesWithoutTask(["package.json"], []), ["package.json"]);
});

test("task-owned implementation changes satisfy the task-presence policy", () => {
  const files = ["frontend/src/app/page.tsx", "docs/ops/tasks/2026-07-14-example.md"];
  const taskFiles = taskFilesFromStagedFiles(files);
  assert.deepEqual(implementationFilesWithoutTask(files, taskFiles), []);
});

test("shared task template does not create a second concrete task identity", () => {
  assert.deepEqual(
    taskFilesFromStagedFiles(["docs/ops/tasks/TASK-TEMPLATE.md", "docs/ops/tasks/2026-07-14-example.md"]),
    ["docs/ops/tasks/2026-07-14-example.md"],
  );
});

test("documentation-only micro changes do not require a task by this policy", () => {
  assert.deepEqual(implementationFilesWithoutTask(["docs/README.md"], []), []);
});

test("implementation-path classification covers root and owned source files", () => {
  assert.equal(isImplementationFile("package.json"), true);
  assert.equal(isImplementationFile("frontend/src/app/page.tsx"), true);
  assert.equal(isImplementationFile("docs/README.md"), false);
});
