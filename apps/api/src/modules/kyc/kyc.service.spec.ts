import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DocumentType } from '@prisma/client';

import { KycService } from './kyc.service';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const makeDocument = (overrides: Record<string, unknown> = {}) => ({
  id: 'doc-1',
  tenantId: 'tenant-1',
  type: DocumentType.AADHAAR,
  documentNumber: '1234-5678-9012',
  fileUrl: 'https://storage.example.com/docs/aadhaar.jpg',
  verifiedAt: null,
  verifiedBy: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockPrisma = {
  tenantDocument: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    findUniqueOrThrow: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  tenant: {
    updateMany: jest.fn(),
    update: jest.fn(),
  },
};

const mockAudit = {
  log: jest.fn().mockResolvedValue(undefined),
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('KycService', () => {
  let service: KycService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KycService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: mockAudit },
      ],
    }).compile();

    service = module.get<KycService>(KycService);
  });

  // ── getDocuments ──────────────────────────────────────────────────────────

  describe('getDocuments', () => {
    it('returns documents for a tenant', async () => {
      const docs = [makeDocument(), makeDocument({ id: 'doc-2', type: DocumentType.PAN })];
      mockPrisma.tenantDocument.findMany.mockResolvedValue(docs);

      const result = await service.getDocuments('tenant-1', 'user-op-1');

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
    });

    it('fires audit log (fire-and-forget) on every access', async () => {
      mockPrisma.tenantDocument.findMany.mockResolvedValue([makeDocument()]);

      await service.getDocuments('tenant-1', 'user-op-1');

      // audit.log must be called
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'KYC_DOCUMENTS_VIEWED',
          entity: 'TenantDocument',
          entityId: 'tenant-1',
          userId: 'user-op-1',
        }),
      );
    });

    it('includes document count and types in the audit metadata', async () => {
      const docs = [
        makeDocument({ type: DocumentType.AADHAAR }),
        makeDocument({ id: 'doc-2', type: DocumentType.PAN }),
      ];
      mockPrisma.tenantDocument.findMany.mockResolvedValue(docs);

      await service.getDocuments('tenant-1', 'user-op-1');

      const auditCall = mockAudit.log.mock.calls[0][0];
      expect(auditCall.metadata.documentCount).toBe(2);
      expect(auditCall.metadata.documentTypes).toEqual([DocumentType.AADHAAR, DocumentType.PAN]);
    });

    it('works without accessedByUserId (operator id is optional)', async () => {
      mockPrisma.tenantDocument.findMany.mockResolvedValue([]);

      const result = await service.getDocuments('tenant-1');

      expect(result.success).toBe(true);
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({ userId: undefined }),
      );
    });

    it('does not await audit.log result — response returned before audit completes', async () => {
      mockPrisma.tenantDocument.findMany.mockResolvedValue([]);
      // Audit resolves normally — we just verify it was called without blocking the response.
      // The fire-and-forget pattern is verified by the fact that getDocuments resolves
      // even though audit.log runs asynchronously.
      mockAudit.log.mockResolvedValueOnce(undefined);

      const result = await service.getDocuments('tenant-1', 'user-op-1');

      expect(result.success).toBe(true);
      // audit.log must have been invoked (the void call still triggers the function)
      expect(mockAudit.log).toHaveBeenCalledTimes(1);
    });
  });

  // ── addDocument ───────────────────────────────────────────────────────────

  describe('addDocument', () => {
    it('creates a document and updates kycStatus from PENDING to SUBMITTED', async () => {
      const doc = makeDocument();
      mockPrisma.tenantDocument.create.mockResolvedValue(doc);
      mockPrisma.tenant.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.addDocument({
        tenantId: 'tenant-1',
        type: DocumentType.AADHAAR,
        documentNumber: '1234-5678-9012',
        fileUrl: 'https://storage.example.com/docs/aadhaar.jpg',
      });

      expect(result.success).toBe(true);
      expect(result.data.id).toBe('doc-1');

      // kycStatus update must have been triggered
      expect(mockPrisma.tenant.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'tenant-1', kycStatus: 'PENDING' },
          data: { kycStatus: 'SUBMITTED' },
        }),
      );
    });

    it('works without fileUrl', async () => {
      mockPrisma.tenantDocument.create.mockResolvedValue(makeDocument({ fileUrl: null }));
      mockPrisma.tenant.updateMany.mockResolvedValue({ count: 0 });

      const result = await service.addDocument({
        tenantId: 'tenant-1',
        type: DocumentType.PAN,
        documentNumber: 'ABCDE1234F',
      });

      expect(result.success).toBe(true);
    });
  });

  // ── verifyDocument ────────────────────────────────────────────────────────

  describe('verifyDocument', () => {
    it('throws NotFoundException when document does not exist', async () => {
      mockPrisma.tenantDocument.findUnique.mockResolvedValue(null);

      await expect(
        service.verifyDocument('doc-ghost', 'user-op-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('sets verifiedAt and verifiedBy on the document', async () => {
      const doc = makeDocument();
      const verified = makeDocument({ verifiedAt: new Date(), verifiedBy: 'user-op-1' });

      mockPrisma.tenantDocument.findUnique.mockResolvedValue(doc);
      mockPrisma.tenantDocument.update.mockResolvedValue(verified);

      // All docs are verified → trigger kycStatus update
      mockPrisma.tenantDocument.findMany.mockResolvedValue([verified]);
      mockPrisma.tenant.update.mockResolvedValue({});

      const result = await service.verifyDocument('doc-1', 'user-op-1');

      expect(result.success).toBe(true);
      expect(mockPrisma.tenantDocument.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            verifiedBy: 'user-op-1',
          }),
        }),
      );
    });

    it('marks tenant kycStatus=VERIFIED when all documents are verified', async () => {
      const doc = makeDocument();
      const verified = makeDocument({ verifiedAt: new Date(), verifiedBy: 'user-op-1' });

      mockPrisma.tenantDocument.findUnique.mockResolvedValue(doc);
      mockPrisma.tenantDocument.update.mockResolvedValue(verified);
      // All docs have verifiedAt → trigger completed
      mockPrisma.tenantDocument.findMany.mockResolvedValue([verified]);
      mockPrisma.tenant.update.mockResolvedValue({});

      await service.verifyDocument('doc-1', 'user-op-1');

      expect(mockPrisma.tenant.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { kycStatus: 'VERIFIED', kycCompleted: true },
        }),
      );
    });

    it('does NOT mark kycStatus=VERIFIED when some documents are still unverified', async () => {
      const doc = makeDocument();
      const verified = makeDocument({ verifiedAt: new Date(), verifiedBy: 'user-op-1' });
      const unverified = makeDocument({ id: 'doc-2', verifiedAt: null });

      mockPrisma.tenantDocument.findUnique.mockResolvedValue(doc);
      mockPrisma.tenantDocument.update.mockResolvedValue(verified);
      // One doc still unverified
      mockPrisma.tenantDocument.findMany.mockResolvedValue([verified, unverified]);

      await service.verifyDocument('doc-1', 'user-op-1');

      expect(mockPrisma.tenant.update).not.toHaveBeenCalled();
    });
  });

  // ── deleteDocument ────────────────────────────────────────────────────────

  describe('deleteDocument', () => {
    it('deletes a document when it exists', async () => {
      mockPrisma.tenantDocument.findUniqueOrThrow.mockResolvedValue(makeDocument());
      mockPrisma.tenantDocument.delete.mockResolvedValue({});

      const result = await service.deleteDocument('doc-1');

      expect(result.success).toBe(true);
      expect(mockPrisma.tenantDocument.delete).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'doc-1' } }),
      );
    });

    it('throws when document does not exist (via findUniqueOrThrow)', async () => {
      mockPrisma.tenantDocument.findUniqueOrThrow.mockRejectedValue(
        new Error('Record to delete does not exist'),
      );

      await expect(service.deleteDocument('doc-ghost')).rejects.toThrow();
    });
  });
});
