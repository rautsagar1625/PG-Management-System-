import type { ID } from './common';

export interface OperatorDashboard {
  properties: PropertyDashboardCard[];
  globalSummary: GlobalSummary;
}

export interface PropertyDashboardCard {
  propertyId: ID;
  propertyName: string;
  occupancyRate: number;
  totalBeds: number;
  occupiedBeds: number;
  availableBeds: number;
  rentCollectionRate: number;
  totalExpectedRent: number;
  totalCollectedRent: number;
  pendingRent: number;
  openComplaints: number;
  expiringNotices: number;
}

export interface GlobalSummary {
  totalProperties: number;
  totalActiveTenants: number;
  totalMonthlyRevenue: number;
  totalPendingRent: number;
  totalOpenComplaints: number;
}

export interface TenantDashboard {
  tenantInfo: TenantDashboardInfo;
  currentRent: CurrentRentInfo;
  recentPayments: RecentPaymentInfo[];
  openComplaints: number;
}

export interface TenantDashboardInfo {
  name: string;
  tenantCode: string;
  propertyName: string;
  roomNumber: string;
  bedLabel: string;
  monthlyRent: number;
  moveInDate: string;
}

export interface CurrentRentInfo {
  month: number;
  year: number;
  dueDate: string;
  rentAmount: number;
  paidAmount: number;
  balanceDue: number;
  status: string;
  isOverdue: boolean;
}

export interface RecentPaymentInfo {
  id: ID;
  amount: number;
  type: string;
  method: string;
  paymentDate: string;
  receiptNo?: string;
}
