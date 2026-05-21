'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  TrendingUp,
  Building2,
  ChevronDown,
  Users,
  IndianRupee,
  BedDouble,
  AlertTriangle,
} from 'lucide-react';
import { getProperties, type Property } from '@/lib/properties-api';
import { getPropertySummary } from '@/lib/payments-api';
import { getLeads, type Lead } from '@/lib/leads-api';
import { cn, formatCurrency } from '@/lib/utils';

// ── Simple bar chart ──────────────────────────────────────────────────────────

function BarChart({ data }: { data: { label: string; value: number; color: string }[] }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="flex items-end gap-2 h-32 pt-2">
      {data.map(({ label, value, color }) => (
        <div key={label} className="flex-1 flex flex-col items-center gap-1 min-w-0">
          <span className="text-[10px] text-gray-500 font-medium">{value > 0 ? formatCurrency(value) : ''}</span>
          <div
            className="w-full rounded-t-md transition-all duration-300 min-h-[4px]"
            style={{ height: `${Math.max((value / max) * 100, 4)}%`, backgroundColor: color }}
          />
          <span className="text-[10px] text-gray-500 truncate w-full text-center">{label}</span>
        </div>
      ))}
    </div>
  );
}

function HorizontalBar({ label, value, max, color, count }: { label: string; value: number; max: number; color: string; count: number }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-gray-500 w-28 truncate shrink-0">{label}</span>
      <div className="flex-1 bg-gray-100 rounded-full h-2">
        <div className="h-2 rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <span className="text-xs font-bold text-gray-700 w-6 text-right shrink-0">{count}</span>
    </div>
  );
}

// ── Donut chart ───────────────────────────────────────────────────────────────

function DonutChart({ segments }: { segments: { label: string; value: number; color: string }[] }) {
  const total = segments.reduce((s, d) => s + d.value, 0);
  if (total === 0) return <div className="text-sm text-gray-400 text-center py-4">No data</div>;

  let cumPct = 0;
  const gradient = segments
    .map(({ value, color }) => {
      const pct = (value / total) * 100;
      const from = cumPct;
      cumPct += pct;
      return `${color} ${from.toFixed(1)}% ${cumPct.toFixed(1)}%`;
    })
    .join(', ');

  return (
    <div className="flex flex-col items-center gap-4">
      <div
        className="w-28 h-28 rounded-full"
        style={{
          background: `conic-gradient(${gradient})`,
          WebkitMask: 'radial-gradient(farthest-side, transparent 42%, black 43%)',
          mask: 'radial-gradient(farthest-side, transparent 42%, black 43%)',
        }}
      />
      <div className="flex flex-col gap-1.5 w-full">
        {segments.map(({ label, value, color }) => (
          <div key={label} className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
            <span className="text-xs text-gray-600 flex-1">{label}</span>
            <span className="text-xs font-bold text-gray-800">{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, Icon, color }: {
  label: string; value: string; sub?: string;
  Icon: React.ComponentType<{ className?: string; color?: string }>; color: string;
}) {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{label}</p>
          <p className="mt-1 text-2xl font-black text-gray-900">{value}</p>
          {sub && <p className="mt-0.5 text-xs text-gray-400">{sub}</p>}
        </div>
        <div className="p-2.5 rounded-xl" style={{ backgroundColor: `${color}18` }}>
          <Icon className="w-5 h-5" color={color} />
        </div>
      </div>
    </div>
  );
}

const LEAD_STATUSES = [
  { key: 'NEW',              label: 'New',             color: '#6b7280' },
  { key: 'CONTACTED',        label: 'Contacted',       color: '#3b82f6' },
  { key: 'VISIT_SCHEDULED',  label: 'Visit Scheduled', color: '#6366f1' },
  { key: 'VISITED',          label: 'Visited',         color: '#8b5cf6' },
  { key: 'NEGOTIATING',      label: 'Negotiating',     color: '#f59e0b' },
  { key: 'TOKEN_PAID',       label: 'Token Paid',      color: '#f97316' },
  { key: 'CONVERTED',        label: 'Converted',       color: '#10b981' },
  { key: 'LOST',             label: 'Lost',            color: '#ef4444' },
];

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function AnalyticsPage() {
  const now = new Date();
  const [selectedPropertyId, setSelectedPropertyId] = useState('');
  const [propOpen, setPropOpen] = useState(false);

  const { data: properties = [] } = useQuery<Property[]>({
    queryKey: ['properties'],
    queryFn: () => getProperties(),
  });

  const selectedProperty = properties.find((p: Property) => p.id === selectedPropertyId);

  const { data: summary } = useQuery({
    queryKey: ['propertySummary', selectedPropertyId, now.getMonth() + 1, now.getFullYear()],
    queryFn: () => getPropertySummary(selectedPropertyId, now.getMonth() + 1, now.getFullYear()),
    enabled: !!selectedPropertyId,
  });

  const last6 = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    return { month: d.getMonth() + 1, year: d.getFullYear(), label: MONTHS[d.getMonth()] ?? '' };
  });

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const monthData = last6.map(({ month, year }) => useQuery({
    queryKey: ['propertySummary', selectedPropertyId, month, year],
    queryFn: () => getPropertySummary(selectedPropertyId, month, year),
    enabled: !!selectedPropertyId,
  }));

  const barData = last6.map(({ label }, i) => ({
    label,
    value: (monthData[i]?.data as { totalCollected?: number } | undefined)?.totalCollected ?? 0,
    color: '#4f46e5',
  }));

  const { data: leads = [] } = useQuery<Lead[]>({
    queryKey: ['leads', selectedPropertyId],
    queryFn: () => getLeads(selectedPropertyId),
    enabled: !!selectedPropertyId,
  });

  const leadsByStatus: Record<string, number> = {};
  for (const lead of leads) {
    leadsByStatus[lead.status] = (leadsByStatus[lead.status] ?? 0) + 1;
  }
  const maxLeadCount = Math.max(...Object.values(leadsByStatus), 1);

  const s = summary as { paid?: number; partial?: number; overdue?: number; pending?: number; totalCollected?: number; occupancyRate?: number; activeTenants?: number } | undefined;
  const donutData = [
    { label: 'Paid',    value: s?.paid    ?? 0, color: '#10b981' },
    { label: 'Partial', value: s?.partial ?? 0, color: '#3b82f6' },
    { label: 'Overdue', value: s?.overdue ?? 0, color: '#ef4444' },
    { label: 'Pending', value: s?.pending ?? 0, color: '#f59e0b' },
  ];

  return (
    <div className="flex-1 overflow-auto bg-gray-50">
      <div className="p-6 max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-600 rounded-xl">
            <TrendingUp className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-black text-gray-900">Analytics</h1>
            <p className="text-sm text-gray-500">Property performance insights</p>
          </div>
        </div>

        {/* Property selector */}
        <div className="relative w-64">
          <button
            onClick={() => setPropOpen((v) => !v)}
            className="w-full flex items-center justify-between gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:border-indigo-400 transition-colors"
          >
            <div className="flex items-center gap-2 min-w-0">
              <Building2 className="w-4 h-4 text-gray-400 shrink-0" />
              <span className="truncate">{selectedProperty?.name ?? 'Select property'}</span>
            </div>
            <ChevronDown className={cn('w-4 h-4 text-gray-400 transition-transform', propOpen && 'rotate-180')} />
          </button>
          {propOpen && (
            <div className="absolute z-10 mt-1 w-full bg-white rounded-xl shadow-lg border border-gray-100 py-1 max-h-48 overflow-auto">
              {properties.map((p: Property) => (
                <button
                  key={p.id}
                  onClick={() => { setSelectedPropertyId(p.id); setPropOpen(false); }}
                  className={cn('w-full px-4 py-2 text-sm text-left hover:bg-indigo-50 transition-colors', p.id === selectedPropertyId && 'font-semibold text-indigo-600')}
                >
                  {p.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {!selectedPropertyId ? (
          <div className="bg-white rounded-2xl p-12 text-center border border-gray-100">
            <TrendingUp className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">Select a property to view analytics</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <KpiCard label="Revenue This Month" value={formatCurrency(s?.totalCollected ?? 0)} Icon={IndianRupee} color="#4f46e5" />
              <KpiCard label="Occupancy Rate" value={`${s?.occupancyRate ?? 0}%`} sub="of total beds" Icon={BedDouble} color="#059669" />
              <KpiCard label="Active Tenants" value={String(s?.activeTenants ?? 0)} Icon={Users} color="#2563eb" />
              <KpiCard label="Overdue Cycles" value={String(s?.overdue ?? 0)} Icon={AlertTriangle} color="#dc2626" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                <h3 className="text-sm font-bold text-gray-700 mb-4">Revenue — Last 6 Months</h3>
                <BarChart data={barData} />
              </div>
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                <h3 className="text-sm font-bold text-gray-700 mb-4">Payment Status</h3>
                <DonutChart segments={donutData} />
              </div>
            </div>

            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
              <h3 className="text-sm font-bold text-gray-700 mb-4">Lead Funnel</h3>
              {leads.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">No leads yet</p>
              ) : (
                <div className="space-y-3">
                  {LEAD_STATUSES.map(({ key, label, color }) => (
                    <HorizontalBar key={key} label={label} value={leadsByStatus[key] ?? 0} max={maxLeadCount} color={color} count={leadsByStatus[key] ?? 0} />
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
