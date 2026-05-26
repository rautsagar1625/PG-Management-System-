import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { DashboardService } from './dashboard.service';
import { PrismaService } from '../../database/prisma.service';
import { CacheService } from '../../database/cache.service';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const makeProperty = (id = 'prop-1', name = 'Test PG', city = 'Bangalore') => ({
  id,
  name,
  city,
});

const makeRole = (property = makeProperty()) => ({
  userId: 'user-1',
  property,
});

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockPrisma = {
  propertyRole: { findMany: jest.fn() },
  bed: { findMany: jest.fn(), groupBy: jest.fn() },
  rentCycle: { groupBy: jest.fn(), aggregate: jest.fn(), count: jest.fn(), findUnique: jest.fn() },
  complaint: { groupBy: jest.fn() },
  tenant: { findUnique: jest.fn(), count: jest.fn() },
};

const mockCache = {
  wrap: jest.fn(),
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('DashboardService', () => {
  let service: DashboardService;

  beforeEach(async () => {
    jest.clearAllMocks();

    // By default, cache.wrap immediately calls through to the factory
    mockCache.wrap.mockImplementation(
      (_key: string, _ttl: number, factory: () => unknown) => factory(),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: CacheService, useValue: mockCache },
      ],
    }).compile();

    service = module.get<DashboardService>(DashboardService);
  });

  // ── getOperatorDashboard ──────────────────────────────────────────────────

  describe('getOperatorDashboard', () => {
    it('returns empty state when user has no property roles', async () => {
      mockPrisma.propertyRole.findMany.mockResolvedValue([]);

      const result = await service.getOperatorDashboard('user-1');

      expect(result.properties).toHaveLength(0);
      expect(result.globalSummary.totalProperties).toBe(0);
      expect(result.globalSummary.totalMonthlyRevenue).toBe(0);
    });

    it('returns correct property card for a single property', async () => {
      const property = makeProperty();
      mockPrisma.propertyRole.findMany.mockResolvedValue([makeRole(property)]);

      // 2 beds: 1 OCCUPIED, 1 AVAILABLE
      mockPrisma.bed.findMany.mockResolvedValue([
        { status: 'OCCUPIED', room: { propertyId: 'prop-1' } },
        { status: 'AVAILABLE', room: { propertyId: 'prop-1' } },
      ]);

      mockPrisma.rentCycle.groupBy.mockResolvedValue([
        {
          propertyId: 'prop-1',
          _sum: { rentAmount: '10000', paidAmount: '8000', remainingAmount: '2000' },
        },
      ]);

      mockPrisma.complaint.groupBy.mockResolvedValue([
        { propertyId: 'prop-1', _count: { _all: 3 } },
      ]);

      const result = await service.getOperatorDashboard('user-1');

      expect(result.properties).toHaveLength(1);
      const card = result.properties[0];
      expect(card!.propertyId).toBe('prop-1');
      expect(card!.totalBeds).toBe(2);
      expect(card!.occupiedBeds).toBe(1);
      expect(card!.availableBeds).toBe(1);
      expect(card!.occupancyRate).toBe(50);
      expect(card!.totalExpectedRent).toBe(10000);
      expect(card!.totalCollectedRent).toBe(8000);
      expect(card!.pendingRent).toBe(2000);
      expect(card!.openComplaints).toBe(3);
    });

    it('aggregates global summary across multiple properties', async () => {
      const p1 = makeProperty('prop-1', 'PG Alpha', 'Bangalore');
      const p2 = makeProperty('prop-2', 'PG Beta', 'Pune');

      mockPrisma.propertyRole.findMany.mockResolvedValue([makeRole(p1), makeRole(p2)]);

      mockPrisma.bed.findMany.mockResolvedValue([
        { status: 'OCCUPIED', room: { propertyId: 'prop-1' } },
        { status: 'OCCUPIED', room: { propertyId: 'prop-2' } },
      ]);

      mockPrisma.rentCycle.groupBy.mockResolvedValue([
        { propertyId: 'prop-1', _sum: { rentAmount: '5000', paidAmount: '5000', remainingAmount: '0' } },
        { propertyId: 'prop-2', _sum: { rentAmount: '4000', paidAmount: '2000', remainingAmount: '2000' } },
      ]);

      mockPrisma.complaint.groupBy.mockResolvedValue([
        { propertyId: 'prop-1', _count: { _all: 1 } },
        { propertyId: 'prop-2', _count: { _all: 2 } },
      ]);

      const result = await service.getOperatorDashboard('user-1');

      expect(result.globalSummary.totalProperties).toBe(2);
      expect(result.globalSummary.totalMonthlyRevenue).toBe(7000);
      expect(result.globalSummary.totalPendingRent).toBe(2000);
      expect(result.globalSummary.totalOpenComplaints).toBe(3);
    });

    it('handles property with no beds and no rent cycles gracefully', async () => {
      const property = makeProperty();
      mockPrisma.propertyRole.findMany.mockResolvedValue([makeRole(property)]);
      mockPrisma.bed.findMany.mockResolvedValue([]);
      mockPrisma.rentCycle.groupBy.mockResolvedValue([]);
      mockPrisma.complaint.groupBy.mockResolvedValue([]);

      const result = await service.getOperatorDashboard('user-1');

      const card = result.properties[0];
      expect(card!.totalBeds).toBe(0);
      expect(card!.occupancyRate).toBe(0);
      // calculateCollectionRate(0, 0) returns 100 — nothing expected = fully collected
      expect(card!.rentCollectionRate).toBe(100);
      expect(card!.openComplaints).toBe(0);
    });

    it('returns cached result on second call (cache.wrap called with same key)', async () => {
      const cachedData = { properties: [], globalSummary: { totalProperties: 0, totalMonthlyRevenue: 0, totalPendingRent: 0, totalOpenComplaints: 0 } };
      mockCache.wrap.mockResolvedValue(cachedData);

      const result = await service.getOperatorDashboard('user-1');
      expect(result).toBe(cachedData);
      expect(mockCache.wrap).toHaveBeenCalledTimes(1);
    });
  });

  // ── getTenantDashboard ────────────────────────────────────────────────────

  describe('getTenantDashboard', () => {
    it('throws NotFoundException when tenant profile does not exist', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue(null);

      await expect(service.getTenantDashboard('user-no-tenant')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('returns tenant dashboard with null currentRent when no cycle exists', async () => {
      const tenant = {
        id: 'tenant-1',
        tenantCode: 'TEN-001',
        moveInDate: new Date('2025-01-01'),
        user: { name: 'Alice' },
        property: { name: 'Green Leaf PG' },
        allocations: [
          {
            isActive: true,
            monthlyRent: 8000,
            bed: { label: 'A1', room: { number: '101', floor: 1 } },
          },
        ],
        payments: [],
      };

      mockPrisma.tenant.findUnique.mockResolvedValue(tenant);
      mockPrisma.rentCycle.findUnique.mockResolvedValue(null);

      const result = await service.getTenantDashboard('user-1');

      expect(result.name).toBe('Alice');
      expect(result.propertyName).toBe('Green Leaf PG');
      expect(result.currentRent).toBeNull();
      expect(result.recentPayments).toHaveLength(0);
    });

    it('returns current rent cycle status when cycle exists', async () => {
      const cycle = {
        month: 5,
        year: 2026,
        dueDate: new Date('2026-05-07'),
        rentAmount: 8000,
        paidAmount: 5000,
        remainingAmount: 3000,
        status: 'PENDING',
      };

      const tenant = {
        id: 'tenant-1',
        tenantCode: 'TEN-002',
        moveInDate: new Date('2025-03-01'),
        user: { name: 'Bob' },
        property: { name: 'Tech Park PG' },
        allocations: [
          {
            isActive: true,
            monthlyRent: 8000,
            bed: { label: 'B2', room: { number: '102', floor: 1 } },
          },
        ],
        payments: [],
      };

      mockPrisma.tenant.findUnique.mockResolvedValue(tenant);
      mockPrisma.rentCycle.findUnique.mockResolvedValue(cycle);

      const result = await service.getTenantDashboard('user-1');

      expect(result.currentRent).not.toBeNull();
      expect(result.currentRent!.status).toBe('PENDING');
      expect(result.currentRent!.isOverdue).toBe(false);
      expect(result.currentRent!.remainingAmount).toBe(3000);
    });
  });
});
