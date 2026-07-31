import type { BudgetLineItem, BudgetGrandTotals } from "@/types/budget";

export type GroupingType =
  | "none"
  | "cost-code-tier-1"
  | "cost-code-tier-2"
  | "cost-code-tier-3";

/**
 * Extract the division code from a cost code (e.g., "01-100" -> "01")
 */
function getDivisionCode(costCode: string): string {
  const parts = costCode.split("-");
  return parts[0] || costCode;
}

/**
 * Extract the subdivision code from a cost code (e.g., "01-100-10" -> "01-100")
 */
function getSubdivisionCode(costCode: string): string {
  const parts = costCode.split("-");
  return parts.length >= 2 ? `${parts[0]}-${parts[1]}` : costCode;
}

/**
 * Get division name from cost code (you may want to maintain a mapping for this)
 */
function getDivisionName(divisionCode: string): string {
  const divisionNames: Record<string, string> = {
    "00": "Procurement & Contracting",
    "01": "General Conditions",
    "02": "Existing Conditions",
    "03": "Concrete",
    "04": "Masonry",
    "05": "Metals",
    "06": "Wood, Plastics & Composites",
    "07": "Thermal & Moisture Protection",
    "08": "Openings",
    "09": "Finishes",
    "10": "Specialties",
    "11": "Equipment",
    "12": "Furnishings",
    "13": "Special Construction",
    "14": "Conveying Equipment",
    "15": "Mechanical",
    "16": "Electrical",
    "21": "Fire Suppression",
    "22": "Plumbing",
    "23": "HVAC",
    "25": "Integrated Automation",
    "26": "Electrical",
    "27": "Communications",
    "28": "Electronic Safety & Security",
    "31": "Earthwork",
    "32": "Exterior Improvements",
    "33": "Utilities",
    "34": "Transportation",
    "35": "Waterway & Marine Construction",
    "40": "Process Integration",
    "41": "Material Processing & Handling",
    "42": "Process Heating, Cooling & Drying",
    "43": "Process Gas & Liquid Handling",
    "44": "Pollution & Waste Control",
    "45": "Industry-Specific Manufacturing Equipment",
    "46": "Water & Wastewater",
    "48": "Electrical Power Generation",
    "50": "Engineering",
    "51": "Space Planning",
    "52": "Architectural Services",
    "53": "Land-Closing Cost",
    "54": "Commissions",
    "55": "Contractor Fee",
  };

  return divisionNames[divisionCode] || `Division ${divisionCode}`;
}

/**
 * Resolve the display title for a division group row.
 *
 * Prefers the database-backed division title carried on the line items
 * (cost_code_divisions.title, e.g. "50 Engineering"); the leading division
 * code is stripped because the group row already renders the code. Falls
 * back to the static CSI map for lines without a division record.
 */
function resolveDivisionTitle(
  divisionCode: string,
  items: BudgetLineItem[],
): string {
  const dbTitle = items
    .map((item) => item.divisionTitle?.trim())
    .find((title): title is string => Boolean(title));
  if (dbTitle) {
    return dbTitle.startsWith(`${divisionCode} `)
      ? dbTitle.slice(divisionCode.length + 1)
      : dbTitle;
  }
  return getDivisionName(divisionCode);
}

/**
 * Aggregate totals for a group of budget line items
 */
function aggregateTotals(
  items: BudgetLineItem[],
): Omit<BudgetLineItem, "id" | "costCode" | "description"> {
  return items.reduce(
    (acc, item) => ({
      originalBudgetAmount:
        acc.originalBudgetAmount + item.originalBudgetAmount,
      budgetModifications: acc.budgetModifications + item.budgetModifications,
      approvedCOs: acc.approvedCOs + item.approvedCOs,
      revisedBudget: acc.revisedBudget + item.revisedBudget,
      jobToDateCostDetail: acc.jobToDateCostDetail + item.jobToDateCostDetail,
      directCosts: acc.directCosts + item.directCosts,
      pendingChanges: acc.pendingChanges + item.pendingChanges,
      projectedBudget: acc.projectedBudget + item.projectedBudget,
      committedCosts: acc.committedCosts + item.committedCosts,
      pendingCostChanges: acc.pendingCostChanges + item.pendingCostChanges,
      projectedCosts: acc.projectedCosts + item.projectedCosts,
      forecastToComplete: acc.forecastToComplete + item.forecastToComplete,
      estimatedCostAtCompletion:
        acc.estimatedCostAtCompletion + item.estimatedCostAtCompletion,
      projectedOverUnder: acc.projectedOverUnder + item.projectedOverUnder,
      unitQty: undefined,
      uom: undefined,
      unitCost: undefined,
    }),
    {
      originalBudgetAmount: 0,
      budgetModifications: 0,
      approvedCOs: 0,
      revisedBudget: 0,
      jobToDateCostDetail: 0,
      directCosts: 0,
      pendingChanges: 0,
      projectedBudget: 0,
      committedCosts: 0,
      pendingCostChanges: 0,
      projectedCosts: 0,
      forecastToComplete: 0,
      estimatedCostAtCompletion: 0,
      projectedOverUnder: 0,
      unitQty: undefined,
      uom: undefined,
      unitCost: undefined,
    },
  );
}

/**
 * Group budget items by cost code tier 1 (division level)
 */
export function groupByDivision(items: BudgetLineItem[]): BudgetLineItem[] {
  const groups = new Map<string, BudgetLineItem[]>();

  // Group items by division code
  items.forEach((item) => {
    const divisionCode = getDivisionCode(item.costCode);
    if (!groups.has(divisionCode)) {
      groups.set(divisionCode, []);
    }
    groups.get(divisionCode)!.push(item);
  });

  // Create parent rows with children
  const result: BudgetLineItem[] = [];
  Array.from(groups.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([divisionCode, divisionItems]) => {
      const totals = aggregateTotals(divisionItems);
      const divisionName = resolveDivisionTitle(divisionCode, divisionItems);

      result.push({
        id: `division-${divisionCode}`,
        costCode: divisionCode,
        description: divisionName,
        ...totals,
        children: divisionItems.sort((a, b) =>
          a.costCode.localeCompare(b.costCode),
        ),
        expanded: false, // Start collapsed
      });
    });

  return result;
}

/**
 * Group budget items by cost code tier 2 (subdivision level)
 */
export function groupBySubdivision(items: BudgetLineItem[]): BudgetLineItem[] {
  const divisions = new Map<string, Map<string, BudgetLineItem[]>>();

  // Group items by division and subdivision
  items.forEach((item) => {
    const divisionCode = getDivisionCode(item.costCode);
    const subdivisionCode = getSubdivisionCode(item.costCode);

    if (!divisions.has(divisionCode)) {
      divisions.set(divisionCode, new Map());
    }

    const subdivisions = divisions.get(divisionCode)!;
    if (!subdivisions.has(subdivisionCode)) {
      subdivisions.set(subdivisionCode, []);
    }

    subdivisions.get(subdivisionCode)!.push(item);
  });

  // Create hierarchical structure
  const result: BudgetLineItem[] = [];
  Array.from(divisions.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([divisionCode, subdivisions]) => {
      const allDivisionItems: BudgetLineItem[] = [];

      // Create subdivision groups
      const subdivisionGroups: BudgetLineItem[] = [];
      Array.from(subdivisions.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .forEach(([subdivisionCode, subdivisionItems]) => {
          allDivisionItems.push(...subdivisionItems);

          const totals = aggregateTotals(subdivisionItems);
          subdivisionGroups.push({
            id: `subdivision-${subdivisionCode}`,
            costCode: subdivisionCode,
            description: subdivisionItems[0]?.description || subdivisionCode,
            ...totals,
            children: subdivisionItems.sort((a, b) =>
              a.costCode.localeCompare(b.costCode),
            ),
            expanded: false,
          });
        });

      // Create division parent
      const divisionTotals = aggregateTotals(allDivisionItems);
      const divisionName = resolveDivisionTitle(divisionCode, allDivisionItems);

      result.push({
        id: `division-${divisionCode}`,
        costCode: divisionCode,
        description: divisionName,
        ...divisionTotals,
        children: subdivisionGroups,
        expanded: false,
      });
    });

  return result;
}

/**
 * Apply grouping to budget data based on selected grouping type
 */
export function applyGrouping(
  items: BudgetLineItem[],
  grouping: GroupingType,
): BudgetLineItem[] {
  switch (grouping) {
    case "cost-code-tier-1":
      return groupByDivision(items);
    case "cost-code-tier-2":
      return groupBySubdivision(items);
    case "cost-code-tier-3":
      // For tier 3, you might want even deeper nesting
      // For now, use subdivision as a placeholder
      return groupBySubdivision(items);
    case "none":
    default:
      return items;
  }
}

/**
 * Calculate grand totals from grouped data
 */
export function calculateGrandTotals(
  items: BudgetLineItem[],
): BudgetGrandTotals {
  // Flatten the hierarchy to get all leaf nodes
  function flattenItems(items: BudgetLineItem[]): BudgetLineItem[] {
    const result: BudgetLineItem[] = [];
    items.forEach((item) => {
      if (item.children && item.children.length > 0) {
        result.push(...flattenItems(item.children));
      } else {
        result.push(item);
      }
    });
    return result;
  }

  const leafItems = flattenItems(items);
  return aggregateTotals(leafItems);
}
