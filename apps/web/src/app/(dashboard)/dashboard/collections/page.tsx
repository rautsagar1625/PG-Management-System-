'use client';

import { useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import {
  IndianRupee,
  Search,
  Building2,
  ChevronDown,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Clock,
  RotateCcw,
} from 'lucide-react';
import { getCollections, generateCycles, type CollectionCycle } from '@/lib/payments-api';
import { getProperties } from '@/lib/properties-api';
import { PageHeader } from '@/components/ui/PageHeader';
import { RentStatusBadge } from '@/components/ui/StatusBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageLoader } from '@/components/ui/LoadingSpinner';
import { PaymentModal } from '@/components/modals/PaymentModal';
import { formatCurrency, formatDate } from '@/lib/utils';
import { useDebounce } from '@/hooks/useDebounce';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const STATUS_TABS = [
  { key: '', label: 'All' },
  { key: 'OVERDUE', label: 'Overdue' },
  { key: 'PARTIAL', label: 'Partial' },
  { key: 'PENDING', label: 'Pending' },
  { key: 'DUE', label: 'Due' },
  { key: 'PAID', label: 'Paid' },
];

function overdueDays(dueDate: string): number {
  const due = new Date(dueDate);
  const now = new Date();
  return Math.max(0, Math.floor((now.getTime() - due.getTime()) / (1000 * 60 * 60 * 24)));
}

export default function CollectionsPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const now = new Date();

  const [selectedPropertyId, setSelectedPropertyId] = useState('');
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [paymentTarget, setPaymentTarget] = useState<CollectionCycle | null>(null);
  const [generating, setGenerating] = useState(false);

  const debouncedSearch = useDebounce(search);

  const { data: properties = [] } = useQuery({
    queryKey: ['properties'],
    queryFn: getProperties,
    select: (data) => {
      if (data.length > 0 && !selectedPropertyId) {
        setTimeout(() => setSelectedPropertyId((prev) => prev || data[0]!.id), 0);
      }
      return data;
    },
  });

  const activePropertyId = selectedPropertyId || properties[0]?.id || '';

  const collectionsKey = ['collections', activePropertyId, month, year, statusFilter, debouncedSearch, page];

  const { data, isLoading, isFetching } = useQuery({
    queryKey: collectionsKey,
    queryFn: () =>
      getCollections({
        propertyId: activePropertyId,
        month,
        year,
        status: statusFilter || undefined,
        search: debouncedSearch || undefined,
        page,
        limit: 50,
      }),
    enabled: !!activePropertyId,
  });

  const cycles = data?.cycles ?? [];
  const summary = data?.summary;
  const meta = data?.meta;

  const invalidate = useCallback(() => {
    qc.invalidateQueries({ queryKey: ['collections'] });
  }, [qc]);

  const handleGenerate = async () => {
    if (!activePropertyId || generating) return;
    setGenerating(true);
    try {
      const result = await generateCycles(activePropertyId, month, year);
      if (result.generated > 0) invalidate();
    } finally {
      setGenerating(false);
    }
  };

  const currentPropertyName = properties.find((p) => p.id === activePropertyId)?.name;

  const yearOptions = Array.from({ length: 3 }, (_, i) => now.getFullYear() - i + 1);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Collections"
        subtitle={
          summary
            ? `${MONTHS[month - 1]} ${year} — ${meta?.total ?? 0} tenants`
            : `${MONTHS[month - 1]} ${year}`
        }
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={handleGenerate}
              disabled={generating || !activePropertyId}
              className="btn-secondary text-sm flex items-center gap-1.5 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${generating ? 'animate-spin' : ''}`} />
              Generate Cycles
            </button>
          </div>
        }
      />

      {/* Controls Row */}
      <div className="flex flex-wrap items-center gap-3">
        {properties.length > 1 && (
          <div className="relative">
            <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <select
              value={activePropertyId}
              onChange={(e) => { setSelectedPropertyId(e.target.value); setPage(1); }}
              className="input-field pl-9 pr-8 text-sm bg-white appearance-none max-w-[200px]"
            >
              {properties.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>
        )}

        {/* Month selector */}
        <select
          value={month}
          onChange={(e) => { setMonth(Number(e.target.value)); setPage(1); }}
          className="input-field text-sm bg-white w-28"
        >
          {MONTHS.map((m, i) => (
            <option key={i + 1} value={i + 1}>{m}</option>
          ))}
        </select>

        {/* Year selector */}
        <select
          value={year}
          onChange={(e) => { setYear(Number(e.target.value)); setPage(1); }}
          className="input-field text-sm bg-white w-24"
        >
          {yearOptions.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>

        {/* Search */}
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search tenant..."
            className="input-field pl-9 text-sm"
          />
        </div>
      </div>

      {/* Summary Strip */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <SummaryCard
            label="Expected"
            value={formatCurrency(summary.totalExpected)}
            sub={`${summary.totalCycles} tenants`}
            color="gray"
          />
          <SummaryCard
            label="Collected"
            value={formatCurrency(summary.totalCollected)}
            sub={`${summary.statusBreakdown['PAID']?.count ?? 0} paid`}
            color="green"
          />
          <SummaryCard
            label="Remaining"
            value={formatCurrency(summary.totalRemaining)}
            sub={`${(summary.statusBreakdown['OVERDUE']?.count ?? 0) + (summary.statusBreakdown['PARTIAL']?.count ?? 0)} unpaid`}
            color="yellow"
          />
          <SummaryCard
            label="Overdue"
            value={formatCurrency(summary.statusBreakdown['OVERDUE']?.remaining ?? 0)}
            sub={`${summary.statusBreakdown['OVERDUE']?.count ?? 0} tenants`}
            color="red"
          />
        </div>
      )}

      {/* Status Tabs */}
      <div className="flex flex-wrap gap-1.5">
        {STATUS_TABS.map((tab) => {
          const count = tab.key
            ? summary?.statusBreakdown[tab.key]?.count
            : summary?.totalCycles;
          return (
            <button
              key={tab.key}
              onClick={() => { setStatusFilter(tab.key); setPage(1); }}
              className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors whitespace-nowrap ${
                statusFilter === tab.key
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {tab.label}
              {count !== undefined && (
                <span className={`ml-1.5 text-xs ${statusFilter === tab.key ? 'opacity-75' : 'text-gray-400'}`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <PageLoader />
        ) : cycles.length === 0 ? (
          <EmptyState
            icon={IndianRupee}
            title={summary?.totalCycles === 0 ? 'No rent cycles' : 'No results'}
            description={
              summary?.totalCycles === 0
                ? `No rent cycles generated for ${MONTHS[month - 1]} ${year}. Click "Generate Cycles" to create them.`
                : 'Adjust your search or filter.'
            }
            action={
              summary?.totalCycles === 0 ? (
                <button
                  onClick={handleGenerate}
                  disabled={generating}
                  className="btn-primary text-sm"
                >
                  {generating ? 'Generating...' : 'Generate Cycles'}
                </button>
              ) : undefined
            }
          />
        ) : (
          <div className={isFetching ? 'opacity-70 transition-opacity' : ''}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Tenant</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Room</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">Rent</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">Paid</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">Remaining</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Due</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {cycles.map((cycle) => (
                    <CollectionRow
                      key={cycle.id}
                      cycle={cycle}
                      propertyName={currentPropertyName}
                      onCollect={() => setPaymentTarget(cycle)}
                      onViewTenant={() => router.push(`/dashboard/tenants/${cycle.tenant.id}`)}
                    />
                  ))}
                </tbody>
              </table>
            </div>

            {meta && meta.totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 text-sm text-gray-500">
                <span>
                  Showing {(meta.page - 1) * meta.limit + 1}–{Math.min(meta.page * meta.limit, meta.total)} of {meta.total}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage((p) => p - 1)}
                    disabled={meta.page === 1}
                    className="px-3 py-1 rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-50 transition-colors"
                  >
                    Prev
                  </button>
                  <button
                    onClick={() => setPage((p) => p + 1)}
                    disabled={meta.page >= meta.totalPages}
                    className="px-3 py-1 rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-50 transition-colors"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Payment Modal */}
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

// ── Summary Card ──────────────────────────────────────────────────────────────

function SummaryCard({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string;
  sub: string;
  color: 'gray' | 'green' | 'yellow' | 'red';
}) {
  const colors = {
    gray: 'text-gray-900',
    green: 'text-green-700',
    yellow: 'text-yellow-700',
    red: 'text-red-700',
  };
  return (
    <div className="card p-4">
      <p className="text-xs text-gray-500 font-medium">{label}</p>
      <p className={`text-lg font-bold mt-0.5 ${colors[color]}`}>{value}</p>
      <p className="text-xs text-gray-400 mt-0.5">{sub}</p>
    </div>
  );
}

// ── Collection Row ────────────────────────────────────────────────────────────

function CollectionRow({
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
  const isPaid = cycle.status === 'PAID';
  const isOverdue = cycle.status === 'OVERDUE';
  const days = isOverdue ? overdueDays(cycle.dueDate) : 0;

  return (
    <tr className={`hover:bg-gray-50 transition-colors ${isOverdue ? 'bg-red-50/30' : ''}`}>
      <td className="px-4 py-3">
        <div>
          <button
            onClick={onViewTenant}
            className="font-medium text-gray-900 hover:text-primary-600 transition-colors text-left"
          >
            {cycle.tenant.user.name}
          </button>
          <p className="text-xs text-gray-400 font-mono">{cycle.tenant.tenantCode}</p>
        </div>
      </td>
      <td className="px-4 py-3 text-gray-600">
        {alloc ? (
          <span>{alloc.bed.room.number} — {alloc.bed.label}</span>
        ) : (
          <span className="text-gray-400">—</span>
        )}
      </td>
      <td className="px-4 py-3 text-right text-gray-700">
        {formatCurrency(Number(cycle.rentAmount))}
      </td>
      <td className="px-4 py-3 text-right text-green-700 font-medium">
        {Number(cycle.paidAmount) > 0 ? formatCurrency(Number(cycle.paidAmount)) : (
          <span className="text-gray-300">—</span>
        )}
      </td>
      <td className="px-4 py-3 text-right">
        <span className={Number(cycle.remainingAmount) > 0 ? 'text-red-700 font-semibold' : 'text-gray-400'}>
          {Number(cycle.remainingAmount) > 0 ? formatCurrency(Number(cycle.remainingAmount)) : '—'}
        </span>
      </td>
      <td className="px-4 py-3 text-gray-500">
        <div>
          <span className="text-xs">{formatDate(cycle.dueDate)}</span>
          {isOverdue && days > 0 && (
            <p className="text-xs text-red-600 font-medium mt-0.5">{days}d overdue</p>
          )}
        </div>
      </td>
      <td className="px-4 py-3">
        <RentStatusBadge status={cycle.status} />
      </td>
      <td className="px-4 py-3 text-right">
        {!isPaid ? (
          <button
            onClick={onCollect}
            className="text-xs px-3 py-1.5 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition-colors whitespace-nowrap"
          >
            Collect
          </button>
        ) : (
          <span className="text-xs text-green-600 flex items-center gap-1 justify-end">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Paid
          </span>
        )}
      </td>
    </tr>
  );
}
