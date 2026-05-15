import { apiClient } from './api';

export type RentCycleStatus = 'PENDING' | 'DUE' | 'PARTIAL' | 'PAID' | 'OVERDUE' | 'WAIVED';
export type PaymentType = 'RENT' | 'DEPOSIT' | 'DEPOSIT_REFUND' | 'DEPOSIT_ADJUSTMENT' | 'FINE' | 'MISCELLANEOUS';
export type PaymentMethod = 'CASH' | 'UPI' | 'BANK_TRANSFER' | 'CHEQUE' | 'CARD' | 'ONLINE';

// ── Core types ────────────────────────────────────────────────────────────────

export interface CollectionCycle {
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
    user: { id: string; name: string; phone: string | null };
    allocations: {
      isActive: boolean;
      bed: { label: string; room: { number: string; floor: number | null } };
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

export interface CollectionSummary {
  totalCycles: number;
  totalExpected: number;
  totalCollected: number;
  totalRemaining: number;
  statusBreakdown: Record<string, { count: number; remaining: number }>;
}

export interface CollectionsResponse {
  cycles: CollectionCycle[];
  summary: CollectionSummary;
  meta: { total: number; page: number; limit: number; totalPages: number };
}

export interface RecordPaymentDto {
  tenantId: string;
  rentCycleId?: string;
  amount: number;
  type: PaymentType;
  method: PaymentMethod;
  referenceNo?: string;
  notes?: string;
  paidAt: string;
}

export interface RecordPaymentResult {
  payment: {
    id: string;
    amount: number;
    type: PaymentType;
    method: PaymentMethod;
    paidAt: string;
  };
  receiptNo: string;
}

export interface ReceiptDetail {
  receiptNo: string;
  issuedAt: string;
  tenantName: string;
  tenantPhone: string | null;
  tenantCode: string;
  amount: number;
  type: PaymentType;
  method: PaymentMethod;
  referenceNo: string | null;
  notes: string | null;
  paidAt: string;
  recordedBy: string;
  rentPeriod: { month: number; year: number } | null;
  propertyName: string;
  propertyAddress: string;
  roomNumber: string;
  bedLabel: string;
}

// ── Query functions ───────────────────────────────────────────────────────────

export async function getCollections(params: {
  propertyId: string;
  month: number;
  year: number;
  status?: string;
  search?: string;
  page?: number;
  limit?: number;
}): Promise<CollectionsResponse> {
  const { data } = await apiClient.get<{ success: boolean; data: CollectionsResponse }>(
    '/rent/collections',
    { params },
  );
  return data.data;
}

export async function getReceipt(receiptNo: string): Promise<ReceiptDetail> {
  const { data } = await apiClient.get<{ success: boolean; data: ReceiptDetail }>(
    `/rent/receipt/${receiptNo}`,
  );
  return data.data;
}

export async function getTenantRentCycles(
  tenantId: string,
  filters: { month?: number; year?: number; status?: string } = {},
) {
  const { data } = await apiClient.get<{ success: boolean; data: CollectionCycle[] }>(
    `/rent/tenant/${tenantId}/cycles`,
    { params: filters },
  );
  return data.data;
}

export async function getPropertySummary(propertyId: string, month: number, year: number) {
  const { data } = await apiClient.get<{
    success: boolean;
    data: {
      total: number;
      paid: number;
      partial: number;
      pending: number;
      overdue: number;
      totalExpected: number;
      totalCollected: number;
      totalRemaining: number;
    };
  }>(`/rent/property/${propertyId}/summary`, { params: { month, year } });
  return data.data;
}

// ── Mutation functions ────────────────────────────────────────────────────────

export async function recordPayment(dto: RecordPaymentDto): Promise<RecordPaymentResult> {
  const { data } = await apiClient.post<{ success: boolean; data: RecordPaymentResult }>(
    '/rent/payment',
    dto,
  );
  return data.data;
}

export async function generateCycles(
  propertyId: string,
  month: number,
  year: number,
): Promise<{ generated: number; total: number }> {
  const { data } = await apiClient.post<{
    success: boolean;
    data: { generated: number; total: number };
  }>('/rent/generate-cycles', { propertyId, month, year });
  return data.data;
}

export async function markOverdue(): Promise<{ markedOverdue: number }> {
  const { data } = await apiClient.put<{ success: boolean; data: { markedOverdue: number } }>(
    '/rent/mark-overdue',
  );
  return data.data;
}
