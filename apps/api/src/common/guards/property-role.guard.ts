import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import type { PropertyRoleType, RequestContext } from '@pg-system/types';

import { PrismaService } from '../../database/prisma.service';
import { PROPERTY_ROLES_KEY } from '../decorators/roles.decorator';

/**
 * Guards routes that require the caller to have a specific role in the target property.
 * The propertyId must be available as a route param, query param, or request body field.
 */
@Injectable()
export class PropertyRoleGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<PropertyRoleType[]>(PROPERTY_ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user as RequestContext;

    if (!user) throw new ForbiddenException('Authentication required');

    // SUPER_ADMIN bypasses property role checks
    if (user.systemRole === 'SUPER_ADMIN') return true;

    let propertyId =
      request.params?.propertyId ||
      request.query?.propertyId ||
      request.body?.propertyId;

    // If no propertyId is directly provided, but a tenant ID, lead ID, or complaint ID (id) is in params,
    // look up the entity to find the propertyId.
    if (!propertyId && request.params?.id) {
      // 1. Check if it's a tenant ID
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: request.params.id },
        select: { propertyId: true },
      });
      if (tenant) {
        propertyId = tenant.propertyId;
      } else {
        // 2. Check if it's a lead ID
        const lead = await this.prisma.lead.findUnique({
          where: { id: request.params.id },
          select: { propertyId: true },
        });
        if (lead) {
          propertyId = lead.propertyId;
        } else {
          // 3. Check if it's a complaint ID
          const complaint = await this.prisma.complaint.findUnique({
            where: { id: request.params.id },
            select: { propertyId: true },
          });
          if (complaint) {
            propertyId = complaint.propertyId;
          }
        }
      }
    }

    if (!propertyId) return false;

    const role = await this.prisma.propertyRole.findFirst({
      where: {
        propertyId,
        userId: user.userId,
        role: { in: requiredRoles },
      },
    });

    return !!role;
  }
}
