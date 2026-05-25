import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcryptjs';

import { AuthService } from './auth.service';
import { EmailService } from '../email/email.service';
import { PrismaService } from '../../database/prisma.service';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const makeUser = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: 'user-1',
  email: 'test@example.com',
  name: 'Test User',
  phone: null,
  passwordHash: bcrypt.hashSync('SecurePass@123', 1), // cost-1 for speed
  systemRole: 'TENANT',
  isActive: true,
  lastLoginAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  session: {
    findUnique: jest.fn(),
    create: jest.fn(),
    updateMany: jest.fn(),
    update: jest.fn(),
  },
  passwordReset: {
    create: jest.fn(),
    update: jest.fn(),
    findFirst: jest.fn(),
    updateMany: jest.fn(),
  },
};

const mockJwt = {
  sign: jest.fn().mockReturnValue('signed-token'),
  signAsync: jest.fn().mockResolvedValue('signed-token'),
  verify: jest.fn(),
  verifyAsync: jest.fn(),
};

const mockConfig = {
  get: jest.fn((key: string, fallback?: unknown) => {
    const map: Record<string, unknown> = {
      JWT_EXPIRES_IN: '15m',
      JWT_REFRESH_EXPIRES_IN: '7d',
    };
    return map[key] ?? fallback;
  }),
};

const mockEmail = {
  sendPasswordReset: jest.fn().mockResolvedValue(undefined),
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: JwtService, useValue: mockJwt },
        { provide: ConfigService, useValue: mockConfig },
        { provide: EmailService, useValue: mockEmail },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jest.clearAllMocks();
  });

  // ── register ──────────────────────────────────────────────────────────────

  describe('register', () => {
    it('throws ConflictException if email already exists', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(makeUser());

      await expect(
        service.register({ name: 'T', email: 'test@example.com', password: 'SecurePass@123' }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('creates user and returns tokens on success', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(null); // email check
      const created = makeUser();
      mockPrisma.user.create.mockResolvedValueOnce(created);
      mockPrisma.session.create.mockResolvedValueOnce({ id: 's1' });

      const result = await service.register({
        name: 'Test User',
        email: 'new@example.com',
        password: 'SecurePass@123',
      });

      expect(result).toHaveProperty('tokens');
      expect(result).toHaveProperty('user');
      expect(mockPrisma.user.create).toHaveBeenCalledTimes(1);
    });
  });

  // ── login ────────────────────────────────────────────────────────────────

  describe('login', () => {
    it('throws UnauthorizedException for unknown email', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(null);

      await expect(
        service.login({ email: 'nobody@example.com', password: 'any' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('throws UnauthorizedException for wrong password', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(makeUser());

      await expect(
        service.login({ email: 'test@example.com', password: 'WrongPass@1' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('throws UnauthorizedException for inactive user', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(makeUser({ isActive: false }));

      await expect(
        service.login({ email: 'test@example.com', password: 'SecurePass@123' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('returns tokens on valid credentials', async () => {
      const user = makeUser();
      mockPrisma.user.findUnique.mockResolvedValueOnce(user);
      mockPrisma.user.update.mockResolvedValueOnce(user);
      mockPrisma.session.create.mockResolvedValueOnce({ id: 's1' });

      const result = await service.login({ email: 'test@example.com', password: 'SecurePass@123' });

      expect(result).toHaveProperty('tokens');
      expect(result.user.email).toBe('test@example.com');
    });
  });

  // ── refresh ──────────────────────────────────────────────────────────────

  describe('refresh', () => {
    it('throws UnauthorizedException for revoked session', async () => {
      mockPrisma.session.findUnique.mockResolvedValueOnce({
        token: 'old-token',
        revokedAt: new Date(),
        expiresAt: new Date(Date.now() + 10_000),
        user: makeUser(),
      });

      await expect(service.refresh('old-token')).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('throws UnauthorizedException for expired session', async () => {
      mockPrisma.session.findUnique.mockResolvedValueOnce({
        token: 'exp-token',
        revokedAt: null,
        expiresAt: new Date(Date.now() - 1_000), // already expired
        user: makeUser(),
      });

      await expect(service.refresh('exp-token')).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('returns new tokens for a valid session', async () => {
      const user = makeUser();
      mockPrisma.session.findUnique.mockResolvedValueOnce({
        id: 's1',
        token: 'valid-token',
        familyId: 'family-abc',
        revokedAt: null,
        expiresAt: new Date(Date.now() + 3_600_000),
        user,
      });
      mockPrisma.session.update.mockResolvedValueOnce({});
      mockPrisma.session.create.mockResolvedValueOnce({ id: 's2' });

      const result = await service.refresh('valid-token');
      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
    });

    // ── Token family tracking (RB-005) ─────────────────────────────────────

    it('RB-005: replay attack — revokes entire token family and throws', async () => {
      // Scenario: an attacker replays an already-used (revoked) refresh token
      // that has not yet expired. This is the theft signal.
      mockPrisma.session.findUnique.mockResolvedValueOnce({
        id: 's1',
        token: 'stolen-token',
        familyId: 'family-xyz',
        revokedAt: new Date(Date.now() - 5_000), // already revoked (used)
        expiresAt: new Date(Date.now() + 3_600_000), // but not expired yet
        user: makeUser(),
      });
      mockPrisma.session.updateMany.mockResolvedValueOnce({ count: 3 });

      await expect(service.refresh('stolen-token')).rejects.toBeInstanceOf(UnauthorizedException);

      // Must revoke ALL active sessions in the same family
      expect(mockPrisma.session.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ familyId: 'family-xyz', revokedAt: null }),
          data: expect.objectContaining({ revokedAt: expect.any(Date) }),
        }),
      );
    });

    it('RB-005: normal rotation — new session inherits the familyId', async () => {
      const user = makeUser();
      const familyId = 'family-rotate-test';

      mockPrisma.session.findUnique.mockResolvedValueOnce({
        id: 's1',
        token: 'rotate-token',
        familyId,
        revokedAt: null,
        expiresAt: new Date(Date.now() + 3_600_000),
        user,
      });
      mockPrisma.session.update.mockResolvedValueOnce({});
      mockPrisma.session.create.mockResolvedValueOnce({ id: 's2' });

      await service.refresh('rotate-token');

      // New session must carry the same familyId, not generate a fresh one
      expect(mockPrisma.session.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ familyId }),
        }),
      );
    });

    it('RB-005: expired revoked token — throws generic error (not family revocation)', async () => {
      // Expired + revoked = stale token, not a replay signal (attacker cannot use it)
      mockPrisma.session.findUnique.mockResolvedValueOnce({
        id: 's1',
        token: 'expired-token',
        familyId: 'family-old',
        revokedAt: new Date(Date.now() - 10_000),
        expiresAt: new Date(Date.now() - 5_000), // also expired
        user: makeUser(),
      });

      await expect(service.refresh('expired-token')).rejects.toBeInstanceOf(UnauthorizedException);

      // Should NOT call updateMany — this is not a theft signal
      expect(mockPrisma.session.updateMany).not.toHaveBeenCalled();
    });
  });
});
