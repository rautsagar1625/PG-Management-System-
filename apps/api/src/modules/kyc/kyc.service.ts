import { Injectable, NotFoundException } from '@nestjs/common';
import { DocumentType } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

export interface CreateDocumentDto {
  tenantId: string;
  type: DocumentType;
  documentNumber: string;
  fileUrl?: string;
}

@Injectable()
export class KycService {
  constructor(private prisma: PrismaService) {}

  async getDocuments(tenantId: string) {
    const docs = await this.prisma.tenantDocument.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
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
