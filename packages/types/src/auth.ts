import type { ID } from './common';

export type SystemRole = 'SUPER_ADMIN' | 'USER';

export type PropertyRoleType = 'OWNER' | 'OPERATOR' | 'CO_OPERATOR' | 'STAFF';

export type TenantRole = 'TENANT';

export type AnyRole = SystemRole | PropertyRoleType | TenantRole;

export interface UserProfile {
  id: ID;
  email: string;
  phone?: string;
  name: string;
  systemRole: SystemRole;
  isVerified: boolean;
  createdAt: string;
}

export interface AuthTokenPayload {
  sub: ID;
  email: string;
  systemRole: SystemRole;
  iat: number;
  exp: number;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  name: string;
  email: string;
  phone?: string;
  password: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface AuthResponse {
  user: UserProfile;
  tokens: AuthTokens;
}

/**
 * The effective context of a request:
 * what user is acting, and in what property+role context.
 */
export interface RequestContext {
  userId: ID;
  systemRole: SystemRole;
  propertyId?: ID;
  propertyRole?: PropertyRoleType;
}
