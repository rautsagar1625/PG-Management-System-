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
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">Operational overview</p>
        </div>

        {properties.length > 1 && (
          <div className="relative">
            <select
              value={activePropertyId}
              onChange={(e) => setSelectedPropertyId(e.target.value)}
              className="appearance-none bg-white border border-gray-200 rounded-lg pl-4 pr-10 py-2 text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-500"
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
        <div className="card p-12 text-center">
          <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-700 mb-2">No properties yet</h3>
          <p className="text-sm text-gray-500 mb-4">Add your first PG property to get started.</p>
          <button
            onClick={() => router.push('/dashboard/properties/new')}
            className="btn-primary text-sm"
          >
            Add Property
          </button>
        </div>
      )}

      {/* Loading skeleton */}
      {isLoading && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="card p-5 animate-pulse">
                <div className="h-3 bg-gray-100 rounded w-20 mb-3" />
                <div className="h-7 bg-gray-100 rounded w-16" />
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
            valueClass="text-green-700"
          />
          <MiniStat
            label="Pending Rent"
            value={formatCurrency(global.totalPendingRent)}
            sub="across all"
            valueClass={global.totalPendingRent > 0 ? 'text-yellow-700' : 'text-gray-700'}
          />
          <MiniStat
            label="Open Issues"
            value={global.totalOpenComplaints}
            sub="complaints"
            valueClass={global.totalOpenComplaints > 0 ? 'text-red-700' : 'text-gray-700'}
          />
        </div>
      )}

      {/* Per-property operational stats */}
      {!isLoading && activeCard && (
        <div className="space-y-4">
          {/* Primary stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatCard
              title="Collected"
              value={formatCurrency(activeCard.totalCollectedRent)}
              subtitle="This month"
              icon={IndianRupee}
              iconClass="bg-green-50 text-green-600"
              onClick={() => router.push('/dashboard/collections')}
            />
            <StatCard
              title="Pending Rent"
              value={formatCurrency(activeCard.pendingRent)}
              subtitle="Uncollected"
              icon={AlertTriangle}
              iconClass={activeCard.pendingRent > 0 ? 'bg-yellow-50 text-yellow-600' : 'bg-gray-50 text-gray-400'}
              onClick={() => router.push('/dashboard/collections')}
            />
            <StatCard
              title="Active Tenants"
              value={activeCard.occupiedBeds}
              subtitle={`${activeCard.availableBeds} beds vacant`}
              icon={Users}
              iconClass="bg-blue-50 text-blue-600"
              onClick={() => router.push('/dashboard/tenants')}
            />
            <StatCard
              title="Open Complaints"
              value={activeCard.openComplaints}
              subtitle="Needs attention"
              icon={MessageSquare}
              iconClass={activeCard.openComplaints > 0 ? 'bg-red-50 text-red-600' : 'bg-gray-50 text-gray-400'}
              onClick={() => router.push('/dashboard/complaints')}
            />
          </div>

          {/* Occupancy + Collection rate */}
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="card p-5">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-sm font-medium text-gray-500">Occupancy</p>
                  <p className="text-2xl font-bold text-gray-900">{activeCard.occupancyRate}%</p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center">
                  <BedDouble className="w-5 h-5 text-purple-600" />
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
                  <p className="text-sm font-medium text-gray-500">Collection Rate</p>
                  <p className="text-2xl font-bold text-gray-900">{activeCard.rentCollectionRate}%</p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-primary-50 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-primary-600" />
                </div>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2">
                <div
                  className={cn(
                    'h-2 rounded-full transition-all',
                    activeCard.rentCollectionRate >= 90
                      ? 'bg-green-500'
                      : activeCard.rentCollectionRate >= 70
                        ? 'bg-yellow-500'
                        : 'bg-red-500',
                  )}
                  style={{ width: `${activeCard.rentCollectionRate}%` }}
                />
              </div>
              <div className="flex justify-between mt-1.5 text-xs text-gray-400">
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
              iconClass="text-green-600"
              bgClass="bg-green-50"
              onClick={() => router.push('/dashboard/collections')}
            />
            <QuickActionCard
              label="Overdue Tenants"
              description={activeCard.pendingRent > 0 ? 'Follow up on overdue' : 'No overdue rent'}
              icon={AlertTriangle}
              iconClass="text-orange-600"
              bgClass="bg-orange-50"
              onClick={() => router.push('/dashboard/overdue')}
            />
            <QuickActionCard
              label="Settlements"
              description="Monthly reconciliation"
              icon={PiggyBank}
              iconClass="text-blue-600"
              bgClass="bg-blue-50"
              onClick={() => router.push('/dashboard/settlements')}
            />
          </div>
        </div>
      )}

      {/* Multi-property property list */}
      {!isLoading && dashboard && dashboard.properties.length > 1 && (
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200">
            <h3 className="text-sm font-semibold text-gray-700">All Properties</h3>
          </div>
          <div className="divide-y divide-gray-100">
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
  valueClass = 'text-gray-900',
}: {
  label: string;
  value: string | number;
  sub: string;
  valueClass?: string;
}) {
  return (
    <div className="card p-4">
      <p className="text-xs text-gray-500 font-medium">{label}</p>
      <p className={`text-xl font-bold mt-0.5 ${valueClass}`}>{value}</p>
      <p className="text-xs text-gray-400 mt-0.5">{sub}</p>
    </div>
  );
}

function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  iconClass,
  onClick,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ElementType;
  iconClass: string;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="card p-5 text-left hover:shadow-md transition-shadow w-full"
    >
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <p className="text-sm text-gray-500 font-medium">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1 truncate">{value}</p>
          {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
        </div>
        <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0', iconClass)}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </button>
  );
}

function QuickActionCard({
  label,
  description,
  icon: Icon,
  iconClass,
  bgClass,
  onClick,
}: {
  label: string;
  description: string;
  icon: React.ElementType;
  iconClass: string;
  bgClass: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="card p-4 flex items-center gap-3 hover:shadow-md transition-shadow text-left w-full group"
    >
      <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0', bgClass)}>
        <Icon className={cn('w-5 h-5', iconClass)} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900">{label}</p>
        <p className="text-xs text-gray-500 mt-0.5">{description}</p>
      </div>
      <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 transition-colors shrink-0" />
    </button>
  );
}

function PropertyRow({ prop, router }: { prop: PropertyCard; router: ReturnType<typeof useRouter> }) {
  return (
    <button
      onClick={() => router.push(`/dashboard/properties/${prop.propertyId}`)}
      className="w-full px-4 py-3 flex items-center gap-4 hover:bg-gray-50 transition-colors text-left"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-gray-900 truncate">{prop.propertyName}</p>
          <span className="text-xs text-gray-400">{prop.city}</span>
        </div>
        <OccupancyBar
          occupied={prop.occupiedBeds}
          total={prop.totalBeds}
          showCounts
          className="mt-1.5 max-w-xs"
        />
      </div>
      <div className="shrink-0 text-right">
        <p className="text-sm font-semibold text-green-700">{formatCurrency(prop.totalCollectedRent)}</p>
        <p className="text-xs text-gray-400">{prop.rentCollectionRate}% collected</p>
      </div>
      {prop.openComplaints > 0 && (
        <div className="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center shrink-0">
          <span className="text-xs font-bold text-red-600">{prop.openComplaints}</span>
        </div>
      )}
      <ArrowRight className="w-4 h-4 text-gray-300 shrink-0" />
    </button>
  );
}
