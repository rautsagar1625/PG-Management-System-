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
  ShieldCheck,
  Trash2,
  Plus,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  getTenant,
  scheduleVisit,
  markVisited,
  initiateNotice,
  moveOut,
  getMoveOutPreview,
  roomTransfer,
  type TenantDetail,
  type TenantComplaint,
  type MoveOutDto,
  type MoveOutPreview,
  type RoomTransferDto,
} from '@/lib/tenants-api';
import { getRooms } from '@/lib/rooms-api';
import {
  getDocuments,
  addDocument,
  verifyDocument,
  deleteDocument,
  type KycDocument,
  type DocumentType,
  DOC_TYPE_LABELS,
} from '@/lib/kyc-api';
import {
  getAgreementsByTenant,
  createAgreement,
  sendAgreement,
  signAgreementByTenant,
  signAgreementByOwner,
  cancelAgreement,
  AGREEMENT_STATUS_LABELS,
  AGREEMENT_STATUS_STYLES,
  type RentalAgreement,
} from '@/lib/agreements-api';
import { TenantStatusBadge, KycStatusBadge, RentStatusBadge } from '@/components/ui/StatusBadge';
import { Modal } from '@/components/ui/Modal';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { PageLoader } from '@/components/ui/LoadingSpinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input, FormField } from '@/components/ui/FormField';
import { type BedInfo } from '@/components/ui/BedGrid';
import { cn, formatDate, formatCurrency, getInitials } from '@/lib/utils';

type Tab = 'overview' | 'rent' | 'payments' | 'history' | 'kyc' | 'agreements';

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
      <div className="flex gap-1 border-b border-gray-200 overflow-x-auto">
        {(['overview', 'rent', 'payments', 'history', 'kyc', 'agreements'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px whitespace-nowrap',
              tab === t
                ? 'border-primary-600 text-primary-700'
                : 'border-transparent text-gray-500 hover:text-gray-700',
            )}
          >
            {t === 'history' ? 'Allocations' : t === 'rent' ? 'Rent Cycles' : t === 'kyc' ? 'KYC Docs' : t === 'agreements' ? 'Agreements' : t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {tab === 'overview' && <OverviewTab tenant={tenant} />}
      {tab === 'rent' && <RentCyclesTab tenant={tenant} />}
      {tab === 'payments' && <PaymentsTab tenant={tenant} />}
      {tab === 'history' && <AllocationHistoryTab tenant={tenant} />}
      {tab === 'kyc' && <KycTab tenant={tenant} />}
      {tab === 'agreements' && <AgreementsTab tenant={tenant} />}

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
  const [step, setStep] = useState<'preview' | 'confirm'>('preview');
  const [preview, setPreview] = useState<MoveOutPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState('');
  const [form, setForm] = useState<MoveOutDto>({
    moveOutDate: new Date().toISOString().split('T')[0]!,
    depositRefundAmount: 0,
    depositForfeitAmount: 0,
    notes: '',
  });
  const [submitLoading, setSubmitLoading] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const loadPreview = async () => {
    if (!form.moveOutDate) { setPreviewError('Move-out date is required'); return; }
    setPreviewLoading(true);
    setPreviewError('');
    try {
      const data = await getMoveOutPreview(tenant.id);
      setPreview(data);
      // Pre-fill refund with estimated amount
      setForm((f) => ({
        ...f,
        depositRefundAmount: data.estimatedRefund > 0 ? data.estimatedRefund : 0,
        depositForfeitAmount: data.depositBalance - (data.estimatedRefund > 0 ? data.estimatedRefund : 0),
      }));
      setStep('confirm');
    } catch {
      setPreviewError('Failed to load preview. Please try again.');
    } finally {
      setPreviewLoading(false);
    }
  };

  const submit = async () => {
    setSubmitLoading(true);
    setSubmitError('');
    try {
      await moveOut(tenant.id, {
        ...form,
        depositRefundAmount: Number(form.depositRefundAmount ?? 0),
        depositForfeitAmount: Number(form.depositForfeitAmount ?? 0),
      });
      onSuccess();
    } catch {
      setSubmitError('Failed to process move-out. Please try again.');
    } finally {
      setSubmitLoading(false);
    }
  };

  return (
    <Modal isOpen title={step === 'preview' ? 'Move Out — Set Date' : 'Move Out — Confirm Settlement'} onClose={onClose} size="sm">
      <div className="p-5 space-y-4">

        {/* Step 1: Date & Notes */}
        {step === 'preview' && (
          <>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
              <p className="font-medium">Moving out: {tenant.user.name}</p>
              <p className="text-xs mt-0.5 text-amber-600">This will release their bed and generate a final settlement.</p>
            </div>

            <FormField label="Move-out Date">
              <Input
                type="date"
                value={form.moveOutDate}
                onChange={(e) => { setForm((f) => ({ ...f, moveOutDate: e.target.value })); setPreviewError(''); }}
              />
            </FormField>

            <FormField label="Notes (optional)">
              <textarea
                value={form.notes ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                className="input-field text-sm resize-none"
                rows={2}
                placeholder="Reason, property condition notes..."
              />
            </FormField>

            {previewError && (
              <p className="text-xs text-red-500">{previewError}</p>
            )}

            <div className="flex gap-2 pt-1">
              <button onClick={onClose} className="btn-secondary text-sm flex-1">Cancel</button>
              <button
                onClick={loadPreview}
                disabled={previewLoading}
                className="btn-primary text-sm flex-1 disabled:opacity-50"
              >
                {previewLoading ? 'Loading…' : 'Preview Settlement →'}
              </button>
            </div>
          </>
        )}

        {/* Step 2: Financial Preview + Confirm */}
        {step === 'confirm' && preview && (
          <>
            {/* Financial Summary */}
            <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
              <p className="font-semibold text-gray-700 mb-3">Settlement Summary</p>

              {preview.pendingRentCycles.length > 0 && (
                <div className="space-y-1 mb-2">
                  <p className="text-xs text-gray-500 font-medium">Pending Rent Dues</p>
                  {preview.pendingRentCycles.map((c) => (
                    <div key={c.id} className="flex justify-between text-xs">
                      <span className="text-gray-600">{new Date(c.year, c.month - 1).toLocaleString('en-IN', { month: 'short', year: 'numeric' })}</span>
                      <span className="text-red-600 font-medium">-{formatCurrency(c.remainingAmount)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between text-xs border-t border-gray-200 pt-1 mt-1">
                    <span className="font-medium text-gray-700">Total Pending</span>
                    <span className="font-bold text-red-600">-{formatCurrency(preview.totalPendingRent)}</span>
                  </div>
                </div>
              )}

              <div className="flex justify-between">
                <span className="text-gray-600">Security Deposit</span>
                <span className="font-medium text-gray-800">{formatCurrency(preview.depositBalance)}</span>
              </div>
              <div className="flex justify-between border-t border-gray-200 pt-2 mt-1">
                <span className="font-semibold text-gray-800">Estimated Refund</span>
                <span className={`font-bold text-lg ${preview.estimatedRefund >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(Math.abs(preview.estimatedRefund))}
                  {preview.estimatedRefund < 0 && ' (due from tenant)'}
                </span>
              </div>
            </div>

            {/* Editable refund / forfeiture */}
            <FormField label="Actual Refund Amount (₹)">
              <Input
                type="number"
                value={form.depositRefundAmount}
                onChange={(e) => setForm((f) => ({ ...f, depositRefundAmount: Number(e.target.value) }))}
                min={0}
                max={preview.depositBalance}
              />
            </FormField>
            <FormField label="Deposit Forfeited (₹)">
              <Input
                type="number"
                value={form.depositForfeitAmount}
                onChange={(e) => setForm((f) => ({ ...f, depositForfeitAmount: Number(e.target.value) }))}
                min={0}
                max={preview.depositBalance}
              />
            </FormField>

            {submitError && (
              <p className="text-xs text-red-500">{submitError}</p>
            )}

            <div className="flex gap-2 pt-1">
              <button onClick={() => setStep('preview')} className="btn-secondary text-sm flex-1">← Back</button>
              <button
                onClick={submit}
                disabled={submitLoading}
                className="text-sm flex-1 px-4 py-2 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {submitLoading ? 'Processing…' : 'Confirm Move Out'}
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

// ── KYC Tab ───────────────────────────────────────────────────────────────────

const DOC_TYPES: DocumentType[] = ['AADHAAR', 'PAN', 'PASSPORT', 'DRIVING_LICENSE', 'VOTER_ID'];

function KycTab({ tenant }: { tenant: TenantDetail }) {
  const qc = useQueryClient();
  const tenantId = tenant.id;
  const [showAdd, setShowAdd] = useState(false);
  const [docType, setDocType] = useState<DocumentType>('AADHAAR');
  const [docNumber, setDocNumber] = useState('');
  const [fileUrl, setFileUrl] = useState('');
  const [addError, setAddError] = useState('');

  const { data: docs = [], isLoading } = useQuery({
    queryKey: ['kyc-docs', tenantId],
    queryFn: () => getDocuments(tenantId),
  });

  const addMut = useMutation({
    mutationFn: () =>
      addDocument({ tenantId, type: docType, documentNumber: docNumber, ...(fileUrl ? { fileUrl } : {}) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['kyc-docs', tenantId] });
      qc.invalidateQueries({ queryKey: ['tenant', tenantId] });
      setShowAdd(false);
      setDocNumber('');
      setFileUrl('');
      toast.success('Document added');
    },
    onError: () => toast.error('Failed to add document'),
  });

  const verifyMut = useMutation({
    mutationFn: (docId: string) => verifyDocument(docId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['kyc-docs', tenantId] });
      qc.invalidateQueries({ queryKey: ['tenant', tenantId] });
      toast.success('Document verified');
    },
    onError: () => toast.error('Failed to verify'),
  });

  const deleteMut = useMutation({
    mutationFn: (docId: string) => deleteDocument(docId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['kyc-docs', tenantId] });
      toast.success('Document removed');
    },
    onError: () => toast.error('Failed to delete'),
  });

  const handleAdd = () => {
    if (!docNumber.trim()) { setAddError('Document number is required'); return; }
    setAddError('');
    addMut.mutate();
  };

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-purple-500" />
            KYC Documents
          </h3>
          <button
            onClick={() => setShowAdd((v) => !v)}
            className="btn-primary text-xs flex items-center gap-1.5 px-3 py-1.5"
          >
            <Plus className="w-3.5 h-3.5" /> Add Document
          </button>
        </div>

        {showAdd && (
          <div className="bg-gray-50 rounded-xl p-4 mb-4 space-y-3 border border-gray-200">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                Document Type
              </label>
              <select
                value={docType}
                onChange={(e) => setDocType(e.target.value as DocumentType)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
              >
                {DOC_TYPES.map((t) => (
                  <option key={t} value={t}>{DOC_TYPE_LABELS[t]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                Document Number
              </label>
              <input
                type="text"
                value={docNumber}
                onChange={(e) => { setDocNumber(e.target.value); setAddError(''); }}
                placeholder="e.g. 1234 5678 9012"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
              />
              {addError && <p className="text-xs text-red-500 mt-1">{addError}</p>}
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                File URL (optional)
              </label>
              <input
                type="url"
                value={fileUrl}
                onChange={(e) => setFileUrl(e.target.value)}
                placeholder="https://drive.google.com/..."
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
              />
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={() => setShowAdd(false)} className="btn-secondary text-xs flex-1 py-1.5">
                Cancel
              </button>
              <button
                onClick={handleAdd}
                disabled={addMut.isPending}
                className="btn-primary text-xs flex-1 py-1.5 disabled:opacity-50"
              >
                {addMut.isPending ? 'Saving...' : 'Save Document'}
              </button>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="py-6 flex justify-center">
            <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : docs.length === 0 ? (
          <div className="py-8 text-center">
            <ShieldCheck className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-500">No documents uploaded yet.</p>
            <p className="text-xs text-gray-400 mt-1">Add an Aadhaar, PAN, or other ID to complete KYC.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {docs.map((doc: KycDocument) => (
              <div
                key={doc.id}
                className="flex items-center justify-between rounded-xl border border-gray-100 px-4 py-3 hover:bg-gray-50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-gray-800">{DOC_TYPE_LABELS[doc.type]}</span>
                    {doc.verifiedAt ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
                        <ShieldCheck className="w-3 h-3" /> Verified
                      </span>
                    ) : (
                      <span className="text-xs font-medium text-yellow-700 bg-yellow-50 px-2 py-0.5 rounded-full">
                        Pending
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5 font-mono">{doc.documentNumber}</p>
                  {doc.verifiedAt && (
                    <p className="text-xs text-gray-400 mt-0.5">Verified {formatDate(doc.verifiedAt)}</p>
                  )}
                </div>
                <div className="flex items-center gap-3 shrink-0 ml-3">
                  {doc.fileUrl && (
                    <a
                      href={doc.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                    >
                      View
                    </a>
                  )}
                  {!doc.verifiedAt && (
                    <button
                      onClick={() => verifyMut.mutate(doc.id)}
                      disabled={verifyMut.isPending}
                      className="text-xs font-medium text-green-600 hover:text-green-800 transition-colors disabled:opacity-50"
                    >
                      Verify
                    </button>
                  )}
                  <button
                    onClick={() => deleteMut.mutate(doc.id)}
                    disabled={deleteMut.isPending}
                    className="p-1 text-gray-300 hover:text-red-500 transition-colors disabled:opacity-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Agreements Tab ────────────────────────────────────────────────────────────

function AgreementsTab({ tenant }: { tenant: TenantDetail }) {
  const qc = useQueryClient();
  const tenantId = tenant.id;
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({
    rentAmount: '',
    depositAmount: '',
    startDate: new Date().toISOString().split('T')[0]!,
    endDate: '',
    terms: 'Standard rental agreement terms apply. Tenant agrees to abide by all property rules.',
  });
  const [formError, setFormError] = useState('');

  const { data: agreements = [], isLoading } = useQuery({
    queryKey: ['agreements', tenantId],
    queryFn: () => getAgreementsByTenant(tenantId),
  });

  const createMut = useMutation({
    mutationFn: () =>
      createAgreement({
        tenantId,
        propertyId: tenant.propertyId,
        rentAmount: Number(form.rentAmount),
        depositAmount: Number(form.depositAmount),
        startDate: form.startDate,
        endDate: form.endDate || undefined,
        terms: form.terms,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agreements', tenantId] });
      setShowNew(false);
      setForm((f) => ({ ...f, rentAmount: '', depositAmount: '', endDate: '' }));
      toast.success('Agreement created as draft');
    },
    onError: () => toast.error('Failed to create agreement'),
  });

  const sendMut = useMutation({
    mutationFn: sendAgreement,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['agreements', tenantId] }); toast.success('Agreement sent to tenant'); },
    onError: () => toast.error('Failed to send agreement'),
  });

  const signTenantMut = useMutation({
    mutationFn: signAgreementByTenant,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['agreements', tenantId] }); toast.success('Signed by tenant'); },
    onError: () => toast.error('Failed to mark tenant signature'),
  });

  const signOwnerMut = useMutation({
    mutationFn: signAgreementByOwner,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['agreements', tenantId] }); toast.success('Signed by owner'); },
    onError: () => toast.error('Failed to mark owner signature'),
  });

  const cancelMut = useMutation({
    mutationFn: cancelAgreement,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['agreements', tenantId] }); toast.success('Agreement cancelled'); },
    onError: () => toast.error('Failed to cancel agreement'),
  });

  function handleCreate() {
    if (!form.rentAmount || !form.depositAmount || !form.startDate) {
      setFormError('Rent amount, deposit, and start date are required');
      return;
    }
    setFormError('');
    createMut.mutate();
  }

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <FileText className="w-4 h-4 text-indigo-500" />
            Rental Agreements
          </h3>
          {!showNew && (
            <button
              onClick={() => setShowNew(true)}
              className="btn-primary text-xs flex items-center gap-1.5 px-3 py-1.5"
            >
              <Plus className="w-3.5 h-3.5" /> New Agreement
            </button>
          )}
        </div>

        {/* New Agreement Form */}
        {showNew && (
          <div className="bg-gray-50 rounded-xl p-4 mb-4 space-y-3 border border-gray-200">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">New Rental Agreement (Draft)</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Monthly Rent (₹)</label>
                <input
                  type="number"
                  value={form.rentAmount}
                  onChange={(e) => { setForm((f) => ({ ...f, rentAmount: e.target.value })); setFormError(''); }}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
                  placeholder="e.g. 8000"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Security Deposit (₹)</label>
                <input
                  type="number"
                  value={form.depositAmount}
                  onChange={(e) => setForm((f) => ({ ...f, depositAmount: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
                  placeholder="e.g. 16000"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Start Date</label>
                <input
                  type="date"
                  value={form.startDate}
                  onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">End Date (optional)</label>
                <input
                  type="date"
                  value={form.endDate}
                  onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Agreement Terms</label>
              <textarea
                value={form.terms}
                onChange={(e) => setForm((f) => ({ ...f, terms: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 resize-none"
                rows={3}
              />
            </div>
            {formError && <p className="text-xs text-red-500">{formError}</p>}
            <div className="flex gap-2 pt-1">
              <button onClick={() => { setShowNew(false); setFormError(''); }} className="btn-secondary text-xs flex-1 py-1.5">
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={createMut.isPending}
                className="btn-primary text-xs flex-1 py-1.5 disabled:opacity-50"
              >
                {createMut.isPending ? 'Creating…' : 'Create Draft'}
              </button>
            </div>
          </div>
        )}

        {/* Agreement List */}
        {isLoading ? (
          <div className="py-6 flex justify-center">
            <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : agreements.length === 0 ? (
          <div className="py-8 text-center">
            <FileText className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-500">No agreements created yet.</p>
            <p className="text-xs text-gray-400 mt-1">Create a draft agreement to get started.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {agreements.map((ag: RentalAgreement) => (
              <div
                key={ag.id}
                className="border border-gray-100 rounded-xl p-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-gray-800">
                        {formatCurrency(ag.rentAmount)}/mo
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${AGREEMENT_STATUS_STYLES[ag.status]}`}>
                        {AGREEMENT_STATUS_LABELS[ag.status]}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {formatDate(ag.startDate)}{ag.endDate ? ` → ${formatDate(ag.endDate)}` : ' · Open-ended'} ·
                      Deposit: {formatCurrency(ag.depositAmount)}
                    </p>
                  </div>
                </div>

                {/* Signature status */}
                <div className="flex gap-3 text-xs text-gray-500 mb-3">
                  <span className={ag.signedByTenantAt ? 'text-green-600' : 'text-gray-400'}>
                    {ag.signedByTenantAt ? `✓ Tenant signed ${formatDate(ag.signedByTenantAt)}` : '○ Tenant unsigned'}
                  </span>
                  <span className={ag.signedByOwnerAt ? 'text-green-600' : 'text-gray-400'}>
                    {ag.signedByOwnerAt ? `✓ Owner signed ${formatDate(ag.signedByOwnerAt)}` : '○ Owner unsigned'}
                  </span>
                </div>

                {/* Action buttons per status */}
                <div className="flex flex-wrap gap-2">
                  {ag.status === 'DRAFT' && (
                    <button
                      onClick={() => sendMut.mutate(ag.id)}
                      disabled={sendMut.isPending}
                      className="text-xs bg-blue-50 text-blue-700 hover:bg-blue-100 px-3 py-1 rounded-lg font-medium transition-colors disabled:opacity-50"
                    >
                      Send to Tenant
                    </button>
                  )}
                  {(ag.status === 'DRAFT' || ag.status === 'SENT') && !ag.signedByTenantAt && (
                    <button
                      onClick={() => signTenantMut.mutate(ag.id)}
                      disabled={signTenantMut.isPending}
                      className="text-xs bg-purple-50 text-purple-700 hover:bg-purple-100 px-3 py-1 rounded-lg font-medium transition-colors disabled:opacity-50"
                    >
                      Mark Tenant Signed
                    </button>
                  )}
                  {(ag.status === 'DRAFT' || ag.status === 'SENT') && !ag.signedByOwnerAt && (
                    <button
                      onClick={() => signOwnerMut.mutate(ag.id)}
                      disabled={signOwnerMut.isPending}
                      className="text-xs bg-green-50 text-green-700 hover:bg-green-100 px-3 py-1 rounded-lg font-medium transition-colors disabled:opacity-50"
                    >
                      Mark Owner Signed
                    </button>
                  )}
                  {ag.status !== 'CANCELLED' && ag.status !== 'SIGNED' && (
                    <button
                      onClick={() => cancelMut.mutate(ag.id)}
                      disabled={cancelMut.isPending}
                      className="text-xs text-red-500 hover:text-red-700 hover:bg-red-50 px-3 py-1 rounded-lg font-medium transition-colors disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
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
        monthlyRent: b.monthlyRent ?? r.baseRent,
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
