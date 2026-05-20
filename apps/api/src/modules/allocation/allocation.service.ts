import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AllocationReason, BedStatus, Prisma, RoomStatus, TransferReason } from '@prisma/client';

import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';

export interface CreateAllocationParams {
  tenantId: string;
  bedId: string;
  startDate: Date;
  monthlyRent: Prisma.Decimal | number;
  reason?: AllocationReason;
  transferReason?: TransferReason;
  notes?: string;
}

export interface CloseAllocationResult {
  allocationId: string;
  bedId: string;
  roomId: string;
}

@Injectable()
export class AllocationService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  // ── Move-In: create the allocation record + occupy the bed ───────────
  async createInitialAllocation(
    tx: Prisma.TransactionClient,
    params: CreateAllocationParams,
  ) {
    const {
      tenantId,
      bedId,
      startDate,
      monthlyRent,
      reason = AllocationReason.INITIAL,
      transferReason,
      notes,
    } = params;

    // Guard: one active allocation per tenant
    const existingTenantAlloc = await tx.tenantAllocation.findFirst({
      where: { tenantId, isActive: true },
    });
    if (existingTenantAlloc) {
      throw new ConflictException(
        `Tenant already has an active allocation on bed ${existingTenantAlloc.bedId}`,
      );
    }

    // Guard: bed must not be OCCUPIED or UNDER_MAINTENANCE
    const bed = await tx.bed.findUnique({
      where: { id: bedId },
      select: { id: true, roomId: true, status: true },
    });
    if (!bed) throw new NotFoundException('Bed not found');
    if (
      bed.status === BedStatus.OCCUPIED ||
      bed.status === BedStatus.UNDER_MAINTENANCE
    ) {
      throw new ConflictException(
        `Bed is not available for allocation (status: ${bed.status})`,
      );
    }

    const allocation = await tx.tenantAllocation.create({
      data: {
        tenantId,
        bedId,
        startDate,
        monthlyRent: new Prisma.Decimal(Number(monthlyRent)),
        reason,
        transferReason: transferReason ?? null,
        notes,
        isActive: true,
      },
    });

    await tx.bed.update({
      where: { id: bedId },
      data: { status: BedStatus.OCCUPIED },
    });

    await this.updateRoomOccupancy(tx, bed.roomId);

    await this.audit.logTx(tx, {
      action: reason === AllocationReason.INITIAL ? 'MOVE_IN' : 'TRANSFER_IN',
      entity: 'TenantAllocation',
      entityId: allocation.id,
      after: { tenantId, bedId, reason, monthlyRent: Number(monthlyRent) },
    });

    return allocation;
  }

  // ── Move-Out / pre-Transfer: close the active allocation ────────────
  async closeAllocation(
    tx: Prisma.TransactionClient,
    tenantId: string,
    endDate: Date,
  ): Promise<CloseAllocationResult> {
    const active = await tx.tenantAllocation.findFirst({
      where: { tenantId, isActive: true },
      include: { bed: { select: { roomId: true } } },
    });

    if (!active) {
      throw new NotFoundException('No active allocation found for this tenant');
    }

    await tx.tenantAllocation.update({
      where: { id: active.id },
      data: { isActive: false, endDate },
    });

    await tx.bed.update({
      where: { id: active.bedId },
      data: { status: BedStatus.AVAILABLE },
    });

    await this.updateRoomOccupancy(tx, active.bed.roomId);

    await this.audit.logTx(tx, {
      action: 'MOVE_OUT',
      entity: 'TenantAllocation',
      entityId: active.id,
      before: { tenantId, bedId: active.bedId, isActive: true },
      after: { isActive: false, endDate: endDate.toISOString() },
    });

    return {
      allocationId: active.id,
      bedId: active.bedId,
      roomId: active.bed.roomId,
    };
  }

  // ── Room Transfer: close old allocation + open new one atomically ────
  async executeTransfer(
    tx: Prisma.TransactionClient,
    tenantId: string,
    newBedId: string,
    transferDate: Date,
    newMonthlyRent?: number,
    transferReason?: TransferReason,
    notes?: string,
  ) {
    const currentAlloc = await tx.tenantAllocation.findFirst({
      where: { tenantId, isActive: true },
    });

    if (!currentAlloc) {
      throw new NotFoundException('No active allocation found for transfer');
    }

    const rentToUse =
      newMonthlyRent !== undefined
        ? newMonthlyRent
        : Number(currentAlloc.monthlyRent);

    await this.closeAllocation(tx, tenantId, transferDate);

    return this.createInitialAllocation(tx, {
      tenantId,
      bedId: newBedId,
      startDate: transferDate,
      monthlyRent: rentToUse,
      reason: AllocationReason.TRANSFER,
      transferReason,
      notes,
    });
  }

  // ── Queries ──────────────────────────────────────────────────────────

  async getActiveAllocation(tenantId: string) {
    return this.prisma.tenantAllocation.findFirst({
      where: { tenantId, isActive: true },
      include: {
        bed: {
          include: {
            room: {
              select: { id: true, number: true, floor: true, type: true },
            },
          },
        },
      },
    });
  }

  async getAllocationHistory(tenantId: string) {
    return this.prisma.tenantAllocation.findMany({
      where: { tenantId },
      include: {
        bed: {
          include: {
            room: {
              select: { id: true, number: true, floor: true, type: true },
            },
          },
        },
      },
      orderBy: { startDate: 'desc' },
    });
  }

  // ── Recompute room status from current bed states ────────────────────
  async updateRoomOccupancy(
    tx: Prisma.TransactionClient,
    roomId: string,
  ): Promise<void> {
    const room = await tx.room.findUnique({
      where: { id: roomId },
      include: { beds: { select: { status: true } } },
    });

    if (!room) return;

    const total = room.beds.length;
    const occupied = room.beds.filter(
      (b) => b.status === BedStatus.OCCUPIED,
    ).length;

    let status: RoomStatus;
    if (occupied === 0) {
      status = RoomStatus.AVAILABLE;
    } else if (occupied >= total) {
      status = RoomStatus.FULLY_OCCUPIED;
    } else {
      status = RoomStatus.PARTIALLY_OCCUPIED;
    }

    await tx.room.update({ where: { id: roomId }, data: { status } });
  }
}
