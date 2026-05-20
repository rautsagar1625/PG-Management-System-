/**
 * Typed domain event payloads.
 *
 * All events carry the minimum data listeners need to act without further DB lookups.
 * Add fields to payloads conservatively — only what is consistently available at emit time.
 */

export const DOMAIN_EVENTS = {
  // ── Tenant lifecycle ──────────────────────────────────────────────────
  TENANT_MOVED_IN:        'tenant.moved_in',
  TENANT_MOVED_OUT:       'tenant.moved_out',
  TENANT_TRANSFERRED:     'tenant.transferred',
  TENANT_NOTICE_INITIATED:'tenant.notice_initiated',
  TENANT_NOTICE_CANCELLED:'tenant.notice_cancelled',

  // ── Financial ─────────────────────────────────────────────────────────
  PAYMENT_RECORDED:       'payment.recorded',
  RENT_OVERDUE:           'rent.overdue',

  // ── Complaints ────────────────────────────────────────────────────────
  COMPLAINT_CREATED:      'complaint.created',
  COMPLAINT_STATUS_CHANGED:'complaint.status_changed',
  COMPLAINT_RESOLVED:     'complaint.resolved',
} as const;

export type DomainEventKey = keyof typeof DOMAIN_EVENTS;
export type DomainEventName = (typeof DOMAIN_EVENTS)[DomainEventKey];

// ── Payload types ─────────────────────────────────────────────────────────

export interface TenantMovedInEvent {
  tenantId: string;
  tenantUserId: string;
  propertyId: string;
  bedId: string;
}

export interface TenantMovedOutEvent {
  tenantId: string;
  tenantUserId: string;
  propertyId: string;
  moveOutDate: Date;
}

export interface TenantTransferredEvent {
  tenantId: string;
  tenantUserId: string;
  propertyId: string;
  fromBedId: string;
  toBedId: string;
  transferReason?: string;
}

export interface TenantNoticeInitiatedEvent {
  tenantId: string;
  tenantUserId: string;
  propertyId: string;
}

export interface TenantNoticeCancelledEvent {
  tenantId: string;
  tenantUserId: string;
  propertyId: string;
}

export interface PaymentRecordedEvent {
  paymentId: string;
  tenantId: string;
  tenantUserId: string;
  propertyId: string;
  amount: number;
  type: string;
  receiptNo: string;
}

export interface RentOverdueEvent {
  tenantId: string;
  tenantUserId: string;
  propertyId: string;
  cycleId: string;
  amount: number;
  month: number;
  year: number;
}

export interface ComplaintCreatedEvent {
  complaintId: string;
  propertyId: string;
  tenantId?: string;
  raisedBy: string;
  title: string;
}

export interface ComplaintStatusChangedEvent {
  complaintId: string;
  propertyId: string;
  fromStatus: string;
  toStatus: string;
  updatedBy: string;
}

export interface ComplaintResolvedEvent {
  complaintId: string;
  propertyId: string;
  tenantId?: string;
  tenantUserId?: string;
  complaintTitle?: string;
}
