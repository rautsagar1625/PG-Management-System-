'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  CalendarCheck,
  Building2,
  ChevronDown,
  Loader2,
  Users,
  CheckCircle2,
  AlertCircle,
  Clock,
} from 'lucide-react';
import { apiClient } from '@/lib/api';
import { getProperties } from '@/lib/properties-api';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { cn } from '@/lib/utils';

// ── Types ─────────────────────────────────────────────────────────────

interface AttendanceRecord {
  id: string;
  tenantId: string;
  tenantName: string;
  roomNumber: string;
  checkInTime: string | null;
  checkOutTime: string | null;
  isValid: boolean;
  date: string;
}

interface AttendanceResponse {
  records: AttendanceRecord[];
  summary: {
    total: number;
    present: number;
  };
}

// ── API ───────────────────────────────────────────────────────────────

async function getAttendance(
  propertyId: string,
  date: string,
): Promise<AttendanceResponse> {
  const { data } = await apiClient.get<{ success: boolean; data: AttendanceResponse }>(
    '/attendance',
    { params: { propertyId, date } },
  );
  return data.data;
}

// ── Helpers ───────────────────────────────────────────────────────────

function formatTime(iso: string | null): string {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(iso));
}

function todayISO(): string {
  return new Date().toISOString().split('T')[0]!;
}

// ── Component ─────────────────────────────────────────────────────────

export default function AttendancePage() {
  const [selectedPropertyId, setSelectedPropertyId] = useState('');
  const [date, setDate] = useState(todayISO());

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

  const { data, isLoading, isError } = useQuery({
    queryKey: ['attendance', activePropertyId, date],
    queryFn: () => getAttendance(activePropertyId, date),
    enabled: !!activePropertyId && !!date,
  });

  const records = data?.records ?? [];
  const total = data?.summary.total ?? 0;
  const present = data?.summary.present ?? 0;
  const pct = total > 0 ? Math.round((present / total) * 100) : 0;
  const absent = total - present;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Attendance"
        subtitle="Daily check-in/check-out overview"
      />

      {/* Filters */}
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

        <input
          type="date"
          value={date}
          max={todayISO()}
          onChange={(e) => setDate(e.target.value)}
          className="input-field text-sm bg-white"
        />

        {date !== todayISO() && (
          <button
            onClick={() => setDate(todayISO())}
            className="text-xs text-indigo-600 hover:text-indigo-800 font-medium underline underline-offset-2"
          >
            Today
          </button>
        )}
      </div>

      {/* Summary cards */}
      {data && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <SummaryCard
            icon={Users}
            label="Total Tenants"
            value={total}
            cls="bg-gray-50 border-gray-200"
            iconCls="text-gray-500"
          />
          <SummaryCard
            icon={CheckCircle2}
            label="Present"
            value={present}
            cls="bg-green-50 border-green-200"
            iconCls="text-green-500"
          />
          <SummaryCard
            icon={AlertCircle}
            label="Absent"
            value={absent}
            cls="bg-red-50 border-red-200"
            iconCls="text-red-500"
          />
          <SummaryCard
            icon={CalendarCheck}
            label="Attendance %"
            value={`${pct}%`}
            cls={cn(
              'border',
              pct >= 80
                ? 'bg-green-50 border-green-200'
                : pct >= 50
                ? 'bg-yellow-50 border-yellow-200'
                : 'bg-red-50 border-red-200',
            )}
            iconCls={pct >= 80 ? 'text-green-500' : pct >= 50 ? 'text-yellow-500' : 'text-red-500'}
          />
        </div>
      )}

      {/* Table */}
      {properties.length === 0 && !isLoading ? (
        <div className="card">
          <EmptyState icon={Building2} title="No properties" description="Add a property first." />
        </div>
      ) : isLoading ? (
        <div className="card p-12 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      ) : isError ? (
        <div className="card p-8 flex items-center justify-center gap-2 text-sm text-red-600">
          <AlertCircle className="w-5 h-5" />
          Failed to load attendance data.
        </div>
      ) : records.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={CalendarCheck}
            title="No attendance records"
            description="No check-ins recorded for this date."
          />
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Tenant</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Room</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Check-in
                  </span>
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Check-out
                  </span>
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {records.map((rec) => (
                <tr
                  key={rec.id}
                  className={cn(
                    'transition-colors',
                    rec.checkInTime && rec.isValid
                      ? 'bg-green-50/30 hover:bg-green-50/60'
                      : rec.checkInTime && !rec.isValid
                      ? 'bg-yellow-50/40 hover:bg-yellow-50/70'
                      : 'hover:bg-gray-50',
                  )}
                >
                  <td className="px-4 py-3 font-medium text-gray-900">{rec.tenantName}</td>
                  <td className="px-4 py-3 text-gray-600">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                      {rec.roomNumber}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {rec.checkInTime ? (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-green-500" />
                        {formatTime(rec.checkInTime)}
                      </span>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {rec.checkOutTime ? (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-blue-400" />
                        {formatTime(rec.checkOutTime)}
                      </span>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {!rec.checkInTime ? (
                      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium bg-gray-100 text-gray-500">
                        <AlertCircle className="w-3 h-3" />
                        Absent
                      </span>
                    ) : rec.isValid ? (
                      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium bg-green-100 text-green-700">
                        <CheckCircle2 className="w-3 h-3" />
                        Valid
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium bg-yellow-100 text-yellow-700">
                        <AlertCircle className="w-3 h-3" />
                        Invalid
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Summary card ──────────────────────────────────────────────────────

function SummaryCard({
  icon: Icon,
  label,
  value,
  cls,
  iconCls,
}: {
  icon: React.ElementType;
  label: string;
  value: number | string;
  cls: string;
  iconCls: string;
}) {
  return (
    <div className={cn('rounded-xl border p-4 flex items-center gap-3', cls)}>
      <div className={cn('p-2 rounded-lg bg-white/70 shadow-sm', iconCls)}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-xs font-medium text-gray-500">{label}</p>
        <p className="text-2xl font-bold text-gray-900 leading-none mt-0.5">{value}</p>
      </div>
    </div>
  );
}
