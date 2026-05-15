import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import type { RequestContext, SystemRole } from '@pg-system/types';

import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class SystemRoleGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<SystemRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user as RequestContext | undefined;

    if (!user) return false;

    return requiredRoles.includes(user.systemRole);
  }
}
