import type { BoardItem } from "./use-product-board";
import { normalizeBoardCaptureTopics } from "./topics";
import type { Json } from "@/types/database.types";

export const BOARD_ITEM_TYPE_KEYS = [
  "design_issue",
  "initiative",
  "question",
  "bug",
] as const;

export type BoardItemTypeKey = (typeof BOARD_ITEM_TYPE_KEYS)[number];

export const BOARD_ITEM_TYPES: Record<
  BoardItemTypeKey,
  { label: string }
> = {
  design_issue: { label: "Design issue" },
  initiative: { label: "Initiative" },
  question: { label: "Question" },
  bug: { label: "Bug" },
};

export interface BoardCaptureMetadataInput {
  topics?: readonly string[] | null;
  tool?: string | null;
  category?: string | null;
  type?: string | null;
}

export function normalizeBoardTextField(
  value: string | null | undefined,
  maxLength = 120,
): string | undefined {
  const next = value?.trim();
  if (!next) return undefined;
  return next.slice(0, maxLength);
}

export function normalizeBoardItemType(
  value: string | null | undefined,
): string | undefined {
  const normalized = normalizeBoardTextField(value);
  if (!normalized) return undefined;
  return BOARD_ITEM_TYPES[normalized as BoardItemTypeKey]?.label ?? normalized;
}

export function buildBoardCaptureMetadata({
  topics,
  tool,
  category,
  type,
}: BoardCaptureMetadataInput): Record<string, Json> {
  const metadata: Record<string, Json> = {};
  const normalizedTopics = normalizeBoardCaptureTopics(topics);
  const normalizedTool = normalizeBoardTextField(tool);
  const normalizedCategory = normalizeBoardTextField(category);
  const normalizedType = normalizeBoardItemType(type);

  if (normalizedTopics.length) metadata.topics = normalizedTopics;
  if (normalizedTool) metadata.tool = normalizedTool;
  if (normalizedCategory) metadata.category = normalizedCategory;
  if (normalizedType) metadata.type = normalizedType;

  return metadata;
}

function getBoardItemMetadata(item: BoardItem): Record<string, unknown> {
  return (item.metadata as Record<string, unknown> | null) ?? {};
}

export function getBoardTool(item: BoardItem): string | undefined {
  return normalizeBoardTextField(getBoardItemMetadata(item).tool as string | null | undefined);
}

export function getBoardCategory(item: BoardItem): string | undefined {
  return normalizeBoardTextField(getBoardItemMetadata(item).category as string | null | undefined);
}

export function getBoardItemType(
  item: BoardItem,
): string | undefined {
  return normalizeBoardItemType(getBoardItemMetadata(item).type as string | null | undefined);
}

export function matchesBoardTextMetadata(
  item: BoardItem,
  field: "tool" | "category",
  selectedValue: string | null | undefined,
): boolean {
  if (!selectedValue) return true;
  return normalizeBoardTextField(getBoardItemMetadata(item)[field] as string | null | undefined) === selectedValue;
}

export function matchesBoardItemType(
  item: BoardItem,
  selectedType: string | null | undefined,
): boolean {
  if (!selectedType) return true;
  return getBoardItemType(item) === selectedType;
}

export function formatBoardItemTypeLabel(value: string | null | undefined): string {
  return normalizeBoardItemType(value) ?? "";
}
