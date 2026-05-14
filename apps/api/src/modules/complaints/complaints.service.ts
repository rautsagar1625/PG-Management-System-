import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { ComplaintStatus, Priority, Prisma } from '@prisma/client';

import { PrismaService } from '../../database/prisma.service';

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

const STATUS_TRANSITIONS: Record<ComplaintStatus, ComplaintStatus[]> = {
  OPEN: ['ASSIGNED', 'REJECTED'],
  ASSIGNED: ['IN_PROGRESS', 'OPEN'],
  IN_PROGRESS: ['RESOLVED', 'ASSIGNED'],
  RESOLVED: ['CLOSED', 'IN_PROGRESS'],
  CLOSED: [],
  REJECTED: [],
};

@Injectable()
export class ComplaintsService {
  constructor(private prisma: PrismaService) {}

  async findAll(propertyId: string, filters: { status?: string; category?: string }) {
    const complaints = await this.prisma.complaint.findMany({
      where: {
        propertyId,
        ...(filters.status && { status: filters.status as ComplaintStatus }),
        ...(filters.category && { category: filters.category as Prisma.EnumComplaintCategoryFilter }),
      },
      include: {
        creator: { select: { id: true, name: true } },
        assignee: { select: { id: true, name: true } },
        tenant: { include: { user: { select: { name: true } } } },
        _count: { select: { comments: true } },
      },
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
    });

    return { success: true, data: complaints };
  }

  async findOne(id: string) {
    const complaint = await this.prisma.complaint.findUnique({
      where: { id },
      include: {
        creator: { select: { id: true, name: true } },
        assignee: { select: { id: true, name: true } },
        tenant: { include: { user: { select: { name: true, phone: true } } } },
        comments: {
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
        category: dto.category as Prisma.EnumComplaintCategoryFilter,
        title: dto.title,
        description: dto.description,
        priority: dto.priority,
      },
    });
    return { success: true, data: complaint };
  }

  async update(id: string, dto: UpdateComplaintDto, updatedBy: string) {
    const complaint = await this.prisma.complaint.findUnique({ where: { id } });
    if (!complaint) throw new NotFoundException('Complaint not found');

    if (dto.status && dto.status !== complaint.status) {
      const allowed = STATUS_TRANSITIONS[complaint.status];
      if (!allowed.includes(dto.status)) {
        throw new BadRequestException(
          `Cannot transition complaint from ${complaint.status} to ${dto.status}`,
        );
      }
    }

    const now = new Date();
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.complaint.update({
        where: { id },
        data: {
          ...(dto.status && { status: dto.status }),
          ...(dto.assignedTo && { assignedTo: dto.assignedTo }),
          ...(dto.priority && { priority: dto.priority }),
          ...(dto.status === 'RESOLVED' && { resolvedAt: now }),
          ...(dto.status === 'CLOSED' && { closedAt: now }),
        },
      });

      if (dto.comment) {
        await tx.complaintComment.create({
          data: { complaintId: id, userId: updatedBy, comment: dto.comment },
        });
      }

      return { success: true, data: updated };
    });
  }
}
