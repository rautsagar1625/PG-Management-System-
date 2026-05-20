import { apiClient } from './api';

export type ComplaintStatus = 'OPEN' | 'ASSIGNED' | 'IN_PROGRESS' | 'RESOLVED' | 'REOPENED' | 'CLOSED' | 'REJECTED';
export type ComplaintCategory =
  | 'MAINTENANCE'
  | 'PLUMBING'
  | 'ELECTRICAL'
  | 'HOUSEKEEPING'
  | 'SECURITY'
  | 'FOOD'
  | 'WIFI'
  | 'NOISE'
  | 'OTHER';
export type ComplaintPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export interface ComplaintUpdate {
  id: string;
  comment: string;
  statusChange: string | null;
  createdAt: string;
  user: { id: string; name: string };
}

export interface Complaint {
  id: string;
  propertyId: string;
  tenantId: string | null;
  title: string;
  description: string;
  category: ComplaintCategory;
  priority: ComplaintPriority;
  status: ComplaintStatus;
  assignedTo: string | null;
  resolvedAt: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
  tenant: { id: string; user: { name: string; phone?: string | null } } | null;
  assignedToUser: { id: string; name: string } | null;
  raisedByUser: { id: string; name: string };
  updates: ComplaintUpdate[];
  _count: { updates: number };
}

export interface CreateComplaintDto {
  propertyId: string;
  tenantId?: string;
  title: string;
  description: string;
  category: ComplaintCategory;
  priority?: ComplaintPriority;
}

export interface UpdateComplaintDto {
  status?: ComplaintStatus;
  assignedTo?: string;
  priority?: ComplaintPriority;
  comment?: string;
}

export async function getComplaints(params: {
  propertyId?: string;
  status?: string;
  category?: string;
}): Promise<Complaint[]> {
  const { data } = await apiClient.get<{ success: boolean; data: Complaint[] }>('/complaints', {
    params,
  });
  return data.data;
}

export async function getComplaint(id: string): Promise<Complaint> {
  const { data } = await apiClient.get<{ success: boolean; data: Complaint }>(`/complaints/${id}`);
  return data.data;
}

export async function createComplaint(dto: CreateComplaintDto): Promise<Complaint> {
  const { data } = await apiClient.post<{ success: boolean; data: Complaint }>('/complaints', dto);
  return data.data;
}

export async function updateComplaint(id: string, dto: UpdateComplaintDto): Promise<Complaint> {
  const { data } = await apiClient.put<{ success: boolean; data: Complaint }>(
    `/complaints/${id}`,
    dto,
  );
  return data.data;
}
