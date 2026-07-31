/**
 * Pure domain logic for Procore-style Meetings tool.
 * No I/O, no dependencies beyond built-in types.
 */

/** Built-in categories that should be available even before they are used. */
export const MEETING_CATEGORY_OPTIONS = ["Annual Review"] as const;

type MeetingStatusInput = {
  is_draft: boolean;
  mode: 'agenda' | 'minutes';
};

type MeetingStatus = 'draft' | 'awaiting_minutes' | 'minutes';

type Category = {
  id: string;
  position: number;
};

type Item = {
  id: string;
  category_id: string;
  position: number;
};

type CarryoverItem = {
  id: string;
  status: string;
};

/**
 * deriveMeetingStatus
 * Returns the derived status of a meeting based on its draft flag and mode.
 * Draft beats all: if is_draft=true, return "draft".
 * If not draft: agenda → "awaiting_minutes", minutes → "minutes".
 */
export function deriveMeetingStatus(meeting: MeetingStatusInput): MeetingStatus {
  if (meeting.is_draft) {
    return 'draft';
  }

  if (meeting.mode === 'agenda') {
    return 'awaiting_minutes';
  }

  return 'minutes';
}

/**
 * numberAgenda
 * Produces a hierarchical numbering scheme for agenda items.
 * Categories are 1-indexed by position; items within each category are 1-indexed by position.
 * Result: Map<item_id, "category.item"> e.g., "2.3" for 2nd category, 3rd item.
 *
 * Handles:
 * - Unsorted input: sorts categories and items internally by position (stable).
 * - Empty categories: no numbers assigned (since no items).
 * - Orphaned items (category_id not in categories list): skipped (not in output).
 * - Ties in position: stable sort (preserve input order).
 */
export function numberAgenda(categories: Category[], items: Item[]): Map<string, string> {
  const result = new Map<string, string>();

  if (categories.length === 0 || items.length === 0) {
    return result;
  }

  // Sort categories by position (stable).
  const sortedCategories = [...categories].sort((a, b) => a.position - b.position);

  // Build a map from category_id -> category_index (1-indexed).
  const categoryIndex = new Map<string, number>();
  sortedCategories.forEach((cat, idx) => {
    categoryIndex.set(cat.id, idx + 1);
  });

  // Group items by category_id, maintaining input order within each group.
  const itemsByCategory = new Map<string, Item[]>();
  items.forEach((item) => {
    if (categoryIndex.has(item.category_id)) {
      if (!itemsByCategory.has(item.category_id)) {
        itemsByCategory.set(item.category_id, []);
      }
      itemsByCategory.get(item.category_id)!.push(item);
    }
  });

  // Sort items within each category by position (stable) and assign numbers.
  itemsByCategory.forEach((categoryItems, categoryId) => {
    const catIndex = categoryIndex.get(categoryId)!;
    const sorted = [...categoryItems].sort((a, b) => a.position - b.position);
    sorted.forEach((item, idx) => {
      result.set(item.id, `${catIndex}.${idx + 1}`);
    });
  });

  return result;
}

/**
 * selectCarryoverItems
 * Selects items that should be carried over to a follow-up meeting.
 * Includes items with status "open" or "in_progress".
 * Excludes "closed" items.
 * Preserves input order.
 */
export function selectCarryoverItems(items: CarryoverItem[]): string[] {
  return items
    .filter((item) => item.status === 'open' || item.status === 'in_progress')
    .map((item) => item.id);
}
