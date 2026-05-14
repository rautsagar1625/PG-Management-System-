export const SYSTEM_ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  USER: 'USER',
} as const;

export const PROPERTY_ROLES = {
  OWNER: 'OWNER',
  OPERATOR: 'OPERATOR',
  CO_OPERATOR: 'CO_OPERATOR',
  STAFF: 'STAFF',
} as const;

/**
 * Role hierarchy for permission checks.
 * Higher value = more permissions within a property context.
 */
export const PROPERTY_ROLE_WEIGHT: Record<string, number> = {
  OWNER: 100,
  OPERATOR: 80,
  CO_OPERATOR: 60,
  STAFF: 20,
};

/**
 * Roles that can manage financial operations.
 */
export const FINANCIAL_ROLES = [
  PROPERTY_ROLES.OWNER,
  PROPERTY_ROLES.OPERATOR,
  PROPERTY_ROLES.CO_OPERATOR,
] as const;

/**
 * Roles that can record payments.
 */
export const PAYMENT_RECORDING_ROLES = [
  PROPERTY_ROLES.OPERATOR,
  PROPERTY_ROLES.CO_OPERATOR,
  PROPERTY_ROLES.STAFF,
] as const;
