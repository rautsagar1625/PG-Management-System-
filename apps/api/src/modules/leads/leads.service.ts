import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { LeadSource, LeadStatus, RoomType } from '@prisma/client';

import { PrismaService } from '../../database/prisma.service';

export interface CreateLeadDto {
  propertyId: string;
  name: string;
  phone: string;
  email?: string;
  source?: LeadSource;
  budget?: number;
  moveInDate?: string;
  roomType?: RoomType;
  notes?: string;
}

export interface UpdateLeadStatusDto {
  status: LeadStatus;
  notes?: string;
}

export interface AssignLeadDto {
  assignedTo: string;
}

export interface ScheduleVisitDto {
  visitDate: string;
}

export interface ConvertLeadDto {
  tenantId: string;
}

@Injectable()
export class LeadsService {
  constructor(private prisma: PrismaService) {}

  async findAll(propertyId: string, filters: { status?: string }) {
    const leads = await this.prisma.lead.findMany({
      where: {
        propertyId,
        ...(filters.status && { status: filters.status as LeadStatus }),
      },
      take: 500,
      include: {
        assignedUser: { select: { id: true, name: true } },
        creator: { select: { id: true, name: true } },
        tenant: { select: { id: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return { success: true, data: leads };
  }

  async findOne(id: string) {
    const lead = await this.prisma.lead.findUnique({
      where: { id },
      include: {
        assignedUser: { select: { id: true, name: true } },
        creator: { select: { id: true, name: true } },
        tenant: { select: { id: true } },
        property: { select: { id: true, name: true } },
      },
    });

    if (!lead) throw new NotFoundException('Lead not found');
    return { success: true, data: lead };
  }

  async create(dto: CreateLeadDto, createdBy: string) {
    const lead = await this.prisma.lead.create({
      data: {
        propertyId: dto.propertyId,
        name: dto.name,
        phone: dto.phone,
        email: dto.email || undefined,
        source: dto.source ?? LeadSource.DIRECT,
        budget: dto.budget !== undefined ? dto.budget : undefined,
        moveInDate: dto.moveInDate ? new Date(dto.moveInDate) : undefined,
        roomType: dto.roomType ? dto.roomType : undefined,
        notes: dto.notes,
        createdBy,
      },
    });

    return { success: true, data: lead };
  }

  async updateStatus(id: string, dto: UpdateLeadStatusDto) {
    const lead = await this.prisma.lead.findUnique({ where: { id } });
    if (!lead) throw new NotFoundException('Lead not found');
    if (lead.status === LeadStatus.CONVERTED) {
      throw new BadRequestException('Cannot update status of a converted lead');
    }

    const updated = await this.prisma.lead.update({
      where: { id },
      data: {
        status: dto.status,
        ...(dto.notes && { notes: dto.notes }),
      },
    });

    return { success: true, data: updated };
  }

  async assign(id: string, dto: AssignLeadDto) {
    const lead = await this.prisma.lead.findUnique({ where: { id } });
    if (!lead) throw new NotFoundException('Lead not found');

    const updated = await this.prisma.lead.update({
      where: { id },
      data: { assignedTo: dto.assignedTo },
    });

    return { success: true, data: updated };
  }

  async scheduleVisit(id: string, dto: ScheduleVisitDto) {
    const lead = await this.prisma.lead.findUnique({ where: { id } });
    if (!lead) throw new NotFoundException('Lead not found');

    const updated = await this.prisma.lead.update({
      where: { id },
      data: {
        visitDate: new Date(dto.visitDate),
        status: LeadStatus.VISIT_SCHEDULED,
      },
    });

    return { success: true, data: updated };
  }

  async convert(id: string, dto: ConvertLeadDto) {
    const lead = await this.prisma.lead.findUnique({ where: { id } });
    if (!lead) throw new NotFoundException('Lead not found');
    if (lead.status === LeadStatus.CONVERTED) {
      throw new BadRequestException('Lead is already converted');
    }

    const updated = await this.prisma.lead.update({
      where: { id },
      data: {
        status: LeadStatus.CONVERTED,
        convertedAt: new Date(),
        tenantId: dto.tenantId,
      },
    });

    return { success: true, data: updated };
  }

  async softDelete(id: string) {
    const lead = await this.prisma.lead.findUnique({ where: { id } });
    if (!lead) throw new NotFoundException('Lead not found');
    if (lead.status === LeadStatus.CONVERTED) {
      throw new BadRequestException('Cannot delete a converted lead');
    }

    const updated = await this.prisma.lead.update({
      where: { id },
      data: { status: LeadStatus.LOST },
    });

    return { success: true, data: updated };
  }
}
