import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import type { PaginationQuery, RequestContext } from '@pg-system/types';
import { buildPaginationMeta, buildPrismaSkipTake, generateTenantCode } from '@pg-system/utils';

import { PrismaService } from '../../database/prisma.service';

export interface CreateTenantDto {
  name: string;
  email: string;
  phone: string;
  propertyId: string;
  leadSource?: string;
  depositAmount: number;
}

@Injectable()
export class TenantsService {
  constructor(private prisma: PrismaService) {}

  async findAll(
    ctx: RequestContext,
    query: PaginationQuery & { propertyId?: string; status?: string },
  ) {
    const { page = 1, limit = 20, search, propertyId, status } = query;
    const { skip, take } = buildPrismaSkipTake(page, limit);

    const where: Prisma.TenantWhereInput = {
      ...(propertyId && { propertyId }),
      ...(status && { status: status as Prisma.EnumTenantStatusFilter }),
      ...(search && {
        OR: [
          { user: { name: { contains: search, mode: 'insensitive' } } },
          { user: { phone: { contains: search, mode: 'insensitive' } } },
          { tenantCode: { contains: search, mode: 'insensitive' } },
        ],
      }),
      ...(ctx.systemRole !== 'SUPER_ADMIN' && {
        property: { roles: { some: { userId: ctx.userId } } },
      }),
    };

    const [tenants, total] = await Promise.all([
      this.prisma.tenant.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, name: true, email: true, phone: true } },
          allocations: {
            where: { isActive: true },
            include: {
              bed: { include: { room: { select: { number: true, floor: true } } } },
            },
          },
        },
      }),
      this.prisma.tenant.count({ where }),
    ]);

    return { tenants, meta: buildPaginationMeta(total, page, limit) };
  }

  async findOne(id: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true, email: true, phone: true } },
        allocations: {
          include: {
            bed: { include: { room: { select: { number: true, floor: true } } } },
          },
          orderBy: { startDate: 'desc' },
        },
        emergencyContacts: true,
        documents: true,
        rentCycles: { orderBy: [{ year: 'desc' }, { month: 'desc' }], take: 6 },
        payments: { orderBy: { paidAt: 'desc' }, take: 10 },
        complaints: { where: { status: { notIn: ['CLOSED', 'REJECTED'] } } },
      },
    });

    if (!tenant) throw new NotFoundException('Tenant not found');
    return tenant;
  }

  async create(dto: CreateTenantDto) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    const userId = existingUser
      ? existingUser.id
      : (
          await this.prisma.user.create({
            data: {
              name: dto.name,
              email: dto.email,
              phone: dto.phone,
              passwordHash: '',
            },
          })
        ).id;

    // Generate unique tenant code with retry guard
    let tenantCode = generateTenantCode();
    let attempts = 0;
    while (await this.prisma.tenant.findUnique({ where: { tenantCode } })) {
      tenantCode = generateTenantCode();
      if (++attempts > 10) throw new Error('Failed to generate unique tenant code');
    }

    return this.prisma.tenant.create({
      data: {
        userId,
        propertyId: dto.propertyId,
        tenantCode,
        depositAmount: new Prisma.Decimal(dto.depositAmount),
        leadSource: dto.leadSource,
      },
      include: {
        user: { select: { id: true, name: true, email: true, phone: true } },
      },
    });
  }
}
