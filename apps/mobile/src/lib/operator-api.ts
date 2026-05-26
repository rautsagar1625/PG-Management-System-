import { api } from './api';

// ── Dashboard ─────────────────────────────────────────────────────────────────

export interface PropertyCard {
  propertyId: string;
  propertyName: string;
  city: string;
  occupancyRate: number;
  totalBeds: number;
  occupiedBeds: number;
  availableBeds: number;
  rentCollectionRate: number;
  totalExpectedRent: number;
  totalCollectedRent: number;
  pendingRent: number;
  openComplaints: number;
}

export interface GlobalSummary {
  totalProperties: number;
  totalMonthlyRevenue: number;
  totalPendingRent: number;
  totalOpenComplaints: number;
}

export interface OperatorDashboard {
  properties: PropertyCard[];
  globalSummary: GlobalSummary;
}

export async function getOperatorDashboard(): Promise<OperatorDashboard> {
  const res = await api.get<{ success: boolean; data: OperatorDashboard }>('/dashboard/operator');
  return res.data;
}

// Simple in-memory cache so all screens share one dashboard fetch per session
let _propertiesCache: { id: string; name: string; city: string }[] | null = null;

export async function getOperatorProperties(): Promise<{ id: string; name: string; city: string }[]> {
  if (_propertiesCache) return _propertiesCache;
  const dashboard = await getOperatorDashboard();
  _propertiesCache = dashboard.properties.map((p) => ({
    id: p.propertyId,
    name: p.propertyName,
    city: p.city,
  }));
  return _propertiesCache;
}

export function clearOperatorCache() {
  _propertiesCache = null;
}

// ── Tenants ───────────────────────────────────────────────────────────────────

export interface OperatorTenant {
  id: string;
  tenantCode: string;
  status: string;
  depositBalance: number;
  user: { id: string; name: string; email: string; phone: string | null };
  allocations: {
    id: string;
    isActive: boolean;
    monthlyRent: number;
    startDate: string;
    bed: { label: string; room: { number: string; floor: number | null } };
  }[];
}

export interface PaginatedTenants {
  tenants: OperatorTenant[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

export async function getOperatorTenants(params: {
  propertyId: string;
  status?: string;
  search?: string;
  page?: number;
  limit?: number;
}): Promise<PaginatedTenants> {
  const q = new URLSearchParams({ propertyId: params.propertyId });
  if (params.status && params.status !== 'ALL') q.set('status', params.status);
  if (params.search) q.set('search', params.search);
  q.set('page', String(params.page ?? 1));
  q.set('limit', String(params.limit ?? 30));

  const res = await api.get<{ success: boolean; data: OperatorTenant[]; meta: PaginatedTenants['meta'] }>(
    `/tenants?${q.toString()}`,
  );
  return {
    tenants: res.data ?? [],
    meta: res.meta ?? { total: 0, page: 1, limit: 30, totalPages: 1 },
  };
}

// ── Collections ───────────────────────────────────────────────────────────────

export type RentCycleStatus = 'PENDING' | 'DUE' | 'PARTIAL' | 'PAID' | 'OVERDUE' | 'WAIVED';
export type PaymentMethod = 'CASH' | 'UPI' | 'BANK_TRANSFER' | 'CHEQUE' | 'CARD' | 'ONLINE';
export type PaymentType = 'RENT' | 'DEPOSIT' | 'DEPOSIT_REFUND' | 'DEPOSIT_ADJUSTMENT' | 'RENT_REFUND' | 'ADJUSTMENT' | 'WAIVER' | 'FINE' | 'MISCELLANEOUS';

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
    user: { name: string; phone: string | null };
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

export async function getCollections(params: {
  propertyId: string;
  month: number;
  year: number;
  status?: string;
  page?: number;
}): Promise<CollectionsResponse> {
  const q = new URLSearchParams({
    propertyId: params.propertyId,
    month: String(params.month),
    year: String(params.year),
    limit: '100',
    page: String(params.page ?? 1),
  });
  if (params.status && params.status !== 'ALL') q.set('status', params.status);

  const res = await api.get<{ success: boolean; data: CollectionsResponse }>(
    `/rent/collections?${q.toString()}`,
  );
  return res.data;
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

export async function recordPayment(
  dto: RecordPaymentDto,
): Promise<{ payment: { id: string }; receiptNo: string }> {
  const res = await api.post<{
    success: boolean;
    data: { payment: { id: string }; receiptNo: string };
  }>('/rent/payment', dto);
  return res.data;
}

// ── Complaints ────────────────────────────────────────────────────────────────

export type ComplaintStatus = 'OPEN' | 'ASSIGNED' | 'IN_PROGRESS' | 'RESOLVED' | 'REOPENED' | 'CLOSED' | 'REJECTED';
export type ComplaintPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export interface OperatorComplaint {
  id: string;
  title: string;
  description: string;
  category: string;
  priority: ComplaintPriority;
  status: ComplaintStatus;
  createdAt: string;
  tenant: { id: string; user: { name: string; phone: string | null } } | null;
  assignedToUser: { id: string; name: string } | null;
  updates: {
    id: string;
    comment: string;
    statusChange: string | null;
    createdAt: string;
  }[];
}

export async function getOperatorComplaints(params: {
  propertyId: string;
  status?: string;
}): Promise<OperatorComplaint[]> {
  const q = new URLSearchParams({ propertyId: params.propertyId });
  if (params.status && params.status !== 'ALL') q.set('status', params.status);

  const res = await api.get<{ success: boolean; data: OperatorComplaint[] }>(
    `/complaints?${q.toString()}`,
  );
  return res.data ?? [];
}

export async function updateOperatorComplaint(
  id: string,
  dto: { status?: ComplaintStatus; comment?: string },
): Promise<OperatorComplaint> {
  const res = await api.put<{ success: boolean; data: OperatorComplaint }>(
    `/complaints/${id}`,
    dto,
  );
  return res.data;
}

// ── Tenant creation ───────────────────────────────────────────────────────────

export interface CreateTenantDto {
  name: string;
  email: string;
  phone: string;
  propertyId: string;
  depositAmount: number;
  leadSource?: string;
}

export interface CreatedTenant {
  id: string;
  tenantCode: string;
  status: string;
  user: { name: string; email: string; phone: string | null };
}

export async function createTenant(dto: CreateTenantDto): Promise<CreatedTenant> {
  const res = await api.post<{ success: boolean; data: CreatedTenant }>('/tenants', dto);
  return res.data;
}

// ── Food Menu ─────────────────────────────────────────────────────────────────

export interface FoodMenuEntry {
  id: string;
  propertyId: string;
  dayOfWeek: number; // 0=Sun..6=Sat
  mealType: 'BREAKFAST' | 'LUNCH' | 'EVENING_SNACK' | 'DINNER';
  items: string[];
  timing?: string;
  isActive: boolean;
}

export async function getFoodMenu(propertyId: string): Promise<FoodMenuEntry[]> {
  const res = await api.get<{ success: boolean; data: FoodMenuEntry[] }>(
    `/food-menu?propertyId=${propertyId}`,
  );
  return res.data ?? [];
}

export async function upsertFoodMenu(
  dto: Omit<FoodMenuEntry, 'id' | 'isActive'>,
): Promise<FoodMenuEntry> {
  const res = await api.post<{ success: boolean; data: FoodMenuEntry }>('/food-menu', dto);
  return res.data;
}

export async function updateFoodMenuEntry(
  id: string,
  dto: Partial<Pick<FoodMenuEntry, 'items' | 'timing' | 'isActive'>>,
): Promise<FoodMenuEntry> {
  const res = await api.put<{ success: boolean; data: FoodMenuEntry }>(`/food-menu/${id}`, dto);
  return res.data;
}
