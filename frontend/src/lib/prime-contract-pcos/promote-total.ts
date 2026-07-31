type NumericValue = number | string | null | undefined;

interface PcoTotalSource {
  total_amount: NumericValue;
}

interface LineItemAmount {
  amount: NumericValue;
}

/**
 * Sum of the raw (base) line-item amounts, ignoring any contract financial markup.
 * Used only as a fallback when a PCO has no persisted total.
 */
export function sumPcoLineItemAmounts(
  lineItems: LineItemAmount[] | null | undefined,
): number {
  return (lineItems ?? []).reduce((sum, item) => {
    const value = Number(item.amount);
    return sum + (Number.isFinite(value) ? value : 0);
  }, 0);
}

/**
 * The total that should be stored on a PCCO when promoting a PCO.
 *
 * Prefers the PCO's persisted total (`prime_contract_pcos.total_amount`), which
 * already includes the prime contract's financial markup (insurance, fee, etc.)
 * and is the value shown on the PCO detail page and the promote confirmation
 * dialog. Only falls back to the raw sum of base line-item amounts when the PCO
 * has no stored total.
 *
 * This mirrors the `calculated_amount` the GET route returns
 * (`pco.total_amount ?? sum(line items)`), so the promoted change order matches
 * what the user was shown. Summing line items directly drops the markup.
 */
export function resolvePromotedPccoTotalAmount(
  pco: PcoTotalSource,
  lineItems: LineItemAmount[] | null | undefined,
): number {
  if (pco.total_amount !== null && pco.total_amount !== undefined) {
    const stored = Number(pco.total_amount);
    if (Number.isFinite(stored)) {
      return stored;
    }
  }
  return sumPcoLineItemAmounts(lineItems);
}
