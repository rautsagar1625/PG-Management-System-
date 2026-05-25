import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import { Test, TestingModule } from '@nestjs/testing';
import { BedStatus, TenantStatus } from '@prisma/client';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { TenantWorkflowService } from './tenant-workflow.service';
import { AllocationService } from '../allocation/allocation.service';
import { PrismaService } from '../../database/prisma.service';
import { CacheService } from '../../database/cache.service';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const makeTenant = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: 'tenant-1',
  userId: 'user-1',
  propertyId: 'prop-1',
  tenantCode: 'PG-00001',
  status: TenantStatus.LEAD,
  kycStatus: 'PENDING',
  depositAmount: 10000,
  depositBalance: 0,
  depositStatus: 'PENDING',
  depositCompleted: false,
  kycCompleted: false,
  agreementSigned: false,
  moveInDate: null,
  moveOutDate: null,
  noticeDate: null,
  archivedAt: null,
  anonymisedAt: null,
  notes: null,
  user: { id: 'user-1' },
  ...overrides,
});

const mockPrisma = {
  tenant: {
    findUnique: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  tenantDocument: { updateMany: jest.fn() },
  emergencyContact: { updateMany: jest.fn() },
  user: { update: jest.fn() },
  bed: { findUnique: jest.fn(), update: jest.fn() },
  tenantAllocation: {
    findFirst: jest.fn(),
    update: jest.fn(),
  },
  rentCycle: {
    findMany: jest.fn(),
    aggregate: jest.fn(),
  },
  payment: { findMany: jest.fn() },
  receipt: { create: jest.fn() },
  $transaction: jest.fn(async (fn: (tx: typeof mockPrisma) => unknown) => fn(mockPrisma)),
};

const mockAllocation = {
  closeAllocation: jest.fn().mockResolvedValue(undefined),
};

const mockEventEmitter = {
  emit: jest.fn(),
};

const mockCache = {
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  delPattern: jest.fn(),
};

// ─── Suite ────────────────────────────────────────────────────────────────────

describe('TenantWorkflowService', () => {
  let service: TenantWorkflowService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TenantWorkflowService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AllocationService, useValue: mockAllocation },
        { provide: EventEmitter2, useValue: mockEventEmitter },
        { provide: CacheService, useValue: mockCache },
      ],
    }).compile();

    service = module.get(TenantWorkflowService);
  });

  // ── Status transition guard ─────────────────────────────────────────────────

  describe('assertValidTransition (via scheduleVisit)', () => {
    it('allows LEAD → VISIT_SCHEDULED', async () => {
      const tenant = makeTenant({ status: TenantStatus.LEAD });
      mockPrisma.tenant.findUnique.mockResolvedValue(tenant);
      mockPrisma.tenant.update.mockResolvedValue({ ...tenant, status: TenantStatus.VISIT_SCHEDULED });

      await expect(service.scheduleVisit('tenant-1', '2026-06-01')).resolves.not.toThrow();
    });

    it('throws BadRequestException for invalid transition (ACTIVE → VISIT_SCHEDULED)', async () => {
      const tenant = makeTenant({ status: TenantStatus.ACTIVE });
      mockPrisma.tenant.findUnique.mockResolvedValue(tenant);

      await expect(service.scheduleVisit('tenant-1', '2026-06-01')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws NotFoundException when tenant does not exist', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue(null);

      await expect(service.scheduleVisit('no-such-id', '2026-06-01')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ── finalizeRoom ────────────────────────────────────────────────────────────

  describe('finalizeRoom', () => {
    const tenant = makeTenant({ status: TenantStatus.VISITED });
    const bed = {
      id: 'bed-1',
      status: BedStatus.AVAILABLE,
      room: { propertyId: 'prop-1' },
    };

    it('reserves bed and transitions tenant to ROOM_FINALIZED', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue(tenant);
      mockPrisma.bed.findUnique.mockResolvedValue(bed);
      mockPrisma.tenantAllocation.findFirst.mockResolvedValue(null); // no active allocation
      mockPrisma.bed.update.mockResolvedValue({ ...bed, status: BedStatus.RESERVED });
      mockPrisma.tenant.update.mockResolvedValue({ ...tenant, status: TenantStatus.ROOM_FINALIZED });

      await expect(service.finalizeRoom('tenant-1', 'bed-1', 10000)).resolves.not.toThrow();
      expect(mockPrisma.bed.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: BedStatus.RESERVED } }),
      );
    });

    it('throws NotFoundException when bed does not exist', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue(tenant);
      mockPrisma.bed.findUnique.mockResolvedValue(null);

      await expect(service.finalizeRoom('tenant-1', 'bed-x', 5000)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws BadRequestException when bed belongs to a different property', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue(tenant);
      mockPrisma.bed.findUnique.mockResolvedValue({
        ...bed,
        room: { propertyId: 'OTHER-PROP' },
      });

      await expect(service.finalizeRoom('tenant-1', 'bed-1', 5000)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws ConflictException when bed is already occupied', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue(tenant);
      mockPrisma.bed.findUnique.mockResolvedValue({ ...bed, status: BedStatus.OCCUPIED });
      mockPrisma.tenantAllocation.findFirst.mockResolvedValue(null);

      await expect(service.finalizeRoom('tenant-1', 'bed-1', 5000)).rejects.toThrow(
        ConflictException,
      );
    });

    it('throws ConflictException on double-reservation via active allocation', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue(tenant);
      mockPrisma.bed.findUnique.mockResolvedValue(bed);
      // Bed is AVAILABLE but another allocation is active (race condition guard)
      mockPrisma.tenantAllocation.findFirst.mockResolvedValue({ id: 'alloc-other' });

      await expect(service.finalizeRoom('tenant-1', 'bed-1', 5000)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  // ── reEngage ────────────────────────────────────────────────────────────────

  describe('reEngage', () => {
    it('transitions REJECTED → LEAD with optional notes', async () => {
      const tenant = makeTenant({ status: TenantStatus.REJECTED, notes: 'old note' });
      mockPrisma.tenant.findUnique.mockResolvedValue(tenant);
      mockPrisma.tenant.update.mockResolvedValue({ ...tenant, status: TenantStatus.LEAD });

      await service.reEngage('tenant-1', 'rooms available now');

      expect(mockPrisma.tenant.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: TenantStatus.LEAD }),
        }),
      );
    });

    it('throws BadRequestException for invalid re-engage (ACTIVE → LEAD)', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue(makeTenant({ status: TenantStatus.ACTIVE }));

      await expect(service.reEngage('tenant-1')).rejects.toThrow(BadRequestException);
    });
  });

  // ── getMoveOutPreview + moveOut (preview token) ──────────────────────────────

  describe('getMoveOutPreview', () => {
    beforeEach(() => {
      mockPrisma.tenant.findUnique.mockResolvedValue(
        makeTenant({ status: TenantStatus.NOTICE_PERIOD, depositBalance: new Decimal('5000') }),
      );
      // aggregate: total pending rent
      mockPrisma.rentCycle.aggregate.mockResolvedValue({ _sum: { remainingAmount: null }, _count: { _all: 0 } });
      // findMany: outstanding cycle details
      mockPrisma.rentCycle.findMany.mockResolvedValue([]);
      // active allocation with room info
      mockPrisma.tenantAllocation.findFirst.mockResolvedValue({
        bedId: 'bed-1',
        startDate: new Date('2025-01-01'),
        monthlyRent: new Decimal('8000'),
        bed: { label: 'A', room: { number: '101', floor: 1 } },
      });
      mockCache.set.mockResolvedValue(undefined);
    });

    it('returns a previewToken and stores snapshot in cache', async () => {
      const result = await service.getMoveOutPreview('tenant-1');

      // Response is wrapped: { success, data: { previewToken, ... } }
      expect(result.data).toHaveProperty('previewToken');
      const token = result.data.previewToken;
      expect(typeof token).toBe('string');
      expect(token).toHaveLength(36); // UUID v4

      // Cache key must embed the token; value must be JSON string
      expect(mockCache.set).toHaveBeenCalledWith(
        expect.stringContaining(token),
        expect.any(String), // JSON.stringify(snapshot)
        1800,
      );
    });

    it('includes previewExpiresInSeconds: 1800', async () => {
      const result = await service.getMoveOutPreview('tenant-1');
      expect(result.data.previewExpiresInSeconds).toBe(1800);
    });
  });

  describe('moveOut (preview token validation)', () => {
    const tenant = makeTenant({
      status: TenantStatus.NOTICE_PERIOD,
      moveInDate: new Date('2025-01-01'),
      depositBalance: new Decimal('5000'),
    });
    const validToken = 'abc-token-uuid';

    it('throws ConflictException when preview token not found in cache (expired/invalid)', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue(tenant);
      mockCache.get.mockResolvedValue(null); // token expired or never issued

      await expect(
        service.moveOut(
          'tenant-1',
          { moveOutDate: '2026-06-15', lateFeeWaived: false, previewToken: validToken },
          'op-1',
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('throws ConflictException when balances changed since preview was generated', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue(tenant);
      // Cache holds a JSON string with depositBalance: 5000, totalPendingRent: 0
      mockCache.get.mockResolvedValue(
        JSON.stringify({ depositBalance: 5000, totalPendingRent: 0, generatedAt: Date.now() }),
      );
      // But current aggregate shows ₹5000 pending rent — snapshot is stale
      mockPrisma.rentCycle.aggregate.mockResolvedValue({
        _sum: { remainingAmount: new Decimal('5000') },
      });
      mockCache.del.mockResolvedValue(undefined);

      await expect(
        service.moveOut(
          'tenant-1',
          { moveOutDate: '2026-06-15', lateFeeWaived: false, previewToken: validToken },
          'op-1',
        ),
      ).rejects.toThrow(ConflictException);
    });
  });

  // ── archive — DPDP-lite PII anonymisation ───────────────────────────────────

  describe('archive', () => {
    it('anonymises PII fields atomically when archiving a MOVED_OUT tenant', async () => {
      const tenant = makeTenant({ status: TenantStatus.MOVED_OUT, tenantCode: 'PG-00001' });
      mockPrisma.tenant.findUnique.mockResolvedValue(tenant);
      mockPrisma.tenant.update.mockResolvedValue({ ...tenant, status: TenantStatus.ARCHIVED });
      mockPrisma.tenantDocument.updateMany.mockResolvedValue({ count: 2 });
      mockPrisma.emergencyContact.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.user.update.mockResolvedValue({});

      const result = await service.archive('tenant-1');

      // All 4 mutations must run inside the transaction
      expect(mockPrisma.tenant.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: TenantStatus.ARCHIVED,
            anonymisedAt: expect.any(Date),
          }),
        }),
      );
      expect(mockPrisma.tenantDocument.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { documentNumber: 'REDACTED', fileUrl: null },
        }),
      );
      expect(mockPrisma.emergencyContact.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { name: 'REDACTED', phone: '0000000000', relation: 'REDACTED' },
        }),
      );
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-1' },
          data: expect.objectContaining({
            name: 'Archived-PG-00001',
            phone: null,
            whatsappPhone: null,
          }),
        }),
      );

      expect(result).toMatchObject({ tenantId: 'tenant-1' });
      expect(result).toHaveProperty('anonymisedAt');
    });

    it('throws BadRequestException for invalid transition (ACTIVE → ARCHIVED)', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue(makeTenant({ status: TenantStatus.ACTIVE }));

      await expect(service.archive('tenant-1')).rejects.toThrow(BadRequestException);
    });
  });
});
