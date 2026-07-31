import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const meetingDeleteFiles = [
  "frontend/src/features/meetings/use-meetings-table.tsx",
  "frontend/src/app/api/projects/[projectId]/meetings/[meetingId]/route.ts",
];

test("meeting delete paths soft-delete document metadata and preserve segments", () => {
  for (const file of meetingDeleteFiles) {
    const source = readFileSync(file, "utf8");
    const documentMetadataChains = source.match(/from\("document_metadata"\)[\s\S]{0,220}/g) ?? [];

    assert(
      documentMetadataChains.some((chain) => chain.includes("deleted_at")),
      `${file} must update deleted_at when deleting meetings`,
    );

    for (const chain of documentMetadataChains) {
      assert(
        !chain.includes(".delete()"),
        `${file} must not hard-delete document_metadata rows`,
      );
    }

    assert(
      !source.includes('from("meeting_segments")\n      .delete()'),
      `${file} must not delete meeting segments as part of meeting deletion`,
    );
  }
});
