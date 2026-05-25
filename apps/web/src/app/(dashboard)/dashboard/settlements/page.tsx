'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Building2,
  ChevronDown,
  Calculator,
  CheckCircle2,
  IndianRupee,
  TrendingUp,
  AlertCircle,
} from 'lucide-react';
import {
  getSettlements,
  calculateSettlement,
  markSettlementPaid,
  type Settlement,
  type FinancialModelType,
} from '@/lib/settlements-api';
import { getProperties } from '@/lib/properties-api';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageLoader } from '@/components/ui/LoadingSpinner';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { formatCurrency, formatDate } from '@/lib/utils';
import { toast } from 'sonner';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const MODEL_LABELS: Record<FinancialModelType, string> = {
  FIXED_PAYOUT: 'Fixed Payout',
  REVENUE_SHARE: 'Revenue Share',
  OWNER_OPERATED: 'Owner Operated',
};

export default function SettlementsPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const now = new Date();

  const [selectedPropertyId, setSelectedPropertyId] = useState('');
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [markPaidTarget, setMarkPaidTarget] = useState<Settlement | null>(null);
  const [calcError, setCalcError] = useState('');

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

  const { data: settlements = [], isLoading } = useQuery({
    queryKey: ['settlements', activePropertyId, year],
    queryFn: () => getSettlements(activePropertyId, year),
    enabled: !!activePropertyId,
  });

  const currentSettlement = settlements.find((s) => s.month === month && s.year === year);

  const calcMut = useMutation({
    mutationFn: () => calculateSettlement(activePropertyId, month, year),
    onSuccess: () => {
      setCalcError('');
      qc.invalidateQueries({ queryKey: ['settlements', activePropertyId] });
      toast.success('Settlement calculated successfully');
    },
    onError: (e: Error) => {
      const msg = e.message ?? 'Calculation failed';
      setCalcError(msg);
      toast.error(msg);
    },
  });

  const markPaidMut = useMutation({
    mutationFn: (id: string) => markSettlementPaid(id),
    onSuccess: () => {
      setMarkPaidTarget(null);
      qc.invalidateQueries({ queryKey: ['settlements', activePropertyId] });
      toast.success('Settlement marked as paid');
    },
    onError: (e: Error) => toast.error(e.message ?? 'Failed to mark as paid'),
  });

  const yearOptions = Array.from({ length: 3 }, (_, i) => now.getFullYear() - i + 1);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Settlements"
        subtitle="Monthly owner-operator reconciliation"
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

        <select
          value={month}
          onChange={(e) => setMonth(Number(e.target.value))}
          className="input-field text-sm bg-white w-28"
        >
          {MONTHS.map((m, i) => (
            <option key={i + 1} value={i + 1}>{m}</option>
          ))}
        </select>

        <select
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          className="input-field text-sm bg-white w-24"
        >
          {yearOptions.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <PageLoader />
      ) : (
        <>
          {/* Current Month Settlement */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-gray-900">
                {MONTHS[month - 1]} {year} Settlement
              </h2>
              {currentSettlement ? (
                <span
                  className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                    currentSettlement.status === 'PAID'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-blue-100 text-blue-700'
                  }`}
                >
                  {currentSettlement.status}
                </span>
              ) : (
                <span className="text-xs text-gray-400">Not calculated</span>
              )}
            </div>

            {calcError && (
              <div className="bg-red-50 text-red-700 text-sm rounded-lg px-3 py-2 mb-4 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {calcError}
              </div>
            )}

            {currentSettlement ? (
              <div className="space-y-4">
                {/* Model info */}
                <div className="bg-gray-50 rounded-lg p-3 text-sm">
                  <p className="text-xs text-gray-500 mb-1">Financial Model</p>
                  <p className="font-medium text-gray-800">
                    {MODEL_LABELS[currentSettlement.financialModel.type]}
                    {currentSettlement.financialModel.type === 'FIXED_PAYOUT' &&
                      currentSettlement.financialModel.fixedOwnerPayout && (
                        <span className="text-gray-500 font-normal ml-2">
                          (Owner: {formatCurrency(currentSettlement.financialModel.fixedOwnerPayout)}/mo)
                        </span>
                      )}
                    {currentSettlement.financialModel.type === 'REVENUE_SHARE' && (
                      <span className="text-gray-500 font-normal ml-2">
                        (Owner {currentSettlement.financialModel.ownerSharePercent}% / Operator {currentSettlement.financialModel.operatorSharePercent}%)
                      </span>
                    )}
                  </p>
                </div>

                {/* Breakdown cards */}
                <div className="grid grid-cols-3 gap-3">
                  <SettlementCard
                    label="Total Collected"
                    value={formatCurrency(Number(currentSettlement.totalCollected))}
                    icon={IndianRupee}
                    iconClass="text-gray-600"
                    bgClass="bg-gray-50"
                  />
                  <SettlementCard
                    label="Owner Payout"
                    value={formatCurrency(Number(currentSettlement.ownerPayout))}
                    icon={TrendingUp}
                    iconClass="text-blue-600"
                    bgClass="bg-blue-50"
                  />
                  <SettlementCard
                    label="Operator Profit"
                    value={formatCurrency(Number(currentSettlement.operatorProfit))}
                    icon={CheckCircle2}
                    iconClass="text-green-600"
                    bgClass="bg-green-50"
                  />
                </div>

                {/* Collection rate */}
                {currentSettlement.totalCollected > 0 && (
                  <div className="text-xs text-gray-500">
                    Calculated at {formatDate(currentSettlement.breakdown.calculatedAt)}
                    {currentSettlement.settledAt && (
                      <span> · Paid on {formatDate(currentSettlement.settledAt)}</span>
                    )}
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2 pt-2 border-t border-gray-100">
                  <button
                    onClick={() => calcMut.mutate()}
                    disabled={calcMut.isPending || currentSettlement.status === 'PAID'}
                    className="btn-secondary text-sm flex items-center gap-1.5 disabled:opacity-40"
                  >
                    <Calculator className="w-4 h-4" />
                    {calcMut.isPending ? 'Recalculating...' : 'Recalculate'}
                  </button>
                  {currentSettlement.status === 'CALCULATED' && (
                    <button
                      onClick={() => setMarkPaidTarget(currentSettlement)}
                      className="btn-primary text-sm flex items-center gap-1.5"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Mark Owner Paid
                    </button>
                  )}
                  {currentSettlement.status === 'PAID' && (
                    <span className="flex items-center gap-1.5 text-sm text-green-600 font-medium">
                      <CheckCircle2 className="w-4 h-4" />
                      Settlement Complete
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-6 space-y-3">
                <p className="text-sm text-gray-500">
                  No settlement calculated for {MONTHS[month - 1]} {year}.
                </p>
                <button
                  onClick={() => calcMut.mutate()}
                  disabled={calcMut.isPending || !activePropertyId}
                  className="btn-primary text-sm flex items-center gap-2 mx-auto disabled:opacity-50"
                >
                  <Calculator className="w-4 h-4" />
                  {calcMut.isPending ? 'Calculating...' : 'Calculate Settlement'}
                </button>
              </div>
            )}
          </div>

          {/* Settlement History */}
          {settlements.length > 0 && (
            <div className="card overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-200">
                <h3 className="text-sm font-semibold text-gray-700">{year} Settlement History</h3>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Period</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">Collected</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">Owner Payout</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">Operator Profit</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {settlements.map((s) => (
                    <tr key={s.id} className="hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => router.push(`/dashboard/settlements/${s.id}`)}>
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {MONTHS[s.month - 1]} {s.year}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-700">
                        {formatCurrency(Number(s.totalCollected))}
                      </td>
                      <td className="px-4 py-3 text-right text-blue-700 font-medium">
                        {formatCurrency(Number(s.ownerPayout))}
                      </td>
                      <td className="px-4 py-3 text-right text-green-700 font-medium">
                        {formatCurrency(Number(s.operatorProfit))}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                            s.status === 'PAID'
                              ? 'bg-green-100 text-green-700'
                              : 'bg-blue-100 text-blue-700'
                          }`}
                        >
                          {s.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {s.status === 'CALCULATED' && (
                          <button
                            onClick={() => setMarkPaidTarget(s)}
                            className="text-xs text-primary-600 hover:underline font-medium"
                          >
                            Mark Paid
                          </button>
                        )}
                        {s.status === 'PAID' && s.settledAt && (
                          <span className="text-xs text-gray-400">{formatDate(s.settledAt)}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {settlements.length === 0 && (
            <div className="card">
              <EmptyState
                icon={IndianRupee}
                title="No settlements yet"
                description="Calculate your first settlement for this property above."
              />
            </div>
          )}
        </>
      )}

      <ConfirmModal
        isOpen={!!markPaidTarget}
        onClose={() => setMarkPaidTarget(null)}
        onConfirm={async () => {
          if (markPaidTarget) await markPaidMut.mutateAsync(markPaidTarget.id);
        }}
        isLoading={markPaidMut.isPending}
        title="Mark Settlement as Paid"
        message={
          markPaidTarget
            ? `Confirm owner payout of ${formatCurrency(Number(markPaidTarget.ownerPayout))} for ${MONTHS[markPaidTarget.month - 1]} ${markPaidTarget.year}. This cannot be undone.`
            : ''
        }
        confirmLabel="Mark as Paid"
        variant="default"
      />
    </div>
  );
}

function SettlementCard({
  label,
  value,
  icon: Icon,
  iconClass,
  bgClass,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  iconClass: string;
  bgClass: string;
}) {
  return (
    <div className={`rounded-xl p-4 ${bgClass}`}>
      <div className="flex items-center gap-2 mb-1.5">
        <Icon className={`w-4 h-4 ${iconClass}`} />
        <span className="text-xs text-gray-500 font-medium">{label}</span>
      </div>
      <p className="text-lg font-bold text-gray-900">{value}</p>
    </div>
  );
}
