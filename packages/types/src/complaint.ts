import type { ID } from './common';

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

export type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export type ComplaintStatus =
  | 'OPEN'
  | 'ASSIGNED'
  | 'IN_PROGRESS'
  | 'RESOLVED'
  | 'CLOSED'
  | 'REJECTED';

export interface Complaint {
  id: ID;
  propertyId: ID;
  propertyName: string;
  tenantId?: ID;
  tenantName?: string;
  raisedBy: ID;
  raisedByName: string;
  assignedTo?: ID;
  assignedToName?: string;
  category: ComplaintCategory;
  title: string;
  description: string;
  priority: Priority;
  status: ComplaintStatus;
  comments: ComplaintComment[];
  resolvedAt?: string;
  closedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ComplaintComment {
  id: ID;
  userId: ID;
  userName: string;
  comment: string;
  createdAt: string;
}

export interface CreateComplaintDto {
  propertyId: ID;
  category: ComplaintCategory;
  title: string;
  description: string;
  priority: Priority;
}

export interface UpdateComplaintDto {
  status?: ComplaintStatus;
  assignedTo?: ID;
  priority?: Priority;
  comment?: string;
}
