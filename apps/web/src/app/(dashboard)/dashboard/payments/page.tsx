'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  IndianRupee,
  Search,
  Building2,
  ChevronDown,
  CheckCircle2,
  AlertTriangle,
  Clock,
  RefreshCw,
  Loader2,
} from 'lucide-react';
import { getProperties } from '@/lib/properties-api';
import {
  getRentCycles,
  recordPayment,
  generateCycles,
  type RentCycle,
  type PaymentMethod,
} from '@/lib/payments-api';
import { PageHeader } from '@/components/ui/PageHeader';
import { Table, type Column } from '@/components/ui/Table';
import { RentStatusBadge } from '@/components/ui/StatusBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { FormField, Input, SelectField } from '@/components/ui/FormField';
import { formatCurrency, formatDate, cn } from '@/lib/utils';
import { useDebounce } from '@/hooks/useDebounce';

const STATUS_TABS = [
  { key: '', label: 'All' },
  { key: 'PENDING', label: 'Pending' },
  { key: 'PARTIAL', label: 'Partial' },
  { key: 'OVERDUE', label: 'Overdue' },
  { key: 'PAID', label: 'Paid' },
];

const MONTH_NAMES = [
  '', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'CASH', label: 'Cash' },
  { value: 'UPI', label: 'UPI' },
  { value: 'BANK_TRANSFER', label: 'Bank Transfer' },
  { value: 'CHEQUE', label: 'Cheque' },
  { value: 'DEPOSIT_ADJUSTMENT', label: 'Deposit Adjustment' },
];

function SummaryCard({
  label,
  value,
  icon: Icon,
  iconClass,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  iconClass: string;
}) {
  return (
    <div className="card p-4 flex items-center gap-3">
      <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center shrink-0', iconClass)}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-xs text-gray-500">{label}</p>
        <p className="text-base font-bold text-gray-900">{value}</p>
      </div>
    </div>
  );
}

export default function PaymentsPage() {
  const qc = useQueryClient();
  const now = new Date();
  const [selectedPropertyId, setSelectedPropertyId] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [search, setSearch] = useState('');
  const [recordingCycle, setRecordingCycle] = useState<RentCycle | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState<PaymentMethod>('CASH');
  const [payRef, setPayRef] = useState('');
  const [payError, setPayError] = useState('');

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

  const { data, isLoading } = useQuery({
    queryKey: ['rent-cycles', activePropertyId, statusFilter, month, year],
    queryFn: () => getRentCycles({ propertyId: activePropertyId, status: statusFilter || undefined, month, year }),
    enabled: !!activePropertyId,
  });

  const cycles = (data?.cycles ?? []).filter((c) => {
    if (!debouncedSearch) return true;
    const q = debouncedSearch.toLowerCase();
    return (
      c.tenant.user.name.toLowerCase().includes(q) ||
      c.tenant.tenantCode.toLowerCase().includes(q) ||
      (c.tenant.user.phone ?? '').includes(q)
    );
  });

  const summary = data?.summary;

  const generateMutation = useMutation({
    mutationFn: () => generateCycles(activePropertyId),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['rent-cycles'] });
      alert(`Generated ${res.generated} rent cycles.`);
    },
  });

  const recordMutation = useMutation({
    mutationFn: (vars: { cycleId: string; tenantId: string; amount: number; method: PaymentMethod; reference?: string }) =>
      recordPayment({
        tenantId: vars.tenantId,
        rentCycleId: vars.cycleId,
        amount: vars.amount,
        method: vars.method,
        reference: vars.reference,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rent-cycles'] });
      setRecordingCycle(null);
      setPayAmount('');
      setPayRef('');
      setPayError('');
    },
    onError: (err: any) => {
      setPayError(err?.response?.data?.message || 'Payment failed. Please try again.');
    },
  });

  const openRecord = (cycle: RentCycle) => {
    setRecordingCycle(cycle);
    setPayAmount(String(cycle.remainingAmount));
    setPayMethod('CASH');
    setPayRef('');
    setPayError('');
  };

  const submitPayment = () => {
    if (!recordingCycle) return;
    const amount = parseFloat(payAmount);
    if (isNaN(amount) || amount <= 0) {
      setPayError('Enter a valid amount.');
      return;
    }
    if (amount > recordingCycle.remainingAmount) {
      setPayError(`Amount cannot exceed ₹${recordingCycle.remainingAmount} (remaining).`);
      return;
    }
    setPayError('');
    recordMutation.mutate({
      cycleId: recordingCycle.id,
      tenantId: recordingCycle.tenantId,
      amount,
      method: payMethod,
      reference: payRef || undefined,
    });
  };

  const COLUMNS: Column<RentCycle>[] = [
    {
      key: 'tenant',
      header: 'Tenant',
      render: (c) => (
        <div>
          <p className="font-medium text-gray-900">{c.tenant.user.name}</p>
          <p className="text-xs text-gray-400">{c.tenant.tenantCode}</p>
        </div>
      ),
    },
    {
      key: 'room',
      header: 'Room',
      render: (c) => {
        const a = c.tenant.allocations.find((x) => x.isActive);
        if (!a) return <span className="text-xs text-gray-400">—</span>;
        return (
          <span className="text-sm text-gray-700">
            {a.bed.room.number} – Bed {a.bed.label}
          </span>
        );
      },
    },
    {
      key: 'due',
      header: 'Due Date',
      render: (c) => <span className="text-sm text-gray-600">{formatDate(c.dueDate)}</span>,
    },
    {
      key: 'amount',
      header: 'Rent',
      render: (c) => <span className="text-sm font-medium">{formatCurrency(c.rentAmount)}</span>,
    },
    {
      key: 'paid',
      header: 'Paid',
      render: (c) => (
        <span className={cn('text-sm font-medium', c.paidAmount > 0 ? 'text-green-600' : 'text-gray-400')}>
          {c.paidAmount > 0 ? formatCurrency(c.paidAmount) : '—'}
        </span>
      ),
    },
    {
      key: 'remaining',
      header: 'Balance',
      render: (c) => (
        <span className={cn('text-sm font-medium', c.remainingAmount > 0 ? 'text-red-600' : 'text-gray-400')}>
          {c.remainingAmount > 0 ? formatCurrency(c.remainingAmount) : '—'}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (c) => <RentStatusBadge status={c.status} />,
    },
    {
      key: 'action',
      header: '',
      render: (c) =>
        c.status !== 'PAID' && c.status !== 'WAIVED' ? (
          <button
            onClick={(e) => { e.stopPropagation(); openRecord(c); }}
            className="text-xs btn-primary py-1 px-3"
          >
            Record Payment
          </button>
        ) : null,
    },
  ];

  const years = [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Payments"
        subtitle="Rent collection and payment history"
        actions={
          activePropertyId && (
            <button
              onClick={() => generateMutation.mutate()}
              disabled={generateMutation.isPending}
              className="btn-secondary text-sm flex items-center gap-2"
            >
              {generateMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              Generate Cycles
            </button>
          )
        }
      />

      {/* Filters Row */}
      <div className="flex flex-wrap items-center gap-3">
        {properties.length > 1 && (
          <div className="relative">
            <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <select
              value={activePropertyId}
              onChange={(e) => setSelectedPropertyId(e.target.value)}
              className="input-field pl-9 pr-8 text-sm bg-white appearance-none max-w-[220px]"
            >
              {properties.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>
        )}

        <select
          value={month}
          onChange={(e) => setMonth(Number(e.target.value))}
          className="input-field text-sm bg-white w-28"
        >
          {MONTH_NAMES.slice(1).map((name, i) => (
            <option key={i + 1} value={i + 1}>{name}</option>
          ))}
        </select>

        <select
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          className="input-field text-sm bg-white w-24"
        >
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>

        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tenant..."
            className="input-field pl-9 text-sm"
          />
        </div>
      </div>

      {/* Status Tabs */}
      <div className="flex gap-1.5">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setStatusFilter(tab.key)}
            className={cn(
              'text-xs px-3 py-1.5 rounded-full font-medium transition-colors',
              statusFilter === tab.key
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <SummaryCard label="Collected" value={formatCurrency(summary.totalCollected)} icon={CheckCircle2} iconClass="bg-green-50 text-green-600" />
          <SummaryCard label="Pending" value={formatCurrency(summary.totalPending)} icon={Clock} iconClass="bg-blue-50 text-blue-600" />
          <SummaryCard label="Overdue Cycles" value={String(summary.overdueCount)} icon={AlertTriangle} iconClass="bg-red-50 text-red-600" />
          <SummaryCard label="Paid Cycles" value={String(summary.paidCount)} icon={IndianRupee} iconClass="bg-primary-50 text-primary-600" />
        </div>
      )}

      {/* Table */}
      {properties.length === 0 && !isLoading ? (
        <div className="card">
          <EmptyState
            icon={Building2}
            title="No properties"
            description="Add a property first."
            action={<button className="btn-primary text-sm">Add Property</button>}
          />
        </div>
      ) : (
        <div className="card overflow-hidden">
          <Table
            columns={COLUMNS}
            data={cycles}
            isLoading={isLoading}
            keyExtractor={(c) => c.id}
            emptyTitle="No cycles found"
            emptyDescription="Generate rent cycles or adjust your filters."
            emptyIcon={IndianRupee}
          />
        </div>
      )}

      {/* Record Payment Modal */}
      <Modal
        isOpen={!!recordingCycle}
        onClose={() => setRecordingCycle(null)}
        title="Record Payment"
        size="sm"
      >
        {recordingCycle && (
          <div className="p-6 space-y-5">
            <div className="bg-gray-50 rounded-lg p-3 text-sm">
              <p className="font-medium text-gray-800">{recordingCycle.tenant.user.name}</p>
              <p className="text-gray-500 text-xs mt-0.5">
                {MONTH_NAMES[recordingCycle.month]} {recordingCycle.year} ·{' '}
                Balance: <strong>{formatCurrency(recordingCycle.remainingAmount)}</strong>
              </p>
            </div>

            <FormField label="Amount" required>
              <Input
                type="number"
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
                min={1}
                max={recordingCycle.remainingAmount}
                step={0.01}
                placeholder="0.00"
                error={!!payError}
              />
            </FormField>

            <FormField label="Payment Method" required>
              <SelectField
                value={payMethod}
                onChange={(e) => setPayMethod(e.target.value as PaymentMethod)}
                options={PAYMENT_METHODS}
              />
            </FormField>

            <FormField label="Reference" hint="Cheque number, UPI ID, or transaction ID">
              <Input
                value={payRef}
                onChange={(e) => setPayRef(e.target.value)}
                placeholder="Optional"
              />
            </FormField>

            {payError && (
              <p className="text-sm text-red-500 -mt-2">{payError}</p>
            )}

            <div className="flex gap-3 pt-1">
              <button onClick={() => setRecordingCycle(null)} className="btn-secondary flex-1 text-sm">
                Cancel
              </button>
              <button
                onClick={submitPayment}
                disabled={recordMutation.isPending}
                className="btn-primary flex-1 text-sm flex items-center justify-center gap-2"
              >
                {recordMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                Confirm
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
