import type { Address, ID } from './common';
import type { PropertyRoleType } from './auth';

export type PropertyType = 'MALE' | 'FEMALE' | 'MIXED';

export type PropertyStatus = 'ACTIVE' | 'INACTIVE' | 'SETUP';

export type RoomType =
  | 'SINGLE_SHARING'
  | 'DOUBLE_SHARING'
  | 'TRIPLE_SHARING'
  | 'FOUR_SHARING'
  | 'SIX_SHARING'
  | 'PRIVATE';

export type RoomStatus =
  | 'AVAILABLE'
  | 'PARTIALLY_OCCUPIED'
  | 'FULLY_OCCUPIED'
  | 'UNDER_MAINTENANCE'
  | 'INACTIVE';

export type BedStatus = 'AVAILABLE' | 'OCCUPIED' | 'RESERVED' | 'UNDER_MAINTENANCE';

export interface Property {
  id: ID;
  name: string;
  address: Address;
  type: PropertyType;
  status: PropertyStatus;
  amenities?: string[];
  rules?: string[];
  totalRooms: number;
  totalBeds: number;
  occupiedBeds: number;
  createdAt: string;
  updatedAt: string;
}

export interface PropertyWithRoles extends Property {
  roles: PropertyRoleSummary[];
}

export interface PropertyRoleSummary {
  userId: ID;
  userName: string;
  role: PropertyRoleType;
  sharePercent?: number;
  isActive: boolean;
}

export interface Room {
  id: ID;
  propertyId: ID;
  number: string;
  floor?: number;
  type: RoomType;
  sharingCapacity: number;
  monthlyRent: number;
  status: RoomStatus;
  amenities?: string[];
  occupiedBeds: number;
  totalBeds: number;
  createdAt: string;
  updatedAt: string;
}

export interface Bed {
  id: ID;
  roomId: ID;
  roomNumber: string;
  label: string;
  status: BedStatus;
  monthlyRent?: number;
  currentTenantId?: ID;
  currentTenantName?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePropertyDto {
  name: string;
  address: Address;
  type: PropertyType;
  amenities?: string[];
  rules?: string[];
}

export interface CreateRoomDto {
  number: string;
  floor?: number;
  type: RoomType;
  sharingCapacity: number;
  monthlyRent: number;
  amenities?: string[];
}

export interface CreateBedDto {
  label: string;
  monthlyRent?: number;
}
