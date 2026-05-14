import { apiClient } from './api';

export type ComplaintStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
export type ComplaintCategory =
  | 'MAINTENANCE'
  | 'CLEANLINESS'
  | 'NOISE'
  | 'SECURITY'
  | 'FOOD'
  | 'BILLING'
  | 'STAFF'
  | 'FACILITIES'
  | 'OTHER';
export type ComplaintPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export interface ComplaintComment {
  id: string;
  content: string;
  createdAt: string;
  author: { id: string; name: string };
}

export interface Complaint {
  id: string;
  propertyId: string;
  tenantId: string;
  title: string;
  description: string;
  category: ComplaintCategory;
  priority: ComplaintPriority;
  status: ComplaintStatus;
  assignedToId: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  tenant: { id: string; tenantCode: string; user: { name: string; phone: string | null } };
  assignedTo: { id: string; name: string } | null;
  comments: ComplaintComment[];
  _count: { comments: number };
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
  assignedToId?: string;
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
