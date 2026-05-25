import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Prisma, SettlementStatus } from '@prisma/client';

import { SettlementsService } from './settlements.service';
import { PrismaService } from '../../database/prisma.service';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const makeProperty = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: 'prop-1',
  name: 'Test PG',
  ...overrides,
});

const makeFinancialModel = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: 'fm-1',
  propertyId: 'prop-1',
  type: 'FIXED_PAYOUT',
  fixedOwnerPayout: new Prisma.Decimal(30000),
  ownerSharePercent: null,
  operatorSharePercent: null,
  isActive: true,
  effectiveFrom: new Date('2025-01-01'),
  effectiveTo: null,
  createdBy: 'owner-1',
  ...overrides,
});

const makeSettlement = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: 'settle-1',
  propertyId: 'prop-1',
  financialModelId: 'fm-1',
  month: 4,
  year: 2026,
  totalCollected: new Prisma.Decimal(80000),
  ownerPayout: new Prisma.Decimal(30000),
  operatorProfit: new Prisma.Decimal(50000),
  status: SettlementStatus.CALCULATED,
  settledAt: null,
  settledBy: null,
  notes: null,
  ...overrides,
});

// ─── Mock Prisma ─────────────────────────────────────────────────────────────

const mockPrisma = {
  property: { findUnique: jest.fn() },
  financialModel: { findFirst: jest.fn() },
  payment: { aggregate: jest.fn() },
  rentCycle: { groupBy: jest.fn() },
  settlement: {
    findUnique: jest.fn(),
    upsert: jest.fn(),
    update: jest.fn(),
    findMany: jest.fn(),
  },
  $transaction: jest.fn(async (fn: (tx: typeof mockPrisma) => unknown) => fn(mockPrisma)),
};

// ─── Suite ────────────────────────────────────────────────────────────────────

describe('SettlementsService', () => {
  let service: SettlementsService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SettlementsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get(SettlementsService);
  });

  // ── calculateSettlement ─────────────────────────────────────────────────────

  describe('calculateSettlement', () => {
    const totalCollected = 80000;

    beforeEach(() => {
      mockPrisma.property.findUnique.mockResolvedValue(makeProperty());
      mockPrisma.payment.aggregate.mockResolvedValue({ _sum: { amount: new Prisma.Decimal(totalCollected) } });
      mockPrisma.rentCycle.groupBy.mockResolvedValue([]);
      mockPrisma.settlement.findUnique.mockResolvedValue(null); // no existing
      mockPrisma.settlement.upsert.mockImplementation(({ create }: { create: unknown }) =>
        Promise.resolve(create),
      );
    });

    it('FIXED_PAYOUT: ownerPayout = fixedOwnerPayout, operatorProfit = total - fixed', async () => {
      mockPrisma.financialModel.findFirst.mockResolvedValue(
        makeFinancialModel({ type: 'FIXED_PAYOUT', fixedOwnerPayout: new Prisma.Decimal(30000) }),
      );

      const result = await service.calculateSettlement('prop-1', 4, 2026, 'op-1');

      expect(result.data).toMatchObject({
        ownerPayout: new Prisma.Decimal(30000),
        operatorProfit: new Prisma.Decimal(50000), // 80000 - 30000
        totalCollected: new Prisma.Decimal(80000),
      });
    });

    it('REVENUE_SHARE: splits total by owner/operator percentages', async () => {
      mockPrisma.financialModel.findFirst.mockResolvedValue(
        makeFinancialModel({
          type: 'REVENUE_SHARE',
          fixedOwnerPayout: null,
          ownerSharePercent: new Prisma.Decimal(60),
          operatorSharePercent: new Prisma.Decimal(40),
        }),
      );

      const result = await service.calculateSettlement('prop-1', 4, 2026, 'op-1');

      expect(result.data).toMatchObject({
        ownerPayout: new Prisma.Decimal(48000),    // 80000 × 60%
        operatorProfit: new Prisma.Decimal(32000), // 80000 × 40%
        totalCollected: new Prisma.Decimal(80000),
      });
    });

    it('OWNER_OPERATED: ownerPayout = totalCollected, operatorProfit = 0', async () => {
      mockPrisma.financialModel.findFirst.mockResolvedValue(
        makeFinancialModel({
          type: 'OWNER_OPERATED',
          fixedOwnerPayout: null,
          ownerSharePercent: null,
          operatorSharePercent: null,
        }),
      );

      const result = await service.calculateSettlement('prop-1', 4, 2026, 'op-1');

      expect(result.data).toMatchObject({
        ownerPayout: new Prisma.Decimal(80000),
        operatorProfit: new Prisma.Decimal(0),
      });
    });

    it('throws NotFoundException when property does not exist', async () => {
      mockPrisma.property.findUnique.mockResolvedValue(null);

      await expect(service.calculateSettlement('ghost', 4, 2026, 'op-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws BadRequestException when no financial model covers the period', async () => {
      mockPrisma.financialModel.findFirst.mockResolvedValue(null);

      await expect(service.calculateSettlement('prop-1', 4, 2026, 'op-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequestException when recalculating a PAID settlement', async () => {
      mockPrisma.financialModel.findFirst.mockResolvedValue(makeFinancialModel());
      mockPrisma.settlement.findUnique.mockResolvedValue(
        makeSettlement({ status: SettlementStatus.PAID }),
      );

      await expect(service.calculateSettlement('prop-1', 4, 2026, 'op-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('uses the financial model active at period start, not today (BM-001)', async () => {
      // Verify the query uses effectiveFrom <= periodStart, not isActive = true
      mockPrisma.financialModel.findFirst.mockResolvedValue(makeFinancialModel());
      await service.calculateSettlement('prop-1', 4, 2026, 'op-1');

      expect(mockPrisma.financialModel.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            propertyId: 'prop-1',
            effectiveFrom: expect.objectContaining({ lte: expect.any(Date) }),
          }),
        }),
      );
    });
  });

  // ── markSettlementPaid ──────────────────────────────────────────────────────

  describe('markSettlementPaid', () => {
    it('marks a CALCULATED settlement as PAID', async () => {
      const settlement = makeSettlement({ status: SettlementStatus.CALCULATED });
      mockPrisma.settlement.findUnique.mockResolvedValue(settlement);
      mockPrisma.settlement.update.mockResolvedValue({ ...settlement, status: SettlementStatus.PAID });

      const result = await service.markSettlementPaid('settle-1', 'owner-1', 'prop-1');

      expect(result.data).toMatchObject({ status: SettlementStatus.PAID });
      expect(mockPrisma.settlement.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: SettlementStatus.PAID }),
        }),
      );
    });

    it('throws ForbiddenException when propertyId does not match (cross-property guard)', async () => {
      mockPrisma.settlement.findUnique.mockResolvedValue(
        makeSettlement({ propertyId: 'prop-1' }),
      );

      // Operator on prop-2 tries to mark prop-1's settlement as paid
      await expect(
        service.markSettlementPaid('settle-1', 'op-user', 'prop-2'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws BadRequestException when settlement is already PAID', async () => {
      mockPrisma.settlement.findUnique.mockResolvedValue(
        makeSettlement({ status: SettlementStatus.PAID }),
      );

      await expect(
        service.markSettlementPaid('settle-1', 'owner-1', 'prop-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException when settlement does not exist', async () => {
      mockPrisma.settlement.findUnique.mockResolvedValue(null);

      await expect(
        service.markSettlementPaid('ghost', 'owner-1', 'prop-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── getSettlement ───────────────────────────────────────────────────────────

  describe('getSettlement', () => {
    it('returns settlement when propertyId matches', async () => {
      const settlement = makeSettlement();
      mockPrisma.settlement.findUnique.mockResolvedValue({
        ...settlement,
        financialModel: makeFinancialModel(),
        property: { id: 'prop-1', name: 'Test PG', city: 'Bengaluru' },
      });

      const result = await service.getSettlement('settle-1', 'prop-1');
      expect(result.success).toBe(true);
    });

    it('throws ForbiddenException when propertyId does not match (cross-property read guard)', async () => {
      mockPrisma.settlement.findUnique.mockResolvedValue(makeSettlement({ propertyId: 'prop-1' }));

      await expect(service.getSettlement('settle-1', 'prop-99')).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException when settlement does not exist', async () => {
      mockPrisma.settlement.findUnique.mockResolvedValue(null);

      await expect(service.getSettlement('ghost', 'prop-1')).rejects.toThrow(NotFoundException);
    });
  });
});
