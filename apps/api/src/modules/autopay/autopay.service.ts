import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { MandateStatus } from '@prisma/client';
import Razorpay from 'razorpay';

import { PrismaService } from '../../database/prisma.service';

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
  private razorpay: Razorpay | null;

  constructor(private prisma: PrismaService) {
    const keyId = process.env.RAZORPAY_KEY_ID;
    this.razorpay = keyId
      ? new Razorpay({
          key_id: keyId,
          key_secret: process.env.RAZORPAY_KEY_SECRET ?? '',
        })
      : null;
  }

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

    // If Razorpay is configured, generate a mandate registration link via subscription
    let mandateLink: string | undefined;
    if (this.razorpay) {
      try {
        const planId = process.env.RAZORPAY_PLAN_ID ?? 'plan_placeholder';
        const sub = await this.razorpay.subscriptions.create({
          plan_id: planId,
          total_count: 120,
          quantity: 1,
          customer_notify: 1,
          notes: { mandateId: mandate.id, propertyId: dto.propertyId },
        });

        mandateLink = (sub as { short_url?: string }).short_url;

        // Update externalId with Razorpay subscription ID
        await this.prisma.autopayMandate.update({
          where: { id: mandate.id },
          data: { externalId: sub.id, status: MandateStatus.PENDING },
        });
      } catch (err) {
        // Non-fatal — mandate created in DB, Razorpay link generation failed
        console.error('Razorpay mandate creation failed:', err);
      }
    }

    return { success: true, data: { ...mandate, mandateLink } };
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

  async verifyWebhook(payload: string, signature: string): Promise<void> {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET ?? '';
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const crypto = await import('crypto');
    const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
    if (expected !== signature) {
      throw new BadRequestException('Invalid webhook signature');
    }
  }

  async handleWebhook(payload: Record<string, unknown>): Promise<void> {
    const event = payload.event as string | undefined;
    if (!event) return;

    const subscriptionPayload = (payload.payload as Record<string, unknown> | undefined)
      ?.subscription as Record<string, unknown> | undefined;
    const entity = subscriptionPayload?.entity as Record<string, unknown> | undefined;
    const externalId = entity?.id as string | undefined;

    if (!externalId) return;

    const mandate = await this.prisma.autopayMandate.findFirst({
      where: { externalId },
    });

    if (!mandate) return;

    const now = new Date();

    switch (event) {
      case 'subscription.activated':
        await this.prisma.autopayMandate.update({
          where: { id: mandate.id },
          data: { status: MandateStatus.ACTIVE, activatedAt: now },
        });
        break;

      case 'subscription.cancelled':
        await this.prisma.autopayMandate.update({
          where: { id: mandate.id },
          data: { status: MandateStatus.CANCELLED, cancelledAt: now },
        });
        break;

      case 'subscription.halted':
        await this.prisma.autopayMandate.update({
          where: { id: mandate.id },
          data: { status: MandateStatus.PAUSED },
        });
        break;

      default:
        // Unhandled event — log and ignore
        console.log(`Unhandled Razorpay webhook event: ${event}`);
    }
  }

  async createPaymentOrder(tenantId: string, amount: number, propertyId: string) {
    if (!this.razorpay) {
      throw new BadRequestException('Razorpay not configured');
    }

    const order = await this.razorpay.orders.create({
      amount: Math.round(amount * 100), // convert to paise
      currency: 'INR',
      receipt: `rent_${tenantId}_${Date.now()}`,
      notes: { tenantId, propertyId },
    });

    return {
      success: true,
      data: {
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        keyId: process.env.RAZORPAY_KEY_ID,
      },
    };
  }
}
