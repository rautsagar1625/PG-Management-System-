'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Phone,
  Mail,
  BedDouble,
  Calendar,
  FileText,
  CreditCard,
  AlertTriangle,
  LogOut,
  ArrowRightLeft,
  CheckCircle2,
  Clock,
  IndianRupee,
} from 'lucide-react';
import {
  getTenant,
  scheduleVisit,
  markVisited,
  initiateNotice,
  moveOut,
  roomTransfer,
  type TenantDetail,
  type TenantComplaint,
  type MoveOutDto,
  type RoomTransferDto,
} from '@/lib/tenants-api';
import { getRooms } from '@/lib/rooms-api';
import { TenantStatusBadge, KycStatusBadge, RentStatusBadge } from '@/components/ui/StatusBadge';
import { Modal } from '@/components/ui/Modal';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { PageLoader } from '@/components/ui/LoadingSpinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input, FormField } from '@/components/ui/FormField';
import { type BedInfo } from '@/components/ui/BedGrid';
import { cn, formatDate, formatCurrency, getInitials } from '@/lib/utils';

type Tab = 'overview' | 'rent' | 'payments' | 'history';

export default function TenantDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();

  const [tab, setTab] = useState<Tab>('overview');
  const [modal, setModal] = useState<
    | null
    | { type: 'scheduleVisit' }
    | { type: 'notice' }
    | { type: 'moveOut' }
    | { type: 'transfer' }
  >(null);

  const { data: tenant, isLoading, error } = useQuery({
    queryKey: ['tenant', id],
    queryFn: () => getTenant(id),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['tenant', id] });

  const markVisitedMut = useMutation({
    mutationFn: () => markVisited(id),
    onSuccess: invalidate,
  });

  const initiateNoticeMut = useMutation({
    mutationFn: () => initiateNotice(id),
    onSuccess: () => { invalidate(); setModal(null); },
  });

  if (isLoading) return <PageLoader />;
  if (error || !tenant) {
    return (
      <EmptyState
        icon={AlertTriangle}
        title="Tenant not found"
        description="This tenant does not exist or you don't have access."
        action={
          <button onClick={() => router.back()} className="btn-secondary text-sm">
            Go Back
          </button>
        }
      />
    );
  }

  const activeAlloc = tenant.allocations.find((a) => a.isActive);
  const monthlyRent = activeAlloc?.monthlyRent ?? 0;

  return (
    <div className="space-y-5">
      {/* Back */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        All Tenants
      </button>

      {/* Profile Header */}
      <div className="card p-5">
        <div className="flex flex-wrap items-start gap-4">
          {/* Avatar */}
          <div className="w-14 h-14 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-bold text-lg shrink-0">
            {getInitials(tenant.user.name)}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2.5 mb-1">
              <h1 className="text-xl font-bold text-gray-900">{tenant.user.name}</h1>
              <span className="text-xs font-mono text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                {tenant.tenantCode}
              </span>
              <TenantStatusBadge status={tenant.status} />
            </div>

            <div className="flex flex-wrap gap-4 text-sm text-gray-500">
              {tenant.user.phone && (
                <span className="flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5" /> {tenant.user.phone}
                </span>
              )}
              {tenant.user.email && (
                <span className="flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5" /> {tenant.user.email}
                </span>
              )}
              {tenant.leadSource && (
                <span className="text-xs bg-gray-100 px-2 py-0.5 rounded text-gray-600">
                  via {tenant.leadSource}
                </span>
              )}
            </div>

            {/* Key dates */}
            <div className="flex flex-wrap gap-4 mt-2 text-xs text-gray-400">
              {tenant.moveInDate && (
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> Moved in {formatDate(tenant.moveInDate)}
                </span>
              )}
              {tenant.visitScheduledAt && !tenant.moveInDate && (
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" /> Visit {formatDate(tenant.visitScheduledAt)}
                </span>
              )}
              {tenant.noticeDate && (
                <span className="flex items-center gap-1 text-red-400">
                  <AlertTriangle className="w-3 h-3" /> Notice from {formatDate(tenant.noticeDate)}
                </span>
              )}
              {tenant.moveOutDate && (
                <span className="flex items-center gap-1">
                  <LogOut className="w-3 h-3" /> Moved out {formatDate(tenant.moveOutDate)}
                </span>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <WorkflowActions
            tenant={tenant}
            onMarkVisited={() => markVisitedMut.mutate()}
            markVisitedLoading={markVisitedMut.isPending}
            onScheduleVisit={() => setModal({ type: 'scheduleVisit' })}
            onInitiateNotice={() => setModal({ type: 'notice' })}
            onMoveOut={() => setModal({ type: 'moveOut' })}
            onTransfer={() => setModal({ type: 'transfer' })}
          />
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard
          label="Current Room"
          value={activeAlloc ? `${activeAlloc.bed.room.number} — Bed ${activeAlloc.bed.label}` : '—'}
          icon={BedDouble}
          iconClass="text-blue-500"
        />
        <StatCard
          label="Monthly Rent"
          value={monthlyRent ? formatCurrency(monthlyRent) : '—'}
          icon={IndianRupee}
          iconClass="text-green-500"
        />
        <StatCard
          label="Deposit"
          value={formatCurrency(Number(tenant.depositAmount))}
          subValue={`Status: ${tenant.depositStatus.replace('_', ' ')}`}
          icon={CreditCard}
          iconClass={tenant.depositStatus === 'PAID' ? 'text-green-500' : 'text-yellow-500'}
        />
        <StatCard
          label="KYC"
          value={<KycStatusBadge status={tenant.kycStatus} />}
          icon={FileText}
          iconClass="text-purple-500"
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {(['overview', 'rent', 'payments', 'history'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px capitalize',
              tab === t
                ? 'border-primary-600 text-primary-700'
                : 'border-transparent text-gray-500 hover:text-gray-700',
            )}
          >
            {t === 'history' ? 'Allocations' : t === 'rent' ? 'Rent Cycles' : t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {tab === 'overview' && <OverviewTab tenant={tenant} />}
      {tab === 'rent' && <RentCyclesTab tenant={tenant} />}
      {tab === 'payments' && <PaymentsTab tenant={tenant} />}
      {tab === 'history' && <AllocationHistoryTab tenant={tenant} />}

      {/* Modals */}
      {modal?.type === 'scheduleVisit' && (
        <ScheduleVisitModal
          tenantId={id}
          onClose={() => setModal(null)}
          onSuccess={invalidate}
        />
      )}

      <ConfirmModal
        isOpen={modal?.type === 'notice'}
        onClose={() => setModal(null)}
        onConfirm={() => initiateNoticeMut.mutate()}
        isLoading={initiateNoticeMut.isPending}
        title="Initiate Notice Period"
        message={`This will start the notice period for ${tenant.user.name}. They will be marked as leaving. Confirm?`}
        confirmLabel="Start Notice"
        variant="danger"
      />

      {modal?.type === 'moveOut' && (
        <MoveOutModal
          tenant={tenant}
          onClose={() => setModal(null)}
          onSuccess={() => {
            invalidate();
            setModal(null);
          }}
        />
      )}

      {modal?.type === 'transfer' && (
        <RoomTransferModal
          tenant={tenant}
          onClose={() => setModal(null)}
          onSuccess={() => {
            invalidate();
            setModal(null);
          }}
        />
      )}
    </div>
  );
}

// ── Workflow Action Buttons ──────────────────────────────────────────────────

function WorkflowActions({
  tenant,
  onMarkVisited,
  markVisitedLoading,
  onScheduleVisit,
  onInitiateNotice,
  onMoveOut,
  onTransfer,
}: {
  tenant: TenantDetail;
  onMarkVisited: () => void;
  markVisitedLoading: boolean;
  onScheduleVisit: () => void;
  onInitiateNotice: () => void;
  onMoveOut: () => void;
  onTransfer: () => void;
}) {
  const { status } = tenant;
  const router = useRouter();

  const actions: React.ReactNode[] = [];

  if (status === 'LEAD') {
    actions.push(
      <button key="visit" onClick={onScheduleVisit} className="btn-primary text-sm flex items-center gap-1.5">
        <Calendar className="w-4 h-4" /> Schedule Visit
      </button>,
    );
  }

  if (status === 'VISIT_SCHEDULED') {
    actions.push(
      <button
        key="visited"
        onClick={onMarkVisited}
        disabled={markVisitedLoading}
        className="btn-primary text-sm flex items-center gap-1.5 disabled:opacity-50"
      >
        <CheckCircle2 className="w-4 h-4" />
        {markVisitedLoading ? 'Updating...' : 'Mark Visited'}
      </button>,
    );
  }

  if (status === 'VISITED' || status === 'ROOM_FINALIZED' || status === 'DEPOSIT_PENDING' || status === 'KYC_PENDING') {
    actions.push(
      <button
        key="onboard"
        onClick={() => router.push(`/dashboard/tenants/new?continueId=${tenant.id}`)}
        className="btn-primary text-sm flex items-center gap-1.5"
      >
        <ArrowRightLeft className="w-4 h-4" /> Continue Onboarding
      </button>,
    );
  }

  if (status === 'ACTIVE') {
    actions.push(
      <button key="transfer" onClick={onTransfer} className="btn-secondary text-sm flex items-center gap-1.5">
        <ArrowRightLeft className="w-4 h-4" /> Transfer Room
      </button>,
      <button
        key="notice"
        onClick={onInitiateNotice}
        className="text-sm flex items-center gap-1.5 px-4 py-2 rounded-lg font-medium border border-orange-200 text-orange-600 bg-white hover:bg-orange-50 transition-colors"
      >
        <AlertTriangle className="w-4 h-4" /> Initiate Notice
      </button>,
    );
  }

  if (status === 'NOTICE_PERIOD') {
    actions.push(
      <button
        key="moveout"
        onClick={onMoveOut}
        className="text-sm flex items-center gap-1.5 px-4 py-2 rounded-lg font-medium border border-red-200 text-red-600 bg-white hover:bg-red-50 transition-colors"
      >
        <LogOut className="w-4 h-4" /> Move Out
      </button>,
    );
  }

  if (actions.length === 0) return null;

  return <div className="flex flex-wrap gap-2 shrink-0">{actions}</div>;
}

// ── Stat Card ───────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  subValue,
  icon: Icon,
  iconClass,
}: {
  label: string;
  value: React.ReactNode;
  subValue?: string;
  icon: React.ComponentType<{ className?: string }>;
  iconClass?: string;
}) {
  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 mb-1.5">
        <Icon className={`w-4 h-4 ${iconClass}`} />
        <span className="text-xs text-gray-500 font-medium">{label}</span>
      </div>
      <div className="text-sm font-semibold text-gray-900">{value}</div>
      {subValue && <p className="text-xs text-gray-400 mt-0.5">{subValue}</p>}
    </div>
  );
}

// ── Overview Tab ─────────────────────────────────────────────────────────────

function OverviewTab({ tenant }: { tenant: TenantDetail }) {
  const activeAlloc = tenant.allocations.find((a) => a.isActive);
  const openComplaints = tenant.complaints ?? [];

  return (
    <div className="space-y-4">
      {/* Current Allocation */}
      {activeAlloc && (
        <div className="card p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Current Accommodation</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <div>
              <p className="text-xs text-gray-400">Room</p>
              <p className="font-medium text-gray-900">{activeAlloc.bed.room.number}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Bed</p>
              <p className="font-medium text-gray-900">{activeAlloc.bed.label}</p>
            </div>
            {activeAlloc.bed.room.floor !== null && (
              <div>
                <p className="text-xs text-gray-400">Floor</p>
                <p className="font-medium text-gray-900">{activeAlloc.bed.room.floor}</p>
              </div>
            )}
            <div>
              <p className="text-xs text-gray-400">Monthly Rent</p>
              <p className="font-medium text-gray-900">{formatCurrency(Number(activeAlloc.monthlyRent))}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Since</p>
              <p className="font-medium text-gray-900">{formatDate(activeAlloc.startDate)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Reason</p>
              <p className="font-medium text-gray-900 capitalize">{activeAlloc.reason.toLowerCase()}</p>
            </div>
          </div>
        </div>
      )}

      {/* Emergency Contacts */}
      {tenant.emergencyContacts?.length > 0 && (
        <div className="card p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Emergency Contacts</h3>
          <div className="space-y-2">
            {tenant.emergencyContacts.map((c) => (
              <div key={c.id} className="flex items-center justify-between text-sm">
                <div>
                  <span className="font-medium text-gray-800">{c.name}</span>
                  <span className="text-gray-400 ml-2 text-xs">({c.relation})</span>
                </div>
                <span className="text-gray-600">{c.phone}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Open Complaints */}
      {openComplaints.length > 0 && (
        <div className="card p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-orange-500" />
            Open Complaints ({openComplaints.length})
          </h3>
          <div className="space-y-2">
            {openComplaints.map((c: TenantComplaint) => (
              <div key={c.id} className="flex items-center justify-between text-sm">
                <span className="text-gray-700">{c.title}</span>
                <span className="text-xs text-orange-600 bg-orange-50 px-2 py-0.5 rounded">
                  {c.status.replace('_', ' ')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Notes */}
      {tenant.notes && (
        <div className="card p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Notes</h3>
          <p className="text-sm text-gray-600 whitespace-pre-wrap">{tenant.notes}</p>
        </div>
      )}
    </div>
  );
}

// ── Rent Cycles Tab ──────────────────────────────────────────────────────────

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function RentCyclesTab({ tenant }: { tenant: TenantDetail }) {
  if (!tenant.rentCycles?.length) {
    return (
      <div className="card">
        <EmptyState icon={CreditCard} title="No rent cycles" description="Rent cycles will appear once the tenant is active." />
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Period</th>
            <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Due Date</th>
            <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">Rent</th>
            <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">Paid</th>
            <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">Balance</th>
            <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {tenant.rentCycles.map((rc) => (
            <tr key={rc.id} className="hover:bg-gray-50 transition-colors">
              <td className="px-4 py-3 font-medium text-gray-900">
                {MONTHS[(rc.month - 1) % 12]} {rc.year}
              </td>
              <td className="px-4 py-3 text-gray-500">{formatDate(rc.dueDate)}</td>
              <td className="px-4 py-3 text-right text-gray-700">{formatCurrency(Number(rc.rentAmount))}</td>
              <td className="px-4 py-3 text-right text-green-600 font-medium">{formatCurrency(Number(rc.paidAmount))}</td>
              <td className="px-4 py-3 text-right">
                <span className={Number(rc.remainingAmount) > 0 ? 'text-red-600 font-medium' : 'text-gray-400'}>
                  {formatCurrency(Number(rc.remainingAmount))}
                </span>
              </td>
              <td className="px-4 py-3">
                <RentStatusBadge status={rc.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Payments Tab ─────────────────────────────────────────────────────────────

const PAYMENT_TYPE_LABELS: Record<string, string> = {
  RENT: 'Rent',
  DEPOSIT: 'Deposit',
  DEPOSIT_ADJUSTMENT: 'Deposit Adj.',
  FINE: 'Fine',
  MISCELLANEOUS: 'Misc',
};

function PaymentsTab({ tenant }: { tenant: TenantDetail }) {
  if (!tenant.payments?.length) {
    return (
      <div className="card">
        <EmptyState icon={CreditCard} title="No payments" description="Payments will appear once recorded." />
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Date</th>
            <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Type</th>
            <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Method</th>
            <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">Amount</th>
            <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Receipt</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {tenant.payments.map((p) => (
            <tr key={p.id} className="hover:bg-gray-50 transition-colors">
              <td className="px-4 py-3 text-gray-600">{formatDate(p.paidAt)}</td>
              <td className="px-4 py-3 text-gray-700">{PAYMENT_TYPE_LABELS[p.type] ?? p.type}</td>
              <td className="px-4 py-3 text-gray-500 capitalize">{p.method.toLowerCase().replace('_', ' ')}</td>
              <td className="px-4 py-3 text-right font-medium text-gray-900">{formatCurrency(Number(p.amount))}</td>
              <td className="px-4 py-3">
                {p.receipt ? (
                  <span className="text-xs font-mono text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                    {p.receipt.receiptNo}
                  </span>
                ) : (
                  <span className="text-gray-300">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Allocation History Tab ────────────────────────────────────────────────────

function AllocationHistoryTab({ tenant }: { tenant: TenantDetail }) {
  if (!tenant.allocations?.length) {
    return (
      <div className="card">
        <EmptyState icon={BedDouble} title="No allocation history" description="Allocations will appear after move-in." />
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Room / Bed</th>
            <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">From</th>
            <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">To</th>
            <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">Rent</th>
            <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Reason</th>
            <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {tenant.allocations.map((a) => (
            <tr key={a.id} className="hover:bg-gray-50 transition-colors">
              <td className="px-4 py-3 font-medium text-gray-900">
                {a.bed.room.number} — Bed {a.bed.label}
              </td>
              <td className="px-4 py-3 text-gray-600">{formatDate(a.startDate)}</td>
              <td className="px-4 py-3 text-gray-500">{a.endDate ? formatDate(a.endDate) : '—'}</td>
              <td className="px-4 py-3 text-right text-gray-700">{formatCurrency(Number(a.monthlyRent))}</td>
              <td className="px-4 py-3 capitalize text-gray-500">{a.reason.toLowerCase()}</td>
              <td className="px-4 py-3">
                {a.isActive ? (
                  <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded-full">Active</span>
                ) : (
                  <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">Closed</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Schedule Visit Modal ──────────────────────────────────────────────────────

function ScheduleVisitModal({
  tenantId,
  onClose,
  onSuccess,
}: {
  tenantId: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [visitDate, setVisitDate] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    if (!visitDate) { setError('Visit date is required'); return; }
    setLoading(true);
    setError('');
    try {
      await scheduleVisit(tenantId, visitDate, notes || undefined);
      onSuccess();
      onClose();
    } catch {
      setError('Failed to schedule visit. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen title="Schedule Visit" onClose={onClose} size="sm">
      <div className="p-5 space-y-4">
        <FormField label="Visit Date" error={error}>
          <Input
            type="datetime-local"
            value={visitDate}
            onChange={(e) => setVisitDate(e.target.value)}
            min={new Date().toISOString().slice(0, 16)}
          />
        </FormField>
        <FormField label="Notes (optional)">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="input-field text-sm resize-none"
            rows={2}
            placeholder="Any special requirements..."
          />
        </FormField>
        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="btn-secondary text-sm flex-1">Cancel</button>
          <button onClick={submit} disabled={loading} className="btn-primary text-sm flex-1 disabled:opacity-50">
            {loading ? 'Scheduling...' : 'Schedule Visit'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ── Move Out Modal ────────────────────────────────────────────────────────────

function MoveOutModal({
  tenant,
  onClose,
  onSuccess,
}: {
  tenant: TenantDetail;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [form, setForm] = useState<MoveOutDto>({
    moveOutDate: new Date().toISOString().split('T')[0]!,
    depositRefundAmount: 0,
    depositForfeitAmount: 0,
    notes: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const depositPaid = Number(tenant.depositBalance);

  const submit = async () => {
    if (!form.moveOutDate) { setError('Move-out date is required'); return; }
    setLoading(true);
    setError('');
    try {
      await moveOut(tenant.id, {
        ...form,
        depositRefundAmount: Number(form.depositRefundAmount ?? 0),
        depositForfeitAmount: Number(form.depositForfeitAmount ?? 0),
      });
      onSuccess();
    } catch {
      setError('Failed to process move-out. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen title="Move Out" onClose={onClose} size="sm">
      <div className="p-5 space-y-4">
        <FormField label="Move-out Date" error={error}>
          <Input
            type="date"
            value={form.moveOutDate}
            onChange={(e) => setForm((f) => ({ ...f, moveOutDate: e.target.value }))}
          />
        </FormField>

        {depositPaid > 0 && (
          <>
            <div className="bg-gray-50 rounded-lg p-3 text-sm">
              <p className="text-gray-500">Deposit on record: <span className="font-semibold text-gray-800">{formatCurrency(depositPaid)}</span></p>
            </div>
            <FormField label="Deposit Refund Amount">
              <Input
                type="number"
                value={form.depositRefundAmount}
                onChange={(e) => setForm((f) => ({ ...f, depositRefundAmount: Number(e.target.value) }))}
                placeholder="0"
                min={0}
                max={depositPaid}
              />
            </FormField>
            <FormField label="Deposit Forfeited Amount">
              <Input
                type="number"
                value={form.depositForfeitAmount}
                onChange={(e) => setForm((f) => ({ ...f, depositForfeitAmount: Number(e.target.value) }))}
                placeholder="0"
                min={0}
                max={depositPaid}
              />
            </FormField>
          </>
        )}

        <FormField label="Notes (optional)">
          <textarea
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            className="input-field text-sm resize-none"
            rows={2}
            placeholder="Reason for move-out, condition notes..."
          />
        </FormField>

        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="btn-secondary text-sm flex-1">Cancel</button>
          <button
            onClick={submit}
            disabled={loading}
            className="text-sm flex-1 px-4 py-2 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Processing...' : 'Confirm Move Out'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ── Room Transfer Modal ───────────────────────────────────────────────────────

function RoomTransferModal({
  tenant,
  onClose,
  onSuccess,
}: {
  tenant: TenantDetail;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [selectedBedId, setSelectedBedId] = useState('');
  const [transferDate, setTransferDate] = useState(new Date().toISOString().split('T')[0]!);
  const [newRent, setNewRent] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const activeAlloc = tenant.allocations.find((a) => a.isActive);
  const currentBedId = activeAlloc?.bedId;

  const { data: rooms = [], isLoading: roomsLoading } = useQuery({
    queryKey: ['rooms', tenant.propertyId],
    queryFn: () => getRooms(tenant.propertyId),
  });

  const availableBeds: BedInfo[] = rooms.flatMap((r) =>
    r.beds
      .filter((b) => b.status === 'AVAILABLE' && b.id !== currentBedId)
      .map((b) => ({
        id: b.id,
        label: `${r.number} — Bed ${b.label}`,
        status: b.status,
        monthlyRent: b.monthlyRent ?? r.monthlyRent,
      })),
  );

  const submit = async () => {
    if (!selectedBedId) { setError('Please select a bed'); return; }
    if (!transferDate) { setError('Transfer date is required'); return; }
    setLoading(true);
    setError('');
    const dto: RoomTransferDto = {
      newBedId: selectedBedId,
      transferDate,
      ...(newRent ? { newMonthlyRent: Number(newRent) } : {}),
      ...(notes ? { notes } : {}),
    };
    try {
      await roomTransfer(tenant.id, dto);
      onSuccess();
    } catch {
      setError('Transfer failed. The bed may no longer be available.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen title="Transfer Room" onClose={onClose} size="md">
      <div className="p-5 space-y-4">
        {error && (
          <div className="bg-red-50 text-red-700 text-sm rounded-lg px-3 py-2">{error}</div>
        )}

        <div className="bg-blue-50 rounded-lg p-3 text-sm text-blue-700">
          Moving from: <strong>{activeAlloc ? `Room ${activeAlloc.bed.room.number} — Bed ${activeAlloc.bed.label}` : 'current bed'}</strong>
        </div>

        <FormField label="Transfer Date">
          <Input
            type="date"
            value={transferDate}
            onChange={(e) => setTransferDate(e.target.value)}
          />
        </FormField>

        <FormField label="Select New Bed" hint={roomsLoading ? 'Loading beds...' : `${availableBeds.length} available`}>
          {roomsLoading ? (
            <div className="h-10 bg-gray-100 rounded-lg animate-pulse" />
          ) : availableBeds.length === 0 ? (
            <div className="text-sm text-gray-500 bg-gray-50 rounded-lg p-3">No available beds in this property.</div>
          ) : (
            <div className="border border-gray-200 rounded-lg overflow-hidden max-h-48 overflow-y-auto divide-y divide-gray-100">
              {availableBeds.map((bed) => (
                <button
                  key={bed.id}
                  onClick={() => setSelectedBedId(bed.id)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 text-sm transition-colors ${
                    selectedBedId === bed.id
                      ? 'bg-primary-50 text-primary-700'
                      : 'hover:bg-gray-50 text-gray-700'
                  }`}
                >
                  <span className="font-medium">{bed.label}</span>
                  {bed.monthlyRent && (
                    <span className="text-xs text-gray-400">{formatCurrency(bed.monthlyRent)}/mo</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </FormField>

        <FormField label="New Monthly Rent (optional)" hint={activeAlloc ? `Current: ${formatCurrency(Number(activeAlloc.monthlyRent))}` : undefined}>
          <Input
            type="number"
            value={newRent}
            onChange={(e) => setNewRent(e.target.value)}
            placeholder="Leave blank to keep current rent"
            min={0}
          />
        </FormField>

        <FormField label="Notes (optional)">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="input-field text-sm resize-none"
            rows={2}
            placeholder="Reason for transfer..."
          />
        </FormField>

        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="btn-secondary text-sm flex-1">Cancel</button>
          <button
            onClick={submit}
            disabled={loading || !selectedBedId}
            className="btn-primary text-sm flex-1 disabled:opacity-50"
          >
            {loading ? 'Transferring...' : 'Confirm Transfer'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
