import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { randomBytes, randomUUID } from 'crypto';

import type { AuthResponse, AuthTokenPayload, AuthTokens, UserProfile } from '@pg-system/types';

import { PrismaService } from '../../database/prisma.service';
import { EmailService } from '../email/email.service';
import type { ForgotPasswordDto, LoginDto, RegisterDto, ResetPasswordDto } from './dto/auth.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
    private email: EmailService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResponse> {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException('Email already registered');

    if (dto.phone) {
      const phoneExists = await this.prisma.user.findUnique({ where: { phone: dto.phone } });
      if (phoneExists) throw new ConflictException('Phone number already registered');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        name: dto.name,
        phone: dto.phone,
        passwordHash,
      },
    });

    const tokens = await this.generateTokens(user.id, user.email, user.systemRole);
    // New login = new token family
    await this.saveRefreshToken(user.id, tokens.refreshToken, randomUUID());

    return {
      user: this.toUserProfile(user),
      tokens,
    };
  }

  async login(dto: LoginDto): Promise<AuthResponse> {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user || !user.isActive) throw new UnauthorizedException('Invalid credentials');

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const tokens = await this.generateTokens(user.id, user.email, user.systemRole);
    // New login = new token family
    await this.saveRefreshToken(user.id, tokens.refreshToken, randomUUID());

    return { user: this.toUserProfile(user), tokens };
  }

  async refresh(refreshToken: string): Promise<AuthTokens> {
    const stored = await this.prisma.session.findUnique({
      where: { token: refreshToken },
      include: { user: true },
    });

    // RB-005: Token reuse detection.
    // A valid (non-expired) session that is already revoked signals that a previously
    // issued token was replayed — the most likely cause is token theft.
    // When detected, revoke the ENTIRE token family to force re-authentication
    // for both the legitimate user and the attacker.
    if (stored && stored.revokedAt && stored.expiresAt > new Date()) {
      await this.prisma.session.updateMany({
        where: { familyId: stored.familyId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException(
        'Refresh token reuse detected — all sessions in this family have been revoked. Please log in again.',
      );
    }

    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    // Rotate: revoke the used token and issue a new one in the same family
    await this.prisma.session.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    const tokens = await this.generateTokens(
      stored.user.id,
      stored.user.email,
      stored.user.systemRole,
    );
    // Inherit the family so reuse detection works across multiple rotations
    await this.saveRefreshToken(stored.user.id, tokens.refreshToken, stored.familyId);

    return tokens;
  }

  async logout(refreshToken: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: { token: refreshToken },
      data: { revokedAt: new Date() },
    });
  }

  async forgotPassword(dto: ForgotPasswordDto): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    // Always return success to avoid user enumeration
    if (!user || !user.isActive) return;

    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    const resetRecord = await this.prisma.passwordReset.create({
      data: { userId: user.id, token, expiresAt },
    });

    // NS-004: track email delivery — if SMTP is down, we record the failure so
    // support staff can detect it and resend manually or check SMTP health.
    // We never throw to the caller (always return void — avoids user enumeration).
    try {
      await this.email.sendPasswordReset(user.email, user.name, token);
      await this.prisma.passwordReset.update({
        where: { id: resetRecord.id },
        data: { emailSentAt: new Date() },
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message.slice(0, 500) : String(err).slice(0, 500);
      await this.prisma.passwordReset.update({
        where: { id: resetRecord.id },
        data: { emailFailedAt: new Date(), emailError: msg },
      }).catch(() => undefined); // don't let audit write block the response
    }
  }

  async resetPassword(dto: ResetPasswordDto): Promise<void> {
    const record = await this.prisma.passwordReset.findUnique({ where: { token: dto.token } });
    if (!record || record.usedAt || record.expiresAt < new Date()) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);

    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
      this.prisma.passwordReset.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
      // Revoke all active sessions so old sessions are invalidated
      this.prisma.session.updateMany({
        where: { userId: record.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
  }

  private async generateTokens(
    userId: string,
    email: string,
    systemRole: string,
  ): Promise<AuthTokens> {
    const payload: Omit<AuthTokenPayload, 'iat' | 'exp'> = {
      sub: userId,
      email,
      systemRole: systemRole as AuthTokenPayload['systemRole'],
    };

    const accessToken = this.jwt.sign(payload);
    const refreshToken = this.jwt.sign(payload, {
      secret: this.config.get<string>('JWT_REFRESH_SECRET'),
      expiresIn: this.config.get<string>('JWT_REFRESH_EXPIRES_IN', '7d'),
    });

    const expiresIn = 15 * 60; // 15 minutes in seconds
    return { accessToken, refreshToken, expiresIn };
  }

  private async saveRefreshToken(userId: string, token: string, familyId: string): Promise<void> {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await this.prisma.session.create({ data: { userId, token, familyId, expiresAt } });
  }

  private toUserProfile(user: {
    id: string;
    email: string;
    phone: string | null;
    name: string;
    systemRole: string;
    isVerified: boolean;
    createdAt: Date;
  }): UserProfile {
    return {
      id: user.id,
      email: user.email,
      phone: user.phone ?? undefined,
      name: user.name,
      systemRole: user.systemRole as UserProfile['systemRole'],
      isVerified: user.isVerified,
      createdAt: user.createdAt.toISOString(),
    };
  }
}
