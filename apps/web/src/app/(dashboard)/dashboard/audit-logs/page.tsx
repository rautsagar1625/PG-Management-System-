'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { keepPreviousData } from '@tanstack/react-query';
import { Search, Building2, ChevronDown, ChevronLeft, ChevronRight, Shield, AlertCircle } from 'lucide-react';
import { getAuditLogs, type AuditLog } from '@/lib/audit-api';
import { getProperties } from '@/lib/properties-api';
import { PageHeader } from '@/components/ui/PageHeader';
import { formatDate, cn } from '@/lib/utils';

const ENTITY_COLORS: Record<string, string> = {
  Tenant:           'bg-blue-100 text-blue-700',
  TenantAllocation: 'bg-purple-100 text-purple-700',
  Payment:          'bg-green-100 text-green-700',
  RentCycle:        'bg-yellow-100 text-yellow-700',
  Room:             'bg-gray-100 text-gray-600',
  Bed:              'bg-gray-100 text-gray-600',
  Settlement:       'bg-indigo-100 text-indigo-700',
  Complaint:        'bg-red-100 text-red-700',
  Property:         'bg-orange-100 text-orange-700',
};

const KNOWN_ENTITIES = [
  'Tenant', 'TenantAllocation', 'Payment', 'RentCycle',
  'Room', 'Bed', 'Settlement', 'Complaint', 'Property',
];

export default function AuditLogsPage() {
  const [propertyId, setPropertyId] = useState('');
  const [entity, setEntity] = useState('');
  const [action, setAction] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: properties = [] } = useQuery({
    queryKey: ['properties'],
    queryFn: getProperties,
  });

  useEffect(() => {
    if (properties.length > 0 && !propertyId) {
      setPropertyId(properties[0]!.id);
    }
  }, [properties, propertyId]);

  const activePropertyId = propertyId || properties[0]?.id || '';

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['audit-logs', activePropertyId, entity, action, dateFrom, dateTo, page],
    queryFn: () =>
      getAuditLogs({
        propertyId: activePropertyId || undefined,
        entity: entity || undefined,
        action: action || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        page,
        limit: 50,
      }),
    placeholderData: keepPreviousData,
    enabled: !!activePropertyId,
  });

  const logs = data?.data ?? [];
  const meta = data?.meta;

  const resetPage = () => setPage(1);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Audit Log"
        subtitle="Full record of all system actions"
      />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        {properties.length > 1 && (
          <div className="relative">
            <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <select
              value={activePropertyId}
              onChange={(e) => { setPropertyId(e.target.value); resetPage(); }}
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
          value={entity}
          onChange={(e) => { setEntity(e.target.value); resetPage(); }}
          className="input-field text-sm bg-white w-44"
        >
          <option value="">All entities</option>
          {KNOWN_ENTITIES.map((e) => (
            <option key={e} value={e}>{e}</option>
          ))}
        </select>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={action}
            onChange={(e) => { setAction(e.target.value); resetPage(); }}
            placeholder="Filter by action..."
            className="input-field pl-9 text-sm w-44"
          />
        </div>

        <input
          type="date"
          value={dateFrom}
          onChange={(e) => { setDateFrom(e.target.value); resetPage(); }}
          className="input-field text-sm bg-white"
          title="From date"
        />
        <input
          type="date"
          value={dateTo}
          onChange={(e) => { setDateTo(e.target.value); resetPage(); }}
          className="input-field text-sm bg-white"
          title="To date"
        />

        {(entity || action || dateFrom || dateTo) && (
          <button
            onClick={() => { setEntity(''); setAction(''); setDateFrom(''); setDateTo(''); resetPage(); }}
            className="text-xs text-gray-500 hover:text-gray-700 underline"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="p-12 flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : isError ? (
          <div className="p-12 text-center">
            <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-3" />
            <p className="text-sm font-medium text-red-700">Failed to load audit logs</p>
            <p className="text-xs text-red-500 mt-1">{(error as Error)?.message || 'Forbidden or internal server error'}</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="p-12 text-center">
            <Shield className="w-10 h-10 text-gray-200 mx-auto mb-3" />
            <p className="text-sm text-gray-500">No audit records match your filters.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase w-40">Time</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Action</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Entity</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Actor</th>
                <th className="px-4 py-3 w-8" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {logs.map((log) => (
                <AuditRow
                  key={log.id}
                  log={log}
                  expanded={expandedId === log.id}
                  onToggle={() => setExpandedId(expandedId === log.id ? null : log.id)}
                />
              ))}
            </tbody>
          </table>
        )}

        {/* Pagination */}
        {meta && meta.totalPages > 1 && (
          <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between">
            <p className="text-xs text-gray-500">
              {((meta.page - 1) * meta.limit) + 1}–{Math.min(meta.page * meta.limit, meta.total)} of {meta.total} entries
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => p - 1)}
                disabled={page === 1}
                className="w-7 h-7 flex items-center justify-center rounded hover:bg-gray-100 disabled:opacity-40"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs text-gray-600 px-2">
                {meta.page} / {meta.totalPages}
              </span>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={page === meta.totalPages}
                className="w-7 h-7 flex items-center justify-center rounded hover:bg-gray-100 disabled:opacity-40"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function AuditRow({
  log,
  expanded,
  onToggle,
}: {
  log: AuditLog;
  expanded: boolean;
  onToggle: () => void;
}) {
  const entityCls = ENTITY_COLORS[log.entity] ?? 'bg-gray-100 text-gray-600';
  const hasDiff = log.before || log.after;

  return (
    <>
      <tr
        onClick={hasDiff ? onToggle : undefined}
        className={cn(
          'transition-colors',
          hasDiff ? 'cursor-pointer hover:bg-gray-50' : '',
          expanded ? 'bg-gray-50' : '',
        )}
      >
        <td className="px-4 py-2.5 text-xs text-gray-400 whitespace-nowrap font-mono">
          {formatDate(log.createdAt)}
        </td>
        <td className="px-4 py-2.5">
          <span className="font-mono text-xs bg-gray-800 text-gray-100 px-1.5 py-0.5 rounded">
            {log.action}
          </span>
        </td>
        <td className="px-4 py-2.5">
          <div className="flex items-center gap-2">
            <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', entityCls)}>
              {log.entity}
            </span>
            <span className="text-xs text-gray-400 font-mono">{log.entityId.slice(0, 8)}…</span>
          </div>
        </td>
        <td className="px-4 py-2.5 text-sm text-gray-600">
          {log.user?.name ?? <span className="text-gray-300 italic">system</span>}
        </td>
        <td className="px-4 py-2.5">
          {hasDiff && (
            <ChevronDown
              className={cn('w-4 h-4 text-gray-300 transition-transform', expanded && 'rotate-180')}
            />
          )}
        </td>
      </tr>

      {expanded && hasDiff && (
        <tr className="bg-gray-50">
          <td colSpan={5} className="px-4 pb-3">
            <div className="grid sm:grid-cols-2 gap-3 mt-1">
              {log.before && (
                <DiffPanel label="Before" data={log.before} />
              )}
              {log.after && (
                <DiffPanel label="After" data={log.after} />
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function DiffPanel({ label, data }: { label: string; data: Record<string, unknown> }) {
  return (
    <div>
      <p className="text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wide">{label}</p>
      <pre className="text-xs bg-white border border-gray-200 rounded-lg p-3 overflow-x-auto text-gray-700 font-mono leading-relaxed">
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
}
