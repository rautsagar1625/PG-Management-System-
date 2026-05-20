import { Injectable, NotFoundException } from '@nestjs/common';
import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import { PrismaService } from '../../database/prisma.service';
import { ComplaintCategory, Priority } from '@prisma/client';

export class CreateTenantComplaintDto {
  @IsString()
  @MinLength(3)
  title: string;

  @IsString()
  @MinLength(10)
  description: string;

  @IsIn(['MAINTENANCE', 'PLUMBING', 'ELECTRICAL', 'HOUSEKEEPING', 'SECURITY', 'FOOD', 'WIFI', 'NOISE', 'OTHER'])
  category: string;

  @IsIn(['LOW', 'MEDIUM', 'HIGH', 'URGENT'])
  @IsOptional()
  priority?: string;
}

@Injectable()
export class TenantSelfService {
  constructor(private prisma: PrismaService) {}

  private async resolveTenantId(userId: string): Promise<string> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!tenant) throw new NotFoundException('Tenant record not found for this user');
    return tenant.id;
  }

  async getDashboard(userId: string) {
    const tenantId = await this.resolveTenantId(userId);

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        tenantCode: true,
        status: true,
        depositBalance: true,
        user: { select: { name: true, email: true, phone: true } },
        allocations: {
          where: { isActive: true },
          take: 1,
          include: {
            bed: {
              select: {
                label: true,
                room: {
                  select: {
                    number: true,
                    floor: true,
                    property: { select: { name: true, address: true, city: true } },
                  },
                },
              },
            },
          },
        },
        rentCycles: {
          orderBy: [{ year: 'desc' }, { month: 'desc' }],
          take: 1,
          select: {
            id: true,
            month: true,
            year: true,
            rentAmount: true,
            paidAmount: true,
            remainingAmount: true,
            status: true,
            dueDate: true,
          },
        },
      },
    });

    if (!tenant) throw new NotFoundException('Tenant not found');

    const activeAllocation = tenant.allocations[0] ?? null;
    const currentCycle = tenant.rentCycles[0] ?? null;

    return {
      success: true,
      data: {
        tenant: {
          id: tenant.id,
          tenantCode: tenant.tenantCode,
          status: tenant.status,
          monthlyRent: activeAllocation ? Number(activeAllocation.monthlyRent) : null,
          depositBalance: Number(tenant.depositBalance),
          user: tenant.user,
        },
        allocation: activeAllocation
          ? {
              room: {
                roomNumber: activeAllocation.bed.room.number,
                floor: activeAllocation.bed.room.floor,
              },
              bed: { label: activeAllocation.bed.label },
              property: activeAllocation.bed.room.property,
              startDate: activeAllocation.startDate.toISOString(),
            }
          : null,
        currentCycle: currentCycle
          ? {
              id: currentCycle.id,
              month: currentCycle.month,
              year: currentCycle.year,
              expectedRent: Number(currentCycle.rentAmount),
              paidAmount: Number(currentCycle.paidAmount),
              remainingAmount: Number(currentCycle.remainingAmount),
              status: currentCycle.status,
              dueDate: currentCycle.dueDate.toISOString(),
            }
          : null,
      },
    };
  }

  async getRentHistory(userId: string) {
    const tenantId = await this.resolveTenantId(userId);

    const cycles = await this.prisma.rentCycle.findMany({
      where: { tenantId },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
      select: {
        id: true,
        month: true,
        year: true,
        rentAmount: true,
        paidAmount: true,
        remainingAmount: true,
        status: true,
        dueDate: true,
      },
    });

    return {
      success: true,
      data: cycles.map((c) => ({
        id: c.id,
        month: c.month,
        year: c.year,
        expectedRent: Number(c.rentAmount),
        paidAmount: Number(c.paidAmount),
        remainingAmount: Number(c.remainingAmount),
        status: c.status,
        dueDate: c.dueDate.toISOString(),
      })),
    };
  }

  async getComplaints(userId: string) {
    const tenantId = await this.resolveTenantId(userId);

    const complaints = await this.prisma.complaint.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      include: {
        updates: {
          select: { id: true, comment: true, statusChange: true, createdAt: true },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    return {
      success: true,
      data: complaints.map((c) => ({
        id: c.id,
        title: c.title,
        description: c.description,
        category: c.category,
        priority: c.priority,
        status: c.status,
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString(),
        updates: c.updates.map((u) => ({
          id: u.id,
          comment: u.comment,
          statusChange: u.statusChange,
          createdAt: u.createdAt.toISOString(),
        })),
      })),
    };
  }

  async createComplaint(
    userId: string,
    dto: CreateTenantComplaintDto,
  ) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { userId },
      select: { id: true, propertyId: true },
    });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const complaint = await this.prisma.complaint.create({
      data: {
        propertyId: tenant.propertyId,
        tenantId: tenant.id,
        raisedBy: userId,
        title: dto.title,
        description: dto.description,
        category: dto.category as ComplaintCategory,
        priority: (dto.priority as Priority) ?? 'MEDIUM',
      },
    });

    return { success: true, data: complaint };
  }

  async getProfile(userId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { userId },
      include: {
        user: { select: { name: true, email: true, phone: true } },
        emergencyContacts: { take: 1, orderBy: { createdAt: 'asc' } },
        allocations: {
          where: { isActive: true },
          take: 1,
          include: {
            bed: {
              select: {
                label: true,
                room: {
                  select: {
                    number: true,
                    floor: true,
                    property: {
                      select: { name: true, address: true, city: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!tenant) throw new NotFoundException('Tenant not found');

    const activeAllocation = tenant.allocations[0] ?? null;
    const emergency = tenant.emergencyContacts[0] ?? null;

    return {
      success: true,
      data: {
        id: tenant.id,
        tenantCode: tenant.tenantCode,
        status: tenant.status,
        monthlyRent: activeAllocation ? Number(activeAllocation.monthlyRent) : null,
        depositBalance: Number(tenant.depositBalance),
        moveInDate: tenant.moveInDate?.toISOString() ?? null,
        expectedMoveOut: tenant.moveOutDate?.toISOString() ?? null,
        emergencyContactName: emergency?.name ?? null,
        emergencyContactPhone: emergency?.phone ?? null,
        user: tenant.user,
        allocation: activeAllocation
          ? {
              room: {
                roomNumber: activeAllocation.bed.room.number,
                floor: activeAllocation.bed.room.floor,
              },
              bed: { label: activeAllocation.bed.label },
              property: activeAllocation.bed.room.property,
              startDate: activeAllocation.startDate.toISOString(),
            }
          : null,
      },
    };
  }
}
