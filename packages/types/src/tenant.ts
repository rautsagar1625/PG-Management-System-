import type { ContactInfo, ID } from './common';

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

export type KycDocumentType =
  | 'AADHAAR'
  | 'PAN'
  | 'PASSPORT'
  | 'DRIVING_LICENSE'
  | 'VOTER_ID';

export interface KycDocument {
  type: KycDocumentType;
  documentNumber: string;
  fileUrl?: string;
  verifiedAt?: string;
}

export interface Tenant {
  id: ID;
  userId: ID;
  name: string;
  email: string;
  phone: string;
  propertyId: ID;
  propertyName: string;
  tenantCode: string;
  status: TenantStatus;
  kycStatus: KycStatus;
  emergencyContact?: ContactInfo;
  depositAmount: number;
  depositPaid: number;
  depositStatus: DepositStatus;
  moveInDate?: string;
  moveOutDate?: string;
  currentBed?: TenantBedInfo;
  monthlyRent?: number;
  leadSource?: string;
  visitDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TenantBedInfo {
  bedId: ID;
  bedLabel: string;
  roomId: ID;
  roomNumber: string;
  floor?: number;
  monthlyRent: number;
  assignedFrom: string;
}

export interface TenantBedAssignment {
  id: ID;
  tenantId: ID;
  bedId: ID;
  bedLabel: string;
  roomNumber: string;
  startDate: string;
  endDate?: string;
  isActive: boolean;
  monthlyRent: number;
}

export interface CreateTenantDto {
  name: string;
  email: string;
  phone: string;
  propertyId: ID;
  emergencyContact?: ContactInfo;
  leadSource?: string;
  depositAmount: number;
}

export interface AssignBedDto {
  bedId: ID;
  startDate: string;
  monthlyRent: number;
}

export interface MoveInDto {
  bedId: ID;
  moveInDate: string;
  monthlyRent: number;
  depositAmount: number;
}

export interface MoveOutDto {
  moveOutDate: string;
  depositRefundAmount?: number;
  depositForfeitAmount?: number;
  notes?: string;
}

export interface RoomTransferDto {
  newBedId: ID;
  transferDate: string;
  newMonthlyRent?: number;
  reason?: string;
}
