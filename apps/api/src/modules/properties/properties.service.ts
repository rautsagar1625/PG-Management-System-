import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import type { PaginationQuery, RequestContext } from '@pg-system/types';
import { buildPaginationMeta, buildPrismaSkipTake } from '@pg-system/utils';

import { PrismaService } from '../../database/prisma.service';
import type { CreatePropertyDto, UpdatePropertyDto } from './dto/property.dto';

@Injectable()
export class PropertiesService {
  constructor(private prisma: PrismaService) {}

  async findAll(ctx: RequestContext, query: PaginationQuery) {
    const { page = 1, limit = 20, search } = query;
    const { skip, take } = buildPrismaSkipTake(page, limit);

    const where: Prisma.PropertyWhereInput = {
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { city: { contains: search, mode: 'insensitive' } },
        ],
      }),
      ...(ctx.systemRole !== 'SUPER_ADMIN' && {
        roles: { some: { userId: ctx.userId, isActive: true } },
      }),
    };

    const [properties, total] = await Promise.all([
      this.prisma.property.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          roles: { where: { isActive: true }, include: { user: { select: { id: true, name: true } } } },
          _count: { select: { rooms: true, tenants: { where: { status: 'ACTIVE' } } } },
        },
      }),
      this.prisma.property.count({ where }),
    ]);

    return {
      success: true,
      data: properties,
      meta: buildPaginationMeta(total, page, limit),
    };
  }

  async findOne(id: string, ctx: RequestContext) {
    const property = await this.prisma.property.findUnique({
      where: { id },
      include: {
        roles: {
          where: { isActive: true },
          include: { user: { select: { id: true, name: true, email: true, phone: true } } },
        },
        financialModels: { where: { isActive: true }, orderBy: { effectiveFrom: 'desc' } },
        _count: {
          select: {
            rooms: true,
            tenants: { where: { status: 'ACTIVE' } },
            complaints: { where: { status: { notIn: ['CLOSED', 'REJECTED'] } } },
          },
        },
      },
    });

    if (!property) throw new NotFoundException('Property not found');
    this.assertPropertyAccess(property.roles, ctx);

    return { success: true, data: property };
  }

  async create(dto: CreatePropertyDto, ctx: RequestContext) {
    const property = await this.prisma.$transaction(async (tx) => {
      const prop = await tx.property.create({
        data: {
          name: dto.name,
          addrLine1: dto.address.line1,
          addrLine2: dto.address.line2,
          city: dto.address.city,
          state: dto.address.state,
          pincode: dto.address.pincode,
          type: dto.type,
          amenities: dto.amenities ?? [],
          rules: dto.rules ?? [],
        },
      });

      // Auto-assign creator as OPERATOR
      await tx.propertyRole.create({
        data: { propertyId: prop.id, userId: ctx.userId, role: 'OPERATOR' },
      });

      return prop;
    });

    return { success: true, data: property };
  }

  async update(id: string, dto: UpdatePropertyDto, ctx: RequestContext) {
    await this.assertOperatorOrOwnerAccess(id, ctx);

    const property = await this.prisma.property.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.address && {
          addrLine1: dto.address.line1,
          addrLine2: dto.address.line2,
          city: dto.address.city,
          state: dto.address.state,
          pincode: dto.address.pincode,
        }),
        ...(dto.type && { type: dto.type }),
        ...(dto.amenities && { amenities: dto.amenities }),
        ...(dto.rules && { rules: dto.rules }),
      },
    });

    return { success: true, data: property };
  }

  private assertPropertyAccess(
    roles: Array<{ userId: string }>,
    ctx: RequestContext,
  ) {
    if (ctx.systemRole === 'SUPER_ADMIN') return;
    const hasAccess = roles.some((r) => r.userId === ctx.userId);
    if (!hasAccess) throw new ForbiddenException('Access denied to this property');
  }

  private async assertOperatorOrOwnerAccess(propertyId: string, ctx: RequestContext) {
    if (ctx.systemRole === 'SUPER_ADMIN') return;
    const role = await this.prisma.propertyRole.findFirst({
      where: {
        propertyId,
        userId: ctx.userId,
        role: { in: ['OWNER', 'OPERATOR', 'CO_OPERATOR'] },
        isActive: true,
      },
    });
    if (!role) throw new ForbiddenException('Insufficient property role');
  }
}
