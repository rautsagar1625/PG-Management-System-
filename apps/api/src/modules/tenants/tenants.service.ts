import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, TenantStatus } from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { IsEmail, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { Type } from 'class-transformer';

import type { PaginationQuery, RequestContext } from '@pg-system/types';
import { buildPaginationMeta, buildPrismaSkipTake, generateTenantCode } from '@pg-system/utils';

import { PrismaService } from '../../database/prisma.service';

export class CreateTenantDto {
  @IsString()
  name: string;

  @IsEmail()
  email: string;

  @IsString()
  phone: string;

  @IsUUID()
  propertyId: string;

  @IsString()
  @IsOptional()
  leadSource?: string;

  @IsNumber()
  @Min(0)
  @Type(() => Number)
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

    const validStatuses = Object.values(TenantStatus) as string[];
    if (status && !validStatuses.includes(status)) {
      throw new BadRequestException(`Invalid status: ${status}`);
    }

    const where: Prisma.TenantWhereInput = {
      ...(propertyId && { propertyId }),
      ...(status && { status: status as TenantStatus }),
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

    return { success: true, data: tenants, meta: buildPaginationMeta(total, page, limit) };
  }

  async findOne(id: string, ctx: RequestContext) {
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

    if (ctx.systemRole !== 'SUPER_ADMIN') {
      const role = await this.prisma.propertyRole.findUnique({
        where: { propertyId_userId: { propertyId: tenant.propertyId, userId: ctx.userId } },
        select: { id: true },
      });
      if (!role) throw new ForbiddenException('Access denied to this tenant');
    }

    return tenant;
  }

  async create(dto: CreateTenantDto) {
    // Handle concurrent requests for the same email: findUnique + create + P2002 catch
    let user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user) {
      try {
        user = await this.prisma.user.create({
          data: { name: dto.name, email: dto.email, phone: dto.phone, passwordHash: '' },
        });
      } catch (e: unknown) {
        if (e instanceof PrismaClientKnownRequestError && e.code === 'P2002') {
          // Another concurrent request created this user — re-fetch
          user = await this.prisma.user.findUnique({ where: { email: dto.email } });
          if (!user) throw e;
        } else {
          throw e;
        }
      }
    }

    // Unique constraint on tenantCode is the final safety net; retry up to 5 times
    for (let attempt = 0; attempt < 5; attempt++) {
      const tenantCode = generateTenantCode();
      try {
        return await this.prisma.tenant.create({
          data: {
            userId: user.id,
            propertyId: dto.propertyId,
            tenantCode,
            depositAmount: new Prisma.Decimal(dto.depositAmount),
            leadSource: dto.leadSource,
          },
          include: {
            user: { select: { id: true, name: true, email: true, phone: true } },
          },
        });
      } catch (e: unknown) {
        const isCodeConflict =
          e instanceof PrismaClientKnownRequestError &&
          e.code === 'P2002' &&
          (e.meta?.target as string[] | undefined)?.includes('tenantCode');
        if (isCodeConflict && attempt < 4) continue;
        throw e;
      }
    }

    throw new Error('Failed to generate a unique tenant code after 5 attempts');
  }
}
