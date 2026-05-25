import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, SettlementStatus } from '@prisma/client';

import {
  calculateFixedPayoutSettlement,
  calculateRevenueShareSettlement,
} from '@pg-system/utils';

import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class SettlementsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Calculate and persist a settlement for a given property/month/year.
   * If one already exists, recalculates it (idempotent for PENDING/CALCULATED status).
   */
  async calculateSettlement(propertyId: string, month: number, year: number, settledBy: string) {
    const property = await this.prisma.property.findUnique({ where: { id: propertyId } });
    if (!property) throw new NotFoundException('Property not found');

    const financialModel = await this.prisma.financialModel.findFirst({
      where: { propertyId, isActive: true },
      orderBy: { effectiveFrom: 'desc' },
    });

    if (!financialModel) {
      throw new BadRequestException('No active financial model configured for this property');
    }

    // Sum all rent payments collected this month
    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 0, 23, 59, 59);

    const rentAgg = await this.prisma.payment.aggregate({
      where: {
        propertyId,
        type: 'RENT',
        paidAt: { gte: monthStart, lte: monthEnd },
      },
      _sum: { amount: true },
    });

    const totalCollected = Number(rentAgg._sum.amount ?? 0);

    let ownerPayout = 0;
    let operatorProfit = 0;

    if (financialModel.type === 'FIXED_PAYOUT') {
      const result = calculateFixedPayoutSettlement(
        totalCollected,
        Number(financialModel.fixedOwnerPayout ?? 0),
      );
      ownerPayout = result.ownerPayout;
      operatorProfit = result.operatorProfit;
    } else if (financialModel.type === 'REVENUE_SHARE') {
      const result = calculateRevenueShareSettlement(
        totalCollected,
        Number(financialModel.ownerSharePercent ?? 50),
        Number(financialModel.operatorSharePercent ?? 50),
      );
      ownerPayout = result.ownerPayout;
      operatorProfit = result.operatorProfit;
    } else {
      // OWNER_OPERATED: owner keeps everything
      ownerPayout = totalCollected;
      operatorProfit = 0;
    }

    // Build breakdown for audit trail
    const rentCycleSummary = await this.prisma.rentCycle.groupBy({
      by: ['status'],
      where: { propertyId, month, year },
      _count: { _all: true },
      _sum: { paidAmount: true },
    });

    const breakdown = {
      financialModelType: financialModel.type,
      totalCollected,
      rentCycleSummary,
      calculatedAt: new Date().toISOString(),
    };

    // Use a transaction to prevent concurrent duplicate creation (race condition).
    // We re-check status inside the transaction so two simultaneous requests
    // cannot both pass the guard and create duplicate settlements.
    const settlement = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.settlement.findUnique({
        where: { propertyId_month_year: { propertyId, month, year } },
      });

      if (existing && existing.status !== SettlementStatus.CALCULATED) {
        throw new BadRequestException(
          `Settlement for ${month}/${year} is already ${existing.status} and cannot be recalculated`,
        );
      }

      return tx.settlement.upsert({
        where: { propertyId_month_year: { propertyId, month, year } },
        create: {
          propertyId,
          financialModelId: financialModel.id,
          month,
          year,
          totalCollected: new Prisma.Decimal(totalCollected),
          ownerPayout: new Prisma.Decimal(ownerPayout),
          operatorProfit: new Prisma.Decimal(operatorProfit),
          breakdown,
          status: SettlementStatus.CALCULATED,
        },
        update: {
          totalCollected: new Prisma.Decimal(totalCollected),
          ownerPayout: new Prisma.Decimal(ownerPayout),
          operatorProfit: new Prisma.Decimal(operatorProfit),
          breakdown,
          status: SettlementStatus.CALCULATED,
        },
      });
    });

    return { success: true, data: settlement };
  }

  async markSettlementPaid(settlementId: string, settledBy: string, notes?: string) {
    const settlement = await this.prisma.settlement.findUnique({ where: { id: settlementId } });
    if (!settlement) throw new NotFoundException('Settlement not found');
    if (settlement.status !== 'CALCULATED') {
      throw new BadRequestException('Only CALCULATED settlements can be marked as paid');
    }

    const updated = await this.prisma.settlement.update({
      where: { id: settlementId },
      data: {
        status: SettlementStatus.PAID,
        settledAt: new Date(),
        settledBy,
        notes,
      },
    });

    return { success: true, data: updated };
  }

  async getSettlement(id: string) {
    const settlement = await this.prisma.settlement.findUnique({
      where: { id },
      include: {
        financialModel: true,
        property: { select: { id: true, name: true, city: true } },
      },
    });
    if (!settlement) throw new NotFoundException('Settlement not found');
    return { success: true, data: settlement };
  }

  async getSettlements(propertyId: string, year?: number) {
    const settlements = await this.prisma.settlement.findMany({
      where: { propertyId, ...(year && { year }) },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
      include: { financialModel: true },
    });

    return { success: true, data: settlements };
  }
}
