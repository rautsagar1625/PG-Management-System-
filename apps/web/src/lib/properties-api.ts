import { apiClient } from './api';

export type PropertyType = 'MALE' | 'FEMALE' | 'MIXED';
export type PropertyStatus = 'SETUP' | 'ACTIVE' | 'INACTIVE';
export type FinancialModelType = 'FIXED_PAYOUT' | 'REVENUE_SHARE' | 'OWNER_OPERATED';
export type PropertyRoleType = 'OWNER' | 'OPERATOR' | 'CO_OPERATOR' | 'STAFF';

export interface Property {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  type: PropertyType;
  status: PropertyStatus;
  amenities: string[];
  rules: string[];
  createdAt: string;
  updatedAt: string;
}

export interface PropertyRole {
  id: string;
  propertyId: string;
  userId: string;
  role: PropertyRoleType;
  user: { id: string; name: string; email: string; phone: string | null };
  createdAt: string;
}

export interface FinancialModel {
  id: string;
  propertyId: string;
  type: FinancialModelType;
  fixedOwnerPayout: number | null;
  ownerSharePercent: number | null;
  operatorSharePercent: number | null;
  isActive: boolean;
  effectiveFrom: string;
  effectiveTo: string | null;
}

export interface PropertyDetail extends Property {
  roles: PropertyRole[];
  financialModels: FinancialModel[];
  _count: { rooms: number; tenants: number };
}

// Returned by /dashboard/operator
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

export interface OperatorDashboard {
  properties: PropertyCard[];
  globalSummary: {
    totalProperties: number;
    totalMonthlyRevenue: number;
    totalPendingRent: number;
    totalOpenComplaints: number;
  };
}

export interface CreatePropertyDto {
  name: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  type: PropertyType;
  amenities?: string[];
}

export interface SetFinancialModelDto {
  type: FinancialModelType;
  fixedOwnerPayout?: number;
  ownerSharePercent?: number;
  operatorSharePercent?: number;
  effectiveFrom: string;
}

// ── Queries ──────────────────────────────────────────────────────────

export async function getProperties(): Promise<Property[]> {
  const { data } = await apiClient.get<{ success: boolean; data: Property[] }>('/properties');
  return data.data;
}

export async function getProperty(id: string): Promise<PropertyDetail> {
  const { data } = await apiClient.get<{ success: boolean; data: PropertyDetail }>(
    `/properties/${id}`,
  );
  return data.data;
}

export async function getOperatorDashboard(): Promise<OperatorDashboard> {
  const { data } = await apiClient.get<{ success: boolean; data: OperatorDashboard }>(
    '/dashboard/operator',
  );
  return data.data;
}

// ── Mutations ────────────────────────────────────────────────────────

export async function createProperty(dto: CreatePropertyDto): Promise<Property> {
  const { data } = await apiClient.post<{ success: boolean; data: Property }>(
    '/properties',
    dto,
  );
  return data.data;
}

export async function updateProperty(
  id: string,
  dto: Partial<CreatePropertyDto & { status: PropertyStatus }>,
): Promise<Property> {
  const { data } = await apiClient.put<{ success: boolean; data: Property }>(
    `/properties/${id}`,
    dto,
  );
  return data.data;
}

export async function setFinancialModel(
  propertyId: string,
  dto: SetFinancialModelDto,
): Promise<FinancialModel> {
  const { data } = await apiClient.post<{ success: boolean; data: FinancialModel }>(
    `/properties/${propertyId}/financial-model`,
    dto,
  );
  return data.data;
}

export async function addPropertyRole(
  propertyId: string,
  dto: { userId: string; role: PropertyRoleType },
): Promise<PropertyRole> {
  const { data } = await apiClient.post<{ success: boolean; data: PropertyRole }>(
    `/properties/${propertyId}/roles`,
    dto,
  );
  return data.data;
}
