type NumericValue = number | string | null | undefined;

export interface PrimePcoLineItemForPromotion {
  description: string | null;
  budget_code_id: string | null;
  quantity: NumericValue;
  unit_cost: NumericValue;
  unit_of_measure: string | null;
  amount: NumericValue;
}

export interface PccoLineItemInsert {
  pcco_id: number;
  description: string | null;
  cost_code: string | null;
  quantity: number;
  unit_cost: number;
  uom: string | null;
}

function toFiniteNumber(value: NumericValue): number | null {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

export function mapPrimePcoLineItemToPccoLineItem(
  pccoId: number,
  item: PrimePcoLineItemForPromotion,
): PccoLineItemInsert {
  const amount = toFiniteNumber(item.amount);
  const sourceQuantity = toFiniteNumber(item.quantity);
  const sourceUnitCost = toFiniteNumber(item.unit_cost);
  const quantity =
    sourceQuantity !== null && Math.abs(sourceQuantity) > 0
      ? sourceQuantity
      : 1;
  const unitCost =
    amount !== null
      ? amount / quantity
      : sourceUnitCost ?? 0;

  return {
    pcco_id: pccoId,
    description: item.description,
    cost_code: item.budget_code_id,
    quantity,
    unit_cost: unitCost,
    uom: item.unit_of_measure,
  };
}
