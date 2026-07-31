import {
  reconcilePendingAttachmentEntries,
  toPendingAttachmentEntry,
  type PendingAttachmentEntry,
} from "../attachment-files";

function makeFile(name: string, size: number, type = "application/pdf"): File {
  return new File(["x".repeat(size)], name, { type });
}

describe("pending submittal attachment files", () => {
  it("keeps entries that still appear in the visible upload list", () => {
    const first = toPendingAttachmentEntry(makeFile("door.pdf", 10));
    const second = toPendingAttachmentEntry(makeFile("frame.pdf", 12));

    const reconciled = reconcilePendingAttachmentEntries(
      [first, second],
      [second.info],
    );

    expect(reconciled).toEqual([second]);
  });

  it("keeps duplicate filenames by visible count instead of dropping all matches", () => {
    const entries: PendingAttachmentEntry[] = [
      toPendingAttachmentEntry(makeFile("detail.pdf", 10)),
      toPendingAttachmentEntry(makeFile("detail.pdf", 10)),
      toPendingAttachmentEntry(makeFile("hardware.pdf", 20)),
    ];

    const reconciled = reconcilePendingAttachmentEntries(entries, [
      entries[0].info,
      entries[2].info,
    ]);

    expect(reconciled).toEqual([entries[0], entries[2]]);
  });
});
