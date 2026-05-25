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

// AL-002: Cap JSON payload size to prevent audit log table bloat.
// Large entities (Tenant with eager-loaded relations) can be 100 KB+.
// We store a truncated snapshot — enough for human review, not a full DB dump.
const AUDIT_PAYLOAD_MAX_BYTES = 10_240; // 10 KB per before/after field

function truncatePayload(
  obj: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (!obj) return obj;
  const json = JSON.stringify(obj);
  if (json.length <= AUDIT_PAYLOAD_MAX_BYTES) return obj;
  // Return a sentinel indicating truncation; include the first few keys for context
  const keys = Object.keys(obj).slice(0, 10);
  const preview: Record<string, unknown> = {};
  for (const k of keys) preview[k] = obj[k];
  return {
    __truncated: true,
    __originalSizeBytes: json.length,
    __preview: preview,
  };
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
        before: truncatePayload(params.before) as Prisma.InputJsonValue,
        after: truncatePayload(params.after) as Prisma.InputJsonValue,
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
          before: truncatePayload(params.before) as Prisma.InputJsonValue,
          after: truncatePayload(params.after) as Prisma.InputJsonValue,
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
      include: { user: { select: { id: true, name: true } } },
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
      include: { user: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
      take: options.take ?? 50,
      skip: options.skip ?? 0,
    });
  }

  async queryLogs(params: {
    propertyId?: string;
    userId?: string;
    entity?: string;
    action?: string;
    dateFrom?: string;
    dateTo?: string;
    page?: number;
    limit?: number;
  }) {
    const { propertyId, userId, entity, action, dateFrom, dateTo, page = 1, limit = 50 } = params;
    const cappedLimit = Math.min(limit, 200);
    const skip = (page - 1) * cappedLimit;

    const where: Prisma.AuditLogWhereInput = {
      ...(propertyId && { propertyId }),
      ...(userId && { userId }),
      ...(entity && { entity }),
      ...(action && { action: { contains: action, mode: 'insensitive' } }),
      ...(dateFrom || dateTo
        ? {
            createdAt: {
              ...(dateFrom && { gte: new Date(dateFrom) }),
              ...(dateTo && { lte: new Date(dateTo + 'T23:59:59Z') }),
            },
          }
        : {}),
    };

    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        include: { user: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: cappedLimit,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      success: true,
      data: logs,
      meta: { total, page, limit: cappedLimit, totalPages: Math.ceil(total / cappedLimit) },
    };
  }
}
