import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BedStatus,
  DepositStatus,
  KycStatus,
  Prisma,
  TenantStatus,
} from '@prisma/client';

import { TENANT_STATUS_TRANSITIONS } from '@pg-system/constants';

import { PrismaService } from '../../database/prisma.service';
import { AllocationService } from '../allocation/allocation.service';

export interface MoveInDto {
  bedId: string;
  moveInDate: string;
  monthlyRent: number;
  depositAmount: number;
  depositPaid: boolean;
  kycSubmitted: boolean;
}

export interface MoveOutDto {
  moveOutDate: string;
  depositRefundAmount?: number;
  depositForfeitAmount?: number;
  notes?: string;
}

export interface RoomTransferDto {
  newBedId: string;
  transferDate: string;
  newMonthlyRent?: number;
  notes?: string;
}

@Injectable()
export class TenantWorkflowService {
  constructor(
    private prisma: PrismaService,
    private allocation: AllocationService,
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
      !['ROOM_FINALIZED', 'KYC_PENDING', 'DEPOSIT_PENDING'].includes(
        tenant.status,
      )
    ) {
      throw new BadRequestException(
        `Cannot move in from status ${tenant.status}`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      await this.allocation.createInitialAllocation(tx, {
        tenantId,
        bedId: dto.bedId,
        startDate: new Date(dto.moveInDate),
        monthlyRent: dto.monthlyRent,
      });

      const targetStatus = this.resolveMoveInStatus(
        dto.depositPaid,
        dto.kycSubmitted,
      );

      return tx.tenant.update({
        where: { id: tenantId },
        data: {
          status: targetStatus,
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
  }

  async initiateNotice(tenantId: string) {
    const tenant = await this.getTenant(tenantId);
    this.assertValidTransition(tenant.status, TenantStatus.NOTICE_PERIOD);

    return this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        status: TenantStatus.NOTICE_PERIOD,
        noticeDate: new Date(),
      },
    });
  }

  async moveOut(tenantId: string, dto: MoveOutDto) {
    const tenant = await this.getTenant(tenantId);

    if (!['ACTIVE', 'NOTICE_PERIOD'].includes(tenant.status)) {
      throw new BadRequestException(
        `Cannot move out from status ${tenant.status}`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      await this.allocation.closeAllocation(
        tx,
        tenantId,
        new Date(dto.moveOutDate),
      );

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

      return tx.tenant.update({
        where: { id: tenantId },
        data: {
          status: TenantStatus.MOVED_OUT,
          moveOutDate: new Date(dto.moveOutDate),
          depositStatus,
          notes: dto.notes ?? tenant.notes,
        },
      });
    });
  }

  async roomTransfer(tenantId: string, dto: RoomTransferDto) {
    const tenant = await this.getTenant(tenantId);

    if (tenant.status !== TenantStatus.ACTIVE) {
      throw new BadRequestException(
        'Room transfer only allowed for active tenants',
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

    return this.prisma.$transaction(async (tx) => {
      await this.allocation.executeTransfer(
        tx,
        tenantId,
        dto.newBedId,
        new Date(dto.transferDate),
        dto.newMonthlyRent,
        dto.notes,
      );

      return tx.tenant.findUnique({ where: { id: tenantId } });
    });
  }

  // ── Helpers ──────────────────────────────────────────────────────────

  private resolveMoveInStatus(
    depositPaid: boolean,
    kycSubmitted: boolean,
  ): TenantStatus {
    if (!depositPaid) return TenantStatus.DEPOSIT_PENDING;
    if (!kycSubmitted) return TenantStatus.KYC_PENDING;
    return TenantStatus.ACTIVE;
  }

  private async getTenant(id: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id } });
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
