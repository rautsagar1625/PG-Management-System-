import { Injectable, NotFoundException } from '@nestjs/common';
import { BedStatus } from '@prisma/client';

import { PrismaService } from '../../database/prisma.service';

export interface UpdateBedDto {
  label?: string;
  status?: BedStatus;
}

@Injectable()
export class BedsService {
  constructor(private prisma: PrismaService) {}

  async getAvailableBeds(propertyId: string) {
    const beds = await this.prisma.bed.findMany({
      where: {
        status: BedStatus.AVAILABLE,
        room: { propertyId, status: { not: 'INACTIVE' } },
      },
      include: {
        room: { select: { number: true, floor: true, baseRent: true, type: true } },
      },
      orderBy: [{ room: { floor: 'asc' } }, { room: { number: 'asc' } }, { label: 'asc' }],
    });

    return { success: true, data: beds };
  }

  async findOne(id: string) {
    const bed = await this.prisma.bed.findUnique({
      where: { id },
      include: {
        room: { select: { id: true, number: true, floor: true, type: true, propertyId: true } },
        allocations: {
          where: { isActive: true },
          include: {
            tenant: { include: { user: { select: { name: true, phone: true } } } },
          },
        },
      },
    });
    if (!bed) throw new NotFoundException('Bed not found');
    return { success: true, data: bed };
  }

  async update(id: string, dto: UpdateBedDto) {
    const existing = await this.prisma.bed.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Bed not found');

    const bed = await this.prisma.bed.update({
      where: { id },
      data: {
        ...(dto.label !== undefined && { label: dto.label }),
        ...(dto.status !== undefined && { status: dto.status }),
      },
    });
    return { success: true, data: bed };
  }

  async updateStatus(id: string, status: BedStatus) {
    const bed = await this.prisma.bed.update({
      where: { id },
      data: { status },
    });
    return { success: true, data: bed };
  }
}
