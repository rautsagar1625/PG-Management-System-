import { apiClient } from './api';

export type DocumentType = 'AADHAAR' | 'PAN' | 'PASSPORT' | 'DRIVING_LICENSE' | 'VOTER_ID';

export interface KycDocument {
  id: string;
  tenantId: string;
  type: DocumentType;
  documentNumber: string;
  fileUrl?: string | null;
  verifiedAt?: string | null;
  verifiedBy?: string | null;
  createdAt: string;
}

export const DOC_TYPE_LABELS: Record<DocumentType, string> = {
  AADHAAR: 'Aadhaar Card',
  PAN: 'PAN Card',
  PASSPORT: 'Passport',
  DRIVING_LICENSE: 'Driving License',
  VOTER_ID: 'Voter ID',
};

export async function getDocuments(tenantId: string): Promise<KycDocument[]> {
  const { data } = await apiClient.get<{ success: boolean; data: KycDocument[] }>(
    `/kyc/tenant/${tenantId}`,
  );
  return data.data;
}

export async function addDocument(dto: {
  tenantId: string;
  type: DocumentType;
  documentNumber: string;
  fileUrl?: string;
}): Promise<KycDocument> {
  const { data } = await apiClient.post<{ success: boolean; data: KycDocument }>('/kyc', dto);
  return data.data;
}

export async function verifyDocument(id: string): Promise<void> {
  await apiClient.put(`/kyc/${id}/verify`);
}

export async function deleteDocument(id: string): Promise<void> {
  await apiClient.delete(`/kyc/${id}`);
}
