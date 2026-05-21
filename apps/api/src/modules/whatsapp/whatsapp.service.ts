import { Injectable, Logger } from '@nestjs/common';
import Twilio from 'twilio';

@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger(WhatsAppService.name);
  private readonly client: ReturnType<typeof Twilio> | null;
  private readonly from: string;

  constructor() {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    this.from =
      process.env.TWILIO_WHATSAPP_FROM ?? 'whatsapp:+14155238886';

    if (accountSid && authToken) {
      this.client = Twilio(accountSid, authToken);
    } else {
      this.client = null;
      this.logger.warn('TWILIO_ACCOUNT_SID not set — WhatsApp messages will be logged only');
    }
  }

  async sendMessage(to: string, body: string): Promise<void> {
    if (!this.client) {
      this.logger.log(`[WHATSAPP] To: ${to} | Body: ${body}`);
      return;
    }
    try {
      await this.client.messages.create({ from: this.from, to, body });
    } catch (err) {
      // Log but never throw — WhatsApp failure must not break the main flow
      this.logger.error(
        `Failed to send WhatsApp message to ${to}: ${(err as Error).message}`,
      );
    }
  }

  async sendRentReminder(
    phone: string,
    tenantName: string,
    amount: number,
    dueDate: string,
    paymentLink?: string,
  ): Promise<void> {
    const amountFormatted = amount.toLocaleString('en-IN');
    let body = `Hi ${tenantName}, your rent of ₹${amountFormatted} is due on ${dueDate}. Please pay on time to avoid late fees.`;
    if (paymentLink) body += ` Pay now: ${paymentLink}`;

    const to = phone.startsWith('whatsapp:') ? phone : `whatsapp:${phone}`;
    await this.sendMessage(to, body);
  }

  async sendBulkRentReminders(
    tenants: Array<{ phone: string; name: string; amount: number; dueDate: string }>,
  ): Promise<void> {
    for (const tenant of tenants) {
      await this.sendRentReminder(tenant.phone, tenant.name, tenant.amount, tenant.dueDate);
    }
  }

  async sendPaymentConfirmation(
    phone: string,
    tenantName: string,
    amount: number,
    receiptNo: string,
  ): Promise<void> {
    const amountFormatted = amount.toLocaleString('en-IN');
    const body = `Hi ${tenantName}, your payment of ₹${amountFormatted} has been received. Receipt No: ${receiptNo}. Thank you!`;

    const to = phone.startsWith('whatsapp:') ? phone : `whatsapp:${phone}`;
    await this.sendMessage(to, body);
  }

  async sendComplaintUpdate(
    phone: string,
    tenantName: string,
    complaintTitle: string,
    status: string,
  ): Promise<void> {
    const body = `Hi ${tenantName}, your complaint "${complaintTitle}" status has been updated to: ${status}.`;

    const to = phone.startsWith('whatsapp:') ? phone : `whatsapp:${phone}`;
    await this.sendMessage(to, body);
  }
}
