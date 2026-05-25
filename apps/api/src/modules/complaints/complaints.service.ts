import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ComplaintCategory, ComplaintStatus, Priority } from '@prisma/client';

import { COMPLAINT_STATUS_TRANSITIONS } from '@pg-system/constants';

import { PrismaService } from '../../database/prisma.service';
import {
  DOMAIN_EVENTS,
  ComplaintCreatedEvent,
  ComplaintStatusChangedEvent,
  ComplaintResolvedEvent,
} from '../../events/domain-events';

export interface CreateComplaintDto {
  propertyId: string;
  category: string;
  title: string;
  description: string;
  priority: Priority;
  tenantId?: string;
}

export interface UpdateComplaintDto {
  status?: ComplaintStatus;
  assignedTo?: string;
  priority?: Priority;
  comment?: string;
}

@Injectable()
export class ComplaintsService {
  constructor(
    private prisma: PrismaService,
    private eventEmitter: EventEmitter2,
  ) {}

  async findAll(
    propertyId: string,
    filters: {
      status?: string;
      category?: string;
      // CS-001 fix: cursor-based pagination replaces the hardcoded take:500
      // which would load all complaints into memory and cause OOM on busy properties.
      cursor?: string;  // ID of the last item from the previous page
      limit?: number;
    },
  ) {
    // Cap at 100 to protect against gigantic requests; default 50 for fast mobile rendering
    const limit = Math.min(Math.max(filters.limit ?? 50, 1), 100);

    const complaints = await this.prisma.complaint.findMany({
      where: {
        propertyId,
        ...(filters.status && { status: filters.status as ComplaintStatus }),
        ...(filters.category && { category: filters.category as ComplaintCategory }),
      },
      // Fetch one extra to determine if there is a next page
      take: limit + 1,
      ...(filters.cursor ? { cursor: { id: filters.cursor }, skip: 1 } : {}),
      include: {
        raisedByUser: { select: { id: true, name: true } },
        assignedToUser: { select: { id: true, name: true } },
        tenant: { include: { user: { select: { name: true } } } },
        _count: { select: { updates: true } },
      },
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
    });

    const hasMore = complaints.length > limit;
    const items = hasMore ? complaints.slice(0, limit) : complaints;
    const nextCursor = hasMore ? items.at(-1)?.id : undefined;

    return {
      success: true,
      data: items,
      meta: { hasMore, nextCursor, limit },
    };
  }

  async findOne(id: string) {
    const complaint = await this.prisma.complaint.findUnique({
      where: { id },
      include: {
        raisedByUser: { select: { id: true, name: true } },
        assignedToUser: { select: { id: true, name: true } },
        tenant: { include: { user: { select: { name: true, phone: true } } } },
        updates: {
          include: { user: { select: { id: true, name: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!complaint) throw new NotFoundException('Complaint not found');
    return { success: true, data: complaint };
  }

  async create(dto: CreateComplaintDto, raisedBy: string) {
    const complaint = await this.prisma.complaint.create({
      data: {
        propertyId: dto.propertyId,
        tenantId: dto.tenantId,
        raisedBy,
        category: dto.category as ComplaintCategory,
        title: dto.title,
        description: dto.description,
        priority: dto.priority ?? 'MEDIUM',
      },
    });

    this.eventEmitter.emit(DOMAIN_EVENTS.COMPLAINT_CREATED, {
      complaintId: complaint.id,
      propertyId: complaint.propertyId,
      tenantId: complaint.tenantId ?? undefined,
      raisedBy,
      title: complaint.title,
    } satisfies ComplaintCreatedEvent);

    return { success: true, data: complaint };
  }

  async update(id: string, dto: UpdateComplaintDto, updatedBy: string) {
    const complaint = await this.prisma.complaint.findUnique({
      where: { id },
      include: { tenant: { include: { user: { select: { id: true } } } } },
    });
    if (!complaint) throw new NotFoundException('Complaint not found');

    if (dto.status && dto.status !== complaint.status) {
      const allowed = COMPLAINT_STATUS_TRANSITIONS[complaint.status] ?? [];
      if (!allowed.includes(dto.status)) {
        throw new BadRequestException(
          `Cannot transition complaint from ${complaint.status} to ${dto.status}`,
        );
      }
    }

    // CS-004: Validate that the assignee has a role on this property.
    // Prevents assigning complaints to users from other properties or platform-level
    // admins who have no operational context for this PG.
    if (dto.assignedTo && dto.assignedTo !== complaint.assignedTo) {
      const assigneeRole = await this.prisma.propertyRole.findUnique({
        where: { propertyId_userId: { propertyId: complaint.propertyId, userId: dto.assignedTo } },
        select: { role: true },
      });
      if (!assigneeRole) {
        throw new ForbiddenException(
          'The specified user does not have a role on this property and cannot be assigned to this complaint.',
        );
      }
      // Only OPERATOR, CO_OPERATOR, STAFF roles can be assigned maintenance work
      const assignableRoles = ['OPERATOR', 'CO_OPERATOR', 'STAFF'] as const;
      if (!assignableRoles.includes(assigneeRole.role as typeof assignableRoles[number])) {
        throw new BadRequestException(
          `User with role ${assigneeRole.role} cannot be assigned complaints. Only OPERATOR, CO_OPERATOR, or STAFF may be assigned.`,
        );
      }
    }

    const now = new Date();
    const statusStr = dto.status as string | undefined;

    const result = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.complaint.update({
        where: { id },
        data: {
          ...(dto.status && { status: dto.status }),
          ...(dto.assignedTo && { assignedTo: dto.assignedTo }),
          ...(dto.priority && { priority: dto.priority }),
          ...(statusStr === 'RESOLVED' && { resolvedAt: now }),
          ...(statusStr === 'CLOSED' && { closedAt: now }),
          ...(statusStr === 'REOPENED' && { reopenedAt: now }),
        },
      });

      if (dto.comment || dto.status) {
        const statusChange =
          dto.status && dto.status !== complaint.status
            ? `${complaint.status} → ${dto.status}`
            : undefined;

        await tx.complaintUpdate.create({
          data: {
            complaintId: id,
            updatedBy,
            comment: dto.comment ?? (statusChange ? `Status changed to ${dto.status}` : ''),
            statusChange,
          },
        });
      }

      return updated;
    });

    if (dto.status && dto.status !== complaint.status) {
      this.eventEmitter.emit(DOMAIN_EVENTS.COMPLAINT_STATUS_CHANGED, {
        complaintId: id,
        propertyId: complaint.propertyId,
        fromStatus: complaint.status,
        toStatus: dto.status,
        updatedBy,
      } satisfies ComplaintStatusChangedEvent);

      if (statusStr === 'RESOLVED') {
        this.eventEmitter.emit(DOMAIN_EVENTS.COMPLAINT_RESOLVED, {
          complaintId: id,
          propertyId: complaint.propertyId,
          tenantId: complaint.tenantId ?? undefined,
          tenantUserId: complaint.tenant?.user?.id,
          complaintTitle: complaint.title,
        } satisfies ComplaintResolvedEvent);
      }
    }

    return { success: true, data: result };
  }
}
