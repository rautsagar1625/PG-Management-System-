'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import {
  BedDouble,
  Users,
  IndianRupee,
  AlertTriangle,
  MessageSquare,
  Building2,
  ChevronDown,
  ArrowRight,
  TrendingUp,
  PiggyBank,
} from 'lucide-react';
import { getOperatorDashboard, type PropertyCard } from '@/lib/dashboard-api';
import { getProperties } from '@/lib/properties-api';
import { OccupancyBar } from '@/components/ui/OccupancyBar';
import { formatCurrency, cn } from '@/lib/utils';

export default function DashboardPage() {
  const router = useRouter();

  const { data: properties = [], isLoading: propsLoading } = useQuery({
    queryKey: ['properties'],
    queryFn: getProperties,
  });

  const [selectedPropertyId, setSelectedPropertyId] = useState<string>('');
  const activePropertyId = selectedPropertyId || properties[0]?.id || '';

  const { data: dashboard, isLoading: dashLoading } = useQuery({
    queryKey: ['operator-dashboard'],
    queryFn: getOperatorDashboard,
    enabled: properties.length > 0,
  });

  const isLoading = propsLoading || (!!properties.length && dashLoading);

  const activeCard = dashboard?.properties.find((p) => p.propertyId === activePropertyId);
  const global = dashboard?.globalSummary;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Dashboard</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Operational overview</p>
        </div>

        {properties.length > 1 && (
          <div className="relative">
            <select
              value={activePropertyId}
              onChange={(e) => setSelectedPropertyId(e.target.value)}
              className="appearance-none bg-white border border-gray-200 rounded-xl pl-4 pr-10 py-2 text-sm font-medium text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-400"
            >
              {properties.map((p) => (
                <option key={p.id} value={p.id}>{p.name} — {p.city}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>
        )}
      </div>

      {/* No properties */}
      {properties.length === 0 && !propsLoading && (
        <div className="card p-14 text-center animate-fade-in">
          <div className="w-14 h-14 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto mb-4">
            <Building2 className="w-7 h-7 text-gray-400" />
          </div>
          <h3 className="text-base font-semibold text-gray-700 dark:text-gray-300 mb-1">No properties yet</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">Add your first PG property to get started.</p>
          <button onClick={() => router.push('/dashboard/properties/new')} className="btn-primary text-sm">
            Add Property
          </button>
        </div>
      )}

      {/* Loading skeleton */}
      {isLoading && (
        <div className="space-y-4 animate-pulse">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="card p-5">
                <div className="h-3 skeleton rounded w-20 mb-3" />
                <div className="h-7 skeleton rounded w-16" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Global summary — multi-property operators */}
      {!isLoading && global && properties.length > 1 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <MiniStat label="Properties" value={global.totalProperties} sub="active" />
          <MiniStat
            label="This Month"
            value={formatCurrency(global.totalMonthlyRevenue)}
            sub="collected"
            valueClass="text-emerald-700 dark:text-emerald-400"
          />
          <MiniStat
            label="Pending Rent"
            value={formatCurrency(global.totalPendingRent)}
            sub="across all"
            valueClass={global.totalPendingRent > 0 ? 'text-amber-700 dark:text-amber-400' : undefined}
          />
          <MiniStat
            label="Open Issues"
            value={global.totalOpenComplaints}
            sub="complaints"
            valueClass={global.totalOpenComplaints > 0 ? 'text-red-700 dark:text-red-400' : undefined}
          />
        </div>
      )}

      {/* Per-property operational stats */}
      {!isLoading && activeCard && (
        <div className="space-y-4 animate-fade-in">
          {/* Primary stat cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatCard
              title="Collected"
              value={formatCurrency(activeCard.totalCollectedRent)}
              subtitle="This month"
              icon={IndianRupee}
              color="green"
              onClick={() => router.push('/dashboard/collections')}
            />
            <StatCard
              title="Pending Rent"
              value={formatCurrency(activeCard.pendingRent)}
              subtitle="Uncollected"
              icon={AlertTriangle}
              color={activeCard.pendingRent > 0 ? 'yellow' : 'gray'}
              onClick={() => router.push('/dashboard/collections')}
            />
            <StatCard
              title="Active Tenants"
              value={activeCard.occupiedBeds}
              subtitle={`${activeCard.availableBeds} beds vacant`}
              icon={Users}
              color="blue"
              onClick={() => router.push('/dashboard/tenants')}
            />
            <StatCard
              title="Open Complaints"
              value={activeCard.openComplaints}
              subtitle="Needs attention"
              icon={MessageSquare}
              color={activeCard.openComplaints > 0 ? 'red' : 'gray'}
              onClick={() => router.push('/dashboard/complaints')}
            />
          </div>

          {/* Occupancy + Collection rate */}
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="card p-5">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">Occupancy</p>
                  <p className="text-3xl font-bold text-gray-900 dark:text-gray-100 mt-0.5">{activeCard.occupancyRate}%</p>
                </div>
                <div className="w-11 h-11 rounded-2xl flex items-center justify-center"
                  style={{ background: 'linear-gradient(135deg, #7c3aed 0%, #8b5cf6 100%)' }}
                >
                  <BedDouble className="w-5 h-5 text-white" />
                </div>
              </div>
              <OccupancyBar
                occupied={activeCard.occupiedBeds}
                total={activeCard.totalBeds}
                showLabel
                showCounts
              />
            </div>

            <div className="card p-5">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">Collection Rate</p>
                  <p className="text-3xl font-bold text-gray-900 dark:text-gray-100 mt-0.5">{activeCard.rentCollectionRate}%</p>
                </div>
                <div className="w-11 h-11 rounded-2xl flex items-center justify-center"
                  style={{ background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)' }}
                >
                  <TrendingUp className="w-5 h-5 text-white" />
                </div>
              </div>
              <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                <div
                  className={cn(
                    'h-2 rounded-full transition-all duration-500',
                    activeCard.rentCollectionRate >= 90
                      ? 'bg-gradient-to-r from-emerald-500 to-green-400'
                      : activeCard.rentCollectionRate >= 70
                        ? 'bg-gradient-to-r from-amber-500 to-yellow-400'
                        : 'bg-gradient-to-r from-red-500 to-rose-400',
                  )}
                  style={{ width: `${activeCard.rentCollectionRate}%` }}
                />
              </div>
              <div className="flex justify-between mt-2 text-xs text-gray-400 dark:text-gray-500">
                <span>{formatCurrency(activeCard.totalCollectedRent)} collected</span>
                <span>{formatCurrency(activeCard.totalExpectedRent)} expected</span>
              </div>
            </div>
          </div>

          {/* Quick action cards */}
          <div className="grid sm:grid-cols-3 gap-3">
            <QuickActionCard
              label="Collections Center"
              description="Record rent payments"
              icon={IndianRupee}
              gradient="linear-gradient(135deg, #059669 0%, #10b981 100%)"
              onClick={() => router.push('/dashboard/collections')}
            />
            <QuickActionCard
              label="Overdue Tenants"
              description={activeCard.pendingRent > 0 ? 'Follow up on overdue' : 'No overdue rent'}
              icon={AlertTriangle}
              gradient="linear-gradient(135deg, #d97706 0%, #f59e0b 100%)"
              onClick={() => router.push('/dashboard/overdue')}
            />
            <QuickActionCard
              label="Settlements"
              description="Monthly reconciliation"
              icon={PiggyBank}
              gradient="linear-gradient(135deg, #2563eb 0%, #3b82f6 100%)"
              onClick={() => router.push('/dashboard/settlements')}
            />
          </div>
        </div>
      )}

      {/* Multi-property property list */}
      {!isLoading && dashboard && dashboard.properties.length > 1 && (
        <div className="card overflow-hidden">
          <div className="px-5 py-3.5 border-b border-gray-100 dark:border-gray-700">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">All Properties</h3>
          </div>
          <div className="divide-y divide-gray-50 dark:divide-gray-700/50">
            {dashboard.properties.map((prop) => (
              <PropertyRow key={prop.propertyId} prop={prop} router={router} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function MiniStat({
  label,
  value,
  sub,
  valueClass = 'text-gray-900 dark:text-gray-100',
}: {
  label: string;
  value: string | number;
  sub: string;
  valueClass?: string;
}) {
  return (
    <div className="card p-4">
      <p className="text-xs text-gray-500 dark:text-gray-400 font-semibold uppercase tracking-wide">{label}</p>
      <p className={cn('text-xl font-bold mt-1', valueClass)}>{value}</p>
      <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{sub}</p>
    </div>
  );
}

const COLOR_MAP: Record<string, { gradient: string; iconBg: string; valueClass: string }> = {
  green:  { gradient: 'linear-gradient(135deg, #059669 0%, #10b981 100%)', iconBg: 'rgba(5,150,105,0.1)',  valueClass: 'text-emerald-700 dark:text-emerald-400' },
  yellow: { gradient: 'linear-gradient(135deg, #d97706 0%, #f59e0b 100%)', iconBg: 'rgba(217,119,6,0.1)',  valueClass: 'text-amber-700 dark:text-amber-400' },
  blue:   { gradient: 'linear-gradient(135deg, #2563eb 0%, #3b82f6 100%)', iconBg: 'rgba(37,99,235,0.1)',  valueClass: 'text-blue-700 dark:text-blue-400' },
  red:    { gradient: 'linear-gradient(135deg, #dc2626 0%, #ef4444 100%)', iconBg: 'rgba(220,38,38,0.1)',  valueClass: 'text-red-700 dark:text-red-400' },
  gray:   { gradient: 'linear-gradient(135deg, #6b7280 0%, #9ca3af 100%)', iconBg: 'rgba(107,114,128,0.1)', valueClass: 'text-gray-600 dark:text-gray-400' },
};

function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  color,
  onClick,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ElementType;
  color: string;
  onClick?: () => void;
}) {
  const c = COLOR_MAP[color] ?? COLOR_MAP.gray;

  return (
    <button
      onClick={onClick}
      className="card p-5 text-left hover:shadow-elevated hover:-translate-y-0.5 transition-all duration-200 w-full group"
    >
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">{title}</p>
          <p className={cn('text-2xl font-bold mt-1.5 truncate', c.valueClass)}>{value}</p>
          {subtitle && <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{subtitle}</p>}
        </div>
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ml-3 transition-transform duration-200 group-hover:scale-105"
          style={{ background: c.gradient }}
        >
          <Icon className="w-5 h-5 text-white" />
        </div>
      </div>
    </button>
  );
}

function QuickActionCard({
  label,
  description,
  icon: Icon,
  gradient,
  onClick,
}: {
  label: string;
  description: string;
  icon: React.ElementType;
  gradient: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="card p-4 flex items-center gap-3.5 hover:shadow-elevated hover:-translate-y-0.5 transition-all duration-200 text-left w-full group"
    >
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-105"
        style={{ background: gradient }}
      >
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{label}</p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{description}</p>
      </div>
      <ArrowRight className="w-4 h-4 text-gray-300 dark:text-gray-600 group-hover:text-gray-500 dark:group-hover:text-gray-400 group-hover:translate-x-0.5 transition-all shrink-0" />
    </button>
  );
}

function PropertyRow({ prop, router }: { prop: PropertyCard; router: ReturnType<typeof useRouter> }) {
  return (
    <button
      onClick={() => router.push(`/dashboard/properties/${prop.propertyId}`)}
      className="w-full px-5 py-3.5 flex items-center gap-4 hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors text-left group"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{prop.propertyName}</p>
          <span className="text-xs text-gray-400 dark:text-gray-500">{prop.city}</span>
        </div>
        <OccupancyBar
          occupied={prop.occupiedBeds}
          total={prop.totalBeds}
          showCounts
          className="mt-1.5 max-w-xs"
        />
      </div>
      <div className="shrink-0 text-right">
        <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">{formatCurrency(prop.totalCollectedRent)}</p>
        <p className="text-xs text-gray-400 dark:text-gray-500">{prop.rentCollectionRate}% collected</p>
      </div>
      {prop.openComplaints > 0 && (
        <div className="w-6 h-6 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center shrink-0">
          <span className="text-xs font-bold text-red-600 dark:text-red-400">{prop.openComplaints}</span>
        </div>
      )}
      <ArrowRight className="w-4 h-4 text-gray-300 dark:text-gray-600 group-hover:text-gray-500 group-hover:translate-x-0.5 transition-all shrink-0" />
    </button>
  );
}
