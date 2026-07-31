export interface CommitmentPcoLineItem {
  budget_code_id: string | null;
  description: string | null;
  amount: number | string | null;
}

export interface CommitmentChangeOrderLineInsert {
  commitment_change_order_id: string;
  budget_line_id: string | null;
  description: string | null;
  amount: number;
}

export function mapCommitmentPcoLineItemToCoLine(
  commitmentChangeOrderId: string,
  item: CommitmentPcoLineItem,
): CommitmentChangeOrderLineInsert {
  const amount = Number(item.amount ?? 0);

  return {
    commitment_change_order_id: commitmentChangeOrderId,
    budget_line_id: item.budget_code_id,
    description: item.description,
    amount: Number.isFinite(amount) ? amount : 0,
  };
}
