'use client';

import { useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  Shield,
  Activity,
  AlertCircle,
  RefreshCw,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  AlertTriangle,
  CalendarClock,
} from 'lucide-react';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/providers/AuthProvider';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { PageHeader } from '@/components/ui/PageHeader';
import { cn, formatDate } from '@/lib/utils';

// ── Types ─────────────────────────────────────────────────────────────

interface QueueCounts {
  name: string;
  waiting: number;
  active: number;
  failed: number;
  delayed: number;
  completed: number;
}

interface QueueMetrics {
  queues: QueueCounts[];
  fetchedAt: string;
}

// ── API ────────────────────────────────────────────────────────────────

async function getQueueMetrics(): Promise<QueueMetrics> {
  const { data } = await apiClient.get<{ success: boolean; data: QueueMetrics }>('/jobs/queues');
  return data.data;
}

async function triggerMarkOverdue(): Promise<{ marked: number }> {
  const { data } = await apiClient.put<{ success: boolean; data: { marked: number } }>(
    '/rent/mark-overdue',
  );
  return data.data;
}

// ── Components ─────────────────────────────────────────────────────────

function QueueCard({ queue }: { queue: QueueCounts }) {
  const hasFailed = queue.failed > 0;
  const hasActive = queue.active > 0;
  const queueLabel = queue.name
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <div
      className={cn(
        'card p-5 border-l-4',
        hasFailed ? 'border-l-red-400' : hasActive ? 'border-l-blue-400' : 'border-l-green-400',
      )}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-gray-400" />
          <h3 className="font-semibold text-gray-900 text-sm">{queueLabel}</h3>
        </div>
        {hasFailed && (
          <span className="flex items-center gap-1 text-xs text-red-600 bg-red-50 px-2 py-0.5 rounded-full font-medium">
            <AlertCircle className="w-3 h-3" />
            {queue.failed} failed
          </span>
        )}
        {!hasFailed && hasActive && (
          <span className="flex items-center gap-1 text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full font-medium">
            <Loader2 className="w-3 h-3 animate-spin" />
            Running
          </span>
        )}
        {!hasFailed && !hasActive && (
          <span className="flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full font-medium">
            <CheckCircle2 className="w-3 h-3" />
            Healthy
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Waiting', value: queue.waiting, color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: 'Active', value: queue.active, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Failed', value: queue.failed, color: 'text-red-600', bg: 'bg-red-50' },
          { label: 'Completed', value: queue.completed, color: 'text-green-600', bg: 'bg-green-50' },
        ].map(({ label, value, color, bg }) => (
          <div key={label} className={cn('rounded-lg px-3 py-2 text-center', bg)}>
            <p className={cn('text-lg font-bold', color)}>{value.toLocaleString()}</p>
            <p className="text-[10px] text-gray-500 font-medium uppercase tracking-wide mt-0.5">{label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────

export default function AdminPage() {
  const { user } = useAuth();
  const router = useRouter();

  // Guard — only SUPER_ADMIN can access this page
  useEffect(() => {
    if (user && user.systemRole !== 'SUPER_ADMIN') {
      router.replace('/dashboard');
    }
  }, [user, router]);

  const {
    data: metrics,
    isLoading,
    isError,
    refetch,
    dataUpdatedAt,
  } = useQuery({
    queryKey: ['admin', 'queue-metrics'],
    queryFn: getQueueMetrics,
    refetchInterval: 30_000, // auto-refresh every 30s
  });

  const overdueMutation = useMutation({
    mutationFn: triggerMarkOverdue,
    onSuccess: (result) => {
      toast.success(`Marked ${result.marked} rent cycles as overdue`);
    },
    onError: () => toast.error('Failed to trigger overdue job'),
  });

  if (user && user.systemRole !== 'SUPER_ADMIN') return null;

  const totalFailed = metrics?.queues.reduce((s, q) => s + q.failed, 0) ?? 0;
  const totalActive = metrics?.queues.reduce((s, q) => s + q.active, 0) ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Admin Console"
        subtitle="Platform-level controls — Super Admin only"
        actions={
          <button
            onClick={() => refetch()}
            disabled={isLoading}
            className="btn-secondary text-sm flex items-center gap-2"
          >
            <RefreshCw className={cn('w-4 h-4', isLoading && 'animate-spin')} />
            Refresh
          </button>
        }
      />

      {/* Role badge */}
      <div className="flex items-center gap-2 px-4 py-3 bg-indigo-50 border border-indigo-100 rounded-xl">
        <Shield className="w-4 h-4 text-indigo-600 shrink-0" />
        <p className="text-sm text-indigo-700">
          Logged in as <span className="font-semibold">Super Admin</span> — {user?.email}
        </p>
      </div>

      {/* Overall health banner */}
      {metrics && (
        <div
          className={cn(
            'flex items-center gap-3 px-4 py-3 rounded-xl border',
            totalFailed > 0
              ? 'bg-red-50 border-red-200 text-red-800'
              : 'bg-green-50 border-green-200 text-green-800',
          )}
        >
          {totalFailed > 0 ? (
            <XCircle className="w-5 h-5 shrink-0" />
          ) : (
            <CheckCircle2 className="w-5 h-5 shrink-0" />
          )}
          <div>
            <p className="text-sm font-semibold">
              {totalFailed > 0
                ? `${totalFailed} failed job${totalFailed !== 1 ? 's' : ''} require attention`
                : 'All queues healthy'}
            </p>
            <p className="text-xs mt-0.5 opacity-70">
              {totalActive > 0 ? `${totalActive} jobs currently running · ` : ''}
              Last checked {dataUpdatedAt ? formatDate(new Date(dataUpdatedAt).toISOString()) : '—'}
            </p>
          </div>
        </div>
      )}

      {/* Queue monitors */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <Activity className="w-4 h-4 text-gray-400" />
          <h2 className="text-sm font-semibold text-gray-700">BullMQ Queue Health</h2>
          <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded font-medium">
            auto-refreshes every 30s
          </span>
        </div>

        {isLoading ? (
          <div className="card p-12 flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : isError ? (
          <div className="card p-8 flex flex-col items-center gap-3 text-center">
            <AlertTriangle className="w-8 h-8 text-red-400" />
            <p className="text-sm text-gray-600">Failed to fetch queue metrics.</p>
            <p className="text-xs text-gray-400">
              This can happen if Redis is unreachable or the API pod restarted.
            </p>
            <button onClick={() => refetch()} className="btn-secondary text-sm mt-1">
              Try again
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {metrics?.queues.map((q) => (
              <QueueCard key={q.name} queue={q} />
            ))}
          </div>
        )}
      </section>

      {/* Manual triggers */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <CalendarClock className="w-4 h-4 text-gray-400" />
          <h2 className="text-sm font-semibold text-gray-700">Manual Triggers</h2>
        </div>
        <div className="card p-5 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-gray-900">Mark Overdue Cycles</p>
              <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">
                Finds all rent cycles past their due date and marks them OVERDUE.
                Runs automatically at 01:00 IST daily — use this to trigger it manually
                (e.g. after a delayed deployment).
              </p>
            </div>
            <button
              onClick={() => overdueMutation.mutate()}
              disabled={overdueMutation.isPending}
              className="btn-secondary text-sm shrink-0 flex items-center gap-2 disabled:opacity-50"
            >
              {overdueMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Clock className="w-4 h-4" />
              )}
              Run Now
            </button>
          </div>
          {overdueMutation.isSuccess && (
            <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 rounded-lg px-3 py-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              Marked {overdueMutation.data?.marked ?? 0} cycles as overdue
            </div>
          )}
        </div>
      </section>

      {/* Fetched at */}
      {metrics?.fetchedAt && (
        <p className="text-xs text-gray-400 text-center">
          Queue snapshot taken at {new Date(metrics.fetchedAt).toLocaleTimeString('en-IN')} IST
        </p>
      )}
    </div>
  );
}
