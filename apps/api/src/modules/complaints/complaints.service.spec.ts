import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import { Priority } from '@prisma/client';

import { ComplaintsService } from './complaints.service';
import { PrismaService } from '../../database/prisma.service';
import { DOMAIN_EVENTS } from '../../events/domain-events';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const makeComplaint = (overrides: Record<string, unknown> = {}) => ({
  id: 'complaint-1',
  propertyId: 'prop-1',
  tenantId: 'tenant-1',
  raisedBy: 'user-tenant-1',
  category: 'MAINTENANCE',
  title: 'AC not working',
  description: 'The air conditioner in room 101 has stopped cooling.',
  priority: Priority.HIGH,
  status: 'OPEN',
  assignedTo: null,
  resolvedAt: null,
  closedAt: null,
  reopenedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  tenant: { user: { id: 'user-tenant-1' } },
  ...overrides,
});

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockPrisma = {
  complaint: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    groupBy: jest.fn(),
  },
  complaintUpdate: { create: jest.fn() },
  propertyRole: { findUnique: jest.fn() },
  $transaction: jest.fn(),
};

const mockEventEmitter = {
  emit: jest.fn(),
  emitAsync: jest.fn().mockResolvedValue([]),
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ComplaintsService', () => {
  let service: ComplaintsService;

  beforeEach(async () => {
    jest.clearAllMocks();

    // Default $transaction passes the callback a proxy of mockPrisma
    mockPrisma.$transaction.mockImplementation(
      (cb: (tx: typeof mockPrisma) => unknown) => cb(mockPrisma),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ComplaintsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: EventEmitter2, useValue: mockEventEmitter },
      ],
    }).compile();

    service = module.get<ComplaintsService>(ComplaintsService);
  });

  // ── findAll ───────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('returns paginated complaints with hasMore=false when at or under limit', async () => {
      const items = Array.from({ length: 3 }, (_, i) =>
        makeComplaint({ id: `complaint-${i + 1}` }),
      );
      // Service fetches limit+1; return exactly limit items → no more pages
      mockPrisma.complaint.findMany.mockResolvedValue(items);

      const result = await service.findAll('prop-1', { limit: 50 });

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(3);
      expect(result.meta.hasMore).toBe(false);
      expect(result.meta.nextCursor).toBeUndefined();
    });

    it('sets hasMore=true and nextCursor when there are more items', async () => {
      // limit=2, fetch 3 items (limit+1=3) → hasMore
      const items = Array.from({ length: 3 }, (_, i) =>
        makeComplaint({ id: `complaint-${i + 1}` }),
      );
      mockPrisma.complaint.findMany.mockResolvedValue(items);

      const result = await service.findAll('prop-1', { limit: 2 });

      expect(result.meta.hasMore).toBe(true);
      expect(result.meta.nextCursor).toBe('complaint-2'); // last of sliced 2
      expect(result.data).toHaveLength(2);
    });

    it('caps limit at 100', async () => {
      mockPrisma.complaint.findMany.mockResolvedValue([]);

      await service.findAll('prop-1', { limit: 9999 });

      expect(mockPrisma.complaint.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 101 }), // 100 + 1 for hasMore check
      );
    });

    it('uses cursor skip when cursor is provided', async () => {
      mockPrisma.complaint.findMany.mockResolvedValue([]);

      await service.findAll('prop-1', { cursor: 'complaint-5' });

      expect(mockPrisma.complaint.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          cursor: { id: 'complaint-5' },
          skip: 1,
        }),
      );
    });

    it('filters by status when provided', async () => {
      mockPrisma.complaint.findMany.mockResolvedValue([]);

      await service.findAll('prop-1', { status: 'OPEN' });

      expect(mockPrisma.complaint.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'OPEN' }),
        }),
      );
    });
  });

  // ── findOne ───────────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('returns complaint when found', async () => {
      mockPrisma.complaint.findUnique.mockResolvedValue(makeComplaint());

      const result = await service.findOne('complaint-1');

      expect(result.success).toBe(true);
      expect(result.data.id).toBe('complaint-1');
    });

    it('throws NotFoundException when complaint does not exist', async () => {
      mockPrisma.complaint.findUnique.mockResolvedValue(null);

      await expect(service.findOne('ghost')).rejects.toThrow(NotFoundException);
    });
  });

  // ── create ────────────────────────────────────────────────────────────────

  describe('create', () => {
    it('creates a complaint and emits COMPLAINT_CREATED event', async () => {
      const complaint = makeComplaint();
      mockPrisma.complaint.create.mockResolvedValue(complaint);

      const result = await service.create(
        {
          propertyId: 'prop-1',
          category: 'MAINTENANCE',
          title: 'AC not working',
          description: 'AC in room 101 stopped cooling',
          priority: Priority.HIGH,
          tenantId: 'tenant-1',
        },
        'user-tenant-1',
      );

      expect(result.success).toBe(true);
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        DOMAIN_EVENTS.COMPLAINT_CREATED,
        expect.objectContaining({
          complaintId: complaint.id,
          propertyId: 'prop-1',
          raisedBy: 'user-tenant-1',
          title: 'AC not working',
        }),
      );
    });

    it('uses MEDIUM priority when not provided', async () => {
      const complaint = makeComplaint({ priority: 'MEDIUM' });
      mockPrisma.complaint.create.mockResolvedValue(complaint);

      await service.create(
        {
          propertyId: 'prop-1',
          category: 'HOUSEKEEPING',
          title: 'Room cleaning needed',
          description: 'Please schedule cleaning',
          priority: undefined as unknown as Priority,
        },
        'user-1',
      );

      expect(mockPrisma.complaint.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ priority: 'MEDIUM' }),
        }),
      );
    });
  });

  // ── update ────────────────────────────────────────────────────────────────

  describe('update', () => {
    it('throws NotFoundException when complaint not found', async () => {
      mockPrisma.complaint.findUnique.mockResolvedValue(null);

      await expect(
        service.update('ghost', { status: 'ASSIGNED' as never }, 'user-op-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException for invalid status transition', async () => {
      // CLOSED → ASSIGNED is not allowed
      mockPrisma.complaint.findUnique.mockResolvedValue(makeComplaint({ status: 'CLOSED' }));

      await expect(
        service.update('complaint-1', { status: 'ASSIGNED' as never }, 'user-op-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('allows valid status transition OPEN → ASSIGNED', async () => {
      const complaint = makeComplaint({ status: 'OPEN' });
      const updated = makeComplaint({ status: 'ASSIGNED' });

      mockPrisma.complaint.findUnique.mockResolvedValue(complaint);
      mockPrisma.complaint.update.mockResolvedValue(updated);
      mockPrisma.complaintUpdate.create.mockResolvedValue({});

      const result = await service.update(
        'complaint-1',
        { status: 'ASSIGNED' as never },
        'user-op-1',
      );

      expect(result.success).toBe(true);
    });

    it('emits COMPLAINT_STATUS_CHANGED event on status change', async () => {
      const complaint = makeComplaint({ status: 'OPEN' });
      mockPrisma.complaint.findUnique.mockResolvedValue(complaint);
      mockPrisma.complaint.update.mockResolvedValue(makeComplaint({ status: 'IN_PROGRESS' }));
      mockPrisma.complaintUpdate.create.mockResolvedValue({});

      await service.update(
        'complaint-1',
        { status: 'IN_PROGRESS' as never },
        'user-op-1',
      );

      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        DOMAIN_EVENTS.COMPLAINT_STATUS_CHANGED,
        expect.objectContaining({
          complaintId: 'complaint-1',
          fromStatus: 'OPEN',
          toStatus: 'IN_PROGRESS',
          updatedBy: 'user-op-1',
        }),
      );
    });

    it('emits COMPLAINT_RESOLVED event when transitioning to RESOLVED', async () => {
      const complaint = makeComplaint({ status: 'IN_PROGRESS' });
      mockPrisma.complaint.findUnique.mockResolvedValue(complaint);
      mockPrisma.complaint.update.mockResolvedValue(makeComplaint({ status: 'RESOLVED' }));
      mockPrisma.complaintUpdate.create.mockResolvedValue({});

      await service.update(
        'complaint-1',
        { status: 'RESOLVED' as never },
        'user-op-1',
      );

      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        DOMAIN_EVENTS.COMPLAINT_RESOLVED,
        expect.objectContaining({ complaintId: 'complaint-1' }),
      );
    });

    it('throws ForbiddenException when assignee has no role on property', async () => {
      const complaint = makeComplaint({ status: 'OPEN' });
      mockPrisma.complaint.findUnique.mockResolvedValue(complaint);
      mockPrisma.propertyRole.findUnique.mockResolvedValue(null);

      await expect(
        service.update('complaint-1', { assignedTo: 'user-stranger' }, 'user-op-1'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws BadRequestException when assignee has OWNER role (non-assignable)', async () => {
      const complaint = makeComplaint({ status: 'OPEN' });
      mockPrisma.complaint.findUnique.mockResolvedValue(complaint);
      mockPrisma.propertyRole.findUnique.mockResolvedValue({ role: 'OWNER' });

      await expect(
        service.update('complaint-1', { assignedTo: 'user-owner-1' }, 'user-op-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('creates a ComplaintUpdate record when status or comment is provided', async () => {
      const complaint = makeComplaint({ status: 'OPEN' });
      mockPrisma.complaint.findUnique.mockResolvedValue(complaint);
      mockPrisma.complaint.update.mockResolvedValue(makeComplaint({ status: 'ASSIGNED' }));
      mockPrisma.complaintUpdate.create.mockResolvedValue({});

      await service.update(
        'complaint-1',
        { status: 'ASSIGNED' as never, comment: 'Assigned to maintenance team' },
        'user-op-1',
      );

      expect(mockPrisma.complaintUpdate.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            complaintId: 'complaint-1',
            updatedBy: 'user-op-1',
            comment: 'Assigned to maintenance team',
          }),
        }),
      );
    });
  });
});
