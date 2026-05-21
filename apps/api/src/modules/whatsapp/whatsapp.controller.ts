import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RentCycleStatus } from '@prisma/client';

import { PropertyRoles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PrismaService } from '../../database/prisma.service';
import { WhatsAppService } from './whatsapp.service';

export interface BulkReminderDto {
  propertyId: string;
  message?: string;
}

@ApiTags('WhatsApp')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('whatsapp')
export class WhatsAppController {
  constructor(
    private whatsappService: WhatsAppService,
    private prisma: PrismaService,
  ) {}

  @Post('bulk-reminder')
  @ApiOperation({ summary: 'Send rent reminders to all OVERDUE tenants in a property' })
  @PropertyRoles('OWNER', 'OPERATOR', 'CO_OPERATOR')
  async bulkReminder(@Body() dto: BulkReminderDto) {
    // Fetch all OVERDUE rent cycles for the property, with tenant user info
    const overdueCycles = await this.prisma.rentCycle.findMany({
      where: {
        propertyId: dto.propertyId,
        status: RentCycleStatus.OVERDUE,
      },
      include: {
        tenant: {
          include: {
            user: {
              select: {
                name: true,
                whatsappPhone: true,
                phone: true,
              },
            },
          },
        },
      },
    });

    const sent: string[] = [];
    const skipped: string[] = [];

    for (const cycle of overdueCycles) {
      const phone =
        cycle.tenant.user.whatsappPhone ?? cycle.tenant.user.phone ?? null;

      if (!phone) {
        skipped.push(cycle.tenantId);
        continue;
      }

      const dueDate = cycle.dueDate.toISOString().split('T')[0] ?? '';
      const remaining = Number(cycle.remainingAmount);

      await this.whatsappService.sendRentReminder(
        phone,
        cycle.tenant.user.name ?? 'Tenant',
        remaining,
        dueDate,
        dto.message,
      );

      sent.push(cycle.tenantId);
    }

    return {
      success: true,
      data: {
        totalOverdue: overdueCycles.length,
        sent: sent.length,
        skipped: skipped.length,
        skippedTenantIds: skipped,
      },
    };
  }
}
