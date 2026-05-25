/**
 * Unit tests for shared financial and date utilities.
 * These are pure functions — no mocking needed.
 */

import {
  calculateFixedPayoutSettlement,
  calculateRevenueShareSettlement,
  calculateBalanceDue,
  calculateOccupancyRate,
  calculateCollectionRate,
  roundToTwoDecimals,
  getProratedRent,
  getRentDueDate,
  isRentOverdue,
  getNextRentMonth,
} from '@pg-system/utils';

// ─── Settlement calculations ──────────────────────────────────────────────────

describe('calculateFixedPayoutSettlement', () => {
  it('gives owner the fixed amount and operator gets the rest', () => {
    const result = calculateFixedPayoutSettlement(10000, 8000);
    expect(result.ownerPayout).toBe(8000);
    expect(result.operatorProfit).toBe(2000);
  });

  it('operator absorbs deficit when collected < fixed payout', () => {
    const result = calculateFixedPayoutSettlement(5000, 8000);
    expect(result.ownerPayout).toBe(8000);
    expect(result.operatorProfit).toBe(-3000);
  });

  it('operator profit is zero when exactly at fixed payout', () => {
    const result = calculateFixedPayoutSettlement(8000, 8000);
    expect(result.ownerPayout).toBe(8000);
    expect(result.operatorProfit).toBe(0);
  });

  it('handles decimal amounts correctly without floating-point drift', () => {
    const result = calculateFixedPayoutSettlement(10000.5, 6666.67);
    expect(result.ownerPayout).toBe(6666.67);
    expect(result.operatorProfit).toBeCloseTo(3333.83, 2);
  });
});

describe('calculateRevenueShareSettlement', () => {
  it('splits 70/30 correctly', () => {
    const result = calculateRevenueShareSettlement(10000, 70, 30);
    expect(result.ownerPayout).toBe(7000);
    expect(result.operatorProfit).toBe(3000);
  });

  it('owner + operator always sum to collected amount', () => {
    const collected = 12345;
    const result = calculateRevenueShareSettlement(collected, 60, 40);
    expect(result.ownerPayout + result.operatorProfit).toBe(collected);
  });

  it('throws when percentages do not sum to 100', () => {
    expect(() => calculateRevenueShareSettlement(10000, 60, 50)).toThrow();
    expect(() => calculateRevenueShareSettlement(10000, 30, 30)).toThrow();
  });

  it('handles 100/0 split (owner takes everything)', () => {
    const result = calculateRevenueShareSettlement(5000, 100, 0);
    expect(result.ownerPayout).toBe(5000);
    expect(result.operatorProfit).toBe(0);
  });
});

// ─── Balance calculations ─────────────────────────────────────────────────────

describe('calculateBalanceDue', () => {
  it('returns full rent when nothing paid', () => {
    expect(calculateBalanceDue(8000, 0)).toBe(8000);
  });

  it('returns 0 when fully paid', () => {
    expect(calculateBalanceDue(8000, 8000)).toBe(0);
  });

  it('returns remaining after partial payment', () => {
    expect(calculateBalanceDue(8000, 3000)).toBe(5000);
  });

  it('never returns negative even on overpayment', () => {
    expect(calculateBalanceDue(8000, 9000)).toBe(0);
  });
});

// ─── Rate calculations ────────────────────────────────────────────────────────

describe('calculateOccupancyRate', () => {
  it('returns 0 when no beds', () => {
    expect(calculateOccupancyRate(0, 0)).toBe(0);
  });

  it('returns 100 when all beds occupied', () => {
    expect(calculateOccupancyRate(10, 10)).toBe(100);
  });

  it('returns 50 for half occupancy', () => {
    expect(calculateOccupancyRate(5, 10)).toBe(50);
  });

  it('rounds to 2 decimal places', () => {
    const rate = calculateOccupancyRate(1, 3); // 33.33...%
    expect(rate).toBe(33.33);
  });
});

describe('calculateCollectionRate', () => {
  it('returns 100 when expected is 0 (no cycles this month)', () => {
    expect(calculateCollectionRate(0, 0)).toBe(100);
  });

  it('returns 100 when fully collected', () => {
    expect(calculateCollectionRate(10000, 10000)).toBe(100);
  });

  it('returns 0 when nothing collected', () => {
    expect(calculateCollectionRate(0, 10000)).toBe(0);
  });

  it('returns correct partial rate', () => {
    expect(calculateCollectionRate(7500, 10000)).toBe(75);
  });
});

// ─── Rent date utilities ──────────────────────────────────────────────────────

describe('getRentDueDate', () => {
  it('returns correct due date for normal months', () => {
    const d = getRentDueDate(5, 2024, 1);
    expect(d.getFullYear()).toBe(2024);
    expect(d.getMonth()).toBe(4); // May = index 4
    expect(d.getDate()).toBe(1);
  });

  it('clamps day to end of month for short months', () => {
    const d = getRentDueDate(2, 2023, 31); // February 2023 only has 28 days
    expect(d.getDate()).toBe(28);
  });

  it('handles leap year February correctly', () => {
    const d = getRentDueDate(2, 2024, 31); // Feb 2024 has 29 days
    expect(d.getDate()).toBe(29);
  });
});

describe('getNextRentMonth', () => {
  it('increments month within same year', () => {
    const result = getNextRentMonth(5, 2024);
    expect(result.month).toBe(6);
    expect(result.year).toBe(2024);
  });

  it('rolls over to January of next year', () => {
    const result = getNextRentMonth(12, 2024);
    expect(result.month).toBe(1);
    expect(result.year).toBe(2025);
  });
});

describe('isRentOverdue', () => {
  it('returns false before grace period ends', () => {
    const dueDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000); // 3 days from now
    expect(isRentOverdue(dueDate, 5)).toBe(false);
  });

  it('returns true well past grace period', () => {
    const dueDate = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000); // 15 days ago
    expect(isRentOverdue(dueDate, 5)).toBe(true);
  });
});

// ─── Prorated rent ────────────────────────────────────────────────────────────

describe('getProratedRent', () => {
  it('returns full rent when moved in on day 1', () => {
    const moveIn = new Date(2024, 4, 1); // May 1
    const result = getProratedRent(8000, moveIn, 5, 2024);
    expect(result).toBe(8000);
  });

  it('returns approx half rent when moved in on day 16 of 31-day month', () => {
    const moveIn = new Date(2024, 4, 16); // May 16 — 16 days left in May
    const result = getProratedRent(8000, moveIn, 5, 2024);
    // 16 days / 31 days * 8000 ≈ 4129
    expect(result).toBeGreaterThan(4000);
    expect(result).toBeLessThan(5000);
  });

  it('returns 0 when move-in is after month end', () => {
    const moveIn = new Date(2024, 5, 1); // June 1, asking for May
    const result = getProratedRent(8000, moveIn, 5, 2024);
    expect(result).toBe(0);
  });

  it('returns correct amount when moved in before month start', () => {
    const moveIn = new Date(2024, 3, 15); // April 15, asking for May
    const result = getProratedRent(8000, moveIn, 5, 2024);
    expect(result).toBe(8000); // Full month (moved in before May)
  });
});

// ─── Decimal precision ────────────────────────────────────────────────────────

describe('roundToTwoDecimals', () => {
  it('rounds to 2 decimal places', () => {
    expect(roundToTwoDecimals(10.005)).toBe(10.01);
    expect(roundToTwoDecimals(10.004)).toBe(10);
    expect(roundToTwoDecimals(100)).toBe(100);
  });

  it('avoids 0.1 + 0.2 floating point drift', () => {
    // 0.1 + 0.2 in IEEE 754 = 0.30000000000000004
    expect(roundToTwoDecimals(0.1 + 0.2)).toBe(0.3);
  });
});
