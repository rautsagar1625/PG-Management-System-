'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Building2,
  IndianRupee,
  CheckCircle2,
  Clock,
  Download,
  FileText,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  getSettlement,
  markSettlementPaid,
  type SettlementStatus,
  type FinancialModelType,
} from '@/lib/settlements-api';
import { PageLoader } from '@/components/ui/LoadingSpinner';
import { formatCurrency, formatDate } from '@/lib/utils';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const STATUS_STYLES: Record<SettlementStatus, string> = {
  CALCULATED: 'bg-yellow-50 text-yellow-700',
  PAID: 'bg-green-50 text-green-700',
};

const MODEL_LABELS: Record<FinancialModelType, string> = {
  FIXED_PAYOUT: 'Fixed Payout',
  REVENUE_SHARE: 'Revenue Share',
  OWNER_OPERATED: 'Owner Operated',
};

export default function SettlementDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const [notes, setNotes] = useState('');
  const [showMarkPaid, setShowMarkPaid] = useState(false);

  const { data: settlement, isLoading } = useQuery({
    queryKey: ['settlement', id],
    queryFn: () => getSettlement(id),
  });

  const markPaidMut = useMutation({
    mutationFn: () => markSettlementPaid(id, notes || undefined),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settlement', id] });
      qc.invalidateQueries({ queryKey: ['settlements'] });
      setShowMarkPaid(false);
      toast.success('Settlement marked as paid');
    },
    onError: () => toast.error('Failed to mark settlement as paid'),
  });

  if (isLoading || !settlement) return <PageLoader />;

  const model = settlement.financialModel;
  const isPaid = settlement.status === 'PAID';
  const period = `${MONTH_NAMES[settlement.month - 1]} ${settlement.year}`;

  return (
    <div className="max-w-3xl mx-auto space-y-6 p-6">
      {/* Back */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Settlements
      </button>

      {/* Header */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-xl font-bold text-gray-900">Settlement — {period}</h1>
              <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${STATUS_STYLES[settlement.status]}`}>
                {isPaid ? 'Paid' : 'Pending'}
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Building2 className="w-4 h-4" />
              {settlement.property.name} · {settlement.property.city}
            </div>
            {model && (
              <p className="text-xs text-gray-400 mt-1">
                Financial model: {MODEL_LABELS[model.type]}
                {model.type === 'REVENUE_SHARE' && model.ownerSharePercent && (
                  <> · Owner {model.ownerSharePercent}% / Operator {model.operatorSharePercent}%</>
                )}
                {model.type === 'FIXED_PAYOUT' && model.fixedOwnerPayout && (
                  <> · Fixed payout: {formatCurrency(model.fixedOwnerPayout)}/mo</>
                )}
              </p>
            )}
          </div>

          {/* Action */}
          {!isPaid && !showMarkPaid && (
            <button
              onClick={() => setShowMarkPaid(true)}
              className="flex items-center gap-1.5 text-sm bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
            >
              <CheckCircle2 className="w-4 h-4" />
              Mark as Paid
            </button>
          )}
          {isPaid && (
            <div className="flex items-center gap-1.5 text-sm text-green-600">
              <CheckCircle2 className="w-4 h-4" />
              Paid {settlement.settledAt ? formatDate(settlement.settledAt) : ''}
            </div>
          )}
        </div>

        {/* Mark paid form */}
        {showMarkPaid && (
          <div className="mt-4 bg-green-50 rounded-xl p-4 space-y-3 border border-green-200">
            <p className="text-sm font-medium text-green-800">Confirm Payment</p>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full border border-green-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-400 resize-none"
              rows={2}
              placeholder="Payment notes (optional) — e.g. Paid via NEFT, Ref#12345"
            />
            <div className="flex gap-2">
              <button
                onClick={() => setShowMarkPaid(false)}
                className="flex-1 text-sm py-2 border border-gray-200 rounded-lg text-gray-600 hover:bg-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => markPaidMut.mutate()}
                disabled={markPaidMut.isPending}
                className="flex-1 text-sm py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                {markPaidMut.isPending ? 'Processing…' : 'Confirm Paid'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Financial Breakdown */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-5">
        <h2 className="text-base font-semibold text-gray-800 flex items-center gap-2">
          <IndianRupee className="w-4 h-4 text-green-500" />
          Financial Breakdown
        </h2>

        {/* Key figures */}
        <div className="grid grid-cols-3 gap-4">
          <FinancialCard
            label="Total Collected"
            value={formatCurrency(settlement.totalCollected)}
            sub="Gross rent this month"
            color="blue"
          />
          <FinancialCard
            label="Owner Payout"
            value={formatCurrency(settlement.ownerPayout)}
            sub={
              model?.type === 'REVENUE_SHARE'
                ? `${model.ownerSharePercent}% share`
                : 'Fixed payout'
            }
            color="purple"
          />
          <FinancialCard
            label="Operator Profit"
            value={formatCurrency(settlement.operatorProfit)}
            sub={
              model?.type === 'REVENUE_SHARE'
                ? `${model.operatorSharePercent}% share`
                : 'After owner payout'
            }
            color="green"
          />
        </div>

        {/* Visual breakdown bar */}
        <div>
          <div className="flex justify-between text-xs text-gray-500 mb-1.5">
            <span>Owner</span>
            <span>Operator</span>
          </div>
          <div className="flex h-3 rounded-full overflow-hidden">
            <div
              className="bg-purple-400 transition-all"
              style={{
                width: `${(Number(settlement.ownerPayout) / Number(settlement.totalCollected)) * 100}%`,
              }}
            />
            <div className="bg-green-400 flex-1" />
          </div>
          <div className="flex justify-between text-xs text-gray-400 mt-1">
            <span>{formatCurrency(settlement.ownerPayout)}</span>
            <span>{formatCurrency(settlement.operatorProfit)}</span>
          </div>
        </div>

        {/* Calculation metadata */}
        <div className="bg-gray-50 rounded-xl p-3 text-xs text-gray-500 space-y-1">
          <div className="flex justify-between">
            <span>Calculated at</span>
            <span className="text-gray-700">{formatDate(settlement.breakdown?.calculatedAt ?? settlement.createdAt)}</span>
          </div>
          <div className="flex justify-between">
            <span>Financial model</span>
            <span className="text-gray-700">{model ? MODEL_LABELS[model.type] : '—'}</span>
          </div>
          {settlement.settledAt && (
            <div className="flex justify-between">
              <span>Paid on</span>
              <span className="text-gray-700">{formatDate(settlement.settledAt)}</span>
            </div>
          )}
          {settlement.notes && (
            <div className="flex justify-between gap-4">
              <span>Notes</span>
              <span className="text-gray-700 text-right">{settlement.notes}</span>
            </div>
          )}
        </div>
      </div>

      {/* Status Timeline */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
        <h2 className="text-base font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <Clock className="w-4 h-4 text-gray-400" />
          Timeline
        </h2>
        <div className="space-y-3">
          <TimelineItem
            label="Settlement calculated"
            date={settlement.createdAt}
            done
          />
          <TimelineItem
            label="Marked as paid"
            date={settlement.settledAt}
            done={isPaid}
            pending={!isPaid}
          />
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function FinancialCard({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string;
  sub: string;
  color: 'blue' | 'purple' | 'green';
}) {
  const bg: Record<string, string> = {
    blue: 'bg-blue-50',
    purple: 'bg-purple-50',
    green: 'bg-green-50',
  };
  const text: Record<string, string> = {
    blue: 'text-blue-700',
    purple: 'text-purple-700',
    green: 'text-green-700',
  };

  return (
    <div className={`${bg[color]} rounded-xl p-4`}>
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={`text-xl font-bold ${text[color]}`}>{value}</p>
      <p className="text-xs text-gray-400 mt-1">{sub}</p>
    </div>
  );
}

function TimelineItem({
  label,
  date,
  done,
  pending,
}: {
  label: string;
  date: string | null | undefined;
  done?: boolean;
  pending?: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <div
        className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
          done ? 'bg-green-100' : 'bg-gray-100'
        }`}
      >
        {done ? (
          <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
        ) : (
          <Clock className="w-3.5 h-3.5 text-gray-400" />
        )}
      </div>
      <div className="flex-1">
        <p className={`text-sm font-medium ${done ? 'text-gray-800' : 'text-gray-400'}`}>
          {label}
        </p>
        {date && <p className="text-xs text-gray-400">{formatDate(date)}</p>}
        {pending && !date && <p className="text-xs text-gray-400">Pending</p>}
      </div>
    </div>
  );
}
