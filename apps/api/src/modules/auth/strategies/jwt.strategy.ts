import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

import type { AuthTokenPayload, RequestContext } from '@pg-system/types';

import { PrismaService } from '../../../database/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: (() => {
        const secret = config.get<string>('JWT_SECRET');
        if (!secret) throw new Error('JWT_SECRET environment variable is not set');
        return secret;
      })(),
    });
  }

  async validate(payload: AuthTokenPayload): Promise<RequestContext> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub, isActive: true },
      select: { id: true, systemRole: true },
    });

    if (!user) throw new UnauthorizedException('User not found or deactivated');

    return {
      userId: user.id,
      systemRole: user.systemRole as RequestContext['systemRole'],
    };
  }
}
