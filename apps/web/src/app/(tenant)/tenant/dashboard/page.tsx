'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  IndianRupee,
  AlertCircle,
  CheckCircle2,
  Clock,
  LogOut,
  BedDouble,
  Building2,
  FileText,
  MessageSquare,
  ChevronRight,
  Send,
  ShieldCheck,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';

// ── Types matching actual GET /tenant-self/dashboard response ──────────────────

interface TenantSelfDashboard {
  tenant: {
    id: string;
    tenantCode: string;
    status: string;
    monthlyRent: number | null;
    depositBalance: number;
    user: { name: string; email: string; phone?: string };
  };
  allocation: {
    room: { roomNumber: string; floor?: number };
    bed: { label: string };
    property: { name: string; address?: string; city: string };
    startDate: string;
  } | null;
  currentCycle: {
    id: string;           // ← used as rentCycleId for payment
    month: number;
    year: number;
    expectedRent: number;
    paidAmount: number;
    remainingAmount: number;
    status: string;
    dueDate: string;
  } | null;
}

interface RentHistoryEntry {
  id: string;
  amount: number;
  type: string;
  method: string;
  paidAt: string;
  receipt?: { receiptNo: string };
}

interface TenantComplaint {
  id: string;
  title: string;
  status: string;
  category: string;
  createdAt: string;
}

interface RazorpayOrder {
  orderId: string;
  amount: number;
  currency: string;
  keyId: string;
}

// ── API helpers ────────────────────────────────────────────────────────────────

async function getTenantSelfDashboard(): Promise<TenantSelfDashboard> {
  const { data } = await apiClient.get<{ success: boolean; data: TenantSelfDashboard }>(
    '/tenant-self/dashboard',
  );
  return data.data;
}

async function getRentHistory(): Promise<RentHistoryEntry[]> {
  const { data } = await apiClient.get<{
    success: boolean;
    data: { items: RentHistoryEntry[]; hasMore: boolean };
  }>('/tenant-self/rent-history?limit=5');
  return data.data.items;
}

async function getTenantComplaints(): Promise<TenantComplaint[]> {
  const { data } = await apiClient.get<{ success: boolean; data: TenantComplaint[] }>(
    '/tenant-self/complaints',
  );
  return data.data;
}

async function createComplaint(dto: {
  title: string;
  description: string;
  category: string;
  priority: string;
}) {
  const { data } = await apiClient.post<{ success: boolean; data: TenantComplaint }>(
    '/tenant-self/complaints',
    dto,
  );
  return data.data;
}

async function createPaymentOrder(rentCycleId: string, amount: number): Promise<RazorpayOrder> {
  const { data } = await apiClient.post<{ success: boolean; data: RazorpayOrder }>(
    '/tenant-self/pay/create-order',
    { rentCycleId, amount },
  );
  return data.data;
}

function handleLogout(router: ReturnType<typeof useRouter>) {
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
  document.cookie = 'pg_session=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
  router.push('/login');
}

// ── Status helpers ─────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; bg: string; icon: React.ReactNode }
> = {
  PAID:    { label: 'Paid',    color: 'text-green-700',  bg: 'bg-green-50 border-green-200',   icon: <CheckCircle2 className="w-5 h-5 text-green-600" /> },
  PENDING: { label: 'Pending', color: 'text-yellow-700', bg: 'bg-yellow-50 border-yellow-200', icon: <Clock className="w-5 h-5 text-yellow-500" /> },
  PARTIAL: { label: 'Partial', color: 'text-blue-700',   bg: 'bg-blue-50 border-blue-200',     icon: <Clock className="w-5 h-5 text-blue-500" /> },
  OVERDUE: { label: 'Overdue', color: 'text-red-700',    bg: 'bg-red-50 border-red-200',       icon: <AlertCircle className="w-5 h-5 text-red-600" /> },
  DUE:     { label: 'Due',     color: 'text-orange-700', bg: 'bg-orange-50 border-orange-200', icon: <AlertCircle className="w-5 h-5 text-orange-500" /> },
  WAIVED:  { label: 'Waived',  color: 'text-gray-600',   bg: 'bg-gray-50 border-gray-200',     icon: <CheckCircle2 className="w-5 h-5 text-gray-400" /> },
};

const COMPLAINT_STATUS_COLOR: Record<string, string> = {
  OPEN:        'bg-red-100 text-red-700',
  ASSIGNED:    'bg-yellow-100 text-yellow-700',
  IN_PROGRESS: 'bg-blue-100 text-blue-700',
  RESOLVED:    'bg-green-100 text-green-700',
  CLOSED:      'bg-gray-100 text-gray-600',
  REJECTED:    'bg-gray-100 text-gray-500',
};

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function TenantDashboardPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [showComplaintForm, setShowComplaintForm] = useState(false);

  const { data: dashboard, isLoading, isError } = useQuery({
    queryKey: ['tenant-self-dashboard'],
    queryFn: getTenantSelfDashboard,
  });

  const { data: rentHistory = [] } = useQuery({
    queryKey: ['tenant-rent-history'],
    queryFn: getRentHistory,
    enabled: !!dashboard,
  });

  const { data: complaints = [] } = useQuery({
    queryKey: ['tenant-complaints'],
    queryFn: getTenantComplaints,
  });

  const complaintMutation = useMutation({
    mutationFn: createComplaint,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tenant-complaints'] });
      setShowComplaintForm(false);
      toast.success('Complaint raised successfully');
    },
    onError: () => toast.error('Failed to raise complaint'),
  });

  const payMutation = useMutation({
    mutationFn: () =>
      createPaymentOrder(dashboard!.currentCycle!.id, dashboard!.currentCycle!.remainingAmount),
    onSuccess: (order) => {
      const params = new URLSearchParams({
        key:          order.keyId,
        amount:       String(order.amount),
        currency:     order.currency,
        order_id:     order.orderId,
        name:         'PG Manager',
        description:  `Rent — ${dashboard?.allocation?.property.name ?? ''}`,
        prefill_name: dashboard?.tenant.user.name ?? '',
        callback_url: `${window.location.origin}/tenant/payment-success`,
        cancel_url:   window.location.href,
      });
      window.location.href = `https://api.razorpay.com/v1/checkout/embedded?${params.toString()}`;
    },
    onError: () => toast.error('Could not initiate payment. Please try again.'),
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (isError || !dashboard) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto" />
          <p className="text-gray-600">Could not load your dashboard. Please try again.</p>
          <button
            onClick={() => qc.invalidateQueries({ queryKey: ['tenant-self-dashboard'] })}
            className="text-sm text-primary-600 underline"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const { tenant, allocation, currentCycle } = dashboard;
  const rentStatus = currentCycle
    ? (STATUS_CONFIG[currentCycle.status] ?? STATUS_CONFIG['PENDING']!)
    : null;
  const canPay =
    currentCycle && ['PENDING', 'PARTIAL', 'DUE', 'OVERDUE'].includes(currentCycle.status);

  return (
    <div className="max-w-lg mx-auto px-4 py-6 space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">Welcome back</p>
          <h1 className="text-xl font-bold text-gray-900">{tenant.user.name}</h1>
        </div>
        <button
          onClick={() => handleLogout(router)}
          className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Sign out
        </button>
      </div>

      {/* Room info card */}
      <div className="bg-primary-600 rounded-2xl p-5 text-white">
        {allocation ? (
          <>
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-primary-100 text-xs font-medium">
                  <Building2 className="w-3.5 h-3.5" />
                  {allocation.property.name} · {allocation.property.city}
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <BedDouble className="w-5 h-5 text-primary-200" />
                  <div>
                    <p className="font-bold text-lg leading-none">
                      Room {allocation.room.roomNumber} · Bed {allocation.bed.label}
                    </p>
                    {tenant.monthlyRent && (
                      <p className="text-primary-200 text-xs mt-0.5">
                        {formatCurrency(tenant.monthlyRent)} / month
                      </p>
                    )}
                  </div>
                </div>
              </div>
              <span className="text-xs bg-white/20 text-white rounded-full px-2.5 py-1 font-mono">
                {tenant.tenantCode}
              </span>
            </div>
            <p className="text-primary-200 text-xs mt-4">
              Move-in: {formatDate(allocation.startDate)}
            </p>
          </>
        ) : (
          <div className="text-center py-2">
            <p className="text-primary-100 text-sm">No active room allocation</p>
            <p className="text-xs text-primary-200 mt-1 font-mono">{tenant.tenantCode}</p>
          </div>
        )}
      </div>

      {/* Current rent card */}
      {currentCycle && rentStatus ? (
        <div className={`rounded-2xl border p-5 space-y-4 ${rentStatus.bg}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {rentStatus.icon}
              <div>
                <p className="text-xs text-gray-500 font-medium">
                  {MONTH_NAMES[currentCycle.month - 1]} {currentCycle.year} Rent
                </p>
                <p className={`text-sm font-bold ${rentStatus.color}`}>{rentStatus.label}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-gray-900">
                {formatCurrency(currentCycle.remainingAmount)}
              </p>
              <p className="text-xs text-gray-500">
                remaining of {formatCurrency(currentCycle.expectedRent)}
              </p>
            </div>
          </div>

          {/* Progress bar */}
          <div className="w-full bg-white/60 rounded-full h-2 overflow-hidden">
            <div
              className="bg-green-500 h-2 rounded-full transition-all"
              style={{
                width: `${Math.min(
                  100,
                  (currentCycle.paidAmount / currentCycle.expectedRent) * 100,
                )}%`,
              }}
            />
          </div>
          <div className="flex justify-between text-xs text-gray-500">
            <span>Paid: {formatCurrency(currentCycle.paidAmount)}</span>
            <span>Due: {formatDate(currentCycle.dueDate)}</span>
          </div>

          {canPay && (
            <button
              onClick={() => payMutation.mutate()}
              disabled={payMutation.isPending}
              className="w-full flex items-center justify-center gap-2 py-3 bg-primary-600 text-white rounded-xl font-semibold text-sm hover:bg-primary-700 disabled:opacity-60 transition-colors"
            >
              <IndianRupee className="w-4 h-4" />
              {payMutation.isPending
                ? 'Opening payment…'
                : `Pay ${formatCurrency(currentCycle.remainingAmount)} Now`}
            </button>
          )}
        </div>
      ) : (
        <div className="rounded-2xl border border-green-200 bg-green-50 p-5 flex items-center gap-3">
          <CheckCircle2 className="w-6 h-6 text-green-600 shrink-0" />
          <div>
            <p className="font-semibold text-green-800">All clear!</p>
            <p className="text-sm text-green-600">No pending rent this month.</p>
          </div>
        </div>
      )}

      {/* Deposit balance */}
      {tenant.depositBalance > 0 && (
        <div className="flex items-center justify-between bg-white border border-gray-200 rounded-xl p-4">
          <span className="text-sm text-gray-600">Security Deposit Held</span>
          <span className="font-semibold text-gray-900">{formatCurrency(tenant.depositBalance)}</span>
        </div>
      )}

      {/* Recent payments */}
      {rentHistory.length > 0 && (
        <div className="card space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <FileText className="w-4 h-4 text-gray-400" />
            <h2 className="text-sm font-semibold text-gray-700">Recent Payments</h2>
          </div>
          {rentHistory.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0"
            >
              <div>
                <p className="text-sm font-medium text-gray-800">{formatCurrency(p.amount)}</p>
                <p className="text-xs text-gray-400">
                  {p.method} · {formatDate(p.paidAt)}
                  {p.receipt?.receiptNo && (
                    <span className="ml-1 font-mono">#{p.receipt.receiptNo}</span>
                  )}
                </p>
              </div>
              <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full font-medium">
                {p.type}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Complaints */}
      <div className="card space-y-3">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-gray-400" />
            <h2 className="text-sm font-semibold text-gray-700">My Complaints</h2>
          </div>
          <button
            onClick={() => setShowComplaintForm(true)}
            className="text-xs px-3 py-1.5 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition-colors"
          >
            + Raise New
          </button>
        </div>

        {complaints.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">No complaints raised yet</p>
        ) : (
          <div className="space-y-2">
            {complaints.slice(0, 5).map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{c.title}</p>
                  <p className="text-xs text-gray-400">
                    {c.category} · {formatDate(c.createdAt)}
                  </p>
                </div>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-medium ml-2 shrink-0 ${
                    COMPLAINT_STATUS_COLOR[c.status] ?? 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {c.status.replace('_', ' ')}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* KYC nudge */}
      <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-xl p-4">
        <ShieldCheck className="w-5 h-5 text-blue-600 shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-blue-800">KYC Documents</p>
          <p className="text-xs text-blue-600">
            Upload Aadhaar / PAN from the mobile app for faster verification.
          </p>
        </div>
        <ChevronRight className="w-4 h-4 text-blue-400 shrink-0" />
      </div>

      {/* Raise Complaint Modal */}
      {showComplaintForm && (
        <ComplaintFormModal
          onClose={() => setShowComplaintForm(false)}
          onSubmit={(dto) => complaintMutation.mutate(dto)}
          isPending={complaintMutation.isPending}
        />
      )}
    </div>
  );
}

// ── Complaint Form Modal ───────────────────────────────────────────────────────

const CATEGORIES = [
  'MAINTENANCE','PLUMBING','ELECTRICAL','HOUSEKEEPING',
  'SECURITY','FOOD','WIFI','NOISE','OTHER',
];

function ComplaintFormModal({
  onClose,
  onSubmit,
  isPending,
}: {
  onClose: () => void;
  onSubmit: (dto: {
    title: string;
    description: string;
    category: string;
    priority: string;
  }) => void;
  isPending: boolean;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('MAINTENANCE');
  const [priority, setPriority] = useState('MEDIUM');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !description.trim()) {
      toast.error('Please fill in title and description');
      return;
    }
    onSubmit({ title: title.trim(), description: description.trim(), category, priority });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 px-4 pb-4 sm:pb-0">
      <div className="bg-white rounded-2xl w-full max-w-md p-5 space-y-4 shadow-xl">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-gray-900">Raise a Complaint</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. AC not cooling in Room 101"
              className="input-field text-sm w-full"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="input-field text-sm w-full"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="input-field text-sm w-full"
              >
                {['LOW', 'MEDIUM', 'HIGH', 'URGENT'].map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the issue in detail…"
              rows={3}
              className="input-field text-sm w-full resize-none"
              required
            />
          </div>

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="flex-1 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-semibold hover:bg-primary-700 disabled:opacity-60 flex items-center justify-center gap-2 transition-colors"
            >
              <Send className="w-3.5 h-3.5" />
              {isPending ? 'Submitting…' : 'Submit'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
