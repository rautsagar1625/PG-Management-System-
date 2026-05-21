import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { AgreementStatus } from '@prisma/client';

import { PrismaService } from '../../database/prisma.service';

export interface CreateAgreementDto {
  tenantId: string;
  propertyId: string;
  terms: string;
  rentAmount: number;
  depositAmount: number;
  startDate: string;
  endDate?: string;
  allocationId?: string;
}

@Injectable()
export class AgreementsService {
  constructor(private prisma: PrismaService) {}

  async findByProperty(propertyId: string) {
    const agreements = await this.prisma.rentalAgreement.findMany({
      where: { propertyId },
      take: 500,
      include: {
        tenant: { include: { user: { select: { id: true, name: true, phone: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return { success: true, data: agreements };
  }

  async findByTenant(tenantId: string) {
    const agreements = await this.prisma.rentalAgreement.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });

    return { success: true, data: agreements };
  }

  async create(dto: CreateAgreementDto, createdBy: string) {
    const agreement = await this.prisma.rentalAgreement.create({
      data: {
        tenantId: dto.tenantId,
        propertyId: dto.propertyId,
        terms: dto.terms,
        rentAmount: dto.rentAmount,
        depositAmount: dto.depositAmount,
        startDate: new Date(dto.startDate),
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
        allocationId: dto.allocationId,
        status: AgreementStatus.DRAFT,
        createdBy,
      },
    });

    return { success: true, data: agreement };
  }

  async send(id: string) {
    const agreement = await this.prisma.rentalAgreement.findUnique({ where: { id } });
    if (!agreement) throw new NotFoundException('Agreement not found');
    if (agreement.status !== AgreementStatus.DRAFT) {
      throw new BadRequestException('Only DRAFT agreements can be sent');
    }

    const updated = await this.prisma.rentalAgreement.update({
      where: { id },
      data: { status: AgreementStatus.SENT },
    });

    return { success: true, data: updated };
  }

  async signByTenant(id: string) {
    const agreement = await this.prisma.rentalAgreement.findUnique({ where: { id } });
    if (!agreement) throw new NotFoundException('Agreement not found');
    if (
      agreement.status !== AgreementStatus.SENT &&
      agreement.status !== AgreementStatus.DRAFT
    ) {
      throw new BadRequestException('Agreement cannot be signed in its current status');
    }

    const now = new Date();
    const bothSigned = agreement.signedByOwnerAt !== null;

    const updated = await this.prisma.rentalAgreement.update({
      where: { id },
      data: {
        signedByTenantAt: now,
        ...(bothSigned && { status: AgreementStatus.SIGNED }),
      },
    });

    return { success: true, data: updated };
  }

  async signByOwner(id: string) {
    const agreement = await this.prisma.rentalAgreement.findUnique({ where: { id } });
    if (!agreement) throw new NotFoundException('Agreement not found');
    if (
      agreement.status !== AgreementStatus.SENT &&
      agreement.status !== AgreementStatus.DRAFT
    ) {
      throw new BadRequestException('Agreement cannot be signed in its current status');
    }

    const now = new Date();
    const bothSigned = agreement.signedByTenantAt !== null;

    const updated = await this.prisma.rentalAgreement.update({
      where: { id },
      data: {
        signedByOwnerAt: now,
        ...(bothSigned && { status: AgreementStatus.SIGNED }),
      },
    });

    return { success: true, data: updated };
  }

  async cancel(id: string) {
    const agreement = await this.prisma.rentalAgreement.findUnique({ where: { id } });
    if (!agreement) throw new NotFoundException('Agreement not found');
    if (agreement.status === AgreementStatus.CANCELLED) {
      throw new BadRequestException('Agreement is already cancelled');
    }

    const updated = await this.prisma.rentalAgreement.update({
      where: { id },
      data: { status: AgreementStatus.CANCELLED },
    });

    return { success: true, data: updated };
  }
}
