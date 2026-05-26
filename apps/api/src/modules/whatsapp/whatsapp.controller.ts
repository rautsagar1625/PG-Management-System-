import { BadRequestException, Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RentCycleStatus } from '@prisma/client';

import type { RequestContext } from '@pg-system/types';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
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

  /**
   * WA-001: Integration status — lets operators know if WhatsApp is connected
   * before they trigger a bulk reminder and get confusing silence.
   */
  @Get('status')
  @ApiOperation({
    summary: 'WhatsApp integration status',
    description: 'Returns whether Twilio credentials are configured and the from-number in use.',
  })
  getStatus() {
    return this.whatsappService.getStatus();
  }

  /**
   * WA-002: Send a test message to the calling user's own WhatsApp/phone number.
   * Lets operators verify the integration end-to-end without affecting tenants.
   */
  @Post('test')
  @ApiOperation({
    summary: 'Send a WhatsApp test message to the current user\'s phone',
    description: 'Sends a short test message to verify Twilio is configured correctly. Requires the user to have a phone number on their profile.',
  })
  async sendTest(@CurrentUser() ctx: RequestContext) {
    const user = await this.prisma.user.findUnique({
      where: { id: ctx.userId },
      select: { name: true, whatsappPhone: true, phone: true },
    });

    const phone = user?.whatsappPhone ?? user?.phone ?? null;
    if (!phone) {
      throw new BadRequestException(
        'No phone number on your profile. Add a phone number in Settings → Profile first.',
      );
    }

    await this.whatsappService.sendMessage(
      phone.startsWith('whatsapp:') ? phone : `whatsapp:${phone}`,
      `✅ Test message from PG Manager. Hi ${user?.name ?? 'there'}, your WhatsApp integration is working correctly!`,
    );

    return { success: true, data: { sentTo: phone } };
  }

  @Post('bulk-reminder')
  @ApiOperation({ summary: 'Send rent reminders to all OVERDUE tenants in a property' })
  @PropertyRoles('OWNER', 'OPERATOR', 'CO_OPERATOR')
  async bulkReminder(@Body() dto: BulkReminderDto) {
    const overdueCycles = await this.prisma.rentCycle.findMany({
      where: {
        propertyId: dto.propertyId,
        status: RentCycleStatus.OVERDUE,
      },
      include: {
        tenant: {
          include: {
            user: {
              select: { name: true, whatsappPhone: true, phone: true },
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
