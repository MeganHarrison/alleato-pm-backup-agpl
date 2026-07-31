import type { BoardItem } from "../use-product-board";
import {
  getBoardCaptureTopics,
  hasBoardCaptureTopic,
  matchesBoardCaptureTopics,
  normalizeBoardCaptureTopics,
} from "../topics";

describe("product board topics", () => {
  it("normalizes topic keys and removes duplicates", () => {
    expect(
      normalizeBoardCaptureTopics(["responsive", "mobile", "mobile", "other"]),
    ).toEqual(["responsive", "mobile"]);
  });

  it("reads topics from board item metadata", () => {
    const item = {
      id: "item-1",
      metadata: { topics: ["mobile", "responsive"] },
    } as BoardItem;

    expect(getBoardCaptureTopics(item)).toEqual(["mobile", "responsive"]);
    expect(hasBoardCaptureTopic(item, "mobile")).toBe(true);
    expect(hasBoardCaptureTopic(item, "responsive")).toBe(true);
  });

  it("matches any selected topic for filtering", () => {
    const item = {
      id: "item-1",
      metadata: { topics: ["mobile"] },
    } as BoardItem;

    expect(matchesBoardCaptureTopics(item, ["mobile"])).toBe(true);
    expect(matchesBoardCaptureTopics(item, ["responsive"])).toBe(false);
    expect(matchesBoardCaptureTopics(item, ["mobile", "responsive"])).toBe(true);
  });
});
