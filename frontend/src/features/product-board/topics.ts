import type { BoardItem } from "./use-product-board";

export const BOARD_CAPTURE_TOPIC_KEYS = ["mobile", "responsive"] as const;

export type BoardCaptureTopicKey = (typeof BOARD_CAPTURE_TOPIC_KEYS)[number];

export const BOARD_CAPTURE_TOPICS: Record<
  BoardCaptureTopicKey,
  { label: string; color: string }
> = {
  mobile: {
    label: "Mobile",
    color: "bg-sky-500",
  },
  responsive: {
    label: "Responsive",
    color: "bg-emerald-500",
  },
};

export function normalizeBoardCaptureTopics(
  topics: readonly string[] | null | undefined,
): BoardCaptureTopicKey[] {
  if (!topics?.length) return [];

  const seen = new Set<BoardCaptureTopicKey>();
  const normalized: BoardCaptureTopicKey[] = [];

  topics.forEach((topic) => {
    if (!BOARD_CAPTURE_TOPIC_KEYS.includes(topic as BoardCaptureTopicKey)) {
      return;
    }
    const key = topic as BoardCaptureTopicKey;
    if (seen.has(key)) return;
    seen.add(key);
    normalized.push(key);
  });

  return normalized;
}

export function getBoardCaptureTopics(item: BoardItem): BoardCaptureTopicKey[] {
  const meta = (item.metadata as { topics?: string[] } | null) ?? {};
  return normalizeBoardCaptureTopics(meta.topics);
}

export function matchesBoardCaptureTopics(
  item: BoardItem,
  selectedTopics: readonly BoardCaptureTopicKey[] | null | undefined,
): boolean {
  if (!selectedTopics?.length) return true;

  const itemTopics = getBoardCaptureTopics(item);
  return selectedTopics.some((topic) => itemTopics.includes(topic));
}

export function hasBoardCaptureTopic(
  item: BoardItem,
  topic: BoardCaptureTopicKey,
): boolean {
  return getBoardCaptureTopics(item).includes(topic);
}
