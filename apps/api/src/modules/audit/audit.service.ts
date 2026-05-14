import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../database/prisma.service';

export interface LogEventParams {
  action: string;         // "MOVE_IN" | "MOVE_OUT" | "TRANSFER" | "PAYMENT_RECORDED" | etc.
  entity: string;         // "Tenant" | "TenantAllocation" | "Payment" | "Room"
  entityId: string;
  propertyId?: string;
  userId?: string;        // Actor (operator who triggered the event)
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  // ── Log inside an open transaction (preferred for financial ops) ────
  async logTx(
    tx: Prisma.TransactionClient,
    params: LogEventParams,
  ): Promise<void> {
    await tx.auditLog.create({
      data: {
        action: params.action,
        entity: params.entity,
        entityId: params.entityId,
        propertyId: params.propertyId,
        userId: params.userId,
        before: params.before as Prisma.InputJsonValue,
        after: params.after as Prisma.InputJsonValue,
        metadata: params.metadata as Prisma.InputJsonValue,
      },
    });
  }

  // ── Fire-and-forget log (non-critical, outside transaction) ────────
  async log(params: LogEventParams): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          action: params.action,
          entity: params.entity,
          entityId: params.entityId,
          propertyId: params.propertyId,
          userId: params.userId,
          before: params.before as Prisma.InputJsonValue,
          after: params.after as Prisma.InputJsonValue,
          metadata: params.metadata as Prisma.InputJsonValue,
        },
      });
    } catch {
      // Audit failure must never break the business operation
    }
  }

  // ── Queries ──────────────────────────────────────────────────────────

  async getEntityHistory(entity: string, entityId: string) {
    return this.prisma.auditLog.findMany({
      where: { entity, entityId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async getPropertyActivity(
    propertyId: string,
    options: { take?: number; skip?: number } = {},
  ) {
    return this.prisma.auditLog.findMany({
      where: { propertyId },
      orderBy: { createdAt: 'desc' },
      take: options.take ?? 50,
      skip: options.skip ?? 0,
    });
  }
}
