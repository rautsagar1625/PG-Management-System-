import { apiClient } from './api';

export type TenantStatus =
  | 'LEAD'
  | 'VISIT_SCHEDULED'
  | 'VISITED'
  | 'ROOM_FINALIZED'
  | 'DEPOSIT_PENDING'
  | 'KYC_PENDING'
  | 'ACTIVE'
  | 'NOTICE_PERIOD'
  | 'MOVED_OUT'
  | 'REJECTED';

export type KycStatus = 'PENDING' | 'SUBMITTED' | 'VERIFIED' | 'REJECTED';
export type DepositStatus =
  | 'PENDING'
  | 'PARTIALLY_PAID'
  | 'PAID'
  | 'REFUNDED'
  | 'PARTIALLY_REFUNDED'
  | 'FORFEITED';

export interface TenantUser {
  id: string;
  name: string;
  email: string;
  phone: string | null;
}

export interface TenantAllocation {
  id: string;
  bedId: string;
  startDate: string;
  endDate: string | null;
  isActive: boolean;
  monthlyRent: number;
  reason: 'INITIAL' | 'TRANSFER';
  bed: {
    id: string;
    label: string;
    room: { id: string; number: string; floor: number | null };
  };
}

export interface Tenant {
  id: string;
  userId: string;
  propertyId: string;
  tenantCode: string;
  status: TenantStatus;
  kycStatus: KycStatus;
  depositAmount: number;
  depositBalance: number;
  depositStatus: DepositStatus;
  moveInDate: string | null;
  moveOutDate: string | null;
  noticeDate: string | null;
  visitScheduledAt: string | null;
  visitedAt: string | null;
  leadSource: string | null;
  notes: string | null;
  createdAt: string;
  user: TenantUser;
  allocations: TenantAllocation[];
}

export interface TenantDetail extends Tenant {
  rentCycles: RentCycle[];
  payments: Payment[];
  emergencyContacts: EmergencyContact[];
  documents: TenantDocument[];
  complaints: TenantComplaint[];
}

export interface RentCycle {
  id: string;
  month: number;
  year: number;
  dueDate: string;
  rentAmount: number;
  paidAmount: number;
  remainingAmount: number;
  status: string;
}

export interface Payment {
  id: string;
  amount: number;
  type: string;
  method: string;
  paidAt: string;
  receipt?: { receiptNo: string };
}

export interface EmergencyContact {
  id: string;
  name: string;
  phone: string;
  relation: string;
}

export interface TenantDocument {
  id: string;
  type: string;
  documentNumber: string;
  fileUrl: string | null;
  verifiedAt: string | null;
}

export interface TenantComplaint {
  id: string;
  title: string;
  status: string;
  createdAt: string;
}

export interface PaginatedTenants {
  tenants: Tenant[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

// ── DTOs ─────────────────────────────────────────────────────────────

export interface CreateTenantDto {
  name: string;
  email: string;
  phone: string;
  propertyId: string;
  leadSource?: string;
  depositAmount: number;
}

export interface MoveInDto {
  bedId: string;
  moveInDate: string;
  monthlyRent: number;
  depositAmount: number;
  depositPaid: boolean;
  kycSubmitted: boolean;
}

export interface MoveOutDto {
  moveOutDate: string;
  depositRefundAmount?: number;
  depositForfeitAmount?: number;
  notes?: string;
}

export interface RoomTransferDto {
  newBedId: string;
  transferDate: string;
  newMonthlyRent?: number;
  notes?: string;
}

// ── Queries ──────────────────────────────────────────────────────────

export async function getTenants(params: {
  propertyId?: string;
  status?: string;
  search?: string;
  page?: number;
  limit?: number;
}): Promise<PaginatedTenants> {
  const { data } = await apiClient.get<{ success: boolean; data: PaginatedTenants; meta: PaginatedTenants['meta'] }>(
    '/tenants',
    { params },
  );
  // Handle both envelope formats
  return data.data ?? ({ tenants: (data as unknown as { data: Tenant[] }).data, meta: { total: 0, page: 1, limit: 20, totalPages: 1 } });
}

export async function getTenant(id: string): Promise<TenantDetail> {
  const { data } = await apiClient.get<{ success: boolean; data: TenantDetail }>(
    `/tenants/${id}`,
  );
  return data.data;
}

// ── Mutations ────────────────────────────────────────────────────────

export async function createTenant(dto: CreateTenantDto): Promise<Tenant> {
  const { data } = await apiClient.post<{ success: boolean; data: Tenant }>('/tenants', dto);
  return data.data;
}

export async function scheduleVisit(
  id: string,
  visitDate: string,
  notes?: string,
): Promise<Tenant> {
  const { data } = await apiClient.put<{ success: boolean; data: Tenant }>(
    `/tenants/${id}/schedule-visit`,
    { visitDate, notes },
  );
  return data.data;
}

export async function markVisited(id: string): Promise<Tenant> {
  const { data } = await apiClient.put<{ success: boolean; data: Tenant }>(
    `/tenants/${id}/mark-visited`,
  );
  return data.data;
}

export async function finalizeRoom(
  id: string,
  bedId: string,
  depositAmount: number,
): Promise<Tenant> {
  const { data } = await apiClient.put<{ success: boolean; data: Tenant }>(
    `/tenants/${id}/finalize-room`,
    { bedId, depositAmount },
  );
  return data.data;
}

export async function moveIn(id: string, dto: MoveInDto): Promise<Tenant> {
  const { data } = await apiClient.put<{ success: boolean; data: Tenant }>(
    `/tenants/${id}/move-in`,
    dto,
  );
  return data.data;
}

export async function initiateNotice(id: string): Promise<Tenant> {
  const { data } = await apiClient.put<{ success: boolean; data: Tenant }>(
    `/tenants/${id}/initiate-notice`,
  );
  return data.data;
}

export async function moveOut(id: string, dto: MoveOutDto): Promise<Tenant> {
  const { data } = await apiClient.put<{ success: boolean; data: Tenant }>(
    `/tenants/${id}/move-out`,
    dto,
  );
  return data.data;
}

export async function roomTransfer(id: string, dto: RoomTransferDto): Promise<Tenant> {
  const { data } = await apiClient.put<{ success: boolean; data: Tenant }>(
    `/tenants/${id}/transfer-room`,
    dto,
  );
  return data.data;
}
