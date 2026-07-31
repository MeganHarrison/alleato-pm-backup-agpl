import { BudgetLineItem } from "@/types/budget";
import { QuickFilterType } from "@/components/budget/budget-filters";

/**
 * Apply quick filter to budget line items
 */
export function applyQuickFilter(
  items: BudgetLineItem[],
  filterType: QuickFilterType,
): BudgetLineItem[] {
  if (filterType === "all") {
    return items;
  }

  const filterItem = (item: BudgetLineItem): boolean => {
    switch (filterType) {
      case "over-budget":
        // Over budget: Projected Costs > Projected Budget
        return item.projectedCosts > item.projectedBudget;

      case "under-budget":
        // Under budget: Projected Costs < Projected Budget
        return item.projectedCosts < item.projectedBudget;

      case "no-activity":
        // No activity: No Direct Costs, Committed Costs, or Pending Changes
        return (
          item.directCosts === 0 &&
          item.committedCosts === 0 &&
          item.pendingCostChanges === 0
        );

      case "with-direct-costs":
        // With Direct Costs: directCosts > 0
        return item.directCosts > 0;

      default:
        return true;
    }
  };

  // Recursively filter items and their children
  const filterRecursive = (item: BudgetLineItem): BudgetLineItem | null => {
    const hasChildren = item.children && item.children.length > 0;

    if (hasChildren) {
      // For parent items, filter children
      const filteredChildren = item
        .children!.map(filterRecursive)
        .filter((child): child is BudgetLineItem => child !== null);

      // Include parent if it has matching children OR if parent itself matches
      if (filteredChildren.length > 0 || filterItem(item)) {
        return {
          ...item,
          children: filteredChildren,
        };
      }
      return null;
    } else {
      // For leaf items, apply filter
      return filterItem(item) ? item : null;
    }
  };

  return items
    .map(filterRecursive)
    .filter((item): item is BudgetLineItem => item !== null);
}

/**
 * Get count of items matching quick filter
 */
export function getQuickFilterCount(
  items: BudgetLineItem[],
  filterType: QuickFilterType,
): number {
  if (filterType === "all") {
    return items.length;
  }

  const filtered = applyQuickFilter(items, filterType);

  // Count all items including children
  const countRecursive = (items: BudgetLineItem[]): number => {
    return items.reduce((total, item) => {
      const childCount = item.children ? countRecursive(item.children) : 0;
      return total + 1 + childCount;
    }, 0);
  };

  return countRecursive(filtered);
}

/**
 * Save quick filter preference to localStorage
 */
export function saveQuickFilterPreference(
  projectId: string,
  filterType: QuickFilterType,
): void {
  if (typeof window !== "undefined") {
    localStorage.setItem(`budget-quick-filter-${projectId}`, filterType);
  }
}

/**
 * Load quick filter preference from localStorage
 */
export function loadQuickFilterPreference(projectId: string): QuickFilterType {
  if (typeof window !== "undefined") {
    const saved = localStorage.getItem(`budget-quick-filter-${projectId}`);
    if (
      saved &&
      ["all", "over-budget", "under-budget", "no-activity", "with-direct-costs"].includes(saved)
    ) {
      return saved as QuickFilterType;
    }
  }
  return "all";
}
