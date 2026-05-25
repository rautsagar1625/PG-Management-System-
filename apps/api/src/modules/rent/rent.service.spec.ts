import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import { Decimal } from '@prisma/client/runtime/library';

import { RentService } from './rent.service';
import { PrismaService } from '../../database/prisma.service';
import { CacheService } from '../../database/cache.service';

// ─── Mock factories ───────────────────────────────────────────────────────────

const makeTenant = (overrides: Record<string, unknown> = {}) => ({
  id: 'tenant-1',
  userId: 'user-1',
  propertyId: 'prop-1',
  status: 'ACTIVE',
  ...overrides,
});

const makeRentCycle = (overrides: Record<string, unknown> = {}) => ({
  id: 'cycle-1',
  tenantId: 'tenant-1',
  propertyId: 'prop-1',
  month: 5,
  year: 2024,
  rentAmount: new Decimal('8000'),
  paidAmount: new Decimal('0'),
  remainingAmount: new Decimal('8000'),
  status: 'PENDING',
  dueDate: new Date('2024-05-07'),
  lateFee: new Decimal('0'),
  ...overrides,
});

const makePayment = (overrides: Record<string, unknown> = {}) => ({
  id: 'payment-1',
  tenantId: 'tenant-1',
  propertyId: 'prop-1',
  rentCycleId: 'cycle-1',
  amount: new Decimal('8000'),
  type: 'RENT',
  method: 'UPI',
  referenceNo: 'UPI-REF-123',
  paidAt: new Date('2024-05-01'),
  recordedBy: 'user-op-1',
  createdAt: new Date(),
  ...overrides,
});

// ─── Mock Prisma ─────────────────────────────────────────────────────────────

const mockPrisma = {
  tenant: { findUnique: jest.fn(), findMany: jest.fn() },
  rentCycle: { findUnique: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn(), findMany: jest.fn(), count: jest.fn() },
  payment: { findFirst: jest.fn(), create: jest.fn(), findMany: jest.fn() },
  receipt: { create: jest.fn() },
  $transaction: jest.fn(),
};

const mockEventEmitter = { emit: jest.fn(), emitAsync: jest.fn().mockResolvedValue([]) };
const mockCache = {
  del: jest.fn().mockResolvedValue(undefined),
  delPattern: jest.fn().mockResolvedValue(undefined),
  wrap: jest.fn(),
  get: jest.fn(),
  set: jest.fn(),
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('RentService', () => {
  let service: RentService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RentService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: EventEmitter2, useValue: mockEventEmitter },
        { provide: CacheService, useValue: mockCache },
      ],
    }).compile();

    service = module.get<RentService>(RentService);
    jest.clearAllMocks();
  });

  // ── generateRentCycles ──────────────────────────────────────────────────────

  describe('generateRentCycles', () => {
    it('returns 0 generated when no active tenants', async () => {
      mockPrisma.tenant.findMany.mockResolvedValueOnce([]);

      const result = await service.generateRentCycles('prop-1', 5, 2024);

      expect(result.generated).toBe(0);
      expect(result.total).toBe(0);
    });

    it('skips tenants without active allocation', async () => {
      mockPrisma.tenant.findMany.mockResolvedValueOnce([
        { ...makeTenant(), allocations: [] }, // no active allocation
      ]);

      const result = await service.generateRentCycles('prop-1', 5, 2024);

      expect(result.total).toBe(0);
      expect(mockPrisma.rentCycle.create).not.toHaveBeenCalled();
    });

    it('skips cycle that already exists (idempotent)', async () => {
      mockPrisma.tenant.findMany.mockResolvedValueOnce([
        {
          ...makeTenant(),
          allocations: [{ id: 'alloc-1', isActive: true, monthlyRent: new Decimal('8000') }],
        },
      ]);
      mockPrisma.rentCycle.findUnique.mockResolvedValueOnce(makeRentCycle()); // already exists

      const result = await service.generateRentCycles('prop-1', 5, 2024);

      expect(result.generated).toBe(0);
      expect(result.total).toBe(1);
      expect(mockPrisma.rentCycle.create).not.toHaveBeenCalled();
    });

    it('creates cycle when it does not exist', async () => {
      const alloc = { id: 'alloc-1', isActive: true, monthlyRent: new Decimal('8000') };
      mockPrisma.tenant.findMany.mockResolvedValueOnce([
        { ...makeTenant(), allocations: [alloc] },
      ]);
      mockPrisma.rentCycle.findUnique.mockResolvedValueOnce(null); // does not exist
      mockPrisma.rentCycle.create.mockResolvedValueOnce(makeRentCycle());

      const result = await service.generateRentCycles('prop-1', 5, 2024);

      expect(result.generated).toBe(1);
      expect(result.total).toBe(1);
      expect(mockPrisma.rentCycle.create).toHaveBeenCalledTimes(1);
    });
  });

  // ── recordPayment ──────────────────────────────────────────────────────────

  describe('recordPayment', () => {
    const validDto = {
      tenantId: 'tenant-1',
      rentCycleId: 'cycle-1',
      amount: 8000,
      type: 'RENT' as const,
      method: 'UPI' as const,
      referenceNo: 'UPI-REF-123',
      paidAt: new Date(Date.now() - 60_000).toISOString(), // 1 minute ago
    };

    it('throws BadRequestException for future payment date', async () => {
      await expect(
        service.recordPayment(
          { ...validDto, paidAt: new Date(Date.now() + 3_600_000).toISOString() },
          'op-user',
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws ConflictException for duplicate reference number', async () => {
      mockPrisma.payment.findFirst.mockResolvedValueOnce(makePayment()); // dup found

      await expect(service.recordPayment(validDto, 'op-user')).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('throws NotFoundException for unknown tenant (inside transaction)', async () => {
      mockPrisma.payment.findFirst.mockResolvedValueOnce(null); // no dup
      mockPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
        const txMock = {
          tenant: { findUnique: jest.fn().mockResolvedValueOnce(null) },
          rentCycle: { findFirst: jest.fn() },
          payment: { create: jest.fn() },
          receipt: { create: jest.fn() },
        };
        return fn(txMock);
      });

      await expect(service.recordPayment(validDto, 'op-user')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('throws BadRequestException for moved-out tenant', async () => {
      mockPrisma.payment.findFirst.mockResolvedValueOnce(null);
      mockPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
        const txMock = {
          tenant: {
            findUnique: jest.fn().mockResolvedValueOnce(makeTenant({ status: 'MOVED_OUT' })),
          },
          rentCycle: { findFirst: jest.fn() },
          payment: { create: jest.fn() },
          receipt: { create: jest.fn() },
        };
        return fn(txMock);
      });

      await expect(service.recordPayment(validDto, 'op-user')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('successfully records a payment and invalidates cache', async () => {
      mockPrisma.payment.findFirst.mockResolvedValueOnce(null); // no dup
      const created = makePayment();
      const cycle = makeRentCycle();

      mockPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
        const txMock = {
          tenant: {
            findUnique: jest.fn().mockResolvedValueOnce(makeTenant()),
          },
          rentCycle: {
            findFirst: jest.fn().mockResolvedValueOnce(cycle),
            findUnique: jest.fn().mockResolvedValueOnce(cycle), // used in RENT type lookup
            update: jest.fn().mockResolvedValueOnce({ ...cycle, status: 'PAID' }),
          },
          payment: {
            create: jest.fn().mockResolvedValueOnce(created),
          },
          receipt: {
            create: jest.fn().mockResolvedValueOnce({ id: 'receipt-1', receiptNo: 'RCP-001' }),
          },
        };
        return fn(txMock);
      });

      const result = await service.recordPayment(validDto, 'op-user');

      expect(result).toBeDefined();
      // Cache invalidation should have been triggered (delPattern for operator dashboards)
      expect(mockCache.delPattern).toHaveBeenCalledWith('dashboard:operator:*');
    });
  });
});
