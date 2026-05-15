import { apiClient } from './api';

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
  const { data } = await apiClient.get<{ success: boolean; data: OperatorDashboard }>(
    '/dashboard/operator',
  );
  return data.data;
}

export interface PropertyPerformance {
  month: number;
  year: number;
  occupancy: {
    total: number;
    occupied: number;
    vacant: number;
    rate: number;
  };
  collection: {
    expected: number;
    collected: number;
    remaining: number;
    rate: number;
    totalCycles: number;
    overdueCycles: number;
    overdueRate: number;
  };
  tenants: { active: number };
  complaints: {
    open: number;
    resolved: number;
    closed: number;
    byStatus: Record<string, number>;
  };
}

export async function getPropertyPerformance(propertyId: string): Promise<PropertyPerformance> {
  const { data } = await apiClient.get<{ success: boolean; data: PropertyPerformance }>(
    `/dashboard/property/${propertyId}/performance`,
  );
  return data.data;
}
