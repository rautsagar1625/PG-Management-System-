'use client';

import { useState, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  Search,
  Building2,
  ChevronDown,
  ExternalLink,
  MessageCircle,
  CheckCircle2,
} from 'lucide-react';
import { toast } from 'sonner';
import { getCollections, type CollectionCycle } from '@/lib/payments-api';
import { getProperties } from '@/lib/properties-api';
import { apiClient } from '@/lib/api';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageLoader } from '@/components/ui/LoadingSpinner';
import { PaymentModal } from '@/components/modals/PaymentModal';
import { formatCurrency, formatDate } from '@/lib/utils';
import { useDebounce } from '@/hooks/useDebounce';

async function sendBulkWhatsAppReminder(propertyId: string) {
  const { data } = await apiClient.post<{
    success: boolean;
    data: { totalOverdue: number; sent: number; skipped: number };
  }>('/whatsapp/bulk-reminder', { propertyId });
  return data.data;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function overdueDays(dueDate: string): number {
  const due = new Date(dueDate);
  const now = new Date();
  return Math.max(0, Math.floor((now.getTime() - due.getTime()) / (1000 * 60 * 60 * 24)));
}

export default function OverduePage() {
  const router = useRouter();
  const qc = useQueryClient();
  const now = new Date();

  const [selectedPropertyId, setSelectedPropertyId] = useState('');
  const [search, setSearch] = useState('');
  const [paymentTarget, setPaymentTarget] = useState<CollectionCycle | null>(null);
  const [waResult, setWaResult] = useState<{ sent: number; skipped: number } | null>(null);

  const waMutation = useMutation({
    mutationFn: () => sendBulkWhatsAppReminder(activePropertyId),
    onSuccess: (result) => {
      setWaResult({ sent: result.sent, skipped: result.skipped });
      toast.success(`WhatsApp reminders sent to ${result.sent} tenant${result.sent !== 1 ? 's' : ''}`);
    },
    onError: () => toast.error('Failed to send WhatsApp reminders'),
  });

  const debouncedSearch = useDebounce(search);

  const { data: properties = [] } = useQuery({
    queryKey: ['properties'],
    queryFn: getProperties,
  });

  useEffect(() => {
    if (properties.length > 0 && !selectedPropertyId) {
      setSelectedPropertyId(properties[0]!.id);
    }
  }, [properties, selectedPropertyId]);

  const activePropertyId = selectedPropertyId || properties[0]?.id || '';
  // Reset WA result when property or data changes
  useEffect(() => { setWaResult(null); }, [activePropertyId]);

  const { data, isLoading } = useQuery({
    queryKey: ['overdue', activePropertyId, debouncedSearch],
    queryFn: () =>
      getCollections({
        propertyId: activePropertyId,
        month: now.getMonth() + 1,
        year: now.getFullYear(),
        status: 'OVERDUE',
        search: debouncedSearch || undefined,
        limit: 100,
      }),
    enabled: !!activePropertyId,
  });

  const cycles = data?.cycles ?? [];
  const totalOverdue = cycles.reduce((s, c) => s + Number(c.remainingAmount), 0);
  const currentPropertyName = properties.find((p) => p.id === activePropertyId)?.name;

  const invalidate = useCallback(() => {
    qc.invalidateQueries({ queryKey: ['overdue'] });
    qc.invalidateQueries({ queryKey: ['collections'] });
  }, [qc]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Overdue Collections"
        subtitle={
          cycles.length > 0
            ? `${cycles.length} tenants · ${formatCurrency(totalOverdue)} total overdue`
            : 'All caught up'
        }
      />

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        {properties.length > 1 && (
          <div className="relative">
            <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <select
              value={activePropertyId}
              onChange={(e) => setSelectedPropertyId(e.target.value)}
              className="input-field pl-9 pr-8 text-sm bg-white appearance-none max-w-[200px]"
            >
              {properties.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>
        )}

        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tenant..."
            className="input-field pl-9 text-sm"
          />
        </div>

        {/* WhatsApp bulk reminder */}
        {cycles.length > 0 && (
          <button
            onClick={() => waMutation.mutate()}
            disabled={waMutation.isPending}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-60 transition-colors"
          >
            <MessageCircle className="w-4 h-4" />
            {waMutation.isPending ? 'Sending…' : `Send WA Reminders (${cycles.length})`}
          </button>
        )}
      </div>

      {/* WA result banner */}
      {waResult && (
        <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
          <p className="text-sm text-green-800">
            WhatsApp reminders sent to <strong>{waResult.sent}</strong> tenant{waResult.sent !== 1 ? 's' : ''}.
            {waResult.skipped > 0 && ` ${waResult.skipped} skipped (no phone number on file).`}
          </p>
        </div>
      )}

      {/* Alert banner */}
      {cycles.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-red-800">
              {cycles.length} overdue {cycles.length === 1 ? 'tenant' : 'tenants'} — {formatCurrency(totalOverdue)} uncollected
            </p>
            <p className="text-xs text-red-600 mt-0.5">
              These rent cycles have passed the grace period and need immediate follow-up.
            </p>
          </div>
        </div>
      )}

      {/* Content */}
      {isLoading ? (
        <PageLoader />
      ) : cycles.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={AlertTriangle}
            title="No overdue tenants"
            description={`All ${MONTHS[now.getMonth()]} ${now.getFullYear()} rent is current. Great collection rate!`}
          />
        </div>
      ) : (
        <div className="space-y-2">
          {cycles.map((cycle) => (
            <OverdueCard
              key={cycle.id}
              cycle={cycle}
              propertyName={currentPropertyName}
              onCollect={() => setPaymentTarget(cycle)}
              onViewTenant={() => router.push(`/dashboard/tenants/${cycle.tenant.id}`)}
            />
          ))}
        </div>
      )}

      {paymentTarget && (
        <PaymentModal
          isOpen={!!paymentTarget}
          onClose={() => setPaymentTarget(null)}
          onSuccess={() => {
            invalidate();
            setPaymentTarget(null);
          }}
          tenantId={paymentTarget.tenant.id}
          tenantName={paymentTarget.tenant.user.name}
          tenantCode={paymentTarget.tenant.tenantCode}
          propertyName={currentPropertyName}
          roomInfo={
            paymentTarget.tenant.allocations[0]
              ? `Room ${paymentTarget.tenant.allocations[0].bed.room.number} — Bed ${paymentTarget.tenant.allocations[0].bed.label}`
              : undefined
          }
          rentCycleId={paymentTarget.id}
          rentPeriod={{ month: paymentTarget.month, year: paymentTarget.year }}
          rentAmount={Number(paymentTarget.rentAmount)}
          remainingAmount={Number(paymentTarget.remainingAmount)}
          defaultType="RENT"
        />
      )}
    </div>
  );
}

function OverdueCard({
  cycle,
  propertyName,
  onCollect,
  onViewTenant,
}: {
  cycle: CollectionCycle;
  propertyName?: string;
  onCollect: () => void;
  onViewTenant: () => void;
}) {
  const alloc = cycle.tenant.allocations[0];
  const days = overdueDays(cycle.dueDate);
  const urgencyClass = days > 30 ? 'border-red-300 bg-red-50' : days > 14 ? 'border-orange-200 bg-orange-50' : 'border-yellow-200 bg-yellow-50';
  const daysBadgeClass = days > 30 ? 'bg-red-600 text-white' : days > 14 ? 'bg-orange-500 text-white' : 'bg-yellow-500 text-white';

  return (
    <div className={`rounded-xl border p-4 flex flex-wrap items-center gap-4 ${urgencyClass}`}>
      {/* Overdue days badge */}
      <div className={`w-14 h-14 rounded-xl flex flex-col items-center justify-center shrink-0 ${daysBadgeClass}`}>
        <span className="text-xl font-bold leading-none">{days}</span>
        <span className="text-[10px] font-medium uppercase tracking-wide">days</span>
      </div>

      {/* Tenant info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={onViewTenant}
            className="font-semibold text-gray-900 hover:text-primary-600 transition-colors"
          >
            {cycle.tenant.user.name}
          </button>
          <span className="text-xs font-mono text-gray-400">{cycle.tenant.tenantCode}</span>
        </div>
        <div className="flex flex-wrap gap-3 mt-1 text-xs text-gray-500">
          {cycle.tenant.user.phone && <span>{cycle.tenant.user.phone}</span>}
          {alloc && (
            <span>Room {alloc.bed.room.number} — Bed {alloc.bed.label}</span>
          )}
          {propertyName && <span>{propertyName}</span>}
          <span>Due: {formatDate(cycle.dueDate)}</span>
          <span>
            {MONTHS[cycle.month - 1]} {cycle.year}
          </span>
        </div>
        {Number(cycle.paidAmount) > 0 && (
          <p className="text-xs text-green-700 mt-1">
            Partially paid: {formatCurrency(Number(cycle.paidAmount))} of {formatCurrency(Number(cycle.rentAmount))}
          </p>
        )}
      </div>

      {/* Amount + actions */}
      <div className="flex items-center gap-3 shrink-0">
        <div className="text-right">
          <p className="text-xs text-gray-500">Remaining</p>
          <p className="text-lg font-bold text-red-700">{formatCurrency(Number(cycle.remainingAmount))}</p>
        </div>
        <div className="flex flex-col gap-1.5">
          <button
            onClick={onCollect}
            className="text-xs px-4 py-2 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition-colors"
          >
            Collect
          </button>
          <button
            onClick={onViewTenant}
            className="text-xs px-4 py-2 bg-white border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors flex items-center gap-1 justify-center"
          >
            <ExternalLink className="w-3 h-3" />
            View
          </button>
        </div>
      </div>
    </div>
  );
}
