import { apiClient } from './api';

export type RoomType =
  | 'PRIVATE'
  | 'DOUBLE_SHARING'
  | 'TRIPLE_SHARING'
  | 'FOUR_SHARING'
  | 'SIX_SHARING';

export type RoomStatus =
  | 'AVAILABLE'
  | 'PARTIALLY_OCCUPIED'
  | 'FULLY_OCCUPIED'
  | 'UNDER_MAINTENANCE'
  | 'INACTIVE';

export type BedStatus = 'AVAILABLE' | 'OCCUPIED' | 'RESERVED' | 'UNDER_MAINTENANCE';

export interface Bed {
  id: string;
  roomId: string;
  label: string;
  monthlyRent: number | null;
  status: BedStatus;
  // Active tenant info if occupied
  currentAllocation?: {
    tenantId: string;
    monthlyRent: number;
    startDate: string;
    tenant: {
      id: string;
      tenantCode: string;
      user: { name: string; phone: string };
    };
  } | null;
}

export interface Room {
  id: string;
  propertyId: string;
  number: string;
  floor: number | null;
  type: RoomType;
  sharingCapacity: number;
  monthlyRent: number;
  status: RoomStatus;
  amenities: string[];
  createdAt: string;
  beds: Bed[];
}

export interface CreateRoomDto {
  propertyId: string;
  number: string;
  floor?: number;
  type: RoomType;
  sharingCapacity: number;
  monthlyRent: number;
  amenities?: string[];
}

export interface RoomStats {
  totalRooms: number;
  totalBeds: number;
  occupiedBeds: number;
  availableBeds: number;
  reservedBeds: number;
  maintenanceBeds: number;
}

export const ROOM_TYPE_LABELS: Record<RoomType, string> = {
  PRIVATE: 'Private',
  DOUBLE_SHARING: '2-Sharing',
  TRIPLE_SHARING: '3-Sharing',
  FOUR_SHARING: '4-Sharing',
  SIX_SHARING: '6-Sharing',
};

export const ROOM_TYPE_CAPACITY: Record<RoomType, number> = {
  PRIVATE: 1,
  DOUBLE_SHARING: 2,
  TRIPLE_SHARING: 3,
  FOUR_SHARING: 4,
  SIX_SHARING: 6,
};

// ── Queries ──────────────────────────────────────────────────────────

export async function getRooms(propertyId: string): Promise<Room[]> {
  const { data } = await apiClient.get<{ success: boolean; data: Room[] }>(
    `/properties/${propertyId}/rooms`,
  );
  return data.data;
}

// ── Mutations ────────────────────────────────────────────────────────

export async function createRoom(dto: CreateRoomDto): Promise<Room> {
  const { data } = await apiClient.post<{ success: boolean; data: Room }>(
    `/properties/${dto.propertyId}/rooms`,
    dto,
  );
  return data.data;
}
