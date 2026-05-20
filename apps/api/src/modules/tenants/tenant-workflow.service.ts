import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  BedStatus,
  DepositStatus,
  KycStatus,
  Prisma,
  TenantStatus,
  TransferReason,
} from '@prisma/client';
import {
  IsBoolean,
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

import { TENANT_STATUS_TRANSITIONS } from '@pg-system/constants';

import { PrismaService } from '../../database/prisma.service';
import { AllocationService } from '../allocation/allocation.service';
import {
  DOMAIN_EVENTS,
  TenantMovedInEvent,
  TenantMovedOutEvent,
  TenantNoticeInitiatedEvent,
  TenantNoticeCancelledEvent,
  TenantTransferredEvent,
} from '../../events/domain-events';

export class ScheduleVisitDto {
  @IsDateString()
  visitDate: string;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class MoveInDto {
  @IsUUID()
  bedId: string;

  @IsDateString()
  moveInDate: string;

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  monthlyRent: number;

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  depositAmount: number;

  @IsBoolean()
  depositPaid: boolean;

  @IsBoolean()
  kycSubmitted: boolean;
}

export class MoveOutDto {
  @IsDateString()
  moveOutDate: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  depositRefundAmount?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  depositForfeitAmount?: number;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class RoomTransferDto {
  @IsUUID()
  newBedId: string;

  @IsDateString()
  transferDate: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  newMonthlyRent?: number;

  @IsString()
  @IsOptional()
  transferReason?: TransferReason;

  @IsString()
  @IsOptional()
  notes?: string;
}

@Injectable()
export class TenantWorkflowService {
  constructor(
    private prisma: PrismaService,
    private allocation: AllocationService,
    private eventEmitter: EventEmitter2,
  ) {}

  async scheduleVisit(tenantId: string, visitDate: string, notes?: string) {
    const tenant = await this.getTenant(tenantId);
    this.assertValidTransition(tenant.status, TenantStatus.VISIT_SCHEDULED);

    return this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        status: TenantStatus.VISIT_SCHEDULED,
        visitScheduledAt: new Date(visitDate),
        notes: notes ?? tenant.notes,
      },
    });
  }

  async markVisited(tenantId: string) {
    const tenant = await this.getTenant(tenantId);
    this.assertValidTransition(tenant.status, TenantStatus.VISITED);

    return this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        status: TenantStatus.VISITED,
        visitedAt: new Date(),
      },
    });
  }

  async finalizeRoom(
    tenantId: string,
    bedId: string,
    depositAmount: number,
  ) {
    const tenant = await this.getTenant(tenantId);
    this.assertValidTransition(tenant.status, TenantStatus.ROOM_FINALIZED);

    return this.prisma.$transaction(async (tx) => {
      const bed = await tx.bed.findUnique({
        where: { id: bedId },
        include: { room: { select: { propertyId: true } } },
      });

      if (!bed) throw new NotFoundException('Bed not found');
      if (bed.room.propertyId !== tenant.propertyId) {
        throw new BadRequestException('Bed does not belong to this property');
      }

      if (
        bed.status !== BedStatus.AVAILABLE &&
        bed.status !== BedStatus.RESERVED
      ) {
        throw new ConflictException(
          `Bed is not available (status: ${bed.status})`,
        );
      }

      // Guard against double-reservation via active allocation check
      const activeAlloc = await tx.tenantAllocation.findFirst({
        where: { bedId, isActive: true },
      });
      if (activeAlloc) {
        throw new ConflictException('Bed is already occupied by another tenant');
      }

      await tx.bed.update({
        where: { id: bedId },
        data: { status: BedStatus.RESERVED },
      });

      return tx.tenant.update({
        where: { id: tenantId },
        data: {
          status: TenantStatus.ROOM_FINALIZED,
          depositAmount: new Prisma.Decimal(depositAmount),
        },
      });
    });
  }

  async moveIn(tenantId: string, dto: MoveInDto) {
    const tenant = await this.getTenant(tenantId);

    // moveIn is valid from any of these pre-active states
    if (
      !['ROOM_FINALIZED', 'PENDING_COMPLIANCE', 'KYC_PENDING', 'DEPOSIT_PENDING'].includes(
        tenant.status,
      )
    ) {
      throw new BadRequestException(
        `Cannot move in from status ${tenant.status}`,
      );
    }

    const result = await this.prisma.$transaction(async (tx) => {
      await this.allocation.createInitialAllocation(tx, {
        tenantId,
        bedId: dto.bedId,
        startDate: new Date(dto.moveInDate),
        monthlyRent: dto.monthlyRent,
      });

      const { status: targetStatus, depositCompleted, kycCompleted } =
        this.resolveMoveInStatus(dto.depositPaid, dto.kycSubmitted);

      return tx.tenant.update({
        where: { id: tenantId },
        data: {
          status: targetStatus,
          depositCompleted,
          kycCompleted,
          moveInDate: new Date(dto.moveInDate),
          depositAmount: new Prisma.Decimal(dto.depositAmount),
          depositBalance: dto.depositPaid
            ? new Prisma.Decimal(dto.depositAmount)
            : new Prisma.Decimal(0),
          depositStatus: dto.depositPaid
            ? DepositStatus.PAID
            : DepositStatus.PENDING,
          kycStatus: dto.kycSubmitted ? KycStatus.SUBMITTED : KycStatus.PENDING,
        },
      });
    });

    this.eventEmitter.emit(DOMAIN_EVENTS.TENANT_MOVED_IN, {
      tenantId,
      tenantUserId: tenant.user.id,
      propertyId: tenant.propertyId,
      bedId: dto.bedId,
    } satisfies TenantMovedInEvent);

    return result;
  }

  async cancelNotice(tenantId: string) {
    const tenant = await this.getTenant(tenantId);
    this.assertValidTransition(tenant.status, TenantStatus.ACTIVE);

    const result = await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { status: TenantStatus.ACTIVE, noticeDate: null },
    });

    this.eventEmitter.emit(DOMAIN_EVENTS.TENANT_NOTICE_CANCELLED, {
      tenantId,
      tenantUserId: tenant.user.id,
      propertyId: tenant.propertyId,
    } satisfies TenantNoticeCancelledEvent);

    return result;
  }

  async archive(tenantId: string) {
    const tenant = await this.getTenant(tenantId);
    this.assertValidTransition(tenant.status, TenantStatus.ARCHIVED);

    return this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        status: TenantStatus.ARCHIVED,
        archivedAt: new Date(),
      },
    });
  }

  async initiateNotice(tenantId: string) {
    const tenant = await this.getTenant(tenantId);
    this.assertValidTransition(tenant.status, TenantStatus.NOTICE_PERIOD);

    const result = await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { status: TenantStatus.NOTICE_PERIOD, noticeDate: new Date() },
    });

    this.eventEmitter.emit(DOMAIN_EVENTS.TENANT_NOTICE_INITIATED, {
      tenantId,
      tenantUserId: tenant.user.id,
      propertyId: tenant.propertyId,
    } satisfies TenantNoticeInitiatedEvent);

    return result;
  }

  async moveOut(tenantId: string, dto: MoveOutDto, recordedBy: string) {
    const tenant = await this.getTenant(tenantId);

    if (!['ACTIVE', 'NOTICE_PERIOD'].includes(tenant.status)) {
      throw new BadRequestException(
        `Cannot move out from status ${tenant.status}`,
      );
    }

    // Pending dues query and move-out write are in the same transaction
    // to eliminate the TOCTOU window where a concurrent payment could change dues
    const { result, pendingDues } = await this.prisma.$transaction(async (tx) => {
      // Capture pending dues inside the transaction for a consistent snapshot
      const dues = await tx.rentCycle.aggregate({
        where: {
          tenantId,
          status: { in: ['PENDING', 'OVERDUE', 'PARTIAL'] },
        },
        _sum: { remainingAmount: true },
        _count: { _all: true },
      });

      await this.allocation.closeAllocation(tx, tenantId, new Date(dto.moveOutDate));

      const depositPaid = Number(tenant.depositBalance);
      const refundAmount = dto.depositRefundAmount ?? 0;
      const forfeitAmount = dto.depositForfeitAmount ?? 0;

      let depositStatus: DepositStatus;
      if (forfeitAmount > 0 && refundAmount === 0) {
        depositStatus = DepositStatus.FORFEITED;
      } else if (refundAmount >= depositPaid) {
        depositStatus = DepositStatus.REFUNDED;
      } else if (refundAmount > 0) {
        depositStatus = DepositStatus.PARTIALLY_REFUNDED;
      } else {
        depositStatus = tenant.depositStatus;
      }

      // Record the deposit refund as a payment for audit trail
      if (refundAmount > 0) {
        await tx.payment.create({
          data: {
            tenantId,
            propertyId: tenant.propertyId,
            amount: new Prisma.Decimal(refundAmount),
            type: 'DEPOSIT_REFUND',
            method: 'CASH',
            notes: dto.notes ?? undefined,
            recordedBy,
            paidAt: new Date(dto.moveOutDate),
          },
        });
      }

      const updated = await tx.tenant.update({
        where: { id: tenantId },
        data: {
          status: TenantStatus.MOVED_OUT,
          moveOutDate: new Date(dto.moveOutDate),
          depositStatus,
          notes: dto.notes ?? tenant.notes,
        },
      });

      return { result: updated, pendingDues: dues };
    });

    this.eventEmitter.emit(DOMAIN_EVENTS.TENANT_MOVED_OUT, {
      tenantId,
      tenantUserId: tenant.user.id,
      propertyId: tenant.propertyId,
      moveOutDate: new Date(dto.moveOutDate),
    } satisfies TenantMovedOutEvent);

    return {
      tenant: result,
      pendingDuesSummary: {
        totalUnpaidCycles: pendingDues._count._all,
        totalRemainingAmount: Number(pendingDues._sum.remainingAmount ?? 0),
      },
    };
  }

  async roomTransfer(tenantId: string, dto: RoomTransferDto) {
    const tenant = await this.getTenant(tenantId);

    if (tenant.status !== TenantStatus.ACTIVE) {
      throw new BadRequestException(
        'Room transfer only allowed for active tenants',
      );
    }

    // Guard: block transfer if tenant has unresolved overdue cycles
    const overdueCount = await this.prisma.rentCycle.count({
      where: { tenantId, status: 'OVERDUE' },
    });
    if (overdueCount > 0) {
      throw new ConflictException(
        `Cannot transfer: tenant has ${overdueCount} overdue rent cycle(s). Resolve dues before transferring.`,
      );
    }

    // Validate target bed is available before starting the transaction
    const newBed = await this.prisma.bed.findUnique({
      where: { id: dto.newBedId },
      include: { room: { select: { propertyId: true } } },
    });

    if (!newBed) throw new NotFoundException('Target bed not found');
    if (newBed.room.propertyId !== tenant.propertyId) {
      throw new BadRequestException(
        'Target bed does not belong to this property',
      );
    }
    if (newBed.status !== BedStatus.AVAILABLE) {
      throw new ConflictException(
        `Target bed is not available (status: ${newBed.status})`,
      );
    }

    // Capture current bed before the transaction closes the allocation
    const currentAlloc = await this.prisma.tenantAllocation.findFirst({
      where: { tenantId, isActive: true },
      select: { bedId: true },
    });

    const result = await this.prisma.$transaction(async (tx) => {
      const bedInTx = await tx.bed.findUnique({
        where: { id: dto.newBedId },
        select: { status: true },
      });
      if (bedInTx?.status !== BedStatus.AVAILABLE) {
        throw new ConflictException('Target bed was taken by a concurrent request');
      }

      await this.allocation.executeTransfer(
        tx,
        tenantId,
        dto.newBedId,
        new Date(dto.transferDate),
        dto.newMonthlyRent,
        dto.transferReason,
        dto.notes,
      );

      return tx.tenant.findUnique({ where: { id: tenantId } });
    });

    this.eventEmitter.emit(DOMAIN_EVENTS.TENANT_TRANSFERRED, {
      tenantId,
      tenantUserId: tenant.user.id,
      propertyId: tenant.propertyId,
      fromBedId: currentAlloc?.bedId ?? '',
      toBedId: dto.newBedId,
      transferReason: dto.transferReason,
    } satisfies TenantTransferredEvent);

    return result;
  }

  async getMoveOutPreview(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const [pending, outstandingCycles, activeAlloc] = await Promise.all([
      this.prisma.rentCycle.aggregate({
        where: { tenantId, status: { in: ['PENDING', 'OVERDUE', 'PARTIAL'] } },
        _sum: { remainingAmount: true },
        _count: { _all: true },
      }),
      this.prisma.rentCycle.findMany({
        where: { tenantId, status: { in: ['PENDING', 'OVERDUE', 'PARTIAL'] } },
        orderBy: [{ year: 'asc' }, { month: 'asc' }],
        select: {
          id: true,
          month: true,
          year: true,
          dueDate: true,
          rentAmount: true,
          remainingAmount: true,
          status: true,
        },
      }),
      this.prisma.tenantAllocation.findFirst({
        where: { tenantId, isActive: true },
        include: {
          bed: { include: { room: { select: { number: true, floor: true } } } },
        },
      }),
    ]);

    return {
      success: true,
      data: {
        tenantId,
        tenantStatus: tenant.status,
        depositBalance: Number(tenant.depositBalance),
        pendingRentCycles: outstandingCycles.length,
        totalPendingRent: Number(pending._sum.remainingAmount ?? 0),
        netDepositAfterDues: Math.max(
          0,
          Number(tenant.depositBalance) - Number(pending._sum.remainingAmount ?? 0),
        ),
        activeAllocation: activeAlloc
          ? {
              bedId: activeAlloc.bedId,
              roomNumber: activeAlloc.bed.room.number,
              floor: activeAlloc.bed.room.floor,
              startDate: activeAlloc.startDate,
              monthlyRent: Number(activeAlloc.monthlyRent),
            }
          : null,
        outstandingCycles,
      },
    };
  }

  // ── Helpers ──────────────────────────────────────────────────────────

  private resolveMoveInStatus(
    depositPaid: boolean,
    kycSubmitted: boolean,
  ): { status: TenantStatus; depositCompleted: boolean; kycCompleted: boolean } {
    const depositCompleted = depositPaid;
    const kycCompleted = kycSubmitted;
    // Both done → ACTIVE; otherwise PENDING_COMPLIANCE with boolean flags tracking what's left
    const status =
      depositCompleted && kycCompleted
        ? TenantStatus.ACTIVE
        : TenantStatus.PENDING_COMPLIANCE;
    return { status, depositCompleted, kycCompleted };
  }

  private async getTenant(id: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
      include: { user: { select: { id: true } } },
    });
    if (!tenant) throw new NotFoundException('Tenant not found');
    return tenant;
  }

  private assertValidTransition(current: string, next: string) {
    const allowed = TENANT_STATUS_TRANSITIONS[current] ?? [];
    if (!allowed.includes(next)) {
      throw new BadRequestException(
        `Invalid status transition: ${current} → ${next}`,
      );
    }
  }
}
