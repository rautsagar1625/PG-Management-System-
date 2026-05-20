import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PaymentType, Prisma, RentCycleStatus } from '@prisma/client';
import { IsDateString, IsIn, IsNumber, IsOptional, IsPositive, IsString, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';

import { RENT_GRACE_PERIOD_DAYS } from '@pg-system/constants';
import { generateReceiptNumber, getRentDueDate, isRentOverdue } from '@pg-system/utils';

import { PrismaService } from '../../database/prisma.service';
import { DOMAIN_EVENTS, PaymentRecordedEvent } from '../../events/domain-events';

export class RecordPaymentDto {
  @IsUUID()
  tenantId: string;

  @IsUUID()
  @IsOptional()
  rentCycleId?: string;

  @IsNumber()
  @IsPositive()
  @Type(() => Number)
  amount: number;

  @IsIn(['RENT', 'DEPOSIT', 'DEPOSIT_REFUND', 'DEPOSIT_ADJUSTMENT', 'RENT_REFUND', 'ADJUSTMENT', 'WAIVER', 'FINE', 'MISCELLANEOUS'])
  type: 'RENT' | 'DEPOSIT' | 'DEPOSIT_REFUND' | 'DEPOSIT_ADJUSTMENT' | 'RENT_REFUND' | 'ADJUSTMENT' | 'WAIVER' | 'FINE' | 'MISCELLANEOUS';

  @IsIn(['CASH', 'UPI', 'BANK_TRANSFER', 'CHEQUE', 'CARD', 'ONLINE'])
  method: 'CASH' | 'UPI' | 'BANK_TRANSFER' | 'CHEQUE' | 'CARD' | 'ONLINE';

  @IsString()
  @IsOptional()
  referenceNo?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsDateString()
  paidAt: string;
}

@Injectable()
export class RentService {
  constructor(
    private prisma: PrismaService,
    private eventEmitter: EventEmitter2,
  ) {}

  /**
   * Generate rent cycles for all active tenants in a property for a given month/year.
   * Idempotent — skips cycles that already exist.
   */
  async generateRentCycles(propertyId: string, month: number, year: number) {
    const tenants = await this.prisma.tenant.findMany({
      where: { propertyId, status: { in: ['ACTIVE', 'NOTICE_PERIOD'] } },
      include: {
        allocations: {
          where: { isActive: true },
        },
      },
    });

    const dueDate = getRentDueDate(month, year, 1);
    const results: { tenantId: string; cycleId: string; created: boolean }[] = [];

    for (const tenant of tenants) {
      const activeAllocation = tenant.allocations[0];
      if (!activeAllocation) continue;

      const rentAmount = activeAllocation.monthlyRent;

      const existing = await this.prisma.rentCycle.findUnique({
        where: { tenantId_month_year: { tenantId: tenant.id, month, year } },
      });

      if (existing) {
        results.push({ tenantId: tenant.id, cycleId: existing.id, created: false });
        continue;
      }

      const cycle = await this.prisma.rentCycle.create({
        data: {
          tenantId: tenant.id,
          propertyId,
          month,
          year,
          dueDate,
          rentAmount,
          remainingAmount: rentAmount,
          status: RentCycleStatus.PENDING,
        },
      });

      results.push({ tenantId: tenant.id, cycleId: cycle.id, created: true });
    }

    return {
      generated: results.filter((r) => r.created).length,
      total: results.length,
    };
  }

  /**
   * Record a payment and update the rent cycle status.
   * All financial changes happen inside a single transaction.
   */
  async recordPayment(dto: RecordPaymentDto, recordedBy: string) {
    const paidAt = new Date(dto.paidAt);
    if (paidAt > new Date()) {
      throw new BadRequestException('Payment date cannot be in the future');
    }

    // Idempotency guard: reject duplicate reference numbers for non-cash payments
    if (dto.referenceNo && dto.method !== 'CASH') {
      const dup = await this.prisma.payment.findFirst({
        where: { referenceNo: dto.referenceNo, tenantId: dto.tenantId },
        select: { id: true },
      });
      if (dup) {
        throw new ConflictException(
          `Duplicate payment: reference ${dto.referenceNo} already recorded for this tenant`,
        );
      }
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.findUnique({
        where: { id: dto.tenantId },
        select: { id: true, userId: true, propertyId: true, status: true },
      });
      if (!tenant) throw new NotFoundException('Tenant not found');
      if (tenant.status === 'MOVED_OUT') {
        throw new BadRequestException('Cannot record payment for a moved-out tenant');
      }

      let rentCycleId = dto.rentCycleId;

      // Auto-find oldest unpaid cycle when recording rent without specifying one
      if (dto.type === 'RENT' && !rentCycleId) {
        const openCycle = await tx.rentCycle.findFirst({
          where: {
            tenantId: dto.tenantId,
            status: { in: ['PENDING', 'DUE', 'PARTIAL', 'OVERDUE'] },
          },
          orderBy: [{ year: 'asc' }, { month: 'asc' }],
        });
        rentCycleId = openCycle?.id;
      }

      const payment = await tx.payment.create({
        data: {
          tenantId: dto.tenantId,
          propertyId: tenant.propertyId,
          rentCycleId,
          amount: new Prisma.Decimal(dto.amount),
          type: dto.type as PaymentType,
          method: dto.method,
          referenceNo: dto.referenceNo,
          notes: dto.notes,
          recordedBy,
          paidAt,
        },
      });

      // Retry up to 5 times on the rare chance of a receiptNo collision
      let receipt!: Awaited<ReturnType<typeof tx.receipt.create>>;
      for (let attempt = 0; attempt < 5; attempt++) {
        const receiptNo = generateReceiptNumber(paidAt);
        try {
          receipt = await tx.receipt.create({
            data: { receiptNo, tenantId: dto.tenantId, paymentId: payment.id },
          });
          break;
        } catch (e: unknown) {
          const isPrismaConflict = typeof e === 'object' && e !== null && (e as { code?: string }).code === 'P2002';
          if (attempt === 4 || !isPrismaConflict) throw e;
        }
      }

      // Update rent cycle if this is a rent payment linked to a cycle
      if (rentCycleId && dto.type === 'RENT') {
        const cycle = await tx.rentCycle.findUnique({ where: { id: rentCycleId } });
        if (cycle) {
          // Use Decimal arithmetic throughout to avoid IEEE 754 float errors
          const newPaid = new Prisma.Decimal(cycle.paidAmount).add(new Prisma.Decimal(dto.amount));
          const newRemaining = Prisma.Decimal.max(
            new Prisma.Decimal(0),
            new Prisma.Decimal(cycle.rentAmount).sub(newPaid),
          );

          let newStatus: RentCycleStatus;
          if (newRemaining.isZero()) {
            newStatus = RentCycleStatus.PAID;
          } else if (newPaid.greaterThan(0)) {
            newStatus = isRentOverdue(cycle.dueDate, RENT_GRACE_PERIOD_DAYS)
              ? RentCycleStatus.OVERDUE
              : RentCycleStatus.PARTIAL;
          } else {
            newStatus = isRentOverdue(cycle.dueDate, RENT_GRACE_PERIOD_DAYS)
              ? RentCycleStatus.OVERDUE
              : RentCycleStatus.DUE;
          }

          await tx.rentCycle.update({
            where: { id: rentCycleId },
            data: {
              paidAmount: newPaid,
              remainingAmount: newRemaining,
              status: newStatus,
            },
          });
        }
      }

      // Update deposit balance when deposit payment recorded
      if (dto.type === 'DEPOSIT') {
        const tenantData = await tx.tenant.findUnique({ where: { id: dto.tenantId } });
        if (tenantData) {
          const newBalance = new Prisma.Decimal(tenantData.depositBalance).add(
            new Prisma.Decimal(dto.amount),
          );
          const depositStatus = newBalance.greaterThanOrEqualTo(
            new Prisma.Decimal(tenantData.depositAmount),
          )
            ? 'PAID'
            : 'PARTIALLY_PAID';

          await tx.tenant.update({
            where: { id: dto.tenantId },
            data: {
              depositBalance: newBalance,
              depositStatus,
              // Activate tenant if they were DEPOSIT_PENDING
              ...(tenantData.status === 'DEPOSIT_PENDING' &&
                depositStatus === 'PAID' && {
                  status: 'ACTIVE',
                }),
            },
          });
        }
      }

      return { payment, receiptNo: receipt.receiptNo, tenantUserId: tenant.userId, propertyId: tenant.propertyId };
    });

    this.eventEmitter.emit(DOMAIN_EVENTS.PAYMENT_RECORDED, {
      paymentId: result.payment.id,
      tenantId: dto.tenantId,
      tenantUserId: result.tenantUserId,
      propertyId: result.propertyId,
      amount: dto.amount,
      type: dto.type,
      receiptNo: result.receiptNo,
    } satisfies PaymentRecordedEvent);

    return { payment: result.payment, receiptNo: result.receiptNo };
  }

  async getRentCycles(
    tenantId: string,
    filters: { month?: number; year?: number; status?: string },
  ) {
    return this.prisma.rentCycle.findMany({
      where: {
        tenantId,
        ...(filters.month && { month: filters.month }),
        ...(filters.year && { year: filters.year }),
        ...(filters.status && { status: filters.status as RentCycleStatus }),
      },
      include: { payments: { include: { receipt: true } } },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
    });
  }

  async getPropertyRentSummary(propertyId: string, month: number, year: number) {
    const groups = await this.prisma.rentCycle.groupBy({
      by: ['status'],
      where: { propertyId, month, year },
      _count: { _all: true },
      _sum: { rentAmount: true, paidAmount: true, remainingAmount: true },
    });

    const summary = {
      total: 0,
      paid: 0,
      partial: 0,
      pending: 0,
      overdue: 0,
      totalExpected: 0,
      totalCollected: 0,
      totalRemaining: 0,
    };

    for (const group of groups) {
      summary.total += group._count._all;
      summary.totalExpected += Number(group._sum.rentAmount ?? 0);
      summary.totalCollected += Number(group._sum.paidAmount ?? 0);
      summary.totalRemaining += Number(group._sum.remainingAmount ?? 0);

      if (group.status === 'PAID') summary.paid += group._count._all;
      if (group.status === 'PARTIAL') summary.partial += group._count._all;
      if (group.status === 'OVERDUE') summary.overdue += group._count._all;
      if (['PENDING', 'DUE'].includes(group.status)) summary.pending += group._count._all;
    }

    return summary;
  }

  /**
   * Transitions DUE/PARTIAL cycles past the grace period to OVERDUE.
   * Safe to call multiple times — only updates eligible cycles.
   */
  async getCollections(params: {
    propertyId: string;
    month: number;
    year: number;
    status?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const { propertyId, month, year, status, search, page = 1, limit = 50 } = params;
    const cappedLimit = Math.min(limit, 200);
    const skip = (page - 1) * cappedLimit;

    const baseWhere: Prisma.RentCycleWhereInput = { propertyId, month, year };
    const filterWhere: Prisma.RentCycleWhereInput = {
      ...baseWhere,
      ...(status && { status: status as RentCycleStatus }),
      ...(search && {
        OR: [
          { tenant: { user: { name: { contains: search, mode: 'insensitive' } } } },
          { tenant: { user: { phone: { contains: search, mode: 'insensitive' } } } },
          { tenant: { tenantCode: { contains: search, mode: 'insensitive' } } },
        ],
      }),
    };

    const [cycles, filteredTotal, aggResult, statusGroups] = await Promise.all([
      this.prisma.rentCycle.findMany({
        where: filterWhere,
        skip,
        take: cappedLimit,
        orderBy: [{ remainingAmount: 'desc' }, { dueDate: 'asc' }],
        include: {
          tenant: {
            include: {
              user: { select: { id: true, name: true, phone: true } },
              allocations: {
                where: { isActive: true },
                include: {
                  bed: { include: { room: { select: { number: true, floor: true } } } },
                },
                take: 1,
              },
            },
          },
          payments: {
            include: { receipt: true },
            orderBy: { paidAt: 'desc' },
            take: 5,
          },
        },
      }),
      this.prisma.rentCycle.count({ where: filterWhere }),
      this.prisma.rentCycle.aggregate({
        where: baseWhere,
        _sum: { rentAmount: true, paidAmount: true, remainingAmount: true },
        _count: { _all: true },
      }),
      this.prisma.rentCycle.groupBy({
        by: ['status'],
        where: baseWhere,
        _count: { _all: true },
        _sum: { remainingAmount: true },
      }),
    ]);

    const statusBreakdown = statusGroups.reduce(
      (acc, g) => ({
        ...acc,
        [g.status]: { count: g._count._all, remaining: Number(g._sum.remainingAmount ?? 0) },
      }),
      {} as Record<string, { count: number; remaining: number }>,
    );

    return {
      cycles,
      summary: {
        totalCycles: aggResult._count._all,
        totalExpected: Number(aggResult._sum.rentAmount ?? 0),
        totalCollected: Number(aggResult._sum.paidAmount ?? 0),
        totalRemaining: Number(aggResult._sum.remainingAmount ?? 0),
        statusBreakdown,
      },
      meta: {
        total: filteredTotal,
        page,
        limit: cappedLimit,
        totalPages: Math.ceil(filteredTotal / cappedLimit),
      },
    };
  }

  async getReceipt(receiptNo: string) {
    const receipt = await this.prisma.receipt.findUnique({
      where: { receiptNo },
      include: {
        payment: {
          include: {
            property: { select: { name: true, address: true, city: true } },
            rentCycle: { select: { month: true, year: true } },
            recorder: { select: { name: true } },
          },
        },
        tenant: {
          include: {
            user: { select: { name: true, phone: true } },
            allocations: {
              orderBy: { startDate: 'desc' },
              include: {
                bed: { include: { room: { select: { number: true } } } },
              },
              take: 1,
            },
          },
        },
      },
    });

    if (!receipt) throw new NotFoundException('Receipt not found');

    const alloc = receipt.tenant.allocations[0];

    return {
      receiptNo: receipt.receiptNo,
      issuedAt: receipt.issuedAt,
      tenantName: receipt.tenant.user.name,
      tenantPhone: receipt.tenant.user.phone,
      tenantCode: receipt.tenant.tenantCode,
      amount: Number(receipt.payment.amount),
      type: receipt.payment.type,
      method: receipt.payment.method,
      referenceNo: receipt.payment.referenceNo,
      notes: receipt.payment.notes,
      paidAt: receipt.payment.paidAt,
      recordedBy: receipt.payment.recorder.name,
      rentPeriod: receipt.payment.rentCycle
        ? { month: receipt.payment.rentCycle.month, year: receipt.payment.rentCycle.year }
        : null,
      propertyName: receipt.payment.property.name,
      propertyAddress: `${receipt.payment.property.address}, ${receipt.payment.property.city}`,
      roomNumber: alloc?.bed.room.number ?? '',
      bedLabel: alloc?.bed.label ?? '',
    };
  }

  async markOverdueCycles() {
    const graceCutoff = new Date();
    graceCutoff.setDate(graceCutoff.getDate() - RENT_GRACE_PERIOD_DAYS);

    const { count } = await this.prisma.rentCycle.updateMany({
      where: {
        status: { in: ['DUE', 'PARTIAL'] },
        dueDate: { lt: graceCutoff },
      },
      data: { status: RentCycleStatus.OVERDUE },
    });

    return { markedOverdue: count };
  }
}
