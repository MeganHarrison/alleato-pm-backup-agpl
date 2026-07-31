import fs from "node:fs";
import path from "node:path";

const frontendRoot = process.cwd();
const filesClientPath = path.join(
  frontendRoot,
  "src/app/(tables)/files/files-client.tsx",
);
const documentUpdateRoutePath = path.join(
  frontendRoot,
  "src/app/api/documents/[docId]/assign-project/route.ts",
);

describe("files table page", () => {
  it("uses the unified table shell without row drawer navigation", () => {
    const pageSource = fs.readFileSync(filesClientPath, "utf8");

    expect(pageSource).toContain("UnifiedTablePage<FileItem>");
    expect(pageSource).toContain("fileHref(item)");
    expect(pageSource).not.toContain("onRowClick:");
    expect(pageSource).not.toContain("sidePanel={{");
  });

  it("keeps file type metadata editable inline and accepted by the update route", () => {
    const pageSource = fs.readFileSync(filesClientPath, "utf8");
    const routeSource = fs.readFileSync(documentUpdateRoutePath, "utf8");

    expect(pageSource).toContain('fieldKey="document_type"');
    expect(pageSource).toContain("handleDocumentTypeSave");
    expect(routeSource).toContain('"document_type"');
    expect(routeSource).toContain("updates.document_type");
  });
});
