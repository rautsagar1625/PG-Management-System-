import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { NotificationType } from '@prisma/client';

import {
  DOMAIN_EVENTS,
  ComplaintCreatedEvent,
  ComplaintResolvedEvent,
  PaymentRecordedEvent,
  RentOverdueEvent,
  TenantMovedInEvent,
  TenantMovedOutEvent,
  TenantNoticeCancelledEvent,
  TenantNoticeInitiatedEvent,
} from '../../events/domain-events';
import { PrismaService } from '../../database/prisma.service';
import { EmailService } from '../email/email.service';
import { PushService } from '../push/push.service';
import { NotificationsService } from './notifications.service';

@Injectable()
export class NotificationsListener {
  constructor(
    private notifications: NotificationsService,
    private email: EmailService,
    private push: PushService,
    private prisma: PrismaService,
  ) {}

  private async getUser(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, name: true, expoPushToken: true },
    });
  }

  @OnEvent(DOMAIN_EVENTS.TENANT_MOVED_IN)
  async onTenantMovedIn(evt: TenantMovedInEvent) {
    // ── Welcome notification to the new tenant ────────────────────────────────
    const title = 'Welcome! Move-in confirmed';
    const body = 'Your move-in has been confirmed. Welcome to your new home.';
    await this.notifications.send(evt.tenantUserId, title, body, NotificationType.MOVE_IN_CONFIRMED, {
      tenantId: evt.tenantId,
      propertyId: evt.propertyId,
    });
    const user = await this.getUser(evt.tenantUserId);
    await this.push.send(user?.expoPushToken, title, body);

    // NS-003: Notify existing roommates (other active tenants in the same room)
    // that a new person has moved in. Helps set expectations in shared rooms.
    // We resolve the roomId from the bedId and find all other active allocations.
    const movedInBed = await this.prisma.bed.findUnique({
      where: { id: evt.bedId },
      select: { roomId: true },
    });
    if (!movedInBed) return;

    const roommateAllocations = await this.prisma.tenantAllocation.findMany({
      where: {
        isActive: true,
        bed: { roomId: movedInBed.roomId },
        tenantId: { not: evt.tenantId }, // exclude the tenant who just moved in
      },
      select: { tenant: { select: { userId: true } } },
    });

    const rmTitle = 'New roommate moved in';
    const rmBody = 'A new tenant has moved into your room. Say hello!';

    await Promise.allSettled(
      roommateAllocations.map(async ({ tenant }) => {
        await this.notifications.send(tenant.userId, rmTitle, rmBody, NotificationType.SYSTEM, {
          propertyId: evt.propertyId,
          roomId: movedInBed.roomId,
        });
        const rmUser = await this.getUser(tenant.userId);
        await this.push.send(rmUser?.expoPushToken, rmTitle, rmBody);
      }),
    );
  }

  @OnEvent(DOMAIN_EVENTS.TENANT_MOVED_OUT)
  async onTenantMovedOut(evt: TenantMovedOutEvent) {
    const title = 'Move-out recorded';
    const body = 'Your move-out has been recorded. Thank you for staying with us.';
    await this.notifications.send(evt.tenantUserId, title, body, NotificationType.MOVE_OUT_INITIATED, {
      tenantId: evt.tenantId,
    });
    const user = await this.getUser(evt.tenantUserId);
    await this.push.send(user?.expoPushToken, title, body);
  }

  @OnEvent(DOMAIN_EVENTS.TENANT_NOTICE_INITIATED)
  async onNoticeInitiated(evt: TenantNoticeInitiatedEvent) {
    const title = 'Notice period started';
    const body = 'Your notice period has been initiated. Please complete the move-out process.';
    await this.notifications.send(evt.tenantUserId, title, body, NotificationType.SYSTEM, {
      tenantId: evt.tenantId,
    });
    const user = await this.getUser(evt.tenantUserId);
    await this.push.send(user?.expoPushToken, title, body);
  }

  @OnEvent(DOMAIN_EVENTS.TENANT_NOTICE_CANCELLED)
  async onNoticeCancelled(evt: TenantNoticeCancelledEvent) {
    const title = 'Notice period cancelled';
    const body = 'Your notice period has been cancelled. You remain an active tenant.';
    await this.notifications.send(evt.tenantUserId, title, body, NotificationType.SYSTEM, {
      tenantId: evt.tenantId,
    });
    const user = await this.getUser(evt.tenantUserId);
    await this.push.send(user?.expoPushToken, title, body);
  }

  @OnEvent(DOMAIN_EVENTS.PAYMENT_RECORDED)
  async onPaymentRecorded(evt: PaymentRecordedEvent) {
    const title = 'Payment received';
    const body = `Payment of ₹${evt.amount.toLocaleString('en-IN')} recorded. Receipt: ${evt.receiptNo}`;
    await this.notifications.send(evt.tenantUserId, title, body, NotificationType.PAYMENT_RECEIVED, {
      paymentId: evt.paymentId,
      amount: evt.amount,
      receiptNo: evt.receiptNo,
    });
    const user = await this.getUser(evt.tenantUserId);
    await this.push.send(user?.expoPushToken, title, body, { receiptNo: evt.receiptNo });
    if (user) {
      const property = await this.prisma.property.findUnique({
        where: { id: evt.propertyId },
        select: { name: true },
      });
      await this.email.sendPaymentReceipt(
        user.email,
        user.name,
        evt.amount,
        evt.receiptNo,
        property?.name ?? '',
      );
    }
  }

  @OnEvent(DOMAIN_EVENTS.RENT_OVERDUE)
  async onRentOverdue(evt: RentOverdueEvent) {
    const title = 'Rent overdue';
    const body = `Your rent of ₹${evt.amount.toLocaleString('en-IN')} for ${evt.month}/${evt.year} is overdue.`;
    await this.notifications.send(evt.tenantUserId, title, body, NotificationType.RENT_OVERDUE, {
      cycleId: evt.cycleId,
      amount: evt.amount,
    });
    const user = await this.getUser(evt.tenantUserId);
    await this.push.send(user?.expoPushToken, title, body, { cycleId: evt.cycleId });
    if (user) {
      await this.email.sendRentOverdue(user.email, user.name, evt.amount, evt.month, evt.year);
    }
  }

  @OnEvent(DOMAIN_EVENTS.COMPLAINT_CREATED)
  async onComplaintCreated(evt: ComplaintCreatedEvent) {
    // ── Notify the complaint raiser (tenant) ──────────────────────────────────
    const title = 'Complaint submitted';
    const body = `Your complaint "${evt.title}" has been submitted and will be reviewed shortly.`;
    await this.notifications.send(evt.raisedBy, title, body, NotificationType.SYSTEM, {
      complaintId: evt.complaintId,
    });
    const raiserUser = await this.getUser(evt.raisedBy);
    await this.push.send(raiserUser?.expoPushToken, title, body);

    // UX-003: Notify all OPERATOR / CO_OPERATOR / STAFF on the property so they
    // are alerted immediately without having to poll the complaints list.
    // Fire-and-forget in parallel — a notification failure must not block the handler.
    const opTitle = 'New complaint raised';
    const opBody = `"${evt.title}" — action required.`;
    const opMetadata = { complaintId: evt.complaintId, propertyId: evt.propertyId };

    const propertyStaff = await this.prisma.propertyRole.findMany({
      where: {
        propertyId: evt.propertyId,
        role: { in: ['OPERATOR', 'CO_OPERATOR', 'STAFF'] },
      },
      select: { userId: true },
    });

    await Promise.allSettled(
      propertyStaff.map(async ({ userId }) => {
        await this.notifications.send(userId, opTitle, opBody, NotificationType.SYSTEM, opMetadata);
        const staffUser = await this.getUser(userId);
        await this.push.send(staffUser?.expoPushToken, opTitle, opBody);
      }),
    );
  }

  @OnEvent(DOMAIN_EVENTS.COMPLAINT_RESOLVED)
  async onComplaintResolved(evt: ComplaintResolvedEvent) {
    if (!evt.tenantUserId) return;
    const title = 'Complaint resolved';
    const body = 'Your complaint has been marked as resolved.';
    await this.notifications.send(evt.tenantUserId, title, body, NotificationType.COMPLAINT_RESOLVED, {
      complaintId: evt.complaintId,
    });
    const user = await this.getUser(evt.tenantUserId);
    await this.push.send(user?.expoPushToken, title, body);
    if (user && evt.complaintTitle) {
      await this.email.sendComplaintUpdate(user.email, user.name, evt.complaintTitle, 'Resolved');
    }
  }
}
