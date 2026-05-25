import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PropertyRoleType } from '@prisma/client';

import type { RequestContext } from '@pg-system/types';

import { PrismaService } from '../../database/prisma.service';

export interface AddRoleDto {
  userId: string;
  role: PropertyRoleType;
}

@Injectable()
export class PropertyRolesService {
  constructor(private prisma: PrismaService) {}

  async addRole(propertyId: string, dto: AddRoleDto, ctx: RequestContext) {
    await this.assertOwnerAccess(propertyId, ctx);

    const targetUser = await this.prisma.user.findUnique({ where: { id: dto.userId } });
    if (!targetUser) throw new NotFoundException('User not found');

    // One role per user per property — upsert replaces the existing role
    const existing = await this.prisma.propertyRole.findUnique({
      where: { propertyId_userId: { propertyId, userId: dto.userId } },
    });

    if (existing?.role === dto.role) {
      throw new ConflictException(`User already has the ${dto.role} role in this property`);
    }

    if (existing) {
      return this.prisma.propertyRole.update({
        where: { id: existing.id },
        data: { role: dto.role },
      });
    }

    return this.prisma.propertyRole.create({
      data: { propertyId, userId: dto.userId, role: dto.role, addedBy: ctx.userId },
    });
  }

  async listRoles(propertyId: string, ctx: RequestContext) {
    // Verify caller has access to the property
    if (ctx.systemRole !== 'SUPER_ADMIN') {
      const access = await this.prisma.propertyRole.findFirst({
        where: { propertyId, userId: ctx.userId },
      });
      if (!access) throw new ForbiddenException('Access denied to this property');
    }

    const roles = await this.prisma.propertyRole.findMany({
      where: { propertyId },
      include: {
        user: { select: { id: true, name: true, email: true, phone: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    return { success: true, data: roles };
  }

  async findUserByEmail(email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true, name: true, email: true, phone: true },
    });
    if (!user) throw new NotFoundException('No user found with that email address');
    return { success: true, data: user };
  }

  async removeRole(propertyId: string, roleId: string, ctx: RequestContext) {
    await this.assertOwnerAccess(propertyId, ctx);

    const existing = await this.prisma.propertyRole.findFirst({
      where: { id: roleId, propertyId },
    });
    if (!existing) throw new NotFoundException('Role assignment not found');

    await this.prisma.propertyRole.delete({ where: { id: roleId } });
  }

  private async assertOwnerAccess(propertyId: string, ctx: RequestContext) {
    if (ctx.systemRole === 'SUPER_ADMIN') return;
    const role = await this.prisma.propertyRole.findFirst({
      where: { propertyId, userId: ctx.userId, role: { in: ['OWNER', 'OPERATOR'] } },
    });
    if (!role) throw new ForbiddenException('Only owners/operators can manage property roles');
  }
}
