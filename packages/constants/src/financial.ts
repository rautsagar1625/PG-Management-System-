export const FINANCIAL_MODEL_TYPES = {
  FIXED_PAYOUT: 'FIXED_PAYOUT',
  REVENUE_SHARE: 'REVENUE_SHARE',
  OWNER_OPERATED: 'OWNER_OPERATED',
} as const;

export const PAYMENT_METHODS = {
  CASH: 'CASH',
  UPI: 'UPI',
  BANK_TRANSFER: 'BANK_TRANSFER',
  CHEQUE: 'CHEQUE',
  CARD: 'CARD',
  ONLINE: 'ONLINE',
} as const;

export const PAYMENT_TYPES = {
  RENT: 'RENT',
  DEPOSIT: 'DEPOSIT',
  DEPOSIT_REFUND: 'DEPOSIT_REFUND',
  MAINTENANCE: 'MAINTENANCE',
  FINE: 'FINE',
  OTHER: 'OTHER',
} as const;

export const SETTLEMENT_STATUSES = {
  PENDING: 'PENDING',
  CALCULATED: 'CALCULATED',
  PAID: 'PAID',
  DISPUTED: 'DISPUTED',
} as const;

export const RENT_CYCLE_STATUSES = {
  PENDING: 'PENDING',
  DUE: 'DUE',
  PARTIAL: 'PARTIAL',
  PAID: 'PAID',
  OVERDUE: 'OVERDUE',
  WAIVED: 'WAIVED',
} as const;

/** Default grace period after rent due date before marking as OVERDUE. */
export const RENT_GRACE_PERIOD_DAYS = 5;

/** Receipt number prefix format: RCP-YYYYMM-XXXXX */
export const RECEIPT_PREFIX = 'RCP';

/** Tenant code format: PG-XXXXX */
export const TENANT_CODE_PREFIX = 'PG';

/** Default late fee percentage of monthly rent. */
export const DEFAULT_LATE_FEE_PERCENT = 0;
