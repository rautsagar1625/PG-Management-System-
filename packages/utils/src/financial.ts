/**
 * All monetary calculations use integer paise (1 INR = 100 paise) internally
 * to avoid IEEE 754 floating-point precision loss.
 *
 * Inputs and outputs are plain JS numbers representing rupee amounts with up
 * to 2 decimal places. The Prisma layer is responsible for storing as Decimal.
 */

function toPaise(rupees: number): number {
  return Math.round(rupees * 100);
}

function toRupees(paise: number): number {
  return paise / 100;
}

/**
 * Calculates the owner payout and operator profit for a FIXED_PAYOUT model.
 * If total collected < fixed payout, operator absorbs the deficit (negative profit).
 */
export function calculateFixedPayoutSettlement(
  totalCollected: number,
  fixedOwnerPayout: number,
): { ownerPayout: number; operatorProfit: number } {
  const collectedPaise = toPaise(totalCollected);
  const payoutPaise = toPaise(fixedOwnerPayout);
  const ownerPayout = toRupees(payoutPaise);
  const operatorProfit = toRupees(collectedPaise - payoutPaise);
  return { ownerPayout, operatorProfit };
}

/**
 * Calculates owner and operator shares for a REVENUE_SHARE model.
 * ownerSharePercent + operatorSharePercent must equal 100.
 */
export function calculateRevenueShareSettlement(
  totalCollected: number,
  ownerSharePercent: number,
  operatorSharePercent: number,
): { ownerPayout: number; operatorProfit: number } {
  if (Math.abs(ownerSharePercent + operatorSharePercent - 100) > 0.001) {
    throw new Error(
      `Share percentages must sum to 100, got ${ownerSharePercent + operatorSharePercent}`,
    );
  }
  const collectedPaise = toPaise(totalCollected);
  const ownerPaise = Math.round((collectedPaise * ownerSharePercent) / 100);
  // Assign remainder to operator to guarantee exact sum
  const operatorPaise = collectedPaise - ownerPaise;
  return {
    ownerPayout: toRupees(ownerPaise),
    operatorProfit: toRupees(operatorPaise),
  };
}

/**
 * Rounds a rupee amount to 2 decimal places (paise precision).
 * Prefer integer arithmetic above; use this only for display/output.
 */
export function roundToTwoDecimals(value: number): number {
  return toRupees(toPaise(value));
}

/**
 * Calculates the balance due after a partial payment. Never negative.
 */
export function calculateBalanceDue(rentAmount: number, paidAmount: number): number {
  const balancePaise = toPaise(rentAmount) - toPaise(paidAmount);
  return toRupees(Math.max(0, balancePaise));
}

/**
 * Calculates occupancy rate as a percentage (0–100).
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
