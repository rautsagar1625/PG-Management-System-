import { SetMetadata } from '@nestjs/common';

import type { PropertyRoleType, SystemRole } from '@pg-system/types';

export const ROLES_KEY = 'roles';
export const PROPERTY_ROLES_KEY = 'propertyRoles';

/** Restrict to specific system roles. */
export const Roles = (...roles: SystemRole[]) => SetMetadata(ROLES_KEY, roles);

/** Restrict to specific property-level roles.
 *  Requires the request to carry a resolved propertyId. */
export const PropertyRoles = (...roles: PropertyRoleType[]) =>
  SetMetadata(PROPERTY_ROLES_KEY, roles);
