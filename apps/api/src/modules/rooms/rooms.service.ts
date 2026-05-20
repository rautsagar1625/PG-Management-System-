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

  async updateStatus(id: string, status: RoomStatus) {
    const room = await this.prisma.room.update({
      where: { id },
      data: { status },
    });
    return { success: true, data: room };
  }

  private generateBedLabels(capacity: number): string[] {
    const labels = ['A', 'B', 'C', 'D', 'E', 'F'];
    return labels.slice(0, capacity);
  }
}
