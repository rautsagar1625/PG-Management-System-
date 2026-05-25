import { Injectable, NotFoundException } from '@nestjs/common';
import { RoomType, RoomStatus, Prisma } from '@prisma/client';
import { ROOM_SHARING_CAPACITY } from '@pg-system/constants';

import { PrismaService } from '../../database/prisma.service';

export interface CreateRoomDto {
  number: string;
  floor?: number;
  type: RoomType;
  sharingCapacity: number;
  baseRent: number;
  amenities?: string[];
}

export interface UpdateRoomDto {
  number?: string;
  floor?: number;
  type?: RoomType;
  baseRent?: number;
  amenities?: string[];
  status?: RoomStatus;
}

@Injectable()
export class RoomsService {
  constructor(private prisma: PrismaService) {}

  async findByProperty(propertyId: string) {
    const rooms = await this.prisma.room.findMany({
      where: { propertyId },
      include: {
        beds: {
          include: {
            allocations: {
              where: { isActive: true },
              include: { tenant: { include: { user: { select: { name: true, phone: true } } } } },
            },
          },
        },
      },
      orderBy: [{ floor: 'asc' }, { number: 'asc' }],
    });

    return { success: true, data: rooms };
  }

  async create(propertyId: string, dto: CreateRoomDto) {
    const room = await this.prisma.$transaction(async (tx) => {
      const r = await tx.room.create({
        data: {
          propertyId,
          number: dto.number,
          floor: dto.floor,
          type: dto.type,
          sharingCapacity: dto.sharingCapacity,
          baseRent: new Prisma.Decimal(dto.baseRent),
          amenities: dto.amenities ?? [],
        },
      });

      // Auto-create beds based on sharing capacity
      const bedLabels = this.generateBedLabels(dto.sharingCapacity);
      await tx.bed.createMany({
        data: bedLabels.map((label) => ({ roomId: r.id, label })),
      });

      return tx.room.findUnique({
        where: { id: r.id },
        include: { beds: true },
      });
    });

    return { success: true, data: room };
  }

  async findOne(propertyId: string, id: string) {
    const room = await this.prisma.room.findFirst({
      where: { id, propertyId },
      include: {
        beds: {
          include: {
            allocations: {
              where: { isActive: true },
              include: {
                tenant: {
                  include: { user: { select: { name: true, phone: true } } },
                },
              },
            },
          },
          orderBy: { label: 'asc' },
        },
      },
    });

    if (!room) throw new NotFoundException('Room not found');
    return { success: true, data: room };
  }

  async findOneAllocationHistory(propertyId: string, id: string) {
    const room = await this.prisma.room.findFirst({
      where: { id, propertyId },
      select: { id: true },
    });
    if (!room) throw new NotFoundException('Room not found');

    const allocations = await this.prisma.tenantAllocation.findMany({
      where: { bed: { roomId: id } },
      include: {
        tenant: { include: { user: { select: { name: true, phone: true } } } },
        bed: { select: { label: true } },
      },
      orderBy: { startDate: 'desc' },
    });

    return { success: true, data: allocations };
  }

  async update(propertyId: string, id: string, dto: UpdateRoomDto) {
    const existing = await this.prisma.room.findFirst({ where: { id, propertyId } });
    if (!existing) throw new NotFoundException('Room not found');

    const room = await this.prisma.room.update({
      where: { id },
      data: {
        ...(dto.number !== undefined && { number: dto.number }),
        ...(dto.floor !== undefined && { floor: dto.floor }),
        ...(dto.type !== undefined && { type: dto.type }),
        ...(dto.baseRent !== undefined && { baseRent: new Prisma.Decimal(dto.baseRent) }),
        ...(dto.amenities !== undefined && { amenities: dto.amenities }),
        ...(dto.status !== undefined && { status: dto.status }),
      },
      include: { beds: true },
    });

    return { success: true, data: room };
  }

  async updateStatus(id: string, status: RoomStatus) {
    const room = await this.prisma.room.update({
      where: { id },
      data: { status },
    });
    return { success: true, data: room };
  }

  /**
   * UX-005 — Available beds lookup for the room-transfer UI.
   *
   * Returns a flat, human-readable list of beds that are currently AVAILABLE
   * (no active allocation AND bed.status === AVAILABLE). The UI binds bedId
   * as the value and shows "{roomNumber} › Bed {bedLabel}" as the label,
   * eliminating the need for operators to know raw cuids.
   *
   * Optional filters:
   *   floorFilter — restrict to a specific floor
   *   excludeTenantId — exclude the bed currently held by this tenant
   *                     (prevents a transfer "to the same bed")
   */
  async getAvailableBeds(
    propertyId: string,
    options: { floorFilter?: number; excludeTenantId?: string } = {},
  ) {
    const beds = await this.prisma.bed.findMany({
      where: {
        status: 'AVAILABLE',
        room: {
          propertyId,
          status: 'AVAILABLE',
          ...(options.floorFilter !== undefined && { floor: options.floorFilter }),
        },
        // Exclude beds with an active allocation (double-safety beyond status)
        allocations: { none: { isActive: true } },
      },
      select: {
        id: true,
        label: true,
        room: {
          select: {
            id: true,
            number: true,
            floor: true,
            type: true,
            baseRent: true,
            sharingCapacity: true,
          },
        },
      },
      orderBy: [
        { room: { floor: 'asc' } },
        { room: { number: 'asc' } },
        { label: 'asc' },
      ],
    });

    // Exclude the bed currently held by the tenant being transferred
    let excludedBedId: string | undefined;
    if (options.excludeTenantId) {
      const currentAlloc = await this.prisma.tenantAllocation.findFirst({
        where: { tenantId: options.excludeTenantId, isActive: true },
        select: { bedId: true },
      });
      excludedBedId = currentAlloc?.bedId;
    }

    const filtered = excludedBedId ? beds.filter((b) => b.id !== excludedBedId) : beds;

    return {
      success: true,
      data: filtered.map((b) => ({
        bedId: b.id,
        bedLabel: b.label,
        displayLabel: `Floor ${b.room.floor ?? '–'} · Room ${b.room.number} › Bed ${b.label}`,
        room: {
          id: b.room.id,
          number: b.room.number,
          floor: b.room.floor,
          type: b.room.type,
          baseRent: Number(b.room.baseRent),
          sharingCapacity: b.room.sharingCapacity,
        },
      })),
      meta: { total: filtered.length },
    };
  }

  private generateBedLabels(capacity: number): string[] {
    const labels = ['A', 'B', 'C', 'D', 'E', 'F'];
    return labels.slice(0, capacity);
  }
}
