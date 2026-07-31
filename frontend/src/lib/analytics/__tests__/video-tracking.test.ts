import { isTrackableVideoLesson } from "../video-tracking";

describe("isTrackableVideoLesson", () => {
  it.each([
    [{ content_kind: "video", source_type: "docs" }, true],
    [{ content_kind: "video", source_type: "training_resource" }, true],
    [{ content_kind: "article", source_type: "docs" }, false],
    [{ content_kind: "video", source_type: "native_content" }, false],
    [null, false],
  ] as const)("accepts only supported video identities: %o", (content, expected) => {
    expect(isTrackableVideoLesson(content)).toBe(expected);
  });
});
