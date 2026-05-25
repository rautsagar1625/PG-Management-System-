import { Injectable, NotFoundException } from '@nestjs/common';
import { DocumentType } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';

export interface CreateDocumentDto {
  tenantId: string;
  type: DocumentType;
  documentNumber: string;
  fileUrl?: string;
}

@Injectable()
export class KycService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  /**
   * ER-004: Every operator read of KYC documents is logged to the audit trail.
   * KYC documents contain Aadhaar/PAN/passport numbers — PII that must have a
   * full access history for compliance (data protection audits, police verification).
   *
   * @param tenantId - whose documents are being accessed
   * @param accessedByUserId - the operator/staff user making the request
   */
  async getDocuments(tenantId: string, accessedByUserId?: string) {
    const docs = await this.prisma.tenantDocument.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });

    // Fire-and-forget — document access audit must never block the response
    void this.audit.log({
      action: 'KYC_DOCUMENTS_VIEWED',
      entity: 'TenantDocument',
      entityId: tenantId,
      userId: accessedByUserId,
      metadata: {
        documentCount: docs.length,
        documentTypes: docs.map((d) => d.type),
        accessedAt: new Date().toISOString(),
      },
    });

    return { success: true, data: docs };
  }

  async addDocument(dto: CreateDocumentDto) {
    const doc = await this.prisma.tenantDocument.create({
      data: {
        tenantId: dto.tenantId,
        type: dto.type,
        documentNumber: dto.documentNumber,
        fileUrl: dto.fileUrl,
      },
    });
    // Update tenant kycStatus to SUBMITTED if it was PENDING
    await this.prisma.tenant.updateMany({
      where: { id: dto.tenantId, kycStatus: 'PENDING' },
      data: { kycStatus: 'SUBMITTED' },
    });
    return { success: true, data: doc };
  }

  async verifyDocument(docId: string, verifiedBy: string) {
    const doc = await this.prisma.tenantDocument.findUnique({ where: { id: docId } });
    if (!doc) throw new NotFoundException('Document not found');

    const updated = await this.prisma.tenantDocument.update({
      where: { id: docId },
      data: { verifiedAt: new Date(), verifiedBy },
    });

    // Check if ALL documents for this tenant are verified → mark kycCompleted
    const allDocs = await this.prisma.tenantDocument.findMany({ where: { tenantId: doc.tenantId } });
    const allVerified = allDocs.every((d) => d.verifiedAt !== null);
    if (allVerified) {
      await this.prisma.tenant.update({
        where: { id: doc.tenantId },
        data: { kycStatus: 'VERIFIED', kycCompleted: true },
      });
    }

    return { success: true, data: updated };
  }

  async deleteDocument(docId: string) {
    await this.prisma.tenantDocument.findUniqueOrThrow({ where: { id: docId } });
    await this.prisma.tenantDocument.delete({ where: { id: docId } });
    return { success: true };
  }
}
