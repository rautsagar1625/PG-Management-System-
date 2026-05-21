import { apiClient } from './api';

export type MandateStatus =
  | 'CREATED'
  | 'PENDING'
  | 'ACTIVE'
  | 'PAUSED'
  | 'CANCELLED'
  | 'EXPIRED'
  | 'FAILED';

export interface AutopayMandate {
  id: string;
  tenantId: string;
  propertyId: string;
  externalId?: string | null;
  amount: number;
  bankAccount?: string | null;
  ifscCode?: string | null;
  accountName?: string | null;
  debitDay: number;
  status: MandateStatus;
  activatedAt?: string | null;
  cancelledAt?: string | null;
  failureReason?: string | null;
  createdAt: string;
  tenant: {
    user: { name: string; phone?: string | null };
  };
}

export interface CreateMandateDto {
  tenantId: string;
  propertyId: string;
  amount: number;
  bankAccount?: string;
  ifscCode?: string;
  accountName?: string;
  debitDay?: number;
}

export async function getMandates(propertyId: string): Promise<AutopayMandate[]> {
  const { data } = await apiClient.get<{ success: boolean; data: AutopayMandate[] }>(
    '/autopay',
    { params: { propertyId } },
  );
  return data.data;
}

export async function createMandate(
  dto: CreateMandateDto,
): Promise<AutopayMandate & { mandateLink?: string }> {
  const { data } = await apiClient.post<{
    success: boolean;
    data: AutopayMandate & { mandateLink?: string };
  }>('/autopay', dto);
  return data.data;
}

export async function cancelMandate(id: string): Promise<AutopayMandate> {
  const { data } = await apiClient.put<{ success: boolean; data: AutopayMandate }>(
    `/autopay/${id}/cancel`,
  );
  return data.data;
}

export async function createPaymentOrder(body: {
  tenantId: string;
  amount: number;
  propertyId: string;
}): Promise<{ orderId: string; amount: number; currency: string; keyId: string | undefined }> {
  const { data } = await apiClient.post<{
    success: boolean;
    data: { orderId: string; amount: number; currency: string; keyId: string | undefined };
  }>('/autopay/payment-order', body);
  return data.data;
}
