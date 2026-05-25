import { apiClient } from './api';

export type AgreementStatus = 'DRAFT' | 'SENT' | 'SIGNED' | 'EXPIRED' | 'CANCELLED';

export interface RentalAgreement {
  id: string;
  tenantId: string;
  propertyId: string;
  allocationId: string | null;
  status: AgreementStatus;
  terms: string;
  rentAmount: number | string;
  depositAmount: number | string;
  startDate: string;
  endDate: string | null;
  signedByTenantAt: string | null;
  signedByOwnerAt: string | null;
  createdAt: string;
  updatedAt: string;
  tenant?: {
    id: string;
    tenantCode: string;
    user: { id: string; name: string; phone: string };
  };
}

export interface CreateAgreementDto {
  tenantId: string;
  propertyId: string;
  terms: string;
  rentAmount: number;
  depositAmount: number;
  startDate: string;
  endDate?: string;
  allocationId?: string;
}

// ── Queries ──────────────────────────────────────────────────────────────────

export async function getAgreementsByTenant(tenantId: string): Promise<RentalAgreement[]> {
  const { data } = await apiClient.get<{ success: boolean; data: RentalAgreement[] }>(
    `/agreements/tenant/${tenantId}`,
  );
  return data.data;
}

export async function getAgreementsByProperty(propertyId: string): Promise<RentalAgreement[]> {
  const { data } = await apiClient.get<{ success: boolean; data: RentalAgreement[] }>(
    `/agreements?propertyId=${propertyId}`,
  );
  return data.data;
}

// ── Mutations ────────────────────────────────────────────────────────────────

export async function createAgreement(dto: CreateAgreementDto): Promise<RentalAgreement> {
  const { data } = await apiClient.post<{ success: boolean; data: RentalAgreement }>(
    '/agreements',
    dto,
  );
  return data.data;
}

export async function sendAgreement(id: string): Promise<RentalAgreement> {
  const { data } = await apiClient.put<{ success: boolean; data: RentalAgreement }>(
    `/agreements/${id}/send`,
  );
  return data.data;
}

export async function signAgreementByTenant(id: string): Promise<RentalAgreement> {
  const { data } = await apiClient.put<{ success: boolean; data: RentalAgreement }>(
    `/agreements/${id}/sign-tenant`,
  );
  return data.data;
}

export async function signAgreementByOwner(id: string): Promise<RentalAgreement> {
  const { data } = await apiClient.put<{ success: boolean; data: RentalAgreement }>(
    `/agreements/${id}/sign-owner`,
  );
  return data.data;
}

export async function cancelAgreement(id: string): Promise<RentalAgreement> {
  const { data } = await apiClient.put<{ success: boolean; data: RentalAgreement }>(
    `/agreements/${id}/cancel`,
  );
  return data.data;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

export const AGREEMENT_STATUS_LABELS: Record<AgreementStatus, string> = {
  DRAFT: 'Draft',
  SENT: 'Sent to Tenant',
  SIGNED: 'Fully Signed',
  EXPIRED: 'Expired',
  CANCELLED: 'Cancelled',
};

export const AGREEMENT_STATUS_STYLES: Record<AgreementStatus, string> = {
  DRAFT: 'bg-gray-100 text-gray-600',
  SENT: 'bg-blue-50 text-blue-700',
  SIGNED: 'bg-green-50 text-green-700',
  EXPIRED: 'bg-yellow-50 text-yellow-700',
  CANCELLED: 'bg-red-50 text-red-500',
};
