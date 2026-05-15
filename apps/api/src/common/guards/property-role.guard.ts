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

    const propertyId =
      request.params?.propertyId ||
      request.query?.propertyId ||
      request.body?.propertyId;

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
