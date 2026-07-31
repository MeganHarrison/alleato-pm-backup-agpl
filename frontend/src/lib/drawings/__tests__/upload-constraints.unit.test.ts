import fs from "fs";
import path from "path";

import {
  DRAWING_MAX_UPLOAD_BYTES,
  DRAWING_MAX_UPLOAD_LABEL,
  getDrawingUploadFileError,
} from "../upload-constraints";

const projectRoot = process.cwd();

const readSource = (sourcePath: string) =>
  fs.readFileSync(path.join(projectRoot, sourcePath), "utf8");

describe("drawing upload constraints", () => {
  it("centralizes the app drawing max upload size at 200MB", () => {
    expect(DRAWING_MAX_UPLOAD_BYTES).toBe(200 * 1024 * 1024);
    expect(DRAWING_MAX_UPLOAD_LABEL).toBe("200MB");

    const tooLargeFile = new File(["x"], "A101.pdf", { type: "application/pdf" });
    Object.defineProperty(tooLargeFile, "size", {
      value: DRAWING_MAX_UPLOAD_BYTES + 1,
    });

    expect(getDrawingUploadFileError(tooLargeFile)).toBe(
      "File is too large. Drawings must be 200MB or smaller.",
    );
  });

  it("keeps app routes, hook, service, schema, and dialog on the shared drawing upload constraint", () => {
    const sharedImportTargets = [
      "src/app/api/projects/[projectId]/drawings/upload-url/route.ts",
      "src/app/api/projects/[projectId]/drawings/[drawingId]/revisions/upload-url/route.ts",
      "src/hooks/use-drawing-upload.ts",
      "src/services/drawings/DrawingFileService.ts",
      "src/lib/schemas/drawing-schemas.ts",
      "src/components/drawings/DrawingUploadDialog.tsx",
    ];

    for (const sourcePath of sharedImportTargets) {
      expect(readSource(sourcePath)).toContain("@/lib/drawings/upload-constraints");
    }
  });
});
