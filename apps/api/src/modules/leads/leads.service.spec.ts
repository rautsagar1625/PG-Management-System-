import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { LeadSource, LeadStatus } from '@prisma/client';

import { LeadsService } from './leads.service';
import { PrismaService } from '../../database/prisma.service';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const makeLead = (overrides: Record<string, unknown> = {}) => ({
  id: 'lead-1',
  propertyId: 'prop-1',
  name: 'Ravi Kumar',
  phone: '+919876543210',
  email: 'ravi@example.com',
  source: LeadSource.DIRECT,
  status: LeadStatus.NEW,
  budget: 8000,
  moveInDate: null,
  roomType: null,
  notes: null,
  assignedTo: null,
  visitDate: null,
  convertedAt: null,
  tenantId: null,
  createdBy: 'user-op-1',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockPrisma = {
  lead: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('LeadsService', () => {
  let service: LeadsService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LeadsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<LeadsService>(LeadsService);
  });

  // ── findAll ───────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('returns all leads for a property', async () => {
      const leads = [makeLead(), makeLead({ id: 'lead-2', name: 'Priya Sharma' })];
      mockPrisma.lead.findMany.mockResolvedValue(leads);

      const result = await service.findAll('prop-1', {});

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
      expect(mockPrisma.lead.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { propertyId: 'prop-1' } }),
      );
    });

    it('filters by status when provided', async () => {
      // Use string literals — avoids Prisma enum generation differences across environments
      mockPrisma.lead.findMany.mockResolvedValue([makeLead({ status: LeadStatus.VISIT_SCHEDULED })]);

      await service.findAll('prop-1', { status: 'VISIT_SCHEDULED' });

      expect(mockPrisma.lead.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { propertyId: 'prop-1', status: 'VISIT_SCHEDULED' },
        }),
      );
    });
  });

  // ── findOne ───────────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('returns lead when found', async () => {
      const lead = makeLead();
      mockPrisma.lead.findUnique.mockResolvedValue(lead);

      const result = await service.findOne('lead-1');

      expect(result.success).toBe(true);
      expect(result.data.id).toBe('lead-1');
    });

    it('throws NotFoundException when lead does not exist', async () => {
      mockPrisma.lead.findUnique.mockResolvedValue(null);

      await expect(service.findOne('lead-ghost')).rejects.toThrow(NotFoundException);
    });
  });

  // ── create ────────────────────────────────────────────────────────────────

  describe('create', () => {
    it('creates a lead with DIRECT source by default', async () => {
      const created = makeLead();
      mockPrisma.lead.create.mockResolvedValue(created);

      const result = await service.create(
        { propertyId: 'prop-1', name: 'Ravi Kumar', phone: '+919876543210' },
        'user-op-1',
      );

      expect(result.success).toBe(true);
      expect(mockPrisma.lead.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            source: LeadSource.DIRECT,
            createdBy: 'user-op-1',
          }),
        }),
      );
    });

    it('uses provided source when specified', async () => {
      mockPrisma.lead.create.mockResolvedValue(
        makeLead({ source: LeadSource.REFERRAL }),
      );

      await service.create(
        { propertyId: 'prop-1', name: 'X', phone: '+91', source: LeadSource.REFERRAL },
        'user-op-1',
      );

      expect(mockPrisma.lead.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ source: LeadSource.REFERRAL }),
        }),
      );
    });

    it('parses moveInDate string to Date when provided', async () => {
      mockPrisma.lead.create.mockResolvedValue(makeLead());

      await service.create(
        { propertyId: 'prop-1', name: 'X', phone: '+91', moveInDate: '2026-07-01' },
        'user-op-1',
      );

      const callData = mockPrisma.lead.create.mock.calls[0][0].data;
      expect(callData.moveInDate).toBeInstanceOf(Date);
    });
  });

  // ── updateStatus ──────────────────────────────────────────────────────────

  describe('updateStatus', () => {
    it('updates lead status successfully', async () => {
      const lead = makeLead({ status: LeadStatus.NEW });
      const updated = makeLead({ status: LeadStatus.QUALIFIED });
      mockPrisma.lead.findUnique.mockResolvedValue(lead);
      mockPrisma.lead.update.mockResolvedValue(updated);

      const result = await service.updateStatus('lead-1', { status: LeadStatus.QUALIFIED });

      expect(result.success).toBe(true);
      expect(mockPrisma.lead.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: LeadStatus.QUALIFIED }),
        }),
      );
    });

    it('throws NotFoundException when lead does not exist', async () => {
      mockPrisma.lead.findUnique.mockResolvedValue(null);

      await expect(
        service.updateStatus('lead-ghost', { status: LeadStatus.QUALIFIED }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when updating a CONVERTED lead', async () => {
      mockPrisma.lead.findUnique.mockResolvedValue(
        makeLead({ status: LeadStatus.CONVERTED }),
      );

      await expect(
        service.updateStatus('lead-1', { status: LeadStatus.LOST }),
      ).rejects.toThrow(BadRequestException);
    });

    it('appends notes when provided', async () => {
      mockPrisma.lead.findUnique.mockResolvedValue(makeLead());
      mockPrisma.lead.update.mockResolvedValue(makeLead({ notes: 'Interested in AC room' }));

      await service.updateStatus('lead-1', {
        status: LeadStatus.QUALIFIED,
        notes: 'Interested in AC room',
      });

      expect(mockPrisma.lead.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ notes: 'Interested in AC room' }),
        }),
      );
    });
  });

  // ── assign ────────────────────────────────────────────────────────────────

  describe('assign', () => {
    it('assigns lead to a user', async () => {
      mockPrisma.lead.findUnique.mockResolvedValue(makeLead());
      mockPrisma.lead.update.mockResolvedValue(makeLead({ assignedTo: 'user-staff-1' }));

      const result = await service.assign('lead-1', { assignedTo: 'user-staff-1' });

      expect(result.success).toBe(true);
      expect(mockPrisma.lead.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { assignedTo: 'user-staff-1' } }),
      );
    });

    it('throws NotFoundException when lead not found', async () => {
      mockPrisma.lead.findUnique.mockResolvedValue(null);

      await expect(
        service.assign('lead-ghost', { assignedTo: 'user-1' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── scheduleVisit ─────────────────────────────────────────────────────────

  describe('scheduleVisit', () => {
    it('sets visit date and transitions status to VISIT_SCHEDULED', async () => {
      mockPrisma.lead.findUnique.mockResolvedValue(makeLead());
      mockPrisma.lead.update.mockResolvedValue(
        makeLead({ visitDate: new Date('2026-06-01'), status: LeadStatus.VISIT_SCHEDULED }),
      );

      const result = await service.scheduleVisit('lead-1', { visitDate: '2026-06-01' });

      expect(result.success).toBe(true);
      expect(mockPrisma.lead.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: LeadStatus.VISIT_SCHEDULED }),
        }),
      );
    });
  });

  // ── convert ───────────────────────────────────────────────────────────────

  describe('convert', () => {
    it('marks lead as CONVERTED and links tenantId', async () => {
      mockPrisma.lead.findUnique.mockResolvedValue(makeLead({ status: LeadStatus.QUALIFIED }));
      mockPrisma.lead.update.mockResolvedValue(
        makeLead({ status: LeadStatus.CONVERTED, tenantId: 'tenant-1' }),
      );

      const result = await service.convert('lead-1', { tenantId: 'tenant-1' });

      expect(result.success).toBe(true);
      expect(mockPrisma.lead.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: LeadStatus.CONVERTED,
            tenantId: 'tenant-1',
          }),
        }),
      );
    });

    it('throws BadRequestException when lead is already CONVERTED', async () => {
      mockPrisma.lead.findUnique.mockResolvedValue(
        makeLead({ status: LeadStatus.CONVERTED }),
      );

      await expect(
        service.convert('lead-1', { tenantId: 'tenant-99' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException when lead does not exist', async () => {
      mockPrisma.lead.findUnique.mockResolvedValue(null);

      await expect(
        service.convert('lead-ghost', { tenantId: 'tenant-1' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── softDelete ────────────────────────────────────────────────────────────

  describe('softDelete', () => {
    it('marks lead as LOST', async () => {
      mockPrisma.lead.findUnique.mockResolvedValue(makeLead());
      mockPrisma.lead.update.mockResolvedValue(makeLead({ status: LeadStatus.LOST }));

      const result = await service.softDelete('lead-1');

      expect(result.success).toBe(true);
      expect(mockPrisma.lead.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: LeadStatus.LOST } }),
      );
    });

    it('throws BadRequestException when deleting a converted lead', async () => {
      mockPrisma.lead.findUnique.mockResolvedValue(
        makeLead({ status: LeadStatus.CONVERTED }),
      );

      await expect(service.softDelete('lead-1')).rejects.toThrow(BadRequestException);
    });
  });
});
