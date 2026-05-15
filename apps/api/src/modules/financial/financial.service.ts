import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { FinancialModelType, Prisma } from '@prisma/client';

import { PrismaService } from '../../database/prisma.service';

export interface SetFinancialModelDto {
  type: FinancialModelType;
  fixedOwnerPayout?: number;
  ownerSharePercent?: number;
  operatorSharePercent?: number;
  effectiveFrom: string;
}

@Injectable()
export class FinancialService {
  constructor(private prisma: PrismaService) {}

  async setFinancialModel(propertyId: string, dto: SetFinancialModelDto, createdBy: string) {
    this.validateModel(dto);

    return this.prisma.$transaction(async (tx) => {
      await tx.financialModel.updateMany({
        where: { propertyId, isActive: true },
        data: { isActive: false, effectiveTo: new Date(dto.effectiveFrom) },
      });

      const model = await tx.financialModel.create({
        data: {
          propertyId,
          type: dto.type,
          fixedOwnerPayout: dto.fixedOwnerPayout ? new Prisma.Decimal(dto.fixedOwnerPayout) : null,
          ownerSharePercent: dto.ownerSharePercent ? new Prisma.Decimal(dto.ownerSharePercent) : null,
          operatorSharePercent: dto.operatorSharePercent ? new Prisma.Decimal(dto.operatorSharePercent) : null,
          effectiveFrom: new Date(dto.effectiveFrom),
          isActive: true,
          createdBy,
        },
      });

      return { success: true, data: model };
    });
  }

  async getActiveModel(propertyId: string) {
    const model = await this.prisma.financialModel.findFirst({
      where: { propertyId, isActive: true },
      orderBy: { effectiveFrom: 'desc' },
    });

    if (!model) throw new NotFoundException('No active financial model for this property');
    return { success: true, data: model };
  }

  async getModelHistory(propertyId: string) {
    const models = await this.prisma.financialModel.findMany({
      where: { propertyId },
      orderBy: { effectiveFrom: 'desc' },
    });
    return { success: true, data: models };
  }

  private validateModel(dto: SetFinancialModelDto) {
    if (dto.type === 'FIXED_PAYOUT' && !dto.fixedOwnerPayout) {
      throw new BadRequestException('fixedOwnerPayout is required for FIXED_PAYOUT model');
    }
    if (dto.type === 'REVENUE_SHARE') {
      if (dto.ownerSharePercent === undefined || dto.operatorSharePercent === undefined) {
        throw new BadRequestException(
          'ownerSharePercent and operatorSharePercent are required for REVENUE_SHARE',
        );
      }
      if (dto.ownerSharePercent + dto.operatorSharePercent !== 100) {
        throw new BadRequestException('Share percentages must sum to 100');
      }
    }
  }
}
