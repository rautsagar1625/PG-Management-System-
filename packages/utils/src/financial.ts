/**
 * Calculates the owner payout and operator profit for a FIXED_PAYOUT financial model.
 * If total collected < fixed payout, owner still gets the fixed amount (operator is in deficit).
 */
export function calculateFixedPayoutSettlement(
  totalCollected: number,
  fixedOwnerPayout: number,
): { ownerPayout: number; operatorProfit: number } {
  const ownerPayout = fixedOwnerPayout;
  const operatorProfit = totalCollected - fixedOwnerPayout;
  return { ownerPayout, operatorProfit };
}

/**
 * Calculates owner and operator shares for a REVENUE_SHARE financial model.
 */
export function calculateRevenueShareSettlement(
  totalCollected: number,
  ownerSharePercent: number,
  operatorSharePercent: number,
): { ownerPayout: number; operatorProfit: number } {
  const ownerPayout = roundToTwoDecimals((totalCollected * ownerSharePercent) / 100);
  const operatorProfit = roundToTwoDecimals((totalCollected * operatorSharePercent) / 100);
  return { ownerPayout, operatorProfit };
}

/**
 * Rounds a number to 2 decimal places (safe for currency display).
 * For storage, always use Prisma Decimal type.
 */
export function roundToTwoDecimals(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Calculates the balance due after a partial payment.
 * Returns 0 if paidAmount >= rentAmount (never negative).
 */
export function calculateBalanceDue(rentAmount: number, paidAmount: number): number {
  return Math.max(0, roundToTwoDecimals(rentAmount - paidAmount));
}

/**
 * Calculates occupancy rate as a percentage (0-100).
 */
export function calculateOccupancyRate(occupiedBeds: number, totalBeds: number): number {
  if (totalBeds === 0) return 0;
  return roundToTwoDecimals((occupiedBeds / totalBeds) * 100);
}

/**
 * Calculates rent collection rate as a percentage.
 */
export function calculateCollectionRate(collected: number, expected: number): number {
  if (expected === 0) return 100;
  return roundToTwoDecimals((collected / expected) * 100);
}
