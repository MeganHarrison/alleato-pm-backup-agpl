import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const SURFACES = [
  {
    file: "src/features/plane-cycles/cycle-form-modal.tsx",
    wrappers: ["PlaneDialogContent"],
  },
  {
    file: "src/features/plane-cycles/plane-cycles-page.tsx",
    wrappers: ["PlaneDialogContent", "PlaneDropdownMenuContent"],
  },
  {
    file: "src/features/plane-modules/module-card-item.tsx",
    wrappers: ["PlaneDropdownMenuContent", "PlaneSelectContent"],
  },
  {
    file: "src/features/plane-modules/module-form-dialog.tsx",
    wrappers: ["PlaneModalContent"],
  },
  {
    file: "src/features/plane-modules/module-list-item.tsx",
    wrappers: ["PlaneDropdownMenuContent", "PlaneSelectContent"],
  },
  {
    file: "src/features/plane-modules/plane-modules-page.tsx",
    wrappers: [
      "PlaneAlertDialogContent",
      "PlaneDropdownMenuContent",
      "PlaneSheetContent",
    ],
  },
] as const;

const unscopedContentImport =
  /^\s{2}(?:AlertDialogContent|DialogContent|DropdownMenuContent|ModalContent|SelectContent|SheetContent),?$/m;

describe("Plane Cycles and Modules overlay adoption", () => {
  it.each(SURFACES)(
    "uses only Plane-scoped content wrappers in $file",
    ({ file, wrappers }) => {
      const source = readFileSync(resolve(process.cwd(), file), "utf8");

      expect(source).toContain('@/features/plane-work-items/plane-overlay"');
      expect(source).not.toMatch(unscopedContentImport);
      for (const wrapper of wrappers) {
        expect(source).toContain(wrapper);
      }
    },
  );
});
