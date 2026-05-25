import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
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

    // BM-001 fix: Query for the financial model that was ACTIVE at the START of the
    // settlement period, not the model that is active today. If an owner changed from
    // REVENUE_SHARE to FIXED_PAYOUT on the 20th, settlements for that month should
    // still use REVENUE_SHARE — the model that was in effect when collections happened.
    //
    // The FinancialModel table uses effectiveFrom / effectiveTo for history. We find
    // the model where effectiveFrom <= periodStart AND (effectiveTo IS NULL OR effectiveTo >= periodStart).
    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 0, 23, 59, 59);

    const financialModel = await this.prisma.financialModel.findFirst({
      where: {
        propertyId,
        effectiveFrom: { lte: monthStart },
        OR: [
          { effectiveTo: null },             // currently active model
          { effectiveTo: { gte: monthStart } }, // model whose end date is within or after period start
        ],
      },
      orderBy: { effectiveFrom: 'desc' }, // most recent matching model wins
    });

    if (!financialModel) {
      throw new BadRequestException(
        `No financial model was active at the start of ${month}/${year} for this property. ` +
        'Ensure a financial model with effectiveFrom on or before this period exists.',
      );
    }

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
    } else if (financialModel.type === 'OWNER_OPERATED') {
      // OWNER_OPERATED: owner keeps everything — no split
      ownerPayout = totalCollected;
      operatorProfit = 0;
    } else {
      // SP4-3: TypeScript exhaustiveness check.
      // `financialModel.type` is narrowed to `never` here because all enum
      // variants are handled above. If a new FinancialModelType is added to
      // the Prisma schema without a corresponding branch, this line becomes
      // a compile-time error — preventing silent misrouting at runtime.
      const _exhaustive: never = financialModel.type;
      throw new Error(`Unhandled financial model type: ${_exhaustive}`);
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

  async markSettlementPaid(
    settlementId: string,
    settledBy: string,
    // RB-001/RB-002 fix: callers must supply the propertyId they believe this
    // settlement belongs to. The service verifies the match so that an OPERATOR
    // on Property A cannot mark a settlement from Property B as paid.
    propertyId: string,
    notes?: string,
  ) {
    const settlement = await this.prisma.settlement.findUnique({ where: { id: settlementId } });
    if (!settlement) throw new NotFoundException('Settlement not found');

    // Cross-property access check — prevent operators from touching other properties' settlements
    if (settlement.propertyId !== propertyId) {
      throw new ForbiddenException('Settlement does not belong to the specified property');
    }

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

  async getSettlement(
    id: string,
    // RB-001/RB-002 fix: propertyId supplied by the caller (extracted from the
    // request by PropertyRoleGuard via query param). The service verifies that the
    // fetched settlement actually belongs to this property, blocking cross-property
    // reads where a user on Property A guesses a settlement ID from Property B.
    propertyId: string,
  ) {
    const settlement = await this.prisma.settlement.findUnique({
      where: { id },
      include: {
        financialModel: true,
        property: { select: { id: true, name: true, city: true } },
      },
    });
    if (!settlement) throw new NotFoundException('Settlement not found');

    // Verify the settlement belongs to the claimed property
    if (settlement.propertyId !== propertyId) {
      throw new ForbiddenException('Settlement does not belong to the specified property');
    }

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
