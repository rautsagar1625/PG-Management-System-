import { apiClient } from './api';

export interface DashboardStats {
  totalRooms: number;
  totalBeds: number;
  occupiedBeds: number;
  availableBeds: number;
  occupancyRate: number;
  activeTenants: number;
  leads: number;
  pendingRent: number;
  collectedThisMonth: number;
  overdueCount: number;
  openComplaints: number;
}

export interface RecentActivity {
  id: string;
  type: 'payment' | 'move_in' | 'move_out' | 'complaint' | 'notice';
  description: string;
  tenantName: string;
  createdAt: string;
}

export async function getDashboardStats(propertyId: string): Promise<DashboardStats> {
  const { data } = await apiClient.get<{ success: boolean; data: DashboardStats }>(
    `/dashboard/${propertyId}`,
  );
  return data.data;
}

export interface Property {
  id: string;
  name: string;
  address: string;
  city: string;
  totalRooms: number;
}

export async function getProperties(): Promise<Property[]> {
  const { data } = await apiClient.get<{ success: boolean; data: Property[] }>('/properties');
  return data.data;
}
