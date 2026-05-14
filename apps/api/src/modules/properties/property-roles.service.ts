import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';

import type { RequestContext } from '@pg-system/types';

import { PrismaService } from '../../database/prisma.service';

export interface AddRoleDto {
  userId: string;
  role: 'OWNER' | 'OPERATOR' | 'CO_OPERATOR' | 'STAFF';
  sharePercent?: number;
  startDate?: string;
}

@Injectable()
export class PropertyRolesService {
  constructor(private prisma: PrismaService) {}

  async addRole(propertyId: string, dto: AddRoleDto, ctx: RequestContext) {
    await this.assertOwnerAccess(propertyId, ctx);

    const targetUser = await this.prisma.user.findUnique({ where: { id: dto.userId } });
    if (!targetUser) throw new NotFoundException('User not found');

    const existing = await this.prisma.propertyRole.findUnique({
      where: { propertyId_userId_role: { propertyId, userId: dto.userId, role: dto.role } },
    });

    if (existing?.isActive) throw new ConflictException('User already has this role in the property');

    if (existing) {
      return this.prisma.propertyRole.update({
        where: { id: existing.id },
        data: {
          isActive: true,
          sharePercent: dto.sharePercent,
          startDate: dto.startDate ? new Date(dto.startDate) : new Date(),
          endDate: null,
        },
      });
    }

    return this.prisma.propertyRole.create({
      data: {
        propertyId,
        userId: dto.userId,
        role: dto.role,
        sharePercent: dto.sharePercent,
        startDate: dto.startDate ? new Date(dto.startDate) : new Date(),
      },
    });
  }

  async removeRole(propertyId: string, roleId: string, ctx: RequestContext) {
    await this.assertOwnerAccess(propertyId, ctx);

    await this.prisma.propertyRole.update({
      where: { id: roleId },
      data: { isActive: false, endDate: new Date() },
    });
  }

  private async assertOwnerAccess(propertyId: string, ctx: RequestContext) {
    if (ctx.systemRole === 'SUPER_ADMIN') return;
    const role = await this.prisma.propertyRole.findFirst({
      where: { propertyId, userId: ctx.userId, role: { in: ['OWNER', 'OPERATOR'] }, isActive: true },
    });
    if (!role) throw new ForbiddenException('Only owners/operators can manage property roles');
  }
}
