import type { ID } from './common';

export type FinancialModelType = 'FIXED_PAYOUT' | 'REVENUE_SHARE' | 'OWNER_OPERATED';

export type RentCycleStatus =
  | 'PENDING'
  | 'DUE'
  | 'PARTIAL'
  | 'PAID'
  | 'OVERDUE'
  | 'WAIVED';

export type PaymentType =
  | 'RENT'
  | 'DEPOSIT'
  | 'DEPOSIT_REFUND'
  | 'MAINTENANCE'
  | 'FINE'
  | 'OTHER';

export type PaymentMethod =
  | 'CASH'
  | 'UPI'
  | 'BANK_TRANSFER'
  | 'CHEQUE'
  | 'CARD'
  | 'ONLINE';

export type SettlementStatus = 'PENDING' | 'CALCULATED' | 'PAID' | 'DISPUTED';

export interface FinancialModel {
  id: ID;
  propertyId: ID;
  type: FinancialModelType;
  fixedOwnerPayout?: number;
  ownerSharePercent?: number;
  operatorSharePercent?: number;
  isActive: boolean;
  effectiveFrom: string;
  effectiveTo?: string;
}

export interface RentCycle {
  id: ID;
  tenantId: ID;
  tenantName: string;
  tenantCode: string;
  propertyId: ID;
  month: number;
  year: number;
  dueDate: string;
  rentAmount: number;
  paidAmount: number;
  balanceDue: number;
  lateFee: number;
  status: RentCycleStatus;
  payments: PaymentSummary[];
  createdAt: string;
  updatedAt: string;
}

export interface PaymentSummary {
  id: ID;
  amount: number;
  type: PaymentType;
  method: PaymentMethod;
  paymentDate: string;
  receiptNo?: string;
}

export interface Payment {
  id: ID;
  tenantId: ID;
  tenantName: string;
  propertyId: ID;
  rentCycleId?: ID;
  amount: number;
  type: PaymentType;
  method: PaymentMethod;
  referenceNo?: string;
  notes?: string;
  recordedBy: ID;
  paymentDate: string;
  receipt?: Receipt;
  createdAt: string;
}

export interface Receipt {
  id: ID;
  receiptNo: string;
  paymentId: ID;
  tenantId: ID;
  tenantName: string;
  propertyId: ID;
  generatedAt: string;
}

export interface Settlement {
  id: ID;
  propertyId: ID;
  propertyName: string;
  financialModelId: ID;
  financialModelType: FinancialModelType;
  month: number;
  year: number;
  totalCollected: number;
  ownerPayout: number;
  operatorProfit: number;
  breakdown: SettlementBreakdown;
  status: SettlementStatus;
  settledAt?: string;
  createdAt: string;
}

export interface SettlementBreakdown {
  totalTenants: number;
  paidRents: number;
  pendingRents: number;
  partialRents: number;
  totalRentCollected: number;
  otherCollections: number;
  ownerPayoutCalculation: string;
}

export interface RecordPaymentDto {
  tenantId: ID;
  rentCycleId?: ID;
  amount: number;
  type: PaymentType;
  method: PaymentMethod;
  referenceNo?: string;
  notes?: string;
  paymentDate: string;
}

export interface SetFinancialModelDto {
  type: FinancialModelType;
  fixedOwnerPayout?: number;
  ownerSharePercent?: number;
  operatorSharePercent?: number;
  effectiveFrom: string;
}

export interface MonthlyFinancialSummary {
  propertyId: ID;
  month: number;
  year: number;
  totalExpected: number;
  totalCollected: number;
  totalPending: number;
  collectionRate: number;
  paidCount: number;
  partialCount: number;
  overdueCount: number;
  pendingCount: number;
}
