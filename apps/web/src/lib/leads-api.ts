import { apiClient } from './api';

export interface Lead {
  id: string;
  propertyId: string;
  name: string;
  phone: string;
  email?: string;
  source: string;
  status: string; // 'NEW'|'CONTACTED'|'VISIT_SCHEDULED'|'VISITED'|'NEGOTIATING'|'TOKEN_PAID'|'CONVERTED'|'LOST'
  budget?: number;
  moveInDate?: string;
  roomType?: string;
  notes?: string;
  assignedTo?: string;
  visitDate?: string;
  tokenAmount?: number;
  convertedAt?: string;
  tenantId?: string;
  createdBy: string;
  createdAt: string;
}

export type CreateLeadDto = Pick<Lead, 'propertyId' | 'name' | 'phone'> &
  Partial<Pick<Lead, 'email' | 'source' | 'budget' | 'moveInDate' | 'roomType' | 'notes'>>;

export const getLeads = (propertyId: string, status?: string) =>
  apiClient
    .get('/leads', { params: { propertyId, status } })
    .then((r) => r.data.data as Lead[]);

export const createLead = (dto: CreateLeadDto) =>
  apiClient.post('/leads', dto).then((r) => r.data.data as Lead);

export const updateLeadStatus = (id: string, status: string, notes?: string) =>
  apiClient
    .put(`/leads/${id}/status`, { status, notes })
    .then((r) => r.data.data as Lead);

export const assignLead = (id: string, assignedTo: string) =>
  apiClient
    .put(`/leads/${id}/assign`, { assignedTo })
    .then((r) => r.data.data as Lead);

export const scheduleVisit = (id: string, visitDate: string) =>
  apiClient
    .put(`/leads/${id}/schedule-visit`, { visitDate })
    .then((r) => r.data.data as Lead);
