import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly resend: Resend | null;
  private readonly from: string;
  private readonly appUrl: string;

  constructor(private config: ConfigService) {
    const apiKey = config.get<string>('RESEND_API_KEY');
    this.resend = apiKey ? new Resend(apiKey) : null;
    this.from = config.get<string>('EMAIL_FROM', 'PG System <noreply@pgmanagement.in>');
    this.appUrl = config.get<string>('APP_URL', 'http://localhost:3000');

    if (!apiKey) {
      this.logger.warn('RESEND_API_KEY not set — emails will be logged only');
    }
  }

  async sendPasswordReset(to: string, name: string, token: string): Promise<void> {
    const resetUrl = `${this.appUrl}/auth/reset-password?token=${token}`;
    const subject = 'Reset your password — PG System';
    const html = `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px">
        <h2 style="color:#1f2937;margin-bottom:8px">Reset your password</h2>
        <p style="color:#6b7280;margin-bottom:24px">Hi ${name}, we received a request to reset your password.</p>
        <a href="${resetUrl}"
           style="display:inline-block;background:#4f46e5;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">
          Reset Password
        </a>
        <p style="color:#9ca3af;font-size:13px;margin-top:24px">
          This link expires in 1 hour. If you didn't request this, you can ignore this email.
        </p>
      </div>`;
    await this.send(to, subject, html);
  }

  async sendPaymentReceipt(
    to: string,
    name: string,
    amount: number,
    receiptNo: string,
    propertyName: string,
  ): Promise<void> {
    const subject = `Payment receipt ₹${amount.toLocaleString('en-IN')} — ${receiptNo}`;
    const html = `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px">
        <h2 style="color:#1f2937;margin-bottom:8px">Payment received ✓</h2>
        <p style="color:#6b7280">Hi ${name}, your payment has been recorded.</p>
        <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin:20px 0">
          <p style="margin:4px 0;color:#374151"><strong>Amount:</strong> ₹${amount.toLocaleString('en-IN')}</p>
          <p style="margin:4px 0;color:#374151"><strong>Receipt No:</strong> ${receiptNo}</p>
          <p style="margin:4px 0;color:#374151"><strong>Property:</strong> ${propertyName}</p>
        </div>
        <p style="color:#9ca3af;font-size:13px">Keep this email as your payment record.</p>
      </div>`;
    await this.send(to, subject, html);
  }

  async sendRentOverdue(
    to: string,
    name: string,
    amount: number,
    month: number,
    year: number,
  ): Promise<void> {
    const monthName = new Date(year, month - 1).toLocaleString('en-IN', { month: 'long' });
    const subject = `Rent overdue — ${monthName} ${year}`;
    const html = `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px">
        <h2 style="color:#dc2626;margin-bottom:8px">Rent overdue</h2>
        <p style="color:#6b7280">Hi ${name}, your rent payment is overdue.</p>
        <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:16px;margin:20px 0">
          <p style="margin:4px 0;color:#374151"><strong>Amount due:</strong> ₹${amount.toLocaleString('en-IN')}</p>
          <p style="margin:4px 0;color:#374151"><strong>For:</strong> ${monthName} ${year}</p>
        </div>
        <p style="color:#6b7280">Please pay immediately to avoid further action. Contact your PG operator if you have any questions.</p>
      </div>`;
    await this.send(to, subject, html);
  }

  async sendComplaintUpdate(
    to: string,
    name: string,
    title: string,
    status: string,
  ): Promise<void> {
    const subject = `Complaint update — ${title}`;
    const html = `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px">
        <h2 style="color:#1f2937;margin-bottom:8px">Complaint updated</h2>
        <p style="color:#6b7280">Hi ${name}, your complaint status has been updated.</p>
        <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin:20px 0">
          <p style="margin:4px 0;color:#374151"><strong>Complaint:</strong> ${title}</p>
          <p style="margin:4px 0;color:#374151"><strong>New Status:</strong> ${status}</p>
        </div>
      </div>`;
    await this.send(to, subject, html);
  }

  private async send(to: string, subject: string, html: string): Promise<void> {
    if (!this.resend) {
      this.logger.log(`[EMAIL] To: ${to} | Subject: ${subject}`);
      return;
    }
    try {
      await this.resend.emails.send({ from: this.from, to, subject, html });
    } catch (err) {
      // Log but never throw — email failure must not break the main flow
      this.logger.error(`Failed to send email to ${to}: ${(err as Error).message}`);
    }
  }
}
