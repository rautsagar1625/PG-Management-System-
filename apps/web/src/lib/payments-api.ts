import { apiClient } from './api';

export type RentCycleStatus = 'PENDING' | 'PARTIAL' | 'PAID' | 'OVERDUE' | 'WAIVED';
export type PaymentMethod = 'CASH' | 'UPI' | 'BANK_TRANSFER' | 'CHEQUE' | 'DEPOSIT_ADJUSTMENT';

export interface RentCycle {
  id: string;
  tenantId: string;
  month: number;
  year: number;
  dueDate: string;
  rentAmount: number;
  paidAmount: number;
  remainingAmount: number;
  status: RentCycleStatus;
  tenant: {
    id: string;
    tenantCode: string;
    user: { name: string; phone: string | null };
    allocations: {
      isActive: boolean;
      bed: { label: string; room: { number: string } };
    }[];
  };
  payments: {
    id: string;
    amount: number;
    method: PaymentMethod;
    paidAt: string;
    receipt: { receiptNo: string } | null;
  }[];
}

export interface RecordPaymentDto {
  tenantId: string;
  rentCycleId: string;
  amount: number;
  method: PaymentMethod;
  reference?: string;
  paidAt?: string;
  notes?: string;
}

export interface PaymentSummary {
  totalExpected: number;
  totalCollected: number;
  totalPending: number;
  overdueCount: number;
  paidCount: number;
  partialCount: number;
  pendingCount: number;
}

export async function getRentCycles(params: {
  propertyId?: string;
  tenantId?: string;
  status?: string;
  month?: number;
  year?: number;
}): Promise<{ cycles: RentCycle[]; summary: PaymentSummary }> {
  const { data } = await apiClient.get<{
    success: boolean;
    data: { cycles: RentCycle[]; summary: PaymentSummary };
  }>('/rent', { params });
  return data.data;
}

export async function recordPayment(dto: RecordPaymentDto): Promise<RentCycle> {
  const { data } = await apiClient.post<{ success: boolean; data: RentCycle }>(
    '/rent/payment',
    dto,
  );
  return data.data;
}

export async function generateCycles(propertyId: string): Promise<{ generated: number }> {
  const { data } = await apiClient.post<{ success: boolean; data: { generated: number } }>(
    '/rent/generate',
    { propertyId },
  );
  return data.data;
}

export async function markOverdue(propertyId: string): Promise<{ marked: number }> {
  const { data } = await apiClient.post<{ success: boolean; data: { marked: number } }>(
    '/rent/mark-overdue',
    { propertyId },
  );
  return data.data;
}
