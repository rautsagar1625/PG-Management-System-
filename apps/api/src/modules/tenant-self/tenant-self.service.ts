import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import * as crypto from 'crypto';
import Razorpay from 'razorpay';
import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CacheService } from '../../database/cache.service';
import { PrismaService } from '../../database/prisma.service';
import { ComplaintCategory, Priority } from '@prisma/client';

const TTL_TENANT_DASHBOARD = 60; // 1 minute — tenants expect near-real-time rent status

export class CreateTenantComplaintDto {
  @ApiProperty({ example: 'Water leakage in bathroom', minLength: 3 })
  @IsString()
  @MinLength(3)
  title: string;

  @ApiProperty({ example: 'There is a water leak from the overhead tap since morning', minLength: 10 })
  @IsString()
  @MinLength(10)
  description: string;

  @ApiProperty({
    enum: ['MAINTENANCE', 'PLUMBING', 'ELECTRICAL', 'HOUSEKEEPING', 'SECURITY', 'FOOD', 'WIFI', 'NOISE', 'OTHER'],
    example: 'PLUMBING',
  })
  @IsIn(['MAINTENANCE', 'PLUMBING', 'ELECTRICAL', 'HOUSEKEEPING', 'SECURITY', 'FOOD', 'WIFI', 'NOISE', 'OTHER'])
  category: string;

  @ApiPropertyOptional({ enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'], example: 'HIGH', default: 'MEDIUM' })
  @IsIn(['LOW', 'MEDIUM', 'HIGH', 'URGENT'])
  @IsOptional()
  priority?: string;
}

@Injectable()
export class TenantSelfService {
  private razorpay: Razorpay | null;

  constructor(
    private prisma: PrismaService,
    private cache: CacheService,
  ) {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    this.razorpay = keyId && keySecret
      ? new Razorpay({ key_id: keyId, key_secret: keySecret })
      : null;
  }

  private async resolveTenantId(userId: string): Promise<string> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!tenant) throw new NotFoundException('Tenant record not found for this user');
    return tenant.id;
  }

  async getDashboard(userId: string) {
    const now = new Date();
    const cacheKey = `dashboard:tenant:${userId}:${now.getFullYear()}-${now.getMonth() + 1}`;
    return this.cache.wrap(cacheKey, TTL_TENANT_DASHBOARD, () => this._fetchDashboard(userId));
  }

  private async _fetchDashboard(userId: string) {
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

  async getKycDocuments(userId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const docs = await this.prisma.tenantDocument.findMany({
      where: { tenantId: tenant.id },
      orderBy: { createdAt: 'desc' },
    });
    return { success: true, data: docs };
  }

  async uploadKycDocument(userId: string, dto: { type: string; documentNumber: string; fileUrl?: string }) {
    const tenant = await this.prisma.tenant.findUnique({ where: { userId }, select: { id: true } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const doc = await this.prisma.tenantDocument.create({
      data: {
        tenantId: tenant.id,
        type: dto.type as any,
        documentNumber: dto.documentNumber,
        fileUrl: dto.fileUrl,
      },
    });
    return { success: true, data: doc };
  }

  async getAgreements(userId: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { userId }, select: { id: true } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const agreements = await this.prisma.rentalAgreement.findMany({
      where: { tenantId: tenant.id },
      orderBy: { createdAt: 'desc' },
    });
    return { success: true, data: agreements };
  }

  async signAgreement(userId: string, agreementId: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { userId }, select: { id: true } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const agreement = await this.prisma.rentalAgreement.findFirst({
      where: { id: agreementId, tenantId: tenant.id },
    });
    if (!agreement) throw new NotFoundException('Agreement not found');
    if (agreement.signedByTenantAt) throw new BadRequestException('Already signed');

    const bothSigned = !!agreement.signedByOwnerAt;
    const updated = await this.prisma.rentalAgreement.update({
      where: { id: agreementId },
      data: {
        signedByTenantAt: new Date(),
        ...(bothSigned && { status: 'SIGNED' }),
      },
    });
    return { success: true, data: updated };
  }

  async createPaymentOrder(userId: string, dto: { rentCycleId: string; amount: number }) {
    if (!this.razorpay) throw new BadRequestException('Online payment not configured');

    const tenant = await this.prisma.tenant.findUnique({ where: { userId }, select: { id: true, user: { select: { name: true, email: true, phone: true } } } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const cycle = await this.prisma.rentCycle.findFirst({
      where: { id: dto.rentCycleId, tenantId: tenant.id },
    });
    if (!cycle) throw new NotFoundException('Rent cycle not found');

    const order = await this.razorpay.orders.create({
      amount: Math.round(dto.amount * 100), // paise
      currency: 'INR',
      receipt: `rent_${dto.rentCycleId.slice(-8)}`,
      notes: {
        rentCycleId: dto.rentCycleId,
        tenantId: tenant.id,
      },
    });

    return {
      success: true,
      data: {
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        keyId: process.env.RAZORPAY_KEY_ID,
        tenant: tenant.user,
      },
    };
  }

  async verifyAndRecordPayment(
    userId: string,
    dto: {
      rentCycleId: string;
      razorpayOrderId: string;
      razorpayPaymentId: string;
      razorpaySignature: string;
    },
  ) {
    const keySecret = process.env.RAZORPAY_KEY_SECRET ?? '';
    const expectedSignature = crypto
      .createHmac('sha256', keySecret)
      .update(`${dto.razorpayOrderId}|${dto.razorpayPaymentId}`)
      .digest('hex');

    if (expectedSignature !== dto.razorpaySignature) {
      throw new BadRequestException('Payment verification failed — invalid signature');
    }

    const tenant = await this.prisma.tenant.findUnique({ where: { userId }, select: { id: true, propertyId: true } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const cycle = await this.prisma.rentCycle.findFirst({ where: { id: dto.rentCycleId, tenantId: tenant.id } });
    if (!cycle) throw new NotFoundException('Rent cycle not found');

    const payment = await this.prisma.$transaction(async (tx) => {
      const p = await tx.payment.create({
        data: {
          rentCycleId: dto.rentCycleId,
          tenantId: tenant.id,
          propertyId: tenant.propertyId,
          amount: cycle.remainingAmount,
          method: 'ONLINE',
          type: 'RENT',
          referenceNo: dto.razorpayPaymentId,
          recordedBy: userId,
          paidAt: new Date(),
        },
      });

      const totalPaid = Number(cycle.paidAmount) + Number(cycle.remainingAmount);
      const newStatus = totalPaid >= Number(cycle.rentAmount) ? 'PAID' : 'PARTIAL';

      await tx.rentCycle.update({
        where: { id: dto.rentCycleId },
        data: {
          paidAmount: totalPaid,
          remainingAmount: Math.max(0, Number(cycle.rentAmount) - totalPaid),
          status: newStatus,
        },
      });

      return p;
    });

    // Invalidate tenant dashboard + operator dashboards after successful payment
    const now = new Date();
    const monthKey = `${now.getFullYear()}-${now.getMonth() + 1}`;
    void this.cache.del(`dashboard:tenant:${userId}:${monthKey}`).catch(() => undefined);
    void this.cache.delPattern('dashboard:operator:*').catch(() => undefined);
    if (tenant.propertyId) {
      void this.cache.del(`dashboard:property:${tenant.propertyId}:${monthKey}`).catch(() => undefined);
    }

    return { success: true, data: payment };
  }
}
