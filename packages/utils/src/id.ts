import { RECEIPT_PREFIX, TENANT_CODE_PREFIX } from '@pg-system/constants';

/**
 * Generates a tenant code in the format: PG-XXXXX (5 random alphanumeric chars, uppercase).
 * Uniqueness must be verified at the database level.
 */
export function generateTenantCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 5; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return `${TENANT_CODE_PREFIX}-${code}`;
}

/**
 * Generates a receipt number in the format: RCP-YYYYMM-XXXXX
 */
export function generateReceiptNumber(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const chars = '0123456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let suffix = '';
  for (let i = 0; i < 5; i++) {
    suffix += chars[Math.floor(Math.random() * chars.length)];
  }
  return `${RECEIPT_PREFIX}-${year}${month}-${suffix}`;
}

/**
 * Generates a sequential number with zero-padded prefix.
 * e.g. formatSequence(42, 5) → "00042"
 */
export function formatSequence(n: number, padLength: number = 5): string {
  return String(n).padStart(padLength, '0');
}
