import { Injectable } from '@nestjs/common';
import { BedStatus } from '@prisma/client';

import { PrismaService } from '../../database/prisma.service';

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
        room: { select: { number: true, floor: true, monthlyRent: true, type: true } },
      },
      orderBy: [{ room: { floor: 'asc' } }, { room: { number: 'asc' } }, { label: 'asc' }],
    });

    return { success: true, data: beds };
  }

  async updateStatus(id: string, status: BedStatus) {
    const bed = await this.prisma.bed.update({
      where: { id },
      data: { status },
    });
    return { success: true, data: bed };
  }
}
