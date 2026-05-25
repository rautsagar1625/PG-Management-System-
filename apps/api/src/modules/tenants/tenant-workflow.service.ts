import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
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
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

import { TENANT_STATUS_TRANSITIONS } from '@pg-system/constants';

import { CacheService } from '../../database/cache.service';
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

  // AE-004 fix: deposit refunds are usually UPI or bank transfer, not cash.
  // Previously hardcoded to 'CASH', causing reconciliation mismatches.
  @IsIn(['CASH', 'UPI', 'BANK_TRANSFER', 'CHEQUE', 'CARD'])
  @IsOptional()
  depositRefundMethod?: 'CASH' | 'UPI' | 'BANK_TRANSFER' | 'CHEQUE' | 'CARD';

  // TL-005: explicit flag required to move a tenant out before their notice period ends
  @IsBoolean()
  @IsOptional()
  forceEarlyMoveOut?: boolean;

  // TL-004: preview token — pin the financial snapshot shown during preview.
  // If the balance has changed since the operator reviewed the preview, the
  // server rejects the submission and asks for a fresh preview.
  // Optional — omitting it skips the stale-balance check (for programmatic callers).
  @IsString()
  @IsOptional()
  previewToken?: string;

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
    private cache: CacheService,
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

    // AE-001 fix: When a tenant has gone through finalizeRoom, that step sets the
    // chosen bed to BedStatus.RESERVED. The bedId passed here must match that
    // RESERVED bed — passing a different bedId would leave a ghost RESERVED bed
    // whose occupancy counter was incremented in finalizeRoom but never cleaned up,
    // corrupting room occupancy data permanently.
    //
    // A RESERVED bed is the definitive proof of which bed was chosen in finalizeRoom.
    // Any other bedId (AVAILABLE, OCCUPIED) indicates a mismatch.
    if (['ROOM_FINALIZED', 'PENDING_COMPLIANCE'].includes(tenant.status as string)) {
      const targetBed = await this.prisma.bed.findUnique({
        where: { id: dto.bedId },
        include: { room: { select: { propertyId: true } } },
      });
      if (!targetBed) {
        throw new NotFoundException(`Bed ${dto.bedId} not found`);
      }
      if (targetBed.room.propertyId !== tenant.propertyId) {
        throw new BadRequestException('Bed does not belong to this property');
      }
      if (targetBed.status !== BedStatus.RESERVED) {
        throw new ConflictException(
          `Bed must be in RESERVED status for move-in (current: ${targetBed.status}). ` +
          'Use POST /tenants/:id/finalize-room to reserve a bed first, or pass the ' +
          'exact bedId that was reserved in that step.',
        );
      }
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

    const now = new Date();

    // SP4-6: DPDP-lite — anonymise PII atomically with the status change.
    // All steps run in a single transaction so we never leave the record
    // in a half-anonymised state if a later step fails.
    //
    // What is redacted:
    //   • User.name / User.phone / User.whatsappPhone  (linked User account)
    //   • TenantDocument.documentNumber + fileUrl      (Aadhaar / PAN numbers)
    //   • EmergencyContact.name / .phone / .relation   (third-party PII)
    //
    // What is NOT redacted:
    //   • User.email  — kept for auth record / support tracing
    //   • Financial records (RentCycle, Payment) — required for accounting
    //   • Audit log — immutable by design
    await this.prisma.$transaction(async (tx) => {
      await tx.tenant.update({
        where: { id: tenantId },
        data: {
          status: TenantStatus.ARCHIVED,
          archivedAt: now,
          anonymisedAt: now,
        },
      });

      // Redact KYC document identifiers and file URLs
      await tx.tenantDocument.updateMany({
        where: { tenantId },
        data: { documentNumber: 'REDACTED', fileUrl: null },
      });

      // Redact third-party PII from emergency contacts
      await tx.emergencyContact.updateMany({
        where: { tenantId },
        data: { name: 'REDACTED', phone: '0000000000', relation: 'REDACTED' },
      });

      // Redact the linked User's direct identifiers.
      // User.tenantProfile is 1:1 (userId is @unique on Tenant), so this
      // user can only belong to this one tenant — safe to redact.
      await tx.user.update({
        where: { id: tenant.user.id },
        data: {
          name: `Archived-${tenant.tenantCode}`,
          phone: null,
          whatsappPhone: null,
        },
      });
    });

    return { tenantId, archivedAt: now, anonymisedAt: now };
  }

  // TL-003 fix: A rejected lead can now be re-engaged when circumstances change
  // (e.g. rooms become available, pricing is negotiated). Without this, operators
  // were creating duplicate tenant records for the same person, destroying history
  // and artificially deflating lead-to-conversion analytics.
  async reEngage(tenantId: string, notes?: string) {
    const tenant = await this.getTenant(tenantId);
    this.assertValidTransition(tenant.status, TenantStatus.LEAD);

    return this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        status: TenantStatus.LEAD,
        notes: notes ?? tenant.notes,
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

    // TL-004: Stale preview guard — if the operator provided a preview token,
    // verify that the financial snapshot has not changed since the preview was generated.
    // This prevents an operator from confirming a ₹2,000 refund, then a payment arriving,
    // and the system processing the refund based on stale data.
    if (dto.previewToken) {
      const snapshotJson = await this.cache.get<string>(`moveout-preview:${tenantId}:${dto.previewToken}`);
      if (!snapshotJson) {
        throw new ConflictException(
          'Move-out preview has expired or is invalid. Please refresh the preview and resubmit.',
        );
      }
      const snapshot = JSON.parse(snapshotJson) as { depositBalance: number; totalPendingRent: number };
      const currentDeposit = Number(tenant.depositBalance);
      const currentPending = await this.prisma.rentCycle.aggregate({
        where: { tenantId, status: { in: ['PENDING', 'OVERDUE', 'PARTIAL'] } },
        _sum: { remainingAmount: true },
      });
      const currentPendingRent = Number(currentPending._sum.remainingAmount ?? 0);

      if (
        Math.abs(currentDeposit - snapshot.depositBalance) > 0.01 ||
        Math.abs(currentPendingRent - snapshot.totalPendingRent) > 0.01
      ) {
        // Invalidate the stale token immediately
        void this.cache.del(`moveout-preview:${tenantId}:${dto.previewToken}`).catch(() => undefined);
        throw new ConflictException(
          'Financial balances changed since the move-out preview was generated. ' +
          'A payment may have arrived. Please refresh the preview and resubmit.',
        );
      }
      // Token used — delete it so it cannot be replayed
      void this.cache.del(`moveout-preview:${tenantId}:${dto.previewToken}`).catch(() => undefined);
    }

    // TL-005 fix: If the tenant served notice, enforce a minimum 14-day notice period.
    // An operator trying to move out a tenant immediately after notice must explicitly
    // pass forceEarlyMoveOut: true — this is logged in the audit trail.
    if (tenant.noticeDate && !dto.forceEarlyMoveOut) {
      const minimumNoticeEnd = new Date(tenant.noticeDate);
      minimumNoticeEnd.setDate(minimumNoticeEnd.getDate() + 14);
      const requestedMoveOut = new Date(dto.moveOutDate);
      if (requestedMoveOut < minimumNoticeEnd) {
        throw new BadRequestException(
          `Move-out date ${dto.moveOutDate} is within the minimum 14-day notice period. ` +
          `Notice served: ${tenant.noticeDate.toISOString().slice(0, 10)}, ` +
          `earliest allowed: ${minimumNoticeEnd.toISOString().slice(0, 10)}. ` +
          'Set forceEarlyMoveOut: true to override (use only with OWNER approval).',
        );
      }
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

      // Record the deposit refund as a payment for audit trail.
      // AE-004 fix: use caller-supplied method (default CASH) so bank statement
      // reconciliation can match records to actual UPI/bank transfer refunds.
      if (refundAmount > 0) {
        await tx.payment.create({
          data: {
            tenantId,
            propertyId: tenant.propertyId,
            amount: new Prisma.Decimal(refundAmount),
            type: 'DEPOSIT_REFUND',
            method: dto.depositRefundMethod ?? 'CASH',
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

    const depositBalance = Number(tenant.depositBalance);
    const totalPendingRent = Number(pending._sum.remainingAmount ?? 0);

    // TL-004: Generate a short-lived preview token that pins the financial snapshot.
    // moveOut will validate current balances match this snapshot before proceeding.
    // TTL: 30 minutes — enough time for operator to review and confirm.
    const previewToken = randomUUID();
    const snapshot = { depositBalance, totalPendingRent, generatedAt: Date.now() };
    void this.cache
      .set(`moveout-preview:${tenantId}:${previewToken}`, JSON.stringify(snapshot), 1800)
      .catch(() => undefined); // best-effort; missing cache = operator must re-fetch

    return {
      success: true,
      data: {
        tenantId,
        tenantStatus: tenant.status,
        depositBalance,
        pendingRentCycles: outstandingCycles.length,
        totalPendingRent,
        netDepositAfterDues: Math.max(0, depositBalance - totalPendingRent),
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
        // Surface token so the UI can pass it back with the moveOut submission
        previewToken,
        previewExpiresInSeconds: 1800,
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
