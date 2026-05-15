import { apiClient } from './api';

export interface AuditLog {
  id: string;
  propertyId: string | null;
  userId: string | null;
  entity: string;
  entityId: string;
  action: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  user: { id: string; name: string } | null;
}

export interface AuditLogsResponse {
  data: AuditLog[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

export async function getAuditLogs(params: {
  propertyId?: string;
  userId?: string;
  entity?: string;
  action?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}): Promise<AuditLogsResponse> {
  const { data } = await apiClient.get<{ success: boolean } & AuditLogsResponse>('/audit', {
    params,
  });
  return { data: data.data, meta: data.meta };
}
