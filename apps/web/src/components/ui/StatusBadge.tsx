import { Badge, type BadgeVariant } from './Badge';

// ── Tenant Status ────────────────────────────────────────────────────
const tenantStatusMap: Record<string, { label: string; variant: BadgeVariant }> = {
  LEAD: { label: 'Lead', variant: 'purple' },
  VISIT_SCHEDULED: { label: 'Visit Scheduled', variant: 'info' },
  VISITED: { label: 'Visited', variant: 'cyan' },
  ROOM_FINALIZED: { label: 'Room Finalized', variant: 'cyan' },
  DEPOSIT_PENDING: { label: 'Deposit Pending', variant: 'warning' },
  KYC_PENDING: { label: 'KYC Pending', variant: 'orange' },
  ACTIVE: { label: 'Active', variant: 'success' },
  NOTICE_PERIOD: { label: 'Notice Period', variant: 'error' },
  MOVED_OUT: { label: 'Moved Out', variant: 'default' },
  REJECTED: { label: 'Rejected', variant: 'default' },
};

// ── Rent Cycle Status ────────────────────────────────────────────────
const rentStatusMap: Record<string, { label: string; variant: BadgeVariant }> = {
  PENDING: { label: 'Pending', variant: 'info' },
  DUE: { label: 'Due', variant: 'warning' },
  PARTIAL: { label: 'Partial', variant: 'orange' },
  PAID: { label: 'Paid', variant: 'success' },
  OVERDUE: { label: 'Overdue', variant: 'error' },
  WAIVED: { label: 'Waived', variant: 'default' },
};

// ── Room Status ──────────────────────────────────────────────────────
const roomStatusMap: Record<string, { label: string; variant: BadgeVariant }> = {
  AVAILABLE: { label: 'Available', variant: 'success' },
  PARTIALLY_OCCUPIED: { label: 'Partial', variant: 'warning' },
  FULLY_OCCUPIED: { label: 'Full', variant: 'error' },
  UNDER_MAINTENANCE: { label: 'Maintenance', variant: 'default' },
  INACTIVE: { label: 'Inactive', variant: 'default' },
};

// ── Bed Status ───────────────────────────────────────────────────────
const bedStatusMap: Record<string, { label: string; variant: BadgeVariant }> = {
  AVAILABLE: { label: 'Available', variant: 'success' },
  OCCUPIED: { label: 'Occupied', variant: 'error' },
  RESERVED: { label: 'Reserved', variant: 'warning' },
  UNDER_MAINTENANCE: { label: 'Maintenance', variant: 'default' },
};

// ── Property Status ──────────────────────────────────────────────────
const propertyStatusMap: Record<string, { label: string; variant: BadgeVariant }> = {
  SETUP: { label: 'Setup', variant: 'warning' },
  ACTIVE: { label: 'Active', variant: 'success' },
  INACTIVE: { label: 'Inactive', variant: 'default' },
};

// ── Property Type ────────────────────────────────────────────────────
const propertyTypeMap: Record<string, { label: string; variant: BadgeVariant }> = {
  MALE: { label: 'Male', variant: 'info' },
  FEMALE: { label: 'Female', variant: 'purple' },
  MIXED: { label: 'Mixed', variant: 'cyan' },
};

// ── KYC Status ───────────────────────────────────────────────────────
const kycStatusMap: Record<string, { label: string; variant: BadgeVariant }> = {
  PENDING: { label: 'KYC Pending', variant: 'warning' },
  SUBMITTED: { label: 'KYC Submitted', variant: 'info' },
  VERIFIED: { label: 'KYC Verified', variant: 'success' },
  REJECTED: { label: 'KYC Rejected', variant: 'error' },
};

function StatusBadgeBase({
  status,
  map,
}: {
  status: string;
  map: Record<string, { label: string; variant: BadgeVariant }>;
}) {
  const entry = map[status] ?? { label: status, variant: 'default' as BadgeVariant };
  return <Badge variant={entry.variant}>{entry.label}</Badge>;
}

export function TenantStatusBadge({ status }: { status: string }) {
  return <StatusBadgeBase status={status} map={tenantStatusMap} />;
}

export function RentStatusBadge({ status }: { status: string }) {
  return <StatusBadgeBase status={status} map={rentStatusMap} />;
}

export function RoomStatusBadge({ status }: { status: string }) {
  return <StatusBadgeBase status={status} map={roomStatusMap} />;
}

export function BedStatusBadge({ status }: { status: string }) {
  return <StatusBadgeBase status={status} map={bedStatusMap} />;
}

export function PropertyStatusBadge({ status }: { status: string }) {
  return <StatusBadgeBase status={status} map={propertyStatusMap} />;
}

export function PropertyTypeBadge({ type }: { type: string }) {
  return <StatusBadgeBase status={type} map={propertyTypeMap} />;
}

export function KycStatusBadge({ status }: { status: string }) {
  return <StatusBadgeBase status={status} map={kycStatusMap} />;
}
