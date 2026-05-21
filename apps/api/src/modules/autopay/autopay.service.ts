import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { MandateStatus } from '@prisma/client';

import { PrismaService } from '../../database/prisma.service';

// NOTE: Razorpay e-NACH integration plugs in here via externalId.
// When a mandate is created, call Razorpay's API to register the mandate
// and store the returned mandate ID in externalId. Webhook callbacks from
// Razorpay should call PUT /autopay/:id/status to sync mandate state.

export interface CreateAutopayMandateDto {
  tenantId: string;
  propertyId: string;
  amount: number;
  bankAccount?: string;
  ifscCode?: string;
  accountName?: string;
  debitDay?: number;
}

export interface UpdateMandateStatusDto {
  status: MandateStatus;
  externalId?: string;
  failureReason?: string;
}

@Injectable()
export class AutopayService {
  constructor(private prisma: PrismaService) {}

  async findByProperty(propertyId: string) {
    const mandates = await this.prisma.autopayMandate.findMany({
      where: { propertyId },
      take: 500,
      include: {
        tenant: {
          include: { user: { select: { id: true, name: true, phone: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return { success: true, data: mandates };
  }

  async findByTenant(tenantId: string) {
    const mandates = await this.prisma.autopayMandate.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });

    return { success: true, data: mandates };
  }

  async create(dto: CreateAutopayMandateDto) {
    // Validate debitDay is within 1–28
    if (dto.debitDay !== undefined && (dto.debitDay < 1 || dto.debitDay > 28)) {
      throw new BadRequestException('debitDay must be between 1 and 28');
    }

    const mandate = await this.prisma.autopayMandate.create({
      data: {
        tenantId: dto.tenantId,
        propertyId: dto.propertyId,
        amount: dto.amount,
        bankAccount: dto.bankAccount,
        ifscCode: dto.ifscCode,
        accountName: dto.accountName,
        debitDay: dto.debitDay ?? 1,
        status: MandateStatus.CREATED,
      },
    });

    return { success: true, data: mandate };
  }

  async updateStatus(id: string, dto: UpdateMandateStatusDto) {
    const mandate = await this.prisma.autopayMandate.findUnique({ where: { id } });
    if (!mandate) throw new NotFoundException('Autopay mandate not found');

    const now = new Date();
    const updated = await this.prisma.autopayMandate.update({
      where: { id },
      data: {
        status: dto.status,
        ...(dto.externalId && { externalId: dto.externalId }),
        ...(dto.failureReason !== undefined && { failureReason: dto.failureReason }),
        ...(dto.status === MandateStatus.ACTIVE && { activatedAt: now }),
        ...(dto.status === MandateStatus.CANCELLED && { cancelledAt: now }),
      },
    });

    return { success: true, data: updated };
  }

  async cancel(id: string) {
    const mandate = await this.prisma.autopayMandate.findUnique({ where: { id } });
    if (!mandate) throw new NotFoundException('Autopay mandate not found');

    if (mandate.status === MandateStatus.CANCELLED) {
      throw new BadRequestException('Mandate is already cancelled');
    }

    const updated = await this.prisma.autopayMandate.update({
      where: { id },
      data: {
        status: MandateStatus.CANCELLED,
        cancelledAt: new Date(),
      },
    });

    return { success: true, data: updated };
  }
}
